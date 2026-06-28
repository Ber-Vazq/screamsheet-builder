import type { VercelRequest, VercelResponse } from "@vercel/node";
import { nanoid } from "nanoid";
import { supabase, TABLE } from "../_supabase.js";

// Maps a DB row to the API shape (camelCase createdAt).
// Strips owner_key so the GM's secret key never travels back to any client.
function toApi(row: any) {
  if (!row) return row;
  const { created_at, owner_key, ...rest } = row;
  return { ...rest, createdAt: created_at };
}

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
    return res.status(200).json((data ?? []).map(toApi));
  }

  // POST /api/screamsheets -> save a screamsheet, returns the row with its share id
  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { title, template, branding, settings, blocks, ownerKey } = body ?? {};
    if (!title || !template || !branding || !settings || !Array.isArray(blocks)) {
      return res.status(400).json({ error: "Invalid screamsheet payload" });
    }
    const row = {
      id: nanoid(10),
      title,
      template,
      branding,
      settings,
      blocks,
      owner_key: typeof ownerKey === "string" && ownerKey.trim() ? ownerKey.trim() : null,
      created_at: Date.now(),
    };
    const { data, error } = await supabase
      .from(TABLE)
      .insert(row)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(toApi(data));
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
