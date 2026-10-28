// Phase 9 unit checks: email-thread codec, write metadata, templates, drafts, hashing, share text.
// Run: npx tsx script/check-phase9.ts
import assert from "node:assert/strict";
import { deserializeStoredRecord, serializeArtifactForStorage } from "../shared/artifactCodec";
import { normalizeEmailSettings, normalizeEmailMessages, validateThreadPayload, MAX_MESSAGES } from "../shared/threadCodec";
import { parseWriteMetadata, chooseWriteTarget, typeChangeError, buildWritePayload } from "../shared/writeMetadata";
import { describeArtifact } from "../shared/shareMeta";
import { decodeDraft, encodeDraft, stripImages } from "../client/src/lib/drafts";
import { emailThreadContentHash } from "../client/src/lib/sheetSnapshot";
import {
  EMAIL_TEMPLATES, emailThreadFromTemplate, getEmailTemplate, parseAddressList, quoteOf, replySubject,
} from "../client/src/lib/emailTemplates";
import type { EmailThreadArtifact } from "../shared/artifact";

const settings = {
  style: "terminal", clientName: "TACNET", mailbox: "reyes@tac.mil", subject: "OPORD 0412",
  classification: "SECRET", accent: "#7cfc00", showAttribution: false,
};
const messages = [
  { id: "e1", fromName: "Hale", fromAddress: "hale@tac.mil", to: ["reyes@tac.mil"], cc: [], subject: "OPORD 0412", body: "Intercept at 44-17.\nMinimize witnesses.", sentAt: "0300Z", attachments: ["grid.img"], quoted: "", flagged: false },
  { id: "e2", fromName: "Reyes", fromAddress: "reyes@tac.mil", to: ["hale@tac.mil"], cc: ["cmd@tac.mil"], subject: "RE: OPORD 0412", body: "ACK.", sentAt: "0322Z", attachments: [], quoted: "Minimize witnesses.", flagged: true },
];
const row = {
  id: "eml1", title: "Dust Devil (private)", template: "email-militech-ops", branding: "{}",
  settings: JSON.stringify(settings), blocks: JSON.stringify(messages),
  owner_key: "gm", created_at: 100, updated_at: 200, artifact_type: "emailThread", schema_version: 1,
};

// --- decode ---
const e = deserializeStoredRecord(row) as EmailThreadArtifact;
assert.equal(e.type, "emailThread");
assert.equal(e.version, 1);
assert.equal(e.template, "email-militech-ops");
assert.equal(e.style, "terminal");
assert.equal(e.showAttribution, false);
assert.equal(e.messages.length, 2);
assert.deepEqual(e.messages[1].cc, ["cmd@tac.mil"]);
assert.equal(e.messages[1].flagged, true);

// --- round trip (decode -> serialize -> decode) is lossless ---
const stored = serializeArtifactForStorage(e, "v1");
assert.equal(stored.artifact_type, "emailThread");
assert.equal(stored.schema_version, 1);
const again = deserializeStoredRecord({ ...row, ...stored, settings: stored.settings, blocks: stored.blocks }) as EmailThreadArtifact;
assert.deepEqual(again.messages, e.messages);
assert.equal(again.subject, e.subject);
assert.throws(() => serializeArtifactForStorage(e, "legacy"), "emails have no legacy format");

