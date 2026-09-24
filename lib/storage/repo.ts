import type {
  Book,
  Bookmark,
  Chapter,
  LibraryExport,
  Preferences,
  ReadingProgress,
} from "@/types/models";
import { LOCAL_USER_ID } from "@/types/models";
import { getDb, loadPrefs, savePrefs } from "@/lib/storage/db";
import { computeOverall } from "@/lib/reading/progress";

export async function listBooks(userId: string): Promise<Book[]> {
  const db = await getDb();
  return db.getAllFromIndex("books", "by-user", userId);
}

export async function getBook(id: string): Promise<Book | undefined> {
  const db = await getDb();
  return db.get("books", id);
}

export async function saveBook(book: Book) {
  const db = await getDb();
  await db.put("books", book);
}

export async function deleteBook(bookId: string) {
  const db = await getDb();
  const tx = db.transaction(
    ["books", "chapters", "progress", "bookmarks"],
    "readwrite",
  );
  await tx.objectStore("books").delete(bookId);
  const chapters = await tx.objectStore("chapters").index("by-book").getAll(bookId);
  await Promise.all(chapters.map((c) => tx.objectStore("chapters").delete(c.id)));
  await tx.objectStore("progress").delete(bookId);
  const marks = await tx.objectStore("bookmarks").getAll();
  await Promise.all(
    marks
      .filter((m) => m.bookId === bookId)
      .map((m) => tx.objectStore("bookmarks").delete(m.id)),
  );
  await tx.done;
}

export async function listChapters(bookId: string): Promise<Chapter[]> {
  const db = await getDb();
  const rows = await db.getAllFromIndex("chapters", "by-book", bookId);
  return rows.sort((a, b) => a.order - b.order);
}

export async function getChapter(id: string): Promise<Chapter | undefined> {
  const db = await getDb();
  return db.get("chapters", id);
}

export async function saveChapter(chapter: Chapter) {
  const db = await getDb();
  await db.put("chapters", chapter);
  const chapters = await listChapters(chapter.bookId);
  const book = await getBook(chapter.bookId);
  if (!book) return;
  await saveBook({
    ...book,
    chapterCount: chapters.length,
    publishedCount: chapters.filter((c) => c.status === "published").length,
    updatedAt: Date.now(),
  });
}

export async function deleteChapter(chapterId: string) {
  const db = await getDb();
  const chapter = await db.get("chapters", chapterId);
  if (!chapter) return;
  await db.delete("chapters", chapterId);
  const chapters = await listChapters(chapter.bookId);
  await Promise.all(
    chapters.map((c, index) => saveChapter({ ...c, order: index })),
  );
  const book = await getBook(chapter.bookId);
  if (book) {
    const fresh = await listChapters(chapter.bookId);
    await saveBook({
      ...book,
      chapterCount: fresh.length,
      publishedCount: fresh.filter((c) => c.status === "published").length,
      updatedAt: Date.now(),
    });
  }
}

export async function listProgress(userId: string): Promise<ReadingProgress[]> {
  const db = await getDb();
  return db.getAllFromIndex("progress", "by-user", userId);
}

export async function getProgress(bookId: string) {
  const db = await getDb();
  return db.get("progress", bookId);
}

export async function saveProgress(progress: ReadingProgress, chapters: Chapter[]) {
  const overall = computeOverall(
    chapters,
    progress.maxFractions,
    progress.completedChapterIds,
  );
  const db = await getDb();
  await db.put("progress", { ...progress, overallProgress: overall });
  return overall;
}

export async function listBookmarks(userId: string): Promise<Bookmark[]> {
  const db = await getDb();
  const rows = await db.getAllFromIndex("bookmarks", "by-user", userId);
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveBookmark(mark: Bookmark) {
  const db = await getDb();
  await db.put("bookmarks", mark);
}

export async function deleteBookmark(id: string) {
  const db = await getDb();
  await db.delete("bookmarks", id);
}

export async function exportLibrary(userId: string): Promise<LibraryExport> {
  const [books, progress, bookmarks, prefs] = await Promise.all([
    listBooks(userId),
    listProgress(userId),
    listBookmarks(userId),
    loadPrefs(userId),
  ]);
  const chapters: Chapter[] = [];
  for (const book of books) {
    chapters.push(...(await listChapters(book.id)));
  }
  void prefs;
  return {
    format: "paper-library",
    version: 1,
    exportedAt: new Date().toISOString(),
    books,
    chapters,
    progress,
    bookmarks,
  };
}

export async function importLibrary(userId: string, data: LibraryExport) {
  if (data.format !== "paper-library" || data.version !== 1) {
    throw new Error("지원하지 않는 서재 파일입니다.");
  }
  for (const book of data.books) {
    await saveBook({ ...book, userId });
  }
  for (const chapter of data.chapters) {
    const db = await getDb();
    await db.put("chapters", { ...chapter, userId });
  }
  for (const progress of data.progress) {
    const db = await getDb();
    await db.put("progress", { ...progress, userId });
  }
  for (const mark of data.bookmarks) {
    await saveBookmark({ ...mark, userId });
  }
}

export async function readPreferences(userId: string): Promise<Preferences> {
  return loadPrefs(userId);
}

export async function writePreferences(userId: string, prefs: Preferences) {
  await savePrefs(userId, prefs);
}

export function activeUserFallback() {
  return LOCAL_USER_ID;
}
