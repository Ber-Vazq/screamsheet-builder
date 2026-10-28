import { useEffect, useState } from "react";
import type React from "react";
import type { EmailMessage, EmailThreadArtifact } from "@shared/artifact";
import { MAX_MESSAGES } from "@shared/threadCodec";
import type { EmailThreadState } from "@/hooks/useEmailThreadState";
import { parseAddressList } from "@/lib/emailTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, Copy, GripVertical, MailPlus, Quote, Reply, Trash2 } from "lucide-react";
import type { DragHandleProps } from "@/components/builder/BlockListEditor";

/**
 * A text box for a list value (addresses, attachment names). Keeps what the
 * user typed (so a trailing comma doesn't vanish mid-typing) and only resyncs
 * when the list changes from outside.
 */
function ListInput({
  value, onChange, split, join, multiline, ...rest
}: {
  value: string[];
  onChange: (v: string[]) => void;
  split: (s: string) => string[];
  join: string;
  multiline?: boolean;
} & Record<string, unknown>) {
  const [text, setText] = useState(value.join(join));
  useEffect(() => {
    if (JSON.stringify(split(text)) !== JSON.stringify(value)) setText(value.join(join));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const handle = (s: string) => { setText(s); onChange(split(s)); };
  return multiline ? (
    <Textarea value={text} rows={2} onChange={(e) => handle(e.target.value)} {...rest} />
  ) : (
    <Input value={text} onChange={(e) => handle(e.target.value)} {...rest} />
  );
}

const splitLines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

/** Phase 9: the ordered list of emails in the thread, each with its own header, body, quote and attachments. */
export default function QuotedThreadEditor({ state }: { state: EmailThreadState }) {
  const t = state.thread;
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
        <h2 className="text-xs uppercase tracking-widest text-primary font-semibold">Emails (oldest first)</h2>
        <span className="text-xs text-muted-foreground" data-testid="message-count">{t.messages.length} email{t.messages.length === 1 ? "" : "s"}</span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Picked up email ${idx(active.id)}.`,
            onDragOver: ({ over }) => (over ? `Over position ${idx(over.id)} of ${t.messages.length}.` : "Not over an email."),
            onDragEnd: ({ over }) => (over ? `Dropped at position ${idx(over.id)}.` : "Dropped."),
            onDragCancel: () => "Move cancelled.",
          },
        }}
      >
        <SortableContext items={t.messages.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2" data-testid="message-list">
            {t.messages.map((m, i) => (
              <SortableRow key={m.id} id={m.id}>
                {(handle) => <EmailRow t={t} m={m} index={i} state={state} handle={handle} />}
              </SortableRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="border border-dashed border-border p-3 hud-panel flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={full || t.messages.length === 0} onClick={() => state.addMessage("reply")} data-testid="button-add-reply">
          <Reply className="w-3.5 h-3.5 mr-1" /> Add reply
        </Button>
        <Button size="sm" variant="outline" disabled={full} onClick={() => state.addMessage("blank")} data-testid="button-add-email">
          <MailPlus className="w-3.5 h-3.5 mr-1" /> Add blank email
        </Button>
        {full && <p className="text-xs text-muted-foreground w-full">That's the limit ({MAX_MESSAGES} emails).</p>}
      </div>
    </div>
  );
}

function EmailRow({
  t, m, index, state, handle,
}: { t: EmailThreadArtifact; m: EmailMessage; index: number; state: EmailThreadState; handle: DragHandleProps }) {
  const up = (p: Partial<EmailMessage>) => state.updateMessage(m.id, p);
  const small = "h-8 text-xs";
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
            aria-label={`Drag to reorder email ${index + 1}`}
            data-testid={`drag-${m.id}`}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
            Email {index + 1}{m.fromName ? ` · ${m.fromName}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => state.moveMessage(m.id, -1)} aria-label="Move up" data-testid={`button-up-${m.id}`}><ChevronUp className="w-4 h-4" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === t.messages.length - 1} onClick={() => state.moveMessage(m.id, 1)} aria-label="Move down" data-testid={`button-down-${m.id}`}><ChevronDown className="w-4 h-4" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => state.duplicateMessage(m.id)} aria-label="Duplicate" data-testid={`button-dup-${m.id}`}><Copy className="w-3.5 h-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => state.removeMessage(m.id)} aria-label="Remove" data-testid={`button-remove-${m.id}`}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input value={m.fromName} placeholder="From (name)" onChange={(e) => up({ fromName: e.target.value })} className={small} aria-label="From name" data-testid={`input-from-name-${m.id}`} />
        <Input value={m.fromAddress} placeholder="From (address)" onChange={(e) => up({ fromAddress: e.target.value })} className={small} aria-label="From address" data-testid={`input-from-addr-${m.id}`} />
        <ListInput value={m.to} onChange={(v) => up({ to: v })} split={parseAddressList} join=", " placeholder="To (comma separated)" className={small} aria-label="To" data-testid={`input-to-${m.id}`} />
        <ListInput value={m.cc} onChange={(v) => up({ cc: v })} split={parseAddressList} join=", " placeholder="Cc (optional)" className={small} aria-label="Cc" data-testid={`input-cc-${m.id}`} />
        <Input value={m.subject} placeholder="Subject" onChange={(e) => up({ subject: e.target.value })} className={small} aria-label="Subject" data-testid={`input-msg-subject-${m.id}`} />
        <Input value={m.sentAt} placeholder="Time (e.g. Mon 08:00)" onChange={(e) => up({ sentAt: e.target.value })} className={small} aria-label="Time" data-testid={`input-time-${m.id}`} />
      </div>

      <Textarea value={m.body} rows={4} placeholder="Email body" onChange={(e) => up({ body: e.target.value })} aria-label="Body" data-testid={`input-body-${m.id}`} />

      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Quoted text (shown under the body)</Label>
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" disabled={index === 0} onClick={() => state.quotePrevious(m.id)} data-testid={`button-quote-prev-${m.id}`}>
            <Quote className="w-3 h-3 mr-1" /> Quote previous
          </Button>
        </div>
        <Textarea value={m.quoted} rows={2} placeholder="Optional" onChange={(e) => up({ quoted: e.target.value })} className="mt-1 text-xs" aria-label="Quoted text" data-testid={`input-quoted-${m.id}`} />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <Label className="text-xs text-muted-foreground">Attachments (one file name per line)</Label>
          <ListInput value={m.attachments} onChange={(v) => up({ attachments: v })} split={splitLines} join={"\n"} multiline placeholder="e.g. dossier.pdf" className="mt-1 text-xs" aria-label="Attachments" data-testid={`input-attachments-${m.id}`} />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch id={`flag-${m.id}`} checked={m.flagged} onCheckedChange={(v) => up({ flagged: v })} data-testid={`switch-flag-${m.id}`} />
          <Label htmlFor={`flag-${m.id}`} className="text-xs text-muted-foreground">Flagged</Label>
        </div>
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
