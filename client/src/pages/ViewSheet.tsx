import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Artifact, SheetArtifact } from "@shared/artifact";
import SheetRenderer from "@/components/SheetRenderer";
import { exportPng, exportPdf } from "@/lib/exportSheet";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/AppShell";
import { Download, FileText, ArrowLeft, RotateCw } from "lucide-react";
import { classifyLoadError, type LoadErrorKind } from "@/lib/loadError";
import { ParodyDisclaimer, MadeWithLink } from "@/components/Disclaimer";
import { ConfirmFlash, useConfirmFlash } from "@/components/ConfirmFlash";

const SHEET_WIDTH = 816;

type ViewState =
  | { kind: "loading" }
  | { kind: "ready"; sheet: SheetArtifact }
  | { kind: "error"; reason: LoadErrorKind | "unsupported" };

export default function ViewSheet() {
  const params = useParams();
  const id = params.id!;
  const ref = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const { flash, show } = useConfirmFlash();

  // Responsive scaling: the exported sheet is a fixed 816px-wide "page".
  // On narrow screens we scale it down to fit the available width so the
  // shareable link is fully readable on mobile without horizontal scroll.
  const fitRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState<number | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery<Artifact>({
    queryKey: ["/api/screamsheets", id],
  });

  // Phase 7: loading / not found / unreadable / offline are separate states.
  const view: ViewState = isLoading
    ? { kind: "loading" }
    : error
      ? { kind: "error", reason: classifyLoadError(error) }
      : data && data.type === "sheet"
        ? { kind: "ready", sheet: data }
        : { kind: "error", reason: data ? "unsupported" : "notfound" };
  const sheet = view.kind === "ready" ? view.sheet : null;

  useEffect(() => {
    if (sheet) document.title = `${sheet.branding.outlet || "Screamsheet"} // Screamsheet`;
  }, [sheet]);

  const doExport = async (kind: "png" | "pdf") => {
    if (!ref.current || !sheet) return;
    setExporting(true);
    try {
      if (kind === "png") await exportPng(ref.current, sheet.title);
      else await exportPdf(ref.current, sheet.title);
      show(kind === "png" ? "PNG exported" : "PDF exported", "Check your downloads");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative flex flex-col">
      {/* HUD wireframe field */}
      <div className="pointer-events-none fixed inset-0 hud-grid-field" aria-hidden />
      <div className="pointer-events-none fixed inset-0 hud-radial" aria-hidden />
      <div className="pointer-events-none fixed inset-0 hud-scanlines" aria-hidden />
      <ConfirmFlash flash={flash} />
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto max-w-5xl px-3 sm:px-4 h-14 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          <div className="min-w-0 overflow-hidden"><BrandMark /></div>
          {sheet && (
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" disabled={exporting} onClick={() => doExport("png")} data-testid="button-view-png">
                <Download className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">PNG</span>
              </Button>
              <Button size="sm" variant="outline" disabled={exporting} onClick={() => doExport("pdf")} data-testid="button-view-pdf">
                <FileText className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">PDF</span>
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl px-3 sm:px-4 py-8 flex-1" data-testid="view-main" data-state={view.kind === "error" ? view.reason : view.kind}>
        {view.kind === "loading" && <LoadingState />}
        {view.kind === "error" && <ErrorState reason={view.reason} retrying={isFetching} onRetry={() => refetch()} />}
        {sheet && (
          <SheetFit
            fitRef={fitRef}
            scale={scale}
            setScale={setScale}
            sheetHeight={sheetHeight}
            setSheetHeight={setSheetHeight}
          >
            <div className="shadow-2xl shadow-black/60">
              <SheetRenderer ref={ref} branding={sheet.branding} settings={sheet.settings} blocks={sheet.blocks} />
            </div>
          </SheetFit>
        )}
      </main>

      <footer className="relative z-10 border-t border-border/60 bg-background/70 backdrop-blur" data-testid="view-footer">
        <div className="mx-auto max-w-3xl px-4 py-4 flex flex-col items-center gap-2 text-center">
          <ParodyDisclaimer className="justify-center text-left sm:text-center" />
          <MadeWithLink />
        </div>
      </footer>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-4 py-16" data-testid="view-loading" role="status" aria-live="polite">
      <div className="text-xs uppercase tracking-[0.35em] text-primary animate-pulse" style={{ fontFamily: "'Share Tech Mono',monospace" }}>
        Decrypting transmission…
      </div>
      {/* page-shaped skeleton so the layout doesn't jump when the sheet arrives */}
      <div className="w-full max-w-[816px] aspect-[8.5/11] border border-card-border bg-card/40 hud-panel animate-pulse" />
    </div>
  );
}

const ERROR_COPY: Record<LoadErrorKind | "unsupported", { code: string; title: string; body: string; retry: boolean }> = {
  notfound: {
    code: "404 // SIGNAL LOST",
    title: "This screamsheet doesn't exist",
    body: "The link may be mistyped, or the GM deleted this sheet. Ask them for a fresh link.",
    retry: false,
  },
  unreadable: {
    code: "500 // CORRUPTED FEED",
    title: "This screamsheet couldn't be read",
    body: "The server had trouble opening it. Try again in a moment. If it keeps happening, let the GM know.",
    retry: true,
  },
  network: {
    code: "NO CARRIER",
    title: "Can't reach the server",
    body: "Check your connection, then try again.",
    retry: true,
  },
  unsupported: {
    code: "UNKNOWN FORMAT",
    title: "This link needs a newer version of the app",
    body: "Reload the page to get the latest version.",
    retry: true,
  },
};

function ErrorState({ reason, retrying, onRetry }: { reason: LoadErrorKind | "unsupported"; retrying: boolean; onRetry: () => void }) {
  const c = ERROR_COPY[reason];
  return (
    <div className="max-w-lg mx-auto text-center py-16 border border-card-border bg-card/50 hud-panel hud-brackets px-6" data-testid={`view-error-${reason}`} role="alert">
      <div className="text-xs tracking-[0.35em] text-destructive mb-3" style={{ fontFamily: "'Share Tech Mono',monospace" }}>{c.code}</div>
      <h1 className="text-lg font-bold uppercase tracking-wide" style={{ fontFamily: "'Orbitron',sans-serif" }}>{c.title}</h1>
      <p className="text-sm text-muted-foreground mt-2">{c.body}</p>
      <div className="flex justify-center gap-2 mt-5">
        {c.retry && (
          <Button variant="default" disabled={retrying} onClick={onRetry} data-testid="button-view-retry">
            <RotateCw className={`w-4 h-4 mr-1 ${retrying ? "animate-spin" : ""}`} /> Try again
          </Button>
        )}
        <Link href="/"><a><Button variant="outline" data-testid="button-view-home"><ArrowLeft className="w-4 h-4 mr-1" /> Back to terminal</Button></a></Link>
      </div>
    </div>
  );
}

// Scales a fixed 816px sheet down to fit the container width on small screens.
// Uses transform: scale (keeps the export ref at native resolution) plus a
// height-collapsing wrapper so scaled content doesn't leave dead space.
function SheetFit({
  children, fitRef, scale, setScale, sheetHeight, setSheetHeight,
}: {
  children: React.ReactNode;
  fitRef: React.RefObject<HTMLDivElement>;
  scale: number;
  setScale: (n: number) => void;
  sheetHeight: number | null;
  setSheetHeight: (n: number | null) => void;
}) {
  const outerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const compute = () => {
      const avail = outer.clientWidth;
      const next = avail >= SHEET_WIDTH ? 1 : Math.max(avail / SHEET_WIDTH, 0.1);
      setScale(next);
      const inner = fitRef.current;
      if (inner) setSheetHeight(inner.offsetHeight * next);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(outer);
    if (fitRef.current) ro.observe(fitRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute after fonts/images settle so the height wrapper stays accurate.
  useEffect(() => {
    const t = setTimeout(() => {
      const inner = fitRef.current;
      if (inner) setSheetHeight(inner.offsetHeight * scale);
    }, 400);
    return () => clearTimeout(t);
  }, [scale, fitRef, setSheetHeight]);

  return (
    <div ref={outerRef} className="flex justify-center">
      <div style={{ width: SHEET_WIDTH * scale, height: sheetHeight ?? undefined }}>
        <div ref={fitRef} style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: SHEET_WIDTH }}>
          {children}
        </div>
      </div>
    </div>
  );
}
