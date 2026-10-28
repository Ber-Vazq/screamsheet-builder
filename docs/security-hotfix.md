# Phase 4.5 — Security hotfix: lock down anon access

## Problem
`public.screamsheets` had RLS enabled but four `using (true)` policies (`public_read`, `public_insert`, `public_update`, `public_delete`) plus full table grants (including `TRUNCATE`) for `anon` and `authenticated`. GM-key checks lived only in the API. Anyone with the anon key could read every GM key (`owner_key`), edit, or delete every sheet directly through Supabase's REST API.

## Fix
1. The API (`api/_supabase.ts`) uses `SUPABASE_SERVICE_ROLE_KEY` (server-only). It falls back to `SUPABASE_ANON_KEY` with a warning, so deploying the code before the env var exists doesn't cause an outage.
2. Migration `supabase/migrations/20261028000200_rls_lockdown.sql` drops all four policies and revokes all table privileges from `anon` and `authenticated`. RLS stays on with zero policies.
3. `script/check-anon-lockdown.ts` uses the public anon key to try SELECT/INSERT/UPDATE/DELETE and fails if any is allowed. Writes target a non-existent id, so it's safe against production.

The browser never talks to Supabase directly (verified: no client-side `createClient`/`VITE_SUPABASE*`), so no frontend changes are needed.

## Rollout order (do not skip steps)
1. Vercel → Project → Settings → Environment Variables: add `SUPABASE_SERVICE_ROLE_KEY` for **Production and Preview** (Supabase → Project Settings → API Keys → `service_role`). Mark it Sensitive.
2. Merge this PR (or redeploy) so functions pick up the new variable.
3. Confirm the API works: open the live library with your GM key, open a share link, save an edit. In Vercel logs there must be **no** `SUPABASE_SERVICE_ROLE_KEY is not set` warning.
4. Apply the migration SQL in Supabase.
5. Re-check the live site (library, share link, save, delete a test sheet).
6. Run `npx tsx script/check-anon-lockdown.ts` → all PASS.
7. Optional: remove `SUPABASE_ANON_KEY` from Vercel once the fallback is no longer wanted.

## Rollback
- API broken after step 4: run the ROLLBACK block at the bottom of the migration file. This restores the previous (open) state immediately.
- API broken after step 2: remove `SUPABASE_SERVICE_ROLE_KEY` from Vercel and redeploy; the anon fallback takes over (only works before step 4).

## Notes
- Service-role requests bypass RLS, so the API code is now the single gate. Keep `owner_key` stripped from responses (`api/_artifacts.ts`) and keep the ownership `.eq("owner_key", owner)` filters on writes.
- Future tables in `public` get anon grants by Supabase default. Every new table needs RLS enabled and explicit revokes.
- Since `owner_key` values were publicly readable before this fix, consider every existing GM key exposed. Nothing in the logs shows they were read, but there's no way to prove they weren't either.
