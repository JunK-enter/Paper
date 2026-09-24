import { create } from "zustand";
import type {
  Book,
  Bookmark,
  Chapter,
  LibraryExport,
  Preferences,
  ReadingProgress,
} from "@/types/models";
import { LOCAL_USER_ID, defaultPreferences } from "@/types/models";
import * as repo from "@/lib/storage/repo";
import { emptyProgress } from "@/lib/reading/progress";
import { syncDocument } from "@/lib/firebase/sync";
import { uid } from "@/lib/utils";

interface LibraryState {
  ready: boolean;
  userId: string;
  email: string;
  books: Book[];
  chapters: Record<string, Chapter[]>;
  progress: Record<string, ReadingProgress>;
  bookmarks: Bookmark[];
  preferences: Preferences;
  offline: boolean;
  boot: () => Promise<void>;
  setUser: (userId: string, email: string) => Promise<void>;
  refresh: () => Promise<void>;
  loadChapters: (bookId: string) => Promise<Chapter[]>;
  setPreferences: (patch: Partial<Preferences>) => Promise<void>;
  upsertBook: (book: Book) => Promise<void>;
  removeBook: (bookId: string) => Promise<void>;
  upsertChapter: (chapter: Chapter) => Promise<void>;
  removeChapter: (bookId: string, chapterId: string) => Promise<void>;
  reorderChapters: (bookId: string, orderedIds: string[]) => Promise<void>;
  touchProgress: (bookId: string, next: ReadingProgress) => Promise<void>;
  addBookmark: (mark: Omit<Bookmark, "id" | "createdAt" | "userId">) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
  importData: (data: LibraryExport) => Promise<void>;
  exportData: () => Promise<LibraryExport>;
}

let progressTimer: ReturnType<typeof setTimeout> | null = null;
let pendingProgress: { bookId: string; value: ReadingProgress } | null = null;

async function flushProgress() {
  if (!pendingProgress) return;
  const { bookId, value } = pendingProgress;
  pendingProgress = null;
  const chapters = await repo.listChapters(bookId);
  await repo.saveProgress(value, chapters);
  void syncDocument(value.userId, "progress", bookId, value).catch(() => undefined);
}

