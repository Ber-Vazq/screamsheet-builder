import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, TABLE } from "../_supabase.js";

function toApi(row: any) {
  if (!row) return row;
  const { created_at, ...rest } = row;
  return { ...rest, createdAt: created_at };
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

  // DELETE /api/screamsheets/:id -> remove from the library
  if (req.method === "DELETE") {
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id)
      .select();
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0)
      return res.status(404).json({ error: "Not found" });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
