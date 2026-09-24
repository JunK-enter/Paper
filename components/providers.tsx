"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseServices, isFirebaseConfigured } from "@/lib/firebase/client";
import { mirrorLocalToAccount, pullLibrary, pushLibrary } from "@/lib/firebase/sync";
import { ensureShelvedBook } from "@/lib/shelf";
import { useLibrary } from "@/lib/store";
import { LoginScreen } from "@/components/login-screen";
import { LOCAL_USER_ID } from "@/types/models";

function applyTheme(theme: "light" | "dark" | "system") {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = theme === "system" ? (dark ? "dark" : "light") : theme;
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const boot = useLibrary((s) => s.boot);
  const setUser = useLibrary((s) => s.setUser);
  const ready = useLibrary((s) => s.ready);
  const userId = useLibrary((s) => s.userId);
  const uiTheme = useLibrary((s) => s.preferences.uiTheme);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured());
  const [signedIn, setSignedIn] = useState(!isFirebaseConfigured());

  useEffect(() => {
    const onOff = () => useLibrary.setState({ offline: !navigator.onLine });
    window.addEventListener("online", onOff);
    window.addEventListener("offline", onOff);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      window.removeEventListener("online", onOff);
      window.removeEventListener("offline", onOff);
    };
  }, []);

  useEffect(() => {
    const configured = isFirebaseConfigured();
    if (!configured) {
      void (async () => {
        await boot();
        await ensureShelvedBook(useLibrary.getState().userId);
        await useLibrary.getState().refresh();
      })();
      return;
    }
    const svc = firebaseServices();
    if (!svc) {
      void boot();
      // Auth is already resolved when Firebase services are missing.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(svc.auth, (user) => {
      setAuthReady(true);
      if (!user) {
        setSignedIn(false);
        useLibrary.setState({ ready: true, userId: "" });
        return;
      }
      setSignedIn(true);
      void (async () => {
        await setUser(user.uid, user.email ?? "");
        try {
          await pullLibrary(user.uid);
        } catch {
          /* 오프라인이면 이 브라우저에 저장된 서재를 그대로 보여 줍니다. */
        }
        try {
          await mirrorLocalToAccount(LOCAL_USER_ID, user.uid);
        } catch {
          /* 로컬 서재가 없어도 계정 서재는 유지됩니다. */
        }
        await ensureShelvedBook(user.uid);
        try {
          await pushLibrary(user.uid);
        } catch {
          /* 다음 로그인 때 다시 계정으로 올립니다. */
        }
        await useLibrary.getState().refresh();
      })();
    });
  }, [boot, setUser]);

  useEffect(() => {
    applyTheme(uiTheme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(useLibrary.getState().preferences.uiTheme);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [uiTheme]);

  if (!authReady || (signedIn && !ready)) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm tracking-[0.18em] text-muted">
        PAPER
      </div>
    );
  }

  if (isFirebaseConfigured() && !signedIn) return <LoginScreen />;
  if (!userId && isFirebaseConfigured()) return <LoginScreen />;
  return children;
}
