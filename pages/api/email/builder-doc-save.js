// ============================================
// /pages/api/email/builder-doc-save.js
// FULL REPLACEMENT — Save/Upsert builder document (supports Save/Save As/Rename/Duplicate)
// Saves JSON to: email-user-assets/{userId}/builder-docs/{docId}.json
// ============================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE || ANON);
const BUCKET = "email-user-assets";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    const userId = String(req.body?.userId || "").trim();
    const docId = String(req.body?.docId || "").trim();
    const name = String(req.body?.name || "").trim() || "Untitled Email";
    const blocks = Array.isArray(req.body?.blocks) ? req.body.blocks : [];

    if (!userId) return res.status(400).json({ ok: false, error: "Missing userId" });
    if (!docId) return res.status(400).json({ ok: false, error: "Missing docId" });

    const now = new Date().toISOString();
    const payload = {
      version: 1,
      docId,
      userId,
      name,
      blocks,
      updatedAt: now,
      createdAt: req.body?.createdAt ? String(req.body.createdAt) : now,
    };

    const path = `${userId}/builder-docs/${docId}.json`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, JSON.stringify(payload, null, 2), {
        contentType: "application/json",
        upsert: true,
      });

    if (error) {
      return res.status(500).json({ ok: false, error: "Save failed", detail: error.message });
    }

    return res.status(200).json({ ok: true, path, docId, name, updatedAt: now });
  } catch (e) {
    console.error("builder-doc-save error:", e);
    return res.status(500).json({ ok: false, error: "Save failed", detail: e?.message || String(e) });
  }
}
