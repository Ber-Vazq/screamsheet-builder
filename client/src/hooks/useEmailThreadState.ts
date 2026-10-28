import { useCallback, useState } from "react";
import type { EmailMessage, EmailThreadArtifact } from "@shared/artifact";
import { MAX_MESSAGES } from "@shared/threadCodec";
import { emailThreadFromTemplate, newEmailId, quoteOf, replySubject, type EmailTemplateDef } from "@/lib/emailTemplates";
import { reorderById } from "@/hooks/useSheetState";

/**
 * Owns the in-memory email thread being edited (no I/O; see useArtifactPersistence).
 * Mirrors useTextThreadState: one artifact object, small focused setters.
 */
export function useEmailThreadState(tpl: EmailTemplateDef) {
  const [thread, setThread] = useState<EmailThreadArtifact>(() => emailThreadFromTemplate(tpl));

  const patch = useCallback((p: Partial<EmailThreadArtifact>) => setThread((t) => ({ ...t, ...p })), []);
  const setMessages = useCallback(
    (fn: (ms: EmailMessage[]) => EmailMessage[]) => setThread((t) => ({ ...t, messages: fn(t.messages) })),
    [],
  );

  /** New email at the end. "reply" swaps from/to of the last email, prefixes RE: and quotes it. */
  const addMessage = useCallback(
    (kind: "blank" | "reply" = "blank") =>
      setThread((t) => {
        if (t.messages.length >= MAX_MESSAGES) return t;
        const last = t.messages[t.messages.length - 1];
        const base: EmailMessage = {
          id: newEmailId(), fromName: "", fromAddress: t.mailbox, to: [], cc: [], subject: t.subject,
          body: "", sentAt: "", attachments: [], quoted: "", flagged: false,
        };
        const next: EmailMessage =
          kind === "reply" && last
            ? {
                ...base,
                // Reuse the replier's display name if they sent an earlier email in this thread.
                fromName: t.messages.find((m) => m.fromAddress && m.fromAddress === last.to[0])?.fromName ?? "",
                fromAddress: last.to[0] ?? t.mailbox,
                to: last.fromAddress ? [last.fromAddress] : [],
                subject: replySubject(last.subject || t.subject),
                quoted: quoteOf(last),
              }
            : base;
        return { ...t, messages: [...t.messages, next] };
      }),
    [],
  );
  const updateMessage = useCallback(
    (id: string, p: Partial<EmailMessage>) => setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m))),
    [setMessages],
  );
  const removeMessage = useCallback((id: string) => setMessages((ms) => ms.filter((m) => m.id !== id)), [setMessages]);
  const duplicateMessage = useCallback(
    (id: string) =>
      setMessages((ms) => {
        const i = ms.findIndex((m) => m.id === id);
        if (i < 0 || ms.length >= MAX_MESSAGES) return ms;
        const copy = [...ms];
        copy.splice(i + 1, 0, { ...ms[i], id: newEmailId(), to: [...ms[i].to], cc: [...ms[i].cc], attachments: [...ms[i].attachments] });
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
  /** Fill a message's quote from the email right above it. */
  const quotePrevious = useCallback(
    (id: string) =>
      setMessages((ms) => {
        const i = ms.findIndex((m) => m.id === id);
        if (i <= 0) return ms;
        return ms.map((m, k) => (k === i ? { ...m, quoted: quoteOf(ms[i - 1]) } : m));
      }),
    [setMessages],
  );

  // --- whole-thread replacement (persistence) ---
  const resetToTemplate = useCallback((t: EmailTemplateDef): EmailThreadArtifact => {
    const next = emailThreadFromTemplate(t);
    setThread(next);
    return next;
  }, []);
  const loadArtifact = useCallback((a: EmailThreadArtifact, asCopy: boolean): EmailThreadArtifact => {
    const next = asCopy ? { ...a, id: "", shareSlug: "", createdAt: null, title: a.title + " (copy)" } : a;
    setThread(next);
    return next;
  }, []);

  return {
    thread,
    patch,
    addMessage,
    updateMessage,
    removeMessage,
    duplicateMessage,
    moveMessage,
    reorderMessage,
    quotePrevious,
    resetToTemplate,
    loadArtifact,
  };
}

export type EmailThreadState = ReturnType<typeof useEmailThreadState>;
