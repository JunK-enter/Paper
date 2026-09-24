"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/shell";
import { BookCover } from "@/components/cover";
import { useLibrary } from "@/lib/store";
import { estimateMinutes, formatDate, percent, readingStatusLabel } from "@/lib/utils";
import { hasNewChapters } from "@/lib/reading/progress";
import type { ReadingStatus } from "@/types/models";

export function BookDetail({ bookId }: { bookId: string }) {
  const book = useLibrary((s) => s.books.find((b) => b.id === bookId));
  const chapters = useLibrary((s) => s.chapters[bookId]);
  const loadChapters = useLibrary((s) => s.loadChapters);
  const progress = useLibrary((s) => s.progress[bookId]);
  const upsertBook = useLibrary((s) => s.upsertBook);

  useEffect(() => {
    void loadChapters(bookId);
  }, [bookId, loadChapters]);

  if (!book) {
    return (
      <AppShell>
        <main className="px-5 py-16">
          <p>이 책을 찾을 수 없습니다.</p>
          <Link href="/" className="mt-4 inline-block text-accent">서재로</Link>
        </main>
      </AppShell>
    );
  }

  const published = (chapters ?? []).filter((c) => c.status === "published");
  const minutes = (chapters ?? []).reduce((sum, c) => sum + (c.status === "published" ? estimateMinutes(c.content) : 0), 0);
  const action = !progress || book.status === "unread"
    ? "읽기 시작"
    : book.status === "completed"
      ? "다시 읽기"
      : "이어서 읽기";
  const targetChapter = progress?.chapterId && published.some((c) => c.id === progress.chapterId)
    ? progress.chapterId
    : published[0]?.id;
  const fresh = hasNewChapters(chapters ?? [], progress);

  async function setStatus(status: ReadingStatus) {
    if (!book) return;
    await upsertBook({ ...book, status, updatedAt: Date.now() });
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-5 pt-6 sm:px-8">
        <Link href="/" className="text-sm text-muted">서재</Link>
        <div className="mt-6 grid gap-8 sm:grid-cols-[220px_1fr]">
          <BookCover title={book.title} author={book.author} cover={book.cover} />
          <div>
            <p className="text-[11px] tracking-[0.16em] text-muted">
              {book.seriesTitle ? `${book.seriesTitle} · 제${book.seriesPart}부` : book.genre || "장르 없음"}
            </p>
            <h1 className="mt-2 font-serif text-4xl leading-tight tracking-[-0.03em]">{book.title}</h1>
            <p className="mt-2 text-muted">{book.author || "작자 미상"}</p>
            <p className="mt-5 text-sm leading-relaxed">{book.description || "아직 소개가 없습니다."}</p>
            <dl className="mt-6 grid grid-cols-2 gap-y-3 text-sm">
              <div><dt className="text-muted">상태</dt><dd>{readingStatusLabel(book.status)}{fresh ? " · 새 장" : ""}</dd></div>
              <div><dt className="text-muted">진행</dt><dd>{percent(progress?.overallProgress ?? 0)}%</dd></div>
              <div><dt className="text-muted">장</dt><dd>{published.length}</dd></div>
              <div><dt className="text-muted">읽는 시간</dt><dd>약 {minutes}분</dd></div>
              <div><dt className="text-muted">추가</dt><dd>{formatDate(book.createdAt)}</dd></div>
              <div><dt className="text-muted">마지막 열람</dt><dd>{formatDate(book.lastOpenedAt)}</dd></div>
            </dl>
            <div className="mt-4 h-px bg-line"><div className="h-px bg-accent" style={{ width: `${percent(progress?.overallProgress ?? 0)}%` }} /></div>
            {targetChapter ? (
              <Link href={`/books/${book.id}/read/${targetChapter}`} className="mt-6 inline-flex min-h-12 items-center text-accent">
                {action} →
              </Link>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
              <button onClick={() => void setStatus(book.status === "completed" ? "unread" : "completed")}>
                {book.status === "completed" ? "안 읽음으로" : "완독으로 표시"}
              </button>
              <button onClick={() => void upsertBook({ ...book, archived: !book.archived, updatedAt: Date.now() })}>
                {book.archived ? "보관 해제" : "보관"}
              </button>
            </div>
          </div>
        </div>

        <section className="mt-12">
          <h2 className="font-serif text-2xl">목차</h2>
          <ol className="mt-4 divide-y divide-line border-y border-line">
            {(chapters ?? []).map((chapter, index) => {
              const fraction = progress?.completedChapterIds.includes(chapter.id)
                ? 1
                : progress?.maxFractions[chapter.id] ?? 0;
              const current = progress?.chapterId === chapter.id;
              return (
                <li key={chapter.id}>
                  <Link href={chapter.status === "published" ? `/books/${book.id}/read/${chapter.id}` : `/books/${book.id}/chapters/${chapter.id}/edit`} className="flex items-center justify-between gap-4 py-4">
                    <div>
                      <p className="text-xs text-muted">{chapter.status === "draft" ? "초고" : `${index + 1}장`}{current ? " · 읽는 중" : ""}</p>
                      <p className="mt-1 font-serif text-lg">{chapter.title}</p>
                      <p className="mt-1 text-xs text-muted">약 {estimateMinutes(chapter.content)}분</p>
                    </div>
                    <div className="h-px w-16 bg-line"><div className="h-px bg-accent" style={{ width: `${percent(fraction)}%` }} /></div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </AppShell>
  );
}
