import assert from "node:assert/strict";
import fs from "node:fs";

import {
  PAGE_WIDTH_CONTAINED,
  PAGE_WIDTH_FULL,
  normalizePageLayoutProject,
  resolvePageWidthMode,
} from "../lib/website-builder/pageLayout.js";
import { createPublicationPayload } from "../lib/website-builder/publishConfig.js";

const staleContainedPagesProject = {
  id: "full-width-regression",
  name: "Full Width Regression",
  pageWidthMode: PAGE_WIDTH_FULL,
  globalPageWidthMode: PAGE_WIDTH_FULL,
  pages: [
    { id: "home", name: "Home", slug: "home", pageWidthMode: PAGE_WIDTH_CONTAINED },
    { id: "pricing", name: "Pricing", slug: "pricing", pageWidthMode: PAGE_WIDTH_CONTAINED },
    { id: "email", name: "Email", slug: "email", pageWidthMode: PAGE_WIDTH_CONTAINED },
  ],
  pageBlocks: {
    Home: [],
    Pricing: [{ id: "pricing-table", type: "pricing-table", props: { baseLayoutWidth: 1800 } }],
    Email: [{ id: "email-hero", type: "text", props: { baseLayoutWidth: 1800, fullWidthBackground: true } }],
  },
};

const normalizedFull = normalizePageLayoutProject(staleContainedPagesProject);
assert.equal(resolvePageWidthMode(normalizedFull, "Home"), PAGE_WIDTH_FULL, "global full width should apply to Home");
assert.equal(resolvePageWidthMode(normalizedFull, "Pricing"), PAGE_WIDTH_FULL, "global full width should apply to Pricing despite stale contained page value");
assert.equal(resolvePageWidthMode(normalizedFull, "Email"), PAGE_WIDTH_FULL, "global full width should apply to Email despite stale contained page value");
assert.deepEqual(normalizedFull.pages.map((page) => page.pageWidthMode), ["full", "full", "full"], "normalization should persist global full width to legacy page records");

const containedProject = normalizePageLayoutProject({
  ...staleContainedPagesProject,
  pageWidthMode: PAGE_WIDTH_CONTAINED,
  globalPageWidthMode: PAGE_WIDTH_CONTAINED,
});
assert.equal(resolvePageWidthMode(containedProject, "Pricing"), PAGE_WIDTH_CONTAINED, "contained mode should still resolve as contained");

const publication = createPublicationPayload(normalizedFull);
assert.equal(publication.site_data.pageWidthMode, PAGE_WIDTH_FULL, "publish payload must retain canonical global pageWidthMode");
assert.equal(publication.site_data.globalPageWidthMode, PAGE_WIDTH_FULL, "publish payload must retain canonical globalPageWidthMode");
assert.equal(publication.site_data.pages.find((page) => page.name === "Email")?.pageWidthMode, PAGE_WIDTH_FULL, "publish payload must retain Email full width");

const canvasSource = fs.readFileSync("components/website-builder/PageBuilderCanvas.js", "utf8");
assert.match(canvasSource, /resolvePageWidthMode\(project,\s*activePageEntry\?\.slug/, "builder canvas must resolve page width through project/global helper");
assert.match(canvasSource, /pageFullWidth=\{pageIsFullWidth\}/, "builder canvas must pass resolved full-width mode to block frames");

const previewSource = fs.readFileSync("components/website-builder/WebsitePreviewSurface.js", "utf8");
assert.match(previewSource, /resolvePageWidthMode\(project,\s*active\?\.slug/, "preview must resolve page width through project/global helper");
assert.match(previewSource, /layoutWidth:\s*pageFullWidth && previewViewport === "desktop" \? null : previewShellWidth/, "preview must not pass contained layoutWidth on desktop full-width pages");

const liveSource = fs.readFileSync("pages/sites/[...slug].js", "utf8");
assert.match(liveSource, /resolvePageWidthMode\(project,\s*activePage\?\.slug/, "live renderer must resolve page width through project/global helper");
assert.match(liveSource, /maxWidth:\s*pageFullWidth \? "none"/, "live page frame must remove max-width in full-width mode");
assert.match(liveSource, /layoutWidth:\s*pageFullWidth && !compact \? null : layoutWidth/, "live renderer must not pass contained layoutWidth on desktop full-width pages");

console.log("website builder full-width layout regression checks passed");
