# Phase 8 — Text thread MVP

No database changes. Text threads use the same `screamsheets` table and columns as sheets. The production check constraint already allows `artifact_type = 'textThread'`.

## What you can do now
| Feature | Behavior |
|---|---|
| New builder | `/#/build/text/<template>` (or `/#/build/text`). Pick a template from the new **Text threads** section on the home page. |
| Three looks | **Cyberpunk** (neon, monospace), **Glass (iOS-style)**, **Material (Android-style)**. Switch any time from the Style menu. No real logos or brand names. |
| People | Up to 8. Each has a name and a color. A radio button picks **whose phone it is**; their messages sit on the right. Removing a person also removes their messages (asks first). |
| Messages | Up to 300. Text, image, or system note ("Dee renamed the group"). Optional time chip. Delivery status (Sent / Delivered / Read / Not delivered) for the phone owner's messages; only the last one shows, like a real phone. |
| Ordering | Drag by the grip (mouse, touch, keyboard), up/down buttons, duplicate, delete. Same controls as sheet blocks. |
| Saving | Same as sheets: save & share, save as copy, autosave after 2 s with a GM key, local draft recovery, "unsaved" status, confirmation stamp. |
| Export | PNG and PDF of the phone screen (390 px wide). |
| Share link | `/s/<id>` works for threads. The preview title is "Messages with <header name>", the description is the first real message. The private title is never shown. |
| Public view | `/#/s/<id>` shows the phone, scaled to fit small screens, with the disclaimer footer. |
| Library | Type badge (Sheet / Text) on every card. Filter chips: **All / Sheets / Texts**. Edit and Duplicate open the right builder. |

## How it's stored
| Column | Text thread value |
|---|---|
| `artifact_type` | `textThread` |
| `schema_version` | `1` (always; there is no legacy format for threads) |
| `template` | style preset id: `text-cyber`, `text-ios`, `text-android` |
| `branding` | `{}` |
| `settings` | platform, participants, phone owner, header, clock, credit switch |
| `blocks` | the messages, in order |

## Safety rules
- **A row never changes type.** A PUT whose type doesn't match the stored row gets **409**. A legacy row counts as a sheet; a body with no metadata counts as a sheet. So an old client can't overwrite a thread, and a thread can't overwrite a sheet.
- Ownership is checked first (wrong GM key is still 403).
- Thread bodies are checked on the server: known style, 1-8 people with ids, at most 300 messages with ids. Bad bodies get 400 and nothing is written.
- Reading is lenient: an odd field gets a default instead of breaking the whole thread. Only broken JSON makes a thread unreadable (same as sheets).
- `emailThread` is still refused on write until Phase 9.

## Where it lives
- `shared/threadCodec.ts`: read/write helpers + server validation (also has the Phase 9 email helpers).
- `shared/artifactCodec.ts`: decodes `textThread`/`emailThread` v1 rows; writes them as v1.
- `shared/writeMetadata.ts`: `textThread` is writable; `typeChangeError()` (409 guard); threads always write v1.
- `api/screamsheets/index.ts`, `api/screamsheets/[id].ts`, `server/routes.ts`, `server/storage.ts`: validation + type guard.
- `client/src/hooks/useArtifactPersistence.ts`: the save/autosave/draft logic, now shared. `useSheetPersistence` is a thin wrapper, so sheets behave exactly as before.
- `client/src/hooks/useTextThreadState.ts`, `client/src/lib/textTemplates.ts`.
- `client/src/components/text/TextThreadRenderer.tsx`, `TextThreadEditor.tsx`; `client/src/pages/TextBuilder.tsx`.
- `client/src/pages/ViewSheet.tsx`: shows sheets or text threads. `client/src/pages/Home.tsx`: badges + filters.

## Tests
```bash
npx tsx script/check-phase8.ts      # codec round trip, lenient reads, metadata, type guard, drafts, hashing
npx tsx script/check-vercel-api.ts  # now also creates/updates threads and checks 400/403/409
python script/e2e-phase8.py         # 71 checks (seeded data.db + npm run dev)
```
Phase 6, Phase 7, legacy and builder browser tests still pass.

## After merge
1. Make a text thread on the live site, save it, open the share link on your phone.
2. `curl -s https://screamsheet.vercel.app/s/<id> | grep og:title` should say "Messages with ...".
3. Delete the test thread from the library.
