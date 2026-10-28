// Phase 8/9: text and email threads <-> the existing storage columns.
// Lenient on read (fill defaults, drop junk entries) so one odd field never
// makes a whole thread unreadable; strict shape on write.
import type {
  ArtifactBase,
  EmailClientStyle,
  EmailMessage,
  EmailThreadArtifact,
  EmailThreadSettings,
  TextMessage,
  TextMessageKind,
  TextMessageStatus,
  TextParticipant,
  TextPlatform,
  TextThreadArtifact,
  TextThreadSettings,
} from "./artifact.js";
import { EMAIL_STYLES, TEXT_PLATFORMS } from "./artifact.js";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const HEX = /^#[0-9a-f]{3,8}$/i;
const color = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);

export const MAX_PARTICIPANTS = 8;
export const MAX_MESSAGES = 300;

const STATUSES: TextMessageStatus[] = ["none", "sent", "delivered", "read", "failed"];
const KINDS: TextMessageKind[] = ["text", "image", "system"];
const PALETTE = ["#00e5ff", "#ff2bd6", "#ffd400", "#7cff6b", "#ff6b3d", "#9d7bff", "#3dd9ff", "#ff4d6d"];

export function defaultParticipantColor(i: number): string {
  return PALETTE[i % PALETTE.length];
}

// ---------- text threads ----------

export function normalizeTextSettings(raw: unknown): TextThreadSettings {
  const s = isObj(raw) ? raw : {};
  const platform = TEXT_PLATFORMS.includes(s.platform as TextPlatform) ? (s.platform as TextPlatform) : "cyber";
  const seen = new Set<string>();
  const participants: TextParticipant[] = (Array.isArray(s.participants) ? s.participants : [])
    .filter(isObj)
    .map((p, i) => ({ id: str(p.id), name: str(p.name, `Contact ${i + 1}`), color: color(p.color, defaultParticipantColor(i)) }))
    .filter((p) => p.id && !seen.has(p.id) && seen.add(p.id))
    .slice(0, MAX_PARTICIPANTS);
  const selfId = participants.some((p) => p.id === s.selfId) ? String(s.selfId) : participants[0]?.id ?? "";
  return {
    platform,
    participants,
    selfId,
    headerTitle: str(s.headerTitle),
    headerSubtitle: str(s.headerSubtitle),
    clock: str(s.clock, "11:59 PM"),
    ...(typeof s.showAttribution === "boolean" ? { showAttribution: s.showAttribution } : {}),
  };
}

export function normalizeTextMessages(raw: unknown): TextMessage[] {
  return (Array.isArray(raw) ? raw : [])
    .filter(isObj)
    .filter((m) => typeof m.id === "string" && m.id !== "")
    .slice(0, MAX_MESSAGES)
    .map((m) => {
      const kind = KINDS.includes(m.kind as TextMessageKind) ? (m.kind as TextMessageKind) : "text";
      const msg: TextMessage = {
        id: String(m.id),
        from: str(m.from),
        body: str(m.body),
        sentAt: str(m.sentAt),
        kind,
        status: STATUSES.includes(m.status as TextMessageStatus) ? (m.status as TextMessageStatus) : "none",
      };
      if (typeof m.imageSrc === "string" && m.imageSrc) msg.imageSrc = m.imageSrc;
      return msg;
    });
}

export function textThreadFromColumns(
  base: Omit<ArtifactBase, "type">,
  template: string,
  settings: unknown,
  blocks: unknown,
): TextThreadArtifact {
  return {
    ...base,
    type: "textThread",
    template,
    ...normalizeTextSettings(settings),
    messages: normalizeTextMessages(blocks),
  };
}

export function textThreadToColumns(a: TextThreadArtifact) {
  const settings: TextThreadSettings = {
    platform: a.platform,
    participants: a.participants,
    selfId: a.selfId,
    headerTitle: a.headerTitle,
    headerSubtitle: a.headerSubtitle,
    clock: a.clock,
    ...(typeof a.showAttribution === "boolean" ? { showAttribution: a.showAttribution } : {}),
  };
  return { branding: {}, settings, blocks: a.messages };
}

// ---------- email threads ----------

export function normalizeEmailSettings(raw: unknown): EmailThreadSettings {
  const s = isObj(raw) ? raw : {};
  return {
    style: EMAIL_STYLES.includes(s.style as EmailClientStyle) ? (s.style as EmailClientStyle) : "corporate",
    clientName: str(s.clientName, "SECURE MAIL"),
    mailbox: str(s.mailbox),
    subject: str(s.subject),
    classification: str(s.classification),
    accent: color(s.accent, "#c0392b"),
    ...(typeof s.showAttribution === "boolean" ? { showAttribution: s.showAttribution } : {}),
  };
}

export function normalizeEmailMessages(raw: unknown): EmailMessage[] {
  return (Array.isArray(raw) ? raw : [])
    .filter(isObj)
    .filter((m) => typeof m.id === "string" && m.id !== "")
    .slice(0, MAX_MESSAGES)
    .map((m) => ({
      id: String(m.id),
      fromName: str(m.fromName),
      fromAddress: str(m.fromAddress),
      to: strArr(m.to),
      cc: strArr(m.cc),
      subject: str(m.subject),
      body: str(m.body),
      sentAt: str(m.sentAt),
      attachments: strArr(m.attachments),
      quoted: str(m.quoted),
      flagged: m.flagged === true,
    }));
}

export function emailThreadFromColumns(
  base: Omit<ArtifactBase, "type">,
  template: string,
  settings: unknown,
  blocks: unknown,
): EmailThreadArtifact {
  return {
    ...base,
    type: "emailThread",
    template,
    ...normalizeEmailSettings(settings),
    messages: normalizeEmailMessages(blocks),
  };
}

export function emailThreadToColumns(a: EmailThreadArtifact) {
  const settings: EmailThreadSettings = {
    style: a.style,
    clientName: a.clientName,
    mailbox: a.mailbox,
    subject: a.subject,
    classification: a.classification,
    accent: a.accent,
    ...(typeof a.showAttribution === "boolean" ? { showAttribution: a.showAttribution } : {}),
  };
  return { branding: {}, settings, blocks: a.messages };
}

/**
 * Server-side sanity check for a thread write (POST/PUT body). Returns an error
 * message, or null if fine. Sheets are validated by the existing checks.
 */
export function validateThreadPayload(type: string, body: Obj): string | null {
  if (type !== "textThread" && type !== "emailThread") return null;
  const settings = body.settings;
  const blocks = body.blocks;
  if (!isObj(settings)) return "settings must be an object";
  if (!Array.isArray(blocks)) return "blocks must be an array of messages";
  if (blocks.length > MAX_MESSAGES) return `at most ${MAX_MESSAGES} messages`;
  if (!blocks.every((m) => isObj(m) && typeof m.id === "string" && m.id !== "")) return "every message needs an id";
  if (type === "textThread") {
    if (!TEXT_PLATFORMS.includes(settings.platform as TextPlatform)) return "unknown text platform";
    const ps = settings.participants;
    if (!Array.isArray(ps) || ps.length < 1 || ps.length > MAX_PARTICIPANTS) return `1-${MAX_PARTICIPANTS} participants required`;
    if (!ps.every((p) => isObj(p) && typeof p.id === "string" && p.id !== "")) return "every participant needs an id";
  } else {
    if (!EMAIL_STYLES.includes(settings.style as EmailClientStyle)) return "unknown email style";
  }
  return null;
}
