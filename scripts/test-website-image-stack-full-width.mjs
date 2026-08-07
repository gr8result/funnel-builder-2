import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const inspector = read("components/website-builder/page-builder/pbCanvasComponents.js");
const renderer = read("components/website-builder/website-renderer/wbBlockComponents.js");
const definitions = read("lib/website-builder/page-blocks/blockDefinitions.js");
const projectHub = JSON.parse(read("website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/project-hub.json"));

assert.match(inspector, /Full Width/, "Image Stack inspector must expose a Full Width toggle.");
assert.match(
  inspector,
  /update\(\{\s*fullWidth:\s*e\.target\.checked,\s*fullWidthBackground:\s*e\.target\.checked\s*\}\)/s,
  "The Full Width toggle must persist both the explicit property and legacy compatibility property."
);

assert.match(definitions, /fullWidth:\s*true,\s*\n\s*fullWidthBackground:\s*true,/, "New Image Stack blocks must save an explicit fullWidth property.");
assert.match(renderer, /blockProps\?\.fullWidth !== undefined[\s\S]*blockProps\.fullWidth === true[\s\S]*blockProps\?\.fullWidthBackground === true/, "Renderer must respect explicit fullWidth and legacy fullWidthBackground.");
assert.match(renderer, /Math\.min\(1,\s*canvasWidth \/ designCanvasWidth\)/, "Renderer must scale the design canvas down to the available viewport.");
assert.match(renderer, /height:\s*stackHeight/, "Rendered canvas must preserve the scaled design aspect height.");
assert.match(renderer, /data-image-stack-frame/, "Renderer must keep a separate outer frame for measuring and centring the Image Stack canvas.");
assert.match(renderer, /data-image-stack-canvas-wrapper/, "Renderer must keep a dedicated rendered-size wrapper around the design canvas.");
assert.match(renderer, /justifyContent:\s*"center"/, "The Image Stack frame must centre the saved design canvas.");
assert.match(renderer, /width:\s*renderedCanvasWidth/, "The wrapper must reserve the scaled canvas width.");
assert.match(renderer, /height:\s*renderedCanvasHeight/, "The wrapper must reserve the scaled canvas height.");
assert.match(renderer, /width:\s*designCanvasWidth/, "The internal Image Stack canvas must keep the saved canvas width as its coordinate system.");
assert.match(renderer, /height:\s*designCanvasHeight/, "The internal Image Stack canvas must keep the saved canvas height as its coordinate system.");
assert.match(renderer, /transform:\s*`translateX\(-50%\) scale\(\$\{responsiveScale\}\)`/, "The saved Image Stack canvas must stay centered while scaling as one unit.");
assert.match(renderer, /transformOrigin:\s*"top center"/, "The saved Image Stack canvas must scale from top centre.");
assert.doesNotMatch(renderer, /left:\s*Math\.round\(\(layer\.x \* responsiveScale\)/, "Layer x positions must not be individually scaled from top-left.");
assert.doesNotMatch(renderer, /top:\s*Math\.round\(\(layer\.y \* responsiveScale\)/, "Layer y positions must not be individually scaled from top-left.");
assert.match(renderer, /compact && blockProps\?\.mobileLayoutMode === "stacked"/, "Responsive Image Stack must keep the scaled canvas by default instead of stacking layers.");

const imageStacks = (projectHub.blocks || []).filter((block) => block?.type === "image-stack");
assert.ok(imageStacks.length >= 2, "Project Hub must include at least two Image Stack benchmark blocks.");
for (const block of imageStacks) {
  assert.equal(block.props?.fullWidthBackground, true, `${block.id} should keep the legacy full-width property.`);
  assert.equal(block.props?.fullWidth, undefined, `${block.id} content must not be rewritten by the regression test.`);
  assert.ok(Number(block.props?.baseLayoutWidth || 0) > 0, `${block.id} must keep an explicit design canvas width.`);
  assert.ok(String(block.props?.minHeight || "").trim(), `${block.id} must keep an explicit design canvas height.`);
}

console.log("Website Image Stack full-width regression checks passed.");
