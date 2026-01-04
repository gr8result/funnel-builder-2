// ============================================
// /pages/api/email/list-builder-images.js
// FULL REPLACEMENT — returns { ok:true, urls:[...] } for Grapes Asset Manager
// Lists from: email-user-assets/{userId}/email-images
// ============================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKET_USER = "email-user-assets";

export default async function handler(req, res) {
  try {
    const userId = String(req.query.userId || "").trim();
    if (!userId) return res.status(400).json({ ok: false, error: "Missing userId" });

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const folder = `${userId}/email-images`;
    const { data, error } = await supabase.storage
      .from(BUCKET_USER)
      .list(folder, { limit: 500 });

    if (error) return res.status(200).json({ ok: true, urls: [] });

    const urls = (data || [])
      .filter((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(String(f.name || "")))
      .map(
        (f) =>
          `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_USER}/${folder}/${encodeURIComponent(
            f.name
          )}?v=${Date.now()}`
      );

    return res.status(200).json({ ok: true, urls });
  } catch (e) {
    console.error("list-builder-images error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
