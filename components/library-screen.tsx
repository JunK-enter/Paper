"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Moon, Search, Settings, Sun } from "lucide-react";
import { BookCover } from "@/components/cover";
import { AppShell } from "@/components/layout/shell";
import { useLibrary } from "@/lib/store";
import { percent, readingStatusLabel } from "@/lib/utils";
import type { Book, LibraryFilter, LibrarySort } from "@/types/models";

const sorts: { id: LibrarySort; label: string }[] = [
  { id: "opened", label: "최근 읽은 순" },
  { id: "added", label: "최근 추가" },
  { id: "title", label: "제목" },
  { id: "author", label: "작가" },
  { id: "progress", label: "진행률" },
];

const filters: { id: LibraryFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "reading", label: "읽는 중" },
  { id: "unread", label: "시작 전" },
  { id: "completed", label: "완독" },
];

function sortBooks(books: Book[], sort: LibrarySort, progress: Record<string, { overallProgress: number }>) {
  const copy = [...books];
  copy.sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title, "ko");
    if (sort === "author") return a.author.localeCompare(b.author, "ko");
    if (sort === "added") return b.createdAt - a.createdAt;
    if (sort === "progress") return (progress[b.id]?.overallProgress ?? 0) - (progress[a.id]?.overallProgress ?? 0);
    return (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0);
  });
  return copy;
}

function shelfGroups(books: Book[]) {
  const groups: { key: string; series?: string; books: Book[] }[] = [];
  for (const book of books) {
    const last = groups[groups.length - 1];
    if (book.seriesTitle && last?.series === book.seriesTitle) {
      last.books.push(book);
      continue;
    }
    if (!book.seriesTitle && last && !last.series) {
      last.books.push(book);
      continue;
    }
    groups.push({
      key: book.seriesTitle ?? book.id,
      series: book.seriesTitle,
      books: [book],
    });
  }
  return groups;
}

