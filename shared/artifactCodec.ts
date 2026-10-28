// Compatibility layer: the ONLY place that knows what stored rows look like.
import type { Artifact, SheetArtifact } from "./artifact.js";
import type { Branding, SheetSettings, Block } from "./schema.js";

/** A raw row from Supabase, Drizzle, or an API response. Deliberately loose. */
export type StoredRecord = Record<string, unknown>;

export class ArtifactDecodeError extends Error {
  constructor(message: string, public readonly recordId?: string) {
    super(message);
    this.name = "ArtifactDecodeError";
  }
}

/** Read a field that may be snake_case (Supabase) or camelCase (Drizzle). */
function field(row: StoredRecord, snake: string, camel: string): unknown {
  return row[snake] !== undefined ? row[snake] : row[camel];
}

/** JSON columns can arrive as parsed objects or raw strings. Accept both. */
function json<T>(value: unknown, name: string, id?: string): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      throw new ArtifactDecodeError(`Malformed JSON in "${name}"`, id);
    }
  }
  if (value === null || value === undefined) {
    throw new ArtifactDecodeError(`Missing "${name}"`, id);
  }
  return value as T;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && !isNaN(Number(value))) return Number(value);
  return null;
}

function idOf(record: StoredRecord): string | undefined {
  return typeof record.id === "string" ? record.id : undefined;
}

export function isLegacySheetRow(row: StoredRecord): boolean {
  const version = field(row, "schema_version", "schemaVersion");
  const type = field(row, "artifact_type", "artifactType");
  const noVersion = version === undefined || version === null || version === 0;
  const sheetOrUnset = type === undefined || type === null || type === "sheet";
  return noVersion && sheetOrUnset;
}

export function normalizeLegacySheetToArtifact(row: StoredRecord): SheetArtifact {
  const id = row.id;
  if (typeof id !== "string" || id === "") {
    throw new ArtifactDecodeError("Row has no id");
  }
  const ownerKey = field(row, "owner_key", "ownerKey");

  return {
    id,
    type: "sheet",
    title: typeof row.title === "string" ? row.title : "Untitled",
    createdAt: toNumberOrNull(field(row, "created_at", "createdAt")),
    updatedAt: toNumberOrNull(field(row, "updated_at", "updatedAt")),
    shareSlug: id,
    gmKeyScoped: typeof ownerKey === "string" && ownerKey !== "",
    version: 0,
    template: typeof row.template === "string" ? row.template : "custom",
    branding: json<Branding>(row.branding, "branding", id),
    settings: json<SheetSettings>(row.settings, "settings", id),
    blocks: json<Block[]>(row.blocks, "blocks", id),
  };
}

/** Single entry point for reading any stored record. */
export function deserializeStoredRecord(record: StoredRecord): Artifact {
  if (isRuntimeArtifact(record)) {
    return record as unknown as Artifact;
  }
  if (isLegacySheetRow(record)) {
    return normalizeLegacySheetToArtifact(record);
  }
  const version = Number(field(record, "schema_version", "schemaVersion"));
  const type = field(record, "artifact_type", "artifactType");

  switch (version) {
    case 1:
      return decodeV1(record, type);
    default:
      throw new ArtifactDecodeError(`Unknown schema_version ${String(version)}`, idOf(record));
  }
}

function decodeV1(record: StoredRecord, type: unknown): Artifact {
  if (type === "sheet") {
    // v1 sheets share legacy columns; only the version label differs.
    return { ...normalizeLegacySheetToArtifact(record), version: 1 };
  }
  throw new ArtifactDecodeError(`artifact_type "${String(type)}" is not supported yet`, idOf(record));
}

export type StorageTarget = "legacy" | "v1";

/**
 * Artifact -> storage row. Never includes owner_key (server attaches it from
 * the request) or created_at (belongs to the insert). Defaults to "legacy" so
 * Release A writes rows identical to today's.
 */
export function serializeArtifactForStorage(
  artifact: Artifact,
  target: StorageTarget = "legacy",
): StoredRecord {
  if (artifact.type !== "sheet") {
    throw new ArtifactDecodeError(
      target === "legacy"
        ? `${artifact.type} cannot be stored in legacy format`
        : `${artifact.type} storage not implemented yet`,
      artifact.id,
    );
  }
  const row: StoredRecord = {
    id: artifact.id,
    title: artifact.title,
    template: artifact.template,
    branding: artifact.branding,
    settings: artifact.settings,
    blocks: artifact.blocks,
  };
  if (target === "v1") {
    row.artifact_type = "sheet";
    row.schema_version = 1;
  }
  return row;
}

// ---------- Phase 4: read-side helpers used by the API layers ----------

const ARTIFACT_TYPES = new Set(["sheet", "textThread", "emailThread"]);

/**
 * True for an object that is ALREADY a runtime artifact (e.g. an API response
 * the client is decoding again). These carry `version` + `shareSlug` instead
 * of storage columns, and must pass through unchanged — re-normalizing them
 * would reset version to 0 and gmKeyScoped to false.
 */
export function isRuntimeArtifact(record: StoredRecord): boolean {
  return (
    typeof record.type === "string" &&
    ARTIFACT_TYPES.has(record.type) &&
    typeof record.shareSlug === "string" &&
    (record.version === 0 || record.version === 1)
  );
}

/** Structured, greppable log line for anything the codec could not read. */
export function logDecodeFailure(context: string, record: StoredRecord, err: unknown): void {
  const id = err instanceof ArtifactDecodeError && err.recordId ? err.recordId : idOf(record);
  console.error(
    "[artifact-decode]",
    JSON.stringify({
      context,
      id: id ?? null,
      schemaVersion: field(record, "schema_version", "schemaVersion") ?? null,
      artifactType: field(record, "artifact_type", "artifactType") ?? null,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
}

/**
 * Decode a list (GM library). One bad row is logged and skipped instead of
 * failing the whole request, so a single corrupt sheet can't hide the rest.
 */
export function deserializeMany(
  records: StoredRecord[],
  context: string,
): { artifacts: Artifact[]; skipped: number } {
  const artifacts: Artifact[] = [];
  let skipped = 0;
  for (const r of records) {
    try {
      artifacts.push(deserializeStoredRecord(r));
    } catch (err) {
      skipped++;
      logDecodeFailure(context, r, err);
    }
  }
  return { artifacts, skipped };
}
