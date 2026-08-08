import { Link, useLocation } from "wouter";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Home as HomeIcon, FilePlus2 } from "lucide-react";

export function BrandMark() {
  return (
    <Link href="/" data-testid="link-home">
      <a className="flex items-center gap-2.5 group">
        {/* HUD reticle mark — monochrome line work on chrome */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          aria-hidden
          className="shrink-0"
        >
          <circle
            cx="16"
            cy="16"
            r="13"
            fill="none"
            stroke="hsl(210 20% 55%)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <circle
            cx="16"
            cy="16"
            r="9"
            fill="none"
            stroke="hsl(200 95% 80%)"
            strokeWidth="1.5"
          />
          <path
            d="M16 1 v5 M16 26 v5 M1 16 h5 M26 16 h5"
            stroke="hsl(200 95% 80%)"
            strokeWidth="1.5"
          />
          <path
            d="M11 19 L11 12 L16 17 L16 12"
            fill="none"
            stroke="hsl(210 30% 92%)"
            strokeWidth="2"
            strokeLinecap="square"
          />
          <path
            d="M18.5 12 h3.5 M20.25 12 v7"
            stroke="hsl(210 30% 92%)"
            strokeWidth="2"
            strokeLinecap="square"
          />
        </svg>
        <span
          className="font-bold tracking-[0.15em] sm:tracking-[0.2em] text-xs sm:text-sm uppercase text-foreground whitespace-nowrap"
          style={{ fontFamily: "'Orbitron',sans-serif" }}
        >
          Scream<span className="text-primary">sheet</span>
        </span>
      </a>
    </Link>
  );
}

// Persistent navigation so the generator is always one tap away — no relying on
// the logo or the browser back button. Hidden on its own page to avoid redundancy.
function NavActions() {
  const [location] = useLocation();
  const onHome = location === "/";
  const onBuilder = location.startsWith("/build");
  return (
    <>
      {!onHome && (
        <Link href="/" data-testid="link-nav-home">
          <a>
            <Button size="sm" variant="ghost" aria-label="Home">
              <HomeIcon className="w-4 h-4 sm:mr-1" />{" "}
              <span className="hidden sm:inline">Home</span>
            </Button>
          </a>
        </Link>
      )}
      {!onBuilder && (
        <Link href="/build" data-testid="link-nav-new">
          <a>
            <Button size="sm" variant="outline" aria-label="New sheet">
              <FilePlus2 className="w-4 h-4 sm:mr-1" />{" "}
              <span className="hidden sm:inline">New sheet</span>
            </Button>
          </a>
        </Link>
      )}
    </>
  );
}

// Persistent disclaimer + optional-support footer. Lives in the dark app chrome
// (outside <main> and never inside .screamsheet), so it is NOT part of the
// exported sheet. Carries RTG's required Homebrew Content Policy language.
function SiteFooter() {
  return (
    <footer
      className="site-footer relative z-10 mt-12 border-t border-border bg-background/60"
      data-testid="site-footer"
    >
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-3 text-center text-[11px] sm:text-xs leading-relaxed text-muted-foreground">
        <p>
          Screamsheet Generator is unofficial content provided under the
          Homebrew Content Policy of R. Talsorian Games and is not approved or
          endorsed by RTG. This content references materials that are the
          property of R. Talsorian Games and its licensees.
        </p>
        <p>
          This tool is free to use and will remain free for the community. If
          you&rsquo;d like to help cover domain, hosting or just want to
          support the project with an optional tip/contribution on{" "}
          <a
            href="https://ko-fi.com/stb3rn4rd"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
            data-testid="link-kofi"
          >
            Ko-fi
          </a>
          . Tips/Contributions do not unlock additional content, features, or
          access.
        </p>
        <p>
          All trademarks, product names, and setting elements are the property
          of their respective owners.
        </p>
        <script type='text/javascript' src='https://storage.ko-fi.com/cdn/widget/Widget_2.js'></script><script type='text/javascript'>kofiwidget2.init('Support me on Ko-fi', '#72a4f2', 'E7S322AW4K');kofiwidget2.draw();</script>
      </div>
    </footer>
  );
}

export default function AppShell({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* HUD wireframe grid field */}
      <div
        className="pointer-events-none fixed inset-0 hud-grid-field"
        aria-hidden
      />
      {/* corner radial glow */}
      <div
        className="pointer-events-none fixed inset-0 hud-radial"
        aria-hidden
      />
      {/* faint scanlines */}
      <div
        className="pointer-events-none fixed inset-0 hud-scanlines"
        aria-hidden
      />
      {/* decorative reticle dial, top-right */}
      <svg
        className="pointer-events-none fixed -right-24 -top-24 w-72 h-72 opacity-[0.10]"
        viewBox="0 0 200 200"
        aria-hidden
      >
        <g fill="none" stroke="hsl(200 95% 80%)" strokeWidth="1">
          <circle
            cx="100"
            cy="100"
            r="95"
            strokeDasharray="2 6"
            className="hud-spin"
            style={{ transformOrigin: "100px 100px" }}
          />
          <circle cx="100" cy="100" r="72" />
          <circle
            cx="100"
            cy="100"
            r="50"
            strokeDasharray="10 4"
            className="hud-spin-rev"
            style={{ transformOrigin: "100px 100px" }}
          />
          <path d="M100 5 v20 M100 175 v20 M5 100 h20 M175 100 h20" />
        </g>
      </svg>
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 h-14 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          <div className="min-w-0 shrink overflow-hidden">
            <BrandMark />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <NavActions />
            {actions}
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-7xl px-3 sm:px-4 py-8">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
