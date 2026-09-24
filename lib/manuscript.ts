export interface ParsedChapter {
  title: string;
  content: string;
}

export interface ParsedManuscript {
  title: string;
  seriesTitle?: string;
  partNumber?: number;
  chapters: ParsedChapter[];
}

export function seriesFromFilename(filename: string) {
  const base = filename.replace(/^.*[\\/]/, "").replace(/\.(txt|md|markdown)$/i, "");
  const match = base.match(/^(.+)_제(\d+)부_(.+)$/);
  if (!match) return null;
  return {
    seriesTitle: match[1].replace(/_/g, " ").trim(),
    partNumber: Number(match[2]),
    partTitle: match[3].replace(/_/g, " ").trim(),
  };
}

const wrappedTitle = /^《(.+?)》\s*$/;
const numbered = /^(?:단편소설\s*·\s*)?제\s*(\d+)\s*장\s*[—–\-.]\s*(.+)$/;
const volume = /^(?:단편소설\s*·\s*)?제\s*(\d+)\s*부\s*[—–\-.]\s*(.+)$/;
const lastChapter = /^(?:단편소설\s*·\s*)?마지막\s*장\s*[—–\-.]\s*(.+)$/;
const chapterEnd = /^(?:제\s*\d+\s*장|마지막\s*장)\s*끝\.?\s*$/;

export function parseManuscript(raw: string, filename = "이야기"): ParsedManuscript {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  const lines = text.split("\n");
  const fromName = seriesFromFilename(filename);
  let seriesTitle = fromName?.seriesTitle;
  let partNumber = fromName?.partNumber;
  let title = fromName?.partTitle ?? filename.replace(/^.*[\\/]/, "").replace(/\.(txt|md|markdown)$/i, "");
  const chapters: { key: string; title: string; lines: string[] }[] = [];
  const seen = new Set<string>();
  let current: { key: string; title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed && !current) continue;
    const wrapped = trimmed.match(wrappedTitle);
    if (wrapped && chapters.length === 0 && !current) {
      if (partNumber || seriesTitle) seriesTitle = wrapped[1].trim();
      else title = wrapped[1].trim();
      continue;
    }
    const volumeMatch = trimmed.match(volume);
    const beforeStory = !current || current.lines.every((item) => !item.trim());
    if (volumeMatch && beforeStory) {
      if (current) {
        chapters.pop();
        current = null;
      }
      partNumber = Number(volumeMatch[1]);
      if (!seriesTitle) seriesTitle = title;
      title = volumeMatch[2].trim();
      continue;
    }
    if (chapterEnd.test(trimmed) || trimmed === "끝." || trimmed === "끝") continue;
    if (trimmed.startsWith("《") && trimmed.endsWith("》") && trimmed.includes(title)) continue;

    const numberedMatch = trimmed.match(numbered);
    const lastMatch = trimmed.match(lastChapter);
    const key = numberedMatch ? numberedMatch[1] : lastMatch ? "last" : null;
    const heading = numberedMatch?.[2] ?? lastMatch?.[1];
    if (key && heading && !seen.has(key)) {
      seen.add(key);
      current = { key, title: heading.trim(), lines: [] };
      chapters.push(current);
      continue;
    }
    if (!current) {
      current = { key: "body", title: "본문", lines: [] };
      chapters.push(current);
    }
    current.lines.push(line);
  }

  const cleaned = chapters
    .map((chapter) => ({
      title: chapter.title,
      content: chapter.lines.join("\n").replace(/^\n+|\n+$/g, ""),
    }))
    .filter((chapter) => chapter.content.length > 0);

  if (cleaned.length === 0) {
    throw new Error("본문이 없는 파일입니다.");
  }
  return {
    title,
    seriesTitle: seriesTitle && partNumber ? seriesTitle : undefined,
    partNumber: seriesTitle ? partNumber : undefined,
    chapters: cleaned,
  };
}
