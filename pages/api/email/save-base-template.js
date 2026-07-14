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

function metadataPathFor(filePath) {
  const clean = String(filePath || "").trim();
  if (!clean) return "";
  return /\.html?$/i.test(clean)
    ? clean.replace(/\.html?$/i, ".json")
    : `${clean}.json`;
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

    const userId = String(req.user?.id || req.body?.userId || "").trim();
    const name = cleanName(req.body?.name);
    const subject = String(req.body?.subject || name).trim() || name;
    const templateName = String(req.body?.templateName || name).trim() || name;
    const previewText = String(req.body?.previewText || req.body?.preheaderText || "").trim();
    const html = String(req.body?.html || "").trim();
    const blocks = Array.isArray(req.body?.blocks) ? req.body.blocks : [];
    const emailSettings =
      req.body?.emailSettings && typeof req.body.emailSettings === "object"
        ? req.body.emailSettings
        : null;
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

    const metadataPath = metadataPathFor(filePath);
    if (metadataPath && (blocks.length || emailSettings)) {
      const now = new Date().toISOString();
      const metadata = {
        version: 1,
        userId,
        name,
        subject,
        templateName,
        previewText,
        preheaderText: previewText,
        emailSettings,
        templateScope: scope,
        templatePath: filePath,
        blocks,
        html,
        updatedAt: now,
      };

      const { error: metadataError } = await supabase.storage.from(bucket).upload(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        {
          contentType: "application/json; charset=utf-8",
          upsert: true,
        }
      );

      if (metadataError) {
        return res.status(500).json({ ok: false, error: metadataError.message || "Metadata upload failed" });
      }
    }

    return res.status(200).json({
      ok: true,
      path: filePath,
      metadataPath,
      name,
      subject,
      templateName,
      previewText,
      scope,
      message: "Template saved",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}

export default withAuth(handler);
