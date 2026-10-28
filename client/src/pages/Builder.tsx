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
import { EditingBanner, ShareLinkPanel } from "@/components/builder/SaveStatus";

/**
 * Orchestration only: wires the three hooks to the builder components.
 *   useSheetState       -> the SheetArtifact being edited (no I/O)
 *   useSheetPersistence -> load (?edit= / ?load=) and save (POST / PUT)
 *   useSheetExport      -> PNG / PDF from the rendered sheet
 */
export default function Builder() {
  const params = useParams();
  const search = useSearch();
  const tpl = getTemplate(params.template ?? "nct-tech");
  const { editId, loadId } = readSourceParams(search);

  const state = useSheetState(tpl);
  const { sheet } = state;
  const persistence = useSheetPersistence({ tpl, editId, loadId, state });
  const exporter = useSheetExport(sheet.title);

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
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-6">
        <div className="space-y-5">
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
            onImage={state.setBlockImage}
          />
          <ShareLinkPanel shareUrl={persistence.shareUrl} onCopy={persistence.copyLink} />
        </div>
        <PreviewPane sheet={sheet} sheetRef={exporter.sheetRef} />
      </div>
    </AppShell>
  );
}
