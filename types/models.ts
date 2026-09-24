export type UiTheme = "light" | "dark" | "system";
export type ReadingTheme = "light" | "dark" | "sepia";
export type ReadingFont = "literata" | "lora" | "serif-kr";
export type ReadingMode = "scroll" | "paginated";
export type ReadingStatus = "unread" | "reading" | "completed";
export type ChapterStatus = "draft" | "published";
export type LibraryView = "grid" | "list";
export type LibrarySort =
  | "opened"
  | "added"
  | "title"
  | "author"
  | "progress";
export type LibraryFilter = "all" | "reading" | "unread" | "completed";

export type CoverMotif = "rule" | "dots" | "arc" | "diamond" | "wave" | "frame" | "grid" | "seal";

export interface Cover {
  kind: "preset" | "upload" | "typographic";
  presetId?: string;
  motif?: CoverMotif;
  imageDataUrl?: string;
}

export interface Book {
  id: string;
  userId: string;
  title: string;
  author: string;
  genre: string;
  seriesTitle?: string;
  seriesPart?: number;
  description: string;
  cover: Cover;
  status: ReadingStatus;
  archived: boolean;
  chapterCount: number;
  publishedCount: number;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number | null;
}

export interface Chapter {
  id: string;
  bookId: string;
  userId: string;
  title: string;
  content: string;
  order: number;
  status: ChapterStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ReadingProgress {
  userId: string;
  bookId: string;
  chapterId: string;
  anchorParagraph: number;
  anchorOffset: number;
  /** Highest fraction reached per chapter, 0–1. */
  maxFractions: Record<string, number>;
  completedChapterIds: string[];
  overallProgress: number;
  lastReadAt: number;
}

export interface Bookmark {
  id: string;
  userId: string;
  bookId: string;
  chapterId: string;
  anchorParagraph: number;
  anchorOffset: number;
  excerpt: string;
  createdAt: number;
}

export interface Preferences {
  uiTheme: UiTheme;
  readingTheme: ReadingTheme;
  fontFamily: ReadingFont;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  readingWidth: number;
  readingMode: ReadingMode;
  libraryView: LibraryView;
  displayName: string;
}

export interface LibraryExport {
  format: "paper-library";
  version: 1;
  exportedAt: string;
  books: Book[];
  chapters: Chapter[];
  progress: ReadingProgress[];
  bookmarks: Bookmark[];
}

export const LOCAL_USER_ID = "local";

export const defaultPreferences: Preferences = {
  uiTheme: "system",
  readingTheme: "light",
  fontFamily: "literata",
  fontSize: 19,
  lineHeight: 1.75,
  paragraphSpacing: 1.15,
  readingWidth: 720,
  readingMode: "scroll",
  libraryView: "grid",
  displayName: "",
};
