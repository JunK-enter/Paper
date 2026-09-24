import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Book,
  Bookmark,
  Chapter,
  Preferences,
  ReadingProgress,
} from "@/types/models";
import { defaultPreferences } from "@/types/models";

interface PaperDB extends DBSchema {
  books: { key: string; value: Book; indexes: { "by-user": string } };
  chapters: { key: string; value: Chapter; indexes: { "by-book": string } };
  progress: { key: string; value: ReadingProgress; indexes: { "by-user": string } };
  bookmarks: { key: string; value: Bookmark; indexes: { "by-user": string } };
  prefs: { key: string; value: Preferences & { userId: string } };
}

const DB_NAME = "paper-library";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PaperDB>> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<PaperDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const books = db.createObjectStore("books", { keyPath: "id" });
        books.createIndex("by-user", "userId");
        const chapters = db.createObjectStore("chapters", { keyPath: "id" });
        chapters.createIndex("by-book", "bookId");
        const progress = db.createObjectStore("progress", { keyPath: "bookId" });
        progress.createIndex("by-user", "userId");
        const bookmarks = db.createObjectStore("bookmarks", { keyPath: "id" });
        bookmarks.createIndex("by-user", "userId");
        db.createObjectStore("prefs", { keyPath: "userId" });
      },
    });
  }
  return dbPromise;
}

export async function loadPrefs(userId: string): Promise<Preferences> {
  const db = await getDb();
  const row = await db.get("prefs", userId);
  if (!row) return { ...defaultPreferences };
  const { userId: _id, ...prefs } = row;
  return { ...defaultPreferences, ...prefs };
}

export async function savePrefs(userId: string, prefs: Preferences) {
  const db = await getDb();
  await db.put("prefs", { ...prefs, userId });
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("paper-ui-theme", prefs.uiTheme);
  }
}
