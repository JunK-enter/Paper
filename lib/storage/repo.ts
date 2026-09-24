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
    ["books", "chapters", "progress", "bookmarks", "quotes"],
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
  const quotes = await tx.objectStore("quotes").index("by-book").getAll(bookId);
  await Promise.all(quotes.map((quote) => tx.objectStore("quotes").delete(quote.id)));
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

export async function listSeries(userId: string): Promise<Series[]> {
  const db = await getDb();
  return db.getAllFromIndex("series", "by-user", userId);
}

export async function saveSeries(series: Series) {
  const db = await getDb();
  await db.put("series", series);
}

export async function deleteSeries(id: string) {
  const db = await getDb();
  await db.delete("series", id);
}

export async function listQuotes(userId: string): Promise<SavedQuote[]> {
  const db = await getDb();
  const rows = await db.getAllFromIndex("quotes", "by-user", userId);
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveQuote(quote: SavedQuote) {
  const db = await getDb();
  await db.put("quotes", quote);
}

export async function deleteQuote(id: string) {
  const db = await getDb();
  await db.delete("quotes", id);
}

export async function exportLibrary(userId: string): Promise<LibraryExport> {
  const [books, progress, bookmarks, prefs, series, quotes] = await Promise.all([
    listBooks(userId),
    listProgress(userId),
    listBookmarks(userId),
    loadPrefs(userId),
    listSeries(userId),
    listQuotes(userId),
  ]);
  const chapters: Chapter[] = [];
  for (const book of books) {
    chapters.push(...(await listChapters(book.id)));
  }
  const { buildBackup } = await import("@/lib/backup");
  return buildBackup({ books, chapters, progress, bookmarks, series, quotes, preferences: prefs });
}

export async function importLibrary(userId: string, data: LibraryExport, mode: "merge" | "replace" = "merge") {
  const { migrateBackup } = await import("@/lib/backup");
  const backup = migrateBackup(data);
  const db = await getDb();
  if (mode === "replace") {
    const [books, series, quotes, bookmarks, progress] = await Promise.all([
      listBooks(userId),
      listSeries(userId),
      listQuotes(userId),
      listBookmarks(userId),
      listProgress(userId),
    ]);
    for (const book of books) await deleteBook(book.id);
    for (const item of series) await db.delete("series", item.id);
    for (const quote of quotes) await db.delete("quotes", quote.id);
    for (const mark of bookmarks) await db.delete("bookmarks", mark.id);
    for (const row of progress) await db.delete("progress", row.bookId);
  }
  for (const book of backup.books) await saveBook({ ...book, userId });
  for (const chapter of backup.chapters) await db.put("chapters", { ...chapter, userId });
  for (const progress of backup.progress) {
    if (mode === "merge") {
      const local = await db.get("progress", progress.bookId);
      const { mergeReadingProgress } = await import("@/lib/sync/conflicts");
      const merged = mergeReadingProgress(local, { ...progress, userId }) ?? { ...progress, userId };
      await db.put("progress", merged);
    } else {
      await db.put("progress", { ...progress, userId });
    }
  }
  for (const mark of backup.bookmarks) await saveBookmark({ ...mark, userId });
  for (const series of backup.series ?? []) await saveSeries({ ...series, userId });
  for (const quote of backup.quotes ?? []) await saveQuote({ ...quote, userId });
  if (backup.preferences) await savePrefs(userId, backup.preferences);
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
