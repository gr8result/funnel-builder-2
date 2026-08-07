import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizePageWidthMode, resolvePageWidthMode } from "../lib/website-builder/pageLayout.js";

assert.equal(normalizePageWidthMode(), "contained");
assert.equal(normalizePageWidthMode("contained"), "contained");
assert.equal(normalizePageWidthMode("full"), "full");
assert.equal(normalizePageWidthMode("wide"), "contained");

const project = {
  id: "project-hub",
  name: "Project Hub",
  pages: [
    { id: "home", name: "Home", slug: "home" },
    { id: "hub", name: "Project Hub", slug: "project-hub", pageWidthMode: "full" },
  ],
  pageBlocks: {
    "Project Hub": [
      { id: "stack", type: "image-stack", props: { baseLayoutWidth: 1820, fullWidth: true } },
      { id: "text", type: "text", props: { baseLayoutWidth: 1820, text: "Project Hub" } },
    ],
  },
};

assert.equal(resolvePageWidthMode(project, "Project Hub"), "full");
assert.equal(resolvePageWidthMode(project, "Home"), "contained");

const panelSource = fs.readFileSync("components/website-builder/page-builder/pbPropertiesPanels.js", "utf8");
assert.match(panelSource, /Page Settings/);
assert.match(panelSource, /Page Width/);
assert.match(panelSource, /onApplyGlobal\(\{ pageWidthMode: e\.target\.value \}\)/);

const canvasSource = fs.readFileSync("components/website-builder/PageBuilderCanvas.js", "utf8");
assert.match(canvasSource, /onUpdatePageSettings/);
assert.match(canvasSource, /pageFullWidth=\{pageIsFullWidth\}/);

const previewSource = fs.readFileSync("components/website-builder/WebsitePreviewSurface.js", "utf8");
assert.match(previewSource, /data-page-width-mode=\{pageWidthMode\}/);
assert.match(previewSource, /pageBlockFrame/);
assert.match(previewSource, /overflowX: "clip"/);

const liveSource = fs.readFileSync("pages/sites/[...slug].js", "utf8");
assert.match(liveSource, /data-page-width-mode=\{pageWidthMode\}/);
assert.match(liveSource, /publishedPageBlockFrame/);
assert.match(liveSource, /overflowX: "clip"/);

const publishSource = fs.readFileSync("lib/website-builder/publishConfig.js", "utf8");
assert.match(publishSource, /pages: Array\.isArray\(project\.pages\) \? project\.pages\.map\(withPageLayoutDefaults\) : \[\]/);
assert.match(publishSource, /pageWidthMode: withPageLayoutDefaults\(page\)\.pageWidthMode/);

console.log("website page-width mode tests passed");
