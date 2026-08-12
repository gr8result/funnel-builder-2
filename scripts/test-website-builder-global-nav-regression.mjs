import assert from "node:assert/strict";
import { normalizeSharedPrimaryNavigation } from "../lib/website-builder/sharedNavigation.js";
import { stableWebsiteJson } from "../lib/website-builder/documentVersion.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function navSnapshot(project) {
  return (project?.globalNavBlock?.props?.links || []).map((link) => ({
    label: link?.label || "",
    href: link?.href || "",
    pageId: link?.pageId || "",
  }));
}

const basePages = [
  { id: "home", name: "Home", slug: "home", order: 0 },
  { id: "modules", name: "Modules", slug: "modules", order: 1 },
  { id: "about-us", name: "About Us", slug: "about-us", order: 2 },
  { id: "pricing", name: "Pricing", slug: "pricing", order: 3 },
  { id: "contact-us", name: "Contact Us", slug: "contact-us", order: 4 },
];

const manualLinks = [
  { id: "link-home", label: "Home", href: "/", linkType: "page", pageId: "home" },
  { id: "link-modules", label: "Modules", href: "/modules", linkType: "page", pageId: "modules" },
  { id: "link-about", label: "About", href: "/about-us", linkType: "page", pageId: "about-us" },
  { id: "link-pricing", label: "Plans", href: "/pricing", linkType: "page", pageId: "pricing" },
  { id: "link-contact", label: "Talk To Us", href: "/contact", linkType: "page", pageId: "contact-us" },
];

const project = {
  id: "project-nav-regression",
  name: "Navigation Regression",
  pages: clone(basePages),
  pageBlocks: {
    Home: [
      {
        id: "page-home-nav",
        type: "nav-bar",
        props: {
          links: [
            { label: "Injected", href: "/injected" },
            { label: "Home", href: "/" },
          ],
        },
      },
      { id: "home-hero", type: "hero", props: { headline: "Home" } },
    ],
    Modules: [
      {
        id: "page-modules-nav",
        type: "nav-bar",
        props: {
          links: [
            { label: "Wrong Order", href: "/pricing" },
            { label: "Modules", href: "/modules" },
          ],
        },
      },
      { id: "modules-hero", type: "hero", props: { headline: "Modules" } },
    ],
  },
  globalNavBlock: {
    id: "global-nav",
    type: "nav-bar",
    props: {
      links: clone(manualLinks),
      navigationLinks: clone(manualLinks),
      navigationManual: true,
      syncPagesToNavigation: false,
      stickyMode: "sticky",
    },
  },
};

const normalized = normalizeSharedPrimaryNavigation(clone(project));
assert.deepEqual(
  navSnapshot(normalized),
  manualLinks.map((link) => ({ label: link.label, href: link.href, pageId: link.pageId })),
  "Manual global navigation links and order must remain unchanged",
);
assert.equal(
  normalized?.globalNavBlock?.props?.syncPagesToNavigation,
  false,
  "Global navigation must not auto-sync from pages once canonical nav exists",
);

assert.equal(
  Array.isArray(normalized?.pageBlocks?.Home) && normalized.pageBlocks.Home.some((block) => block?.type === "nav-bar"),
  false,
  "Page-level navigation blocks must be stripped so global nav is canonical",
);

const withNewPage = {
  ...clone(normalized),
  pages: [...clone(normalized.pages || []), { id: "services", name: "Services", slug: "services", order: 5 }],
};
const normalizedWithNewPage = normalizeSharedPrimaryNavigation(withNewPage);
assert.deepEqual(
  navSnapshot(normalizedWithNewPage),
  manualLinks.map((link) => ({ label: link.label, href: link.href, pageId: link.pageId })),
  "Adding a page must not auto-insert it into manual global navigation",
);

const reloaded = normalizeSharedPrimaryNavigation(clone(normalizedWithNewPage));
assert.deepEqual(
  navSnapshot(reloaded),
  manualLinks.map((link) => ({ label: link.label, href: link.href, pageId: link.pageId })),
  "Reload normalization must not reorder or rebuild manual global navigation",
);
assert.equal(
  reloaded?.globalNavBlock?.props?.syncPagesToNavigation,
  false,
  "Reloaded canonical nav must keep page-sync disabled",
);

const aboutEditorBlocks = [
  {
    id: "about-page-nav",
    type: "nav-bar",
    props: {
      brand: "Navigation Regression",
      links: [{ label: "About Us", href: "/about-us", pageId: "about-us" }],
      navigationManual: true,
    },
  },
  { id: "about-hero", type: "hero", props: { headline: "About Us" } },
  { id: "about-text-1", type: "text", props: { text: "About the platform" } },
  { id: "about-space", type: "space", props: { height: "42px" } },
  { id: "about-text-2", type: "text", props: { text: "More detail" } },
  { id: "about-split", type: "split-block", props: { headline: "Why choose us" } },
  { id: "about-gallery", type: "image-gallery", props: { title: "Behind the brand" } },
  { id: "about-cta", type: "cta-button", props: { text: "Start trial" } },
];
const aboutSubmittedProject = {
  ...clone(normalized),
  pageBlocks: {
    ...(normalized.pageBlocks || {}),
    "About Us": clone(aboutEditorBlocks),
  },
  chaiData: {
    ...(normalized.chaiData || {}),
    "About Us": { blocks: clone(aboutEditorBlocks) },
  },
};
const aboutSubmittedCanonical = normalizeSharedPrimaryNavigation(clone(aboutSubmittedProject));
const aboutPersistentBlocks = aboutSubmittedCanonical.pageBlocks["About Us"];
assert.equal(aboutEditorBlocks.length, 8, "About Us editor state should contain 8 blocks in this regression");
assert.equal(aboutPersistentBlocks.length, 7, "Canonical page persistence should strip the page nav from About Us blocks");
assert.deepEqual(
  aboutPersistentBlocks.map((block) => block.id),
  ["about-hero", "about-text-1", "about-space", "about-text-2", "about-split", "about-gallery", "about-cta"],
  "Canonical About Us page block IDs/order must survive after nav normalization",
);
assert.deepEqual(
  aboutPersistentBlocks.map((block) => block.type),
  ["hero", "text", "space", "text", "split-block", "image-gallery", "cta-button"],
  "Canonical About Us page block types/order must survive after nav normalization",
);
assert.equal(
  stableWebsiteJson(aboutPersistentBlocks),
  stableWebsiteJson(clone(aboutPersistentBlocks)),
  "Canonical submitted About Us blocks must compare structurally after JSON readback",
);
const aboutReadbackWithLostBlock = clone(aboutSubmittedCanonical);
aboutReadbackWithLostBlock.pageBlocks["About Us"] = aboutReadbackWithLostBlock.pageBlocks["About Us"].slice(0, -1);
assert.notEqual(
  stableWebsiteJson(aboutSubmittedCanonical.pageBlocks["About Us"]),
  stableWebsiteJson(aboutReadbackWithLostBlock.pageBlocks["About Us"]),
  "Normal page save verification must still fail when a submitted persistent block is missing",
);

console.log("website builder global nav regression checks passed");
