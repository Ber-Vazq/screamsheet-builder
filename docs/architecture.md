# Screamsheet Builder — Architecture Overview

Snapshot of the app as of Phase 1 (storage schema version 0 / legacy).

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript + Vite, Tailwind, shadcn/ui, wouter (hash routing), TanStack Query |
| Hosted API | Vercel serverless functions in `api/` backed by Supabase/Postgres |
| Local API | Express (`server/`) + SQLite via Drizzle ORM (`data.db`) |
| Shared types | `shared/schema.ts` (Drizzle table + `Branding`, `SheetSettings`, `Block`) |
| Export | `client/src/lib/exportSheet.ts` (PNG / PDF from the rendered DOM) |

## Directory Layout

```
api/                     Vercel functions (production)
  _supabase.ts           Supabase client + TABLE = "screamsheets"
  screamsheets/index.ts  POST create, GET library list (by GM key)
  screamsheets/[id].ts   GET one (public), PUT overwrite, DELETE (owner only)
server/                  Express dev server (mirrors the api/ routes)
  routes.ts, storage.ts  /api/screamsheets CRUD against SQLite
shared/schema.ts         Table definition and content types
client/
  index.html             SPA shell + SEO / social metadata
  public/assets/templates/<template-id>.jpg   Reference template images (unhashed)
  src/
    App.tsx              Routes: /, /build, /build/:template, /s/:id
    pages/Builder.tsx    Editor (state, persistence, export, UI — ~31 KB, Phase 3 target)
    pages/ViewSheet.tsx  Read-only public share view + export
    pages/Home.tsx       Template picker + GM library
    components/SheetRenderer.tsx  Presentation-only sheet renderer
    lib/templates.ts     TEMPLATES, getTemplate, starterBlocks, newBlock, templatePreviewSrc
    lib/gmKey.ts         GM key stored client-side, sent with requests
attached_assets/         Original source images (duplicates of template JPGs)
docs/                    This file + refactor-plan.md
```

## Routing

Hash routing (`useHashLocation`), so share links look like `https://screamsheet.vercel.app/#/s/<id>`.
Vite `base` is `"./"` — public assets must be referenced with relative paths (`assets/...`).

## Storage Model (schema version 0)

Table `screamsheets` (same shape in SQLite and Supabase):

| Column | Type | Notes — MUST NOT BREAK |
|---|---|---|
| `id` | text PK | nanoid; **also the share slug** (`/#/s/:id`) |
| `title` | text | GM library title |
| `template` | text | e.g. `nct-tech`, `augmented-optic`, `custom` |
| `branding` | JSON | `Branding` |
| `settings` | JSON | `SheetSettings` |
| `blocks` | JSON | ordered `Block[]` |
| `owner_key` | text, nullable | secret GM key; **never returned to clients** |
| `created_at` | integer | epoch ms |

There is no `updated_at`, `artifact_type`, or `schema_version` yet. A missing `schema_version` = legacy v0.

## Entry Points That Load Saved Data

1. Public share view — `GET /api/screamsheets/:id` → `ViewSheet.tsx` (strips `owner_key`, `created_at`).
2. GM library list — `GET /api/screamsheets` filtered by GM key → `Home.tsx`.
3. Builder edit / overwrite — load by id, `PUT /api/screamsheets/:id` (owner check on `owner_key`).
4. Duplicate — load by id, `POST /api/screamsheets` as a new row.
5. Delete — `DELETE /api/screamsheets/:id` (owner only).

## Security Boundary

GM key is checked server-side on PUT/DELETE and used to filter the library; Supabase RLS is a second layer. The key is stripped from all public responses.
