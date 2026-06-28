# Screamsheet Builder

A web app for building and sharing print-ready, in-world news sheets ("screamsheets") for Cyberpunk and other tabletop RPG sessions. Pick a template, fill in the form, and export a print-ready sheet or generate a shareable link your players can read in-browser.

Built with a Y2K HUD aesthetic — navy/chrome palette, wireframe grids, notched panels, and reticle accents.

## Features

- **Template-driven builder** — multiple Night City Today "desks" plus custom outlets with editable masthead, branding, colors, and content blocks (headlines, bylines, paragraphs, pull quotes, ads, sidebars, briefs, images, dividers).
- **Live preview** — responsive preview that scales the print-format sheet to any screen.
- **Export** — download as PNG or PDF.
- **Shareable links** — save a sheet and share a read-only link players can open on any device, including mobile.
- **Private GM library** — a secret GM key gates your saved sheets. The library only lists sheets tied to your key; players opening a share link never see it. The key is enforced server-side and never returned to any client.
- **In-place editing** — edit a saved sheet and overwrite it (the share link stays the same), or duplicate it as a new sheet.

## Tech stack

- **Frontend:** React + TypeScript + Vite, Tailwind CSS, wouter (hash routing), TanStack Query
- **Backend (production):** Vercel serverless functions + Supabase (Postgres)
- **Backend (local dev):** Express + SQLite (better-sqlite3) via Drizzle ORM

## Local development

```bash
npm install
cp .env.example .env   # fill in your own Supabase values (only needed for the Vercel/Supabase path)
npm run dev            # starts the Express + SQLite dev server on http://localhost:5000
```

The local dev server uses SQLite (`data.db`, gitignored) so you can run without Supabase.

## Production deployment (Vercel + Supabase)

1. Create a Supabase project and a `screamsheets` table (see `SUPABASE_VERCEL_GUIDE.md`).
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` as Vercel environment variables.
3. Deploy with the Vercel CLI or the Vercel GitHub integration. `vercel.json` runs `vite build` and compiles the `/api` functions.

See [`SUPABASE_VERCEL_GUIDE.md`](./SUPABASE_VERCEL_GUIDE.md) for full setup steps.

## Security notes

- The Supabase **anon key** is public-by-design (it ships in the client bundle); data access is governed by Row Level Security policies plus an application-layer GM-key check.
- The **`service_role` key is never used** in this project and must never be committed.
- Secrets live only in `.env` (gitignored) / Vercel environment variables. Use `.env.example` as a template.
