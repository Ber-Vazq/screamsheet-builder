// Phase 6 unit checks: content fingerprint + local drafts (no browser needed).
// Run: npx tsx script/check-phase6.ts
import assert from "node:assert/strict";
import { stableStringify, sheetContentHash } from "../client/src/lib/sheetSnapshot";
import {
  draftKey, encodeDraft, decodeDraft, stripImages, shouldOfferDraft, writeDraft, readDraft, clearDraft, MAX_DRAFT_CHARS,
} from "../client/src/lib/drafts";

const sheet: any = {
  id: "abc", type: "sheet", title: "Ep 4", createdAt: 1, updatedAt: null, shareSlug: "abc", gmKeyScoped: true, version: 1,
  template: "nct-tech",
  branding: { outlet: "NCT", tagline: "NEWS", accent: "#f00", headerBg: "#fff", headerText: "#000", logoStyle: "nct" },
  settings: { clock: "1", categories: ["A"], activeCategory: "A", showNav: true, ticker: "", columns: 1 },
  blocks: [{ id: "b1", type: "paragraph", text: "hi" }, { id: "i1", type: "image", src: "data:image/png;base64,AAAA", caption: "c" }],
};

// 1. Key order never makes a sheet look dirty; real edits do.
assert.equal(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] }), stableStringify({ a: [1, { c: 3, d: 2 }], b: 1 }));
const h = sheetContentHash(sheet, "nct-tech");
assert.equal(h, sheetContentHash({ ...sheet, branding: { ...Object.fromEntries(Object.entries(sheet.branding).reverse()) } }, "nct-tech"));
assert.notEqual(h, sheetContentHash({ ...sheet, title: "Ep 5" }, "nct-tech"));
assert.notEqual(h, sheetContentHash({ ...sheet, blocks: [...sheet.blocks].reverse() }, "nct-tech"), "reorder is an edit");
assert.notEqual(h, sheetContentHash(sheet, "custom"), "template is part of what gets saved");
assert.equal(h, sheetContentHash({ ...sheet, updatedAt: 999, version: 0, id: "zzz" }, "nct-tech"), "metadata isn't content");

// 2. Draft keys
assert.equal(draftKey({ editId: "x1", loadId: null, template: "t" }), "screamsheet:draft:x1");
assert.equal(draftKey({ editId: null, loadId: "x1", template: "t" }), "screamsheet:draft:copy:x1");
assert.equal(draftKey({ editId: null, loadId: null, template: "t" }), "screamsheet:draft:new:t");

// 3. Encode/decode round trip; corrupt drafts are ignored
const enc = encodeDraft(sheet, h, 123)!;
const dec = decodeDraft(enc)!;
assert.equal(dec.savedAt, 123); assert.equal(dec.imagesStripped, false); assert.deepEqual(dec.sheet, sheet);
for (const bad of [null, "", "{nope", '{"v":2}', JSON.stringify({ v: 1, savedAt: 1, hash: "x", sheet: { type: "textThread" } })]) {
  assert.equal(decodeDraft(bad as any), null);
}

// 4. Oversized drafts drop images (blocks, ad backgrounds, two-column, logo) but keep text
const huge = "data:image/png;base64," + "A".repeat(MAX_DRAFT_CHARS);
const big = {
  ...sheet,
  branding: { ...sheet.branding, logoStyle: "custom-image", logoSrc: huge },
  blocks: [...sheet.blocks, { id: "i2", type: "image", src: huge, caption: "x" }, { id: "ad", type: "ad", text: "t", sponsor: "s", bgImage: huge, textColor: "#000" },
    { id: "tc", type: "two-column", left: { kind: "image", src: huge, caption: "" }, right: { kind: "text", content: "keep me" } }],
};
const bigDec = decodeDraft(encodeDraft(big, "hh"))!;
assert.equal(bigDec.imagesStripped, true);
assert.ok(!JSON.stringify(bigDec).includes("data:image"), "no base64 left");
assert.equal(bigDec.sheet.blocks.length, big.blocks.length, "no blocks lost");
assert.equal((bigDec.sheet.blocks[4] as any).right.content, "keep me");
assert.equal(stripImages(sheet)[1], true); assert.equal(stripImages({ ...sheet, blocks: [] })[1], false);
assert.equal(encodeDraft({ ...sheet, blocks: [{ id: "p", type: "paragraph", text: "x".repeat(MAX_DRAFT_CHARS) }] }, "h"), null, "text too big -> no draft");

// 5. When to offer a restore
assert.equal(shouldOfferDraft(null, h, null), false);
assert.equal(shouldOfferDraft(dec, h, null), false, "same content as loaded");
assert.equal(shouldOfferDraft({ ...dec, hash: "other" }, h, null), true, "new sheet with edits");
assert.equal(shouldOfferDraft({ ...dec, hash: "other", savedAt: 100 }, h, 200), false, "server is newer");
assert.equal(shouldOfferDraft({ ...dec, hash: "other", savedAt: 300 }, h, 200), true, "draft is newer");

// 6. Storage guards: blocked storage, quota errors
const store = new Map<string, string>();
let quota = Infinity;
(globalThis as any).window = { localStorage: {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { if (v.length > quota) throw new Error("QuotaExceededError"); store.set(k, v); },
  removeItem: (k: string) => store.delete(k),
} };
assert.equal(writeDraft("k", sheet, h), "saved"); assert.equal(readDraft("k")!.hash, h);
// Nearly-full storage: the full draft doesn't fit, the image-free one does.
const withImg = { ...sheet, blocks: [{ id: "i", type: "image", src: "data:image/png;base64," + "B".repeat(4000), caption: "" }] };
quota = encodeDraft(stripImages(withImg)[0], "h2")!.length + 50;
assert.equal(writeDraft("k2", withImg, "h2"), "stripped"); assert.equal(readDraft("k2")!.imagesStripped, true);
quota = 10; assert.equal(writeDraft("k3", sheet, h), "too-large");
clearDraft("k"); assert.equal(readDraft("k"), null);
(globalThis as any).window = { get localStorage() { throw new Error("SecurityError"); } };
assert.equal(writeDraft("k", sheet, h), "unavailable"); assert.equal(readDraft("k"), null); clearDraft("k");

console.log("Phase 6 checks passed");
