"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppShell } from "@/components/layout/shell";
import { Dialog } from "@/components/ui";
import { useLibrary } from "@/lib/store";
import { uid } from "@/lib/utils";
import type { Chapter } from "@/types/models";

export function ChapterEditor({
  bookId,
  chapterId,
}: {
  bookId: string;
  chapterId?: string;
}) {
  const router = useRouter();
  const userId = useLibrary((s) => s.userId);
  const chapters = useLibrary((s) => s.chapters[bookId]);
  const loadChapters = useLibrary((s) => s.loadChapters);
  const upsertChapter = useLibrary((s) => s.upsertChapter);
  const removeChapter = useLibrary((s) => s.removeChapter);
  const reorderChapters = useLibrary((s) => s.reorderChapters);
  const existing = chapters?.find((c) => c.id === chapterId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [ready, setReady] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const draftId = useRef(chapterId ?? uid());

  useEffect(() => {
    void loadChapters(bookId).then((rows) => {
      const found = rows.find((c) => c.id === chapterId);
      if (found) {
        setTitle(found.title);
        setContent(found.content);
        setStatus(found.status);
      }
      setReady(true);
    });
  }, [bookId, chapterId, loadChapters]);

  useEffect(() => {
    if (!ready || !dirty) return;
    const timer = setTimeout(() => {
      void persist(status, false);
    }, 1200);
    return () => clearTimeout(timer);
    // persist identity is stable enough for autosave
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, dirty, ready]);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  async function persist(nextStatus: "draft" | "published", leave: boolean) {
    const now = Date.now();
    const id = chapterId ?? existing?.id ?? draftId.current;
    const order = existing?.order ?? (chapters?.length ?? 0);
    const chapter: Chapter = {
      id,
      bookId,
      userId,
      title: title.trim() || "무제",
      content,
      order,
      status: nextStatus,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await upsertChapter(chapter);
    setStatus(nextStatus);
    setSavedAt(now);
    setDirty(false);
    if (!chapterId) router.replace(`/books/${bookId}/chapters/${id}/edit`);
    if (leave) router.push(`/books/${bookId}`);
  }

  if (!ready) return <AppShell><main className="p-8 text-muted">불러오는 중</main></AppShell>;

  const index = (chapters ?? []).findIndex((c) => c.id === (chapterId ?? existing?.id));

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl px-5 pt-6">
        <div className="flex items-center justify-between text-xs text-muted">
          <p>{savedAt ? "저장됨" : dirty ? "저장 중…" : "변경 없음"}</p>
          <button className="min-h-11" onClick={() => setPreview((v) => !v)}>{preview ? "편집" : "미리보기"}</button>
        </div>
        {preview ? (
          <article className="reading-prose mt-6">
            <h2>{title || "무제"}</h2>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        ) : (
          <>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
              placeholder="장 제목"
              className="mt-4 w-full bg-transparent font-serif text-3xl outline-none"
            />
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setDirty(true); }}
              placeholder="글을 붙여 넣으세요. 문단은 그대로 남습니다."
              className="mt-4 min-h-[55dvh] w-full resize-none bg-transparent leading-relaxed outline-none"
            />
          </>
        )}
        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <button className="min-h-11 text-muted" onClick={() => void persist("draft", false)}>초고 저장</button>
          <button className="min-h-11 text-accent" onClick={() => void persist("published", true)}>발행</button>
          {chapterId && (
            <>
              <button
                className="min-h-11 text-muted"
                onClick={() => {
                  if (!chapters || index <= 0) return;
                  const ids = chapters.map((c) => c.id);
                  [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                  void reorderChapters(bookId, ids);
                }}
              >위로</button>
              <button
                className="min-h-11 text-muted"
                onClick={() => {
                  if (!chapters || index < 0 || index >= chapters.length - 1) return;
                  const ids = chapters.map((c) => c.id);
                  [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
                  void reorderChapters(bookId, ids);
                }}
              >아래로</button>
              <button className="min-h-11 text-muted" onClick={() => setConfirm(true)}>장 삭제</button>
            </>
          )}
        </div>
      </main>
      <Dialog
        open={confirm}
        title="이 장만 삭제할까요?"
        body="책은 그대로 남고, 이 장의 내용만 삭제됩니다."
        confirmLabel="장 삭제"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          if (!chapterId) return;
          void removeChapter(bookId, chapterId).then(() => router.push(`/books/${bookId}`));
        }}
      />
    </AppShell>
  );
}
