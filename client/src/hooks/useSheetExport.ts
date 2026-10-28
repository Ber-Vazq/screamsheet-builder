import { useRef, useState } from "react";
import { exportPng, exportPdf } from "@/lib/exportSheet";
import { useToast } from "@/hooks/use-toast";

export type ExportKind = "png" | "pdf";

/** Holds the ref to the rendered sheet DOM node and runs PNG/PDF export. */
export function useSheetExport(title: string, onDone?: (kind: ExportKind) => void) {
  const { toast } = useToast();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const doExport = async (kind: ExportKind) => {
    if (!sheetRef.current) return;
    setExporting(true);
    try {
      if (kind === "png") await exportPng(sheetRef.current, title);
      else await exportPdf(sheetRef.current, title);
      onDone?.(kind);
    } catch (e) {
      toast({ title: "Export failed", description: String(e), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return { sheetRef, exporting, doExport };
}
