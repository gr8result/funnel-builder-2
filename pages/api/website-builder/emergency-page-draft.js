import fs from "node:fs/promises";
import path from "node:path";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

const ROOT_DIR = path.join(process.cwd(), "website-builder-sites", "_emergency-drafts");

// Supabase (website_builder_pages) is the durable store. Emergency drafts are a local
// development recovery aid only -- production must not write customer content into the
// repo filesystem.
const IS_PRODUCTION_RUNTIME = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

function safeSegment(value, fallback = "item") {
  const cleaned = String(value || "")
    .trim()
    .replace(/^draft:/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
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

function draftPath(projectId, pageName) {
  return path.join(ROOT_DIR, safeSegment(projectId, "project"), `${safeSegment(pageName, "page")}.json`);
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    await fs.rm(tmpPath, { force: true }).catch(() => {});
    throw error;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  const method = String(req.method || "GET").toUpperCase();
  const projectId = String(req.query?.projectId || req.body?.projectId || "").trim();
  const pageName = pageNameFromValue(req.query?.pageName || req.body?.pageName || "");

  if (!projectId || !pageName) {
    return res.status(400).json({ ok: false, error: "projectId and pageName are required" });
  }

  const filePath = draftPath(projectId, pageName);

  if (method === "GET") {
    const draft = await readJson(filePath);
    return res.status(200).json({ ok: true, draft });
  }

  if (method === "POST") {
    const blocks = Array.isArray(req.body?.blocks) ? req.body.blocks : [];
    if (IS_PRODUCTION_RUNTIME) {
      return res.status(200).json({ ok: true, skipped: true, blocks: blocks.length });
    }
    const draft = {
      projectId,
      pageName,
      blocks,
      html: String(req.body?.html || ""),
      chaiData: req.body?.chaiData && typeof req.body.chaiData === "object" ? req.body.chaiData : null,
      savedAt: new Date().toISOString(),
      source: String(req.body?.source || "builder-save"),
    };
    await writeJson(filePath, draft);
    return res.status(200).json({ ok: true, savedAt: draft.savedAt, blocks: blocks.length });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
