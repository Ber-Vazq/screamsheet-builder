import { useCallback, useState } from "react";
import type { TextMessage, TextParticipant, TextThreadArtifact } from "@shared/artifact";
import { MAX_MESSAGES, MAX_PARTICIPANTS, defaultParticipantColor } from "@shared/threadCodec";
import { newId, textThreadFromTemplate, type TextTemplateDef } from "@/lib/textTemplates";
import { reorderById } from "@/hooks/useSheetState";

/**
 * Owns the in-memory text thread being edited (no I/O; see useArtifactPersistence).
 * Mirrors useSheetState: one artifact object, small focused setters.
 */
export function useTextThreadState(tpl: TextTemplateDef) {
  const [thread, setThread] = useState<TextThreadArtifact>(() => textThreadFromTemplate(tpl));

  const patch = useCallback((p: Partial<TextThreadArtifact>) => setThread((t) => ({ ...t, ...p })), []);
  const setMessages = useCallback(
    (fn: (ms: TextMessage[]) => TextMessage[]) => setThread((t) => ({ ...t, messages: fn(t.messages) })),
    [],
  );

  // --- participants ---
  const addParticipant = useCallback(
    () =>
      setThread((t) => {
        if (t.participants.length >= MAX_PARTICIPANTS) return t;
        const n = t.participants.length;
        return {
          ...t,
          participants: [...t.participants, { id: newId(), name: `Contact ${n + 1}`, color: defaultParticipantColor(n) }],
        };
      }),
    [],
  );
  const updateParticipant = useCallback(
    (id: string, p: Partial<TextParticipant>) =>
      setThread((t) => ({ ...t, participants: t.participants.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
    [],
  );
  /** Removing a participant also removes their messages. The last one can't be removed. */
  const removeParticipant = useCallback(
    (id: string) =>
      setThread((t) => {
        if (t.participants.length <= 1) return t;
        const participants = t.participants.filter((x) => x.id !== id);
        return {
          ...t,
          participants,
          selfId: t.selfId === id ? participants[0].id : t.selfId,
          messages: t.messages.filter((m) => m.kind === "system" || m.from !== id),
        };
      }),
    [],
  );

  // --- messages ---
  const addMessage = useCallback(
    (from: string, kind: TextMessage["kind"] = "text") =>
      setMessages((ms) =>
        ms.length >= MAX_MESSAGES
          ? ms
          : [...ms, { id: newId(), from: kind === "system" ? "" : from, body: kind === "system" ? "New system note" : "", sentAt: "", kind, status: "none" }],
      ),
    [setMessages],
  );
  const updateMessage = useCallback(
    (id: string, p: Partial<TextMessage>) => setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m))),
    [setMessages],
  );
  const removeMessage = useCallback((id: string) => setMessages((ms) => ms.filter((m) => m.id !== id)), [setMessages]);
  const duplicateMessage = useCallback(
    (id: string) =>
      setMessages((ms) => {
        const i = ms.findIndex((m) => m.id === id);
        if (i < 0 || ms.length >= MAX_MESSAGES) return ms;
        const copy = [...ms];
        copy.splice(i + 1, 0, { ...ms[i], id: newId() });
        return copy;
      }),
    [setMessages],
  );
  const moveMessage = useCallback(
    (id: string, dir: -1 | 1) =>
      setMessages((ms) => {
        const i = ms.findIndex((m) => m.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= ms.length) return ms;
        const copy = [...ms];
        [copy[i], copy[j]] = [copy[j], copy[i]];
        return copy;
      }),
    [setMessages],
  );
  const reorderMessage = useCallback(
    (activeId: string, overId: string) => setMessages((ms) => reorderById(ms, activeId, overId)),
    [setMessages],
  );
  const setMessageImage = useCallback(
    (id: string, file: File) => {
      const reader = new FileReader();
      reader.onload = () => updateMessage(id, { imageSrc: reader.result as string });
      reader.readAsDataURL(file);
    },
    [updateMessage],
  );

  // --- whole-thread replacement (persistence) ---
  const resetToTemplate = useCallback((t: TextTemplateDef): TextThreadArtifact => {
    const next = textThreadFromTemplate(t);
    setThread(next);
    return next;
  }, []);
  const loadArtifact = useCallback((a: TextThreadArtifact, asCopy: boolean): TextThreadArtifact => {
    const next = asCopy ? { ...a, id: "", shareSlug: "", createdAt: null, title: a.title + " (copy)" } : a;
    setThread(next);
    return next;
  }, []);

  return {
    thread,
    patch,
    addParticipant,
    updateParticipant,
    removeParticipant,
    addMessage,
    updateMessage,
    removeMessage,
    duplicateMessage,
    moveMessage,
    reorderMessage,
    setMessageImage,
    resetToTemplate,
    loadArtifact,
  };
}

export type TextThreadState = ReturnType<typeof useTextThreadState>;
