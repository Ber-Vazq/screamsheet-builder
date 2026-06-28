import { useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Screamsheet } from "@shared/schema";
import SheetRenderer from "@/components/SheetRenderer";
import { exportPng, exportPdf } from "@/lib/exportSheet";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/AppShell";
import { Download, FileText, ArrowLeft } from "lucide-react";

export default function ViewSheet() {
  const params = useParams();
  const id = params.id!;
  const ref = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

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
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-4">
          <BrandMark />
          {sheet && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={exporting} onClick={() => doExport("png")} data-testid="button-view-png">
                <Download className="w-4 h-4 mr-1" /> PNG
              </Button>
              <Button size="sm" variant="outline" disabled={exporting} onClick={() => doExport("pdf")} data-testid="button-view-pdf">
                <FileText className="w-4 h-4 mr-1" /> PDF
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {isLoading && <div className="text-center text-muted-foreground py-20">Decrypting transmission…</div>}
        {isError && (
          <div className="text-center py-20">
            <p className="text-muted-foreground">This screamsheet could not be found. It may have been deleted.</p>
            <Link href="/"><a><Button className="mt-4" variant="outline"><ArrowLeft className="w-4 h-4 mr-1" /> Back to terminal</Button></a></Link>
          </div>
        )}
        {sheet && (
          <div className="flex justify-center overflow-auto">
            <div className="shadow-2xl shadow-black/60">
              <SheetRenderer ref={ref} branding={sheet.branding} settings={sheet.settings} blocks={sheet.blocks} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
