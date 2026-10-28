// Phase 7: GET /s/:id (rewritten here by vercel.json) -> HTML with per-artifact
// link-preview tags, then an instant redirect to the app at /#/s/:id.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, TABLE } from "../_supabase.js";
import { decodeRow } from "../_artifacts.js";
import { describeArtifact, isValidShareId, renderSharePage } from "../../shared/shareMeta.js";

function originOf(req: VercelRequest): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "screamsheet.vercel.app";
  return `${proto}://${host}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).send("Method not allowed");
  }
  const raw = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const origin = originOf(req);
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!isValidShareId(raw)) {
    return res.status(404).send(renderSharePage({ origin, id: String(raw ?? ""), found: false }));
  }

  const { data, error } = await supabase.from(TABLE).select("*").eq("id", raw).maybeSingle();
  if (error) {
    // Still send people to the app; it shows its own error state.
    console.error("[share] lookup failed", raw, error.message);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(renderSharePage({ origin, id: raw, found: true }));
  }
  const artifact = data ? decodeRow(data, "GET /s/:id") : null;
  if (!artifact) {
    res.setHeader("Cache-Control", "public, s-maxage=60");
    return res.status(data ? 200 : 404).send(renderSharePage({ origin, id: raw, found: Boolean(data) }));
  }
  const { title, description } = describeArtifact(artifact);
  // Short CDN cache: previews pick up edits within a few minutes.
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  return res.status(200).send(renderSharePage({ origin, id: raw, found: true, title, description }));
}
