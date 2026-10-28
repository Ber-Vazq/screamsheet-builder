// Phase 6: content fingerprint used for dirty-state, autosave and drafts.
// Pure (no React, no storage) so it can be unit-tested with tsx.
import type { SheetArtifact } from "../../../shared/artifact";

/** JSON.stringify with sorted object keys, so key order never causes a false "unsaved". */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/** 32-bit FNV-1a, hex. Fast enough for multi-MB strings; collisions don't matter here. */
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Hash of exactly what a save would persist: title, template, branding,
 * settings, blocks. `template` is passed in because the URL template wins on
 * save (see useSheetPersistence).
 */
export function sheetContentHash(sheet: SheetArtifact, template: string): string {
  const { title, branding, settings, blocks } = sheet;
  return `${fnv1a(stableStringify({ title, template, branding, settings, blocks }))}:${title.length}:${blocks.length}`;
}
