import type { Branding, SheetSettings } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

/** Sheet title + masthead/branding/settings form. Custom-outlet fields only show for the "custom" template. */
export default function SheetFormPanel({
  title, setTitle, branding, setBranding, settings, setSettings,
  categoryRaw, setCategoryRaw, commitCategories, isCustom,
}: {
  title: string;
  setTitle: (t: string) => void;
  branding: Branding;
  setBranding: (b: Branding) => void;
  settings: SheetSettings;
  setSettings: (s: SheetSettings) => void;
  categoryRaw: string;
  setCategoryRaw: (v: string) => void;
  commitCategories: () => void;
  isCustom: boolean;
}) {
  return (
    <>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Sheet title (private)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" data-testid="input-title" />
          </div>

          {/* Masthead / branding */}
          <fieldset className="border border-card-border bg-card p-4 space-y-3 hud-panel">
            <legend className="px-2 text-xs uppercase tracking-widest text-primary font-semibold">Masthead</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Clock</Label>
                <Input value={settings.clock} onChange={(e) => setSettings({ ...settings, clock: e.target.value })} className="mt-1" data-testid="input-clock" />
              </div>
              {settings.showNav && settings.categories.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Active desk (highlighted)</Label>
                  <Select value={settings.activeCategory} onValueChange={(v) => setSettings({ ...settings, activeCategory: v })}>
                    <SelectTrigger className="mt-1" data-testid="select-active"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {settings.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {isCustom && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Outlet name</Label>
                    <Input value={branding.outlet} onChange={(e) => setBranding({ ...branding, outlet: e.target.value })} className="mt-1" data-testid="input-outlet" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tagline</Label>
                    <Input value={branding.tagline} onChange={(e) => setBranding({ ...branding, tagline: e.target.value })} className="mt-1" data-testid="input-tagline" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Accent</Label>
                    <input type="color" value={branding.accent} onChange={(e) => setBranding({ ...branding, accent: e.target.value })} className="mt-1 h-9 w-full rounded border border-border bg-transparent" data-testid="input-accent" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Header bg</Label>
                    <input type="color" value={branding.headerBg} onChange={(e) => setBranding({ ...branding, headerBg: e.target.value })} className="mt-1 h-9 w-full rounded border border-border bg-transparent" data-testid="input-headerbg" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Header text</Label>
                    <input type="color" value={branding.headerText} onChange={(e) => setBranding({ ...branding, headerText: e.target.value })} className="mt-1 h-9 w-full rounded border border-border bg-transparent" data-testid="input-headertext" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Custom logo image (optional)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () =>
                            setBranding({
                              ...branding,
                              logoStyle: "custom-image",
                              logoSrc: reader.result as string,
                            });
                          reader.readAsDataURL(file);
                        }}
                        className="text-xs"
                        data-testid="input-logo-upload"
                      />
                      {branding.logoSrc && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setBranding({ ...branding, logoStyle: "text", logoSrc: "" })}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Show category nav</Label>
                  <Switch checked={settings.showNav} onCheckedChange={(v) => setSettings({ ...settings, showNav: v })} data-testid="switch-nav" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Category tabs (comma separated)</Label>
                  <Input
                    value={categoryRaw}
                    onChange={(e) => setCategoryRaw(e.target.value)}
                    onBlur={commitCategories}
                    className="mt-1"
                    data-testid="input-categories"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {settings.categories.length}/8 categories
                    {settings.categories.length >= 8 && (
                      <span className="text-destructive ml-2">Maximum reached</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground">Breaking-news ticker (optional)</Label>
              <Input value={settings.ticker} onChange={(e) => setSettings({ ...settings, ticker: e.target.value })} className="mt-1" placeholder="Scrolling line under the masthead" data-testid="input-ticker" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Body columns</Label>
              <Select value={String(settings.columns ?? 1)}
                onValueChange={(v) =>
                  setSettings({ ...settings, columns: Number(v) as 1 | 2 | 3})
                  }
              >
                <SelectTrigger className="mt-1" data-testid="select-columns">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Single Column</SelectItem>
                  <SelectItem value="2">Two columns</SelectItem>
                  <SelectItem value="3">Three columns</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </fieldset>
    </>
  );
}
