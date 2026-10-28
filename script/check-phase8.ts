// Phase 8 unit checks: text-thread codec, write metadata, type guard, drafts, hashing.
// Run: npx tsx script/check-phase8.ts
import assert from "node:assert/strict";
import { deserializeStoredRecord, serializeArtifactForStorage, ArtifactDecodeError } from "../shared/artifactCodec";
import { normalizeTextSettings, normalizeTextMessages, validateThreadPayload, MAX_PARTICIPANTS } from "../shared/threadCodec";
import { parseWriteMetadata, chooseWriteTarget, typeChangeError, buildWritePayload, writeType } from "../shared/writeMetadata";
import { describeArtifact } from "../shared/shareMeta";
import { decodeDraft, encodeDraft, stripImages } from "../client/src/lib/drafts";
import { textThreadContentHash, sheetContentHash } from "../client/src/lib/sheetSnapshot";
import type { TextThreadArtifact } from "../shared/artifact";

const settings = {
  platform: "ios",
  participants: [
    { id: "me", name: "You", color: "#0a84ff" },
    { id: "r", name: "Razor", color: "#ff375f" },
    { id: "d", name: "Dee", color: "#30d158" },
  ],
  selfId: "me",
  headerTitle: "Crew",
  headerSubtitle: "3 people",
  clock: "9:41",
  showAttribution: true,
};
const messages = [
  { id: "m1", from: "r", body: "Who took the van keys", sentAt: "9:12 PM", kind: "text", status: "none" },
  { id: "m2", from: "", body: "Dee renamed the group", sentAt: "", kind: "system", status: "none" },
  { id: "m3", from: "me", body: "", sentAt: "", kind: "image", status: "read", imageSrc: "data:image/png;base64,AAAA" },
];
const row = {
  id: "txt1", title: "Crew chat", template: "text-ios", branding: "{}",
  settings: JSON.stringify(settings), blocks: JSON.stringify(messages),
  owner_key: "gm", created_at: 100, updated_at: 200, artifact_type: "textThread", schema_version: 1,
};

// --- decode ---
const t = deserializeStoredRecord(row) as TextThreadArtifact;
assert.equal(t.type, "textThread");
assert.equal(t.version, 1);
assert.equal(t.template, "text-ios");
assert.equal(t.platform, "ios");
assert.equal(t.participants.length, 3);
assert.equal(t.messages[2].imageSrc, "data:image/png;base64,AAAA");
assert.equal(t.gmKeyScoped, true);
assert.ok(!("ownerKey" in t) && !("owner_key" in t), "owner key never exposed");
assert.equal(t.updatedAt, 200);

// --- round trip (v1 only) ---
const cols = serializeArtifactForStorage(t, "v1");
assert.equal(cols.artifact_type, "textThread");
assert.equal(cols.schema_version, 1);
assert.deepEqual(cols.branding, {});
assert.deepEqual(cols.blocks, t.messages);
const again = deserializeStoredRecord({ ...row, settings: cols.settings, blocks: cols.blocks }) as TextThreadArtifact;
assert.deepEqual({ ...again, createdAt: 0 }, { ...t, createdAt: 0 });
assert.throws(() => serializeArtifactForStorage(t, "legacy"), ArtifactDecodeError, "threads have no legacy format");

