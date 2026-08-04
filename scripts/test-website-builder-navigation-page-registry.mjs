import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeSharedPrimaryNavigation } from "../lib/website-builder/sharedNavigation.js";

const projectPath = path.join(
  process.cwd(),
  "website-builder-sites",
  "35ab846e-0764-498b-b1f8-7d2cf27d85a5",
  "2208a52a-8175-477e-823c-fc6de7fe4afe",
  "full-project.json"
);

const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
const pages = Array.isArray(project.pages) ? project.pages : [];
const socialPage = pages.find((page) => page.slug === "social-media" || page.name === "Social Media");

assert.ok(socialPage, "Social Media page must exist in the authoritative page registry");

const projectWithMissingSocialNav = {
  ...project,
  globalNavBlock: {
    ...project.globalNavBlock,
    props: {
      ...(project.globalNavBlock?.props || {}),
      links: (project.globalNavBlock?.props?.links || []).filter((link) => (
        link?.slug !== "social-media" && link?.pageId !== "social-media" && link?.href !== "/social-media"
      )),
    },
  },
};

const normalized = normalizeSharedPrimaryNavigation(projectWithMissingSocialNav);
const links = normalized.globalNavBlock?.props?.links || [];
const socialLinks = links.filter((link) => link.slug === "social-media" || link.pageId === "social-media" || link.href === "/social-media");

assert.equal(socialLinks.length, 1, "Social Media should be restored exactly once");
assert.equal(socialLinks[0].label, "Social Media");
assert.equal(socialLinks[0].href, "/social-media");
assert.equal(socialLinks[0].pageId, "social-media");
assert.equal(socialLinks[0].linkType, "page");

const hiddenProject = {
  ...project,
  pages: pages.map((page) => page === socialPage ? { ...page, showInNavigation: false } : page),
  globalNavBlock: {
    ...project.globalNavBlock,
    props: {
      ...(project.globalNavBlock?.props || {}),
      links: (project.globalNavBlock?.props?.links || []).filter((link) => (
        link?.slug !== "social-media" && link?.pageId !== "social-media" && link?.href !== "/social-media"
      )),
    },
  },
};

const hiddenNormalized = normalizeSharedPrimaryNavigation(hiddenProject);
const hiddenLinks = hiddenNormalized.globalNavBlock?.props?.links || [];

assert.equal(
  hiddenLinks.some((link) => link.slug === "social-media" || link.pageId === "social-media" || link.href === "/social-media"),
  false,
  "Pages explicitly hidden from navigation should not be re-added"
);

console.log("Website builder page registry/navigation regression passed.");
