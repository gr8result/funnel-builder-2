// ============================================
// /pages/api/email/editor-load.js
// GR8 RESULT — Load builder templates with fallbacks
// FULL REPLACEMENT
//
// Priority:
// 1) email-user-assets/{userId}/builder-templates/{templateId}.json
// 2) email-user-assets/{userId}/finished-emails/{templateId}.html
// 3) email-assets/templates/{templateId}.html
// 4) blank => []
// ============================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const keyToUse = SERVICE_ROLE || ANON;
const supabase = createClient(SUPABASE_URL, keyToUse);

const USER_BUCKET = "email-user-assets";
const BASE_BUCKET = "email-assets";
const BUILDER_FOLDER = "builder-templates";
const LEGACY_FOLDER = "finished-emails";

function ok(res, body) {
  return res.status(200).json({ ok: true, ...body });
}

async function downloadText(bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;
  return await data.text();
}

export default async function handler(req, res) {
  try {
    const templateId = String(req.query.templateId || req.query.id || "").trim();
    const userId = String(req.query.userId || "").trim();

    if (!templateId) return ok(res, { templateId: "", userId, blocks: [], source: "missing-id" });
    if (templateId === "blank") return ok(res, { templateId, userId, blocks: [], source: "blank" });

    // 1) builder JSON
    const builderPath = `${userId}/${BUILDER_FOLDER}/${templateId}.json`;
    const jsonText = await downloadText(USER_BUCKET, builderPath);
    if (jsonText) {
      try {
        const parsed = JSON.parse(jsonText);
        const blocks = Array.isArray(parsed?.blocks) ? parsed.blocks : [];
        return ok(res, { templateId, userId, blocks, source: "builder-json", path: builderPath });
      } catch {}
    }

    // 2) legacy html
    const legacyPath = `${userId}/${LEGACY_FOLDER}/${templateId}.html`;
    const legacyHtml = await downloadText(USER_BUCKET, legacyPath);
    if (legacyHtml) {
      return ok(res, { templateId, userId, blocks: [], source: "legacy-html-found", path: legacyPath, legacyHtml: true });
    }

    // 3) base template html
    const basePath = `templates/${templateId}.html`;
    const baseHtml = await downloadText(BASE_BUCKET, basePath);
    if (baseHtml) {
      return ok(res, { templateId, userId, blocks: [], source: "base-html-found", path: basePath, baseHtml: true });
    }

    return ok(res, { templateId, userId, blocks: [], source: "not-found" });
  } catch (e) {
    console.error("editor-load error:", e);
    return res.status(500).json({ ok: false, error: "Load failed", detail: e?.message || String(e) });
  }
}
