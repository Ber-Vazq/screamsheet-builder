import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useSearch } from "wouter";
import AppShell from "@/components/AppShell";
import { getEmailTemplate } from "@/lib/emailTemplates";
import { useEmailThreadState } from "@/hooks/useEmailThreadState";
import { useArtifactPersistence, readSourceParams, type PersistenceAdapter } from "@/hooks/useArtifactPersistence";
import { useSheetExport } from "@/hooks/useSheetExport";
import { emailThreadContentHash } from "@/lib/sheetSnapshot";
import type { EmailThreadArtifact } from "@shared/artifact";
import BuilderToolbar from "@/components/builder/BuilderToolbar";
import { EditingBanner, ShareLinkPanel, SaveStatusBar, DraftRestoreBanner } from "@/components/builder/SaveStatus";
import EmailComposerPanel from "@/components/email/EmailComposerPanel";
import QuotedThreadEditor from "@/components/email/QuotedThreadEditor";
import EmailThreadRenderer, { EMAIL_WIDTH } from "@/components/email/EmailThreadRenderer";
import { ConfirmFlash, useConfirmFlash } from "@/components/ConfirmFlash";
import { ParodyDisclaimer } from "@/components/Disclaimer";
import { Pencil, Eye } from "lucide-react";

type MobileTab = "edit" | "preview";

/**
 * Phase 9: builder for fake email threads. Same layout and save behavior as
 * the sheet and text builders (status bar, autosave, drafts, share link).
 */
export default function EmailBuilder() {
  const params = useParams();
  const search = useSearch();
  const tpl = getEmailTemplate(params.template);
  const { editId, loadId } = readSourceParams(search);

  const state = useEmailThreadState(tpl);
  const { thread } = state;
  const { flash, show } = useConfirmFlash();
  const adapter: PersistenceAdapter<EmailThreadArtifact> = {
    templateId: tpl.id,
    expectedType: "emailThread",
    noun: "thread",
    current: thread,
    load: state.loadArtifact,
    reset: () => state.resetToTemplate(tpl),
    hash: emailThreadContentHash,
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
      <div className="space-y-3 mb-4" data-testid="email-builder">
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
          <EmailComposerPanel state={state} />
          <QuotedThreadEditor state={state} />
          <ShareLinkPanel shareUrl={persistence.shareUrl} onCopy={persistence.copyLink} />
        </div>
        <div
          data-testid="pane-preview"
          className={tab === "preview" ? "" : "max-lg:fixed max-lg:top-0 max-lg:-left-[10000px] max-lg:w-[390px] max-lg:pointer-events-none"}
        >
          <div className="lg:sticky lg:top-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Preview</div>
            <FitWidth width={EMAIL_WIDTH}>
              <div className="shadow-[0_0_0_1px_hsl(var(--border)),0_18px_48px_rgba(0,0,0,0.45)]">
                <EmailThreadRenderer thread={thread} ref={exporter.sheetRef} />
              </div>
            </FitWidth>
            <ParodyDisclaimer compact className="mt-3" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/**
 * Shrinks a fixed-width child to fit the pane (never enlarges). The export ref
 * points at the unscaled renderer inside, so PNG/PDF stay full resolution.
 */
function FitWidth({ width, children }: { width: number; children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [h, setH] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return;
    const compute = () => {
      const s = Math.min(1, Math.max(box.clientWidth, 80) / width);
      setScale(s);
      setH(inner.offsetHeight * s);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(box);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={boxRef} className="w-full" data-testid="email-preview-fit" data-scale={scale.toFixed(3)}>
      <div style={{ width: width * scale, height: h, margin: "0 auto" }}>
        <div ref={innerRef} style={{ width, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
      </div>
    </div>
  );
}
