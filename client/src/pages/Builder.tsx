import { useState } from "react";
import { useParams, useSearch } from "wouter";
import { getTemplate } from "@/lib/templates";
import AppShell from "@/components/AppShell";
import { useSheetState } from "@/hooks/useSheetState";
import { useSheetPersistence, readSourceParams } from "@/hooks/useSheetPersistence";
import { useSheetExport } from "@/hooks/useSheetExport";
import BuilderToolbar from "@/components/builder/BuilderToolbar";
import SheetFormPanel from "@/components/builder/SheetFormPanel";
import BlockListEditor from "@/components/builder/BlockListEditor";
import PreviewPane from "@/components/builder/PreviewPane";
import { EditingBanner, ShareLinkPanel, SaveStatusBar, DraftRestoreBanner } from "@/components/builder/SaveStatus";
import { Pencil, Eye } from "lucide-react";
import { ConfirmFlash, useConfirmFlash } from "@/components/ConfirmFlash";
import { ParodyDisclaimer } from "@/components/Disclaimer";

type MobileTab = "edit" | "preview";

/**
 * Orchestration only: wires the three hooks to the builder components.
 *   useSheetState       -> the SheetArtifact being edited (no I/O)
 *   useSheetPersistence -> load, save, autosave, local drafts
 *   useSheetExport      -> PNG / PDF from the rendered sheet
 * Below `lg`, an Edit / Preview toggle shows one column at a time. The preview
 * stays mounted (moved off-screen) so PNG/PDF export works from either tab.
 */
export default function Builder() {
  const params = useParams();
  const search = useSearch();
  const tpl = getTemplate(params.template ?? "nct-tech");
  const { editId, loadId } = readSourceParams(search);

  const state = useSheetState(tpl);
  const { sheet } = state;
  const { flash, show } = useConfirmFlash();
  const persistence = useSheetPersistence({
    tpl, editId, loadId, state,
    onSaved: (mode) => show(mode === "create" ? "Link ready" : "Changes saved", mode === "create" ? "Share it with your players" : "Same link, new content"),
  });
  const exporter = useSheetExport(sheet.title, (kind) => show(kind === "png" ? "PNG exported" : "PDF exported", "Check your downloads"));
  const [tab, setTab] = useState<MobileTab>("edit");

  const tabBtn = (t: MobileTab, label: string, Icon: typeof Pencil) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      data-testid={`tab-${t}`}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs uppercase tracking-widest font-semibold border transition-colors ${
        tab === t ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-card-border"
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  return (
    <AppShell
      actions={
        <BuilderToolbar
          exporting={exporter.exporting}
          onExport={exporter.doExport}
          isSaving={persistence.isSaving}
          isEditing={!!persistence.editingId}
          onSave={persistence.save}
        />
      }
    >
      <ConfirmFlash flash={flash} />
      <div className="space-y-3 mb-4">
        <SaveStatusBar
          status={persistence.status}
          autosaveEnabled={persistence.autosaveEnabled}
          isEditing={!!persistence.editingId}
          hasGmKey={persistence.hasGmKey}
          draftNote={persistence.draftNote}
          onRetry={persistence.retry}
        />
        <DraftRestoreBanner
          draft={persistence.draftOffer}
          onRestore={persistence.restoreDraft}
          onDiscard={persistence.discardDraft}
        />
        <div className="flex lg:hidden" role="tablist" aria-label="Builder view" data-testid="mobile-tabs">
          {tabBtn("edit", "Edit", Pencil)}
          {tabBtn("preview", "Preview", Eye)}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-6">
        <div className={`space-y-5 ${tab === "edit" ? "" : "hidden lg:block"}`} data-testid="pane-edit">
          <EditingBanner editingId={persistence.editingId} />
          <SheetFormPanel
            title={sheet.title}
            setTitle={state.setTitle}
            branding={sheet.branding}
            setBranding={state.setBranding}
            settings={sheet.settings}
            setSettings={state.setSettings}
            categoryRaw={state.categoryRaw}
            setCategoryRaw={state.setCategoryRaw}
            commitCategories={state.commitCategories}
            isCustom={tpl.id === "custom"}
          />
          <BlockListEditor
            blocks={sheet.blocks}
            onUpdate={state.updateBlock}
            onAdd={state.addBlock}
            onRemove={state.removeBlock}
            onMove={state.moveBlock}
            onReorder={state.reorderBlock}
            onImage={state.setBlockImage}
          />
          <ShareLinkPanel shareUrl={persistence.shareUrl} onCopy={persistence.copyLink} />
        </div>
        <div
          data-testid="pane-preview"
          className={tab === "preview" ? "" : "max-lg:fixed max-lg:top-0 max-lg:-left-[10000px] max-lg:w-[390px] max-lg:pointer-events-none"}
        >
          <PreviewPane sheet={sheet} sheetRef={exporter.sheetRef} />
          <ParodyDisclaimer compact className="mt-3" />
        </div>
      </div>
    </AppShell>
  );
}
