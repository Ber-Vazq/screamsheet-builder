import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Link2, Copy } from "lucide-react";

/** Banner shown while editing an existing saved sheet (Save overwrites it). */
export function EditingBanner({ editingId }: { editingId: string | null }) {
  if (!editingId) return null;
  return (
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary border border-primary/40 bg-primary/5 px-3 py-2 hud-panel" data-testid="banner-editing">
              <Save className="w-3.5 h-3.5" /> Editing saved sheet — Save changes overwrites it
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
