import type React from "react";
import type { TextMessage, TextPlatform, TextThreadArtifact } from "@shared/artifact";
import { TEXT_PLATFORMS } from "@shared/artifact";
import { MAX_MESSAGES, MAX_PARTICIPANTS } from "@shared/threadCodec";
import type { TextThreadState } from "@/hooks/useTextThreadState";
import { PLATFORM_LABELS } from "@/lib/textTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, Copy, GripVertical, Info, Plus, Trash2, UserPlus } from "lucide-react";
import type { DragHandleProps } from "@/components/builder/BlockListEditor";

const STATUS_OPTIONS: { value: TextMessage["status"]; label: string }[] = [
  { value: "none", label: "No status" },
  { value: "sent", label: "Sent" },
  { value: "delivered", label: "Delivered" },
  { value: "read", label: "Read" },
  { value: "failed", label: "Not delivered" },
];

/** Thread settings, participants, and the ordered message list. Pure UI. */
export default function TextThreadEditor({ state }: { state: TextThreadState }) {
  const t = state.thread;
  return (
    <div className="space-y-5">
      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Thread title (private)</Label>
        <Input value={t.title} onChange={(e) => state.patch({ title: e.target.value })} className="mt-1" data-testid="input-title" />
      </div>
      <SettingsPanel t={t} state={state} />
      <ParticipantsPanel t={t} state={state} />
      <MessagesPanel t={t} state={state} />
    </div>
  );
}

