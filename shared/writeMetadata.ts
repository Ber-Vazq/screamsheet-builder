// Phase 5: the write-side contract for artifact metadata.
// Shared by the Vercel API, the local Express API, and the builder client so
// all three agree on what may be written and when.
import type { Artifact } from "./artifact.js";
import { serializeArtifactForStorage, type StorageTarget } from "./artifactCodec.js";

/** Metadata a client may ask the server to persist. null = "legacy write, leave columns alone". */
export type WritableType = "sheet" | "textThread" | "emailThread";
export type WriteMetadata = { artifactType: WritableType; schemaVersion: 1 } | null;

export class WriteMetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriteMetadataError";
  }
}

/** Types/versions the API accepts on write. Phase 8 added text threads; Phase 9 email threads. */
const WRITABLE_TYPES = new Set<string>(["sheet", "textThread", "emailThread"]);
const WRITABLE_VERSIONS = new Set([1]);

function pick(body: Record<string, unknown>, camel: string, snake: string): unknown {
  return body[camel] !== undefined ? body[camel] : body[snake];
}

/**
 * Read artifactType / schemaVersion from a request body.
 * - Both absent -> null (old client or Release A legacy write). Always allowed.
 * - Otherwise both must be present and writable, or this throws (-> 400).
 */
export function parseWriteMetadata(body: unknown): WriteMetadata {
  const b = (body ?? {}) as Record<string, unknown>;
  const type = pick(b, "artifactType", "artifact_type");
  const version = pick(b, "schemaVersion", "schema_version");
  const absent = (v: unknown) => v === undefined || v === null;
  if (absent(type) && absent(version)) return null;
  if (typeof type !== "string" || !WRITABLE_TYPES.has(type)) {
    throw new WriteMetadataError(`artifactType must be one of: ${Array.from(WRITABLE_TYPES).join(", ")}`);
  }
  if (typeof version !== "number" || !WRITABLE_VERSIONS.has(version)) {
    throw new WriteMetadataError(`schemaVersion must be one of: ${Array.from(WRITABLE_VERSIONS).join(", ")}`);
  }
  return { artifactType: type as WritableType, schemaVersion: 1 };
}

/** The artifact type a write is for. No metadata = an old sheet client. */
export function writeType(meta: WriteMetadata): WritableType {
  return meta ? meta.artifactType : "sheet";
}

/**
 * PUT guard: a row can't change type (a sheet can't become a text thread).
 * storedType null/undefined means a legacy row, which is a sheet.
 * Returns an error message for a 409, or null if allowed.
 */
export function typeChangeError(storedType: string | null | undefined, meta: WriteMetadata): string | null {
  const stored = storedType || "sheet";
  const incoming = writeType(meta);
  if (stored === incoming) return null;
  const label = (t: string) => (t === "textThread" ? "text thread" : t === "emailThread" ? "email thread" : t === "sheet" ? "screamsheet" : t);
  return `This is a ${label(stored)}; it can't be saved as a ${label(incoming)}.`;
}

/** Storage columns to set for a write. Empty object = don't touch the columns (never downgrade). */
export function metadataColumns(meta: WriteMetadata): { artifact_type?: string; schema_version?: number } {
  return meta ? { artifact_type: meta.artifactType, schema_version: meta.schemaVersion } : {};
}

/**
 * Which format the client should write.
 * - create (new sheet or "save as copy"): always v1.
 * - update: v1 if the stored row is already v1, or if upgrade-on-save (Release B) is on;
 *   otherwise legacy, so editing an old sheet leaves its row untouched (Release A).
 */
export function chooseWriteTarget(
  mode: "create" | "update",
  storedVersion: number | null,
  upgradeOnSave: boolean,
  type: WritableType = "sheet",
): StorageTarget {
  // Threads have no legacy format, so they are always v1.
  if (mode === "create" || type !== "sheet") return "v1";
  return upgradeOnSave || storedVersion === 1 ? "v1" : "legacy";
}

/**
 * Build the JSON body for POST/PUT. Never includes id, owner_key or created_at;
 * the server owns those. Metadata goes out as camelCase artifactType/schemaVersion.
 */
export function buildWritePayload(artifact: Artifact, target: StorageTarget): Record<string, unknown> {
  const { id: _id, artifact_type, schema_version, ...rest } = serializeArtifactForStorage(artifact, target);
  return target === "v1" ? { ...rest, artifactType: artifact_type, schemaVersion: schema_version } : rest;
}
