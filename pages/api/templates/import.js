// /pages/api/email/templates/import.js
// FULL REPLACEMENT / NEW FILE
//
// GET ?scope=public|user&path=...&name=...
// Uses SUPABASE_SERVICE_ROLE_KEY to read Storage reliably (bypasses browser policies)

import { createClient } from "@supabase/supabase-js";
import { withAuth } from "../../../lib/withWorkspace";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PUBLIC_BUCKET = "email-assets";
const USER_BUCKET = "email-user-assets";

function metadataPathFor(filePath) {
  const clean = String(filePath || "").trim();
  if (!clean) return "";
  return /\.html?$/i.test(clean)
    ? clean.replace(/\.html?$/i, ".json")
    : `${clean}.json`;
}

async function downloadText(admin, bucket, path) {
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return buf.toString("utf8");
}

async function handler(req, res) {
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

    const html = await downloadText(admin, bucket, path);
    if (html == null) {
      return res.status(400).json({
        ok: false,
        error: "Storage download failed",
        bucket,
        path,
      });
    }

    let metadata = null;
    const metadataPath = metadataPathFor(path);
    const metadataText = metadataPath ? await downloadText(admin, bucket, metadataPath) : null;
    if (metadataText) {
      try {
        metadata = JSON.parse(metadataText);
      } catch {
        metadata = null;
      }
    }

    return res.status(200).json({
      ok: true,
      bucket,
      path,
      metadataPath,
      name: name || path.split("/").pop() || "template.html",
      subject: metadata?.subject || metadata?.name || name || "",
      templateName: metadata?.templateName || metadata?.name || name || "",
      previewText: metadata?.previewText || metadata?.preheaderText || "",
      preheaderText: metadata?.preheaderText || metadata?.previewText || "",
      emailSettings: metadata?.emailSettings || null,
      blocks: Array.isArray(metadata?.blocks) ? metadata.blocks : null,
      html,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Unknown error" });
  }
}

export default withAuth(handler);
