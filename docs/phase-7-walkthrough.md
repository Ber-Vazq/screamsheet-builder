# Phase 7 — Public view hardening + editor polish

No database changes. One new Vercel function (`api/share/[id].ts`) and one new rewrite in `vercel.json`.

## What changed
| Feature | Behavior |
|---|---|
| Public view states | `/#/s/:id` now has four separate states: **loading** (page-shaped skeleton), **404** "doesn't exist" (no retry, link home), **500** "couldn't be read" (Try again), and **offline** "can't reach the server" (Try again). |
| Disclaimer | The full fictional/parody + not-affiliated notice is in the public view's footer. A one-line version sits under the builder preview, next to where you export. The text lives in `shared/legalCopy.ts` so texts and emails can reuse it. |
| Credit line | "Fictional · Made with Screamsheet Builder · screamsheet.vercel.app" in small grey type at the bottom of the sheet, so it also shows in PNG/PDF. **On by default for new sheets**, with a switch in the Masthead panel. Older sheets don't have the setting, so they stay exactly as they were. The public view also has a small "Made with … make your own" link in its footer. |
| Confirmation flash | A short animated stamp ("LINK READY", "CHANGES SAVED", "PNG EXPORTED", "PDF EXPORTED") after a manual save or an export. Autosave doesn't trigger it. Reduced-motion users get a plain fade. |
| Link previews | Share links are now `https://screamsheet.vercel.app/s/<id>`. That path returns a tiny HTML page with Open Graph/Twitter tags (lead headline + outlet as the title, the first paragraph as the description, a 1200×630 image), then redirects straight to `/#/s/<id>`. Old `/#/s/<id>` links still work. Previews never show the private library title. Share pages are `noindex`. |
| Default share image | `client/public/og-default.png` (1200×630), also used by the home page. It replaces the old template JPG. |
| Drag-and-drop | Each block has a grip handle. Drag with a mouse, with touch (short press), or with the keyboard (focus the grip, Space, arrow keys, Space). Inputs are not drag targets, so typing and selecting text work normally. The up/down buttons are still there. |
| Print preview | A **Screen / Print** toggle above the preview. Print shows the sheet on a US Letter page exactly where the PDF puts it. If the sheet is taller than one page, it says how much the PDF shrinks it ("63% width"). The PDF and the preview use the same math (`shared/pdfLayout.ts`). |

## Where it lives
- `shared/pdfLayout.ts`: `fitToLetter()`, used by `exportPdf` and `PreviewPane`.
- `shared/shareMeta.ts`: `describeArtifact`, `renderSharePage`, `isValidShareId`, `escapeHtml`.
- `shared/legalCopy.ts`: disclaimer and credit text.
- `api/share/[id].ts` + `vercel.json` rewrite `/s/:id → /api/share/:id`. `server/routes.ts` has the same route for local dev.
- `client/src/lib/loadError.ts`: maps a failed fetch to notfound / unreadable / network.
- `client/src/components/Disclaimer.tsx`, `ConfirmFlash.tsx`.
- `client/src/pages/ViewSheet.tsx`: states + footer.
- `client/src/components/builder/BlockListEditor.tsx` / `BlockEditorRow.tsx`: dnd-kit sortable list + grip. `useSheetState.reorderBlock` / `reorderById`.
- `client/src/components/builder/PreviewPane.tsx`: Screen / Print modes. Both use the same `SheetRenderer`, so exports work in either mode.
- `client/src/hooks/useSheetPersistence.ts`: `shareUrlFor(id)` and an `onSaved` callback.
- New dependency: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

## Tests
```bash
npx tsx script/check-phase7.ts      # page fit, error mapping, share meta/escaping, reorder
npx tsx script/check-vercel-api.ts  # now also runs api/share/[id] against the stub DB
python script/e2e-phase7.py         # 52 checks (seeded data.db + npm run dev)
```

## After merge
- Paste a share link into Discord or iMessage. It should show the headline and the new image. Discord caches previews, so use a newly saved sheet.
- `curl -s https://screamsheet.vercel.app/s/<id> | grep og:title`
