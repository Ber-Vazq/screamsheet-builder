# Wiring the Screamsheet Builder to Supabase + Vercel

This guide documents exactly how the Screamsheet Builder backend was moved off the
local SQLite/Express setup and onto **Supabase Postgres** with **Vercel serverless
functions**. Follow it to reproduce the setup, recover from scratch, or adapt it for
another table.

- **Live app:** https://screamsheet.vercel.app
- **Supabase project:** `screamsheet` (ref `<your-project-ref>`, region `us-east-2`)
- **Vercel project:** `ber-vazqs-projects/screamsheet`

---

## Why this architecture

The original app ran a long-lived Express server (`server/index.ts`) with SQLite in a
local `data.db` file. That works on an always-on host, but **not on Vercel**:

- Vercel runs **serverless functions** (spin up per request), not a persistent server.
- The serverless filesystem is **ephemeral** — a local SQLite file is wiped on every
  cold start, so saved/shared screamsheets would vanish.

The fix: store data in **Supabase Postgres** (managed, always-on, free tier) and expose
it through small **serverless functions** in an `/api` folder. The React frontend stays a
static build served from Vercel's CDN.

```
Browser (static React SPA)
   │  fetch("/api/screamsheets")
   ▼
Vercel serverless functions  (/api/screamsheets/*.ts)
   │  @supabase/supabase-js
   ▼
Supabase Postgres  (screamsheets table)
```

---

## Step 1 — Create the Supabase project

