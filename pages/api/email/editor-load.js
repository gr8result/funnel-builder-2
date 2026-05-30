// ============================================
// /pages/api/email/editor-load.js
// GR8 RESULT — Load builder templates with fallbacks
// FULL REPLACEMENT
//
// Priority:
// 1) email-user-assets/{userId}/builder-docs/{templateId}.json
// 2) email-user-assets/{userId}/builder-docs/{templateId}.html
// 3) email-user-assets/{userId}/builder-templates/{templateId}.json
// 4) email-user-assets/{userId}/finished-emails/{templateId}.html
// 5) email-assets/templates/{templateId}.html
// 6) blank => []
// ============================================

import { createClient } from "@supabase/supabase-js";
import { blocksToHtml } from "../../../lib/email/blockSchema";
import { withAuth } from "../../../lib/withWorkspace";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const keyToUse = SERVICE_ROLE || ANON;
const supabase = createClient(SUPABASE_URL, keyToUse);

const USER_BUCKET = "email-user-assets";
const BASE_BUCKET = "email-assets";
const DOCS_FOLDER = "builder-docs";
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

async function handler(req, res) {
  try {
    const templateId = String(req.query.templateId || req.query.id || "").trim();
    const userId = req.user.id;

    if (!templateId) {
      return ok(res, {
        templateId: "",
        userId,
        html: "",
        blocks: [],
        source: "missing-id",
      });
    }
    if (templateId === "blank") {
      return ok(res, {
        templateId,
        userId,
        html: "",
        blocks: [],
        source: "blank",
      });
    }

    // 1) builder doc JSON
    const docJsonPath = `${userId}/${DOCS_FOLDER}/${templateId}.json`;
    const docJsonText = await downloadText(USER_BUCKET, docJsonPath);
    if (docJsonText) {
      try {
        const parsed = JSON.parse(docJsonText);
        const blocks = Array.isArray(parsed?.blocks) ? parsed.blocks : [];
        const parsedHtml = typeof parsed?.html === "string" ? parsed.html.trim() : "";
        const html = parsedHtml || (blocks.length ? blocksToHtml(blocks) : "");
        return ok(res, {
          templateId,
          userId,
          html,
          blocks,
          source: "builder-doc-json",
          format: parsedHtml ? "html" : blocks.length ? "blocks" : "empty",
          path: docJsonPath,
        });
      } catch {}
    }

    // 2) builder doc HTML snapshot
    const docHtmlPath = `${userId}/${DOCS_FOLDER}/${templateId}.html`;
    const docHtml = await downloadText(USER_BUCKET, docHtmlPath);
    if (docHtml) {
      return ok(res, {
        templateId,
        userId,
        html: docHtml,
        blocks: [],
        source: "builder-doc-html",
        format: "html",
        path: docHtmlPath,
      });
    }

    // 3) builder template JSON
    const builderPath = `${userId}/${BUILDER_FOLDER}/${templateId}.json`;
    const jsonText = await downloadText(USER_BUCKET, builderPath);
    if (jsonText) {
      try {
        const parsed = JSON.parse(jsonText);
        const blocks = Array.isArray(parsed?.blocks) ? parsed.blocks : [];
        const parsedHtml = typeof parsed?.html === "string" ? parsed.html.trim() : "";
        const html = parsedHtml || (blocks.length ? blocksToHtml(blocks) : "");
        return ok(res, {
          templateId,
          userId,
          html,
          blocks,
          source: "builder-json",
          format: parsedHtml ? "html" : blocks.length ? "blocks" : "empty",
          path: builderPath,
        });
      } catch {}
    }

    // 4) legacy html
    const legacyPath = `${userId}/${LEGACY_FOLDER}/${templateId}.html`;
    const legacyHtml = await downloadText(USER_BUCKET, legacyPath);
    if (legacyHtml) {
      return ok(res, {
        templateId,
        userId,
        html: legacyHtml,
        blocks: [],
        source: "legacy-html",
        format: "html",
        path: legacyPath,
      });
    }

    // 5) base template html
    const basePath = `templates/${templateId}.html`;
    const baseHtml = await downloadText(BASE_BUCKET, basePath);
    if (baseHtml) {
      return ok(res, {
        templateId,
        userId,
        html: baseHtml,
        blocks: [],
        source: "base-html",
        format: "html",
        path: basePath,
      });
    }

    return ok(res, {
      templateId,
      userId,
      html: "",
      blocks: [],
      source: "not-found",
    });
  } catch (e) {
    console.error("editor-load error:", e);
    return res.status(500).json({ ok: false, error: "Load failed", detail: e?.message || String(e) });
  }
}

export default withAuth(handler);
