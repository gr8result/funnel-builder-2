import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeSharedPrimaryNavigation } from "../lib/website-builder/sharedNavigation.js";

const ACCOUNT_ID = "35ab846e-0764-498b-b1f8-7d2cf27d85a5";
const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const siteDir = path.join(process.cwd(), "website-builder-sites", ACCOUNT_ID, PROJECT_ID);
const pagesDir = path.join(siteDir, "pages");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function collectPageLinks(items = [], output = []) {
  for (const item of Array.isArray(items) ? items : []) {
    if (item?.pageId || item?.slug || item?.href) {
      output.push({
        pageId: String(item.pageId || "").trim(),
        slug: String(item.slug || "").trim(),
        href: String(item.href || "").trim(),
        label: String(item.label || "").trim(),
      });
    }
    collectPageLinks(item?.children || [], output);
  }
  return output;
}

function navBlocks(blocks = []) {
  return (Array.isArray(blocks) ? blocks : []).filter((block) => {
    const type = String(block?.type || "");
    return (type === "nav-bar" || type === "navigation-bar") && block?.props?.detachedFromSharedNavigation !== true;
  });
}

const site = readJson(path.join(siteDir, "site.json"));
const fullProject = readJson(path.join(siteDir, "full-project.json"));
const project = normalizeSharedPrimaryNavigation({
  ...site,
  pageBlocks: fullProject.pageBlocks || {},
  chaiData: fullProject.chaiData || {},
});

const globalHeader = project.globalNavBlock;
assert.ok(globalHeader, "project should have one global navigation block");
assert.equal(globalHeader.id, `shared-primary-navigation-${PROJECT_ID}`, "global header should use stable shared component id");
assert.equal(globalHeader.props?.sticky, true, "global header sticky flag should be true");
assert.notEqual(globalHeader.props?.stickyMode, "normal", "global header sticky mode should be enabled");
assert.equal(globalHeader.props?.role, "primary-navigation", "global header should be marked as primary navigation");
assert.ok(globalHeader.props?.globalHeaderRevision, "global header should carry a revision");

const menuRefs = collectPageLinks(globalHeader.props?.links || []);
const visiblePages = (Array.isArray(site.pages) ? site.pages : []).filter((page) => page.showInNavigation !== false && page.hidden !== true && page.navHidden !== true);
for (const page of visiblePages) {
  const slug = String(page.slug || page.name || page.id || "").toLowerCase();
  const pageId = String(page.id || slug).toLowerCase();
  const href = slug === "home" ? "/" : `/${slug}`;
  const found = menuRefs.some((item) => (
    item.pageId.toLowerCase() === pageId
    || item.slug.toLowerCase() === slug
    || item.href.toLowerCase() === href
  ));
  assert.ok(found, `global navigation should include page ${page.name}`);
}

for (const page of visiblePages) {
  assert.equal(page.useGlobalHeader, true, `${page.name} should be marked useGlobalHeader`);
}

for (const file of fs.readdirSync(pagesDir).filter((name) => name.endsWith(".json"))) {
  const pageDoc = readJson(path.join(pagesDir, file));
  assert.equal(pageDoc.useGlobalHeader, true, `${file} should use the global header`);
  assert.equal(navBlocks(pageDoc.blocks).length, 0, `${file} should not contain page-level primary nav blocks`);
  if (pageDoc.chaiData?.blocks) {
    assert.equal(navBlocks(pageDoc.chaiData.blocks).length, 0, `${file} chaiData should not contain page-level primary nav blocks`);
  }
}

for (const [pageName, blocks] of Object.entries(fullProject.pageBlocks || {})) {
  assert.equal(navBlocks(blocks).length, 0, `${pageName} fullProject pageBlocks should not contain page-level primary nav blocks`);
}

console.log("GR8 global navigation regression passed.");
