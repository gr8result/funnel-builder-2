import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { resolveBlockImageUrl, resolveLayerImageUrl } from "../lib/website-builder/blockImageResolver.js";

const PROJECT_ROOT = path.join(
  process.cwd(),
  "website-builder-sites",
  "35ab846e-0764-498b-b1f8-7d2cf27d85a5",
  "2208a52a-8175-477e-823c-fc6de7fe4afe",
);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8"));
}

function flattenBlocks(value, out = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => flattenBlocks(item, out));
  } else if (value && typeof value === "object") {
    if (typeof value.type === "string" && value.props && typeof value.props === "object") out.push(value);
    Object.values(value).forEach((item) => flattenBlocks(item, out));
  }
  return out;
}

const projectHubPage = readJson("pages/project-hub.json");
const fullProject = readJson("full-project.json");

const pageHeroBlocks = flattenBlocks(projectHubPage).filter((block) => block.type === "hero");
assert.ok(pageHeroBlocks.length >= 1, "Project Hub page should contain hero blocks");

for (const hero of pageHeroBlocks) {
  assert.equal(hero.props.overlayEnabled, false, `Hero ${hero.id || hero.props?.headline || ""} should have overlay explicitly disabled`);
  assert.equal(Number(hero.props.overlayOpacity), 0, "Hero overlay opacity should be zero");
  assert.equal(Number(hero.props.backgroundOverlayOpacity), 0, "Legacy background overlay opacity should be zero");
  assert.ok(resolveBlockImageUrl(hero), "Hero background image should resolve through shared resolver");
  assert.equal(hero.props.cta?.href, hero.props.ctaLink, "Primary CTA canonical href should match legacy href");
  assert.equal(hero.props.secondaryCta?.href, hero.props.secondaryCtaLink, "Secondary CTA canonical href should match legacy href");
}

const fullProjectHubBlocks = flattenBlocks(fullProject.pageBlocks?.["Project Hub"] || []);
assert.ok(fullProjectHubBlocks.some((block) => block.type === "hero" && block.props?.overlayEnabled === false), "Full project Project Hub heroes should persist explicit overlay-off state");

assert.equal(resolveBlockImageUrl({ type: "hero", props: { backgroundImageUrl: "https://example.test/hero.jpg" } }), "https://example.test/hero.jpg");
assert.equal(resolveBlockImageUrl({ type: "image", props: { imageUrl: "/assets/example.png" } }), "https://app.gr8result.digital/assets/example.png");
assert.equal(resolveLayerImageUrl({ url: "https://example.test/layer.png" }), "https://example.test/layer.png");
assert.equal(
  resolveLayerImageUrl({ src: "/assets/website-builder/site/page-card.png" }),
  "https://app.gr8result.digital/assets/website-builder/site/page-card.png"
);
assert.equal(resolveLayerImageUrl({ src: "blob:http://localhost/transient" }), "");

const reactRenderer = fs.readFileSync(path.join(process.cwd(), "components/website-builder/WebsiteBlockRenderer.js"), "utf8");
assert.match(reactRenderer, /data-pricing-card="true"/, "React pricing cards should expose a regression marker");
assert.match(reactRenderer, /data-pricing-feature-row="true"/, "React pricing rows should expose a regression marker");
assert.match(reactRenderer, /overflowWrap:\s*"anywhere"/, "React pricing rows should force long text wrapping");
assert.match(reactRenderer, /pricingColumnCount/, "React pricing grid should be device-aware");

const staticRenderer = fs.readFileSync(path.join(process.cwd(), "lib/website-builder/projectStore.js"), "utf8");
assert.match(staticRenderer, /data-pricing-card="true"/, "Static pricing cards should expose a regression marker");
assert.match(staticRenderer, /overflow-wrap:anywhere/, "Static pricing rows should force long text wrapping");
assert.match(staticRenderer, /resolveBlockImageUrl/, "Static hero rendering should use the shared media resolver");

console.log("Project Hub media and pricing regression checks passed.");
