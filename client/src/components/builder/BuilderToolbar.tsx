import { Button } from "@/components/ui/button";
import { Download, FileText, Save, Copy } from "lucide-react";
import type { ExportKind } from "@/hooks/useSheetExport";
import type { SaveMode } from "@/hooks/useSheetPersistence";

/** Export + save buttons rendered in the AppShell header. */
export default function BuilderToolbar({
  exporting, onExport, isSaving, isEditing, onSave,
}: {
  exporting: boolean;
  onExport: (kind: ExportKind) => void;
  isSaving: boolean;
  isEditing: boolean;
  onSave: (mode: SaveMode) => void;
}) {
  return (
    <>
      <Button size="sm" variant="outline" disabled={exporting} onClick={() => onExport("png")} data-testid="button-export-png">
        <Download className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">PNG</span>
      </Button>
      <Button size="sm" variant="outline" disabled={exporting} onClick={() => onExport("pdf")} data-testid="button-export-pdf">
        <FileText className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">PDF</span>
      </Button>
      {isEditing && (
        <Button size="sm" variant="outline" disabled={isSaving} onClick={() => onSave("create")} data-testid="button-save-copy">
          <Copy className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Save as copy</span>
        </Button>
      )}
      <Button size="sm" disabled={isSaving} onClick={() => onSave(isEditing ? "update" : "create")} data-testid="button-save">
        <Save className="w-4 h-4 sm:mr-1" />{" "}
        <span className="hidden sm:inline">{isSaving ? "Saving..." : isEditing ? "Save changes" : "Save & share"}</span>
        <span className="sm:hidden">{isSaving ? "..." : "Save"}</span>
      </Button>
    </>
  );
}
