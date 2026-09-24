"use client";

import { useEffect, useId, useRef } from "react";

export function Dialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="w-[min(92vw,420px)] rounded-md border border-line bg-paper p-0 text-ink shadow-[var(--shadow)] backdrop:bg-black/40"
      onClose={onClose}
    >
      <form method="dialog" className="p-6">
        <h2 id={titleId} className="font-serif text-xl">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="min-h-11 px-4 text-sm text-muted" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className={`min-h-11 px-4 text-sm ${danger ? "text-red-800" : "text-accent"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 max-h-[86dvh] w-full overflow-auto rounded-t-2xl border border-line bg-paper p-5 shadow-[var(--shadow)] sm:max-w-md sm:rounded-xl"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm tracking-[0.14em] text-muted">{title}</h2>
          <button className="min-h-11 px-2 text-sm" onClick={onClose}>닫기</button>
        </div>
        {children}
      </div>
    </div>
  );
}
