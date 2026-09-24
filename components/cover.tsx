"use client";

import type { Cover, CoverMotif, CoverSettings } from "@/types/models";
import { coverForTitle, presetById } from "@/lib/covers";

function decorationMotif(decoration: CoverSettings["decoration"]): CoverMotif {
  if (decoration === "diamond") return "diamond";
  if (decoration === "curve") return "wave";
  if (decoration === "circle") return "seal";
  if (decoration === "constellation") return "dots";
  if (decoration === "geometry") return "grid";
  if (decoration === "none") return "rule";
  return "rule";
}

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

const titleSizeClass = { sm: "text-[0.82rem]", md: "text-[0.95rem] sm:text-[1.05rem]", lg: "text-[1.15rem] sm:text-[1.3rem]" };
const fontStack = {
  literata: "var(--font-literata), var(--font-serif-kr), serif",
  "serif-kr": "var(--font-serif-kr), serif",
  lora: "var(--font-lora), var(--font-serif-kr), serif",
  sans: "var(--font-geist), var(--font-sans-kr), sans-serif",
};
const positionClass: Record<CoverSettings["titlePosition"], string> = {
  "top-left": "justify-start items-start text-left",
  "top-center": "justify-start items-center text-center",
  center: "justify-center items-center text-center",
  "bottom-left": "justify-end items-start text-left",
  "bottom-center": "justify-end items-center text-center",
};

export function BookCover({
  title,
  author,
  cover,
  coverSettings,
  className = "",
}: {
  title: string;
  author: string;
  cover: Cover;
  coverSettings?: CoverSettings;
  className?: string;
}) {
  const picked = coverForTitle(title);
  const preset = presetById(cover.motif ? cover.presetId : picked.presetId);
  const motif = cover.motif ?? picked.motif;
  const bg = cover.kind === "upload" ? "#1c1b19" : preset.bg;
  const fg = preset.fg;
  const accent = preset.accent;
  if (coverSettings && cover.kind !== "upload") {
    const background = coverSettings.backgroundType === "gradient"
      ? `linear-gradient(160deg, ${coverSettings.gradientStart ?? coverSettings.backgroundColor}, ${coverSettings.gradientEnd ?? coverSettings.backgroundColor})`
      : coverSettings.backgroundColor;
    return (
      <div className={`relative aspect-[2/3] overflow-hidden shadow-[0_12px_28px_rgba(37,35,31,0.12)] ${className}`} style={{ background, color: "#f4efe6", borderRadius: 3 }}>
        <div className="relative flex h-full flex-col p-[10%] paper-grain" style={{ background, opacity: 1 }}>
          <div className="pointer-events-none absolute inset-0" style={{ opacity: coverSettings.textureStrength }} />
          {coverSettings.decoration !== "none" ? <Motif motif={decorationMotif(coverSettings.decoration)} color={coverSettings.decorationColor} /> : null}
          <div className={`relative z-[1] flex h-full flex-col ${positionClass[coverSettings.titlePosition]}`}>
            {coverSettings.showAuthor && coverSettings.authorPosition === "above" ? <p className="mb-2 text-[10px] tracking-[0.14em] opacity-70">{author || "작자 미상"}</p> : null}
            <p className={`font-serif leading-tight tracking-[-0.03em] ${titleSizeClass[coverSettings.titleSize]} ${coverSettings.titleAlign === "center" ? "text-center" : "text-left"}`} style={{ fontFamily: fontStack[coverSettings.fontFamily], color: "#f7f3ea" }}>
              {title || "무제"}
            </p>
            {coverSettings.showAuthor && coverSettings.authorPosition !== "above" ? <p className="mt-2 text-[10px] tracking-[0.14em] opacity-70">{author || "작자 미상"}</p> : null}
          </div>
        </div>
      </div>
    );
  }

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
