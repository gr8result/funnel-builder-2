// /pages/api/email/templates/import.js
// FULL REPLACEMENT / NEW FILE
//
// GET ?scope=public|user&path=...&name=...
// Uses SUPABASE_SERVICE_ROLE_KEY to read Storage reliably (bypasses browser policies)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PUBLIC_BUCKET = "email-assets";
const USER_BUCKET = "email-user-assets";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET only" });

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({ ok: false, error: "Missing SUPABASE env vars" });
    }

    const scope = String(req.query.scope || "").toLowerCase();
    const path = String(req.query.path || "");
    const name = String(req.query.name || "");

    if (!scope || !path) {
      return res.status(400).json({ ok: false, error: "Missing scope or path" });
    }

    const bucket = scope === "public" ? PUBLIC_BUCKET : USER_BUCKET;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const { data, error } = await admin.storage.from(bucket).download(path);
    if (error) {
      return res.status(400).json({
        ok: false,
        error: `Storage download failed: ${error.message || "unknown"}`,
        bucket,
        path,
      });
    }

    const buf = Buffer.from(await data.arrayBuffer());
    const html = buf.toString("utf8");

    return res.status(200).json({
      ok: true,
      bucket,
      path,
      name: name || path.split("/").pop() || "template.html",
      html,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Unknown error" });
  }
}