In the [Supabase dashboard](https://supabase.com/dashboard):

1. **New project** → name `screamsheet`, pick a region near your players
   (`us-east-2` / Ohio for central US), choose the **Free** plan ($0/month).
2. Wait until the project status is **Active / Healthy** (1–2 minutes).

> This was done programmatically via the Supabase connector, but the dashboard steps
> above are the manual equivalent.

---

## Step 2 — Create the database table

In the dashboard go to **SQL Editor** → **New query**, paste the following, and run it.
This mirrors the old SQLite schema, storing the rich content as `jsonb`:

```sql
create table if not exists public.screamsheets (
  id text primary key,          -- nanoid, used as the share slug
  title text not null,          -- GM's internal library title
  template text not null,       -- e.g. "nct-tech", "augmented-optic", "custom"
  branding jsonb not null,      -- outlet name, colors, logo style
  settings jsonb not null,      -- clock, categories, active tab, ticker
  blocks jsonb not null,        -- ordered content blocks
  created_at bigint not null    -- epoch millis
);

-- Row Level Security: this is a public prototype where screamsheets are shared
-- by unguessable slug, so anyone with the link can read/create/delete.
alter table public.screamsheets enable row level security;
create policy "public_read"   on public.screamsheets for select using (true);
create policy "public_insert" on public.screamsheets for insert with check (true);
create policy "public_delete" on public.screamsheets for delete using (true);
```

> **Hardening later:** If you want sheets private to each GM, add a `user_id text`
> column and replace the `using (true)` policies with checks against an authenticated
> user. That requires Supabase Auth, which is a larger change.

---

## Step 3 — Get your API credentials

In the dashboard: **Project Settings → API**.

- **Project URL** → `https://<your-project-ref>.supabase.co`
- **anon / public key** (the long JWT starting with `eyJ...`) → used by the backend.

> Use the **legacy anon JWT key**, not the newer `sb_publishable_...` key —
> `@supabase/supabase-js` expects the JWT format.

Put them in a local `.env` (already gitignored — never commit this):

```
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-jwt>      # full anon JWT
```

---

## Step 4 — The serverless functions

Vercel turns every file in the top-level `/api` folder into a serverless function.
Three files were added:

### `api/_supabase.ts` — shared client

```ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

export const supabase = createClient(url ?? "", key ?? "", {
  auth: { persistSession: false },
});
export const TABLE = "screamsheets";
```

The client reads credentials from **environment variables** — they never ship to the
browser.

### `api/screamsheets/index.ts` — list + create

- `GET  /api/screamsheets` → returns all sheets, newest first.
- `POST /api/screamsheets` → validates the body, generates a `nanoid` slug, inserts,
  returns the new row.

### `api/screamsheets/[id].ts` — read one + delete

- `GET    /api/screamsheets/:id` → fetch a single shared sheet (404 if missing).
- `DELETE /api/screamsheets/:id` → remove a sheet from the library.

> **One mapping detail:** Postgres uses `created_at` (snake_case); the frontend expects
> `createdAt` (camelCase). Each handler converts between the two with a small `toApi()`
> helper, so no frontend code had to change.

The React frontend already calls relative paths (`/api/screamsheets`) via
`client/src/lib/queryClient.ts`. On Vercel the frontend and API share an origin, so
those relative calls "just work" — no API base URL needed.

---

## Step 5 — Vercel build config

`vercel.json` tells Vercel how to build the frontend and route requests:

```json
{
  "buildCommand": "vite build",
  "outputDirectory": "dist/public",
  "framework": null,
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

- `vite build` compiles the React app into `dist/public`.
- Vercel auto-detects and compiles the `/api/*.ts` files into functions (no config
  needed beyond having `@vercel/node` as a dev dependency).
- The **rewrite** sends every non-API path to `index.html` so the single-page app loads.
  (The app uses hash routing, e.g. `/#/s/<id>`, so deep links resolve client-side.)

---

## Step 6 — Deploy from the command line

With the [Vercel CLI](https://vercel.com/docs/cli) installed (`npm i -g vercel`) and
logged in (`vercel login`):

```bash
cd screamsheet-builder

# 1. Link (or create) the Vercel project
vercel link --yes --project screamsheet

# 2. Push the Supabase secrets to Vercel (run once per variable per environment).
#    These are stored encrypted on Vercel, NOT in your repo.
printf "%s" "https://<your-project-ref>.supabase.co" | vercel env add SUPABASE_URL production
printf "%s" "<anon-jwt>"                                 | vercel env add SUPABASE_ANON_KEY production
#    (repeat for `preview` and `development` if you want those environments to work too)

# 3. Deploy to production
vercel deploy --prod --yes
```

> The CLI may keep streaming logs after the build finishes. The deploy is done once
> `vercel ls` shows the latest deployment as **Ready** — you can safely stop waiting on
> the log stream.

Your production URL: **https://screamsheet.vercel.app**

---

## Step 7 — Verify it works

```bash
# List (empty array on a fresh DB)
curl https://screamsheet.vercel.app/api/screamsheets

# Create a sheet
curl -X POST https://screamsheet.vercel.app/api/screamsheets \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","template":"nct-tech","branding":{...},"settings":{...},"blocks":[...]}'

# Read it back by the returned id
curl https://screamsheet.vercel.app/api/screamsheets/<id>

# Delete it
curl -X DELETE https://screamsheet.vercel.app/api/screamsheets/<id>
```

All four were verified working against the live deployment.

---

## Updating the app later

Any time you change the code:

```bash
cd screamsheet-builder
vercel deploy --prod --yes      # rebuilds and redeploys to the same URL
```

To change the database schema, run new SQL in the Supabase **SQL Editor** (or via a
migration). Because data lives in Supabase, **redeploys never lose your players' saved
screamsheets**.

---

## Local development against Supabase

```bash
# Pull the env vars Vercel stores into a local .env file
vercel env pull .env

# Run the Vercel dev server (serves the frontend + /api functions locally)
vercel dev
```

> Note: on Node.js < 22, `@supabase/supabase-js` may warn about missing native
> WebSocket support when it initializes its realtime client. It does not affect the
> database queries this app uses, and Vercel's runtime (Node 22+) has native WebSocket,
> so production is unaffected.

---

## Security notes

- `.env` and `.vercel/` are gitignored — secrets are **never** committed.
- On Vercel, `SUPABASE_URL` / `SUPABASE_ANON_KEY` live as encrypted environment
  variables and are injected only into the serverless functions at runtime.
- The anon key is safe to use server-side; RLS policies are what actually govern access.
  This prototype intentionally allows public read/create/delete (share-by-slug model).
  Tighten the RLS policies if you later add accounts.
