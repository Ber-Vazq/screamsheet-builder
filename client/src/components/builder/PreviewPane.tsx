import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { SheetArtifact } from "@shared/artifact";
import { fitToLetter, LETTER } from "@shared/pdfLayout";
import SheetRenderer from "@/components/SheetRenderer";
import { Monitor, Printer } from "lucide-react";

const SHEET_WIDTH = 816;
const MAX_SCALE = 0.66;
/** Print preview page width cap, in CSS px. */
const MAX_PAGE_PX = 540;

export type PreviewMode = "screen" | "print";

/**
 * Live preview. Fits the fixed 816px sheet to the pane width (capped at 0.66).
 * sheetRef points at the UNSCALED sheet node so exports stay full resolution.
 *
 * Phase 7: "Print" mode shows the sheet on a US Letter page exactly as the PDF
 * export places it (shared/pdfLayout.ts): full width from the top, or shrunk
 * to fit one page when it is too tall. Only the wrapper transforms change, so
 * the same SheetRenderer (and sheetRef) is used in both modes.
 */
export default function PreviewPane({
  sheet,
  sheetRef,
}: {
  sheet: SheetArtifact;
  sheetRef: RefObject<HTMLDivElement>;
}) {
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const previewInnerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<PreviewMode>("screen");
  const [boxWidth, setBoxWidth] = useState(0);
  const [sheetPx, setSheetPx] = useState(0); // unscaled sheet height

  useLayoutEffect(() => {
    const box = previewBoxRef.current;
    if (!box) return;
    const compute = () => {
      setBoxWidth(box.clientWidth);
      const inner = previewInnerRef.current;
      if (inner) setSheetPx(inner.offsetHeight);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(box);
    if (previewInnerRef.current) ro.observe(previewInnerRef.current);
    return () => ro.disconnect();
  }, []);

  // keep height accurate as content changes
  useEffect(() => {
    const inner = previewInnerRef.current;
    if (inner) setSheetPx(inner.offsetHeight);
  }, [sheet.blocks, sheet.branding, sheet.settings, mode]);

  // account for the pane's padding (p-4 = 16px each side)
  const avail = Math.max(boxWidth - 32, 80);

  // --- screen mode ---
  const screenScale = Math.min(avail / SHEET_WIDTH, MAX_SCALE);

  // --- print mode ---
  const fit = fitToLetter(SHEET_WIDTH, sheetPx || SHEET_WIDTH);
  const pagePx = Math.min(avail, MAX_PAGE_PX);
  const ptToPx = pagePx / LETTER.width;
  const printScale = (fit.w * ptToPx) / SHEET_WIDTH;

  const scale = mode === "print" ? printScale : screenScale;
  const outerW = mode === "print" ? pagePx : SHEET_WIDTH * screenScale;
  const outerH = mode === "print" ? LETTER.height * ptToPx : sheetPx * screenScale || undefined;
  const offsetX = mode === "print" ? fit.x * ptToPx : 0;
  const pct = Math.round(fit.widthFraction * 100);

  const modeBtn = (m: PreviewMode, label: string, Icon: typeof Monitor) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      aria-pressed={mode === m}
      data-testid={`preview-mode-${m}`}
      className={`flex items-center gap-1 px-2 py-1 text-[11px] uppercase tracking-widest border transition-colors ${
        mode === m ? "border-primary text-primary bg-primary/10" : "border-card-border text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="w-3 h-3" /> {label}
    </button>
  );

  return (
    <div className="relative">
      <div className="lg:sticky lg:top-20">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            {mode === "print" ? "Print preview · US Letter" : "Live preview"}
          </div>
          <div className="flex gap-1" role="group" aria-label="Preview mode">
            {modeBtn("screen", "Screen", Monitor)}
            {modeBtn("print", "Print", Printer)}
          </div>
        </div>
        <div
          ref={previewBoxRef}
          data-testid="preview-box"
          data-mode={mode}
          className={`border border-card-border hud-panel overflow-auto p-4 max-h-[78vh] flex justify-center ${
            mode === "print" ? "bg-neutral-500/40" : "bg-background hud-grid-field"
          }`}
        >
          <div
            data-testid={mode === "print" ? "print-page" : undefined}
            className={mode === "print" ? "bg-white shadow-[0_6px_24px_rgba(0,0,0,0.45)] relative overflow-hidden" : undefined}
            style={{ width: outerW, height: outerH, flexShrink: 0 }}
          >
            <div style={{ position: mode === "print" ? "absolute" : undefined, left: offsetX, top: 0 }}>
              <div ref={previewInnerRef} style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: SHEET_WIDTH }}>
                <SheetRenderer ref={sheetRef} branding={sheet.branding} settings={sheet.settings} blocks={sheet.blocks} />
              </div>
            </div>
          </div>
        </div>
        {mode === "print" && (
          <p className="text-[11px] text-muted-foreground mt-2" data-testid="print-note" data-shrunk={fit.shrunk}>
            {fit.shrunk
              ? `Taller than one page: the PDF shrinks it to ${pct}% width so it fits on a single Letter page. Trim content to print larger.`
              : "Fits on one Letter page at full width. The PDF matches this page; PNG exports are the sheet alone."}
          </p>
        )}
      </div>
    </div>
  );
}
