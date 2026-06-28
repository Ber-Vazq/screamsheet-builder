import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client for Vercel serverless functions.
// Credentials come from Vercel project environment variables (set at deploy time),
// never shipped to the browser.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  // Surface a clear error in the function logs if env vars are missing.
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
}

export const supabase = createClient(url ?? "", key ?? "", {
  auth: { persistSession: false },
});

export const TABLE = "screamsheets";
