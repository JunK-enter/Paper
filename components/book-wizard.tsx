"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/shell";
import { BookCover } from "@/components/cover";
import { COVER_PRESETS } from "@/lib/covers";
import { useLibrary } from "@/lib/store";
import { uid } from "@/lib/utils";
import type { Book, Chapter, Cover } from "@/types/models";

async function fileToCover(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
      el.src = url;
    });
    const scale = Math.min(1, 900 / image.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이미지를 처리하지 못했습니다.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function BookWizard() {
  const router = useRouter();
  const userId = useLibrary((s) => s.userId);
  const upsertBook = useLibrary((s) => s.upsertBook);
  const upsertChapter = useLibrary((s) => s.upsertChapter);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<Cover>({ kind: "typographic" });
  const [chapterTitle, setChapterTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  const steps = ["정보", "표지", "첫 장", "미리보기"];
  const preview = useMemo(() => ({ title, author, cover }), [author, cover, title]);

  async function save(withChapter: boolean) {
    if (!title.trim()) {
      setError("제목을 입력해 주세요.");
      setStep(0);
      return;
    }
    const now = Date.now();
    const bookId = uid();
    const book: Book = {
      id: bookId,
      userId,
      title: title.trim(),
      author: author.trim(),
      genre: genre.trim(),
      description: description.trim(),
      cover,
      status: "unread",
      archived: false,
      chapterCount: withChapter && content.trim() ? 1 : 0,
      publishedCount: withChapter && content.trim() ? 1 : 0,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: null,
    };
    await upsertBook(book);
    if (withChapter && (content.trim() || chapterTitle.trim())) {
      const chapter: Chapter = {
        id: uid(),
        bookId,
        userId,
        title: chapterTitle.trim() || "1장",
        content,
        order: 0,
        status: "published",
        createdAt: now,
        updatedAt: now,
      };
      await upsertChapter(chapter);
    }
    router.push(`/books/${bookId}`);
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-xl px-5 pt-6 sm:px-8">
        <p className="text-[11px] tracking-[0.18em] text-muted">새 책 · {steps[step]}</p>
        <div className="mt-3 flex gap-2">
          {steps.map((label, index) => (
            <button key={label} className={`h-1 flex-1 ${index <= step ? "bg-accent" : "bg-line"}`} onClick={() => setStep(index)} aria-label={label} />
          ))}
        </div>
        {error && <p className="mt-4 text-sm text-accent">{error}</p>}

        {step === 0 && (
          <div className="mt-8 space-y-5">
            <Field label="제목" value={title} onChange={setTitle} />
            <Field label="작가" value={author} onChange={setAuthor} />
            <Field label="장르" value={genre} onChange={setGenre} />
            <label className="block text-sm text-muted">
              소개
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="mt-2 w-full border border-line bg-paper p-3 outline-none" />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="mt-8">
            <BookCover title={title || "무제"} author={author} cover={preview.cover} className="mx-auto w-40" />
            <div className="mt-6 grid grid-cols-4 gap-3">
              <button className={`border px-2 py-3 text-xs ${cover.kind === "typographic" ? "border-accent" : "border-line"}`} onClick={() => setCover({ kind: "typographic" })}>글자</button>
              {COVER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  aria-label={preset.name}
                  className={`h-14 border ${cover.kind === "preset" && cover.presetId === preset.id ? "border-accent" : "border-transparent"}`}
                  style={{ background: preset.bg }}
                  onClick={() => setCover({ kind: "preset", presetId: preset.id })}
                />
              ))}
            </div>
            <label className="mt-4 inline-block text-sm text-accent">
              표지 이미지 올리기
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void fileToCover(file).then((imageDataUrl) => setCover({ kind: "upload", imageDataUrl }));
                }}
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="mt-8 space-y-5">
            <Field label="장 제목" value={chapterTitle} onChange={setChapterTitle} />
            <label className="block text-sm text-muted">
              내용
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                placeholder="ChatGPT에서 복사한 글을 그대로 붙여 넣으세요."
                className="mt-2 w-full border border-line bg-paper p-3 leading-relaxed outline-none"
              />
            </label>
            <p className="text-xs text-muted">문단과 대화, 문장 부호는 그대로 보존됩니다. 이 단계는 건너뛸 수 있습니다.</p>
          </div>
        )}

        {step === 3 && (
          <div className="mt-8">
            <BookCover title={title || "무제"} author={author} cover={cover} className="w-36" />
            <h1 className="mt-6 font-serif text-3xl">{title || "무제"}</h1>
            <p className="mt-2 text-muted">{author || "작자 미상"}</p>
            <p className="mt-4 text-sm leading-relaxed">{description}</p>
            {content.trim() && <p className="mt-4 text-sm text-muted">첫 장 {chapterTitle || "1장"} · {content.length.toLocaleString()}자</p>}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button className="min-h-12 text-sm text-muted" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>이전</button>
          {step < 3 ? (
            <button className="min-h-12 text-sm text-accent" onClick={() => setStep((s) => s + 1)}>다음</button>
          ) : (
            <button className="min-h-12 text-sm text-accent" onClick={() => void save(true)}>서재에 저장</button>
          )}
        </div>
        {step === 2 && (
          <button className="mt-2 text-sm text-muted" onClick={() => void save(false)}>장 없이 저장</button>
        )}
      </main>
    </AppShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm text-muted">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full border-b border-line bg-transparent py-2 text-base text-ink outline-none" />
    </label>
  );
}

export function BookEditor({ bookId }: { bookId: string }) {
  const router = useRouter();
  const book = useLibrary((s) => s.books.find((b) => b.id === bookId));
  const upsertBook = useLibrary((s) => s.upsertBook);
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [genre, setGenre] = useState(book?.genre ?? "");
  const [description, setDescription] = useState(book?.description ?? "");
  const [cover, setCover] = useState<Cover>(book?.cover ?? { kind: "typographic" });

  if (!book) return <AppShell><main className="p-8">책을 찾을 수 없습니다.</main></AppShell>;

  return (
    <AppShell>
      <main className="mx-auto max-w-xl px-5 pt-6">
        <h1 className="font-serif text-3xl">책 수정</h1>
        <div className="mt-6"><BookCover title={title} author={author} cover={cover} className="w-32" /></div>
        <div className="mt-6 space-y-5">
          <Field label="제목" value={title} onChange={setTitle} />
          <Field label="작가" value={author} onChange={setAuthor} />
          <Field label="장르" value={genre} onChange={setGenre} />
          <label className="block text-sm text-muted">소개
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="mt-2 w-full border border-line bg-paper p-3 outline-none" />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {COVER_PRESETS.map((preset) => (
            <button key={preset.id} className="h-12 border border-line" style={{ background: preset.bg }} onClick={() => setCover({ kind: "preset", presetId: preset.id })} aria-label={preset.name} />
          ))}
        </div>
        <label className="mt-3 inline-block text-sm text-accent">
          표지 바꾸기
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void fileToCover(file).then((imageDataUrl) => setCover({ kind: "upload", imageDataUrl }));
          }} />
        </label>
        <button
          className="mt-8 block min-h-12 text-accent"
          onClick={() => {
            void upsertBook({ ...book, title: title.trim() || book.title, author, genre, description, cover, updatedAt: Date.now() }).then(() => router.push(`/books/${book.id}`));
          }}
        >
          저장
        </button>
      </main>
    </AppShell>
  );
}
