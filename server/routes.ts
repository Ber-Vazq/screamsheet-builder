import type { Express } from "express";
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { storage } from "./storage";
import { insertScreamsheetSchema, insertThreadSchema, type InsertScreamsheet } from "@shared/schema";
import { validateThreadPayload } from "@shared/threadCodec";
import {
  deserializeStoredRecord,
  deserializeMany,
  logDecodeFailure,
  type StoredRecord,
} from "@shared/artifactCodec";
import { parseWriteMetadata, WriteMetadataError, writeType, type WriteMetadata } from "@shared/writeMetadata";
import { describeArtifact, isValidShareId, renderSharePage } from "@shared/shareMeta";

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

/**
 * Phase 8: validate a write body for its artifact type. Sheets use the strict
 * sheet schema; threads use the loose column schema plus validateThreadPayload.
 * Returns undefined after sending a 400.
 */
function readBody(body: unknown, meta: WriteMetadata, res: any): InsertScreamsheet | undefined {
  const type = writeType(meta);
  if (type === "sheet") {
    const parsed = insertScreamsheetSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return undefined;
    }
    return parsed.data;
  }
  const parsed = insertThreadSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return undefined;
  }
  const problem = validateThreadPayload(type, parsed.data as Record<string, unknown>);
  if (problem) {
    res.status(400).json({ error: problem });
    return undefined;
  }
  // Same columns; the codec reads them back by artifact_type.
  return parsed.data as unknown as InsertScreamsheet;
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
    const meta = readMeta(req.body, res);
    if (meta === undefined) return;
    const data = readBody(req.body, meta, res);
    if (!data) return;
    const sheet = await storage.createScreamsheet(data, meta);
    res.json(decodeWritten(sheet as StoredRecord, "POST /api/screamsheets"));
  });

  // Phase 7: share link with link-preview tags -> redirects to /#/s/:id.
  // Mirrors api/share/[id].ts (Vercel rewrites /s/:id there).
  app.get("/s/:id", async (req, res) => {
    const id = req.params.id;
    const origin = `${req.protocol}://${req.get("host")}`;
    res.type("html");
    if (!isValidShareId(id)) return res.status(404).send(renderSharePage({ origin, id, found: false }));
    const row = await storage.getScreamsheet(id);
    if (!row) return res.status(404).send(renderSharePage({ origin, id, found: false }));
    try {
      const { title, description } = describeArtifact(deserializeStoredRecord(row));
      res.send(renderSharePage({ origin, id, found: true, title, description }));
    } catch (err) {
      logDecodeFailure("GET /s/:id", row, err);
      res.send(renderSharePage({ origin, id, found: true }));
    }
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
    const meta = readMeta(req.body, res);
    if (meta === undefined) return;
    const data = readBody(req.body, meta, res);
    if (!data) return;
    const result = await storage.updateScreamsheet(req.params.id, owner, data, meta);
    if (result === "notfound") return res.status(404).json({ error: "Not found" });
    if (result === "forbidden")
      return res.status(403).json({ error: "This screamsheet belongs to a different GM key." });
    if (typeof result === "object" && "conflict" in result) return res.status(409).json({ error: result.conflict });
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
