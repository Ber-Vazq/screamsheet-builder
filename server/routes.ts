import type { Express } from "express";
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { storage } from "./storage";
import { insertScreamsheetSchema } from "@shared/schema";
import {
  deserializeStoredRecord,
  deserializeMany,
  logDecodeFailure,
  type StoredRecord,
} from "@shared/artifactCodec";
import { parseWriteMetadata, WriteMetadataError, type WriteMetadata } from "@shared/writeMetadata";

/** Phase 5: same metadata rules as the Vercel API. Returns undefined after sending a 400. */
function readMeta(body: unknown, res: any): WriteMetadata | undefined {
  try {
    return parseWriteMetadata(body);
  } catch (err) {
    if (err instanceof WriteMetadataError) {
      res.status(400).json({ error: err.message });
      return undefined;
    }
    throw err;
  }
}

// Phase 4: same contract as api/_artifacts.ts. Artifacts never include ownerKey.
function decodeWritten(row: StoredRecord, context: string) {
  try {
    return deserializeStoredRecord(row);
  } catch (err) {
    logDecodeFailure(context, row, err);
    const { ownerKey, ...safe } = row as any;
    return safe;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Save a screamsheet -> returns the row with its share id
  app.post("/api/screamsheets", async (req, res) => {
    const parsed = insertScreamsheetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const meta = readMeta(req.body, res);
    if (meta === undefined) return;
    const sheet = await storage.createScreamsheet(parsed.data, meta);
    res.json(decodeWritten(sheet as StoredRecord, "POST /api/screamsheets"));
  });

  // Read a shared screamsheet by id (public; owner key is stripped from response)
  app.get("/api/screamsheets/:id", async (req, res) => {
    const sheet = await storage.getScreamsheet(req.params.id);
    if (!sheet) return res.status(404).json({ error: "Not found" });
    try {
      res.json(deserializeStoredRecord(sheet));
    } catch (err) {
      logDecodeFailure("GET /api/screamsheets/:id", sheet, err);
      res.status(500).json({ error: "This screamsheet could not be read." });
    }
  });

  // List ONLY the sheets owned by the GM key in ?owner=. No key -> empty list.
  app.get("/api/screamsheets", async (req, res) => {
    const owner = String(req.query.owner ?? "").trim();
    const sheets = await storage.listScreamsheets(owner);
    // storage already returns newest first
    const { artifacts, skipped } = deserializeMany(sheets, "GET /api/screamsheets");
    if (skipped) console.warn(`[artifact-decode] GET /api/screamsheets: skipped ${skipped} of ${sheets.length} rows`);
    res.json(artifacts);
  });

  // Update a screamsheet in place, only if the GM key matches
  app.put("/api/screamsheets/:id", async (req, res) => {
    const owner = String(req.query.owner ?? "").trim();
    const parsed = insertScreamsheetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const meta = readMeta(req.body, res);
    if (meta === undefined) return;
    const result = await storage.updateScreamsheet(req.params.id, owner, parsed.data, meta);
    if (result === "notfound") return res.status(404).json({ error: "Not found" });
    if (result === "forbidden")
      return res.status(403).json({ error: "This screamsheet belongs to a different GM key." });
    res.json(decodeWritten(result as StoredRecord, "PUT /api/screamsheets/:id"));
  });

  // Delete a screamsheet, only if the GM key matches
  app.delete("/api/screamsheets/:id", async (req, res) => {
    const owner = String(req.query.owner ?? "").trim();
    const result = await storage.deleteScreamsheet(req.params.id, owner);
    if (result === "notfound") return res.status(404).json({ error: "Not found" });
    if (result === "forbidden")
      return res.status(403).json({ error: "This screamsheet belongs to a different GM key." });
    res.json({ ok: true });
  });

  return httpServer;
}
