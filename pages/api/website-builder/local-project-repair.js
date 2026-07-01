import fs from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = process.env.WEBSITE_BUILDER_SITES_DIR || path.join(process.cwd(), "website-builder-sites");

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function safeSegment(value) {
  return String(value || "").trim().replace(/^draft:/, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

async function findProjectDir(projectId) {
  const safeProjectId = safeSegment(projectId);
  if (!safeProjectId) return "";

  const directCandidates = [];
  try {
    const accounts = await fs.readdir(ROOT_DIR, { withFileTypes: true });
    for (const account of accounts) {
      if (!account.isDirectory() || account.name.startsWith("_")) continue;
      directCandidates.push(path.join(ROOT_DIR, account.name, safeProjectId));
    }
  } catch {
    return "";
  }

  for (const candidate of directCandidates) {
    if (await pathExists(path.join(candidate, "site.json"))) return candidate;
  }

  return "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const projectId = String(req.query?.projectId || "").trim();
  if (!projectId) return res.status(400).json({ ok: false, error: "projectId is required" });

  const dir = await findProjectDir(projectId);
  if (!dir) return res.status(404).json({ ok: false, error: "Local project files were not found" });

  const site = await readJson(path.join(dir, "site.json"), null);
  if (!site?.id) return res.status(404).json({ ok: false, error: "Local site.json is missing or invalid" });

  const pages = Array.isArray(site.pages) ? site.pages : [];
  const project = {
    ...site,
    id: String(site.id || projectId).replace(/^draft:/, ""),
    pages,
    pageBlocks: {},
    pagesContent: {},
    chaiData: {},
  };

  for (const page of pages) {
    const name = String(page?.name || "").trim();
    const file = String(page?.file || "").trim();
    if (!name || !file) continue;
    const pageDoc = await readJson(path.join(dir, "pages", file), null);
    project.pageBlocks[name] = Array.isArray(pageDoc?.blocks) ? pageDoc.blocks : [];
    project.pagesContent[name] = pageDoc?.html || "";
    if (pageDoc?.chaiData) project.chaiData[name] = pageDoc.chaiData;
  }

  return res.status(200).json({ ok: true, project });
}
