# Phase 4 Walkthrough — Read-Side Storage Compatibility

Goal: the database can hold old and new rows side by side, and **every row the API returns has gone through the artifact codec** (`shared/artifactCodec.ts`). Nothing writes the new columns yet; that's Phase 5.

## What changed

| File | Change |
|---|---|
| `supabase/migrations/20261028000000_phase4_backup.sql` | Full copy of `screamsheets` into private schema `backup` |
| `supabase/migrations/20261028000100_phase4_artifact_columns.sql` | Adds nullable `artifact_type`, `schema_version` + a check constraint on allowed types |
| `shared/schema.ts` | Drizzle columns `artifactType`, `schemaVersion` (nullable) |
| `server/storage.ts` | Adds the two columns to local SQLite on startup; **reads now use raw SQL** (see "Gotcha" below) |
| `shared/artifactCodec.ts` | `isRuntimeArtifact`, `logDecodeFailure`, `deserializeMany`; `.js` import suffixes for Vercel |
| `api/_artifacts.ts` | `decodeRow`, `decodeRows`, `decodeWritten` for the Vercel functions |
| `api/screamsheets/index.ts`, `[id].ts` | GET list / GET one / POST / PUT responses go through the codec |
| `server/routes.ts` | Same for the local Express server |
| `client/src/pages/Home.tsx`, `ViewSheet.tsx` | Typed as `SheetArtifact`; Home tolerates `createdAt: null` |
| `script/check-artifacts.ts` | +4 cases (null columns, pass-through, skip+log, mixed rows) |
| `script/check-vercel-api.ts` | Runs the real Vercel handlers against a stubbed Supabase |
| `script/e2e-legacy.py` | Browser test: legacy row in library, old share link, edit/overwrite, broken row |

## Request flow

```
Supabase / SQLite row
   │  (snake_case, JSON as object or text, maybe artifact_type / schema_version)
   ▼
deserializeStoredRecord
   ├─ already an artifact?            → pass through     (isRuntimeArtifact)
   ├─ NULL / 0 version, sheet / NULL? → legacy v0 sheet   (isLegacySheetRow)
   ├─ schema_version = 1, sheet       → v1 sheet
   └─ anything else                   → ArtifactDecodeError
   ▼
API response = SheetArtifact (never contains owner_key)
```

| Endpoint | On decode failure |
|---|---|
| `GET /api/screamsheets?owner=` (library) | Bad row **skipped**, rest returned, two log lines |
| `GET /api/screamsheets/:id` (share link) | `500 {"error":"This screamsheet could not be read."}` + log; ViewSheet shows its error state |
| `POST` / `PUT` (after a successful write) | Logged, response falls back to the legacy shape so the save still succeeds |

### Response shape (backward compatible)

The artifact is a **superset** of the old response: `id, title, template, branding, settings, blocks, createdAt` are unchanged, plus `type, shareSlug, gmKeyScoped, version, updatedAt`. Old clients and cached tabs keep working.

## Logging

All codec failures produce one greppable line:

```
[artifact-decode] {"context":"GET /api/screamsheets","id":"bad1","schemaVersion":42,"artifactType":null,"error":"Unknown schema_version 42"}
[artifact-decode] GET /api/screamsheets: skipped 1 of 4 rows
```

- Vercel: Project → Logs, search `artifact-decode`.
- Local: terminal running `npm run dev`.

## Gotcha found during testing (SQLite only)

Drizzle's `{ mode: "json" }` columns run `JSON.parse` *during the select*. One corrupt row made the **whole library request** fail with a raw `SyntaxError` before the codec ever saw it. Local reads now use `sqlite.prepare("SELECT * ...")`, which returns raw text, so the codec handles parsing and can skip+log. Writes still use Drizzle. Supabase isn't affected: `jsonb` can't hold invalid JSON.

## Production database steps

> **Applied to production on Oct 28, 2026 (12:35 PM CT).** Backup: 398/398 rows, all identical to live, anon role has no access. Columns added as nullable; 0 rows have non-NULL metadata. The live site was checked afterwards and still served share links normally.

Run in this order (Supabase SQL editor, or the migration tool):

1. `supabase/migrations/20261028000000_phase4_backup.sql`
2. Verify: `select count(*) from backup.screamsheets_pre_phase4;` equals `select count(*) from public.screamsheets;`
3. `supabase/migrations/20261028000100_phase4_artifact_columns.sql`
4. Verify: `select count(*) from public.screamsheets where artifact_type is not null or schema_version is not null;` → `0`

