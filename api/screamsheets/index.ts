import type { VercelRequest, VercelResponse } from "@vercel/node";
import { nanoid } from "nanoid";
import { supabase, TABLE } from "../_supabase.js";

// Maps a DB row (snake_case created_at) to the API shape (camelCase createdAt).
function toApi(row: any) {
  if (!row) return row;
  const { created_at, ...rest } = row;
  return { ...rest, createdAt: created_at };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET /api/screamsheets -> list the GM's library, newest first
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json((data ?? []).map(toApi));
  }

  // POST /api/screamsheets -> save a screamsheet, returns the row with its share id
  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { title, template, branding, settings, blocks } = body ?? {};
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
