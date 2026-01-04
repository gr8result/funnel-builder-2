// /pages/api/email/editor/files.js
// FULL REPLACEMENT
// GET => list user's saved HTML files in: email-user-assets/<uid>/finished-emails/

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET only" });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRole) return res.status(500).json({ ok: false, error: "Missing Supabase env vars" });

    const supabase = createClient(url, serviceRole);

    // We rely on Supabase auth cookie via middleware? No. We'll accept anon user token via header if present.
    // BUT easiest: use anon on client for auth, and send userId in query. (No secrets)
    // We'll still validate folder exists.
    const userId = String(req.query.userId || "").trim();
    if (!userId) return res.status(400).json({ ok: false, error: "Missing userId" });

    const folder = `${userId}/finished-emails`;
    const { data, error } = await supabase.storage.from("email-user-assets").list(folder, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) return res.status(400).json({ ok: false, error: error.message });

    const files = (data || [])
      .filter((f) => (f?.name || "").toLowerCase().endsWith(".html"))
      .map((f) => ({
        name: f.name,
        base: f.name.replace(/\.html$/i, ""),
        updated_at: f.updated_at || null,
        created_at: f.created_at || null,
        size: f.metadata?.size || null,
      }));

    return res.status(200).json({ ok: true, files });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
