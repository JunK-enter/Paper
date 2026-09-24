"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Library, Quote, Settings, Upload } from "lucide-react";

const items = [
  { href: "/", label: "서재", icon: Library },
  { href: "/now", label: "읽는 중", icon: BookOpen },
  { href: "/quotes", label: "문장", icon: Quote },
  { href: "/books/new", label: "올리기", icon: Upload },
  { href: "/settings", label: "설정", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reading = pathname.includes("/read");
  if (reading) return <>{children}</>;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper px-5 py-8 lg:flex">
        <Link href="/" className="px-2">
          <p className="font-serif text-[1.35rem] tracking-[0.22em]">PAPER</p>
          <p className="mt-1 text-xs text-muted">당신의 서재</p>
        </Link>
        <nav className="mt-10 flex flex-col gap-1" aria-label="주요">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${active ? "bg-[var(--accent-soft)] text-ink" : "text-muted hover:text-ink"}`}
              >
                <Icon size={18} strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">
        <div className="nav-safe">{children}</div>
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur-sm lg:hidden"
          style={{ viewTransitionName: "paper-nav", paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-label="주요"
        >
          <ul className="grid grid-cols-5">
            {items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] ${active ? "text-accent" : "text-muted"}`}
                  >
                    <Icon size={20} strokeWidth={1.5} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
