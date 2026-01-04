// /pages/api/email/editor/save.js
// FULL REPLACEMENT
// POST { userId, name, html, overwrite?:boolean }
// Saves to: email-user-assets/<uid>/finished-emails/<name>.html

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRole) return res.status(500).json({ ok: false, error: "Missing Supabase env vars" });

    const supabase = createClient(url, serviceRole);

    const userId = String(req.body?.userId || "").trim();
    let name = String(req.body?.name || "").trim();
    const html = String(req.body?.html || "");
    const overwrite = !!req.body?.overwrite;

    if (!userId) return res.status(400).json({ ok: false, error: "Missing userId" });
    if (!name) return res.status(400).json({ ok: false, error: "Missing name" });

    // sanitize filename
    name = name.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-");
    if (!name) return res.status(400).json({ ok: false, error: "Invalid name" });

    const safeName = name.toLowerCase().endsWith(".html") ? name : `${name}.html`;
    const path = `${userId}/finished-emails/${safeName}`;

    // If not overwriting, check if exists
    if (!overwrite) {
      const { data: existing, error: listErr } = await supabase.storage
        .from("email-user-assets")
        .list(`${userId}/finished-emails`, { limit: 1000 });

      if (listErr) return res.status(400).json({ ok: false, error: listErr.message });

      const exists = (existing || []).some((f) => (f?.name || "") === safeName);
      if (exists) {
        return res.status(409).json({
          ok: false,
          error: "File already exists",
          code: "EXISTS",
          name: safeName,
        });
      }
    }

    const file = new Blob([html], { type: "text/html;charset=utf-8" });

    const { error } = await supabase.storage.from("email-user-assets").upload(path, file, {
      upsert: true, // overwrite handled by our exists check above
      contentType: "text/html;charset=utf-8",
    });

    if (error) return res.status(400).json({ ok: false, error: error.message, path });

    return res.status(200).json({ ok: true, name: safeName, path });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
