import fs from "node:fs/promises";
import path from "node:path";
import { createWebsiteBuilderBackup } from "./backupStorage";
import { buildFooterNavigationContext, footerBlockToGlobalFooter, globalFooterToFooterBlock } from "./footerNavigation";

const ROOT_DIR = process.env.WEBSITE_BUILDER_SITES_DIR || path.join(process.cwd(), "website-builder-sites");
const SITE_FILE = "site.json";
const PRESERVE_DATA_URL_SENTINEL = "__WB_PRESERVE_DATA_URL__";

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
  try {
    await fs.writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    await fs.rm(tmpPath, { force: true }).catch(() => {});
    throw error;
  }
}

function jsonRoundTrip(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function jsonMatchesSaved(left, right) {
  return stableJson(jsonRoundTrip(left)) === stableJson(jsonRoundTrip(right));
}

function shouldPreserveExistingPageBlocks(existingBlocks, incomingBlocks, source = "") {
  return false;
}

function normalizeDeletedBlockTombstones(project) {
  return (Array.isArray(project?.deletedBlockIds) ? project.deletedBlockIds : [])
    .map((entry) => {
      if (typeof entry === "string") return { blockId: entry, pageId: "" };
      if (!entry || typeof entry !== "object") return null;
      return {
        blockId: String(entry.blockId || entry.id || "").trim(),
        pageId: String(entry.pageId || entry.pageName || "").trim(),
      };
    })
    .filter((entry) => entry?.blockId);
}

function filterDeletedBlocksForPage(blocks, deletedBlockIds, pageName) {
  if (!Array.isArray(blocks) || !Array.isArray(deletedBlockIds) || deletedBlockIds.length === 0) return blocks;
  const ids = new Set(
    deletedBlockIds
      .filter((entry) => !entry?.pageId || entry.pageId === pageName)
      .map((entry) => String(entry?.blockId || ""))
      .filter(Boolean)
  );
  if (!ids.size) return blocks;
  return blocks.filter((block) => !ids.has(String(block?.id || "")));
}

function isDataImage(value) {
  return typeof value === "string" && /^data:image\//i.test(value);
}

function restorePreservedDataUrls(incoming, existing) {
  if (incoming === PRESERVE_DATA_URL_SENTINEL) {
    return typeof existing === "string" && existing.trim() ? existing : "";
  }
  if (Array.isArray(incoming)) {
    const existingArray = Array.isArray(existing) ? existing : [];
    const existingById = new Map(
      existingArray
        .filter((entry) => entry && typeof entry === "object" && entry.id !== undefined && entry.id !== null)
        .map((entry) => [String(entry.id), entry])
    );

    return incoming.map((entry, index) => {
      const matchedExisting = entry && typeof entry === "object" && entry.id !== undefined && entry.id !== null
        ? existingById.get(String(entry.id))
        : undefined;
      return restorePreservedDataUrls(entry, matchedExisting ?? existingArray[index]);
    });
  }
  if (incoming && typeof incoming === "object") {
    const next = {};
    const existingObject = existing && typeof existing === "object" ? existing : {};
    for (const [key, value] of Object.entries(incoming)) {
      next[key] = restorePreservedDataUrls(value, existingObject[key]);
    }
    return next;
  }
  return incoming;
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

function normalizePages(project) {
  const pages = Array.isArray(project?.pages) && project.pages.length
    ? project.pages
    : [{ name: "Home", objective: "Build the Home page." }];

  const seen = new Set();
  const normalized = [];
  pages.forEach((page, index) => {
    const name = pageNameFromValue(page) || (index === 0 ? "Home" : `Page ${index + 1}`);
    const slug = slugify(page?.slug || name, index === 0 ? "home" : `page-${index + 1}`);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    normalized.push({
      ...page,
      id: String(page?.id || slug || `page-${index + 1}`),
      name,
      slug,
      file: pageFileName({ ...page, name, slug }),
      order: Number.isFinite(Number(page?.order)) ? Number(page.order) : normalized.length,
    });
  });
  return normalized.length ? normalized : [{ name: "Home", slug: "home", id: "home", file: "home.json", order: 0 }];
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
  const footerContext = buildFooterNavigationContext({ pages });
  const globalFooterBlock = project?.globalFooterBlock || globalFooterToFooterBlock(project?.globalFooter, null) || null;

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
    globalFooterBlock,
    globalFooter: project?.globalFooter || footerBlockToGlobalFooter(globalFooterBlock, footerContext) || null,
    publication: project?.publication || null,
    published: !!project?.published,
    updatedAt: project?.updatedAt || new Date().toISOString(),
    storageVersion: 2,
  };
}

function buildPageDocument(project, page, existingPageDoc = null) {
  const name = page.name;
  const hasIncomingChaiData = Object.prototype.hasOwnProperty.call(project?.chaiData || {}, name);
  const hasIncomingHtml = Object.prototype.hasOwnProperty.call(project?.pagesContent || {}, name);
  const chaiData = hasIncomingChaiData ? project?.chaiData?.[name] || null : existingPageDoc?.chaiData || null;
  const rawBlocks = Array.isArray(project?.pageBlocks?.[name])
    ? project.pageBlocks[name]
    : Array.isArray(existingPageDoc?.blocks)
      ? existingPageDoc.blocks
      : Array.isArray(chaiData?.blocks)
      ? chaiData.blocks
      : [];
  const blocks = restorePreservedDataUrls(rawBlocks, existingPageDoc?.blocks);
  const nextChaiData = hasIncomingChaiData
    ? restorePreservedDataUrls(chaiData, existingPageDoc?.chaiData)
    : chaiData;
  const hasBlocks = Array.isArray(blocks) && blocks.length > 0;

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
    chaiData: nextChaiData,
    html: hasBlocks ? "" : (hasIncomingHtml ? project?.pagesContent?.[name] || "" : existingPageDoc?.html || ""),
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

  const existingSite = await readJson(path.join(dir, SITE_FILE), null);
  const backupSource = options?.backupSource || options?.source || (options?.siteOnly ? "site-save" : "page-save");
  const existingFullProject = existingSite ? await loadFullSplitWebsiteProject(accountId, siteId) : null;
  await createWebsiteBuilderBackup(accountId, siteId, {
    source: backupSource,
    reason: options?.backupReason || "Before website builder save",
    pageName: options?.pageName || options?.loadPageName || "",
    siteOnly: options?.siteOnly === true,
    project: existingFullProject || project,
    metadata: {
      storageVersion: 2,
      hadExistingSite: !!existingSite,
    },
  });

  await ensureSiteFolders(dir);

  const site = buildSiteDocument({ ...(existingSite || {}), ...(project || {}), id: siteId }, accountId);
  const now = new Date().toISOString();
  site.updatedAt = now;

  if (options?.siteOnly) {
    const sitePath = path.join(dir, SITE_FILE);
    await writeJson(sitePath, site);
    const verifiedSite = await readJson(sitePath, null);
    if (!verifiedSite?.id || !jsonMatchesSaved(site.pages, verifiedSite.pages)) {
      throw new Error("Website save verification failed after writing site.json");
    }
    return loadSplitWebsiteProject(accountId, siteId, options?.loadPageName || site.pages[0]?.name);
  }

  const selectedPageName = pageNameFromValue(options?.pageName || "");
  const pagesToSave = selectedPageName
    ? site.pages.filter((page) => page.name === selectedPageName || page.slug === slugify(selectedPageName))
    : site.pages;

  if (selectedPageName && pagesToSave.length === 0) {
    throw new Error(`Cannot save website page "${selectedPageName}" because it is not in site.json`);
  }

  if (existingSite && selectedPageName) {
    const existingPages = normalizePages(existingSite);
    const existingPage = existingPages.find((page) => page.name === selectedPageName || page.slug === slugify(selectedPageName));
    if (existingPage) {
      const existingPageFile = path.join(dir, "pages", existingPage.file || pageFileName(existingPage));
      const incomingBlocks = Array.isArray(project?.pageBlocks?.[existingPage.name]) ? project.pageBlocks[existingPage.name] : null;
      if (!(await pathExists(existingPageFile)) && (!incomingBlocks || incomingBlocks.length === 0)) {
        throw new Error(`Cannot save "${existingPage.name}" because the split page file is missing and the incoming page has no blocks. Restore from backup instead.`);
      }
      const existingPageDoc = await readJson(existingPageFile, null);
      const deletedBlockIds = normalizeDeletedBlockTombstones(project);
      const existingBlocksAfterDeletes = filterDeletedBlocksForPage(existingPageDoc?.blocks, deletedBlockIds, existingPage.name);
      if (shouldPreserveExistingPageBlocks(existingBlocksAfterDeletes, incomingBlocks, backupSource)) {
        const existingChaiData = existingPageDoc?.chaiData && typeof existingPageDoc.chaiData === "object"
          ? {
              ...existingPageDoc.chaiData,
              ...(Array.isArray(existingPageDoc.chaiData.blocks)
                ? { blocks: filterDeletedBlocksForPage(existingPageDoc.chaiData.blocks, deletedBlockIds, existingPage.name) }
                : {}),
            }
          : null;
        project = {
          ...project,
          pageBlocks: {
            ...(project?.pageBlocks || {}),
            [existingPage.name]: existingBlocksAfterDeletes,
          },
          pagesContent: {
            ...(project?.pagesContent || {}),
            [existingPage.name]: existingPageDoc.html || "",
          },
          chaiData: existingChaiData
            ? {
                ...(project?.chaiData || {}),
                [existingPage.name]: existingChaiData,
              }
            : project?.chaiData,
        };
      }
    }
  }

  await writeJson(path.join(dir, SITE_FILE), site);
  for (const page of pagesToSave) {
    const pagePath = path.join(dir, "pages", page.file || pageFileName(page));
    const existingPageDoc = await readJson(pagePath, null);
    const pageDoc = buildPageDocument({ ...project, updatedAt: now }, page, existingPageDoc);
    await writeJson(pagePath, pageDoc);
    const verifiedPage = await readJson(pagePath, null);
    if (
      !verifiedPage?.name
      || !jsonMatchesSaved(pageDoc.blocks, verifiedPage.blocks)
      || !jsonMatchesSaved(pageDoc.chaiData, verifiedPage.chaiData)
      || String(pageDoc.html || "") !== String(verifiedPage.html || "")
    ) {
      throw new Error(`Website save verification failed after writing "${page.name}"`);
    }
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
  if (page && !pageDoc) {
    const error = new Error(`Website page file is missing for "${page.name}". Restore from a backup instead of generating a placeholder.`);
    error.code = "WEBSITE_PAGE_FILE_MISSING";
    error.pageName = page.name;
    error.siteId = siteId;
    throw error;
  }

  return hydrateProject({ ...site, pages }, pageDoc || null);
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
    await createWebsiteBuilderBackup(accountId, siteId, {
      source: "migration",
      reason: "Before migrating website project to split storage",
      pageName: options?.pageName || "",
      project: { ...project, id: siteId },
      metadata: { overwrite: options?.overwrite === true },
    });
    return saveSplitWebsiteProject(accountId, { ...project, id: siteId }, { loadPageName: options?.pageName || "", backupSource: "migration-write" });
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
