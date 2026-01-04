// /pages/api/email/editor/load.js
// FULL REPLACEMENT
// GET /api/email/editor/load?userId=...&name=was-email-1.html
// Returns { ok:true, html:"..." }

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET only" });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRole) return res.status(500).json({ ok: false, error: "Missing Supabase env vars" });

    const supabase = createClient(url, serviceRole);

    const userId = String(req.query.userId || "").trim();
    const name = String(req.query.name || "").trim();
    if (!userId || !name) return res.status(400).json({ ok: false, error: "Missing userId or name" });

    const safeName = name.toLowerCase().endsWith(".html") ? name : `${name}.html`;
    const path = `${userId}/finished-emails/${safeName}`;

    const { data, error } = await supabase.storage.from("email-user-assets").download(path);
    if (error) return res.status(400).json({ ok: false, error: error.message, path });

    const html = data ? await data.text() : "";
    return res.status(200).json({ ok: true, html, name: safeName });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
