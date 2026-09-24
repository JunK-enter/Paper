import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Book,
  Bookmark,
  Chapter,
  Preferences,
  ReadingProgress,
  SavedQuote,
  Series,
} from "@/types/models";
import { defaultPreferences } from "@/types/models";

interface PaperDB extends DBSchema {
  books: { key: string; value: Book; indexes: { "by-user": string } };
  chapters: { key: string; value: Chapter; indexes: { "by-book": string } };
  progress: { key: string; value: ReadingProgress; indexes: { "by-user": string } };
  bookmarks: { key: string; value: Bookmark; indexes: { "by-user": string } };
  prefs: { key: string; value: Preferences & { userId: string } };
  series: { key: string; value: Series; indexes: { "by-user": string } };
  quotes: { key: string; value: SavedQuote; indexes: { "by-user": string; "by-book": string } };
}

const DB_NAME = "paper-library";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<PaperDB>> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<PaperDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("books")) {
          const books = db.createObjectStore("books", { keyPath: "id" });
          books.createIndex("by-user", "userId");
        }
        if (!db.objectStoreNames.contains("chapters")) {
          const chapters = db.createObjectStore("chapters", { keyPath: "id" });
          chapters.createIndex("by-book", "bookId");
        }
        if (!db.objectStoreNames.contains("progress")) {
          const progress = db.createObjectStore("progress", { keyPath: "bookId" });
          progress.createIndex("by-user", "userId");
        }
        if (!db.objectStoreNames.contains("bookmarks")) {
          const bookmarks = db.createObjectStore("bookmarks", { keyPath: "id" });
          bookmarks.createIndex("by-user", "userId");
        }
        if (!db.objectStoreNames.contains("prefs")) {
          db.createObjectStore("prefs", { keyPath: "userId" });
        }
        if (!db.objectStoreNames.contains("series")) {
          const series = db.createObjectStore("series", { keyPath: "id" });
          series.createIndex("by-user", "userId");
        }
        if (!db.objectStoreNames.contains("quotes")) {
          const quotes = db.createObjectStore("quotes", { keyPath: "id" });
          quotes.createIndex("by-user", "userId");
          quotes.createIndex("by-book", "bookId");
        }
      },
    });
  }
  return dbPromise;
}

export async function loadPrefs(userId: string): Promise<Preferences> {
  const db = await getDb();
  const row = await db.get("prefs", userId);
  if (!row) return { ...defaultPreferences };
  const { userId: storedId, ...prefs } = row;
  void storedId;
  return { ...defaultPreferences, ...prefs };
}

export async function savePrefs(userId: string, prefs: Preferences) {
  const db = await getDb();
  await db.put("prefs", { ...prefs, userId });
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("paper-ui-theme", prefs.uiTheme);
  }
}
