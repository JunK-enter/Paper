"use client";

import type { Cover, CoverMotif } from "@/types/models";
import { coverForTitle, presetById } from "@/lib/covers";

function Motif({ motif, color }: { motif: CoverMotif; color: string }) {
  const common = { fill: "none", stroke: color, strokeWidth: 1 };
  if (motif === "dots") {
    return (
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        {Array.from({ length: 18 }, (_, i) => (
          <circle key={i} cx={18 + (i % 3) * 28} cy={28 + Math.floor(i / 3) * 34} r="1.2" fill={color} />
        ))}
      </svg>
    );
  }
  if (motif === "arc") {
    return (
      <svg className="absolute -right-6 -top-8 h-40 w-40" aria-hidden>
        <circle cx="80" cy="80" r="54" {...common} />
        <circle cx="80" cy="80" r="36" {...common} />
      </svg>
    );
  }
  if (motif === "diamond") {
    return (
      <svg className="absolute right-4 top-6 h-16 w-16" aria-hidden>
        <path d="M32 4 L60 32 L32 60 L4 32 Z" {...common} />
      </svg>
    );
  }
  if (motif === "wave") {
    return (
      <svg className="absolute inset-x-0 bottom-0 h-16 w-full" aria-hidden>
        <path d="M0 28 C 30 8, 50 48, 80 28 S 130 8, 160 28 S 210 48, 240 28" {...common} />
      </svg>
    );
  }
  if (motif === "frame") {
    return <div className="pointer-events-none absolute inset-3 border" style={{ borderColor: color }} />;
  }
  if (motif === "grid") {
    return (
      <svg className="absolute inset-0 h-full w-full opacity-70" aria-hidden>
        <path d="M0 36 H200 M0 78 H200 M28 0 V220 M70 0 V220" {...common} />
      </svg>
    );
  }
  if (motif === "seal") {
    return (
      <svg className="absolute right-3 top-4 h-14 w-14" aria-hidden>
        <circle cx="28" cy="28" r="18" {...common} />
        <circle cx="28" cy="28" r="3" fill={color} stroke="none" />
      </svg>
    );
  }
  return <div className="h-px w-10" style={{ background: color }} />;
}

export function BookCover({
  title,
  author,
  cover,
  className = "",
}: {
  title: string;
  author: string;
  cover: Cover;
  className?: string;
}) {
  const picked = coverForTitle(title);
  const preset = presetById(cover.motif ? cover.presetId : picked.presetId);
  const motif = cover.motif ?? picked.motif;
  const bg = cover.kind === "upload" ? "#1c1b19" : preset.bg;
  const fg = preset.fg;
  const accent = preset.accent;

  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden shadow-[0_12px_28px_rgba(37,35,31,0.12)] ${className}`}
      style={{ background: bg, color: fg, borderRadius: 3 }}
    >
      {cover.kind === "upload" && cover.imageDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.imageDataUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="relative flex h-full flex-col justify-between p-[10%] paper-grain" style={{ background: bg, color: fg }}>
          <Motif motif={motif} color={accent} />
          <div>
            <p className="font-serif text-[0.95rem] leading-tight tracking-[-0.03em] sm:text-[1.05rem]" style={{ fontFamily: "var(--font-literata), var(--font-serif-kr), serif" }}>
              {title || "무제"}
            </p>
            <p className="mt-2 text-[10px] tracking-[0.14em] opacity-70">{author || "작자 미상"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
