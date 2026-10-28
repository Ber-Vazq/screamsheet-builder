import type React from "react";
import type { Block } from "@shared/schema";
import { Button } from "@/components/ui/button";
import BlockEditorRow from "./BlockEditorRow";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  blocks, onUpdate, onAdd, onRemove, onMove, onReorder, onImage,
}: {
  blocks: Block[];
  onUpdate: (id: string, patch: Partial<Block>) => void;
  onAdd: (type: Block["type"]) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onReorder: (activeId: string, overId: string) => void;
  onImage: (id: string, file: File) => void;
}) {
  // Phase 7: drag by the grip handle (mouse, touch, or keyboard: focus the grip,
  // Space to pick up, arrows to move, Space to drop). Up/down buttons stay.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) onReorder(String(e.active.id), String(e.over.id));
  };
  return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-widest text-primary font-semibold">Content blocks</h2>
              <span className="text-xs text-muted-foreground">{blocks.length} block{blocks.length === 1 ? "" : "s"}</span>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}
              accessibility={{
                announcements: {
                  onDragStart: ({ active }) => `Picked up block ${indexOf(blocks, active.id) + 1}.`,
                  onDragOver: ({ over }) => (over ? `Over position ${indexOf(blocks, over.id) + 1} of ${blocks.length}.` : "Not over a block."),
                  onDragEnd: ({ over }) => (over ? `Dropped at position ${indexOf(blocks, over.id) + 1}.` : "Dropped."),
                  onDragCancel: () => "Move cancelled.",
                },
              }}
            >
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3" data-testid="block-list">
                  {blocks.map((b, i) => (
                    <SortableBlock key={b.id} id={b.id}>
                      {(handle) => (
                        <BlockEditorRow
                          block={b} index={i} total={blocks.length}
                          dragHandle={handle}
                          onChange={(patch) => onUpdate(b.id, patch)}
                          onRemove={() => onRemove(b.id)}
                          onMove={(d) => onMove(b.id, d)}
                          onImage={(f) => onImage(b.id, f)}
                        />
                      )}
                    </SortableBlock>
                  ))}
                </div>
              </SortableContext>
            </DndContext>

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

function indexOf(blocks: Block[], id: string | number) {
  return blocks.findIndex((b) => b.id === id);
}

export type DragHandleProps = {
  ref: (el: HTMLElement | null) => void;
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
  isDragging: boolean;
};

function SortableBlock({ id, children }: { id: string; children: (h: DragHandleProps) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 20 : undefined,
      }}
      className={isDragging ? "opacity-90 shadow-[0_0_0_1px_hsl(var(--primary)),0_12px_32px_rgba(0,0,0,0.5)]" : undefined}
      data-dragging={isDragging || undefined}
    >
      {children({ ref: setActivatorNodeRef, attributes: attributes as unknown as Record<string, unknown>, listeners, isDragging })}
    </div>
  );
}
