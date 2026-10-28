# Phase 6 — Reliability and UX

## What changed
| Feature | Behavior |
|---|---|
| Save status bar | Above the editor and preview: Not saved yet → Unsaved changes → Saving / Autosaving → All changes saved · *n* min ago → or Save failed + **Retry**. The hint says whether autosave is on and why not. |
| Autosave | Only for a **saved** sheet **with a GM key**. Saves 2 s after the last edit, using the same PUT as "Save changes" (Release A/B rules still apply). No toast; status bar only. A failing save is not retried in a loop: the next edit or the Retry button tries again. |
| Draft recovery | While there are unsaved edits, the sheet is copied to `localStorage` (`screamsheet:draft:<id>`, `…:copy:<id>`, or `…:new:<template>`). It's cleared after a successful save. On open, a banner offers **Restore edits / Discard** if the draft differs from what loaded and is newer than the server's last change. |
| Big images | Drafts over ~4 MB, or a storage quota error, cause images to be dropped from the backup. Text is kept. The status bar and restore banner say so. If even the text doesn't fit, no draft is kept and the status bar says so. |
| Leave-page warning | The browser asks before closing or reloading with unsaved edits. |
| Mobile | Below `lg`: Edit / Preview tabs. The preview stays mounted off-screen, so PNG/PDF export works from either tab. |

Not done (optional in the plan): drag-and-drop reordering (the up/down buttons remain) and print-preview mode.

## Where it lives
- `client/src/lib/sheetSnapshot.ts`: content fingerprint (sorted-key JSON + FNV-1a) of exactly what a save persists.
- `client/src/lib/drafts.ts`: draft keys, encode/decode, image stripping, guarded storage, `shouldOfferDraft`.
- `client/src/hooks/useSheetPersistence.ts`: baseline hash on load/save, `dirty`, autosave timer, draft write/clear, `status`, `restoreDraft` / `discardDraft`, `retry`.
- `client/src/hooks/useSheetState.ts`: `loadArtifact` / `resetToTemplate` now return the sheet they set, so the baseline is exact.
- `client/src/components/builder/SaveStatus.tsx`: `SaveStatusBar`, `DraftRestoreBanner`.
- `client/src/pages/Builder.tsx`: status bar, banner, mobile tabs.

No API or database changes.

## Tests
```bash
npx tsx script/check-phase6.ts      # fingerprint, drafts, stripping, quota/blocked storage
rm -f data.db*; npm run dev   # once, stop
python script/seed-legacy.py; npm run dev &
python script/e2e-phase6.py         # 45 checks: status, autosave, offline/Retry, restore/discard, stale drafts, big images, mobile
python script/e2e-legacy.py         # Phase 4/5 regression (reseed first)
python script/e2e-builder.py
```

## Known limits
- Autosave sends the whole sheet each time. Sheets near Vercel's 4.5 MB request limit can fail to save, as manual saves already could. The draft keeps the text safe.
- Two tabs editing the same sheet: last write wins (unchanged from before).
