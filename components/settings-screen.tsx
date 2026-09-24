"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { AppShell } from "@/components/layout/shell";
import { BookCover } from "@/components/cover";
import { firebaseServices, isFirebaseConfigured } from "@/lib/firebase/client";
import { mirrorLocalToAccount, pushLibrary } from "@/lib/firebase/sync";
import { useLibrary } from "@/lib/store";
import { LOCAL_USER_ID } from "@/types/models";
import type { LibraryExport, ReadingFont, ReadingMode, ReadingTheme, UiTheme } from "@/types/models";
import { listBooks } from "@/lib/storage/repo";

export function SettingsScreen() {
  const prefs = useLibrary((s) => s.preferences);
  const setPreferences = useLibrary((s) => s.setPreferences);
  const email = useLibrary((s) => s.email);
  const userId = useLibrary((s) => s.userId);
  const offline = useLibrary((s) => s.offline);
  const exportData = useLibrary((s) => s.exportData);
  const importData = useLibrary((s) => s.importData);
  const refresh = useLibrary((s) => s.refresh);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [localCount, setLocalCount] = useState(0);

  useEffect(() => {
    void listBooks(LOCAL_USER_ID).then((books) => setLocalCount(books.length));
  }, [userId]);

  async function onExport() {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "paper-library.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImport(file: File) {
    const text = await file.text();
    const data = JSON.parse(text) as LibraryExport;
    await importData(data);
    setMessage("서재를 가져왔습니다.");
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-xl px-5 pt-8">
        <h1 className="font-serif text-4xl">설정</h1>
        <p className="mt-2 text-sm text-muted">{offline ? "오프라인 · 저장된 책을 읽을 수 있습니다." : isFirebaseConfigured() ? "계정에 동기화됩니다." : "이 브라우저의 로컬 서재"}</p>
        {message && <p className="mt-3 text-sm text-accent">{message}</p>}

        <Section title="모습">
          <Choice
            value={prefs.uiTheme}
            options={[["light", "라이트"], ["dark", "다크"], ["system", "시스템"]]}
            onChange={(uiTheme) => void setPreferences({ uiTheme: uiTheme as UiTheme })}
          />
        </Section>
        <Section title="읽기">
          <label className="mt-3 block text-sm text-muted">기본 테마
            <select value={prefs.readingTheme} onChange={(e) => void setPreferences({ readingTheme: e.target.value as ReadingTheme })} className="mt-1 block w-full bg-transparent py-2 text-ink">
              <option value="light">종이</option>
              <option value="sepia">세피아</option>
              <option value="dark">밤</option>
            </select>
          </label>
          <label className="mt-3 block text-sm text-muted">글꼴
            <select value={prefs.fontFamily} onChange={(e) => void setPreferences({ fontFamily: e.target.value as ReadingFont })} className="mt-1 block w-full bg-transparent py-2 text-ink">
              <option value="literata">Literata</option>
              <option value="lora">Lora</option>
              <option value="serif-kr">본문 명조</option>
            </select>
          </label>
          <label className="mt-3 block text-sm text-muted">글자 크기 {prefs.fontSize}
            <input type="range" min={16} max={28} value={prefs.fontSize} onChange={(e) => void setPreferences({ fontSize: Number(e.target.value) })} className="w-full" />
          </label>
          <label className="mt-3 block text-sm text-muted">줄 간격 {prefs.lineHeight.toFixed(2)}
            <input type="range" min={1.45} max={2.1} step={0.05} value={prefs.lineHeight} onChange={(e) => void setPreferences({ lineHeight: Number(e.target.value) })} className="w-full" />
          </label>
          <label className="mt-3 block text-sm text-muted">읽기 방식
            <select value={prefs.readingMode} onChange={(e) => void setPreferences({ readingMode: e.target.value as ReadingMode })} className="mt-1 block w-full bg-transparent py-2 text-ink">
              <option value="scroll">이어 읽기</option>
              <option value="paginated">페이지</option>
            </select>
          </label>
        </Section>
        <Section title="서재">
          <Link href="/settings/archive" className="mt-3 inline-block min-h-11 text-sm">보관한 책</Link>
          <div className="mt-2 flex gap-4 text-sm">
            <button className="min-h-11" onClick={() => void onExport()}>내보내기</button>
            <button className="min-h-11" onClick={() => fileRef.current?.click()}>가져오기</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json" className="sr-only" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onImport(file).catch(() => setMessage("파일을 읽지 못했습니다."));
          }} />
          <p className="mt-2 text-xs leading-relaxed text-muted">형식은 paper-library 버전 1 JSON입니다. 책, 장, 책갈피, 읽기 위치를 포함합니다.</p>
        </Section>
        <Section title="계정">
          {isFirebaseConfigured() ? (
            <>
              <p className="mt-2 text-sm">{email || userId}</p>
              {localCount > 0 && userId !== LOCAL_USER_ID && (
                <button
                  className="mt-3 block text-sm text-accent"
                  onClick={() => {
                    void mirrorLocalToAccount(LOCAL_USER_ID, userId).then(() => refresh()).then(() => setMessage("로컬 서재를 계정으로 가져왔습니다."));
                  }}
                >
                  이 브라우저의 로컬 서재 {localCount}권을 계정으로 가져오기
                </button>
              )}
              <button
                className="mt-4 text-sm"
                onClick={() => {
                  const svc = firebaseServices();
                  if (svc) void signOut(svc.auth);
                }}
              >
                로그아웃
              </button>
              <button className="mt-3 block text-sm text-muted" onClick={() => void pushLibrary(userId).then(() => setMessage("동기화했습니다."))}>지금 동기화</button>
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-muted">Firebase 환경 변수가 없으면 책은 이 기기의 IndexedDB에만 저장됩니다. 연결 후에도 로컬 책은 지워지지 않습니다.</p>
          )}
        </Section>
      </main>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-line pt-5">
      <h2 className="text-[11px] tracking-[0.16em] text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Choice({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {options.map(([id, label]) => (
        <button key={id} className={`min-h-11 border text-sm ${value === id ? "border-accent" : "border-line"}`} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function ArchiveScreen() {
  const books = useLibrary((s) => s.books).filter((b) => b.archived);
  const upsertBook = useLibrary((s) => s.upsertBook);
  return (
    <AppShell>
      <main className="mx-auto max-w-xl px-5 pt-8">
        <Link href="/settings" className="text-sm text-muted">설정</Link>
        <h1 className="mt-3 font-serif text-4xl">보관한 책</h1>
        {books.length === 0 ? (
          <p className="mt-8 text-muted">보관함에 책이 없습니다.</p>
        ) : (
          <ul className="mt-6 divide-y divide-line">
            {books.map((book) => (
              <li key={book.id} className="flex items-center gap-4 py-4">
                <BookCover title={book.title} author={book.author} cover={book.cover} className="w-12" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif">{book.title}</p>
                  <button className="text-sm text-accent" onClick={() => void upsertBook({ ...book, archived: false, updatedAt: Date.now() })}>서재로 되돌리기</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}

export function NowScreen() {
  const books = useLibrary((s) => s.books).filter((b) => !b.archived);
  const progress = useLibrary((s) => s.progress);
  const current = [...books].sort((a, b) => (progress[b.id]?.lastReadAt ?? b.lastOpenedAt ?? 0) - (progress[a.id]?.lastReadAt ?? a.lastOpenedAt ?? 0))[0];
  const row = current ? progress[current.id] : undefined;
  return (
    <AppShell>
      <main className="mx-auto max-w-xl px-5 pt-10">
        <p className="text-[11px] tracking-[0.18em] text-muted">읽는 중</p>
        {!current ? (
          <div className="mt-8">
            <p className="font-serif text-3xl">펼쳐 둔 책이 없습니다.</p>
            <Link href="/books/new" className="mt-4 inline-block text-accent">이야기 추가하기 →</Link>
          </div>
        ) : (
          <div className="mt-6">
            <BookCover title={current.title} author={current.author} cover={current.cover} className="w-44" />
            <h1 className="mt-6 font-serif text-4xl leading-tight">{current.title}</h1>
            <p className="mt-2 text-muted">{current.author}</p>
            {row ? (
              <Link href={`/books/${current.id}/read/${row.chapterId}`} className="mt-6 inline-block text-accent">이어서 읽기 →</Link>
            ) : (
              <Link href={`/books/${current.id}`} className="mt-6 inline-block text-accent">책 열기 →</Link>
            )}
          </div>
        )}
      </main>
    </AppShell>
  );
}
