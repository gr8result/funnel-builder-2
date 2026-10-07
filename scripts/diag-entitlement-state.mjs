// READ-ONLY diagnostic of the live subscription/entitlement state.
// No writes. No secrets printed.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(".env.local");
loadEnv(".env");

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing Supabase config"); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

const EMAIL = process.argv[2] || "grant.rohde63@gmail.com";

async function probeTable(name) {
  const { error, count } = await db.from(name).select("*", { count: "exact", head: true });
  if (error) return `MISSING/UNREADABLE (${error.code || ""} ${error.message})`;
  return `EXISTS (${count ?? "?"} rows total)`;
}

console.log("=== TABLE EXISTENCE ===");
for (const t of ["workspace_entitlements", "user_modules", "entitlements", "subscriptions", "workspaces", "accounts"]) {
  console.log(`  ${t.padEnd(24)} ${await probeTable(t)}`);
}

const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
const user = (users?.users || []).find((u) => (u.email || "").toLowerCase() === EMAIL.toLowerCase());
if (!user) { console.log(`\nNo auth user for ${EMAIL}`); process.exit(0); }
console.log(`\n=== USER ===\n  id: ${user.id}\n  email: ${user.email}`);

const show = async (label, q) => {
  const { data, error } = await q;
  console.log(`\n=== ${label} ===`);
  if (error) { console.log("  ERROR:", error.message); return; }
  if (!data || (Array.isArray(data) && !data.length)) { console.log("  (no rows)"); return; }
  console.log(JSON.stringify(data, null, 1));
};

await show("subscriptions (account_id = user)", db.from("subscriptions").select("*").eq("account_id", user.id));
await show("user_modules (user_id = user)", db.from("user_modules").select("*").eq("user_id", user.id));
await show("workspaces (owner_id = user)", db.from("workspaces").select("id, name, plan, owner_id").eq("owner_id", user.id));
await show("accounts (user_id = user)", db.from("accounts").select("user_id, email, sms_plan_tier, calendar_plan_tier, email_plan_tier").eq("user_id", user.id));
await show("entitlements (any for user)", db.from("entitlements").select("*").limit(20));
