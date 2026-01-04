// /pages/api/email/templates/get.js
// FULL REPLACEMENT
// GET /api/email/templates/get?scope=public|user&path=templates/templates/activation.html
// Returns { ok:true, html:"..." }

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "GET only" });
    }

    const scope = String(req.query.scope || "").toLowerCase();
    const path = String(req.query.path || "").trim();

    if (!scope || !path) {
      return res.status(400).json({ ok: false, error: "Missing scope or path" });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only
    if (!url || !serviceRole) {
      return res.status(500).json({ ok: false, error: "Missing Supabase env vars" });
    }

    const supabase = createClient(url, serviceRole);

    const bucket = scope === "user" ? "email-user-assets" : "email-assets";

    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) {
      return res.status(400).json({ ok: false, error: error.message, bucket, path });
    }

    const html = data ? await data.text() : "";
    return res.status(200).json({ ok: true, html });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
