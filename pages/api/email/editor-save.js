// ============================================
// /pages/api/email/editor-save.js
// GR8 RESULT — Save builder templates to Supabase Storage
// FULL REPLACEMENT
//
// Saves JSON to:
// email-user-assets/{userId}/builder-templates/{templateId}.json
// ============================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const keyToUse = SERVICE_ROLE || ANON;
const supabase = createClient(SUPABASE_URL, keyToUse);

const BUCKET = "email-user-assets";
const FOLDER = "builder-templates";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    const templateId = String(req.body?.templateId || "").trim();
    const userId = String(req.body?.userId || "").trim();
    const blocks = Array.isArray(req.body?.blocks) ? req.body.blocks : [];

    if (!templateId) {
      return res.status(400).json({ ok: false, error: "Missing templateId" });
    }
    if (!userId) {
      return res.status(400).json({ ok: false, error: "Missing userId" });
    }

    const path = `${userId}/${FOLDER}/${templateId}.json`;
    const payload = JSON.stringify(
      { version: 1, templateId, userId, blocks, savedAt: new Date().toISOString() },
      null,
      2
    );

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, payload, {
        contentType: "application/json",
        upsert: true,
      });

    if (error) {
      return res.status(500).json({ ok: false, error: "Save failed", detail: error.message });
    }

    return res.status(200).json({ ok: true, path });
  } catch (e) {
    console.error("editor-save error:", e);
    return res.status(500).json({ ok: false, error: "Save failed", detail: e?.message || String(e) });
  }
}