function SettingsPanel({ t, state }: { t: TextThreadArtifact; state: TextThreadState }) {
  return (
    <fieldset className="border border-card-border bg-card p-4 space-y-3 hud-panel">
      <legend className="px-2 text-xs uppercase tracking-widest text-primary font-semibold">Phone screen</legend>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Style</Label>
          <Select value={t.platform} onValueChange={(v) => state.patch({ platform: v as TextPlatform })}>
            <SelectTrigger className="mt-1" data-testid="select-platform"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TEXT_PLATFORMS.map((p) => (
                <SelectItem key={p} value={p} data-testid={`option-platform-${p}`}>{PLATFORM_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Clock</Label>
          <Input value={t.clock} onChange={(e) => state.patch({ clock: e.target.value })} className="mt-1" data-testid="input-clock" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Header name</Label>
          <Input value={t.headerTitle} placeholder="Contact or group name" onChange={(e) => state.patch({ headerTitle: e.target.value })} className="mt-1" data-testid="input-header-title" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Header subtitle</Label>
          <Input value={t.headerSubtitle} placeholder="e.g. last seen 2 min ago" onChange={(e) => state.patch({ headerSubtitle: e.target.value })} className="mt-1" data-testid="input-header-subtitle" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 pt-1">
        <Label htmlFor="switch-attribution" className="text-xs text-muted-foreground">Show "Made with Screamsheet Builder" credit</Label>
        <Switch id="switch-attribution" checked={t.showAttribution === true} onCheckedChange={(v) => state.patch({ showAttribution: v })} data-testid="switch-attribution" />
      </div>
    </fieldset>
  );
}

function ParticipantsPanel({ t, state }: { t: TextThreadArtifact; state: TextThreadState }) {
  return (
    <fieldset className="border border-card-border bg-card p-4 space-y-3 hud-panel" data-testid="participants">
      <legend className="px-2 text-xs uppercase tracking-widest text-primary font-semibold">People</legend>
      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Pick whose phone this is. Their messages sit on the right.
      </p>
      <div className="space-y-2" role="radiogroup" aria-label="Phone owner">
        {t.participants.map((p) => (
          <div key={p.id} className="flex items-center gap-2" data-testid={`participant-${p.id}`}>
            <input
              type="radio"
              name="phone-owner"
              checked={t.selfId === p.id}
              onChange={() => state.patch({ selfId: p.id })}
              aria-label={`${p.name || "This person"} owns the phone`}
              className="accent-[hsl(var(--primary))] h-4 w-4 shrink-0"
              data-testid={`radio-self-${p.id}`}
            />
            <input
              type="color"
              value={p.color}
              onChange={(e) => state.updateParticipant(p.id, { color: e.target.value })}
              aria-label={`${p.name} color`}
              className="h-9 w-10 rounded border border-border bg-transparent shrink-0"
              data-testid={`color-participant-${p.id}`}
            />
            <Input value={p.name} onChange={(e) => state.updateParticipant(p.id, { name: e.target.value })} data-testid={`input-participant-${p.id}`} />
            <Button
              size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0"
              disabled={t.participants.length <= 1}
              onClick={() => {
                const count = t.messages.filter((m) => m.from === p.id && m.kind !== "system").length;
                if (count === 0 || window.confirm(`Remove ${p.name || "this person"} and their ${count} message${count === 1 ? "" : "s"}?`)) {
                  state.removeParticipant(p.id);
                }
              }}
              aria-label={`Remove ${p.name}`}
              data-testid={`button-remove-participant-${p.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="secondary" onClick={state.addParticipant} disabled={t.participants.length >= MAX_PARTICIPANTS} data-testid="button-add-participant">
        <UserPlus className="w-3.5 h-3.5 mr-1" /> Add person
      </Button>
    </fieldset>
  );
}

function MessagesPanel({ t, state }: { t: TextThreadArtifact; state: TextThreadState }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) state.reorderMessage(String(e.active.id), String(e.over.id));
  };
  const idx = (id: string | number) => t.messages.findIndex((m) => m.id === id) + 1;
  const full = t.messages.length >= MAX_MESSAGES;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-primary font-semibold">Messages</h2>
        <span className="text-xs text-muted-foreground" data-testid="message-count">{t.messages.length} message{t.messages.length === 1 ? "" : "s"}</span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Picked up message ${idx(active.id)}.`,
            onDragOver: ({ over }) => (over ? `Over position ${idx(over.id)} of ${t.messages.length}.` : "Not over a message."),
            onDragEnd: ({ over }) => (over ? `Dropped at position ${idx(over.id)}.` : "Dropped."),
            onDragCancel: () => "Move cancelled.",
          },
        }}
      >
        <SortableContext items={t.messages.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2" data-testid="message-list">
            {t.messages.map((m, i) => (
              <SortableRow key={m.id} id={m.id}>
                {(handle) => <MessageRow t={t} m={m} index={i} state={state} handle={handle} />}
              </SortableRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="border border-dashed border-border p-3 hud-panel">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1"><Plus className="w-3 h-3" /> Add message from</div>
        <div className="flex flex-wrap gap-2">
          {t.participants.map((p) => (
            <Button key={p.id} size="sm" variant="secondary" disabled={full} onClick={() => state.addMessage(p.id)} data-testid={`button-add-msg-${p.id}`}>
              <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: p.color }} />
              {p.name || "Unnamed"}{p.id === t.selfId ? " (phone owner)" : ""}
            </Button>
          ))}
          <Button size="sm" variant="outline" disabled={full} onClick={() => state.addMessage("", "system")} data-testid="button-add-msg-system">
            System note
          </Button>
        </div>
        {full && <p className="text-xs text-muted-foreground mt-2">That's the limit ({MAX_MESSAGES} messages).</p>}
      </div>
    </div>
  );
}

function MessageRow({
  t, m, index, state, handle,
}: { t: TextThreadArtifact; m: TextMessage; index: number; state: TextThreadState; handle: DragHandleProps }) {
  const isSelf = m.kind !== "system" && m.from === t.selfId;
  const sender = t.participants.find((p) => p.id === m.from);
  return (
    <div className="border border-card-border bg-card p-3 hud-panel space-y-2" data-testid={`msg-${m.id}`} data-msg-id={m.id}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            ref={handle.ref}
            {...handle.attributes}
            {...handle.listeners}
            className={`h-7 w-6 -ml-1 flex items-center justify-center text-muted-foreground hover:text-primary touch-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary ${handle.isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            aria-label={`Drag to reorder message ${index + 1}`}
            data-testid={`drag-${m.id}`}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          {m.kind === "system" ? (
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">System note</span>
          ) : (
            <Select value={m.from} onValueChange={(v) => state.updateMessage(m.id, { from: v })}>
              <SelectTrigger className="h-7 text-xs w-auto min-w-[8rem]" data-testid={`select-from-${m.id}`}>
                <span className="inline-block w-2 h-2 rounded-full mr-1.5 shrink-0" style={{ background: sender?.color ?? "#888" }} />
                <SelectValue placeholder="Who sent it?" />
              </SelectTrigger>
              <SelectContent>
                {t.participants.map((p) => <SelectItem key={p.id} value={p.id}>{p.name || "Unnamed"}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => state.moveMessage(m.id, -1)} aria-label="Move up" data-testid={`button-up-${m.id}`}><ChevronUp className="w-4 h-4" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === t.messages.length - 1} onClick={() => state.moveMessage(m.id, 1)} aria-label="Move down" data-testid={`button-down-${m.id}`}><ChevronDown className="w-4 h-4" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => state.duplicateMessage(m.id)} aria-label="Duplicate" data-testid={`button-dup-${m.id}`}><Copy className="w-3.5 h-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => state.removeMessage(m.id)} aria-label="Remove" data-testid={`button-remove-${m.id}`}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>

      {m.kind === "image" ? (
        <div className="flex items-center gap-2">
          <input
            type="file" accept="image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) state.setMessageImage(m.id, f); }}
            className="text-xs" data-testid={`input-image-${m.id}`}
          />
          {m.imageSrc && <img src={m.imageSrc} alt="" className="h-10 w-10 object-cover border border-border" />}
        </div>
      ) : (
        <Textarea
          value={m.body}
          rows={2}
          placeholder={m.kind === "system" ? "e.g. Dee changed the group name" : "Message text"}
          onChange={(e) => state.updateMessage(m.id, { body: e.target.value })}
          data-testid={`input-body-${m.id}`}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <Input
          value={m.sentAt}
          placeholder="Time (optional)"
          onChange={(e) => state.updateMessage(m.id, { sentAt: e.target.value })}
          className="h-8 text-xs"
          data-testid={`input-time-${m.id}`}
        />
        {m.kind !== "system" && (
          <div className="flex gap-2">
            <Select value={m.kind} onValueChange={(v) => state.updateMessage(m.id, { kind: v as TextMessage["kind"] })}>
              <SelectTrigger className="h-8 text-xs" data-testid={`select-kind-${m.id}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="image">Image</SelectItem>
              </SelectContent>
            </Select>
            {isSelf && (
              <Select value={m.status} onValueChange={(v) => state.updateMessage(m.id, { status: v as TextMessage["status"] })}>
                <SelectTrigger className="h-8 text-xs" data-testid={`select-status-${m.id}`} aria-label="Delivery status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SortableRow({ id, children }: { id: string; children: (h: DragHandleProps) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, position: "relative", zIndex: isDragging ? 20 : undefined }}
      className={isDragging ? "opacity-90 shadow-[0_0_0_1px_hsl(var(--primary)),0_12px_32px_rgba(0,0,0,0.5)]" : undefined}
      data-dragging={isDragging || undefined}
    >
      {children({ ref: setActivatorNodeRef, attributes: attributes as unknown as Record<string, unknown>, listeners, isDragging })}
    </div>
  );
}
