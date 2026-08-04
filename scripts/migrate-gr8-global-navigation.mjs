import fs from "node:fs";
import path from "node:path";
import { normalizeSharedPrimaryNavigation } from "../lib/website-builder/sharedNavigation.js";

const ACCOUNT_ID = "35ab846e-0764-498b-b1f8-7d2cf27d85a5";
const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const root = process.cwd();
const siteDir = path.join(root, "website-builder-sites", ACCOUNT_ID, PROJECT_ID);
const pagesDir = path.join(siteDir, "pages");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_global-navigation-backups") continue;
      copyDir(sourcePath, targetPath);
      continue;
    }
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function stripPrimaryNav(blocks = []) {
  return (Array.isArray(blocks) ? blocks : []).filter((block) => {
    const type = String(block?.type || "");
    if (type !== "nav-bar" && type !== "navigation-bar") return true;
    return block?.props?.detachedFromSharedNavigation === true;
  });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(siteDir, "_global-navigation-backups", timestamp);
copyDir(siteDir, backupDir);

const sitePath = path.join(siteDir, "site.json");
const fullPath = path.join(siteDir, "full-project.json");
const site = readJson(sitePath);
const fullProject = fs.existsSync(fullPath) ? readJson(fullPath) : null;

const sourceProject = normalizeSharedPrimaryNavigation({
  ...(site || {}),
  ...(fullProject || {}),
  id: PROJECT_ID,
  pages: Array.isArray(site.pages) ? site.pages : fullProject?.pages || [],
  globalNavBlock: fullProject?.globalNavBlock || site.globalNavBlock || null,
  pageBlocks: fullProject?.pageBlocks || {},
  chaiData: fullProject?.chaiData || {},
});

const globalNavBlock = sourceProject.globalNavBlock;
if (!globalNavBlock) {
  throw new Error("Could not find a navigation block to promote to global header.");
}

const nextSite = normalizeSharedPrimaryNavigation({
  ...site,
  id: PROJECT_ID,
  pages: (Array.isArray(site.pages) ? site.pages : []).map((page) => ({
    ...page,
    useGlobalHeader: true,
    headerOverrideBlockId: "",
  })),
  globalNavBlock,
  globalHeader: sourceProject.globalHeader || null,
});
writeJson(sitePath, nextSite);

if (fullProject) {
  const nextPageBlocks = Object.fromEntries(
    Object.entries(fullProject.pageBlocks || {}).map(([pageName, blocks]) => [pageName, stripPrimaryNav(blocks)])
  );
  const nextChaiData = Object.fromEntries(
    Object.entries(fullProject.chaiData || {}).map(([pageName, pageData]) => [
      pageName,
      pageData && typeof pageData === "object" && Array.isArray(pageData.blocks)
        ? { ...pageData, blocks: stripPrimaryNav(pageData.blocks) }
        : pageData,
    ])
  );
  writeJson(fullPath, normalizeSharedPrimaryNavigation({
    ...fullProject,
    id: PROJECT_ID,
    pages: (Array.isArray(fullProject.pages) ? fullProject.pages : nextSite.pages).map((page) => ({
      ...page,
      useGlobalHeader: true,
      headerOverrideBlockId: "",
    })),
    globalNavBlock,
    globalHeader: sourceProject.globalHeader || null,
    pageBlocks: nextPageBlocks,
    chaiData: nextChaiData,
  }));
}

const migratedPages = [];
for (const file of fs.readdirSync(pagesDir).filter((name) => name.endsWith(".json"))) {
  const pagePath = path.join(pagesDir, file);
  const pageDoc = readJson(pagePath);
  const beforeBlocks = Array.isArray(pageDoc.blocks) ? pageDoc.blocks : [];
  const afterBlocks = stripPrimaryNav(beforeBlocks);
  const nextChaiData = pageDoc.chaiData && typeof pageDoc.chaiData === "object" && Array.isArray(pageDoc.chaiData.blocks)
    ? { ...pageDoc.chaiData, blocks: stripPrimaryNav(pageDoc.chaiData.blocks) }
    : pageDoc.chaiData;
  writeJson(pagePath, {
    ...pageDoc,
    useGlobalHeader: true,
    headerOverrideBlockId: "",
    blocks: afterBlocks,
    ...(nextChaiData ? { chaiData: nextChaiData } : {}),
  });
  migratedPages.push({
    file,
    name: pageDoc.name || pageDoc.title || file,
    slug: pageDoc.slug || file.replace(/\.json$/, ""),
    removedNavBlocks: beforeBlocks.length - afterBlocks.length,
    bodyBlocksPreserved: afterBlocks.length,
  });
}

console.log(JSON.stringify({
  ok: true,
  backupDir,
  globalHeaderId: globalNavBlock.id,
  stickyMode: globalNavBlock.props?.stickyMode || "",
  linkLabels: (globalNavBlock.props?.links || []).map((link) => link.label),
  migratedPages,
}, null, 2));
