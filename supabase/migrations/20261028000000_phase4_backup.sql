-- Phase 4, step 1: full copy of screamsheets in a PRIVATE schema.
-- The backup schema is not exposed through the Supabase REST API, and anon /
-- authenticated get no privileges, so owner keys in the copy stay private.
create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;

create table backup.screamsheets_pre_phase4 as table public.screamsheets;
revoke all on backup.screamsheets_pre_phase4 from public, anon, authenticated;

comment on table backup.screamsheets_pre_phase4 is
  'Copy of public.screamsheets taken before Phase 4. See docs/phase-4-walkthrough.md for restore steps.';