export const useLibrary = create<LibraryState>((set, get) => ({
  ready: false,
  userId: LOCAL_USER_ID,
  email: "",
  books: [],
  chapters: {},
  progress: {},
  bookmarks: [],
  preferences: defaultPreferences,
  offline: false,

  boot: async () => {
    const userId = get().userId;
    const [books, progressRows, bookmarks, preferences] = await Promise.all([
      repo.listBooks(userId),
      repo.listProgress(userId),
      repo.listBookmarks(userId),
      repo.readPreferences(userId),
    ]);
    const progress: Record<string, ReadingProgress> = {};
    for (const row of progressRows) progress[row.bookId] = row;
    set({
      ready: true,
      books: books.sort((a, b) => (b.lastOpenedAt ?? b.createdAt) - (a.lastOpenedAt ?? a.createdAt)),
      progress,
      bookmarks,
      preferences,
      offline: typeof navigator !== "undefined" ? !navigator.onLine : false,
    });
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("paper-ui-theme", preferences.uiTheme);
    }
  },

  setUser: async (userId, email) => {
    set({ userId, email, ready: false });
    await get().boot();
  },

  refresh: async () => {
    await get().boot();
  },

  loadChapters: async (bookId) => {
    const chapters = await repo.listChapters(bookId);
    set((s) => ({ chapters: { ...s.chapters, [bookId]: chapters } }));
    return chapters;
  },

  setPreferences: async (patch) => {
    const preferences = { ...get().preferences, ...patch };
    set({ preferences });
    await repo.writePreferences(get().userId, preferences);
  },

  upsertBook: async (book) => {
    await repo.saveBook(book);
    set((s) => {
      const exists = s.books.some((b) => b.id === book.id);
      const books = exists
        ? s.books.map((b) => (b.id === book.id ? book : b))
        : [book, ...s.books];
      return { books };
    });
    void syncDocument(book.userId, "books", book.id, book).catch(() => undefined);
  },

  removeBook: async (bookId) => {
    const userId = get().userId;
    await repo.deleteBook(bookId);
    set((s) => ({
      books: s.books.filter((b) => b.id !== bookId),
      bookmarks: s.bookmarks.filter((m) => m.bookId !== bookId),
    }));
    void syncDocument(userId, "books", bookId, null).catch(() => undefined);
  },

  upsertChapter: async (chapter) => {
    await repo.saveChapter(chapter);
    const chapters = await repo.listChapters(chapter.bookId);
    const book = await repo.getBook(chapter.bookId);
    set((s) => ({
      chapters: { ...s.chapters, [chapter.bookId]: chapters },
      books: book ? s.books.map((b) => (b.id === book.id ? book : b)) : s.books,
    }));
    void syncDocument(chapter.userId, "chapters", chapter.id, chapter).catch(() => undefined);
    if (book) void syncDocument(book.userId, "books", book.id, book).catch(() => undefined);
  },

  removeChapter: async (bookId, chapterId) => {
    const userId = get().userId;
    await repo.deleteChapter(chapterId);
    const chapters = await repo.listChapters(bookId);
    const book = await repo.getBook(bookId);
    set((s) => ({
      chapters: { ...s.chapters, [bookId]: chapters },
      books: book ? s.books.map((b) => (b.id === book.id ? book : b)) : s.books,
    }));
    void syncDocument(userId, "chapters", chapterId, null).catch(() => undefined);
  },

  reorderChapters: async (bookId, orderedIds) => {
    const current = get().chapters[bookId] ?? (await get().loadChapters(bookId));
    const byId = new Map(current.map((c) => [c.id, c]));
    const next = orderedIds
      .map((id, order) => {
        const chapter = byId.get(id);
        return chapter ? { ...chapter, order, updatedAt: Date.now() } : null;
      })
      .filter((c): c is Chapter => Boolean(c));
    for (const chapter of next) await repo.saveChapter(chapter);
    set((s) => ({ chapters: { ...s.chapters, [bookId]: next } }));
  },

  touchProgress: async (bookId, next) => {
    const chapters = get().chapters[bookId] ?? [];
    const overall = chapters.length
      ? (await import("@/lib/reading/progress")).computeOverall(
          chapters,
          next.maxFractions,
          next.completedChapterIds,
        )
      : next.overallProgress;
    const value = { ...next, overallProgress: overall };
    set((s) => ({ progress: { ...s.progress, [bookId]: value } }));
    pendingProgress = { bookId, value };
    if (progressTimer) clearTimeout(progressTimer);
    progressTimer = setTimeout(() => {
      void flushProgress();
    }, 800);
  },

  addBookmark: async (mark) => {
    const bookmark: Bookmark = {
      ...mark,
      id: uid(),
      userId: get().userId,
      createdAt: Date.now(),
    };
    await repo.saveBookmark(bookmark);
    set((s) => ({ bookmarks: [bookmark, ...s.bookmarks] }));
    void syncDocument(bookmark.userId, "bookmarks", bookmark.id, bookmark).catch(() => undefined);
  },

  removeBookmark: async (id) => {
    const userId = get().userId;
    await repo.deleteBookmark(id);
    set((s) => ({ bookmarks: s.bookmarks.filter((m) => m.id !== id) }));
    void syncDocument(userId, "bookmarks", id, null).catch(() => undefined);
  },

  importData: async (data) => {
    await repo.importLibrary(get().userId, data);
    await get().boot();
  },

  exportData: async () => repo.exportLibrary(get().userId),
}));

export async function flushReadingProgress() {
  if (progressTimer) clearTimeout(progressTimer);
  await flushProgress();
}

export function ensureProgress(userId: string, bookId: string, chapterId: string, existing?: ReadingProgress) {
  return existing ?? emptyProgress(userId, bookId, chapterId);
}
