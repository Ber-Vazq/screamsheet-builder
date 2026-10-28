# Phase 3 Walkthrough — Builder Refactor

`client/src/pages/Builder.tsx` went from 634 lines (state, loading, saving, export, preview scaling and all UI in one file) to ~80 lines that only wire pieces together. **No behavior was intentionally changed**, with one exception: a sheet that fails to load now shows a "Could not load sheet" toast and logs to the console instead of failing silently.

## Map: where did each piece go?

| Old location in Builder.tsx | New home | Kind |
|---|---|---|
| `title`, `branding`, `settings`, `blocks`, `categoryRaw` state; block ops; category commit | `hooks/useSheetState.ts` | state, no I/O |
| `?edit=` / `?load=` parsing, load `useEffect`, `editingId`, `shareUrl`, `save` mutation, `copyLink` | `hooks/useSheetPersistence.ts` | network |
| `sheetRef`, `exporting`, `doExport` | `hooks/useSheetExport.ts` | export |
| PNG / PDF / Save / Save as copy buttons | `components/builder/BuilderToolbar.tsx` | UI |
| Title input + Masthead fieldset | `components/builder/SheetFormPanel.tsx` | UI |
| Content blocks header, list, "Add block" palette, `BLOCK_TYPES` | `components/builder/BlockListEditor.tsx` | UI |
| `BlockEditor` function | `components/builder/BlockEditorRow.tsx` | UI |
| Preview scale `useLayoutEffect` / `ResizeObserver` + preview markup | `components/builder/PreviewPane.tsx` | UI |
| "Editing saved sheet" banner, share link box | `components/builder/SaveStatus.tsx` (`EditingBanner`, `ShareLinkPanel`) | UI |
| (from Home.tsx) `NctThumb`, `TemplateCard`, template grids | `components/builder/TemplatePicker.tsx` | UI |
| — new — | `lib/templates.ts`: `sheetArtifactFromTemplate`, `defaultTitleFor` | data |

`SheetRenderer.tsx` was not touched and is still presentation-only (no state, no fetching).

## How data flows now

```
URL (#/build/:template?edit=ID | ?load=ID)
        │
        ▼
Builder.tsx ── getTemplate(params.template) ──► tpl
        │
        ├─ useSheetState(tpl)            → state.sheet : SheetArtifact
        │
        ├─ useSheetPersistence({tpl, editId, loadId, state})
        │     load:  GET /api/screamsheets/:id
        │            → deserializeStoredRecord(raw)       (Phase 2 codec)
        │            → state.loadArtifact(artifact, asCopy)
        │     save:  serializeArtifactForStorage(sheet, "legacy")
        │            → POST (create / copy) or PUT ?owner= (overwrite)
        │
        ├─ useSheetExport(sheet.title)   → sheetRef, doExport
        │
        └─ components receive slices of `sheet` + callbacks
              PreviewPane → SheetRenderer(ref=sheetRef, branding, settings, blocks)
```

Key rule: **only `useSheetPersistence` talks to the API, and only through the codec.** Components never see raw rows.

## Design decisions worth knowing

1. **One `SheetArtifact` in state instead of five `useState`s.** Every setter in `useSheetState` is `setSheet(s => ({ ...s, field }))`. This guarantees the save payload is always a consistent snapshot.
2. **`categoryRaw` stays separate.** It's the half-typed text in the category box; it only becomes `settings.categories` on blur via `commitCategories()` (uppercased, max 8, keeps the active tab valid).
3. **The URL template still wins on save** (`template: tpl.id`), exactly like before. Home links to `/build/<saved template>?edit=<id>`, so they agree in practice.
4. **Saves still write the legacy shape** (`serializeArtifactForStorage(sheet, "legacy")`, `id` removed, `ownerKey` added). This is Release A from the plan: nothing in the database changes yet.
5. **Copy (`?load=`) clears `id`, `shareSlug`, `createdAt`** and appends " (copy)" so a copy can never overwrite the original.
6. **`sheetRef` points at the unscaled sheet**, so PNG/PDF exports stay full resolution even though the preview is scaled down.

## Troubleshooting guide

| Symptom | Where to look | Likely cause |
|---|---|---|
| Builder shows starter content instead of the saved sheet | `useSheetPersistence` load effect; browser console for `[builder] failed to load sheet` | Codec threw (bad JSON, unknown `schema_version`), or the query param isn't being read — check `readSourceParams` handles both `search` and the hash |
| "Could not load sheet" toast | Console error shows the id and the `ArtifactDecodeError` message | Row is malformed or the id doesn't exist (404) |
| Save creates a new sheet every time | `editingId` in `useSheetPersistence` | `onSuccess` must call `setEditingId(id)` after a create; check the API response actually contains `id` |
| Save overwrites when it should copy | `loadArtifact(a, asCopy)` and `setEditingId(editId ? sourceId : null)` | `?load=` must leave `editingId` null |
| Typing in a field does nothing | The setter passed into `SheetFormPanel` / `BlockListEditor` | A prop wired to the wrong `state.*` function in `Builder.tsx` |
| Category tabs don't update | `commitCategories` in `useSheetState` | Only runs on blur, by design |
| Preview is blank, clipped or wrong height | `PreviewPane` `ResizeObserver` / height effect | Effect deps are `sheet.blocks/branding/settings/previewScale` |
| Export downloads nothing / blank image | `useSheetExport`; is `sheetRef` passed to `PreviewPane`? | Ref not attached to `SheetRenderer` |
| Edit page loads, then flips back to template defaults | Load effect deps `[tpl.id, editId, loadId]` | Something changing one of those mid-load |
| 403 on save | Server owner check | Sheet was saved under a different GM key |

Console messages that are **pre-existing and harmless**: React `validateDOMNesting` (`<a>` inside `<a>` from wouter `Link` wrapping an `<a>`), and html-to-image "Error inlining remote css / cssRules SecurityError" for Google Fonts during export.

## How it was verified

- `npx tsc --noEmit` clean, `npx vite build` passes, `npx tsx script/check-artifacts.ts` passes.
- `script/e2e-builder.py` (Playwright, local SQLite) covers: home shows 10 templates → new sheet → add + move blocks → save → overwrite (same id, one library row) → PNG export → `?edit=` loads title + ticker + banner → `?load=` gives "(copy)" and no banner → saving copy makes a 2nd row → share view `#/s/:id` shows saved content → custom template category commit → bad id shows error toast.

Not verified automatically: PDF export, image uploads (block image, ad background, custom logo), two-column blocks, mobile layout, and the Vercel/Supabase path (production). Check those by hand on a preview deploy before merging.

## Rollback

Everything is in one PR. Reverting it restores the old `Builder.tsx` and `Home.tsx`; no data or schema changed, so rollback is safe at any time.
