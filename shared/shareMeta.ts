// Phase 7: link previews for shared artifacts.
// The app uses hash routing (/#/s/:id), and crawlers (Discord, iMessage, Slack)
// never see the hash, so they only ever got the home page's meta tags. Share
// links now use the path /s/:id, which a small server route answers with
// per-artifact Open Graph tags plus an instant redirect to /#/s/:id.
import type { Artifact } from "./artifact.js";
import { DISCLAIMER_SHORT } from "./legalCopy.js";

export const DEFAULT_OG_IMAGE = "/og-default.png";
export const SITE_NAME = "Screamsheet Builder";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}

/** Share ids are nanoid(10): letters, digits, _ and -. Anything else is rejected. */
export function isValidShareId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

/**
 * Title + description for a link preview. Uses the in-world content (lead
 * headline, outlet, first paragraph), never the private library title.
 */
export function describeArtifact(a: Artifact): { title: string; description: string } {
  if (a.type === "sheet") {
    const headline = a.blocks.find((b) => b.type === "headline") as { text?: string } | undefined;
    const para = a.blocks.find((b) => b.type === "paragraph" || b.type === "brief") as { text?: string } | undefined;
    const outlet = a.branding?.outlet?.trim() || "Screamsheet";
    const title = headline?.text?.trim() ? `${clip(headline.text, 90)} | ${outlet}` : outlet;
    const description = para?.text?.trim() ? clip(para.text, 180) : `A screamsheet from ${outlet}.`;
    return { title, description };
  }
  if (a.type === "textThread") {
    const others = (a.participants ?? []).filter((p) => p.id !== a.selfId).map((p) => p.name.trim()).filter(Boolean);
    const who = a.headerTitle?.trim() || others.slice(0, 3).join(", ");
    const first = (a.messages ?? []).find((m) => m.kind !== "system" && m.body.trim())?.body ?? "";
    return {
      title: who ? `Messages with ${clip(who, 80)}` : "Intercepted messages",
      description: first ? clip(first, 180) : "An intercepted text thread.",
    };
  }
  const first = a.messages?.[0];
  return {
    title: clip(a.subject?.trim() || first?.subject?.trim() || "Intercepted email", 100),
    description: first?.body?.trim() ? clip(first.body, 180) : "An intercepted email thread.",
  };
}

export interface SharePageInput {
  origin: string; // e.g. https://screamsheet.vercel.app
  id: string;
  found: boolean;
  title?: string;
  description?: string;
  image?: string; // absolute or site-relative
}

/** Minimal HTML with OG/Twitter tags that sends humans straight to the app view. */
export function renderSharePage(input: SharePageInput): string {
  const origin = input.origin.replace(/\/$/, "");
  const target = `/#/s/${encodeURIComponent(input.id)}`;
  const title = input.found ? input.title ?? SITE_NAME : "Screamsheet not found";
  const description = input.found
    ? `${input.description ?? ""} ${DISCLAIMER_SHORT}`.trim()
    : "This screamsheet may have been deleted.";
  const image = (input.image ?? DEFAULT_OG_IMAGE).startsWith("http")
    ? input.image!
    : `${origin}${input.image ?? DEFAULT_OG_IMAGE}`;
  const url = `${origin}/s/${encodeURIComponent(input.id)}`;
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = escapeHtml(image);
  const u = escapeHtml(url);
  const to = escapeHtml(target);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${u}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${u}" />
<meta property="og:image" content="${img}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${img}" />
<meta name="robots" content="noindex" />
<meta http-equiv="refresh" content="0;url=${to}" />
<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body style="background:#0a1230;color:#cfe3ff;font-family:monospace;padding:2rem">
<p>Opening <a href="${to}" style="color:#7fd3ff">${t}</a>…</p>
</body>
</html>`;
}
