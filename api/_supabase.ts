import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client for Vercel serverless functions.
// Credentials come from Vercel project environment variables (set at deploy time),
// never shipped to the browser.
//
// Security model (Phase 4.5 hotfix): the API uses the service-role key, which
// bypasses RLS. The database grants the public `anon`/`authenticated` roles no
// access to `screamsheets` at all, so the GM-key checks in this API are the only
// way in. The service-role key must only ever exist as a server-side env var.
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

// Transitional fallback: keeps the API working if this code deploys before the
// env var is set. Once the RLS lockdown migration is applied, the anon key can
// no longer read or write anything, so this path will fail loudly in the logs.
const key = serviceKey || anonKey;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
} else if (!serviceKey) {
  console.warn(
    "[supabase] SUPABASE_SERVICE_ROLE_KEY is not set; falling back to SUPABASE_ANON_KEY. " +
      "This stops working once anon access is revoked.",
  );
}

export const usingServiceRole = Boolean(serviceKey);

export const supabase = createClient(url ?? "", key ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const TABLE = "screamsheets";
