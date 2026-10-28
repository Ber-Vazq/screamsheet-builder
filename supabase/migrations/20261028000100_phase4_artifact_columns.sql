-- Phase 4, step 2: nullable artifact metadata (expand-in-place).
-- No defaults and no backfill: every existing row stays NULL, and the app
-- reads NULL as "legacy sheet, schema version 0". Metadata-only change in
-- Postgres (no table rewrite), safe to run while the app is live.
alter table public.screamsheets
  add column if not exists artifact_type text null,
  add column if not exists schema_version integer null;

alter table public.screamsheets
  drop constraint if exists screamsheets_artifact_type_check;
alter table public.screamsheets
  add constraint screamsheets_artifact_type_check
  check (artifact_type is null or artifact_type in ('sheet', 'textThread', 'emailThread'));

comment on column public.screamsheets.artifact_type is 'NULL = legacy sheet. See shared/artifactCodec.ts';
comment on column public.screamsheets.schema_version is 'NULL = legacy v0. See shared/artifactCodec.ts';
