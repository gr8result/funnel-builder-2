// ============================================
// /pages/api/email/builder-doc-delete.js
// FULL REPLACEMENT — Delete builder doc JSON
// Deletes: email-user-assets/{userId}/builder-docs/{docId}.json
// ============================================

import { createClient } from "@supabase/supabase-js";
import { withAuth } from "../../../lib/withWorkspace";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE || ANON);
const BUCKET = "email-user-assets";

async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    const userId = String(req.body?.userId || "").trim();
    const docId = String(req.body?.docId || "").trim();

    if (!userId) return res.status(400).json({ ok: false, error: "Missing userId" });
    if (!docId) return res.status(400).json({ ok: false, error: "Missing docId" });

    const path = `${userId}/builder-docs/${docId}.json`;
    const htmlPath = `${userId}/builder-docs/${docId}.html`;
    const thumbPath = `${userId}/builder-docs/thumb-${docId}.png`;
    const { error } = await supabase.storage.from(BUCKET).remove([path, htmlPath, thumbPath]);

    if (error) return res.status(500).json({ ok: false, error: "Delete failed", detail: error.message });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("builder-doc-delete error:", e);
    return res.status(500).json({ ok: false, error: "Delete failed", detail: e?.message || String(e) });
  }
}

export default withAuth(handler);
