// Runs the Vercel handlers against a stubbed Supabase client (no network).
// Run: npx tsx script/check-vercel-api.ts
import assert from "node:assert/strict";
// supabase-js needs a WebSocket global on Node < 22; the stub is never used.
(globalThis as any).WebSocket ??= class {};
process.env.SUPABASE_URL ??= "http://localhost";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "stub";
const { supabase } = await import("../api/_supabase.js");
const { default: list } = await import("../api/screamsheets/index.js");
const { default: one } = await import("../api/screamsheets/[id].js");
const { default: sharePage } = await import("../api/share/[id].js");

const branding = { outlet: "NCT", tagline: "NEWS", accent: "#f00", headerBg: "#fff", headerText: "#000", logoStyle: "nct" };
const settings = { clock: "12:00 AM", categories: ["TECH"], activeCategory: "TECH", showNav: true, ticker: "", columns: 1 };
const legacy = { id: "leg1", title: "Old", template: "nct-tech", branding, settings, blocks: [], owner_key: "gm", created_at: 1 };
const legacyNullCols = { ...legacy, id: "leg2", artifact_type: null, schema_version: null };
const v1 = { ...legacy, id: "new1", artifact_type: "sheet", schema_version: 1 };
const broken = { ...legacy, id: "bad1", schema_version: 42 };