// --- lenient read: junk gets defaults, never crashes ---
const s2 = normalizeTextSettings({ platform: "nokia", participants: [{ id: "a" }, { id: "a" }, "x", { name: "no id" }], selfId: "zzz" });
assert.equal(s2.platform, "cyber");
assert.equal(s2.participants.length, 1, "dupes and id-less participants dropped");
assert.equal(s2.selfId, "a", "unknown selfId falls back to first participant");
assert.match(s2.participants[0].color, /^#/);
assert.equal(normalizeTextSettings(null).participants.length, 0);
const m2 = normalizeTextMessages([{ id: "x", kind: "weird", status: "lost" }, { body: "no id" }, 5]);
assert.equal(m2.length, 1);
assert.equal(m2[0].kind, "text");
assert.equal(m2[0].status, "none");
assert.equal(normalizeTextSettings({ participants: Array.from({ length: 20 }, (_, i) => ({ id: `p${i}` })) }).participants.length, MAX_PARTICIPANTS);
// corrupt JSON is still an error (logged and skipped by callers)
assert.throws(() => deserializeStoredRecord({ ...row, settings: "{not json" }), ArtifactDecodeError);
assert.throws(() => deserializeStoredRecord({ ...row, blocks: "{}" }), ArtifactDecodeError);

// --- write metadata ---
assert.deepEqual(parseWriteMetadata({ artifactType: "textThread", schemaVersion: 1 }), { artifactType: "textThread", schemaVersion: 1 });
assert.deepEqual(parseWriteMetadata({ artifactType: "emailThread", schemaVersion: 1 }), { artifactType: "emailThread", schemaVersion: 1 }, "email writable since Phase 9");
assert.equal(writeType(null), "sheet");
assert.equal(chooseWriteTarget("update", 0, false, "textThread"), "v1", "threads always v1");
assert.equal(chooseWriteTarget("update", 0, false, "sheet"), "legacy", "sheets keep Release A behavior");
assert.equal(chooseWriteTarget("update", 0, false), "legacy", "default type is sheet");
const body = buildWritePayload(t, "v1");
assert.equal(body.artifactType, "textThread");
assert.equal(body.schemaVersion, 1);
assert.ok(!("id" in body) && !("artifact_type" in body));
assert.equal(validateThreadPayload("textThread", body as any), null, "client payload passes server validation");

// --- type guard ---
assert.equal(typeChangeError(null, null), null, "legacy sheet + old client");
assert.equal(typeChangeError(null, { artifactType: "sheet", schemaVersion: 1 }), null, "legacy sheet upgrade");
assert.equal(typeChangeError("textThread", { artifactType: "textThread", schemaVersion: 1 }), null);
assert.match(typeChangeError(null, { artifactType: "textThread", schemaVersion: 1 })!, /screamsheet.*text thread/);
assert.match(typeChangeError("textThread", null)!, /text thread.*screamsheet/);
assert.match(typeChangeError("textThread", { artifactType: "sheet", schemaVersion: 1 })!, /text thread/);

// --- share preview ---
const d = describeArtifact(t);
assert.equal(d.title, "Messages with Crew");
assert.equal(d.description, "Who took the van keys", "skips system notes");
assert.equal(describeArtifact({ ...t, headerTitle: "" }).title, "Messages with Razor, Dee", "falls back to other participants");
assert.equal(describeArtifact({ ...t, headerTitle: "", participants: [] }).title, "Intercepted messages");

// --- drafts accept threads; images stripped per message ---
const enc = encodeDraft(t, "h1", 5)!;
const dec = decodeDraft(enc)!;
assert.equal(dec.sheet.type, "textThread");
const [lean, stripped] = stripImages(t);
assert.equal(stripped, true);
assert.equal((lean as TextThreadArtifact).messages[2].imageSrc, "");
assert.equal(t.messages[2].imageSrc, "data:image/png;base64,AAAA", "original untouched");
assert.equal(decodeDraft(JSON.stringify({ v: 1, savedAt: 1, hash: "x", imagesStripped: false, sheet: { type: "textThread" } })), null);
assert.equal(decodeDraft(JSON.stringify({ v: 1, savedAt: 1, hash: "x", imagesStripped: false, sheet: { type: "nope" } })), null);

// --- hashing ---
const h = textThreadContentHash(t, "text-ios");
assert.equal(h, textThreadContentHash({ ...t, id: "other", createdAt: 9, updatedAt: 9 }, "text-ios"), "ids/timestamps don't count");
assert.notEqual(h, textThreadContentHash({ ...t, clock: "9:42" }, "text-ios"));
assert.notEqual(h, textThreadContentHash({ ...t, messages: [...t.messages].reverse() }, "text-ios"), "order counts");
assert.notEqual(h, textThreadContentHash(t, "text-cyber"), "template counts");
// sheet hash format unchanged (sheetContentHash itself was not touched)
const sheetVec = sheetContentHash(
  { id: "", type: "sheet", title: "A", createdAt: null, updatedAt: null, shareSlug: "", gmKeyScoped: false, version: 0, template: "x",
    branding: { outlet: "O", tagline: "", accent: "#000", headerBg: "#fff", headerText: "#000", logoStyle: "nct" } as any,
    settings: { clock: "1", categories: [], activeCategory: "", showNav: false, ticker: "", columns: 1 } as any, blocks: [] },
  "x",
);
assert.match(sheetVec, /^[0-9a-f]{8}:1:0$/);

console.log("Phase 8 checks passed");
