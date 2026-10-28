import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { SheetArtifact } from "@shared/artifact";
import SheetRenderer from "@/components/SheetRenderer";

const SHEET_WIDTH = 816;
const MAX_SCALE = 0.66;

/**
 * Live preview. Fits the fixed 816px sheet to the pane width (capped at 0.66).
 * sheetRef points at the UNSCALED sheet node so exports stay full resolution.
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
  const [previewScale, setPreviewScale] = useState(MAX_SCALE);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const box = previewBoxRef.current;
    if (!box) return;
    const compute = () => {
      // account for the pane's padding (p-4 = 16px each side)
      const avail = Math.max(box.clientWidth - 32, 80);
      const next = Math.min(avail / SHEET_WIDTH, MAX_SCALE);
      setPreviewScale(next);
      const inner = previewInnerRef.current;
      if (inner) setPreviewHeight(inner.offsetHeight * next);
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
    if (inner) setPreviewHeight(inner.offsetHeight * previewScale);
  }, [sheet.blocks, sheet.branding, sheet.settings, previewScale]);

  return (
    <div className="relative">
      <div className="lg:sticky lg:top-20">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Live preview</div>
        <div ref={previewBoxRef} className="border border-card-border bg-background hud-grid-field hud-panel overflow-auto p-4 max-h-[78vh] flex justify-center">
          <div style={{ width: SHEET_WIDTH * previewScale, height: previewHeight ?? undefined, flexShrink: 0 }}>
            <div ref={previewInnerRef} style={{ transform: `scale(${previewScale})`, transformOrigin: "top left", width: SHEET_WIDTH }}>
              <SheetRenderer ref={sheetRef} branding={sheet.branding} settings={sheet.settings} blocks={sheet.blocks} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
