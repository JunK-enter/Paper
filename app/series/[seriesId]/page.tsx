/* eslint-disable react-hooks/purity */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/shell";
import { BookCover } from "@/components/cover";
import { useLibrary } from "@/lib/store";
import { seriesProgress, sortVolumes, volumeOf } from "@/lib/normalize";
import { percent } from "@/lib/utils";

export default function SeriesPage() {
  const params = useParams<{ seriesId: string }>();
  const series = useLibrary((s) => s.series.find((item) => item.id === params.seriesId));
  const books = useLibrary((s) => s.books);
  const progress = useLibrary((s) => s.progress);
  const saveSeries = useLibrary((s) => s.saveSeries);
  const removeSeries = useLibrary((s) => s.removeSeries);
  const upsertBook = useLibrary((s) => s.upsertBook);
  if (!series) {
    return (
      <AppShell>
        <main className="px-5 py-16">
          <p>이 시리즈를 찾을 수 없습니다.</p>
          <Link href="/" className="mt-4 inline-block text-accent">서재로</Link>
        </main>
      </AppShell>
    );
  }

  return <SeriesBody key={series.updatedAt} series={series} books={books} progress={progress} saveSeries={saveSeries} removeSeries={removeSeries} upsertBook={upsertBook} />;
}

function SeriesBody({
  series,
  books,
  progress,
  saveSeries,
  removeSeries,
  upsertBook,
}: {
  series: NonNullable<ReturnType<typeof useParams> extends never ? never : import("@/types/models").Series>;
  books: import("@/types/models").Book[];
  progress: Record<string, import("@/types/models").ReadingProgress | undefined>;
  saveSeries: (series: import("@/types/models").Series) => Promise<void>;
  removeSeries: (id: string) => Promise<void>;
  upsertBook: (book: import("@/types/models").Book) => Promise<void>;
}) {
  const [title, setTitle] = useState(series.title);
  const [description, setDescription] = useState(series.description ?? "");
  const members = sortVolumes(books.filter((book) => book.seriesId === series.id || series.bookIds.includes(book.id)));
  const summary = seriesProgress(members, progress);
  const outsiders = books.filter((book) => !book.archived && book.seriesId !== series.id);

  async function rename() {
    await saveSeries({ ...series!, title: title.trim() || series!.title, description: description.trim(), updatedAt: Date.now() });
    for (const book of members) {
      await upsertBook({ ...book, seriesTitle: title.trim() || series!.title, updatedAt: Date.now() });
    }
  }

  async function detach(bookId: string) {
    const book = books.find((item) => item.id === bookId);
    if (!book) return;
    await upsertBook({ ...book, seriesId: undefined, seriesTitle: undefined, seriesPart: undefined, volumeNumber: undefined, volumeLabel: undefined, updatedAt: Date.now() });
    await saveSeries({ ...series!, bookIds: series!.bookIds.filter((id) => id !== bookId), updatedAt: Date.now() });
  }

  async function move(bookId: string, direction: -1 | 1) {
    const ordered = [...members];
    const index = ordered.findIndex((book) => book.id === bookId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ordered.length) return;
    const [item] = ordered.splice(index, 1);
    ordered.splice(next, 0, item);
    for (const [order, book] of ordered.entries()) {
      const volume = order + 1;
      await upsertBook({ ...book, seriesPart: volume, volumeNumber: volume, volumeLabel: `${volume}권`, updatedAt: Date.now() });
    }
    await saveSeries({ ...series!, bookIds: ordered.map((book) => book.id), updatedAt: Date.now() });
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-5 pt-8 sm:px-8">
        <Link href="/" className="text-sm text-muted">서재</Link>
        <p className="mt-6 text-[11px] tracking-[0.18em] text-muted">시리즈</p>
        <h1 className="mt-2 font-serif text-4xl tracking-[-0.03em]">{series.title}</h1>
        <p className="mt-3 text-sm text-muted">{summary.total}권 중 {summary.completed}권 완독 · {percent(summary.overall)}%</p>
        <div className="mt-4 h-px bg-line"><div className="h-px bg-accent" style={{ width: `${percent(summary.overall)}%` }} /></div>
        {series.description ? <p className="mt-5 text-sm leading-relaxed">{series.description}</p> : null}

        <ol className="mt-8 divide-y divide-line border-y border-line">
          {members.map((book) => (
            <li key={book.id} className="flex items-center gap-4 py-4">
              <BookCover title={book.title} author={book.author} cover={book.cover} coverSettings={book.coverSettings} className="w-16 shrink-0" />
              <div className="min-w-0 flex-1">
                <Link href={`/books/${book.id}`} className="font-serif text-lg">{book.volumeLabel || `${volumeOf(book)}권`} · {book.title}</Link>
                <p className="mt-1 text-xs text-muted">{(progress[book.id]?.overallProgress ?? 0) > 0 ? `${percent(progress[book.id]?.overallProgress ?? 0)}%` : "시작 전"}</p>
              </div>
              <div className="flex flex-col text-xs text-muted">
                <button className="min-h-8" onClick={() => void move(book.id, -1)}>위로</button>
                <button className="min-h-8" onClick={() => void move(book.id, 1)}>아래로</button>
                <button className="min-h-8" onClick={() => void detach(book.id)}>빼기</button>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-10 border-t border-line pt-6">
          <h2 className="font-serif text-2xl">시리즈 이름</h2>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-3 w-full border-b border-line bg-transparent py-2 outline-none" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="소개" className="mt-3 w-full border-b border-line bg-transparent py-2 outline-none" />
          <button className="mt-4 min-h-11 text-accent" onClick={() => void rename()}>이름 저장</button>
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-2xl">책 넣기</h2>
          <ul className="mt-3">
            {outsiders.map((book) => (
              <li key={book.id}>
                <button
                  className="min-h-11 text-sm text-muted"
                  onClick={() => {
                    const volume = members.length + 1;
                    void upsertBook({ ...book, seriesId: series.id, seriesTitle: series.title, seriesPart: volume, volumeNumber: volume, volumeLabel: `${volume}권`, updatedAt: Date.now() });
                    void saveSeries({ ...series, bookIds: [...series.bookIds, book.id], updatedAt: Date.now() });
                  }}
                >
                  {book.title} 추가
                </button>
              </li>
            ))}
          </ul>
        </section>

        <button
          className="mt-10 min-h-11 text-sm text-muted"
          onClick={() => {
            if (window.confirm("시리즈만 지웁니다. 책은 서재에 남습니다.")) void removeSeries(series.id);
          }}
        >
          시리즈 지우기
        </button>
      </main>
    </AppShell>
  );
}
