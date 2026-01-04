// ============================================
// /pages/api/email/builder-doc-load.js
// FULL REPLACEMENT — Load builder document JSON
// Reads: email-user-assets/{userId}/builder-docs/{docId}.json
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
    const userId = String(req.query?.userId || "").trim();
    const docId = String(req.query?.docId || "").trim();

    if (!userId) return res.status(400).json({ ok: false, error: "Missing userId" });
    if (!docId) return res.status(400).json({ ok: false, error: "Missing docId" });

    const path = `${userId}/builder-docs/${docId}.json`;
    const { data, error } = await supabase.storage.from(BUCKET).download(path);

    if (error || !data) {
      return res.status(404).json({ ok: false, error: "Not found", detail: error?.message || "Missing file" });
    }

    const text = await data.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(500).json({ ok: false, error: "Corrupt JSON" });
    }

    return res.status(200).json({ ok: true, doc: parsed });
  } catch (e) {
    console.error("builder-doc-load error:", e);
    return res.status(500).json({ ok: false, error: "Load failed", detail: e?.message || String(e) });
  }
}
