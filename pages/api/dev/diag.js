// pages/api/dev/diag.js
// Quick diagnostics: shows which candidate tables are reachable.

import { createClient } from "@supabase/supabase-js";

export default async function handler(_req, res) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return res.status(200).json({ ok: false, reason: "Missing env", url: !!url, key: !!key });

    const client = createClient(url, key, { auth: { persistSession: false } });
    const names = ["profiles","users_public","app_users","subscription_items","subscriptions","customer_subscriptions","modules","products","plans","payments","invoices","charges","transactions","user_activity","sessions","logins"];
    const results = {};
    // eslint-disable-next-line no-restricted-syntax
    for (const n of names) {
      // eslint-disable-next-line no-await-in-loop
      const { error } = await client.from(n).select("id", { count: "exact", head: true }).limit(1);
      results[n] = !error;
    }
    return res.status(200).json({ ok: true, detected: results });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: e?.message || "unknown" });
  }
}

