import type { Book, CoverSettings, ReadingProgress, Series } from "@/types/models";
import { coverForTitle } from "@/lib/covers";

export function defaultCoverSettings(title: string): CoverSettings {
  const look = coverForTitle(title);
  const colors: Record<string, string> = {
    ivory: "#F4EEE4",
    ink: "#1C1B19",
    wine: "#3C292C",
    forest: "#243028",
    sea: "#1C2830",
    sand: "#E6D5BC",
    plum: "#2A2433",
    clay: "#8C5E49",
  };
  const accents: Record<string, string> = {
    ivory: "#8C7355",
    ink: "#C4A77D",
    wine: "#D4B59A",
    forest: "#C6B48A",
    sea: "#8EACBE",
    sand: "#7A6248",
    plum: "#C0A8CE",
    clay: "#E4CDB4",
  };
  return {
    backgroundType: "solid",
    backgroundColor: colors[look.presetId] ?? "#1C2830",
    textureStrength: 0.18,
    titlePosition: "bottom-left",
    decoration: "line",
    decorationColor: accents[look.presetId] ?? "#8EACBE",
    fontFamily: "literata",
    titleSize: "md",
    titleAlign: "left",
    showAuthor: true,
    authorPosition: "below",
    accentColor: accents[look.presetId] ?? "#8EACBE",
  };
}

export function normalizeBook(book: Book): Book {
  const volume = book.volumeNumber ?? book.seriesPart;
  return {
    ...book,
    seriesPart: book.seriesPart ?? volume,
    volumeNumber: volume,
    volumeLabel: book.volumeLabel ?? (volume ? `${volume}권` : undefined),
  };
}

export function volumeOf(book: Book): number {
  return book.volumeNumber ?? book.seriesPart ?? 0;
}

export function sortVolumes(books: Book[]): Book[] {
  return [...books].sort((a, b) => volumeOf(a) - volumeOf(b) || a.createdAt - b.createdAt);
}

export function seriesProgress(books: Book[], progress: Record<string, ReadingProgress | undefined>) {
  const ordered = sortVolumes(books);
  const completed = ordered.filter((book) => book.status === "completed" || (progress[book.id]?.overallProgress ?? 0) >= 0.98).length;
  const overall = ordered.length
    ? ordered.reduce((sum, book) => sum + (progress[book.id]?.overallProgress ?? 0), 0) / ordered.length
    : 0;
  const current = [...ordered].sort((a, b) => (progress[b.id]?.lastReadAt ?? 0) - (progress[a.id]?.lastReadAt ?? 0))[0];
  return { ordered, completed, total: ordered.length, overall, current };
}

export function linkBooksToSeries(books: Book[], seriesList: Series[]): { books: Book[]; series: Series[] } {
  const nextSeries = seriesList.map((item) => ({ ...item, bookIds: [...item.bookIds] }));
  const byId = new Map(nextSeries.map((item) => [item.id, item]));
  const byTitle = new Map(nextSeries.map((item) => [item.title, item]));
  const nextBooks = books.map((raw) => {
    const book = normalizeBook(raw);
    if (!book.seriesTitle && !book.seriesId) return book;
    let series = book.seriesId ? byId.get(book.seriesId) : undefined;
    if (!series && book.seriesTitle) series = byTitle.get(book.seriesTitle);
    if (!series && book.seriesTitle) {
      const now = Date.now();
      series = {
        id: `series-${book.seriesTitle}`,
        userId: book.userId,
        title: book.seriesTitle,
        bookIds: [],
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: null,
      };
      nextSeries.push(series);
      byId.set(series.id, series);
      byTitle.set(series.title, series);
    }
    if (!series) return book;
    if (!series.bookIds.includes(book.id)) series.bookIds.push(book.id);
    return { ...book, seriesId: series.id, seriesTitle: series.title };
  });
  for (const series of nextSeries) {
    const members = sortVolumes(nextBooks.filter((book) => book.seriesId === series.id));
    series.bookIds = members.map((book) => book.id);
  }
  return { books: nextBooks, series: nextSeries };
}
