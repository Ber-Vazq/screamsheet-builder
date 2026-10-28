// Runs the Vercel handlers against a stubbed Supabase client (no network).
// Run: npx tsx script/check-vercel-api.ts
import assert from "node:assert/strict";
// supabase-js needs a WebSocket global on Node < 22; the stub is never used.
(globalThis as any).WebSocket ??= class {};
process.env.SUPABASE_URL ??= "http://localhost";
process.env.SUPABASE_ANON_KEY ??= "stub";
const { supabase } = await import("../api/_supabase.js");
const { default: list } = await import("../api/screamsheets/index.js");
const { default: one } = await import("../api/screamsheets/[id].js");

const branding = { outlet: "NCT", tagline: "NEWS", accent: "#f00", headerBg: "#fff", headerText: "#000", logoStyle: "nct" };
const settings = { clock: "12:00 AM", categories: ["TECH"], activeCategory: "TECH", showNav: true, ticker: "", columns: 1 };
const legacy = { id: "leg1", title: "Old", template: "nct-tech", branding, settings, blocks: [], owner_key: "gm", created_at: 1 };
const legacyNullCols = { ...legacy, id: "leg2", artifact_type: null, schema_version: null };
const v1 = { ...legacy, id: "new1", artifact_type: "sheet", schema_version: 1 };
const broken = { ...legacy, id: "bad1", schema_version: 42 };

let rows: any[] = [];
// Minimal chainable stub of the supabase-js query builder.
(supabase as any).from = () => {
  const q: any = {
    select: () => q, eq: (_c: string, v: string) => { q._id = v; return q; }, order: () => q,
    maybeSingle: async () => ({ data: rows.find((r) => r.id === q._id) ?? null, error: null }),
    then: (res: any) => res({ data: rows, error: null }),
  };
  return q;
};
const call = async (h: any, query: any) => {
  let status = 0, body: any;
  const res: any = { status: (s: number) => { status = s; return res; }, json: (b: any) => { body = b; return res; }, setHeader() {} };
  await h({ method: "GET", query }, res);
  return { status, body };
};

rows = [legacy, legacyNullCols, v1, broken];
const lib = await call(list, { owner: "gm" });
assert.equal(lib.status, 200);
assert.deepEqual(lib.body.map((a: any) => a.id), ["leg1", "leg2", "new1"], "broken row skipped, others kept");
assert.ok(lib.body.every((a: any) => !("owner_key" in a) && !("ownerKey" in a)), "no keys leak");
assert.deepEqual(lib.body.map((a: any) => a.version), [0, 0, 1]);
assert.equal(lib.body[0].createdAt, 1);

const share = await call(one, { id: "leg1" });
assert.equal(share.status, 200);
assert.equal(share.body.shareSlug, "leg1");
assert.equal(share.body.branding.outlet, "NCT");
assert.equal("owner_key" in share.body, false);

assert.equal((await call(one, { id: "bad1" })).status, 500);
assert.equal((await call(one, { id: "nope" })).status, 404);
console.log("Vercel API checks passed");
