import type { Branding, SheetSettings, Block } from "./schema.js";

export type ArtifactType = "sheet" | "textThread" | "emailThread";

/** 0 = legacy row with no schema_version column. 1 = first artifact-aware shape. */
export type SchemaVersion = 0 | 1;
export const CURRENT_SCHEMA_VERSION: SchemaVersion = 1;

export interface ArtifactBase {
  id: string;
  type: ArtifactType;
  title: string;
  createdAt: number | null; // null when the public endpoint stripped it
  updatedAt: number | null; // no column yet; always null for legacy rows
  shareSlug: string; // currently identical to id
  gmKeyScoped: boolean; // true if the row had an owner key; the key itself is NEVER included
  version: SchemaVersion; // version the row was READ from
}

export interface SheetArtifact extends ArtifactBase {
  type: "sheet";
  template: string;
  branding: Branding;
  settings: SheetSettings;
  blocks: Block[];
}

// ---------- Phase 8: text threads ----------
// Stored in the existing columns (no migration):
//   template -> style preset id (e.g. "text-cyber")
//   branding -> {} (unused; column is NOT NULL)
//   settings -> TextThreadSettings
//   blocks   -> TextMessage[]

export type TextPlatform = "cyber" | "ios" | "android";
export const TEXT_PLATFORMS: TextPlatform[] = ["cyber", "ios", "android"];

export interface TextParticipant {
  id: string;
  name: string;
  /** Bubble / avatar accent, hex. */
  color: string;
}

export type TextMessageStatus = "none" | "sent" | "delivered" | "read" | "failed";
export type TextMessageKind = "text" | "image" | "system";

export interface TextMessage {
  id: string;
  /** Participant id. Ignored for kind "system". */
  from: string;
  body: string;
  /** In-world display time, e.g. "11:42 PM" or "Yesterday 3:10 AM". Empty = no time chip. */
  sentAt: string;
  kind: TextMessageKind;
  /** Only shown under the phone owner's messages. */
  status: TextMessageStatus;
  /** data: URL or https URL, for kind "image". */
  imageSrc?: string;
}

export interface TextThreadSettings {
  platform: TextPlatform;
  participants: TextParticipant[];
  /** Participant whose phone this is (their bubbles sit on the right). */
  selfId: string;
  /** Contact / group name in the thread header. */
  headerTitle: string;
  /** Second header line, e.g. "Encrypted · last seen 2 min ago". */
  headerSubtitle: string;
  /** Status-bar clock. */
  clock: string;
  showAttribution?: boolean;
}

export interface TextThreadArtifact extends ArtifactBase, TextThreadSettings {
  type: "textThread";
  template: string;
  messages: TextMessage[];
}

// ---------- Phase 9: email threads ----------
//   template -> pack id (e.g. "email-arasaka-legal")
//   branding -> {} ; settings -> EmailThreadSettings ; blocks -> EmailMessage[]

export type EmailClientStyle = "corporate" | "terminal" | "webmail";
export const EMAIL_STYLES: EmailClientStyle[] = ["corporate", "terminal", "webmail"];

export interface EmailMessage {
  id: string;
  fromName: string;
  fromAddress: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  sentAt: string;
  /** Attachment file names (display only). */
  attachments: string[];
  /** Earlier text quoted under the body ("> ..." style). */
  quoted: string;
  flagged: boolean;
}

export interface EmailThreadSettings {
  style: EmailClientStyle;
  /** Mail client chrome title, e.g. "ARASAKA SECURE MAIL". */
  clientName: string;
  /** Whose mailbox this is (shown in the chrome). */
  mailbox: string;
  /** Thread subject shown at the top. */
  subject: string;
  /** Banner line, e.g. "CONFIDENTIAL — INTERNAL USE ONLY". Empty = none. */
  classification: string;
  accent: string;
  showAttribution?: boolean;
}

export interface EmailThreadArtifact extends ArtifactBase, EmailThreadSettings {
  type: "emailThread";
  template: string;
  messages: EmailMessage[];
}

export type Artifact = SheetArtifact | TextThreadArtifact | EmailThreadArtifact;
