import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Link2, Copy, Check, AlertTriangle, Loader2, CircleDot, History, X } from "lucide-react";
import type { SaveStatusState } from "@/hooks/useSheetPersistence";
import type { Draft, DraftWriteResult } from "@/lib/drafts";

/** "just now", "3 min ago", "2 h ago", or a date. */
export function relativeTime(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(at).toLocaleDateString();
}

/** Re-render every 15 s so "saved 2 min ago" stays current. */
function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * Phase 6: one-line save state shown above the editor and preview.
 * new -> unsaved -> saving -> saved (or error with Retry).
 */
export function SaveStatusBar({
  status, autosaveEnabled, isEditing, hasGmKey, draftNote, onRetry,
}: {
  status: SaveStatusState;
  autosaveEnabled: boolean;
  isEditing: boolean;
  hasGmKey: boolean;
  draftNote: DraftWriteResult | null;
  onRetry: () => void;
}) {
  const now = useNow();
  let icon = <CircleDot className="w-3.5 h-3.5" />;
  let text = "Not saved yet";
  let tone = "text-muted-foreground border-card-border";
  switch (status.kind) {
    case "unsaved":
      icon = <CircleDot className="w-3.5 h-3.5" />;
      text = autosaveEnabled ? "Unsaved changes. Autosaving…" : "Unsaved changes";
      tone = "text-amber-600 dark:text-amber-400 border-amber-500/40";
      break;
    case "saving":
      icon = <Loader2 className="w-3.5 h-3.5 animate-spin" />;
      text = status.auto ? "Autosaving…" : "Saving…";
      tone = "text-primary border-primary/40";
      break;
    case "saved":
      icon = <Check className="w-3.5 h-3.5" />;
      text = status.at ? `All changes saved · ${relativeTime(status.at, now)}` : "All changes saved";
      tone = "text-emerald-600 dark:text-emerald-400 border-emerald-500/40";
      break;
    case "error":
      icon = <AlertTriangle className="w-3.5 h-3.5" />;
      text = `Save failed: ${status.message}`;
      tone = "text-destructive border-destructive/50";
      break;
  }
  const hint =
    status.kind === "error"
      ? "Your edits are kept on this device."
      : isEditing
        ? autosaveEnabled
          ? "Autosave on"
          : "Autosave off: set a GM key on the home page"
        : hasGmKey
          ? "Autosave starts after the first save"
          : "Set a GM key to enable autosave";
  const draftHint =
    draftNote === "stripped"
      ? " · Local backup saved without images (too large)"
      : draftNote === "too-large"
        ? " · Too large for a local backup"
        : "";
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-widest border px-3 py-2 hud-panel ${tone}`}
      data-testid="save-status"
      data-status={status.kind}
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-1.5 font-semibold" data-testid="save-status-text">{icon} {text}</span>
      <span className="text-muted-foreground normal-case tracking-normal" data-testid="save-status-hint">{hint}{draftHint}</span>
      {status.kind === "error" && (
        <Button size="sm" variant="outline" className="h-7 ml-auto" onClick={onRetry} data-testid="button-retry-save">
          Retry
        </Button>
      )}
    </div>
  );
}

/** Phase 6: offer to restore unsaved edits found on this device. */
export function DraftRestoreBanner({
  draft, onRestore, onDiscard,
}: {
  draft: Draft | null;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  if (!draft) return null;
  const when = new Date(draft.savedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="border border-amber-500/50 bg-amber-500/10 p-3 hud-panel" data-testid="banner-draft">
      <div className="flex items-start gap-2 text-sm">
        <History className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1">
          <div className="font-semibold">Unsaved edits found on this device</div>
          <div className="text-xs text-muted-foreground">
            From {when}: "{draft.sheet.title}".
            {draft.imagesStripped && " Images weren't kept in the backup and will need to be re-added."}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <Button size="sm" onClick={onRestore} data-testid="button-restore-draft">Restore edits</Button>
        <Button size="sm" variant="outline" onClick={onDiscard} data-testid="button-discard-draft">
          <X className="w-3.5 h-3.5 mr-1" /> Discard
        </Button>
      </div>
    </div>
  );
}

/** Banner shown while editing an existing saved sheet (Save overwrites it). */
export function EditingBanner({ editingId, noun = "sheet" }: { editingId: string | null; noun?: string }) {
  if (!editingId) return null;
  return (
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary border border-primary/40 bg-primary/5 px-3 py-2 hud-panel" data-testid="banner-editing">
              <Save className="w-3.5 h-3.5" /> Editing saved {noun} — changes update the same share link
            </div>
  );
}

/** Share link panel shown after a successful save. */
export function ShareLinkPanel({ shareUrl, onCopy }: { shareUrl: string | null; onCopy: () => void }) {
  if (!shareUrl) return null;
  return (
            <div className="border border-primary/40 bg-primary/5 p-3 hud-panel hud-brackets">
              <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-2 flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Shareable link</div>
              <div className="flex gap-2">
                <Input readOnly value={shareUrl} className="text-xs" data-testid="input-sharelink" />
                <Button size="icon" variant="outline" onClick={onCopy} data-testid="button-copy"><Copy className="w-4 h-4" /></Button>
              </div>
              <a href={shareUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-2 inline-block">Open the player view →</a>
            </div>
  );
}
