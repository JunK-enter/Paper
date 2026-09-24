export function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function formatDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(ts);
}

export function estimateMinutes(text: string): number {
  const hangul = (text.match(/[가-힣]/g) ?? []).length;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = hangul / 480 + Math.max(0, words * 0.35) / 220;
  const blended = hangul > 40 ? hangul / 480 + words / 900 : words / 220;
  return Math.max(1, Math.round(Math.max(minutes, blended) || 1));
}

export function readingStatusLabel(status: string): string {
  if (status === "reading") return "읽는 중";
  if (status === "completed") return "완독";
  return "시작 전";
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function percent(n: number): number {
  return Math.round(clamp(n, 0, 1) * 100);
}

export function splitBlocks(content: string): string[] {
  const parts = content.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const blocks = parts.map((p) => p.trim()).filter(Boolean);
  return blocks.length ? blocks : [""];
}

export function excerptAround(content: string, paragraph: number): string {
  const blocks = splitBlocks(content);
  const text = (blocks[paragraph] ?? blocks[0] ?? "").replace(/\s+/g, " ");
  return text.slice(0, 72);
}
