import type { Block, ImagePosition } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, ChevronUp, ChevronDown } from "lucide-react";

/** Editor for ONE content block. Pure UI: all changes go out through callbacks. */
export default function BlockEditorRow({
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
    pullquote: "Pull quote", ad: "Ad", sidebar: "Sidebar", brief: "Brief", divider: "Divider", "two-column": "Two Columns",
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
          <input type="file" accept="image/*"
            onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])}
            className="text-xs" data-testid={`input-imagefile-${block.id}`} />
          <Input value={block.caption}
            onChange={(e) => onChange({ caption: e.target.value })}
            placeholder="Caption" data-testid={`input-caption-${block.id}`} />
          {/* NEW: position selector */}
          <Select
            value={block.position ?? "inline"}
            onValueChange={(v) => onChange({ position: v as ImagePosition })}
          >
            <SelectTrigger className="h-8" data-testid={`select-imgpos-${block.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inline">Inline (default)</SelectItem>
              <SelectItem value="above-headline">Above headline (full width)</SelectItem>
              <SelectItem value="float-right">Float right (~40%)</SelectItem>
              <SelectItem value="float-left">Float left (~40%)</SelectItem>
            </SelectContent>
          </Select>
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Background color</Label>
              <input
                type="color"
                value={block.bgColor ?? "#ffffff"}
                onChange={(e) => onChange({ bgColor: e.target.value })}
                className="mt-1 h-8 w-full rounded border border-border bg-transparent"
                data-testid={`input-ad-bgcolor-${block.id}`}
              />
              <Label className="text-xs text-muted-foreground">Text color</Label>
              <input
                type="color"
                value={block.textColor ?? "#111111"}
                onChange={e => onChange({ textColor: e.target.value })}
                className="mt-1 h-8 w-full rounded border border-border bg-transparent"
                data-testid={`input-ad-textcolor-${block.id}`}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Background image</Label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => onChange({ bgImage: reader.result as string });
                  reader.readAsDataURL(file);
                }}
                className="text-xs mt-1"
                data-testid={`input-ad-bgimage-${block.id}`}
              />
            </div>
          </div>
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
      {block.type === "two-column" && (
        <div className="grid grid-cols-2 gap-3">
          {(["left", "right"] as const).map((side) => {
            const slot = block[side];
            return (
              <div key={side} className="space-y-2 border border-border p-2">
                <Label className="text-xs text-muted-foreground capitalize">{side} column</Label>
                <Select
                  value={slot.kind}
                  onValueChange={(v: "text" | "image") =>
                    onChange({
                      [side]: v === "image"
                        ? { kind: "image", src: "", caption: "" }
                        : { kind: "text", content: "" },
                    } as Partial<Block>)
                  }
                >
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                  </SelectContent>
                </Select>
                {slot.kind === "text" && (
                  <Textarea
                    value={slot.content}
                    rows={3}
                    onChange={(e) =>
                      onChange({ [side]: { ...slot, content: e.target.value } } as Partial<Block>)
                    }
                  />
                )}
                {slot.kind === "image" && (
                  <div className="space-y-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () =>
                          onChange({ [side]: { ...slot, src: reader.result as string } } as Partial<Block>);
                        reader.readAsDataURL(file);
                      }}
                      className="text-xs"
                    />
                    <Input
                      value={slot.caption}
                      placeholder="Caption"
                      onChange={(e) =>
                        onChange({ [side]: { ...slot, caption: e.target.value } } as Partial<Block>)
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
