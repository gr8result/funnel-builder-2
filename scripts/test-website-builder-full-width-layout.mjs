import assert from "node:assert/strict";
import fs from "node:fs";

import {
  PAGE_WIDTH_CONTAINED,
  PAGE_WIDTH_FULL,
  normalizePageLayoutProject,
  resolvePageWidthMode,
} from "../lib/website-builder/pageLayout.js";
import { createPublicationPayload } from "../lib/website-builder/publishConfig.js";

const allPublishedRoutes = [
  ["Home", "home"],
  ["About Us", "about-us"],
  ["Modules", "modules"],
  ["Contact Us", "contact-us"],
  ["Email", "email"],
  ["Pricing", "pricing"],
  ["CRM", "crm"],
  ["SMS", "sms"],
  ["Funnels", "funnels"],
  ["Website Builder", "website-builder"],
  ["Social Media", "social-media"],
  ["Project Hub", "project-hub"],
];

const staleContainedPagesProject = {
  id: "full-width-regression",
  name: "Full Width Regression",
  pageWidthMode: PAGE_WIDTH_FULL,
  globalPageWidthMode: PAGE_WIDTH_FULL,
  containedWidth: 1500,
  pages: allPublishedRoutes.map(([name, slug]) => ({ id: slug, name, slug, pageWidthMode: PAGE_WIDTH_CONTAINED })),
  pageBlocks: {
    Home: [],
    Pricing: [{ id: "pricing-table", type: "pricing-table", props: { baseLayoutWidth: 1800 } }],
    Email: [{ id: "email-hero", type: "text", props: { baseLayoutWidth: 1800, fullWidthBackground: true } }],
  },
};

const normalizedFull = normalizePageLayoutProject(staleContainedPagesProject);
for (const [pageName, slug] of allPublishedRoutes) {
  assert.equal(resolvePageWidthMode(normalizedFull, pageName), PAGE_WIDTH_FULL, `global full width should apply to ${pageName}`);
  assert.equal(resolvePageWidthMode(normalizedFull, slug), PAGE_WIDTH_FULL, `global full width should apply to /${slug}`);
}
assert.deepEqual(normalizedFull.pages.map((page) => page.pageWidthMode), allPublishedRoutes.map(() => undefined), "normalization should not persist inherited global width to page records");

const containedProject = normalizePageLayoutProject({
  ...staleContainedPagesProject,
  pageWidthMode: PAGE_WIDTH_CONTAINED,
  globalPageWidthMode: PAGE_WIDTH_CONTAINED,
});
assert.equal(resolvePageWidthMode(containedProject, "Pricing"), PAGE_WIDTH_CONTAINED, "contained mode should still resolve as contained");
assert.equal(containedProject.containedWidth, 1500, "containedWidth should be retained for deliberate contained mode");

const publication = createPublicationPayload(normalizedFull);
assert.equal(publication.site_data.pageWidthMode, PAGE_WIDTH_FULL, "publish payload must retain canonical global pageWidthMode");
assert.equal(publication.site_data.globalPageWidthMode, PAGE_WIDTH_FULL, "publish payload must retain canonical globalPageWidthMode");
assert.equal(publication.site_data.containedWidth, 1500, "full mode may retain containedWidth data but must not resolve to contained");
assert.equal(publication.site_data.pages.find((page) => page.name === "Email")?.pageWidthMode, PAGE_WIDTH_FULL, "publish payload must carry resolved page width for live compatibility");
for (const [pageName, slug] of allPublishedRoutes) {
  assert.equal(publication.site_data.pages.find((page) => page.slug === slug)?.pageWidthMode, PAGE_WIDTH_FULL, `published page record should carry full width for ${pageName}`);
  assert.equal(resolvePageWidthMode(publication.site_data, slug), PAGE_WIDTH_FULL, `published live data should resolve full width for ${pageName}`);
}

const explicitContainedOverride = normalizePageLayoutProject({
  ...staleContainedPagesProject,
  pageWidthMode: PAGE_WIDTH_FULL,
  globalPageWidthMode: PAGE_WIDTH_FULL,
  pages: [
    { id: "home", name: "Home", slug: "home" },
    { id: "pricing", name: "Pricing", slug: "pricing", pageWidthMode: PAGE_WIDTH_CONTAINED, pageWidthOverride: true },
  ],
});
assert.equal(resolvePageWidthMode(explicitContainedOverride, "Home"), PAGE_WIDTH_FULL, "non-overridden pages inherit full width");
assert.equal(resolvePageWidthMode(explicitContainedOverride, "Pricing"), PAGE_WIDTH_CONTAINED, "explicit contained override should still work");
assert.equal(explicitContainedOverride.pages.find((page) => page.name === "Pricing")?.pageWidthMode, PAGE_WIDTH_CONTAINED, "explicit page width override should be retained");

