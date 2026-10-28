-- Phase 5: nullable last-edit timestamp (epoch ms, same unit as created_at).
-- Additive, no default, no backfill: metadata-only change, safe while live.
-- Must be applied BEFORE the Phase 5 API deploys (PUT writes updated_at).
alter table public.screamsheets
  add column if not exists updated_at bigint null;

comment on column public.screamsheets.updated_at is 'Epoch ms of last PUT. NULL = not edited since Phase 5.';

-- Keep the anon lockdown intact: a new column must not reopen access.
revoke all on table public.screamsheets from anon, authenticated;

-- ROLLBACK (only if no deployed code writes updated_at):
-- alter table public.screamsheets drop column if exists updated_at;
