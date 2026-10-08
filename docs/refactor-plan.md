# Refactor & Migration Plan

## Guiding Constraint

Never rewrite existing GM rows in place. Old rows load as-is and are normalized to a runtime artifact at read time. `id` (= share slug) and `owner_key` never change.

## Phase Sequence

| Phase | Scope | Risk | Status |
|---|---|---|---|
| 0 | Safety: backup Supabase, sample records, inventory | Low | Partially (inventory in architecture.md; backup TODO) |
| 1 | Repo cleanup, public assets, metadata, docs | Low | **Done** |
| 2 | Runtime artifact types + (de)serializers, no storage change | Low | Next |
| 3 | Decompose `Builder.tsx` around `SheetArtifact` | Medium | Pending |
| 4 | Nullable `artifact_type` / `schema_version` columns, read compat | Medium | Pending |
| 5 | Conservative write rollout (Release A → B) | High | Pending |

## Fields That Must Not Break

`id`, `owner_key`, `template`, `branding`, `settings`, `blocks`, `title`, `created_at`.

## Migration Test Matrix

| Case | Input row | Expected |
|---|---|---|
| Legacy sheet | no `schema_version` | normalized to `SheetArtifact`, version 0 |
| Legacy, null `owner_key` | pre-GM-key sheet | loads publicly; not in any library |
| Artifact-aware sheet | `schema_version = 1`, `artifact_type = 'sheet'` | same artifact as legacy equivalent |
| Unknown version | `schema_version = 99` | logged, safe error, no crash |
| Malformed JSON column | bad `blocks` | logged, error state in UI |
| Share link | old `/#/s/:id` | still resolves after every phase |
| Overwrite legacy | PUT on v0 row | same id, still visible in library |
| Duplicate legacy | POST copy | new id, original untouched |

## Phase 3 Extraction Order (Builder.tsx)

1. `lib/templates.ts` (exists — extend)
2. `hooks/useSheetState.ts`
3. `hooks/useSheetPersistence.ts`
4. `hooks/useSheetExport.ts`
5. `components/builder/*` (TemplatePicker, BuilderToolbar, SheetFormPanel, BlockListEditor, BlockEditorRow, PreviewPane, SaveStatus)
6. `Builder.tsx` becomes orchestration only; `SheetRenderer.tsx` stays presentation-only.

## Open Items From Phase 1

- `index.html` references `/favicon.png` but no favicon is committed — add one to `client/public/`.
- `og:image` currently uses `nct-tech.jpg`; replace with a dedicated 1200×630 image.
- `attached_assets/` duplicates the template JPGs; decide whether to delete it and the `@assets` alias.
