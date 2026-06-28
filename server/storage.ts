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

export const db = drizzle(sqlite);

export interface IStorage {
  createScreamsheet(data: InsertScreamsheet): Promise<Screamsheet>;
  getScreamsheet(id: string): Promise<Screamsheet | undefined>;
  listScreamsheets(): Promise<Screamsheet[]>;
  deleteScreamsheet(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async createScreamsheet(data: InsertScreamsheet): Promise<Screamsheet> {
    const row = {
      id: nanoid(10),
      title: data.title,
      template: data.template,
      branding: data.branding,
      settings: data.settings,
      blocks: data.blocks,
      createdAt: Date.now(),
    };
    return db.insert(screamsheets).values(row).returning().get();
  }

  async getScreamsheet(id: string): Promise<Screamsheet | undefined> {
    return db.select().from(screamsheets).where(eq(screamsheets.id, id)).get();
  }

  async listScreamsheets(): Promise<Screamsheet[]> {
    return db.select().from(screamsheets).all();
  }

  async deleteScreamsheet(id: string): Promise<boolean> {
    const res = db.delete(screamsheets).where(eq(screamsheets.id, id)).run();
    return res.changes > 0;
  }
}

export const storage = new DatabaseStorage();
