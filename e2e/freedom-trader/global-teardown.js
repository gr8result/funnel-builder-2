import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { AUTH_STATE_PATH } from "./global-setup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env.local") });

export default async function globalTeardown() {
  if (!fs.existsSync(AUTH_STATE_PATH)) return;
  const state = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, "utf8"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey && state.users?.length) {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    for (const user of state.users) {
      try {
        await admin.auth.admin.deleteUser(user.id);
        await admin.from("freedom_trader_fib_plans").delete().eq("user_id", user.id);
      } catch (error) {
        console.warn(`[freedom-trader e2e] Cleanup failed for ${user.email}: ${error.message}`);
      }
    }
  }
  fs.rmSync(path.dirname(AUTH_STATE_PATH), { recursive: true, force: true });
}
