// Phase 7 unit checks: PDF page fit, load-error classification, share meta, reorder.
// Run: npx tsx script/check-phase7.ts
import assert from "node:assert/strict";
import { fitToLetter, LETTER } from "../shared/pdfLayout";
import { classifyLoadError } from "../client/src/lib/loadError";
import { describeArtifact, escapeHtml, isValidShareId, renderSharePage } from "../shared/shareMeta";
import { reorderById } from "../client/src/hooks/useSheetState";
import type { SheetArtifact } from "../shared/artifact";

// --- fitToLetter (must match the original exportPdf math) ---
{
  const short = fitToLetter(816, 600);
  assert.equal(short.w, LETTER.width);
  assert.equal(short.x, 0);
  assert.equal(short.shrunk, false);
  assert.ok(Math.abs(short.h - 612 * (600 / 816)) < 1e-9);

  const exact = fitToLetter(816, 816 * (792 / 612));
  assert.equal(exact.shrunk, false);

  const tall = fitToLetter(816, 2112); // two pages tall
  assert.equal(tall.shrunk, true);
  assert.equal(tall.h, LETTER.height);
  assert.ok(Math.abs(tall.w - 792 / (2112 / 816)) < 1e-9);
  assert.ok(Math.abs(tall.x - (612 - tall.w) / 2) < 1e-9);
  assert.ok(Math.abs(tall.widthFraction - 0.5) < 1e-9);

  const zero = fitToLetter(0, 0);
  assert.equal(zero.shrunk, false);
}

// --- classifyLoadError ---
assert.equal(classifyLoadError(new Error("404: {\"error\":\"Not found\"}")), "notfound");
assert.equal(classifyLoadError(new Error("400: Missing id")), "notfound");
assert.equal(classifyLoadError(new Error("500: This screamsheet could not be read.")), "unreadable");
assert.equal(classifyLoadError(new Error("502: Bad gateway")), "unreadable");
assert.equal(classifyLoadError(new TypeError("Failed to fetch")), "network");
assert.equal(classifyLoadError(new Error("NetworkError when attempting to fetch resource.")), "network");
assert.equal(classifyLoadError(new Error("something odd")), "unreadable");

// --- share ids ---
assert.ok(isValidShareId("_EQ8l80vQp"));
assert.ok(isValidShareId("legacy001"));
assert.ok(!isValidShareId("../etc"));
assert.ok(!isValidShareId("a b"));
assert.ok(!isValidShareId(""));
assert.ok(!isValidShareId(undefined));

// --- describeArtifact uses in-world content, never the private title ---
const sheet: SheetArtifact = {
  id: "abc", type: "sheet", title: "PRIVATE GM NOTES", createdAt: 1, updatedAt: null, shareSlug: "abc",
  gmKeyScoped: true, version: 1, template: "nct-tech",
  branding: { outlet: "NIGHT CITY TODAY", tagline: "NEWS", accent: "#c00", headerBg: "#fff", headerText: "#111", logoStyle: "nct" },
  settings: { clock: "", categories: [], activeCategory: "", showNav: false, ticker: "", columns: 1 },
  blocks: [
    { id: "1", type: "headline", text: "CORPO <script>alert(1)</script> COUP", size: "lead" },
    { id: "2", type: "paragraph", text: "x".repeat(400) },
  ],
};
const d = describeArtifact(sheet);
assert.ok(d.title.startsWith("CORPO"));
assert.ok(d.title.endsWith("| NIGHT CITY TODAY"));
assert.ok(!d.title.includes("PRIVATE"));
assert.ok(d.description.length <= 180);
const empty = describeArtifact({ ...sheet, blocks: [] });
assert.equal(empty.title, "NIGHT CITY TODAY");

// --- renderSharePage escapes and redirects ---
const html = renderSharePage({ origin: "https://screamsheet.vercel.app/", id: "abc", found: true, ...d });
assert.ok(html.includes('<meta property="og:title" content="CORPO &lt;script&gt;'));
assert.ok(!html.includes("<script>alert"));
assert.ok(html.includes('content="https://screamsheet.vercel.app/og-default.png"'));
assert.ok(html.includes('url=/#/s/abc'));
assert.ok(html.includes('location.replace("/#/s/abc")'));
assert.ok(html.includes("Not real news"));
assert.ok(html.includes('name="robots" content="noindex"'));
const nf = renderSharePage({ origin: "http://localhost:5000", id: "zzz", found: false });
assert.ok(nf.includes("Screamsheet not found"));
assert.equal(escapeHtml(`"'<>&`), "&quot;&#39;&lt;&gt;&amp;");

// --- reorderById ---
const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
assert.deepEqual(reorderById(items, "a", "c").map((x) => x.id), ["b", "c", "a", "d"]);
assert.deepEqual(reorderById(items, "d", "a").map((x) => x.id), ["d", "a", "b", "c"]);
assert.equal(reorderById(items, "a", "a"), items);
assert.equal(reorderById(items, "a", "zz"), items);

console.log("Phase 7 checks passed");
