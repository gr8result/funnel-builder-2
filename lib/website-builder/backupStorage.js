import fs from "node:fs/promises";
import path from "node:path";

const SITES_ROOT_DIR = process.env.WEBSITE_BUILDER_SITES_DIR || path.join(process.cwd(), "website-builder-sites");
const BACKUPS_ROOT_DIR = process.env.WEBSITE_BUILDER_BACKUPS_DIR || path.join(process.cwd(), "website-builder-backups");

function safeSegment(value, fallback = "item") {
  const cleaned = String(value || "")
    .trim()
    .replace(/^draft:/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

function safeTimestamp(value = new Date()) {
  return new Date(value).toISOString().replace(/[:.]/g, "-");
}

function slugify(value, fallback = "page") {
  const cleaned = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

function normalizeSource(value) {
  return safeSegment(String(value || "save").toLowerCase(), "save");
}

function siteDir(accountId, projectId) {
  return path.join(SITES_ROOT_DIR, safeSegment(accountId, "account"), safeSegment(projectId, "site"));
}

function backupRoot(accountId, projectId) {
  return path.join(BACKUPS_ROOT_DIR, safeSegment(accountId, "account"), safeSegment(projectId, "site"));
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
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
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function copyIfExists(fromPath, toPath) {
  if (!(await pathExists(fromPath))) return false;
  await fs.mkdir(path.dirname(toPath), { recursive: true });
  await fs.copyFile(fromPath, toPath);
  return true;
}

async function copyDirectoryIfExists(fromDir, toDir) {
  if (!(await pathExists(fromDir))) return false;
  await fs.cp(fromDir, toDir, { recursive: true, force: true });
  return true;
}

function buildFallbackFullProject(project, accountId, projectId) {
  if (!project || typeof project !== "object") return null;
  return {
    ...project,
    id: String(project?.id || projectId || "").trim().replace(/^draft:/, ""),
    accountId: String(accountId || project?.accountId || project?.userId || project?.user_id || ""),
  };
}

function normalizeProjectPages(project) {
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
      file: `${slug}.json`,
      order: Number.isFinite(Number(page?.order)) ? Number(page.order) : index,
    };
  });
}

function buildFallbackSiteDocument(project, accountId, projectId) {
  const pages = normalizeProjectPages(project);
  const { pageBlocks: _pageBlocks, pagesContent: _pagesContent, chaiData: _chaiData, brandAssets: _brandAssets, ...site } = project || {};
  return {
    ...site,
    id: String(project?.id || projectId || "").trim().replace(/^draft:/, ""),
    accountId: String(accountId || project?.accountId || project?.userId || project?.user_id || ""),
    name: project?.name || "Untitled Website",
    pages,
    pageOrder: pages.map((page) => page.id || page.slug || page.name),
    pageSlugs: Object.fromEntries(pages.map((page) => [page.name, page.slug])),
    globalNavBlock: project?.globalNavBlock || null,
    globalFooterBlock: project?.globalFooterBlock || null,
    publication: project?.publication || null,
    updatedAt: project?.updatedAt || new Date().toISOString(),
    storageVersion: 2,
  };
}

async function writeFallbackSplitSnapshot(targetDir, project, accountId, projectId) {
  if (!project || typeof project !== "object") return false;
  const site = buildFallbackSiteDocument(project, accountId, projectId);
  await writeJson(path.join(targetDir, "site.json"), site);
  for (const page of site.pages) {
    const blocks = Array.isArray(project?.pageBlocks?.[page.name])
      ? project.pageBlocks[page.name]
      : Array.isArray(project?.chaiData?.[page.name]?.blocks)
        ? project.chaiData[page.name].blocks
        : [];
    await writeJson(path.join(targetDir, "pages", page.file || `${page.slug}.json`), {
      id: page.id,
      name: page.name,
      slug: page.slug,
      seo: page.seo || page.seoSettings || {},
      sections: Array.isArray(page.sections) ? page.sections : [],
      widgets: Array.isArray(page.widgets) ? page.widgets : [],
      styles: page.styles || page.pageStyles || {},
      assets: page.assets || page.assetRefs || [],
      objective: page.objective || "",
      blocks,
      chaiData: project?.chaiData?.[page.name] || null,
      html: project?.pagesContent?.[page.name] || "",
      updatedAt: project?.updatedAt || new Date().toISOString(),
    });
  }
  return true;
}

export async function createWebsiteBuilderBackup(accountId, projectId, options = {}) {
  const safeAccountId = safeSegment(accountId, "account");
  const safeProjectId = safeSegment(projectId || options?.project?.id, "site");
  if (!safeAccountId || !safeProjectId) {
    throw new Error("accountId and projectId are required to create a website backup");
  }

  const timestamp = new Date().toISOString();
  const source = normalizeSource(options?.source);
  const snapshotName = `${safeTimestamp(timestamp)}-${source}`;
  const targetDir = path.join(backupRoot(safeAccountId, safeProjectId), snapshotName);
  const activeDir = siteDir(safeAccountId, safeProjectId);

  await fs.mkdir(targetDir, { recursive: true });

  const copiedActiveProject = await copyDirectoryIfExists(path.join(activeDir, "pages"), path.join(targetDir, "pages"));
  await copyDirectoryIfExists(path.join(activeDir, "assets"), path.join(targetDir, "assets"));
  await copyDirectoryIfExists(path.join(activeDir, "templates"), path.join(targetDir, "templates"));
  await copyIfExists(path.join(activeDir, "site.json"), path.join(targetDir, "site.json"));

  const fullProjectFromDisk = await readJson(path.join(activeDir, "full-project.json"), null);
  const fallbackProject = buildFallbackFullProject(options?.project, safeAccountId, safeProjectId);
  const fullProject = fullProjectFromDisk || fallbackProject || null;
  if (fullProject) {
    await writeJson(path.join(targetDir, "full-project.json"), fullProject);
  }
  const wroteFallbackSplit = copiedActiveProject ? false : await writeFallbackSplitSnapshot(targetDir, fallbackProject, safeAccountId, safeProjectId);

  const metadata = {
    timestamp,
    accountId: safeAccountId,
    projectId: safeProjectId,
    source,
    reason: options?.reason || "",
    pageName: options?.pageName || "",
    siteOnly: options?.siteOnly === true,
    copiedActiveProject,
    wroteFallbackSplit,
    includes: {
      siteJson: await pathExists(path.join(targetDir, "site.json")),
      pages: await pathExists(path.join(targetDir, "pages")),
      assets: await pathExists(path.join(targetDir, "assets")),
      templates: await pathExists(path.join(targetDir, "templates")),
      fullProject: !!fullProject,
    },
    extra: options?.metadata || {},
  };
  await writeJson(path.join(targetDir, "metadata.json"), metadata);

  return {
    id: snapshotName,
    path: targetDir,
    metadata,
  };
}

export async function listWebsiteBuilderBackups(accountId, projectId) {
  const root = backupRoot(accountId, projectId);
  let entries = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const backups = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    const metadata = await readJson(path.join(dir, "metadata.json"), {});
    backups.push({
      id: entry.name,
      path: dir,
      metadata,
      timestamp: metadata?.timestamp || entry.name,
      source: metadata?.source || "",
    });
  }

  return backups.sort((left, right) => {
    const l = Date.parse(left?.timestamp || 0) || 0;
    const r = Date.parse(right?.timestamp || 0) || 0;
    return r - l;
  });
}

