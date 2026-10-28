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

export interface TextMessage {
  id: string;
  from: string;
  body: string;
  sentAt: string; // in-world display time
}

export interface TextThreadArtifact extends ArtifactBase {
  type: "textThread";
  participants: string[];
  messages: TextMessage[];
}

export interface EmailMessage {
  id: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  sentAt: string;
}

export interface EmailThreadArtifact extends ArtifactBase {
  type: "emailThread";
  subject: string;
  messages: EmailMessage[];
}

export type Artifact = SheetArtifact | TextThreadArtifact | EmailThreadArtifact;
