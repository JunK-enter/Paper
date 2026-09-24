import shelved from "@/data/shelved-book.json";
import { pushLibrary, syncDocument } from "@/lib/firebase/sync";
import { parseManuscript } from "@/lib/manuscript";
import { getDb } from "@/lib/storage/db";
import { getProgress, listBooks, listChapters, saveBook, saveChapter, saveProgress } from "@/lib/storage/repo";
import { coverForTitle } from "@/lib/covers";
import { uid } from "@/lib/utils";
import type { Book, Chapter } from "@/types/models";

const SHELVED_ID = "shelved-mom-calls";

export async function ensureShelvedBook(userId: string) {
  if (!userId) return;
  const books = await listBooks(userId);
  if (books.some((book) => book.id === SHELVED_ID || book.title === shelved.title)) return;
  const now = Date.now();
  await saveBook({
    id: SHELVED_ID,
    userId,
    title: shelved.title,
    author: shelved.author,
    genre: shelved.genre,
    description: shelved.description,
    cover: { kind: "preset", presetId: shelved.coverPreset },
    status: "unread",
    archived: false,
    chapterCount: shelved.chapters.length,
    publishedCount: shelved.chapters.length,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
  });
  for (const [order, chapter] of shelved.chapters.entries()) {
    await saveChapter({
      id: `${SHELVED_ID}-${order}`,
      bookId: SHELVED_ID,
      userId,
      title: chapter.title,
      content: chapter.content,
      order,
      status: "published",
      createdAt: now,
      updatedAt: now,
    });
  }
  try {
    await pushLibrary(userId);
  } catch {
    /* 계정 동기화가 실패해도 이 브라우저 서재에는 남습니다. */
  }
}

export async function saveUploadedManuscript(userId: string, filename: string, text: string): Promise<Book> {
  const parsed = parseManuscript(text, filename);
  const now = Date.now();
  const existing = parsed.seriesTitle
    ? (await listBooks(userId)).find((book) => book.seriesTitle === parsed.seriesTitle && book.seriesPart === parsed.partNumber)
    : undefined;
  const bookId = existing?.id ?? uid();
  const look = coverForTitle(parsed.seriesTitle ?? parsed.title);
  const motif = coverForTitle(parsed.title).motif;
  const book: Book = {
    id: bookId,
    userId,
    title: parsed.title,
    author: "",
    genre: parsed.seriesTitle ? "시리즈" : "단편소설",
    description: parsed.seriesTitle ? `${parsed.seriesTitle} ${parsed.partNumber}부` : "",
    seriesTitle: parsed.seriesTitle,
    seriesPart: parsed.partNumber,
    cover: existing?.cover ?? { kind: "preset", presetId: look.presetId, motif },
    status: existing?.status ?? "unread",
    archived: existing?.archived ?? false,
    chapterCount: parsed.chapters.length,
    publishedCount: parsed.chapters.length,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastOpenedAt: existing?.lastOpenedAt ?? null,
  };
  await saveBook(book);
  if (existing) {
    const previous = await listChapters(bookId);
    const db = await getDb();
    for (const chapter of previous) {
      await db.delete("chapters", chapter.id);
      try {
        await syncDocument(userId, "chapters", chapter.id, null);
      } catch {
        /* 이 브라우저에서는 이미 지워졌습니다. */
      }
    }
  }
  const chapters: Chapter[] = parsed.chapters.map((chapter, order) => ({
    id: uid(),
    bookId,
    userId,
    title: chapter.title,
    content: chapter.content,
    order,
    status: "published",
    createdAt: now,
    updatedAt: now,
  }));
  for (const chapter of chapters) await saveChapter(chapter);
  const progress = await getProgress(bookId);
  if (progress && !chapters.some((chapter) => chapter.id === progress.chapterId)) {
    const ids = new Set(chapters.map((chapter) => chapter.id));
    await saveProgress(
      {
        ...progress,
        chapterId: chapters[0].id,
        anchorParagraph: 0,
        anchorOffset: 0,
        maxFractions: Object.fromEntries(Object.entries(progress.maxFractions).filter(([id]) => ids.has(id))),
        completedChapterIds: progress.completedChapterIds.filter((id) => ids.has(id)),
      },
      chapters,
    );
  }
  try {
    await pushLibrary(userId);
  } catch {
    /* 로컬 서재에는 저장된 상태입니다. */
  }
  return book;
}
