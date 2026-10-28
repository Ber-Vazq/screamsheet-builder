# Phase 9 — Email thread MVP

No database changes. Email threads use the same `screamsheets` table and columns as sheets and texts. The production check constraint already allows `artifact_type = 'emailThread'`.

## What you can do now
| Feature | Behavior |
|---|---|
| New builder | `/#/build/email/<pack>` (or `/#/build/email`). Pick a pack from the new **Email threads** section on the home page. |
| Five packs | **Arasaka legal notice**, **Militech ops order**, **Gang spam inbox**, **Fixer intel drop**, **Ripperdoc clinic notice**. Each one is a ready-made thread you can edit. |
| Three looks | **Corporate client** (clean, light), **Secure terminal** (monospace, glowing accent), **Free webmail** (cheap, gradient header). Switch any time from the Look menu. No real logos. |
| Mail client settings | Client name, whose inbox it is, thread subject, an optional banner ("CONFIDENTIAL…"), accent color, credit-line switch. |
| Emails | Up to 300, oldest first. Each has from (name + address), To, Cc, subject, time, body, quoted text, attachments (file names only) and a flag. |
| Quick replies | **Add reply** swaps the sender and recipient of the last email, adds "RE:" (only once) and quotes it. **Quote previous** fills the quote from the email above. **Add blank email** starts empty. |
| Ordering | Drag by the grip (mouse, touch, keyboard), up/down buttons, duplicate, delete. Same controls as sheets and texts. |
| Saving | Same as sheets and texts: save & share, save as copy, autosave with a GM key, local draft recovery, status bar, confirmation stamp. |
| Export | PNG and PDF of the mail window (720 px wide). |
| Share link | `/s/<id>` works for emails. The preview title is the subject; the description is the first email's body. The private title is never shown. |
| Public view | `/#/s/<id>` shows the mail window, scaled to fit small screens, with the disclaimer footer. |
| Library | "Email" type badge, and a new **Emails** filter chip. Edit and Duplicate open the email builder. |
| Disclaimers | Compact notice under the builder preview, full notice in the public view footer, and the optional "Fictional · Made with Screamsheet Builder" line inside the export. |

## How it's stored
| Column | Email thread value |
|---|---|
| `artifact_type` | `emailThread` |
| `schema_version` | `1` (always; there is no legacy format for emails) |
| `template` | pack id, e.g. `email-arasaka-legal` |
| `branding` | `{}` |
| `settings` | look, client name, inbox, subject, banner, accent, credit switch |
| `blocks` | the emails, in order |

## Safety rules (same as Phase 8)
- **A row never changes type.** Sheet, text or legacy writes onto an email row get **409**, and an email can't overwrite a sheet or text.
- Ownership is checked first (wrong GM key is still 403).
- Email bodies are checked on the server: known look, settings object, at most 300 emails, every email has an id. Bad bodies get 400 and nothing is written.
- Reading is lenient: an odd field gets a default instead of breaking the thread.

## Where it lives
- `shared/writeMetadata.ts`: `emailThread` is now writable.
- `shared/threadCodec.ts`, `shared/artifactCodec.ts`, `shared/shareMeta.ts`: email read/write, validation and share text (these were already in place from Phase 8).
- `client/src/lib/emailTemplates.ts`: the five packs, look labels, reply helpers.
- `client/src/hooks/useEmailThreadState.ts`: in-memory editing.
- `client/src/components/email/EmailThreadRenderer.tsx`: the mail window (inline styles, so exports match the screen).
- `client/src/components/email/EmailComposerPanel.tsx`: mail client settings.
- `client/src/components/email/QuotedThreadEditor.tsx`: the email list (reply, quote, reorder).
- `client/src/pages/EmailBuilder.tsx`, plus routes in `App.tsx`, a picker section in `TemplatePicker.tsx`, the viewer in `ViewSheet.tsx` and filters in `Home.tsx`.

## Tests
| Check | Result |
|---|---|
| `npx tsx script/check-phase9.ts` (codec, validation, all 5 packs, reply helpers, drafts, hashing, share text) | pass |
| `npx tsx script/check-vercel-api.ts` (email create/read/update, share page, 400/403/409) | pass |
| `python3 script/e2e-phase9.py` (full browser run, desktop + mobile) | 93/93 |
| Older suites: `e2e-phase8` 71/71, `e2e-phase7` 51/51, `e2e-phase6` 45/45, `e2e-legacy` 20/20, `e2e-builder` | pass |
| `tsc`, strict API typecheck, `vite build` | pass |

## After merge: quick production check
1. Wait for the Vercel deployment for the merge commit to finish (`gh api repos/Ber-Vazq/screamsheet-builder/deployments`).
2. Open `https://screamsheet.vercel.app/#/build/email/email-militech-ops`, set a GM key, press **Save & share**.
3. Open the share link on your phone. It should show the mail window, fitted to the screen.
4. Delete the test email from your library.
