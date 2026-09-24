"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/shell";
import { useLibrary } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export default function QuotesPage() {
  const quotes = useLibrary((s) => s.quotes);
  const series = useLibrary((s) => s.series);
  const saveQuote = useLibrary((s) => s.saveQuote);
  const removeQuote = useLibrary((s) => s.removeQuote);
  const [query, setQuery] = useState("");
  const [bookId, setBookId] = useState("all");
  const [seriesId, setSeriesId] = useState("all");
  const [sort, setSort] = useState<"new" | "old">("new");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const books = useMemo(() => {
    const map = new Map<string, string>();
    for (const quote of quotes) map.set(quote.bookId, quote.bookTitle);
    return [...map.entries()];
  }, [quotes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return quotes
      .filter((quote) => (bookId === "all" || quote.bookId === bookId) && (seriesId === "all" || quote.seriesId === seriesId))
      .filter((quote) => !q || `${quote.text} ${quote.note ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => (sort === "new" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
  }, [bookId, query, quotes, seriesId, sort]);

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl px-5 pt-8 sm:px-8">
        <p className="text-[11px] tracking-[0.18em] text-muted">수집</p>
        <h1 className="mt-2 font-serif text-4xl">문장</h1>
        {quotes.length === 0 ? (
          <div className="mt-12">
            <p className="font-serif text-2xl">아직 저장한 문장이 없습니다.</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">읽다가 오래 기억하고 싶은 문장을 발견하면 선택하여 저장해 보세요.</p>
          </div>
        ) : (
          <>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="문장 찾기" className="mt-6 w-full border-b border-line bg-transparent py-2 outline-none" />
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted">
              <select value={bookId} onChange={(e) => setBookId(e.target.value)} className="bg-transparent py-2 text-ink">
                <option value="all">모든 책</option>
                {books.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
              </select>
              <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className="bg-transparent py-2 text-ink">
                <option value="all">모든 시리즈</option>
                {series.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value as "new" | "old")} className="bg-transparent py-2 text-ink">
                <option value="new">최근</option>
                <option value="old">오래된</option>
              </select>
            </div>
            <ul className="mt-6">
              {visible.map((quote) => (
                <li key={quote.id} className="border-t border-line py-6">
                  <Link href={`/books/${quote.bookId}/read/${quote.chapterId}?p=${quote.anchorParagraph}&o=${quote.anchorOffset}`} className="block">
                    <p className="font-serif text-xl leading-relaxed">“{quote.text}”</p>
                    <p className="mt-3 text-sm text-muted">{quote.bookTitle}</p>
                    <p className="text-xs text-muted">{quote.chapterTitle}</p>
                    <p className="mt-2 text-xs text-muted">{formatDate(quote.createdAt)}</p>
                  </Link>
                  {quote.note ? <p className="mt-3 text-sm leading-relaxed">{quote.note}</p> : null}
                  {noteId === quote.id ? (
                    <div className="mt-3">
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full border-b border-line bg-transparent py-2 outline-none" />
                      <button className="mt-2 text-sm text-accent" onClick={() => { void saveQuote({ ...quote, note, updatedAt: Date.now() }); setNoteId(null); }}>메모 저장</button>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-4 text-sm text-muted">
                      <button onClick={() => { setNoteId(quote.id); setNote(quote.note ?? ""); }}>메모</button>
                      <button onClick={() => void removeQuote(quote.id)}>지우기</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {visible.length === 0 ? <p className="mt-8 text-sm text-muted">이 조건에 해당하는 문장이 없습니다.</p> : null}
          </>
        )}
      </main>
    </AppShell>
  );
}
