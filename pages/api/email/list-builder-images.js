// ============================================
// /pages/api/email/list-builder-images.js
// FULL REPLACEMENT — returns { ok:true, urls:[...] } for Grapes Asset Manager
// Lists from: email-user-assets/{userId}/email-images
// ============================================

import { createClient } from "@supabase/supabase-js";
import { listMergedSharedMediaLibrary } from "../../../lib/sharedMediaLibrary";

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

    const sharedImages = await listMergedSharedMediaLibrary({ admin: supabase, userId });

    const { data: emailData } = await supabase.storage
      .from(BUCKET_USER)
      .list(`${userId}/email-images`, { limit: 500 });

    const emailUrls = (emailData || [])
      .filter((entry) => /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(String(entry?.name || '')))
      .map((entry) => {
        const { data } = supabase.storage.from(BUCKET_USER).getPublicUrl(`${userId}/email-images/${entry.name}`);
        return data?.publicUrl ? `${data.publicUrl}?v=${Date.now()}` : '';
      })
      .filter(Boolean);

    const urls = Array.from(new Set([...(sharedImages || []).map((image) => image.url).filter(Boolean), ...emailUrls]));

    return res.status(200).json({ ok: true, urls });
  } catch (e) {
    console.error("list-builder-images error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
