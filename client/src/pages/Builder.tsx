import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import type { Branding, SheetSettings, Block, Screamsheet } from "@shared/schema";
import { getTemplate, starterBlocks, newBlock } from "@/lib/templates";
import { getGmKey } from "@/lib/gmKey";
import SheetRenderer from "@/components/SheetRenderer";
import AppShell from "@/components/AppShell";
import { exportPng, exportPdf } from "@/lib/exportSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Download, FileText, Save, Trash2, ChevronUp, ChevronDown, Link2,
  Image as ImageIcon, Type, Quote, Megaphone, PanelLeft, FileWarning, Copy, Heading,
} from "lucide-react";

const BLOCK_TYPES: { type: Block["type"]; label: string; icon: any }[] = [
  { type: "headline", label: "Headline", icon: Heading },
  { type: "byline", label: "Byline", icon: Type },
  { type: "paragraph", label: "Paragraph", icon: FileText },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "pullquote", label: "Pull quote", icon: Quote },
  { type: "ad", label: "Ad", icon: Megaphone },
  { type: "sidebar", label: "Sidebar", icon: PanelLeft },
  { type: "brief", label: "Brief", icon: FileWarning },
  { type: "divider", label: "Divider", icon: PanelLeft },
];

export default function Builder() {
  const params = useParams();
  const search = useSearch();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const tpl = getTemplate(params.template ?? "nct-tech");

  const [title, setTitle] = useState("Untitled Screamsheet");
  const [branding, setBranding] = useState<Branding>(tpl.branding);
  const [settings, setSettings] = useState<SheetSettings>(tpl.settings);
  const [blocks, setBlocks] = useState<Block[]>(starterBlocks());
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [categoryRaw, setCategoryRaw] = useState(
    tpl.settings.categories.join(", ")
  );
  // When set, we're editing an existing sheet in place (Save overwrites it).
  const [editingId, setEditingId] = useState<string | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);

  // Two ways to open an existing sheet:
  //   ?edit=ID -> edit in place (Save overwrites the same record)
  //   ?load=ID -> start from a copy (Save creates a brand-new record)
  // We read the query from BOTH the real search string and any query embedded
  // in the hash (e.g. #/build/nct-tech?edit=ID), since this app uses hash routing
  // and links may carry the param in either spot.
  const hashQuery = typeof window !== "undefined" ? window.location.hash.split("?")[1] ?? "" : "";
  const sp = new URLSearchParams(search || hashQuery);
  const editId = sp.get("edit");
  const loadId = sp.get("load");
  const sourceId = editId ?? loadId;
  useEffect(() => {
    let cancelled = false;
    if (sourceId) {
      Promise.resolve(
        getQueryFn<Screamsheet>({ on401: "throw" })({ queryKey: ["/api/screamsheets", sourceId] } as any),
      )
        .then((s) => {
          if (cancelled || !s) return;
          setTitle(editId ? s.title : s.title + " (copy)");
          setBranding(s.branding);
          setSettings(s.settings);
          setCategoryRaw(s.settings.categories.join(", "))
          setBlocks(s.blocks);
          setEditingId(editId ? sourceId : null);
        })
        .catch(() => {});
    } else {
      setBranding(tpl.branding);
      setSettings(tpl.settings);
      setCategoryRaw(tpl.settings.categories.join(", "))
      setBlocks(starterBlocks());
      setTitle(tpl.name === "Custom Outlet" ? "Untitled Screamsheet" : tpl.name);
      setEditingId(null);
    }
    setShareUrl(null);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.template, editId, loadId]);

  const isCustom = tpl.id === "custom";

  // --- block ops ---
  const updateBlock = (id: string, patch: Partial<Block>) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  const addBlock = (type: Block["type"]) => setBlocks((bs) => [...bs, newBlock(type)]);
  const removeBlock = (id: string) => setBlocks((bs) => bs.filter((b) => b.id !== id));
  const move = (id: string, dir: -1 | 1) =>
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= bs.length) return bs;
      const copy = [...bs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const onImageFile = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => updateBlock(id, { src: reader.result as string } as Partial<Block>);
    reader.readAsDataURL(file);
  };

  // --- save ---
  // mode "update": PUT over the existing record (same share link stays valid).
  // mode "create": POST a new record (fresh sheets and "Save as copy").
  const save = useMutation({
    mutationFn: async (mode: "update" | "create") => {
      const ownerKey = getGmKey();
      const payload = { title, template: tpl.id, branding, settings, blocks, ownerKey };
      if (mode === "update" && editingId) {
        const res = await apiRequest(
          "PUT",
          `/api/screamsheets/${editingId}?owner=${encodeURIComponent(ownerKey)}`,
          payload,
        );
        return { sheet: (await res.json()) as Screamsheet, mode };
      }
      const res = await apiRequest("POST", "/api/screamsheets", payload);
      return { sheet: (await res.json()) as Screamsheet, mode };
    },
    onSuccess: ({ sheet: s, mode }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/screamsheets"] });
      const url = `${window.location.origin}${window.location.pathname}#/s/${s.id}`;
      setShareUrl(url);
      // After a create, switch into edit mode on the new record so further
      // saves overwrite it instead of spawning more copies.
      if (mode === "create") setEditingId(s.id);
      const updated = mode === "update";
      const filed = getGmKey()
        ? updated
          ? "Changes saved. The same shareable link now shows your updates."
          : "Saved under your GM key. Shareable link is ready below."
        : "Saved. Tip: set a GM key on the home page first so this shows up in your private library. Shareable link is ready below.";
      toast({ title: updated ? "Updated" : "Saved", description: filed });
    },
    onError: () => toast({ title: "Save failed", description: "Could not save the screamsheet.", variant: "destructive" }),
  });

  const doExport = async (kind: "png" | "pdf") => {
    if (!sheetRef.current) return;
    setExporting(true);
    try {
      if (kind === "png") await exportPng(sheetRef.current, title);
      else await exportPdf(sheetRef.current, title);
    } catch (e) {
      toast({ title: "Export failed", description: String(e), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const copyLink = () => {
    if (shareUrl) {
      navigator.clipboard?.writeText(shareUrl);
      toast({ title: "Copied", description: "Share link copied to clipboard." });
    }
  };

  // Responsive preview scale: fit the 816px sheet to the preview pane width,
  // capped at 0.66 on wide screens so it never balloons.
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const previewInnerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.66);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const box = previewBoxRef.current;
    if (!box) return;
    const compute = () => {
      // account for the pane's padding (p-4 = 16px each side)
      const avail = Math.max(box.clientWidth - 32, 80);
      const next = Math.min(avail / 816, 0.66);
      setPreviewScale(next);
      const inner = previewInnerRef.current;
      if (inner) setPreviewHeight(inner.offsetHeight * next);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(box);
    if (previewInnerRef.current) ro.observe(previewInnerRef.current);
    return () => ro.disconnect();
  }, []);

  // keep height accurate as block content changes
  useEffect(() => {
    const inner = previewInnerRef.current;
    if (inner) setPreviewHeight(inner.offsetHeight * previewScale);
  }, [blocks, branding, settings, previewScale]);

  return (
    <AppShell
      actions={
        <>
          <Button size="sm" variant="outline" disabled={exporting} onClick={() => doExport("png")} data-testid="button-export-png">
            <Download className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">PNG</span>
          </Button>
          <Button size="sm" variant="outline" disabled={exporting} onClick={() => doExport("pdf")} data-testid="button-export-pdf">
            <FileText className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">PDF</span>
          </Button>
          {editingId && (
            <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate("create")} data-testid="button-save-copy">
              <Copy className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Save as copy</span>
            </Button>
          )}
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(editingId ? "update" : "create")} data-testid="button-save">
            <Save className="w-4 h-4 sm:mr-1" />{" "}
            <span className="hidden sm:inline">{save.isPending ? "Saving..." : editingId ? "Save changes" : "Save & share"}</span>
            <span className="sm:hidden">{save.isPending ? "..." : "Save"}</span>
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-6">
        {/* ---------------- FORM PANE ---------------- */}
        <div className="space-y-5">
          {editingId && (
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary border border-primary/40 bg-primary/5 px-3 py-2 hud-panel" data-testid="banner-editing">
              <Save className="w-3.5 h-3.5" /> Editing saved sheet — Save changes overwrites it
            </div>
          )}
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
                    onBlur= {() => {
                      const cats = categoryRaw
                        .split(",")
                        .map((s) => s.trim().toUpperCase())
                        .filter(Boolean)
                        .slice(0, 8);
                      setSettings({
                        ...settings,
                        categories: cats,
                        activeCategory: cats.includes(settings.activeCategory) ? settings.activeCategory : cats[0] ?? "",
                      });
                      setCategoryRaw(cats.join(", "));
                    }}
                    className="mt-1"
                    data-testid="input-categories"
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground">Breaking-news ticker (optional)</Label>
              <Input value={settings.ticker} onChange={(e) => setSettings({ ...settings, ticker: e.target.value })} className="mt-1" placeholder="Scrolling line under the masthead" data-testid="input-ticker" />
            </div>
          </fieldset>

          {/* Blocks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-widest text-primary font-semibold">Content blocks</h2>
              <span className="text-xs text-muted-foreground">{blocks.length} block{blocks.length === 1 ? "" : "s"}</span>
            </div>

            {blocks.map((b, i) => (
              <BlockEditor
                key={b.id}
                block={b} index={i} total={blocks.length}
                onChange={(patch) => updateBlock(b.id, patch)}
                onRemove={() => removeBlock(b.id)}
                onMove={(d) => move(b.id, d)}
                onImage={(f) => onImageFile(b.id, f)}
              />
            ))}

            <div className="border border-dashed border-border p-3 hud-panel">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1"><Plus className="w-3 h-3" /> Add block</div>
              <div className="flex flex-wrap gap-2">
                {BLOCK_TYPES.map((bt) => (
                  <Button key={bt.type} size="sm" variant="secondary" onClick={() => addBlock(bt.type)} data-testid={`button-add-${bt.type}`}>
                    <bt.icon className="w-3.5 h-3.5 mr-1" /> {bt.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {shareUrl && (
            <div className="border border-primary/40 bg-primary/5 p-3 hud-panel hud-brackets">
              <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-2 flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Shareable link</div>
              <div className="flex gap-2">
                <Input readOnly value={shareUrl} className="text-xs" data-testid="input-sharelink" />
                <Button size="icon" variant="outline" onClick={copyLink} data-testid="button-copy"><Copy className="w-4 h-4" /></Button>
              </div>
              <a href={shareUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-2 inline-block">Open the player view →</a>
            </div>
          )}
        </div>

        {/* ---------------- PREVIEW PANE ---------------- */}
        <div className="relative">
          <div className="lg:sticky lg:top-20">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Live preview</div>
            <div ref={previewBoxRef} className="border border-card-border bg-background hud-grid-field hud-panel overflow-auto p-4 max-h-[78vh] flex justify-center">
              <div style={{ width: 816 * previewScale, height: previewHeight ?? undefined, flexShrink: 0 }}>
                <div ref={previewInnerRef} style={{ transform: `scale(${previewScale})`, transformOrigin: "top left", width: 816 }}>
                  <SheetRenderer ref={sheetRef} branding={branding} settings={settings} blocks={blocks} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ---------- per-block editor ----------

function BlockEditor({
  block, index, total, onChange, onRemove, onMove, onImage,
}: {
  block: Block; index: number; total: number;
  onChange: (p: Partial<Block>) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
  onImage: (f: File) => void;
}) {
  const labelMap: Record<Block["type"], string> = {
    headline: "Headline", byline: "Byline", paragraph: "Paragraph", image: "Image",
    pullquote: "Pull quote", ad: "Ad", sidebar: "Sidebar", brief: "Brief", divider: "Divider",
  };
  return (
    <div className="border border-card-border bg-card p-3 hud-panel" data-testid={`block-${block.type}-${block.id}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labelMap[block.type]}</span>
        <div className="flex items-center gap-0.5">
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up" data-testid={`button-up-${block.id}`}><ChevronUp className="w-4 h-4" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move down" data-testid={`button-down-${block.id}`}><ChevronDown className="w-4 h-4" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onRemove} aria-label="Remove" data-testid={`button-remove-${block.id}`}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>

      {block.type === "headline" && (
        <div className="space-y-2">
          <Input value={block.text} onChange={(e) => onChange({ text: e.target.value })} data-testid={`input-headline-${block.id}`} />
          <Select value={block.size} onValueChange={(v) => onChange({ size: v as any })}>
            <SelectTrigger className="h-8" data-testid={`select-size-${block.id}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lead">Lead (large)</SelectItem>
              <SelectItem value="section">Section</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {block.type === "byline" && (
        <div className="grid grid-cols-2 gap-2">
          <Input value={block.author} onChange={(e) => onChange({ author: e.target.value })} placeholder="Author" data-testid={`input-author-${block.id}`} />
          <Input value={block.dateline} onChange={(e) => onChange({ dateline: e.target.value })} placeholder="Dateline" data-testid={`input-dateline-${block.id}`} />
        </div>
      )}
      {block.type === "paragraph" && (
        <Textarea value={block.text} onChange={(e) => onChange({ text: e.target.value })} rows={3} data-testid={`input-paragraph-${block.id}`} />
      )}
      {block.type === "image" && (
        <div className="space-y-2">
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])} className="text-xs" data-testid={`input-imagefile-${block.id}`} />
          <Input value={block.caption} onChange={(e) => onChange({ caption: e.target.value })} placeholder="Caption" data-testid={`input-caption-${block.id}`} />
        </div>
      )}
      {block.type === "pullquote" && (
        <div className="space-y-2">
          <Textarea value={block.text} onChange={(e) => onChange({ text: e.target.value })} rows={2} data-testid={`input-quote-${block.id}`} />
          <Input value={block.attribution} onChange={(e) => onChange({ attribution: e.target.value })} placeholder="Attribution" data-testid={`input-attr-${block.id}`} />
        </div>
      )}
      {block.type === "ad" && (
        <div className="space-y-2">
          <Input value={block.text} onChange={(e) => onChange({ text: e.target.value })} placeholder="Ad copy" data-testid={`input-ad-${block.id}`} />
          <Input value={block.sponsor} onChange={(e) => onChange({ sponsor: e.target.value })} placeholder="Sponsor" data-testid={`input-sponsor-${block.id}`} />
        </div>
      )}
      {(block.type === "sidebar" || block.type === "brief") && (
        <div className="space-y-2">
          <Input value={block.heading} onChange={(e) => onChange({ heading: e.target.value })} placeholder="Heading" data-testid={`input-heading-${block.id}`} />
          <Textarea value={block.text} onChange={(e) => onChange({ text: e.target.value })} rows={2} data-testid={`input-body-${block.id}`} />
        </div>
      )}
      {block.type === "divider" && (
        <div className="text-xs text-muted-foreground italic">Horizontal rule.</div>
      )}
    </div>
  );
}
