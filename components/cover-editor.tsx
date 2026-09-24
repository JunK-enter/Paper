"use client";

import { useState } from "react";
import { BookCover } from "@/components/cover";
import { COVER_PRESETS } from "@/lib/covers";
import { defaultCoverSettings } from "@/lib/normalize";
import type { Cover, CoverSettings } from "@/types/models";

export function CoverEditor({
  title,
  author,
  cover,
  initial,
  onCancel,
  onSave,
}: {
  title: string;
  author: string;
  cover: Cover;
  initial?: CoverSettings;
  onCancel: () => void;
  onSave: (settings: CoverSettings) => void;
}) {
  const [draft, setDraft] = useState<CoverSettings>(initial ?? defaultCoverSettings(title));
  function patch(next: Partial<CoverSettings>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <BookCover title={title} author={author} cover={{ ...cover, kind: "preset" }} coverSettings={draft} className="mx-auto w-44 lg:w-full" />
      <div className="space-y-5 text-sm">
        <label className="block text-muted">배경
          <div className="mt-2 flex flex-wrap gap-2">
            {COVER_PRESETS.map((preset) => (
              <button key={preset.id} aria-label={preset.name} className="h-8 w-8 border border-line" style={{ background: preset.bg }} onClick={() => patch({ backgroundType: "solid", backgroundColor: preset.bg, accentColor: preset.accent, decorationColor: preset.accent })} />
            ))}
          </div>
          <input type="color" value={draft.backgroundColor} onChange={(e) => patch({ backgroundType: "solid", backgroundColor: e.target.value })} className="mt-3 h-10 w-full bg-transparent" />
        </label>
        <label className="flex items-center gap-2 text-muted">
          <input type="checkbox" checked={draft.backgroundType === "gradient"} onChange={(e) => patch({ backgroundType: e.target.checked ? "gradient" : "solid", gradientStart: draft.backgroundColor, gradientEnd: draft.accentColor })} />
          은은한 그라데이션
        </label>
        <label className="block text-muted">종이 결 {draft.textureStrength.toFixed(2)}
          <input type="range" min={0} max={0.4} step={0.02} value={draft.textureStrength} onChange={(e) => patch({ textureStrength: Number(e.target.value) })} className="w-full" />
        </label>
        <label className="block text-muted">제목 위치
          <select value={draft.titlePosition} onChange={(e) => patch({ titlePosition: e.target.value as CoverSettings["titlePosition"] })} className="mt-1 block w-full bg-transparent py-2 text-ink">
            <option value="top-left">왼쪽 위</option>
            <option value="top-center">가운데 위</option>
            <option value="center">가운데</option>
            <option value="bottom-left">왼쪽 아래</option>
            <option value="bottom-center">가운데 아래</option>
          </select>
        </label>
        <label className="block text-muted">장식
          <select value={draft.decoration} onChange={(e) => patch({ decoration: e.target.value as CoverSettings["decoration"] })} className="mt-1 block w-full bg-transparent py-2 text-ink">
            <option value="none">없음</option>
            <option value="line">가는 선</option>
            <option value="diamond">마름모</option>
            <option value="curve">곡선</option>
            <option value="circle">원</option>
            <option value="constellation">별자리</option>
            <option value="geometry">기하</option>
          </select>
        </label>
        <label className="block text-muted">글꼴
          <select value={draft.fontFamily} onChange={(e) => patch({ fontFamily: e.target.value as CoverSettings["fontFamily"] })} className="mt-1 block w-full bg-transparent py-2 text-ink">
            <option value="literata">문예 세리프</option>
            <option value="serif-kr">한글 명조</option>
            <option value="lora">모던 세리프</option>
            <option value="sans">산세리프</option>
          </select>
        </label>
        <label className="block text-muted">제목 크기
          <select value={draft.titleSize} onChange={(e) => patch({ titleSize: e.target.value as CoverSettings["titleSize"] })} className="mt-1 block w-full bg-transparent py-2 text-ink">
            <option value="sm">작게</option>
            <option value="md">보통</option>
            <option value="lg">크게</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-muted">
          <input type="checkbox" checked={draft.showAuthor} onChange={(e) => patch({ showAuthor: e.target.checked })} />
          저자 표시
        </label>
        <div className="flex flex-wrap gap-4 pt-2">
          <button className="min-h-11 text-accent" onClick={() => onSave(draft)}>저장</button>
          <button className="min-h-11 text-muted" onClick={() => setDraft(defaultCoverSettings(title))}>기본값으로 복원</button>
          <button className="min-h-11 text-muted" onClick={onCancel}>취소</button>
        </div>
      </div>
    </div>
  );
}
