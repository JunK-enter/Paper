import { create } from "zustand";
import type {
  Book,
  Bookmark,
  Chapter,
  LibraryExport,
  Preferences,
  ReadingProgress,
  SavedQuote,
  Series,
} from "@/types/models";
import { LOCAL_USER_ID, defaultPreferences } from "@/types/models";
import * as repo from "@/lib/storage/repo";
import { emptyProgress } from "@/lib/reading/progress";
import { syncDocument } from "@/lib/firebase/sync";
import { deviceId } from "@/lib/sync/conflicts";
import { linkBooksToSeries } from "@/lib/normalize";
import { uid } from "@/lib/utils";

export type SyncStatus = "synced" | "syncing" | "offline" | "pending";

interface LibraryState {
  ready: boolean;
  userId: string;
  email: string;
  books: Book[];
  chapters: Record<string, Chapter[]>;
  progress: Record<string, ReadingProgress>;
  bookmarks: Bookmark[];
  series: Series[];
  quotes: SavedQuote[];
  preferences: Preferences;
  offline: boolean;
  syncStatus: SyncStatus;
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
  importData: (data: LibraryExport, mode?: "merge" | "replace") => Promise<void>;
  exportData: () => Promise<LibraryExport>;
  saveSeries: (series: Series) => Promise<void>;
  removeSeries: (id: string) => Promise<void>;
  saveQuote: (quote: SavedQuote) => Promise<void>;
  removeQuote: (id: string) => Promise<void>;
  setSyncStatus: (status: SyncStatus) => void;
}

let progressTimer: ReturnType<typeof setTimeout> | null = null;
let pendingProgress: { bookId: string; value: ReadingProgress } | null = null;

async function flushProgress() {
  if (!pendingProgress) return;
  const { bookId, value } = pendingProgress;
  pendingProgress = null;
  const chapters = await repo.listChapters(bookId);
  await repo.saveProgress(value, chapters);
  useLibrary.getState().setSyncStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "pending");
  void syncDocument(value.userId, "progress", bookId, value)
    .then(() => useLibrary.getState().setSyncStatus("synced"))
    .catch(() => useLibrary.getState().setSyncStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "pending"));
}

export const useLibrary = create<LibraryState>((set, get) => ({
  ready: false,
  userId: LOCAL_USER_ID,
  email: "",
  books: [],
  chapters: {},
  progress: {},
  bookmarks: [],
  series: [],
  quotes: [],
  preferences: defaultPreferences,
  offline: false,
  syncStatus: "synced",

  boot: async () => {
    const userId = get().userId;
    const [books, progressRows, bookmarks, preferences, seriesRows, quotes] = await Promise.all([
      repo.listBooks(userId),
      repo.listProgress(userId),
      repo.listBookmarks(userId),
      repo.readPreferences(userId),
      repo.listSeries(userId),
      repo.listQuotes(userId),
    ]);
    const linked = linkBooksToSeries(books, seriesRows);
    for (const series of linked.series) {
      const previous = seriesRows.find((item) => item.id === series.id);
      if (!previous || previous.bookIds.join() !== series.bookIds.join() || previous.title !== series.title) {
        await repo.saveSeries(series);
      }
    }
    for (const book of linked.books) {
      const previous = books.find((item) => item.id === book.id);
      if (previous && (previous.seriesId !== book.seriesId || previous.volumeNumber !== book.volumeNumber)) {
        await repo.saveBook(book);
      }
    }
    const progress: Record<string, ReadingProgress> = {};
    for (const row of progressRows) progress[row.bookId] = row;
    set({
      ready: true,
      books: linked.books.sort((a, b) => (b.lastOpenedAt ?? b.createdAt) - (a.lastOpenedAt ?? a.createdAt)),
      progress,
      bookmarks,
      series: linked.series,
      quotes,
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
    const chapters = await repo.listChapters(bookId);
    const quotes = get().quotes.filter((quote) => quote.bookId === bookId);
    const series = get().series.filter((item) => item.bookIds.includes(bookId));
    for (const item of series) {
      const next = { ...item, bookIds: item.bookIds.filter((id) => id !== bookId), updatedAt: Date.now() };
      await repo.saveSeries(next);
      void syncDocument(userId, "series", next.id, next).catch(() => undefined);
    }
    await repo.deleteBook(bookId);
    set((s) => ({
      books: s.books.filter((b) => b.id !== bookId),
      bookmarks: s.bookmarks.filter((m) => m.bookId !== bookId),
      quotes: s.quotes.filter((quote) => quote.bookId !== bookId),
      series: s.series.map((item) => item.bookIds.includes(bookId) ? { ...item, bookIds: item.bookIds.filter((id) => id !== bookId) } : item),
    }));
    void syncDocument(userId, "books", bookId, null).catch(() => undefined);
    void syncDocument(userId, "progress", bookId, null).catch(() => undefined);
    for (const chapter of chapters) void syncDocument(userId, "chapters", chapter.id, null).catch(() => undefined);
    for (const quote of quotes) void syncDocument(userId, "quotes", quote.id, null).catch(() => undefined);
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
    const value = { ...next, overallProgress: overall, updatedAt: Date.now(), deviceId: deviceId() };
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

  importData: async (data, mode = "merge") => {
    await repo.importLibrary(get().userId, data, mode);
    await get().boot();
  },

  exportData: async () => repo.exportLibrary(get().userId),

  saveSeries: async (series) => {
    await repo.saveSeries(series);
    set((s) => {
      const exists = s.series.some((item) => item.id === series.id);
      return { series: exists ? s.series.map((item) => (item.id === series.id ? series : item)) : [...s.series, series] };
    });
    void syncDocument(series.userId, "series", series.id, series).catch(() => undefined);
  },

  removeSeries: async (id) => {
    const userId = get().userId;
    const series = get().series.find((item) => item.id === id);
    await repo.deleteSeries(id);
    const books = get().books.map((book) =>
      book.seriesId === id ? { ...book, seriesId: undefined, seriesTitle: undefined, seriesPart: undefined, volumeNumber: undefined, volumeLabel: undefined, updatedAt: Date.now() } : book,
    );
    for (const book of books) {
      if (series?.bookIds.includes(book.id)) await repo.saveBook(book);
    }
    set({ series: get().series.filter((item) => item.id !== id), books });
    void syncDocument(userId, "series", id, null).catch(() => undefined);
  },

  saveQuote: async (quote) => {
    await repo.saveQuote(quote);
    set((s) => {
      const exists = s.quotes.some((item) => item.id === quote.id);
      const quotes = exists ? s.quotes.map((item) => (item.id === quote.id ? quote : item)) : [quote, ...s.quotes];
      return { quotes };
    });
    void syncDocument(quote.userId, "quotes", quote.id, quote).catch(() => undefined);
  },

  removeQuote: async (id) => {
    const userId = get().userId;
    await repo.deleteQuote(id);
    set((s) => ({ quotes: s.quotes.filter((item) => item.id !== id) }));
    void syncDocument(userId, "quotes", id, null).catch(() => undefined);
  },

  setSyncStatus: (syncStatus) => set({ syncStatus }),
}));

export async function flushReadingProgress() {
  if (progressTimer) clearTimeout(progressTimer);
  await flushProgress();
}

export function ensureProgress(userId: string, bookId: string, chapterId: string, existing?: ReadingProgress) {
  return existing ?? emptyProgress(userId, bookId, chapterId);
}
