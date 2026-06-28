import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, TABLE } from "../_supabase.js";

// Strips owner_key so the GM's secret key never leaks to players viewing a share link.
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
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) return res.status(400).json({ error: "Missing id" });

  // GET /api/screamsheets/:id -> read a shared screamsheet
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(toApi(data));
  }

  // DELETE /api/screamsheets/:id?owner=KEY -> remove, but only if the GM key matches.
  if (req.method === "DELETE") {
    const owner = getOwner(req);
    if (!owner) return res.status(403).json({ error: "A GM key is required to delete." });

    // Look up the sheet first so we can distinguish "not found" from "not yours".
    const { data: existing, error: lookupErr } = await supabase
      .from(TABLE)
      .select("id, owner_key")
      .eq("id", id)
      .maybeSingle();
    if (lookupErr) return res.status(500).json({ error: lookupErr.message });
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.owner_key !== owner)
      return res.status(403).json({ error: "This screamsheet belongs to a different GM key." });

    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id)
      .eq("owner_key", owner);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
