import { screamsheets } from '@shared/schema';
import type { Screamsheet, InsertScreamsheet } from '@shared/schema';
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

export const db = drizzle(sqlite);

export interface IStorage {
  createScreamsheet(data: InsertScreamsheet): Promise<Screamsheet>;
  getScreamsheet(id: string): Promise<Screamsheet | undefined>;
  listScreamsheets(ownerKey: string): Promise<Screamsheet[]>;
  deleteScreamsheet(id: string, ownerKey: string): Promise<"ok" | "notfound" | "forbidden">;
}

export class DatabaseStorage implements IStorage {
  async createScreamsheet(data: InsertScreamsheet): Promise<Screamsheet> {
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
    };
    return db.insert(screamsheets).values(row).returning().get();
  }

  async getScreamsheet(id: string): Promise<Screamsheet | undefined> {
    return db.select().from(screamsheets).where(eq(screamsheets.id, id)).get();
  }

  async listScreamsheets(ownerKey: string): Promise<Screamsheet[]> {
    const key = ownerKey.trim();
    if (!key) return [];
    return db.select().from(screamsheets).where(eq(screamsheets.ownerKey, key)).all();
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
