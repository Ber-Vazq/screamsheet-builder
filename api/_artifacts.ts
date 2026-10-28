// Phase 4: every row leaving the Vercel API goes through the artifact codec.
// The returned artifact never contains owner_key (the codec has nowhere to put it).
import {
  deserializeStoredRecord,
  deserializeMany,
  logDecodeFailure,
  type StoredRecord,
} from "../shared/artifactCodec.js";

/** Legacy response shape, used only as a fallback after a successful write. */
export function toLegacyApi(row: any) {
  if (!row) return row;
  const { created_at, owner_key, ...rest } = row;
  return { ...rest, createdAt: created_at };
}

/** Decode one row. Returns null (and logs) if it can't be read. */
export function decodeRow(row: StoredRecord, context: string) {
  try {
    return deserializeStoredRecord(row);
  } catch (err) {
    logDecodeFailure(context, row, err);
    return null;
  }
}

/** Decode a library list; bad rows are logged and skipped. */
export function decodeRows(rows: StoredRecord[], context: string) {
  const { artifacts, skipped } = deserializeMany(rows, context);
  if (skipped) console.warn(`[artifact-decode] ${context}: skipped ${skipped} of ${rows.length} rows`);
  return artifacts;
}

/** After a write: return the artifact, or fall back to the legacy shape so a save never looks failed. */
export function decodeWritten(row: StoredRecord, context: string) {
  return decodeRow(row, context) ?? toLegacyApi(row);
}