const canvasSource = fs.readFileSync("components/website-builder/PageBuilderCanvas.js", "utf8");
assert.match(canvasSource, /resolvePageWidthMode\(project,\s*activePageEntry\?\.slug/, "builder canvas must resolve page width through project/global helper");
assert.match(canvasSource, /pageFullWidth=\{pageIsFullWidth\}/, "builder canvas must pass resolved full-width mode to block frames");
assert.match(canvasSource, /onUpdatePageSettings\?\.\(\{\s*pageWidthMode:\s*normalizePageWidthMode\(patch\.pageWidthMode\)\s*\}\)/, "global style page width control should send a site-level pageWidthMode patch");

const visualBuilderSource = fs.readFileSync("pages/modules/website-builder/visual-builder.js", "utf8");
assert.match(visualBuilderSource, /const \{\s*pageWidthMode:\s*_pageWidthMode,\s*globalPageWidthMode:\s*_globalPageWidthMode,\s*\.\.\.pagePatch\s*\} = patch \|\| \{\};/, "global width patch should be separated from active page settings");
assert.match(visualBuilderSource, /\.\.\.\(hasPagePatch \? \{ pages \} : \{\}\)/, "global width-only saves must not rewrite pages");
assert.match(visualBuilderSource, /hasGlobalPageWidthMode\(localProject\)[\s\S]*globalPageWidthMode:\s*resolveGlobalPageWidthMode\(localProject\)/, "page-switch merge must preserve local canonical global width");
assert.match(visualBuilderSource, /currentGlobalPageWidthMode[\s\S]*pageWidthMode:\s*currentGlobalPageWidthMode,\s*globalPageWidthMode:\s*currentGlobalPageWidthMode/, "local repair merge must preserve current canonical global width");

const previewSource = fs.readFileSync("components/website-builder/WebsitePreviewSurface.js", "utf8");
assert.match(previewSource, /resolvePageWidthMode\(project,\s*active\?\.slug/, "preview must resolve page width through project/global helper");
assert.match(previewSource, /layoutWidth:\s*pageFullWidth && previewViewport === "desktop" \? null : previewShellWidth/, "preview must not pass contained layoutWidth on desktop full-width pages");

const liveSource = fs.readFileSync("pages/sites/[...slug].js", "utf8");
assert.match(liveSource, /resolvePageWidthMode\(project,\s*activePage\?\.slug/, "live renderer must resolve page width through project/global helper");
assert.match(liveSource, /maxWidth:\s*pageFullWidth \? "none"/, "live page frame must remove max-width in full-width mode");
assert.match(liveSource, /marginLeft:\s*pageFullWidth \? 0 : "auto"/, "live page frame must not center full-width blocks with auto left margin");
assert.match(liveSource, /marginRight:\s*pageFullWidth \? 0 : "auto"/, "live page frame must not center full-width blocks with auto right margin");
assert.match(liveSource, /layoutWidth:\s*pageFullWidth && !compact \? null : layoutWidth/, "live renderer must not pass contained layoutWidth on desktop full-width pages");

const publishSource = fs.readFileSync("lib/website-builder/publishConfig.js", "utf8");
assert.match(publishSource, /const globalPageWidthMode = resolveGlobalPageWidthMode\(project\);/, "publish payload must use the canonical global width resolver");
assert.match(publishSource, /pageWidthMode:\s*resolvePageWidthMode\(project,/, "published page records must carry the resolved page width mode");
assert.match(publishSource, /pageWidthMode:\s*globalPageWidthMode,\s*[\r\n]\s*globalPageWidthMode,/, "publish payload must serialize one canonical global width mode");

const publishApiSource = fs.readFileSync("pages/api/websites/publish.js", "utf8");
assert.match(publishApiSource, /const globalPageWidthMode = resolveGlobalPageWidthMode\(project\);/, "publish API must use the canonical global width resolver");
assert.match(publishApiSource, /pageWidthMode:\s*resolvePageWidthMode\(project,/, "publish API page records must carry resolved page width for deployed live compatibility");
assert.match(publishApiSource, /pages,\s*[\r\n]\s*slug,/, "publish API must write resolved page records into final site_data");
assert.match(publishApiSource, /pageWidthMode:\s*globalPageWidthMode,\s*[\r\n]\s*globalPageWidthMode,/, "publish API must serialize one canonical global width mode");

console.log("website builder full-width layout regression checks passed");
