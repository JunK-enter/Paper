"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/shell";
import { AccountSyncError, saveUploadedManuscript } from "@/lib/shelf";
import { importLibrary } from "@/lib/storage/repo";
import { pushLibrary } from "@/lib/firebase/sync";
import { useLibrary } from "@/lib/store";
import type { LibraryExport } from "@/types/models";

export function UploadScreen() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const userId = useLibrary((s) => s.userId);
  const refresh = useLibrary((s) => s.refresh);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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

  return (
    <AppShell>
      <main className="mx-auto max-w-xl px-5 pt-10 sm:px-8">
        <p className="text-[11px] tracking-[0.18em] text-muted">원고</p>
        <h1 className="mt-2 font-serif text-4xl tracking-[-0.03em]">이야기 올리기</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          한 권은 「제1장 — 제목」으로 나뉩니다. 시리즈는 파일을 여러 개 골라도 됩니다. 이름 예시는 별을_묻는_왕국_제1부_재의_아이.txt 입니다.
        </p>
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
