import { Link } from "wouter";
import { ReactNode } from "react";

export function BrandMark() {
  return (
    <Link href="/" data-testid="link-home">
      <a className="flex items-center gap-2.5 group">
        {/* HUD reticle mark — monochrome line work on chrome */}
        <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden className="shrink-0">
          <circle cx="16" cy="16" r="13" fill="none" stroke="hsl(210 20% 55%)" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="16" cy="16" r="9" fill="none" stroke="hsl(200 95% 80%)" strokeWidth="1.5" />
          <path d="M16 1 v5 M16 26 v5 M1 16 h5 M26 16 h5" stroke="hsl(200 95% 80%)" strokeWidth="1.5" />
          <path d="M11 19 L11 12 L16 17 L16 12" fill="none" stroke="hsl(210 30% 92%)" strokeWidth="2" strokeLinecap="square" />
          <path d="M18.5 12 h3.5 M20.25 12 v7" stroke="hsl(210 30% 92%)" strokeWidth="2" strokeLinecap="square" />
        </svg>
        <span className="font-bold tracking-[0.2em] text-sm uppercase text-foreground" style={{ fontFamily: "'Orbitron',sans-serif" }}>
          Scream<span className="text-primary">sheet</span>
        </span>
      </a>
    </Link>
  );
}

export default function AppShell({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* HUD wireframe grid field */}
      <div className="pointer-events-none fixed inset-0 hud-grid-field" aria-hidden />
      {/* corner radial glow */}
      <div className="pointer-events-none fixed inset-0 hud-radial" aria-hidden />
      {/* faint scanlines */}
      <div className="pointer-events-none fixed inset-0 hud-scanlines" aria-hidden />
      {/* decorative reticle dial, top-right */}
      <svg
        className="pointer-events-none fixed -right-24 -top-24 w-72 h-72 opacity-[0.10]"
        viewBox="0 0 200 200"
        aria-hidden
      >
        <g fill="none" stroke="hsl(200 95% 80%)" strokeWidth="1">
          <circle cx="100" cy="100" r="95" strokeDasharray="2 6" className="hud-spin" style={{ transformOrigin: "100px 100px" }} />
          <circle cx="100" cy="100" r="72" />
          <circle cx="100" cy="100" r="50" strokeDasharray="10 4" className="hud-spin-rev" style={{ transformOrigin: "100px 100px" }} />
          <path d="M100 5 v20 M100 175 v20 M5 100 h20 M175 100 h20" />
        </g>
      </svg>
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
