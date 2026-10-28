import type { EmailClientStyle, EmailThreadArtifact } from "@shared/artifact";
import { EMAIL_STYLES } from "@shared/artifact";
import type { EmailThreadState } from "@/hooks/useEmailThreadState";
import { EMAIL_STYLE_LABELS } from "@/lib/emailTemplates";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Phase 9: the "mail client" settings for a thread (look, mailbox, subject, banner). Pure UI. */
export default function EmailComposerPanel({ state }: { state: EmailThreadState }) {
  const t: EmailThreadArtifact = state.thread;
  return (
    <div className="space-y-5">
      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Thread title (private)</Label>
        <Input value={t.title} onChange={(e) => state.patch({ title: e.target.value })} className="mt-1" data-testid="input-title" />
      </div>
      <fieldset className="border border-card-border bg-card p-4 space-y-3 hud-panel" data-testid="email-settings">
        <legend className="px-2 text-xs uppercase tracking-widest text-primary font-semibold">Mail client</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Look</Label>
            <Select value={t.style} onValueChange={(v) => state.patch({ style: v as EmailClientStyle })}>
              <SelectTrigger className="mt-1" data-testid="select-style"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EMAIL_STYLES.map((s) => (
                  <SelectItem key={s} value={s} data-testid={`option-style-${s}`}>{EMAIL_STYLE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Accent color</Label>
            <div className="flex gap-2 mt-1">
              <input
                type="color" value={t.accent} onChange={(e) => state.patch({ accent: e.target.value })}
                aria-label="Accent color" className="h-9 w-10 rounded border border-border bg-transparent shrink-0" data-testid="input-accent"
              />
              <Input value={t.accent} onChange={(e) => state.patch({ accent: e.target.value })} aria-label="Accent hex" className="font-mono text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Client name</Label>
            <Input value={t.clientName} placeholder="e.g. SECURE MAIL" onChange={(e) => state.patch({ clientName: e.target.value })} className="mt-1" data-testid="input-client-name" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Whose inbox</Label>
            <Input value={t.mailbox} placeholder="name@corp.nc" onChange={(e) => state.patch({ mailbox: e.target.value })} className="mt-1" data-testid="input-mailbox" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Thread subject</Label>
          <Input value={t.subject} onChange={(e) => state.patch({ subject: e.target.value })} className="mt-1" data-testid="input-subject" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Banner (optional)</Label>
          <Input value={t.classification} placeholder="e.g. CONFIDENTIAL — INTERNAL USE ONLY" onChange={(e) => state.patch({ classification: e.target.value })} className="mt-1" data-testid="input-classification" />
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <Label htmlFor="switch-attribution" className="text-xs text-muted-foreground">Show "Made with Screamsheet Builder" credit</Label>
          <Switch id="switch-attribution" checked={t.showAttribution === true} onCheckedChange={(v) => state.patch({ showAttribution: v })} data-testid="switch-attribution" />
        </div>
      </fieldset>
    </div>
  );
}
