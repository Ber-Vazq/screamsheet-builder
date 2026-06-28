import { Link } from "wouter";
import { ReactNode } from "react";

export function BrandMark() {
  return (
    <Link href="/" data-testid="link-home">
      <a className="flex items-center gap-2 group">
        <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden className="shrink-0">
          <rect x="2" y="2" width="28" height="28" rx="3" fill="hsl(245 16% 12%)" stroke="hsl(320 90% 58%)" strokeWidth="2" />
          <path d="M9 22 L9 10 L16 18 L16 10" fill="none" stroke="hsl(188 90% 55%)" strokeWidth="2.5" strokeLinecap="square" />
          <path d="M19 10 h6 M22 10 v12" stroke="hsl(320 90% 58%)" strokeWidth="2.5" strokeLinecap="square" />
        </svg>
        <span className="font-bold tracking-widest text-sm uppercase" style={{ fontFamily: "'Orbitron',sans-serif" }}>
          Scream<span className="text-primary">sheet</span>
        </span>
      </a>
    </Link>
  );
}

export default function AppShell({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* subtle scanline / grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(188 90% 55%) 1px, transparent 1px), linear-gradient(90deg, hsl(320 90% 58%) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        aria-hidden
      />
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-4">
          <BrandMark />
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
