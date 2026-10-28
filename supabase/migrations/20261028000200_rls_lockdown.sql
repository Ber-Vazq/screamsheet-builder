-- Phase 4.5 security hotfix: remove all public (anon/authenticated) access to
-- public.screamsheets. The Vercel API now uses the service-role key, which
-- bypasses RLS, and enforces GM-key ownership in code.
--
-- Apply ONLY after production is confirmed to be running with
-- SUPABASE_SERVICE_ROLE_KEY set (see docs/security-hotfix.md).

begin;

drop policy if exists public_read   on public.screamsheets;
drop policy if exists public_insert on public.screamsheets;
drop policy if exists public_update on public.screamsheets;
drop policy if exists public_delete on public.screamsheets;

-- RLS stays enabled with zero policies = deny everything for non-bypass roles.
alter table public.screamsheets enable row level security;

-- Belt and braces: remove table privileges too (blocks TRUNCATE, which RLS does not cover).
revoke all on table public.screamsheets from anon, authenticated;

commit;

-- ROLLBACK (restores the previous wide-open state; only use if the API breaks):
-- begin;
-- grant select, insert, update, delete on table public.screamsheets to anon, authenticated;
-- create policy public_read   on public.screamsheets for select using (true);
-- create policy public_insert on public.screamsheets for insert with check (true);
-- create policy public_update on public.screamsheets for update using (true) with check (true);
-- create policy public_delete on public.screamsheets for delete using (true);
-- commit;
