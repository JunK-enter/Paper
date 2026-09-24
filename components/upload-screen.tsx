"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/shell";
import { CoverEditor } from "@/components/cover-editor";
import { AccountSyncError, saveUploadedManuscript } from "@/lib/shelf";
import { parseManuscript } from "@/lib/manuscript";
import { importLibrary } from "@/lib/storage/repo";
import { pushLibrary } from "@/lib/firebase/sync";
import { useLibrary } from "@/lib/store";
import type { CoverSettings, LibraryExport } from "@/types/models";

export function UploadScreen() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const userId = useLibrary((s) => s.userId);
  const refresh = useLibrary((s) => s.refresh);
  const series = useLibrary((s) => s.series);
  const saveSeries = useLibrary((s) => s.saveSeries);
  const upsertBook = useLibrary((s) => s.upsertBook);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingCover, setEditingCover] = useState(false);
  const [draft, setDraft] = useState<{
    filename: string;
    text: string;
    title: string;
    author: string;
    description: string;
    seriesChoice: string;
    newSeries: string;
    volume: string;
    coverSettings?: CoverSettings;
  } | null>(null);

  async function onPick(list: FileList) {
    const files = [...list].sort((a, b) => a.name.localeCompare(b.name, "ko", { numeric: true }));
    setBusy(true);
    setMessage("");
    try {
      const saved = [];
      let syncFailed = false;
      for (const file of files) {
        const text = await file.text();
        const trimmed = text.trim();
        if (trimmed.startsWith("{")) {
          const data = JSON.parse(trimmed) as LibraryExport;
          if (data.format === "paper-library") {
            await importLibrary(userId, data);
            try {
              await pushLibrary(userId);
            } catch {
              /* 로컬에는 반영되었습니다. */
            }
            continue;
          }
        }
        if (files.length === 1) {
          const parsed = parseManuscript(text, file.name);
          setDraft({
            filename: file.name,
            text,
            title: parsed.title,
            author: "",
            description: "",
            seriesChoice: parsed.seriesTitle ? "new" : "none",
            newSeries: parsed.seriesTitle ?? "",
            volume: String(parsed.partNumber ?? 1),
          });
          return;
        }
        try {
          saved.push(await saveUploadedManuscript(userId, file.name, text));
        } catch (error) {
          if (!(error instanceof AccountSyncError)) throw error;
          saved.push(error.book);
          syncFailed = true;
        }
      }
      await refresh();
      if (syncFailed) {
        setMessage("이 브라우저에는 저장됐지만 계정에는 아직 올라가지 않았습니다. 같은 계정으로 다시 열면 이어서 동기화됩니다.");
        return;
      }
      if (saved.length === 1) router.push(`/books/${saved[0].id}`);
      else router.push("/");
    } catch {
      setMessage("파일을 책으로 읽지 못했습니다. 텍스트 원고나 paper-library JSON을 올려 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function commitDraft() {
    if (!draft) return;
    setBusy(true);
    setMessage("");
    try {
      let book;
      try {
        book = await saveUploadedManuscript(userId, draft.filename, draft.text);
      } catch (error) {
        if (!(error instanceof AccountSyncError)) throw error;
        book = error.book;
      }
      let seriesId = book.seriesId;
      let seriesTitle = book.seriesTitle;
      if (draft.seriesChoice === "none") {
        seriesId = undefined;
        seriesTitle = undefined;
      } else if (draft.seriesChoice === "new" && draft.newSeries.trim()) {
        seriesTitle = draft.newSeries.trim();
        const existing = series.find((item) => item.title === seriesTitle);
        const record = existing ?? {
          id: crypto.randomUUID(),
          userId,
          title: seriesTitle,
          bookIds: [] as string[],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastOpenedAt: null,
        };
        seriesId = record.id;
        if (!record.bookIds.includes(book.id)) record.bookIds.push(book.id);
        await saveSeries({ ...record, updatedAt: Date.now() });
      } else if (draft.seriesChoice !== "new") {
        const chosen = series.find((item) => item.id === draft.seriesChoice);
        if (chosen) {
          seriesId = chosen.id;
          seriesTitle = chosen.title;
          if (!chosen.bookIds.includes(book.id)) await saveSeries({ ...chosen, bookIds: [...chosen.bookIds, book.id], updatedAt: Date.now() });
        }
      }
      const volume = Number(draft.volume) || book.volumeNumber || 1;
      const next = {
        ...book,
        title: draft.title.trim() || book.title,
        author: draft.author.trim(),
        description: draft.description.trim(),
        updatedAt: Date.now(),
      };
      if (seriesTitle && seriesId) {
        next.seriesId = seriesId;
        next.seriesTitle = seriesTitle;
        next.seriesPart = volume;
        next.volumeNumber = volume;
        next.volumeLabel = `${volume}권`;
      } else {
        delete next.seriesId;
        delete next.seriesTitle;
        delete next.seriesPart;
        delete next.volumeNumber;
        delete next.volumeLabel;
      }
      if (draft.coverSettings) next.coverSettings = draft.coverSettings;
      else delete next.coverSettings;
      await upsertBook(next);
      await refresh();
      router.push(`/books/${book.id}`);
    } catch {
      setMessage("서재에 넣지 못했습니다. 같은 파일을 한 번 더 올려 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-xl px-5 pt-10 sm:px-8">
        <p className="text-[11px] tracking-[0.18em] text-muted">원고</p>
        <h1 className="mt-2 font-serif text-4xl tracking-[-0.03em]">이야기 올리기</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          한 권은 「제1장 — 제목」으로 나뉩니다. 시리즈는 파일을 여러 개 골라도 됩니다. 이름 예시는 별을_묻는_왕국_제1부_재의_아이.txt 입니다.
        </p>
        {draft ? (
          <div className="mt-8 space-y-4">
            <h2 className="font-serif text-2xl">이야기 정보</h2>
            <label className="block text-sm text-muted">제목
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="mt-1 w-full border-b border-line bg-transparent py-2 text-ink outline-none" />
            </label>
            <label className="block text-sm text-muted">저자
              <input value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} className="mt-1 w-full border-b border-line bg-transparent py-2 text-ink outline-none" />
            </label>
            <label className="block text-sm text-muted">소개
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="mt-1 w-full border-b border-line bg-transparent py-2 text-ink outline-none" />
            </label>
            <label className="block text-sm text-muted">시리즈에 추가
              <select value={draft.seriesChoice} onChange={(e) => setDraft({ ...draft, seriesChoice: e.target.value })} className="mt-1 block w-full bg-transparent py-2 text-ink">
                <option value="none">없음</option>
                {series.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                <option value="new">새 시리즈 생성</option>
              </select>
            </label>
            {draft.seriesChoice === "new" ? (
              <input value={draft.newSeries} onChange={(e) => setDraft({ ...draft, newSeries: e.target.value })} placeholder="시리즈 이름" className="w-full border-b border-line bg-transparent py-2 outline-none" />
            ) : null}
            {draft.seriesChoice !== "none" ? (
              <label className="block text-sm text-muted">권
                <input value={draft.volume} onChange={(e) => setDraft({ ...draft, volume: e.target.value })} className="mt-1 w-full border-b border-line bg-transparent py-2 text-ink outline-none" />
              </label>
            ) : null}
            <button className="text-sm text-accent" onClick={() => setEditingCover((value) => !value)}>표지 편집</button>
            {editingCover ? (
              <CoverEditor
                title={draft.title}
                author={draft.author}
                cover={{ kind: "preset" }}
                initial={draft.coverSettings}
                onCancel={() => setEditingCover(false)}
                onSave={(coverSettings) => { setDraft({ ...draft, coverSettings }); setEditingCover(false); }}
              />
            ) : null}
            <button className="block min-h-12 text-accent" disabled={busy} onClick={() => void commitDraft()}>서재에 추가</button>
          </div>
        ) : null}
        <button
          className="mt-8 inline-flex min-h-12 items-center text-accent disabled:opacity-50"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "읽는 중" : "파일 선택"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.markdown,.json,text/plain"
          multiple
          className="sr-only"
          onChange={(event) => {
            const list = event.target.files;
            if (list && list.length > 0) void onPick(list);
            event.target.value = "";
          }}
        />
        {message ? <p className="mt-4 text-sm">{message}</p> : null}
      </main>
    </AppShell>
  );
}
