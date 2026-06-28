import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Screamsheet } from "@shared/schema";
import SheetRenderer from "@/components/SheetRenderer";
import { exportPng, exportPdf } from "@/lib/exportSheet";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/AppShell";
import { Download, FileText, ArrowLeft } from "lucide-react";

const SHEET_WIDTH = 816;

export default function ViewSheet() {
  const params = useParams();
  const id = params.id!;
  const ref = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // Responsive scaling: the exported sheet is a fixed 816px-wide "page".
  // On narrow screens we scale it down to fit the available width so the
  // shareable link is fully readable on mobile without horizontal scroll.
  const fitRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState<number | null>(null);

  const { data: sheet, isLoading, isError } = useQuery<Screamsheet>({
    queryKey: ["/api/screamsheets", id],
  });

  const doExport = async (kind: "png" | "pdf") => {
    if (!ref.current || !sheet) return;
    setExporting(true);
    try {
      if (kind === "png") await exportPng(ref.current, sheet.title);
      else await exportPdf(ref.current, sheet.title);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* HUD wireframe field */}
      <div className="pointer-events-none fixed inset-0 hud-grid-field" aria-hidden />
      <div className="pointer-events-none fixed inset-0 hud-radial" aria-hidden />
      <div className="pointer-events-none fixed inset-0 hud-scanlines" aria-hidden />
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

      <main className="relative z-10 mx-auto max-w-5xl px-3 sm:px-4 py-8">
        {isLoading && <div className="text-center text-muted-foreground py-20">Decrypting transmission…</div>}
        {isError && (
          <div className="text-center py-20">
            <p className="text-muted-foreground">This screamsheet could not be found. It may have been deleted.</p>
            <Link href="/"><a><Button className="mt-4" variant="outline"><ArrowLeft className="w-4 h-4 mr-1" /> Back to terminal</Button></a></Link>
          </div>
        )}
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
