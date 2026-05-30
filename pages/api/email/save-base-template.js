import { createClient } from "@supabase/supabase-js";
import { withAuth } from "../../../lib/withWorkspace";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE || "";

const BUCKET = "email-assets";

function cleanName(value) {
  return String(value || "Base Template")
    .replace(/\.html$/i, "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Base Template";
}

async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({ ok: false, error: "Missing Supabase env" });
    }

    const userId = String(req.body?.userId || "").trim();
    const name = cleanName(req.body?.name);
    const html = String(req.body?.html || "").trim();
    const inputPath = String(req.body?.path || "").trim();
    const scope = String(req.body?.scope || "public").trim().toLowerCase();

    if (!userId) return res.status(400).json({ ok: false, error: "Missing userId" });
    if (!html) return res.status(400).json({ ok: false, error: "Missing html" });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const bucket = scope === "user" ? "email-user-assets" : BUCKET;
    const filePath = inputPath || (scope === "user" ? `${userId}/finished-emails/${name}.html` : `templates/${name}.html`);

    const { error } = await supabase.storage.from(bucket).upload(filePath, html, {
      contentType: "text/html; charset=utf-8",
      upsert: true,
    });

    if (error) {
      return res.status(500).json({ ok: false, error: error.message || "Upload failed" });
    }

    return res.status(200).json({
      ok: true,
      path: filePath,
      name,
      scope,
      message: "Template saved",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}

export default withAuth(handler);
