import fs from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = process.env.WEBSITE_BUILDER_SITES_DIR || path.join(process.cwd(), "website-builder-sites");
const SITE_FILE = "site.json";

function safeSegment(value, fallback = "item") {
  const cleaned = String(value || "")
    .trim()
    .replace(/^draft:/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

function slugify(value, fallback = "page") {
  const cleaned = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

function siteDir(accountId, siteId) {
  return path.join(ROOT_DIR, safeSegment(accountId, "account"), safeSegment(siteId, "site"));
}

function pageFileName(page) {
  return `${slugify(page?.slug || page?.name || page?.id || "page")}.json`;
}

async function ensureSiteFolders(dir) {
  await fs.mkdir(path.join(dir, "pages"), { recursive: true });
  await fs.mkdir(path.join(dir, "assets", "images"), { recursive: true });
  await fs.mkdir(path.join(dir, "assets", "uploads"), { recursive: true });
  await fs.mkdir(path.join(dir, "templates"), { recursive: true });
  await fs.mkdir(path.join(dir, "backups"), { recursive: true });
}

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, filePath);
}

function normalizePages(project) {
  const pages = Array.isArray(project?.pages) && project.pages.length
    ? project.pages
    : [{ name: "Home", objective: "Build the Home page." }];

  return pages.map((page, index) => {
    const name = String(page?.name || page?.title || (index === 0 ? "Home" : `Page ${index + 1}`)).trim();
    const slug = slugify(page?.slug || name, index === 0 ? "home" : `page-${index + 1}`);
    return {
      ...page,
      id: String(page?.id || slug || `page-${index + 1}`),
      name,
      slug,
      file: pageFileName({ ...page, name, slug }),
      order: Number.isFinite(Number(page?.order)) ? Number(page.order) : index,
    };
  });
}

function stripPageMaps(project = {}) {
  const {
    pageBlocks: _pageBlocks,
    pagesContent: _pagesContent,
    chaiData: _chaiData,
    brandAssets: _brandAssets,
    ...site
  } = project || {};
  return site;
}

function buildSiteDocument(project, accountId) {
  const pages = normalizePages(project);
  const site = stripPageMaps(project);
  const pageOrder = pages.map((page) => page.id || page.slug || page.name);
  const pageSlugs = Object.fromEntries(pages.map((page) => [page.name, page.slug]));

  return {
    ...site,
    id: String(project?.id || "").trim(),
    accountId: String(accountId || project?.accountId || project?.userId || project?.user_id || ""),
    name: project?.name || "Untitled Website",
    pages,
    navigation: project?.navigation || project?.nav || null,
    theme: project?.theme || project?.globalStyles || null,
    pageOrder,
    pageSlugs,
    globalNavBlock: project?.globalNavBlock || null,
    globalFooterBlock: project?.globalFooterBlock || null,
    publication: project?.publication || null,
    published: !!project?.published,
    updatedAt: project?.updatedAt || new Date().toISOString(),
    storageVersion: 2,
  };
}

function buildPageDocument(project, page) {
  const name = page.name;
  const chaiData = project?.chaiData?.[name] || null;
  const blocks = Array.isArray(project?.pageBlocks?.[name])
    ? project.pageBlocks[name]
    : Array.isArray(chaiData?.blocks)
      ? chaiData.blocks
      : [];

  return {
    id: page.id,
    name,
    slug: page.slug,
    seo: page.seo || page.seoSettings || {},
    sections: Array.isArray(page.sections) ? page.sections : [],
    widgets: Array.isArray(page.widgets) ? page.widgets : [],
    styles: page.styles || page.pageStyles || {},
    assets: page.assets || page.assetRefs || [],
    objective: page.objective || "",
    blocks,
    chaiData,
    html: project?.pagesContent?.[name] || "",
    updatedAt: project?.updatedAt || new Date().toISOString(),
  };
}

function hydrateProject(site, pageDoc = null) {
  const project = {
    ...site,
    id: String(site?.id || "").trim(),
    pages: normalizePages(site),
    pageBlocks: {},
    pagesContent: {},
    chaiData: {},
  };

  if (pageDoc?.name) {
    project.pageBlocks[pageDoc.name] = Array.isArray(pageDoc.blocks) ? pageDoc.blocks : [];
    project.pagesContent[pageDoc.name] = pageDoc.html || "";
    if (pageDoc.chaiData) project.chaiData[pageDoc.name] = pageDoc.chaiData;
  }

  return project;
}

export async function splitWebsiteProjectExists(accountId, siteId) {
  const dir = siteDir(accountId, siteId);
  const site = await readJson(path.join(dir, SITE_FILE), null);
  return !!site;
}

export async function saveSplitWebsiteProject(accountId, project, options = {}) {
  const siteId = String(project?.id || options?.siteId || "").trim().replace(/^draft:/, "");
  if (!accountId || !siteId) throw new Error("accountId and siteId are required for website storage");

  const dir = siteDir(accountId, siteId);
  await ensureSiteFolders(dir);

  const existingSite = await readJson(path.join(dir, SITE_FILE), null);
  const site = buildSiteDocument({ ...(existingSite || {}), ...(project || {}), id: siteId }, accountId);
  const now = new Date().toISOString();
  site.updatedAt = now;

  await writeJson(path.join(dir, SITE_FILE), site);
  if (existingSite?.pages && Array.isArray(existingSite.pages)) {
    const nextFiles = new Set(site.pages.map((page) => page.file || pageFileName(page)));
    for (const oldPage of normalizePages(existingSite)) {
      const oldFile = oldPage.file || pageFileName(oldPage);
      if (!nextFiles.has(oldFile)) {
        await fs.rm(path.join(dir, "pages", oldFile), { force: true });
      }
    }
  }
  if (options?.siteOnly) {
    return loadSplitWebsiteProject(accountId, siteId, options?.loadPageName || site.pages[0]?.name);
  }

  const selectedPageName = String(options?.pageName || "").trim();
  const pagesToSave = selectedPageName
    ? site.pages.filter((page) => page.name === selectedPageName || page.slug === slugify(selectedPageName))
    : site.pages;

  for (const page of pagesToSave) {
    const pageDoc = buildPageDocument({ ...project, updatedAt: now }, page);
    await writeJson(path.join(dir, "pages", page.file || pageFileName(page)), pageDoc);
  }

  return loadSplitWebsiteProject(accountId, siteId, selectedPageName || options?.loadPageName || site.pages[0]?.name);
}

export async function loadSplitWebsiteProject(accountId, siteId, pageName = "") {
  const dir = siteDir(accountId, siteId);
  const site = await readJson(path.join(dir, SITE_FILE), null);
  if (!site) return null;

  const pages = normalizePages(site);
  const requested = slugify(pageName || pages[0]?.name || "Home", "home");
  const page = pages.find((entry) => slugify(entry.name) === requested || slugify(entry.slug) === requested) || pages[0];
  const pageDoc = page ? await readJson(path.join(dir, "pages", page.file || pageFileName(page)), null) : null;

  return hydrateProject({ ...site, pages }, pageDoc || (page ? { ...page, blocks: [], html: "" } : null));
}

export async function loadSplitWebsiteProjectSite(accountId, siteId) {
  const dir = siteDir(accountId, siteId);
  const site = await readJson(path.join(dir, SITE_FILE), null);
  return site ? hydrateProject(site, null) : null;
}

export async function loadFullSplitWebsiteProject(accountId, siteId) {
  const dir = siteDir(accountId, siteId);
  const site = await readJson(path.join(dir, SITE_FILE), null);
  if (!site) return null;

  const pages = normalizePages(site);
  const project = hydrateProject({ ...site, pages }, null);
  for (const page of pages) {
    const pageDoc = await readJson(path.join(dir, "pages", page.file || pageFileName(page)), null);
    if (!pageDoc?.name) continue;
    project.pageBlocks[pageDoc.name] = Array.isArray(pageDoc.blocks) ? pageDoc.blocks : [];
    project.pagesContent[pageDoc.name] = pageDoc.html || "";
    if (pageDoc.chaiData) project.chaiData[pageDoc.name] = pageDoc.chaiData;
  }
  return project;
}

export async function migrateWebsiteProjectToSplitStorage(accountId, project, options = {}) {
  const siteId = String(project?.id || options?.siteId || "").trim().replace(/^draft:/, "");
  if (!accountId || !siteId || !project) return null;
  const shouldWrite = options?.overwrite === true || !(await splitWebsiteProjectExists(accountId, siteId));
  if (shouldWrite) {
    return saveSplitWebsiteProject(accountId, { ...project, id: siteId }, { loadPageName: options?.pageName || "" });
  }
  return loadSplitWebsiteProject(accountId, siteId, options?.pageName || "");
}

export async function listSplitWebsiteProjects(accountId) {
  const accountDir = path.join(ROOT_DIR, safeSegment(accountId, "account"));
  let entries = [];
  try {
    entries = await fs.readdir(accountDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const site = await loadSplitWebsiteProjectSite(accountId, entry.name);
    if (site?.id) projects.push(site);
  }

  return projects.sort((left, right) => {
    const l = Date.parse(left?.updatedAt || left?.createdAt || 0) || 0;
    const r = Date.parse(right?.updatedAt || right?.createdAt || 0) || 0;
    return r - l;
  });
}

export async function deleteSplitWebsiteProject(accountId, siteId) {
  await fs.rm(siteDir(accountId, siteId), { recursive: true, force: true });
}
