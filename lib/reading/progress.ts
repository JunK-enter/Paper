import type { Chapter, ReadingProgress } from "@/types/models";

export function computeOverall(
  chapters: Chapter[],
  maxFractions: Record<string, number>,
  completedChapterIds: string[],
): number {
  const published = chapters.filter((c) => c.status === "published");
  if (!published.length) return 0;
  const sum = published.reduce((acc, chapter) => {
    if (completedChapterIds.includes(chapter.id)) return acc + 1;
    return acc + Math.min(1, maxFractions[chapter.id] ?? 0);
  }, 0);
  return sum / published.length;
}

export function emptyProgress(
  userId: string,
  bookId: string,
  chapterId: string,
): ReadingProgress {
  return {
    userId,
    bookId,
    chapterId,
    anchorParagraph: 0,
    anchorOffset: 0,
    maxFractions: {},
    completedChapterIds: [],
    overallProgress: 0,
    lastReadAt: Date.now(),
  };
}

export function hasNewChapters(
  chapters: Chapter[],
  progress?: ReadingProgress | null,
): boolean {
  if (!progress) return false;
  return chapters.some(
    (c) =>
      c.status === "published" &&
      !progress.completedChapterIds.includes(c.id) &&
      (progress.maxFractions[c.id] ?? 0) < 0.02,
  );
}