**Deploy order doesn't matter.** The old code uses `select("*")` and ignores extra columns, and the new code treats missing or NULL columns as legacy. You can merge the PR before or after the SQL.

### Rollback

- Code: revert the PR. Responses go back to the old shape; no data changed.
- Columns (only if needed; they're unused until Phase 5):
  ```sql
  alter table public.screamsheets drop constraint if exists screamsheets_artifact_type_check;
  alter table public.screamsheets drop column if exists artifact_type, drop column if exists schema_version;
  ```
- Full data restore (last resort, overwrites current rows):
  ```sql
  begin;
  delete from public.screamsheets;
  insert into public.screamsheets (id, title, template, branding, settings, blocks, created_at, owner_key)
    select id, title, template, branding, settings, blocks, created_at, owner_key from backup.screamsheets_pre_phase4;
  commit;
  ```
- Once Phase 5 is stable: `drop schema backup cascade;`

## Troubleshooting

| Symptom | Check |
|---|---|
| A sheet disappeared from the GM library | Search logs for `artifact-decode` with that id; the row was skipped. Inspect it in Supabase. |
| Share link shows the error page | Same log search with context `GET /api/screamsheets/:id` |
| Library dates show nothing | `createdAt` came back `null`; the row is missing `created_at` |
| Vercel function fails with `Cannot find module '../shared/artifactCodec.js'` | Vercel didn't bundle `shared/`. Add `"functions": {"api/**/*.ts": {"includeFiles": "shared/**"}}` to `vercel.json` |
| Local server crashes on start with "duplicate column" | Shouldn't happen (wrapped in try/catch); delete `data.db` for a fresh local DB |
| `version` is 0 for a row you know is v1 | The row's `schema_version` isn't `1`, or the client re-decoded a stripped object; `isRuntimeArtifact` needs `type`, `shareSlug` and `version` present |
| A save returns legacy-shaped JSON | `decodeWritten` fallback ran; look for the log line |

## How to re-run the checks

```bash
npx tsx script/check-artifacts.ts          # codec, 11 cases
npx tsx script/check-vercel-api.ts         # Vercel handlers vs stubbed Supabase
npm run dev                                # then, in another terminal:
python script/e2e-builder.py               # Phase 3 builder flows
python script/e2e-legacy.py                # needs seeded legacy rows (below)
```

Seed a legacy and a corrupt row into a fresh local DB (stop the server, delete `data.db`, start it once, stop it, then):

```python
import sqlite3, json
c = sqlite3.connect("data.db")
b = dict(outlet="NIGHT CITY TODAY", tagline="NEWS", accent="#c0392b", headerBg="#fff", headerText="#111", logoStyle="nct")
s = dict(clock="1:00 AM", categories=["TECH"], activeCategory="TECH", showNav=True, ticker="LEGACY TICKER", columns=1)
bl = [dict(id="h1", type="headline", text="LEGACY HEADLINE", size="lead")]
q = "insert into screamsheets (id,title,template,branding,settings,blocks,created_at,owner_key) values (?,?,?,?,?,?,?,?)"
c.execute(q, ("legacy001", "Legacy Sheet", "nct-tech", json.dumps(b), json.dumps(s), json.dumps(bl), 1700000000000, "test-gm"))
c.execute(q, ("broken001", "Broken", "nct-tech", json.dumps(b), "{not json", json.dumps(bl), 1700000000001, "test-gm"))
c.commit()
```

## Production data notes (read-only checks, Oct 28 2026)

- 398 rows, 116 with an owner key, about 135 MB (mostly embedded images; largest row ~4.4 MB).
- Every row has `blocks` as an array and `branding` / `settings` as objects, with no empty titles, so all of them should decode as legacy v0.
- **Security note (not changed here):** RLS policies on `screamsheets` allow anon `SELECT/UPDATE/DELETE` on all rows (`using (true)`). The GM key check lives only in the API code. Anyone who obtains the anon key could bypass it. Consider moving the API to the service-role key and tightening RLS in a later phase.

## Next: Phase 5 (conservative writes)

1. Decide whether edited legacy sheets stay v0 for one release (recommended: yes).
2. Add tests for overwrite and duplicate flows on legacy rows, and for share links surviving an upgrade.
3. Then switch `useSheetPersistence` to `serializeArtifactForStorage(sheet, "v1")` and have the POST/PUT handlers persist `artifact_type` / `schema_version`.
4. Keep the legacy serializer and `backup` schema until v1 writes have been stable in production.
