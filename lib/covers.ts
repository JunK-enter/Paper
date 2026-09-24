export interface CoverPreset {
  id: string;
  name: string;
  bg: string;
  fg: string;
  accent: string;
}

export const COVER_PRESETS: CoverPreset[] = [
  { id: "ivory", name: "아이보리", bg: "#F4EEE4", fg: "#3A332C", accent: "#8C7355" },
  { id: "ink", name: "잉크", bg: "#1C1B19", fg: "#E8E2D6", accent: "#C4A77D" },
  { id: "wine", name: "와인", bg: "#3C292C", fg: "#F4E7DE", accent: "#D4B59A" },
  { id: "forest", name: "포레스트", bg: "#243028", fg: "#E8EEE4", accent: "#C6B48A" },
  { id: "sea", name: "심해", bg: "#1C2830", fg: "#E4E9EC", accent: "#8EACBE" },
  { id: "sand", name: "샌드", bg: "#E6D5BC", fg: "#3E342B", accent: "#7A6248" },
  { id: "plum", name: "플럼", bg: "#2A2433", fg: "#EFE8F4", accent: "#C0A8CE" },
  { id: "clay", name: "클레이", bg: "#8C5E49", fg: "#F8F1E8", accent: "#E4CDB4" },
];

export const COVER_MOTIFS = ["rule", "dots", "arc", "diamond", "wave", "frame", "grid", "seal"] as const;
export type CoverMotif = (typeof COVER_MOTIFS)[number];

export function presetById(id?: string): CoverPreset {
  return COVER_PRESETS.find((p) => p.id === id) ?? COVER_PRESETS[0];
}

function hashTitle(title: string) {
  let n = 0;
  for (let i = 0; i < title.length; i += 1) n = (n * 33 + title.charCodeAt(i)) >>> 0;
  return n;
}

export function coverForTitle(title: string): { presetId: string; motif: CoverMotif } {
  const n = hashTitle(title || "무제");
  return {
    presetId: COVER_PRESETS[n % COVER_PRESETS.length].id,
    motif: COVER_MOTIFS[Math.floor(n / COVER_PRESETS.length) % COVER_MOTIFS.length],
  };
}
