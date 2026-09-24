"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bookmark, ChevronLeft, Settings2, X } from "lucide-react";
import { Sheet } from "@/components/ui";
import { useLibrary, flushReadingProgress, ensureProgress } from "@/lib/store";
import { excerptAround, percent, splitBlocks } from "@/lib/utils";
import type { ReadingFont, ReadingMode, ReadingTheme } from "@/types/models";

const fonts: { id: ReadingFont; label: string; stack: string }[] = [
  { id: "literata", label: "Literata", stack: "var(--font-literata), var(--font-serif-kr), serif" },
  { id: "lora", label: "Lora", stack: "var(--font-lora), var(--font-serif-kr), serif" },
  { id: "serif-kr", label: "본문 명조", stack: "var(--font-serif-kr), var(--font-literata), serif" },
];

export function ReaderScreen({ bookId, chapterId }: { bookId: string; chapterId: string }) {
  const router = useRouter();
  const book = useLibrary((s) => s.books.find((b) => b.id === bookId));
  const chapters = useLibrary((s) => s.chapters[bookId]);
  const loadChapters = useLibrary((s) => s.loadChapters);
  const progress = useLibrary((s) => s.progress[bookId]);
  const touchProgress = useLibrary((s) => s.touchProgress);
  const upsertBook = useLibrary((s) => s.upsertBook);
  const prefs = useLibrary((s) => s.preferences);
  const setPreferences = useLibrary((s) => s.setPreferences);
  const allBookmarks = useLibrary((s) => s.bookmarks);
  const bookmarks = useMemo(
    () => allBookmarks.filter((m) => m.bookId === bookId),
    [allBookmarks, bookId],
  );
  const addBookmark = useLibrary((s) => s.addBookmark);
  const removeBookmark = useLibrary((s) => s.removeBookmark);
  const userId = useLibrary((s) => s.userId);
  const saveQuote = useLibrary((s) => s.saveQuote);
  const [selection, setSelection] = useState<{ text: string; paragraph: number; offset: number; top: number; left: number } | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const [chrome, setChrome] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [marksOpen, setMarksOpen] = useState(false);
  const [anchor, setAnchor] = useState(0);
  const [page, setPage] = useState(0);
  const [slide, setSlide] = useState(1);
  const [viewport, setViewport] = useState(800);

  useEffect(() => {
    void loadChapters(bookId);
  }, [bookId, loadChapters]);

  const published = useMemo(
    () => (chapters ?? []).filter((c) => c.status === "published"),
    [chapters],
  );
  const chapter = published.find((c) => c.id === chapterId) ?? (chapters ?? []).find((c) => c.id === chapterId);
  const blocks = useMemo(() => splitBlocks(chapter?.content ?? ""), [chapter?.content]);
  const index = published.findIndex((c) => c.id === chapterId);
  const font = fonts.find((f) => f.id === prefs.fontFamily) ?? fonts[0];
  const pages = useMemo(() => {
    const lines = Math.max(8, Math.floor((viewport - 168) / (prefs.fontSize * prefs.lineHeight)));
    const width = Math.min(prefs.readingWidth, typeof window === "undefined" ? 390 : window.innerWidth - 48);
    const charsPerLine = Math.max(16, Math.floor(width / (prefs.fontSize * 0.92)));
    const budget = Math.max(280, lines * charsPerLine);
    const packed: number[][] = [];
    let bucket: number[] = [];
    let used = 0;
    blocks.forEach((block, index) => {
      const weight = Math.max(40, block.length);
      if (bucket.length && used + weight > budget) {
        packed.push(bucket);
        bucket = [index];
        used = weight;
      } else {
        bucket.push(index);
        used += weight;
      }
    });
    if (bucket.length) packed.push(bucket);
    return packed.length ? packed : [[0]];
  }, [blocks, prefs.fontSize, prefs.lineHeight, prefs.readingWidth, viewport]);

  const savePosition = useCallback(
    (paragraph: number, fraction: number, complete = false) => {
      if (!chapter || chapter.status !== "published") return;
      const base = ensureProgress(userId, bookId, chapter.id, useLibrary.getState().progress[bookId]);
      const maxFractions = {
        ...base.maxFractions,
        [chapter.id]: Math.max(base.maxFractions[chapter.id] ?? 0, fraction),
      };
      const completed = new Set(base.completedChapterIds);
      if (complete || fraction > 0.97) completed.add(chapter.id);
      void touchProgress(bookId, {
        ...base,
        userId,
        bookId,
        chapterId: chapter.id,
        anchorParagraph: paragraph,
        anchorOffset: 0,
        maxFractions,
        completedChapterIds: [...completed],
        lastReadAt: Date.now(),
        overallProgress: base.overallProgress,
      });
    },
    [bookId, chapter, touchProgress, userId],
  );

  useEffect(() => {
    if (!book || !chapter) return;
    const nextStatus = book.status === "completed" ? book.status : "reading";
    if (book.lastOpenedAt && Date.now() - book.lastOpenedAt < 60_000 && book.status === nextStatus) return;
    void upsertBook({ ...book, status: nextStatus, lastOpenedAt: Date.now(), updatedAt: Date.now() });
  }, [book, chapter, upsertBook]);

  useEffect(() => {
    restored.current = false;
    const query = Number(new URLSearchParams(window.location.search).get("at"));
    const saved = Number.isFinite(query) && query >= 0
      ? query
      : useLibrary.getState().progress[bookId]?.chapterId === chapterId
        ? useLibrary.getState().progress[bookId]?.anchorParagraph ?? 0
        : 0;
    // Restore the saved paragraph when the chapter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnchor(saved);
    setPage(0);
  }, [bookId, chapterId]);

  useEffect(() => {
    const update = () => setViewport(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!chapter || restored.current || prefs.readingMode !== "scroll") return;
    const params = new URLSearchParams(window.location.search);
    const query = Number(params.get("p") ?? params.get("at"));
    const saved = Number.isFinite(query) && query >= 0
      ? query
      : progress?.chapterId === chapter.id
        ? progress.anchorParagraph
        : 0;
    const node = scroller.current?.querySelector<HTMLElement>(`[data-block="${saved}"]`);
    node?.scrollIntoView({ block: "start" });
    restored.current = true;
    setAnchor(saved);
  }, [chapter, prefs.readingMode, progress, blocks.length]);

  useEffect(() => {
    const onHide = () => { void flushReadingProgress(); };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  useEffect(() => {
    if (prefs.readingMode !== "scroll") return;
    const root = scroller.current;
    if (!root) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nodes = [...root.querySelectorAll<HTMLElement>("[data-block]")];
        const line = root.getBoundingClientRect().top + 96;
        let current = 0;
        for (const node of nodes) {
          const top = node.getBoundingClientRect().top;
          if (top - line <= 8) current = Number(node.dataset.block ?? 0);
        }
        const last = nodes[nodes.length - 1];
        const atEnd = last ? last.getBoundingClientRect().bottom <= root.getBoundingClientRect().bottom + 24 : false;
        const fraction = blocks.length <= 1 ? (atEnd ? 1 : 0) : current / (blocks.length - 1);
        const paragraph = atEnd ? Math.max(0, blocks.length - 1) : current;
        setAnchor(paragraph);
        savePosition(paragraph, atEnd ? 1 : fraction, atEnd);
      });
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    if (root.scrollHeight <= root.clientHeight + 8) onScroll();
    return () => root.removeEventListener("scroll", onScroll);
  }, [blocks.length, prefs.readingMode, savePosition]);

  useEffect(() => {
    if (prefs.readingMode !== "paginated") return;
    const found = pages.findIndex((group) => group.includes(anchor));
    // Keep the page aligned with the restored paragraph.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(found === -1 ? 0 : found);
  }, [anchor, pages, prefs.readingMode]);

  function goPage(next: number) {
    const clamped = Math.max(0, Math.min(pages.length - 1, next));
    if (clamped === page) return;
    setSlide(clamped > page ? 1 : -1);
    setPage(clamped);
    const paragraph = pages[clamped]?.[0] ?? 0;
    const fraction = pages.length <= 1 ? 1 : clamped / (pages.length - 1);
    setAnchor(paragraph);
    savePosition(paragraph, fraction, clamped === pages.length - 1);
  }

  const turnPage = useCallback((direction: -1 | 1) => {
    if (prefs.readingMode !== "paginated" || settingsOpen || marksOpen) return;
    if (direction < 0) {
      if (page > 0) goPage(page - 1);
      else if (published[index - 1]) router.push(`/books/${bookId}/read/${published[index - 1].id}`);
      return;
    }
    if (page < pages.length - 1) goPage(page + 1);
    else if (published[index + 1]) router.push(`/books/${bookId}/read/${published[index + 1].id}`);
    // goPage closes over the latest page state and is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, index, marksOpen, page, pages.length, prefs.readingMode, published, router, settingsOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      turnPage(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turnPage]);

  const swipe = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.changedTouches[0];
    swipe.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = swipe.current;
    swipe.current = null;
    if (!start || prefs.readingMode !== "paginated") return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    turnPage(dx < 0 ? 1 : -1);
  }

  function onSurfaceClick(event: React.MouseEvent<HTMLDivElement>) {
    if (window.getSelection()?.toString()) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    if (prefs.readingMode === "paginated" && x < 0.28) {
      goPage(page - 1);
      return;
    }
    if (prefs.readingMode === "paginated" && x > 0.72) {
      if (page < pages.length - 1) goPage(page + 1);
      return;
    }
    setChrome((v) => !v);
  }

  if (!book || !chapter) {
    return <main className="grid min-h-dvh place-items-center text-sm text-muted">장을 불러오는 중</main>;
  }

  const theme = prefs.readingTheme;
  const visible = prefs.readingMode === "paginated" ? new Set(pages[page] ?? [0]) : null;
  const prev = published[index - 1];
  const next = published[index + 1];
  const atChapterEnd = prefs.readingMode === "scroll" ? anchor >= blocks.length - 1 : page >= pages.length - 1;

  return (
    <div
      data-theme={theme === "dark" ? "dark" : "light"}
      data-reading={theme === "sepia" ? "sepia" : undefined}
      className="fixed inset-0 z-40 h-dvh min-h-dvh w-full bg-paper text-ink"
      style={{
        height: "100dvh",
        minHeight: "-webkit-fill-available",
        ["--reading-font" as string]: font.stack,
        ["--reading-size" as string]: `${prefs.fontSize}px`,
        ["--reading-leading" as string]: String(prefs.lineHeight),
        ["--reading-gap" as string]: String(prefs.paragraphSpacing),
      }}
    >
      <div className="paper-veil" aria-hidden />
      <div
        ref={scroller}
        className="relative z-[1] h-full overflow-x-hidden overflow-y-auto bg-paper"
        onClick={onSurfaceClick}
        onTouchStart={onTouchStart}
        onTouchEnd={(event) => {
          onTouchEnd(event);
          const selected = window.getSelection();
          const text = selected?.toString().trim() ?? "";
          if (!text || !selected || selected.rangeCount === 0) return;
          const node = selected.anchorNode;
          const block = (node instanceof Element ? node : node?.parentElement)?.closest("[data-block]");
          const paragraph = Number(block?.getAttribute("data-block") ?? 0);
          const rect = selected.getRangeAt(0).getBoundingClientRect();
          setSelection({ text: text.slice(0, 500), paragraph, offset: selected.anchorOffset, top: rect.bottom + 8, left: rect.left });
        }}
        onMouseUp={() => {
          const selected = window.getSelection();
          const text = selected?.toString().trim() ?? "";
          if (!text || !selected || selected.rangeCount === 0) {
            setSelection(null);
            return;
          }
          const node = selected.anchorNode;
          const block = (node instanceof Element ? node : node?.parentElement)?.closest("[data-block]");
          const paragraph = Number(block?.getAttribute("data-block") ?? 0);
          const rect = selected.getRangeAt(0).getBoundingClientRect();
          setSelection({ text: text.slice(0, 500), paragraph, offset: selected.anchorOffset, top: rect.bottom + 8, left: Math.max(12, rect.left) });
        }}
      >
        <motion.article
          key={prefs.readingMode === "paginated" ? `${chapter.id}-${page}` : chapter.id}
          className="relative mx-auto bg-paper px-6 pb-28 pt-[calc(env(safe-area-inset-top)+4.5rem)]"
          style={{ maxWidth: prefs.readingWidth, width: "100%" }}
          initial={prefs.readingMode === "paginated" ? { x: slide * 42, opacity: 0.92 } : false}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
        >
          {(prefs.readingMode !== "paginated" || page === 0) && (
            <header className="mb-10 border-b border-line pb-8">
              <p className="text-[11px] tracking-[0.22em] text-muted">{index + 1}장</p>
              <h1 className="reading-chapter mt-3">{chapter.title}</h1>
            </header>
          )}
          <div className="mt-8">
            {blocks.map((block, i) => {
              if (visible && !visible.has(i)) return null;
              return (
                <div key={`${chapter.id}-${i}`} data-block={i} className="reading-prose">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{block}</ReactMarkdown>
                </div>
              );
            })}
          </div>
          {atChapterEnd && (
            <footer className="mt-16 border-t border-line pt-8">
              <p className="text-xs tracking-[0.16em] text-muted">{chapter.title}의 끝</p>
              {next ? (
                <button className="mt-4 font-serif text-2xl" onClick={(e) => { e.stopPropagation(); router.push(`/books/${bookId}/read/${next.id}`); }}>
                  {next.title} →
                </button>
              ) : (
                <button
                  className="mt-4 text-accent"
                  onClick={(e) => {
                    e.stopPropagation();
                    void upsertBook({ ...book, status: "completed", updatedAt: Date.now() });
                    router.push(`/books/${bookId}`);
                  }}
                >
                  책을 덮고 완독으로 표시
                </button>
              )}
            </footer>
          )}
        </motion.article>
      </div>
      {selection ? (
        <div className="fixed z-40 flex gap-3 border border-line bg-paper px-3 py-2 text-sm shadow-[var(--shadow)]" style={{ top: selection.top, left: selection.left }}>
          <button
            className="text-accent"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!book || !chapter) return;
              void saveQuote({
                id: crypto.randomUUID(),
                userId,
                bookId,
                bookTitle: book.title,
                chapterId: chapter.id,
                chapterTitle: chapter.title,
                seriesId: book.seriesId,
                seriesTitle: book.seriesTitle,
                text: selection.text,
                anchorParagraph: selection.paragraph,
                anchorOffset: selection.offset,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
              window.getSelection()?.removeAllRanges();
              setSelection(null);
            }}
          >
            저장
          </button>
          <button className="text-muted" onMouseDown={(event) => event.preventDefault()} onClick={() => setSelection(null)}>닫기</button>
        </div>
      ) : null}

      <div className={`pointer-events-none fixed inset-x-0 top-0 z-20 transition ${chrome ? "opacity-100" : "opacity-0"}`} style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between px-3 py-2">
          <button className="grid h-11 w-11 place-items-center" aria-label="책으로" onClick={() => router.push(`/books/${bookId}`)}><ChevronLeft size={20} /></button>
          <p className="truncate px-3 text-sm">{book.title}</p>
          <div className="flex">
            <button className="grid h-11 w-11 place-items-center" aria-label="책갈피" onClick={() => setMarksOpen(true)}><Bookmark size={18} /></button>
            <button className="grid h-11 w-11 place-items-center" aria-label="읽기 설정" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /></button>
          </div>
        </div>
      </div>

      <div className={`pointer-events-none fixed inset-x-0 bottom-0 z-20 transition ${chrome ? "opacity-100" : "opacity-0"}`} style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between px-4 py-3 text-sm">
          <button className="min-h-11 disabled:opacity-30" disabled={!prev} onClick={() => prev && router.push(`/books/${bookId}/read/${prev.id}`)}>이전 장</button>
          <p className="text-muted">{prefs.readingMode === "paginated" ? `${page + 1} / ${pages.length}` : `${percent(progress?.overallProgress ?? 0)}%`}</p>
          <button className="min-h-11 disabled:opacity-30" disabled={!next} onClick={() => next && router.push(`/books/${bookId}/read/${next.id}`)}>다음 장</button>
        </div>
      </div>

      <button className={`fixed right-4 top-16 grid h-11 w-11 place-items-center ${chrome ? "hidden" : ""}`} aria-label="도구 막대" onClick={() => setChrome(true)}>
        <X className="opacity-0" />
      </button>

      <Sheet open={settingsOpen} title="읽기 설정" onClose={() => setSettingsOpen(false)}>
        <p className="reading-prose text-[1em]">문장은 종이 위에 머뭅니다.</p>
        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm">글자 크기</span>
          <div className="flex items-center gap-3">
            <button className="h-11 w-11 border border-line" onClick={() => void setPreferences({ fontSize: Math.max(16, prefs.fontSize - 1) })}>가</button>
            <span>{prefs.fontSize}</span>
            <button className="h-11 w-11 border border-line text-lg" onClick={() => void setPreferences({ fontSize: Math.min(28, prefs.fontSize + 1) })}>가</button>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {fonts.map((item) => (
            <button key={item.id} className={`min-h-11 flex-1 border text-sm ${prefs.fontFamily === item.id ? "border-accent" : "border-line"}`} onClick={() => void setPreferences({ fontFamily: item.id })}>{item.label}</button>
          ))}
        </div>
        <label className="mt-4 block text-sm">줄 간격
          <input type="range" min={1.45} max={2.1} step={0.05} value={prefs.lineHeight} onChange={(e) => void setPreferences({ lineHeight: Number(e.target.value) })} className="mt-2 w-full" />
        </label>
        <label className="mt-3 block text-sm">문단 간격
          <input type="range" min={0.7} max={1.8} step={0.05} value={prefs.paragraphSpacing} onChange={(e) => void setPreferences({ paragraphSpacing: Number(e.target.value) })} className="mt-2 w-full" />
        </label>
        <label className="mt-3 block text-sm">폭 {prefs.readingWidth}px
          <input type="range" min={560} max={760} step={20} value={prefs.readingWidth} onChange={(e) => void setPreferences({ readingWidth: Number(e.target.value) })} className="mt-2 w-full" />
        </label>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {(["light", "sepia", "dark"] as ReadingTheme[]).map((item) => (
            <button key={item} className={`min-h-11 border text-sm ${prefs.readingTheme === item ? "border-accent" : "border-line"}`} onClick={() => void setPreferences({ readingTheme: item })}>
              {item === "light" ? "종이" : item === "sepia" ? "세피아" : "밤"}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["scroll", "paginated"] as ReadingMode[]).map((item) => (
            <button key={item} className={`min-h-11 border text-sm ${prefs.readingMode === item ? "border-accent" : "border-line"}`} onClick={() => void setPreferences({ readingMode: item })}>
              {item === "scroll" ? "스크롤" : "페이지"}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={marksOpen} title="책갈피" onClose={() => setMarksOpen(false)}>
        <button
          className="min-h-11 text-sm text-accent"
          onClick={() => void addBookmark({
            bookId,
            chapterId,
            anchorParagraph: anchor,
            anchorOffset: 0,
            excerpt: excerptAround(chapter.content, anchor),
          })}
        >
          이 위치에 꽂기
        </button>
        <ul className="mt-3 divide-y divide-line">
          {bookmarks.map((mark) => (
            <li key={mark.id} className="flex items-start justify-between gap-3 py-3">
              <button
                className="text-left"
                onClick={() => {
                  setMarksOpen(false);
                  if (mark.chapterId !== chapterId) router.push(`/books/${bookId}/read/${mark.chapterId}?at=${mark.anchorParagraph}`);
                  else {
                    scroller.current?.querySelector<HTMLElement>(`[data-block="${mark.anchorParagraph}"]`)?.scrollIntoView({ block: "start" });
                    setAnchor(mark.anchorParagraph);
                  }
                }}
              >
                <p className="text-sm">{mark.excerpt || "책갈피"}</p>
                <p className="text-xs text-muted">{new Date(mark.createdAt).toLocaleString("ko-KR")}</p>
              </button>
              <button className="text-xs text-muted" onClick={() => void removeBookmark(mark.id)}>삭제</button>
            </li>
          ))}
          {bookmarks.length === 0 && <li className="py-4 text-sm text-muted">아직 책갈피가 없습니다.</li>}
        </ul>
      </Sheet>
    </div>
  );
}
