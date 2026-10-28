# Phase 5 — Conservative write rollout

## What changed
| Save | Release A (default) | Release B (`VITE_UPGRADE_ON_SAVE=true`) |
|---|---|---|
| New sheet | v1 (`artifact_type='sheet'`, `schema_version=1`) | v1 |
| Save as copy (`?load=`) | v1, new id; original untouched | v1 |
| Overwrite a v1 sheet | stays v1 | stays v1 |
| Overwrite a legacy (v0) sheet | **stays legacy** (columns NULL) | **upgrades to v1**, same id/share link/GM key |

Every PUT also sets `updated_at` (epoch ms).

## Where the rules live
- `shared/writeMetadata.ts`: the one place for write rules.
  - `parseWriteMetadata`: no metadata → legacy write. Otherwise it must be exactly `artifactType: "sheet"` + `schemaVersion: 1`, or the API returns 400.
  - `metadataColumns`: metadata is only ever added. A payload without metadata never clears it, so an old client can't downgrade a v1 row.
  - `chooseWriteTarget`: the client's create/update decision table above.
  - `buildWritePayload`: request body. Never includes `id`, `owner_key` or `created_at`.
- `api/screamsheets/index.ts` (POST), `api/screamsheets/[id].ts` (PUT), `server/routes.ts` + `server/storage.ts` (local): validate + persist.
- `client/src/hooks/useSheetPersistence.ts`: tracks the stored version of the sheet being edited (`storedVersion`) and picks the target.
- `client/src/lib/featureFlags.ts`: `UPGRADE_ON_SAVE`.

## Order of operations (production)
1. Apply `supabase/migrations/20261028000300_phase5_updated_at.sql` **before** deploying (PUT writes `updated_at`). Applied Oct 28, 2026.
2. Merge → Release A is live. Leave `VITE_UPGRADE_ON_SAVE` unset.
3. Watch for one release (see Monitoring).
4. Release B: Vercel → Environment Variables → `VITE_UPGRADE_ON_SAVE=true` (Production + Preview) → redeploy. It's a build-time variable, so a redeploy is required.

## Monitoring
- Vercel logs: search `[artifact-decode]`. Expected count: 0.
- Supabase SQL:
  ```sql
  select coalesce(artifact_type,'(legacy)') type, schema_version, count(*),
         max(to_timestamp(created_at/1000)) newest_created,
         max(to_timestamp(updated_at/1000)) newest_updated
  from public.screamsheets group by 1,2 order by 1,2;
  ```
  - Release A: v1 rows grow only through new sheets and copies. The legacy row count never drops, except when a GM deletes a sheet.
  - Release B: the legacy count drops as GMs edit old sheets. Total row count stays steady.

## Rollback
- Release B → A: unset `VITE_UPGRADE_ON_SAVE` and redeploy. Upgraded rows stay v1 and read fine.
- Whole phase: revert the PR. The codec still reads v1 rows, and old code ignores `updated_at`. Restore data from `backup.screamsheets_pre_phase4` (see `phase-4-walkthrough.md`) only if content was actually lost.

## Tests
```bash
npx tsx script/check-vercel-api.ts     # incl. write path: create/copy/overwrite/upgrade/no-downgrade/400s/ownership
rm -f data.db*; npm run dev   # start once, stop, then:
python script/seed-legacy.py
npm run dev & python script/e2e-legacy.py                                         # Release A
VITE_UPGRADE_ON_SAVE=true npm run dev & EXPECT_UPGRADE=1 python script/e2e-legacy.py  # Release B (reseed first)
```
