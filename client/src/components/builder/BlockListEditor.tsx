import type { Block } from "@shared/schema";
import { Button } from "@/components/ui/button";
import BlockEditorRow from "./BlockEditorRow";
import {
  Plus, FileText, Image as ImageIcon, Type, Quote, Megaphone, PanelLeft, FileWarning, Heading,
  type LucideIcon,
} from "lucide-react";

const BLOCK_TYPES: { type: Block["type"]; label: string; icon: LucideIcon }[] = [
  { type: "headline", label: "Headline", icon: Heading },
  { type: "byline", label: "Byline", icon: Type },
  { type: "paragraph", label: "Paragraph", icon: FileText },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "pullquote", label: "Pull quote", icon: Quote },
  { type: "ad", label: "Ad", icon: Megaphone },
  { type: "sidebar", label: "Sidebar", icon: PanelLeft },
  { type: "brief", label: "Brief", icon: FileWarning },
  { type: "divider", label: "Divider", icon: PanelLeft },
  { type: "two-column", label: "Two columns", icon: PanelLeft },
];

/** The ordered list of block editors plus the "Add block" palette. */
export default function BlockListEditor({
  blocks, onUpdate, onAdd, onRemove, onMove, onImage,
}: {
  blocks: Block[];
  onUpdate: (id: string, patch: Partial<Block>) => void;
  onAdd: (type: Block["type"]) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onImage: (id: string, file: File) => void;
}) {
  return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-widest text-primary font-semibold">Content blocks</h2>
              <span className="text-xs text-muted-foreground">{blocks.length} block{blocks.length === 1 ? "" : "s"}</span>
            </div>

            {blocks.map((b, i) => (
              <BlockEditorRow
                key={b.id}
                block={b} index={i} total={blocks.length}
                onChange={(patch) => onUpdate(b.id, patch)}
                onRemove={() => onRemove(b.id)}
                onMove={(d) => onMove(b.id, d)}
                onImage={(f) => onImage(b.id, f)}
              />
            ))}

            <div className="border border-dashed border-border p-3 hud-panel">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1"><Plus className="w-3 h-3" /> Add block</div>
              <div className="flex flex-wrap gap-2">
                {BLOCK_TYPES.map((bt) => (
                  <Button key={bt.type} size="sm" variant="secondary" onClick={() => onAdd(bt.type)} data-testid={`button-add-${bt.type}`}>
                    <bt.icon className="w-3.5 h-3.5 mr-1" /> {bt.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
  );
}
