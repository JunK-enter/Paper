import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { firebaseServices } from "@/lib/firebase/client";
import type {
  Book,
  Bookmark,
  Chapter,
  Preferences,
  ReadingProgress,
} from "@/types/models";
import {
  getBook,
  listBookmarks,
  listBooks,
  listChapters,
  listProgress,
  saveBook,
  saveBookmark,
  saveChapter,
  getProgress,
} from "@/lib/storage/repo";
import { getDb, loadPrefs, savePrefs } from "@/lib/storage/db";

function services() {
  return firebaseServices();
}

export async function pushUserProfile(
  userId: string,
  email: string,
  displayName: string,
  preferences: Preferences,
) {
  const svc = services();
  if (!svc) return;
  await setDoc(
    doc(svc.db, "users", userId),
    {
      email,
      displayName,
      preferences,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

async function pullCollection<T>(path: string): Promise<T[]> {
  const svc = services();
  if (!svc) return [];
  const snap = await getDocs(collection(svc.db, path));
  return snap.docs.map((d) => d.data() as T);
}

/** Merge remote library into IndexedDB. Newer lastReadAt / updatedAt wins. */
export async function pullLibrary(userId: string) {
  const svc = services();
  if (!svc) return;
  const [books, chapters, progress, bookmarks] = await Promise.all([
    pullCollection<Book>(`users/${userId}/books`),
    pullCollection<Chapter>(`users/${userId}/chapters`),
    pullCollection<ReadingProgress>(`users/${userId}/progress`),
    pullCollection<Bookmark>(`users/${userId}/bookmarks`),
  ]);
  const profile = await getDoc(doc(svc.db, "users", userId));
  if (profile.exists()) {
    const prefs = profile.data().preferences as Preferences | undefined;
    if (prefs) {
      const local = await loadPrefs(userId);
      await savePrefs(userId, { ...local, ...prefs });
    }
  }
  for (const book of books) {
    const local = await getBook(book.id);
    if (!local || book.updatedAt >= local.updatedAt) await saveBook(book);
  }
  const db = await getDb();
  for (const chapter of chapters) {
    const local = await db.get("chapters", chapter.id);
    if (!local || chapter.updatedAt >= local.updatedAt) {
      await db.put("chapters", chapter);
    }
  }
  for (const row of progress) {
    const local = await getProgress(row.bookId);
    if (!local || row.lastReadAt >= local.lastReadAt) {
      await db.put("progress", row);
    }
  }
  for (const mark of bookmarks) {
    await saveBookmark(mark);
  }
}

export async function pushLibrary(userId: string) {
  const svc = services();
  if (!svc) return;
  const [books, progress, bookmarks] = await Promise.all([
    listBooks(userId),
    listProgress(userId),
    listBookmarks(userId),
  ]);
  const chapters: Chapter[] = [];
  for (const book of books) chapters.push(...(await listChapters(book.id)));

  const batchSize = 400;
  const ops: Array<() => Promise<void>> = [];
  const queue = async (path: string, id: string, data: object) => {
    ops.push(() => setDoc(doc(svc.db, path, id), data, { merge: true }));
  };
  for (const book of books) await queue(`users/${userId}/books`, book.id, book);
  for (const chapter of chapters)
    await queue(`users/${userId}/chapters`, chapter.id, chapter);
  for (const row of progress)
    await queue(`users/${userId}/progress`, row.bookId, row);
  for (const mark of bookmarks)
    await queue(`users/${userId}/bookmarks`, mark.id, mark);

  for (let i = 0; i < ops.length; i += batchSize) {
    const slice = ops.slice(i, i + batchSize);
    const batch = writeBatch(svc.db);
    void batch;
    await Promise.all(slice.map((fn) => fn()));
  }
}

export async function syncDocument(
  userId: string,
  kind: "books" | "chapters" | "progress" | "bookmarks",
  id: string,
  data: object | null,
) {
  const svc = services();
  if (!svc || typeof navigator !== "undefined" && !navigator.onLine) return;
  const ref = doc(svc.db, `users/${userId}/${kind}`, id);
  if (data === null) await deleteDoc(ref);
  else await setDoc(ref, data, { merge: true });
}

export async function mirrorLocalToAccount(fromUserId: string, toUserId: string) {
  const books = await listBooks(fromUserId);
  for (const book of books) {
    const chapters = await listChapters(book.id);
    const progress = await getProgress(book.id);
    await saveBook({ ...book, userId: toUserId });
    const db = await getDb();
    for (const chapter of chapters) {
      await db.put("chapters", { ...chapter, userId: toUserId });
    }
    if (progress) await db.put("progress", { ...progress, userId: toUserId });
  }
  const marks = await listBookmarks(fromUserId);
  for (const mark of marks) await saveBookmark({ ...mark, userId: toUserId });
  await pushLibrary(toUserId);
}