export function LibraryScreen() {
  const router = useRouter();
  const books = useLibrary((s) => s.books);
  const progress = useLibrary((s) => s.progress);
  const prefs = useLibrary((s) => s.preferences);
  const setPreferences = useLibrary((s) => s.setPreferences);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("opened");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [themeOpen, setThemeOpen] = useState(false);

  const active = books.filter((b) => !b.archived);
  const current = [...active]
    .filter((b) => b.status === "reading" || Boolean(progress[b.id]))
    .sort((a, b) => (progress[b.id]?.lastReadAt ?? 0) - (progress[a.id]?.lastReadAt ?? 0))[0];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = active.filter((book) => {
      const statusOk =
        filter === "all" ||
        (filter === "reading" && book.status === "reading") ||
        (filter === "unread" && book.status === "unread") ||
        (filter === "completed" && book.status === "completed");
      const text = `${book.title} ${book.author} ${book.seriesTitle ?? ""}`.toLowerCase();
      return statusOk && (!q || text.includes(q));
    });
    const sorted = sortBooks(filtered, sort, progress);
    const placed = new Set<string>();
    const clustered = [];
    for (const book of sorted) {
      if (placed.has(book.id)) continue;
      if (!book.seriesTitle) {
        clustered.push(book);
        continue;
      }
      const parts = sorted
        .filter((item) => item.seriesTitle === book.seriesTitle)
        .sort((a, b) => (a.seriesPart ?? 0) - (b.seriesPart ?? 0));
      for (const part of parts) {
        placed.add(part.id);
        clustered.push(part);
      }
    }
    return clustered;
  }, [active, filter, progress, query, sort]);

  useEffect(() => {
    const close = () => setThemeOpen(false);
    if (themeOpen) window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [themeOpen]);

  const currentProgress = current ? progress[current.id] : undefined;

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl px-5 pt-7 sm:px-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="font-serif text-[1.7rem] tracking-[0.22em]">PAPER</p>
            <p className="mt-1 text-sm text-muted">당신의 서재</p>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                aria-label="테마"
                className="grid h-11 w-11 place-items-center"
                onClick={(e) => {
                  e.stopPropagation();
                  setThemeOpen((v) => !v);
                }}
              >
                {prefs.uiTheme === "dark" ? <Moon size={18} strokeWidth={1.5} /> : <Sun size={18} strokeWidth={1.5} />}
              </button>
              {themeOpen && (
                <div className="absolute right-0 z-20 w-36 border border-line bg-paper p-1 shadow-[var(--shadow)]" onClick={(e) => e.stopPropagation()}>
                  {(["light", "dark", "system"] as const).map((theme) => (
                    <button
                      key={theme}
                      className="block w-full px-3 py-2 text-left text-sm"
                      onClick={() => {
                        void setPreferences({ uiTheme: theme });
                        setThemeOpen(false);
                      }}
                    >
                      {theme === "light" ? "라이트" : theme === "dark" ? "다크" : "시스템"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Link href="/settings" aria-label="설정" className="grid h-11 w-11 place-items-center">
              <Settings size={18} strokeWidth={1.5} />
            </Link>
          </div>
        </header>

        <section className="mt-8">
          <p className="text-[11px] tracking-[0.18em] text-muted">지금 읽는 책</p>
          {current && currentProgress ? (
            <article className="paper-grain mt-3 grid grid-cols-[104px_1fr] gap-4 border border-line p-4 sm:grid-cols-[128px_1fr] sm:p-6">
              <BookCover title={current.title} author={current.author} cover={current.cover} />
              <div className="flex min-w-0 flex-col justify-between py-1">
                <div>
                  <h2 className="font-serif text-2xl leading-tight tracking-[-0.03em]">{current.title}</h2>
                  <p className="mt-1 text-sm text-muted">{current.author}</p>
                  <p className="mt-4 text-sm">
                    {percent(currentProgress.overallProgress)}% 읽음
                  </p>
                  <div className="mt-2 h-px w-full bg-line">
                    <div className="h-px bg-accent" style={{ width: `${percent(currentProgress.overallProgress)}%` }} />
                  </div>
                </div>
                <button
                  className="mt-4 self-start text-sm text-accent"
                  onClick={() => router.push(`/books/${current.id}/read/${currentProgress.chapterId}`)}
                >
                  이어서 읽기 →
                </button>
              </div>
            </article>
          ) : current ? (
            <article className="paper-grain mt-3 grid grid-cols-[104px_1fr] gap-4 border border-line p-4">
              <BookCover title={current.title} author={current.author} cover={current.cover} />
              <div>
                <h2 className="font-serif text-2xl">{current.title}</h2>
                <p className="mt-1 text-sm text-muted">{current.author}</p>
                <Link href={`/books/${current.id}`} className="mt-4 inline-block text-sm text-accent">책 펼치기 →</Link>
              </div>
            </article>
          ) : (
            <div className="mt-3 border border-dashed border-line px-5 py-10">
              <p className="font-serif text-2xl">서재가 첫 이야기를 기다리고 있습니다.</p>
              <Link href="/books/new" className="mt-4 inline-block text-sm text-accent">이야기 파일 올리기 →</Link>
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-serif text-xl">내 서재</h2>
            <button
              aria-label={prefs.libraryView === "grid" ? "목록으로 보기" : "표지로 보기"}
              className="grid h-11 w-11 place-items-center"
              onClick={() => void setPreferences({ libraryView: prefs.libraryView === "grid" ? "list" : "grid" })}
            >
              {prefs.libraryView === "grid" ? <List size={18} /> : <LayoutGrid size={18} />}
            </button>
          </div>
          <label className="mt-4 flex items-center gap-2 border-b border-line py-2">
            <Search size={16} className="text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제목, 작가, 시리즈"
              className="w-full bg-transparent py-2 outline-none"
            />
          </label>
          <div className="mt-3 flex gap-2 overflow-auto pb-1">
            {filters.map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={`shrink-0 px-3 py-2 text-sm ${filter === item.id ? "text-ink" : "text-muted"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="mt-1 block text-sm text-muted">
            정렬
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as LibrarySort)}
              className="ml-2 bg-transparent py-2 text-ink outline-none"
            >
              {sorts.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>

          {visible.length === 0 ? (
            <div className="py-16">
              <p className="font-serif text-2xl">아직 이곳에 놓인 책이 없습니다.</p>
              <Link href="/books/new" className="mt-4 inline-block text-sm text-accent">이야기 파일 올리기 →</Link>
            </div>
          ) : (
            <div className="mt-6 space-y-8">
              {shelfGroups(visible).map((group) => (
                <section key={group.key}>
                  {group.series ? <h3 className="mb-4 font-serif text-lg">{group.series}</h3> : null}
                  {prefs.libraryView === "grid" ? (
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                      {group.books.map((book) => (
                        <li key={book.id}>
                          <Link href={`/books/${book.id}`} className="group block">
                            <BookCover title={book.title} author={book.author} cover={book.cover} className="transition duration-300 group-hover:-translate-y-1 group-active:translate-y-0" />
                            <p className="mt-3 line-clamp-2 font-serif leading-snug">{book.title}</p>
                            <p className="mt-1 text-xs text-muted">{book.seriesTitle ? `${book.seriesPart}부` : book.author}</p>
                            <p className="mt-2 text-xs text-muted">
                              {readingStatusLabel(book.status)} · {percent(progress[book.id]?.overallProgress ?? 0)}%
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="divide-y divide-line border-y border-line">
                      {group.books.map((book) => (
                        <li key={book.id}>
                          <Link href={`/books/${book.id}`} className="flex items-center gap-4 py-4">
                            <BookCover title={book.title} author={book.author} cover={book.cover} className="w-14 shrink-0" />
                            <div className="min-w-0">
                              <p className="truncate font-serif text-lg">{book.title}</p>
                              <p className="text-sm text-muted">{book.seriesTitle ? `${book.seriesPart}부` : book.author}</p>
                              <p className="mt-1 text-xs text-muted">{readingStatusLabel(book.status)} · {percent(progress[book.id]?.overallProgress ?? 0)}%</p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
