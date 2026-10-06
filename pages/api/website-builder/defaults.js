import { withAuth } from "../../../lib/withWorkspace";
import {
  readWebsiteBuilderDefaults,
  getTemplateOverride,
  getBlockDefaults,
  saveTemplatePage,
  saveTemplateSite,
  saveBlockDefault,
} from "../../../data/website-builder-defaults/index.js";

const DEVELOPER_USER_IDS = new Set(["35ab846e-0764-498b-b1f8-7d2cf27d85a5"]);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "15mb",
    },
  },
};

function sanitizeJson(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function pageNameFromValue(value) {
  if (typeof value === "string") {
    const text = value.trim();
    return text && text !== "[object Object]" ? text : "";
  }
  if (value && typeof value === "object") {
    return pageNameFromValue(value.name || value.title || value.slug || "");
  }
  return "";
}

function badRequest(res, error) {
  return res.status(400).json({ ok: false, error });
}

function isDeveloperUser(user) {
  return DEVELOPER_USER_IDS.has(String(user?.id || ""));
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method === "GET") {
    const defaults = await readWebsiteBuilderDefaults();
    return res.status(200).json({ ok: true, ...defaults });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!isDeveloperUser(req.user)) {
    return res.status(403).json({ ok: false, error: "Developer template access required" });
  }

  const action = String(req.body?.action || "").trim().toLowerCase();
  if (!action) return badRequest(res, "Missing defaults action");

  if (action === "save-template-page") {
    const templateSlug = String(req.body?.templateSlug || "").trim();
    const pageName = pageNameFromValue(req.body?.pageName || "");
    if (!templateSlug) return badRequest(res, "Missing template slug");
    if (!pageName) return badRequest(res, "Missing page name");

    const current = (await getTemplateOverride(templateSlug)) || { pageBlocks: {} };
    const blocks = sanitizeJson(req.body?.blocks || [], []);
    const globalNavBlock = sanitizeJson(req.body?.globalNavBlock || current.globalNavBlock || null, null);
    const globalFooterBlock = sanitizeJson(req.body?.globalFooterBlock || current.globalFooterBlock || null, null);

    const nextOverride = await saveTemplatePage(templateSlug, pageName, blocks, globalNavBlock, globalFooterBlock);
    const blockDefaults = await getBlockDefaults();
    return res.status(200).json({ ok: true, templateOverride: nextOverride, blockDefaults });
  }

  if (action === "save-template-site") {
    const templateSlug = String(req.body?.templateSlug || "").trim();
    if (!templateSlug) return badRequest(res, "Missing template slug");

    const pageBlocks = sanitizeJson(req.body?.pageBlocks || {}, {});
    const globalNavBlock = sanitizeJson(req.body?.globalNavBlock || null, null);
    const globalFooterBlock = sanitizeJson(req.body?.globalFooterBlock || null, null);

    const nextOverride = await saveTemplateSite(templateSlug, pageBlocks, globalNavBlock, globalFooterBlock);
    const blockDefaults = await getBlockDefaults();
    return res.status(200).json({ ok: true, templateOverride: nextOverride, blockDefaults });
  }

  if (action === "save-block-default") {
    const blockType = String(req.body?.blockType || "").trim();
    if (!blockType) return badRequest(res, "Missing block type");

    const blockDefaults = await saveBlockDefault(blockType, sanitizeJson(req.body?.props || {}, {}));
    return res.status(200).json({ ok: true, blockDefaults });
  }

  return badRequest(res, `Unsupported defaults action: ${action}`);
}

export default withAuth(handler);
