// Run: npx tsx script/check-artifacts.ts
import assert from "node:assert/strict";
import {
  deserializeStoredRecord, isLegacySheetRow, serializeArtifactForStorage, ArtifactDecodeError,
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

console.log("All artifact checks passed");
