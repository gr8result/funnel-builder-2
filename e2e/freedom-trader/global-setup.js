// Provisions two ephemeral Supabase test users so the isolation tests can
// prove one user's Fib plan is never visible to another. Skips gracefully
// (tests fall back to "not signed in" / localStorage-only assertions) if
// admin credentials aren't available in this environment.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env.local") });

export const AUTH_STATE_PATH = path.join(__dirname, ".auth", "test-users.json");

function randomSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });

  if (!url || !serviceKey) {
    fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify({ available: false, users: [] }, null, 2));
    console.warn("[freedom-trader e2e] No Supabase admin credentials available -- skipping test-user provisioning.");
    return;
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const suffix = randomSuffix();
  const password = "FreedomTraderE2E!2026";
  const emails = [`freedom-trader-e2e-a-${suffix}@example.com`, `freedom-trader-e2e-b-${suffix}@example.com`];
  const users = [];

  for (const email of emails) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) {
      console.warn(`[freedom-trader e2e] Could not create test user ${email}: ${error.message}`);
      continue;
    }
    users.push({ id: data.user.id, email, password });
  }

  fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify({ available: users.length === 2, users }, null, 2));
  if (users.length !== 2) {
    console.warn("[freedom-trader e2e] Fewer than 2 test users provisioned -- isolation test will be skipped.");
  }
}
