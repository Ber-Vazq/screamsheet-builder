import { useState } from "react";
import { useParams, useSearch } from "wouter";
import AppShell from "@/components/AppShell";
import { getTextTemplate } from "@/lib/textTemplates";
import { useTextThreadState } from "@/hooks/useTextThreadState";
import { useArtifactPersistence, readSourceParams, type PersistenceAdapter } from "@/hooks/useArtifactPersistence";
import { useSheetExport } from "@/hooks/useSheetExport";
import { textThreadContentHash } from "@/lib/sheetSnapshot";
import type { TextThreadArtifact } from "@shared/artifact";
import BuilderToolbar from "@/components/builder/BuilderToolbar";
import { EditingBanner, ShareLinkPanel, SaveStatusBar, DraftRestoreBanner } from "@/components/builder/SaveStatus";
import TextThreadEditor from "@/components/text/TextThreadEditor";
import TextThreadRenderer, { PHONE_WIDTH } from "@/components/text/TextThreadRenderer";
import { ConfirmFlash, useConfirmFlash } from "@/components/ConfirmFlash";
import { ParodyDisclaimer } from "@/components/Disclaimer";
import { Pencil, Eye } from "lucide-react";

type MobileTab = "edit" | "preview";

/**
 * Phase 8: builder for fake text-message threads. Same layout and save
 * behavior as the sheet builder (status bar, autosave, drafts, share link).
 */
export default function TextBuilder() {
  const params = useParams();
  const search = useSearch();
  const tpl = getTextTemplate(params.template);
  const { editId, loadId } = readSourceParams(search);

  const state = useTextThreadState(tpl);
  const { thread } = state;
  const { flash, show } = useConfirmFlash();
  const adapter: PersistenceAdapter<TextThreadArtifact> = {
    templateId: tpl.id,
    expectedType: "textThread",
    noun: "thread",
    current: thread,
    load: state.loadArtifact,
    reset: () => state.resetToTemplate(tpl),
    hash: textThreadContentHash,
  };
  const persistence = useArtifactPersistence({
    adapter, editId, loadId,
    onSaved: (mode) => show(mode === "create" ? "Link ready" : "Changes saved", mode === "create" ? "Share it with your players" : "Same link, new content"),
  });
  const exporter = useSheetExport(thread.title, (kind) => show(kind === "png" ? "PNG exported" : "PDF exported", "Check your downloads"));
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
      <div className="space-y-3 mb-4" data-testid="text-builder">
        <SaveStatusBar
          status={persistence.status}
          autosaveEnabled={persistence.autosaveEnabled}
          isEditing={!!persistence.editingId}
          hasGmKey={persistence.hasGmKey}
          draftNote={persistence.draftNote}
          onRetry={persistence.retry}
        />
        <DraftRestoreBanner draft={persistence.draftOffer} onRestore={persistence.restoreDraft} onDiscard={persistence.discardDraft} />
        <div className="flex lg:hidden" role="tablist" aria-label="Builder view" data-testid="mobile-tabs">
          {tabBtn("edit", "Edit", Pencil)}
          {tabBtn("preview", "Preview", Eye)}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
        <div className={`space-y-5 ${tab === "edit" ? "" : "hidden lg:block"}`} data-testid="pane-edit">
          <EditingBanner editingId={persistence.editingId} noun="thread" />
          <TextThreadEditor state={state} />
          <ShareLinkPanel shareUrl={persistence.shareUrl} onCopy={persistence.copyLink} />
        </div>
        <div
          data-testid="pane-preview"
          className={tab === "preview" ? "" : "max-lg:fixed max-lg:top-0 max-lg:-left-[10000px] max-lg:w-[390px] max-lg:pointer-events-none"}
        >
          <div className="lg:sticky lg:top-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Preview</div>
            <div className="flex justify-center overflow-x-auto">
              <div style={{ width: PHONE_WIDTH }} className="shrink-0 shadow-[0_0_0_1px_hsl(var(--border)),0_18px_48px_rgba(0,0,0,0.45)]">
                <TextThreadRenderer thread={thread} ref={exporter.sheetRef} />
              </div>
            </div>
            <ParodyDisclaimer compact className="mt-3" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
