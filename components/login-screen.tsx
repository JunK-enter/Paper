"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { firebaseServices } from "@/lib/firebase/client";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const svc = firebaseServices();
    if (!svc) {
      setError("Firebase 설정이 없습니다.");
      return;
    }
    try {
      if (mode === "up") await createUserWithEmailAndPassword(svc.auth, email.trim(), password);
      else await signInWithEmailAndPassword(svc.auth, email.trim(), password);
    } catch {
      setError("이메일 또는 비밀번호를 확인해 주세요.");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="font-serif text-3xl tracking-[0.22em]">PAPER</p>
      <p className="mt-2 text-sm text-muted">개인 서재에 들어가려면 계정으로 로그인하세요.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block text-sm text-muted">이메일
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border-b border-line bg-transparent py-2 text-ink outline-none" />
        </label>
        <label className="block text-sm text-muted">비밀번호
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full border-b border-line bg-transparent py-2 text-ink outline-none" />
        </label>
        {error && <p className="text-sm text-accent">{error}</p>}
        <button className="min-h-12 text-accent" type="submit">{mode === "in" ? "로그인" : "계정 만들기"}</button>
      </form>
      <button className="mt-4 text-left text-sm text-muted" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "계정이 없으면 만들기" : "이미 계정이 있습니다"}
      </button>
    </main>
  );
}
