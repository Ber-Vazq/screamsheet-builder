import type { VercelRequest, VercelResponse } from "@vercel/node";
import { nanoid } from "nanoid";
import { supabase, TABLE } from "../_supabase.js";
import { decodeRows, decodeWritten } from "../_artifacts.js";
import {
  parseWriteMetadata,
  metadataColumns,
  WriteMetadataError,
  writeType,
  type WriteMetadata,
} from "../../shared/writeMetadata.js";
import { validateThreadPayload } from "../../shared/threadCodec.js";

function getOwner(req: VercelRequest): string {
  const raw = Array.isArray(req.query.owner) ? req.query.owner[0] : req.query.owner;
  return (raw ?? "").trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET /api/screamsheets?owner=KEY -> list ONLY the sheets owned by this GM key.
  // Without a key we return an empty list so no one can browse other people's sheets.
  if (req.method === "GET") {
    const owner = getOwner(req);
    if (!owner) return res.status(200).json([]);
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("owner_key", owner)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(decodeRows(data ?? [], "GET /api/screamsheets"));
  }

  // POST /api/screamsheets -> save a screamsheet, returns the row with its share id
  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { title, template, branding, settings, blocks, ownerKey } = body ?? {};
    if (!title || !template || !branding || !settings || !Array.isArray(blocks)) {
      return res.status(400).json({ error: "Invalid screamsheet payload" });
    }
    // Phase 5: optional artifactType/schemaVersion. id, owner_key and created_at
    // are always set here, never taken from the client.
    let meta: WriteMetadata;
    try {
      meta = parseWriteMetadata(body);
    } catch (err) {
      if (err instanceof WriteMetadataError) return res.status(400).json({ error: err.message });
      throw err;
    }
    // Phase 8: type-specific shape checks for text/email threads.
    const problem = validateThreadPayload(writeType(meta), body);
    if (problem) return res.status(400).json({ error: problem });
    const row = {
      id: nanoid(10),
      title,
      template,
      branding,
      settings,
      blocks,
      owner_key: typeof ownerKey === "string" && ownerKey.trim() ? ownerKey.trim() : null,
      created_at: Date.now(),
      ...metadataColumns(meta),
    };
    const { data, error } = await supabase
      .from(TABLE)
      .insert(row)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(decodeWritten(data, "POST /api/screamsheets"));
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
