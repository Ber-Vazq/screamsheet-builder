// Red-team check: try to use the PUBLIC anon key directly against Supabase and
// confirm every operation on `screamsheets` is refused. Safe to run against
// production: writes target an id that does not exist, so nothing is changed
// even if the lockdown is missing.
//
// Run: SUPABASE_URL=... SUPABASE_ANON_KEY=... npx tsx script/check-anon-lockdown.ts
// Exit code 0 = locked down; 1 = at least one operation was allowed.
import { createClient } from "@supabase/supabase-js";

// supabase-js needs a WebSocket global on Node < 22; realtime is never used here.
(globalThis as any).WebSocket ??= class {};

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error("Set SUPABASE_URL and SUPABASE_ANON_KEY (the public key, never the service key).");
  process.exit(2);
}

const db = createClient(url, anon, { auth: { persistSession: false } });
const PROBE = "__anon_lockdown_probe__";
const failures: string[] = [];

async function expectRefused(name: string, run: () => PromiseLike<{ data: any; error: any }>) {
  const { data, error } = await run();
  // Refused = a permission error. An empty result with no error means the
  // request was allowed (RLS just found no rows), which is a failure.
  const refused = Boolean(error) && /permission denied|42501|row-level security/i.test(`${error?.code} ${error?.message}`);
  console.log(`${refused ? "PASS" : "FAIL"}  anon ${name}${refused ? "" : `  -> data=${JSON.stringify(data)?.slice(0, 80)} error=${error?.message ?? "none"}`}`);
  if (!refused) failures.push(name);
}

await expectRefused("SELECT", () => db.from("screamsheets").select("id").limit(1));
await expectRefused("INSERT", () =>
  db.from("screamsheets").insert({ id: PROBE, title: "x", template: "x", branding: {}, settings: {}, blocks: [], created_at: 0 }),
);
await expectRefused("UPDATE", () => db.from("screamsheets").update({ title: "x" }).eq("id", PROBE).select());
await expectRefused("DELETE", () => db.from("screamsheets").delete().eq("id", PROBE).select());

if (failures.length) {
  console.error(`\nNOT LOCKED DOWN: anon can ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nLocked down: anon cannot touch screamsheets.");
