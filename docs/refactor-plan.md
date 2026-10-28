# Refactor & Migration Plan

## Guiding Constraint

Never rewrite existing GM rows in place. Old rows load as-is and are normalized to a runtime artifact at read time. `id` (= share slug) and `owner_key` never change.

## Phase Sequence

| Phase | Scope | Risk | Status |
|---|---|---|---|
| 0 | Safety: backup Supabase, sample records, inventory | Low | Done (backup.screamsheets_pre_phase4, Oct 28 2026) |
| 1 | Repo cleanup, public assets, metadata, docs | Low | **Done** |
| 2 | Runtime artifact types + (de)serializers, no storage change | Low | **Done** (`shared/artifact.ts`, `shared/artifactCodec.ts`, `script/check-artifacts.ts`) |
| 3 | Decompose `Builder.tsx` around `SheetArtifact` | Medium | **Done** (see `docs/phase-3-walkthrough.md`) |
| 4 | Nullable `artifact_type` / `schema_version` columns, read compat | Medium | **Done** — prod SQL applied Oct 28 2026; code in PR #10 (see `docs/phase-4-walkthrough.md`) |
| — | Security hotfix: service-role key + anon lockdown | High | **Done** — PR #11 (see `docs/security-hotfix.md`) |
| 5 | Conservative write rollout (Release A → B) | High | **Release A done** — PR #12 (see `docs/phase-5-walkthrough.md`); flip `VITE_UPGRADE_ON_SAVE=true` for B after monitoring |
| 6 | Reliability / UX: save status, autosave, drafts, mobile tabs | Medium | **Done** — PR #13 (see `docs/phase-6-walkthrough.md`) |
| 7 | Public view hardening + editor polish (drag-and-drop, print preview) | Medium | **Done** — PR #15 (see `docs/phase-7-walkthrough.md`) |
| 8 | Text thread MVP | Medium | **Done** — PR #16 (see `docs/phase-8-walkthrough.md`) |
| 9 | Email thread MVP | Medium | Next |
| 10 | Gallery, SEO, attribution, Etsy monetization | Medium | Pending |

## Remaining Phases (revised Oct 28 2026)

Change: the Etsy button moves from Phase 7 to Phase 10. Drag-and-drop reordering and print preview (optional in Phase 6, not done there) move into Phase 7.

### Phase 7 — Public view hardening + editor polish
- `ViewSheet.tsx`: separate loading, not-found (404), and unreadable (500) states.
- Fictional/parody disclaimer in public views and near export buttons.
- Animated share/export confirmation.
- Subtle "Made with Screamsheet Builder" attribution (can be turned off in exports).
- OG/share image: hash routing means crawlers only see `index.html`. Per-sheet previews need a path route (e.g. `/s/:id`, a Vercel function that serves meta tags and redirects to `/#/s/:id`) and/or `@vercel/og`. Also add a dedicated 1200×630 default `og:image`.
- **Drag-and-drop block reordering** in the block list. Keep the up/down buttons for keyboard and accessibility.
- **Print preview mode**: show the sheet as it will print or export to PDF (page size, margins, page breaks).

Acceptance: public pages fail gracefully; legal copy ready before texts/emails; blocks can be reordered by dragging; print preview matches the PDF output.

### Phase 8 — Text thread MVP
Unchanged (see handoff): codec + API support for `textThread`, renderer/editor, artifact-aware viewer, library type badge.

### Phase 9 — Email thread MVP
Unchanged: `emailThread` codec/API, renderer/composer, template packs, disclaimers.

### Phase 10 — Gallery, SEO, attribution, Etsy monetization
- Public gallery of opt-in artifacts (explicit `is_public` flag; never listed by default).
- SEO pages per template/type (builds on the Phase 7 path routes).
- Branded attribution and Etsy cross-links.
- **Dismissible in-world "Fixer's Market" Etsy CTA** in `ViewSheet` (dismissal remembered in `localStorage`). Moved here from Phase 7.

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
