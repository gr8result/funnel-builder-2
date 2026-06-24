import fs from "fs/promises";
import path from "path";
import { withAuth } from "../../../lib/withWorkspace";

const DEFAULTS_FILE_PATH = path.join(process.cwd(), "data", "website-builder-defaults.json");
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

async function ensureDefaultsFile() {
  await fs.mkdir(path.dirname(DEFAULTS_FILE_PATH), { recursive: true });
  try {
    await fs.access(DEFAULTS_FILE_PATH);
  } catch {
    await fs.writeFile(
      DEFAULTS_FILE_PATH,
      JSON.stringify({ templateOverrides: {}, blockDefaults: {} }, null, 2),
      "utf8"
    );
  }
}

async function readDefaultsFile() {
  await ensureDefaultsFile();
  try {
    const raw = await fs.readFile(DEFAULTS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return {
      templateOverrides: parsed?.templateOverrides && typeof parsed.templateOverrides === "object" && !Array.isArray(parsed.templateOverrides)
        ? parsed.templateOverrides
        : {},
      blockDefaults: parsed?.blockDefaults && typeof parsed.blockDefaults === "object" && !Array.isArray(parsed.blockDefaults)
        ? parsed.blockDefaults
        : {},
    };
  } catch {
    return { templateOverrides: {}, blockDefaults: {} };
  }
}

async function writeDefaultsFile(next) {
  await ensureDefaultsFile();
  await fs.writeFile(
    DEFAULTS_FILE_PATH,
    JSON.stringify({
      templateOverrides: sanitizeJson(next?.templateOverrides || {}, {}),
      blockDefaults: sanitizeJson(next?.blockDefaults || {}, {}),
    }, null, 2),
    "utf8"
  );
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
    const defaults = await readDefaultsFile();
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

  const defaults = await readDefaultsFile();

  if (action === "save-template-page") {
    const templateSlug = String(req.body?.templateSlug || "").trim();
    const pageName = pageNameFromValue(req.body?.pageName || "");
    if (!templateSlug) return badRequest(res, "Missing template slug");
    if (!pageName) return badRequest(res, "Missing page name");

    const current = defaults.templateOverrides[templateSlug] || { pageBlocks: {} };
    const nextOverride = {
      ...current,
      updatedAt: new Date().toISOString(),
      pageBlocks: {
        ...(current.pageBlocks || {}),
        [pageName]: sanitizeJson(req.body?.blocks || [], []),
      },
      globalNavBlock: sanitizeJson(req.body?.globalNavBlock || current.globalNavBlock || null, null),
      globalFooterBlock: sanitizeJson(req.body?.globalFooterBlock || current.globalFooterBlock || null, null),
    };

    defaults.templateOverrides[templateSlug] = nextOverride;
    await writeDefaultsFile(defaults);
    return res.status(200).json({ ok: true, templateOverride: nextOverride, blockDefaults: defaults.blockDefaults });
  }

  if (action === "save-template-site") {
    const templateSlug = String(req.body?.templateSlug || "").trim();
    if (!templateSlug) return badRequest(res, "Missing template slug");

    const nextOverride = {
      updatedAt: new Date().toISOString(),
      pageBlocks: sanitizeJson(req.body?.pageBlocks || {}, {}),
      globalNavBlock: sanitizeJson(req.body?.globalNavBlock || null, null),
      globalFooterBlock: sanitizeJson(req.body?.globalFooterBlock || null, null),
    };

    defaults.templateOverrides[templateSlug] = nextOverride;
    await writeDefaultsFile(defaults);
    return res.status(200).json({ ok: true, templateOverride: nextOverride, blockDefaults: defaults.blockDefaults });
  }

  if (action === "save-block-default") {
    const blockType = String(req.body?.blockType || "").trim();
    if (!blockType) return badRequest(res, "Missing block type");

    defaults.blockDefaults[blockType] = sanitizeJson(req.body?.props || {}, {});
    await writeDefaultsFile(defaults);
    return res.status(200).json({ ok: true, blockDefaults: defaults.blockDefaults });
  }

  return badRequest(res, `Unsupported defaults action: ${action}`);
}

export default withAuth(handler);
