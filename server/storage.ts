import { screamsheets } from '@shared/schema';
import type { Screamsheet, InsertScreamsheet } from '@shared/schema';
import type { StoredRecord } from '@shared/artifactCodec';
import { typeChangeError, type WriteMetadata } from '@shared/writeMetadata';
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

// Ensure the table exists (template uses drizzle push, but create defensively).
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS screamsheets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    template TEXT NOT NULL,
    branding TEXT NOT NULL,
    settings TEXT NOT NULL,
    blocks TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);
// Add owner_key to pre-existing dev databases (no-op if it already exists).
try {
  sqlite.exec(`ALTER TABLE screamsheets ADD COLUMN owner_key TEXT;`);
} catch {
  /* column already present */
}

// Phase 4: nullable artifact metadata columns (no-op if already present).
for (const ddl of [
  `ALTER TABLE screamsheets ADD COLUMN artifact_type TEXT;`,
  `ALTER TABLE screamsheets ADD COLUMN schema_version INTEGER;`,
  // Phase 5: set on every update (epoch ms). NULL = never edited since this column existed.
  `ALTER TABLE screamsheets ADD COLUMN updated_at INTEGER;`,
]) {
  try {
    sqlite.exec(ddl);
  } catch {
    /* column already present */
  }
}

export const db = drizzle(sqlite);

export interface IStorage {
  createScreamsheet(data: InsertScreamsheet, meta?: WriteMetadata): Promise<Screamsheet>;
  /** Raw row (snake_case, JSON as text) — decode with deserializeStoredRecord. */
  getScreamsheet(id: string): Promise<StoredRecord | undefined>;
  /** Raw rows, newest first — decode with deserializeMany. */
  listScreamsheets(ownerKey: string): Promise<StoredRecord[]>;
  updateScreamsheet(
    id: string,
    ownerKey: string,
    data: InsertScreamsheet,
    meta?: WriteMetadata,
  ): Promise<Screamsheet | "notfound" | "forbidden" | { conflict: string }>;
  deleteScreamsheet(id: string, ownerKey: string): Promise<"ok" | "notfound" | "forbidden">;
}

export class DatabaseStorage implements IStorage {
  async createScreamsheet(data: InsertScreamsheet, meta: WriteMetadata = null): Promise<Screamsheet> {
    const key = data.ownerKey?.trim();
    const row = {
      id: nanoid(10),
      title: data.title,
      template: data.template,
      branding: data.branding,
      settings: data.settings,
      blocks: data.blocks,
      ownerKey: key ? key : null,
      createdAt: Date.now(),
      ...(meta ? { artifactType: meta.artifactType, schemaVersion: meta.schemaVersion } : {}),
    };
    return db.insert(screamsheets).values(row).returning().get();
  }

  // Phase 4: reads use raw SQL on purpose. Drizzle's JSON columns call
  // JSON.parse during select, so ONE corrupt row would crash the whole query
  // before the artifact codec could log and skip it. Raw rows keep JSON as
  // text and let shared/artifactCodec.ts do the parsing.
  async getScreamsheet(id: string): Promise<StoredRecord | undefined> {
    return sqlite.prepare(`SELECT * FROM screamsheets WHERE id = ?`).get(id) as StoredRecord | undefined;
  }

  async listScreamsheets(ownerKey: string): Promise<StoredRecord[]> {
    const key = ownerKey.trim();
    if (!key) return [];
    return sqlite
      .prepare(`SELECT * FROM screamsheets WHERE owner_key = ? ORDER BY created_at DESC`)
      .all(key) as StoredRecord[];
  }

  async updateScreamsheet(
    id: string,
    ownerKey: string,
    data: InsertScreamsheet,
    meta: WriteMetadata = null,
  ): Promise<Screamsheet | "notfound" | "forbidden" | { conflict: string }> {
    const key = ownerKey.trim();
    if (!key) return "forbidden";
    const existing = db.select().from(screamsheets).where(eq(screamsheets.id, id)).get();
    if (!existing) return "notfound";
    if (existing.ownerKey !== key) return "forbidden";
    // Phase 8: a row never changes type (sheet <-> text thread).
    const conflict = typeChangeError(existing.artifactType, meta);
    if (conflict) return { conflict };
    return db
      .update(screamsheets)
      .set({
        title: data.title,
        template: data.template,
        branding: data.branding,
        settings: data.settings,
        blocks: data.blocks,
        updatedAt: Date.now(),
        // Only ever upgrade; a legacy payload leaves existing metadata alone.
        ...(meta ? { artifactType: meta.artifactType, schemaVersion: meta.schemaVersion } : {}),
      })
      .where(eq(screamsheets.id, id))
      .returning()
      .get();
  }

  async deleteScreamsheet(id: string, ownerKey: string): Promise<"ok" | "notfound" | "forbidden"> {
    const key = ownerKey.trim();
    if (!key) return "forbidden";
    const existing = db.select().from(screamsheets).where(eq(screamsheets.id, id)).get();
    if (!existing) return "notfound";
    if (existing.ownerKey !== key) return "forbidden";
    db.delete(screamsheets).where(eq(screamsheets.id, id)).run();
    return "ok";
  }
}

export const storage = new DatabaseStorage();