let rows: any[] = [];
// Minimal in-memory stub of the supabase-js query builder: filters, order,
// insert, update. Enough to exercise the handlers' real logic.
(supabase as any).from = () => {
  const filters: [string, unknown][] = [];
  let op: "select" | "insert" | "update" = "select";
  let payload: any = null;
  let orderDesc: string | null = null;
  const match = () => rows.filter((r) => filters.every(([c, v]) => r[c] === v));
  const run = () => {
    if (op === "insert") {
      const row = { artifact_type: null, schema_version: null, updated_at: null, ...payload };
      rows.push(row);
      return [row];
    }
    if (op === "update") {
      const hit = match();
      hit.forEach((r) => Object.assign(r, payload));
      return hit;
    }
    let out = match();
    if (orderDesc) out = [...out].sort((x, y) => y[orderDesc!] - x[orderDesc!]);
    return out;
  };
  const q: any = {
    select: () => q,
    eq: (c: string, v: unknown) => { filters.push([c, v]); return q; },
    order: (c: string, o: any) => { if (o?.ascending === false) orderDesc = c; return q; },
    insert: (r: any) => { op = "insert"; payload = r; return q; },
    update: (r: any) => { op = "update"; payload = r; return q; },
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    single: async () => ({ data: run()[0] ?? null, error: null }),
    then: (res: any) => res({ data: run(), error: null }),
  };
  return q;
};
const call = async (h: any, query: any, method = "GET", body?: any) => {
  let status = 0, out: any;
  const headers: Record<string, string> = {};
  const res: any = {
    status: (s: number) => { status = s; return res; },
    json: (b: any) => { out = b; return res; },
    send: (b: any) => { out = b; return res; },
    setHeader(k: string, v: string) { headers[k.toLowerCase()] = v; },
  };
  await h({ method, query, body, headers: { host: "screamsheet.vercel.app", "x-forwarded-proto": "https" } }, res);
  return { status, body: out, headers };
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

// ---------- Phase 5: write path ----------
const { buildWritePayload, chooseWriteTarget } = await import("../shared/writeMetadata.js");
const { deserializeStoredRecord } = await import("../shared/artifactCodec.js");
const row = (id: string) => rows.find((r) => r.id === id);
const legacyRow = () => ({ ...legacy, id: "leg9", title: "Old nine", created_at: 5, artifact_type: null, schema_version: null, updated_at: null });

// Client decision table
assert.equal(chooseWriteTarget("create", null, false), "v1", "new sheets write v1");
assert.equal(chooseWriteTarget("create", 0, false), "v1", "copies of legacy write v1");
assert.equal(chooseWriteTarget("update", 0, false), "legacy", "Release A: legacy stays legacy");
assert.equal(chooseWriteTarget("update", 1, false), "v1", "v1 stays v1");
assert.equal(chooseWriteTarget("update", 0, true), "v1", "Release B: upgrade on save");
const legacyArtifact = deserializeStoredRecord(legacyRow());
const v1Body = buildWritePayload(legacyArtifact, "v1");
const legacyBody = buildWritePayload(legacyArtifact, "legacy");
assert.equal(v1Body.artifactType, "sheet"); assert.equal(v1Body.schemaVersion, 1);
assert.ok(!("id" in v1Body) && !("artifact_type" in v1Body) && !("owner_key" in v1Body), "payload has no id/snake metadata/owner");
assert.ok(!("artifactType" in legacyBody) && !("schemaVersion" in legacyBody), "legacy payload has no metadata");

// Create v1; client-supplied id/owner_key/created_at are ignored
rows = [legacyRow()];
let r = await call(list, {}, "POST", { ...v1Body, title: "New", ownerKey: "gm", id: "hijack", owner_key: "other", created_at: 0 });
assert.equal(r.status, 200);
const newId = r.body.id;
assert.notEqual(newId, "hijack");
assert.equal(row(newId).owner_key, "gm");
assert.ok(row(newId).created_at > 1e12, "server sets created_at");
assert.equal(row(newId).artifact_type, "sheet"); assert.equal(row(newId).schema_version, 1);
assert.equal(r.body.version, 1); assert.ok(!("owner_key" in r.body) && !("ownerKey" in r.body));

// Old client (no metadata) can still create; row stays legacy
r = await call(list, {}, "POST", { ...legacyBody, title: "Old client", ownerKey: "gm" });
assert.equal(r.status, 200); assert.equal(row(r.body.id).schema_version, null); assert.equal(r.body.version, 0);

// Bad metadata is refused
for (const bad of [{ artifactType: "emailThread", schemaVersion: 1 }, { artifactType: "bogus", schemaVersion: 1 }, { artifactType: "sheet", schemaVersion: 2 }, { artifactType: "sheet" }, { schemaVersion: 1 }, { artifactType: "sheet", schemaVersion: "1" }]) {
  const n = rows.length;
  r = await call(list, {}, "POST", { ...legacyBody, ownerKey: "gm", ...bad });
  assert.equal(r.status, 400, `rejects ${JSON.stringify(bad)}`); assert.equal(rows.length, n, "nothing inserted");
}

// Release A: overwrite legacy with legacy payload -> same id, still legacy, updated_at set
r = await call(one, { id: "leg9", owner: "gm" }, "PUT", { ...legacyBody, title: "Old nine edited" });
assert.equal(r.status, 200); assert.equal(r.body.id, "leg9");
assert.equal(row("leg9").title, "Old nine edited"); assert.equal(row("leg9").schema_version, null);
assert.equal(row("leg9").owner_key, "gm"); assert.ok(row("leg9").updated_at > 1e12);
assert.equal((await call(one, { id: "leg9" })).status, 200, "share link survives save");
assert.ok((await call(list, { owner: "gm" })).body.some((a: any) => a.id === "leg9"), "still in library");

// Duplicate legacy -> new id, original untouched
const before = JSON.stringify(row("leg9"));
r = await call(list, {}, "POST", { ...v1Body, title: "Old nine (copy)", ownerKey: "gm" });
assert.notEqual(r.body.id, "leg9"); assert.equal(JSON.stringify(row("leg9")), before, "original untouched");

// Wrong GM key can't upgrade or edit
r = await call(one, { id: "leg9", owner: "intruder" }, "PUT", { ...v1Body, title: "pwned" });
assert.equal(r.status, 403); assert.equal(row("leg9").title, "Old nine edited"); assert.equal(row("leg9").schema_version, null);

// Release B: upgrade on save -> same id + owner, now v1, share link works and reports v1
r = await call(one, { id: "leg9", owner: "gm" }, "PUT", { ...v1Body, title: "Old nine v1" });
assert.equal(r.status, 200); assert.equal(r.body.id, "leg9"); assert.equal(r.body.version, 1);
assert.equal(row("leg9").schema_version, 1); assert.equal(row("leg9").artifact_type, "sheet"); assert.equal(row("leg9").owner_key, "gm");
const shared = await call(one, { id: "leg9" });
assert.equal(shared.status, 200); assert.equal(shared.body.version, 1); assert.equal(shared.body.shareSlug, "leg9");

// Old client saving a v1 row must NOT downgrade it
r = await call(one, { id: "leg9", owner: "gm" }, "PUT", { ...legacyBody, title: "Old client edit" });
assert.equal(r.status, 200); assert.equal(row("leg9").schema_version, 1, "no downgrade"); assert.equal(r.body.version, 1);

// Bad metadata on PUT is refused and changes nothing
r = await call(one, { id: "leg9", owner: "gm" }, "PUT", { ...v1Body, schemaVersion: 7, title: "nope" });
assert.equal(r.status, 400); assert.equal(row("leg9").title, "Old client edit");

// Library: mixed v0/v1 rows, newest first, no keys
rows = [{ ...legacy, id: "a", created_at: 10 }, { ...v1, id: "b", created_at: 30 }, { ...legacy, id: "c", created_at: 20 }];
const mixed = await call(list, { owner: "gm" });
assert.deepEqual(mixed.body.map((x: any) => [x.id, x.version]), [["b", 1], ["c", 0], ["a", 0]]);

// ---- Phase 7: /s/:id link-preview page ----
{
  rows = [
    { ...legacy, id: "shr1", title: "PRIVATE", blocks: [{ id: "h", type: "headline", text: "NEON <b>RIOT</b>", size: "lead" }] },
    { ...legacy, id: "bad2", schema_version: 42 },
  ];
  const ok = await call(sharePage, { id: "shr1" });
  assert.equal(ok.status, 200);
  assert.match(ok.headers["content-type"], /text\/html/);
  assert.ok(ok.body.includes('og:title" content="NEON &lt;b&gt;RIOT&lt;/b&gt; | NCT"'));
  assert.ok(ok.body.includes("https://screamsheet.vercel.app/og-default.png"));
  assert.ok(ok.body.includes("url=/#/s/shr1"));
  assert.ok(!ok.body.includes("PRIVATE"), "private title must not leak");
  assert.match(ok.headers["cache-control"], /s-maxage=300/);
  const missing = await call(sharePage, { id: "nope" });
  assert.equal(missing.status, 404);
  assert.ok(missing.body.includes("Screamsheet not found"));
  const invalid = await call(sharePage, { id: "../x" });
  assert.equal(invalid.status, 404);
  const corrupt = await call(sharePage, { id: "bad2" });
  assert.equal(corrupt.status, 200, "unreadable rows still redirect to the app's error state");
  assert.ok(corrupt.body.includes("url=/#/s/bad2"));
  const post = await call(sharePage, { id: "shr1" }, "POST");
  assert.equal(post.status, 405);
}

// ---- Phase 8: text threads + type-change guard ----
{
  const textBody = {
    title: "Fixer chat",
    template: "text-cyber",
    branding: {},
    settings: {
      platform: "cyber",
      participants: [{ id: "me", name: "You", color: "#00e5ff" }, { id: "f", name: "Fixer", color: "#ff2bd6" }],
      selfId: "me", headerTitle: "FIXER", headerSubtitle: "", clock: "11:47 PM", showAttribution: true,
    },
    blocks: [{ id: "m1", from: "f", body: "Got work.", sentAt: "", kind: "text", status: "none" }],
    artifactType: "textThread",
    schemaVersion: 1,
  };
  rows = [{ ...legacy, id: "legT" }];
  let t = await call(list, {}, "POST", { ...textBody, ownerKey: "gm" });
  assert.equal(t.status, 200);
  const tid = t.body.id;
  assert.equal(row(tid).artifact_type, "textThread"); assert.equal(row(tid).schema_version, 1);
  assert.equal(t.body.type, "textThread"); assert.equal(t.body.messages[0].body, "Got work.");
  assert.equal((await call(one, { id: tid })).body.platform, "cyber");
  // Library returns sheets and threads together
  const lib = await call(list, { owner: "gm" });
  assert.deepEqual(lib.body.map((a: any) => a.type).sort(), ["sheet", "textThread"]);
  // Share page uses thread content, not the private title
  const sp = await call(sharePage, { id: tid });
  assert.ok(sp.body.includes('og:title" content="Messages with FIXER'));
  assert.ok(!sp.body.includes("Fixer chat"));
  // Bad thread payloads -> 400, nothing written
  for (const bad of [
    { settings: { ...textBody.settings, platform: "nokia" } },
    { settings: { ...textBody.settings, participants: [] } },
    { blocks: [{ body: "no id" }] },
    { blocks: Array.from({ length: 301 }, (_, i) => ({ id: `m${i}` })) },
  ]) {
    const n = rows.length;
    t = await call(list, {}, "POST", { ...textBody, ownerKey: "gm", ...bad });
    assert.equal(t.status, 400, `rejects ${JSON.stringify(bad).slice(0, 60)}`); assert.equal(rows.length, n);
  }
  // Update thread in place
  t = await call(one, { id: tid, owner: "gm" }, "PUT", { ...textBody, title: "Fixer chat v2" });
  assert.equal(t.status, 200); assert.equal(row(tid).title, "Fixer chat v2");
  // Type can't change: sheet payload onto a thread, thread onto a legacy sheet, legacy (no metadata) onto a thread
  t = await call(one, { id: tid, owner: "gm" }, "PUT", { ...v1Body, title: "hijack" });
  assert.equal(t.status, 409); assert.equal(row(tid).title, "Fixer chat v2");
  t = await call(one, { id: tid, owner: "gm" }, "PUT", { ...legacyBody, title: "hijack" });
  assert.equal(t.status, 409); assert.equal(row(tid).artifact_type, "textThread");
  const legBefore = JSON.stringify(row("legT"));
  t = await call(one, { id: "legT", owner: "gm" }, "PUT", textBody);
  assert.equal(t.status, 409); assert.equal(JSON.stringify(row("legT")), legBefore, "legacy row untouched");
  // Wrong key still 403 before the type check
  t = await call(one, { id: tid, owner: "intruder" }, "PUT", textBody);
  assert.equal(t.status, 403);
}

console.log("Vercel API checks passed (incl. Phase 5 write path, Phase 7 share page, Phase 8 text threads)");
