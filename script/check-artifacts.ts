// Run: npx tsx script/check-artifacts.ts
import assert from "node:assert/strict";
import {
  deserializeStoredRecord, isLegacySheetRow, serializeArtifactForStorage, ArtifactDecodeError,
  isRuntimeArtifact, deserializeMany,
} from "../shared/artifactCodec";

const branding = { outlet: "NIGHT CITY TODAY", tagline: "NEWS", accent: "#c0392b",
  headerBg: "#fff", headerText: "#111", logoStyle: "nct" };
const settings = { clock: "12:00 AM", categories: ["TECH"], activeCategory: "TECH",
  showNav: true, ticker: "", columns: 1 };
const blocks = [{ id: "b1", type: "paragraph", text: "Arasaka denies everything." }];

// 1. Supabase-shaped legacy row
const supa = { id: "abc123", title: "Ep 4", template: "nct-tech", branding, settings, blocks,
  owner_key: "secret", created_at: 1700000000000 };
assert.equal(isLegacySheetRow(supa), true);
const a = deserializeStoredRecord(supa);
assert.equal(a.type, "sheet");
assert.equal(a.shareSlug, "abc123");
assert.equal(a.gmKeyScoped, true);
assert.equal(a.version, 0);
assert.equal("owner_key" in a || "ownerKey" in a, false, "key must never leak");

// 2. Drizzle-shaped row with JSON as strings
const drizzle = { id: "d1", title: "Local", template: "custom",
  branding: JSON.stringify(branding), settings: JSON.stringify(settings),
  blocks: JSON.stringify(blocks), ownerKey: null, createdAt: 1 };
const d = deserializeStoredRecord(drizzle);
assert.equal(d.gmKeyScoped, false);
assert.equal(d.type === "sheet" && d.blocks.length, 1);

// 3. Public endpoint response (owner_key and created_at stripped)
const pub = deserializeStoredRecord({ id: "p1", title: "x", template: "nct-tech", branding, settings, blocks });
assert.equal(pub.createdAt, null);

// 4. Unknown version fails loudly with the record id
assert.throws(() => deserializeStoredRecord({ ...supa, schema_version: 99 }),
  (e: unknown) => e instanceof ArtifactDecodeError && e.recordId === "abc123");

// 5. Malformed JSON is caught
assert.throws(() => deserializeStoredRecord({ ...drizzle, blocks: "{oops" }), ArtifactDecodeError);

// 6. Legacy serialization matches today's columns (minus key/timestamp) and round-trips
const row = serializeArtifactForStorage(a);
assert.deepEqual(Object.keys(row).sort(), ["blocks", "branding", "id", "settings", "template", "title"]);
assert.equal(deserializeStoredRecord(row).id, "abc123");

// 7. v1 serialization adds metadata and reads back as version 1
const v1 = serializeArtifactForStorage(a, "v1");
assert.equal(v1.schema_version, 1);
assert.equal(deserializeStoredRecord(v1).version, 1);

// --- Phase 4 ---
// 8. Legacy row with the NEW columns present but NULL (what Supabase returns after the migration)
const withNullCols = deserializeStoredRecord({ ...supa, artifact_type: null, schema_version: null });
assert.equal(withNullCols.version, 0);

// 9. An already-decoded artifact passes through unchanged (client decoding an API response)
assert.equal(isRuntimeArtifact(a as any), true);
const again = deserializeStoredRecord(deserializeStoredRecord(v1) as any);
assert.equal(again.version, 1);
assert.equal(deserializeStoredRecord(a as any).gmKeyScoped, true);

// 10. Library decoding skips (and logs) bad rows instead of failing the whole list
const origErr = console.error; let logged = ""; console.error = (...x: unknown[]) => { logged += x.join(" "); };
const { artifacts, skipped } = deserializeMany([supa, { ...supa, id: "bad", schema_version: 99 }, drizzle], "test");
console.error = origErr;
assert.equal(artifacts.length, 2);
assert.equal(skipped, 1);
assert.ok(logged.includes("[artifact-decode]") && logged.includes('"id":"bad"'), "failure must be logged with id");

// 11. Mixed old/new rows in one list (legacy + v1) both decode
assert.equal(deserializeMany([supa, { ...supa, id: "new1", artifact_type: "sheet", schema_version: 1 }], "t").artifacts.length, 2);

console.log("All artifact checks passed");
