import type { Book, Bookmark, Chapter, LibraryExport, Preferences, ReadingProgress, SavedQuote, Series } from "@/types/models";
import { defaultPreferences } from "@/types/models";
import { normalizeBook } from "@/lib/normalize";

export const BACKUP_SCHEMA = 2;
export const APP_VERSION = "0.1.0";

export interface BackupPreview {
  books: number;
  series: number;
  quotes: number;
  exportedAt: string;
}

export function migrateBackup(raw: unknown): LibraryExport {
  if (!raw || typeof raw !== "object") throw new Error("백업 파일이 아닙니다.");
  const data = raw as Partial<LibraryExport> & { schemaVersion?: number };
  const version = data.schemaVersion ?? data.version;
  if (data.format !== "paper-library" || (version !== 1 && version !== 2)) {
    throw new Error("PAPER 백업 파일이 아닙니다.");
  }
  const books = (data.books ?? []).map((book) => normalizeBook(book as Book));
  return {
    format: "paper-library",
    version: 2,
    schemaVersion: 2,
    exportedAt: data.exportedAt ?? new Date().toISOString(),
    appVersion: data.appVersion,
    books,
    chapters: (data.chapters ?? []) as Chapter[],
    progress: (data.progress ?? []) as ReadingProgress[],
    bookmarks: (data.bookmarks ?? []) as Bookmark[],
    series: (data.series ?? []) as Series[],
    quotes: (data.quotes ?? []) as SavedQuote[],
    preferences: data.preferences ? { ...defaultPreferences, ...data.preferences } : undefined,
  };
}

export function previewBackup(data: LibraryExport): BackupPreview {
  return {
    books: data.books.length,
    series: data.series?.length ?? 0,
    quotes: data.quotes?.length ?? 0,
    exportedAt: data.exportedAt,
  };
}

export function backupFilename(date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return `paper-library-backup-${day}.json`;
}

export function buildBackup(input: {
  books: Book[];
  chapters: Chapter[];
  progress: ReadingProgress[];
  bookmarks: Bookmark[];
  series: Series[];
  quotes: SavedQuote[];
  preferences: Preferences;
}): LibraryExport {
  return {
    format: "paper-library",
    version: 2,
    schemaVersion: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    books: input.books.map(normalizeBook),
    chapters: input.chapters,
    progress: input.progress,
    bookmarks: input.bookmarks,
    series: input.series,
    quotes: input.quotes,
    preferences: input.preferences,
  };
}