export async function restoreWebsiteBuilderBackup(accountId, projectId, backupId, options = {}) {
  const safeAccountId = safeSegment(accountId, "account");
  const safeProjectId = safeSegment(projectId, "site");
  const safeBackupId = safeSegment(backupId, "backup");
  const sourceDir = path.join(backupRoot(safeAccountId, safeProjectId), safeBackupId);
  if (!(await pathExists(sourceDir))) {
    throw new Error("Website backup was not found");
  }

  const activeDir = siteDir(safeAccountId, safeProjectId);
  await createWebsiteBuilderBackup(safeAccountId, safeProjectId, {
    source: "pre-restore",
    reason: `Before restoring backup ${safeBackupId}`,
  });

  await fs.mkdir(activeDir, { recursive: true });
  await copyIfExists(path.join(sourceDir, "site.json"), path.join(activeDir, "site.json"));
  if (await pathExists(path.join(sourceDir, "pages"))) {
    await fs.rm(path.join(activeDir, "pages"), { recursive: true, force: true });
    await fs.cp(path.join(sourceDir, "pages"), path.join(activeDir, "pages"), { recursive: true, force: true });
  }
  if (await pathExists(path.join(sourceDir, "assets"))) {
    await fs.rm(path.join(activeDir, "assets"), { recursive: true, force: true });
    await fs.cp(path.join(sourceDir, "assets"), path.join(activeDir, "assets"), { recursive: true, force: true });
  }
  if (await pathExists(path.join(sourceDir, "templates"))) {
    await fs.rm(path.join(activeDir, "templates"), { recursive: true, force: true });
    await fs.cp(path.join(sourceDir, "templates"), path.join(activeDir, "templates"), { recursive: true, force: true });
  }

  if (options?.writeRestoreMarker !== false) {
    await writeJson(path.join(activeDir, "restore-metadata.json"), {
      restoredAt: new Date().toISOString(),
      accountId: safeAccountId,
      projectId: safeProjectId,
      backupId: safeBackupId,
    });
  }

  return { ok: true, backupId: safeBackupId };
}