// --- lenient reads: odd fields get defaults instead of breaking the thread ---
const s = normalizeEmailSettings({ style: "outlook", accent: "red", clientName: 7 });
assert.equal(s.style, "corporate");
assert.equal(s.clientName, "SECURE MAIL");
assert.match(s.accent, /^#/);
const ms = normalizeEmailMessages([{ id: "a", to: "not-a-list", flagged: "yes" }, { body: "no id" }, null]);
assert.equal(ms.length, 1, "messages without an id are dropped");
assert.deepEqual(ms[0].to, []);
assert.equal(ms[0].flagged, false);
assert.equal(normalizeEmailMessages(Array.from({ length: MAX_MESSAGES + 5 }, (_, i) => ({ id: `m${i}` }))).length, MAX_MESSAGES);

// --- server validation ---
assert.equal(validateThreadPayload("emailThread", { settings, blocks: messages }), null);
assert.match(validateThreadPayload("emailThread", { settings: { ...settings, style: "x" }, blocks: [] })!, /style/);
assert.match(validateThreadPayload("emailThread", { settings, blocks: [{}] })!, /id/);
assert.match(validateThreadPayload("emailThread", { settings: [], blocks: [] })!, /settings/);

// --- write metadata ---
assert.deepEqual(parseWriteMetadata({ artifactType: "emailThread", schemaVersion: 1 }), { artifactType: "emailThread", schemaVersion: 1 });
assert.throws(() => parseWriteMetadata({ artifactType: "emailThread", schemaVersion: 2 }));
assert.equal(chooseWriteTarget("update", 0, false, "emailThread"), "v1");
assert.equal(typeChangeError("emailThread", { artifactType: "emailThread", schemaVersion: 1 }), null);
assert.match(typeChangeError("emailThread", { artifactType: "textThread", schemaVersion: 1 })!, /email thread.*text thread/);
assert.match(typeChangeError(null, { artifactType: "emailThread", schemaVersion: 1 })!, /screamsheet.*email thread/);
assert.match(typeChangeError("emailThread", null)!, /email thread.*screamsheet/);

// --- every template pack is a valid write ---
assert.equal(EMAIL_TEMPLATES.length, 5);
const ids = new Set<string>();
for (const tpl of EMAIL_TEMPLATES) {
  assert.ok(tpl.id.startsWith("email-"), tpl.id);
  assert.ok(!ids.has(tpl.id)); ids.add(tpl.id);
  const a = emailThreadFromTemplate(tpl);
  assert.equal(a.type, "emailThread");
  assert.equal(a.showAttribution, true, "new threads carry the credit line");
  assert.ok(a.messages.length >= 1, tpl.id);
  assert.equal(new Set(a.messages.map((m) => m.id)).size, a.messages.length, "unique message ids");
  const body = buildWritePayload(a, "v1");
  assert.equal(body.artifactType, "emailThread");
  assert.equal(body.schemaVersion, 1);
  assert.ok(!("id" in body) && !("owner_key" in body));
  assert.equal(validateThreadPayload("emailThread", body as Record<string, unknown>), null, tpl.id);
  // and it reads back identically
  const back = deserializeStoredRecord({ ...row, ...serializeArtifactForStorage(a, "v1"), id: "tpl1", template: tpl.id }) as EmailThreadArtifact;
  assert.deepEqual(back.messages, a.messages, tpl.id);
}
assert.equal(getEmailTemplate("nope").id, EMAIL_TEMPLATES[0].id, "unknown template falls back");
// Two builds of the same pack get fresh ids (no shared state between threads)
assert.notEqual(emailThreadFromTemplate(EMAIL_TEMPLATES[0]).messages[0].id, emailThreadFromTemplate(EMAIL_TEMPLATES[0]).messages[0].id);

// --- editor helpers ---
assert.equal(replySubject("Hello"), "RE: Hello");
assert.equal(replySubject("re: Hello"), "re: Hello", "no RE: RE:");
assert.equal(replySubject(""), "RE:");
assert.equal(quoteOf(messages[0] as any), "Intercept at 44-17.\nMinimize witnesses.");
assert.deepEqual(parseAddressList("a@x, b@y; ,c@z,"), ["a@x", "b@y", "c@z"]);

// --- drafts ---
const [stripped, did] = stripImages(e);
assert.equal(did, false); assert.equal(stripped, e);
const raw = encodeDraft(e, emailThreadContentHash(e, e.template), 1000);
assert.ok(raw);
const d = decodeDraft(raw);
assert.ok(d);
assert.equal(d!.sheet.type, "emailThread");
assert.deepEqual((d!.sheet as EmailThreadArtifact).messages, e.messages);

// --- hashing: content changes move the hash; the private id doesn't ---
const h = emailThreadContentHash(e, e.template);
assert.equal(emailThreadContentHash({ ...e, id: "other" }, e.template), h);
assert.notEqual(emailThreadContentHash({ ...e, subject: "x" }, e.template), h);
assert.notEqual(emailThreadContentHash({ ...e, messages: [...e.messages].reverse() }, e.template), h, "order matters");
assert.notEqual(emailThreadContentHash({ ...e, messages: [{ ...e.messages[0], flagged: true }, e.messages[1]] }, e.template), h);

// --- share text uses the subject + first body, never the private title ---
const meta = describeArtifact(e);
assert.equal(meta.title, "OPORD 0412");
assert.ok(meta.description.startsWith("Intercept at 44-17."));
assert.ok(!JSON.stringify(meta).includes("private"));
assert.equal(describeArtifact({ ...e, subject: "", messages: [] }).title, "Intercepted email");

console.log("Phase 9 checks passed");
