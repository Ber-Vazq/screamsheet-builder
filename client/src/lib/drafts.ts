// Phase 6: local draft recovery.
// A draft is written to localStorage while there are unsaved edits and is
// cleared after a successful save. Every storage call is guarded: storage can
// be blocked (sandboxed iframes) or full (base64 images are big).
import type { Artifact, SheetArtifact } from "../../../shared/artifact";
import type { Block, Branding } from "../../../shared/schema";

const PREFIX = "screamsheet:draft:";
/** Stay well below the ~5 MB per-origin localStorage limit. */
export const MAX_DRAFT_CHARS = 4_000_000;

export interface Draft {
  v: 1;
  savedAt: number;
  /** Content hash of the draft (see sheetContentHash). */
  hash: string;
  /** True when images were removed to fit in storage. */
  imagesStripped: boolean;
  /** The artifact (named `sheet` for compatibility with Phase 6 drafts; may be a text thread). */
  sheet: Artifact;
}

/** draft:<id> when editing a saved sheet, draft:copy:<id> for ?load=, draft:new:<template> otherwise. */
export function draftKey(opts: { editId: string | null; loadId: string | null; template: string }): string {
  if (opts.editId) return `${PREFIX}${opts.editId}`;
  if (opts.loadId) return `${PREFIX}copy:${opts.loadId}`;
  return `${PREFIX}new:${opts.template}`;
}

const isData = (s: unknown) => typeof s === "string" && s.startsWith("data:");

/** Replace embedded base64 images with empty strings. Returns [artifact, didStrip]. */
export function stripImages<A extends Artifact>(a: A): [A, boolean] {
  if (a.type === "sheet") return stripSheetImages(a) as [A, boolean];
  if (a.type === "textThread") {
    let stripped = false;
    const messages = a.messages.map((m) => {
      if (!isData(m.imageSrc)) return m;
      stripped = true;
      return { ...m, imageSrc: "" };
    });
    return [{ ...a, messages } as A, stripped];
  }
  return [a, false]; // email threads have no embedded images
}

function stripSheetImages(sheet: SheetArtifact): [SheetArtifact, boolean] {
  let stripped = false;
  const clean = (s: unknown) => {
    if (isData(s)) { stripped = true; return ""; }
    return s;
  };
  const blocks = sheet.blocks.map((b): Block => {
    const x: any = { ...b };
    if ("src" in x) x.src = clean(x.src);
    if ("bgImage" in x) x.bgImage = clean(x.bgImage);
    if (x.type === "two-column") {
      for (const side of ["left", "right"]) {
        if (x[side]?.kind === "image") x[side] = { ...x[side], src: clean(x[side].src) };
      }
    }
    return x as Block;
  });
  const branding: Branding = { ...sheet.branding };
  if (isData(branding.logoSrc)) { branding.logoSrc = ""; stripped = true; }
  return [{ ...sheet, blocks, branding }, stripped];
}

/** Serialize a draft, stripping images if it is too large. null = cannot fit even without images. */
export function encodeDraft(sheet: Artifact, hash: string, now = Date.now()): string | null {
  const full = JSON.stringify({ v: 1, savedAt: now, hash, imagesStripped: false, sheet } satisfies Draft);
  if (full.length <= MAX_DRAFT_CHARS) return full;
  const [lean, didStrip] = stripImages(sheet);
  const small = JSON.stringify({ v: 1, savedAt: now, hash, imagesStripped: didStrip, sheet: lean } satisfies Draft);
  return small.length <= MAX_DRAFT_CHARS ? small : null;
}

export function decodeDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (d?.v !== 1 || typeof d.savedAt !== "number" || typeof d.hash !== "string") return null;
    const a = d.sheet;
    if (a?.type === "sheet") {
      if (!Array.isArray(a.blocks) || !a.branding || !a.settings) return null;
    } else if (a?.type === "textThread" || a?.type === "emailThread") {
      if (!Array.isArray(a.messages)) return null;
      if (a.type === "textThread" && !Array.isArray(a.participants)) return null;
    } else {
      return null;
    }
    return d as Draft;
  } catch {
    return null;
  }
}

export type DraftWriteResult = "saved" | "stripped" | "too-large" | "unavailable";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, sheet: Artifact, hash: string): DraftWriteResult {
  const ls = storage();
  if (!ls) return "unavailable";
  const encoded = encodeDraft(sheet, hash);
  if (!encoded) return "too-large";
  try {
    ls.setItem(key, encoded);
  } catch {
    // Quota hit (other drafts may be taking space): retry once without images.
    const [lean, didStrip] = stripImages(sheet);
    const retry = didStrip ? encodeDraft(lean, hash) : null;
    if (!retry) return "too-large";
    try {
      ls.setItem(key, retry.replace('"imagesStripped":false', '"imagesStripped":true'));
      return "stripped";
    } catch {
      return "too-large";
    }
  }
  return encoded.includes('"imagesStripped":true') ? "stripped" : "saved";
}

export function readDraft(key: string): Draft | null {
  const ls = storage();
  if (!ls) return null;
  try {
    return decodeDraft(ls.getItem(key));
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    /* blocked storage: nothing to clear */
  }
}

/**
 * Should we offer to restore this draft?
 * - It must differ from what was just loaded.
 * - For a saved sheet, it must be newer than the server's last change.
 */
export function shouldOfferDraft(draft: Draft | null, loadedHash: string, serverChangedAt: number | null): boolean {
  if (!draft) return false;
  if (draft.hash === loadedHash) return false;
  if (serverChangedAt !== null && draft.savedAt <= serverChangedAt) return false;
  return true;
}
