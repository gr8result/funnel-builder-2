import assert from "node:assert/strict";
import fs from "node:fs";
import {
  inferCtaLinkType,
  normalizeHrefByType,
  resolvePreferredCtaHref,
  resolveRenderedCtaHref,
} from "../lib/website-builder/buttonLinks.js";

assert.equal(inferCtaLinkType("/contact", ""), "page", "Internal path must infer Page / URL");
assert.equal(inferCtaLinkType("#contact", ""), "anchor", "Anchor must infer anchor type");
assert.equal(inferCtaLinkType("https://example.com", ""), "external", "External URL must infer external type");
assert.equal(
  inferCtaLinkType("/contact", "anchor"),
  "page",
  "Internal path must win when stale explicit linkType conflicts",
);

assert.equal(normalizeHrefByType("page", "/contact"), "/contact", "Page / URL must keep /contact");
assert.equal(normalizeHrefByType("page", "contact"), "/contact", "Bare page path should normalize to /contact");
assert.equal(normalizeHrefByType("anchor", "#contact"), "#contact", "Anchor must keep #contact");
assert.equal(normalizeHrefByType("external", "https://example.com"), "https://example.com", "External URL must remain unchanged");
assert.equal(
  resolvePreferredCtaHref("#contact", "/contact", "page"),
  "/contact",
  "Legacy/internal URL should win when explicit page type conflicts with stale canonical href",
);

const pageMap = new Map([
  ["home", { id: "home", href: "/" }],
  ["modules", { id: "modules", href: "/modules" }],
]);

assert.equal(
  resolveRenderedCtaHref({ linkType: "page", href: "/contact", pageId: "home" }, { pageMap }),
  "/contact",
  "Saved Page / URL href must take priority over pageId mapping",
);
assert.equal(
  resolveRenderedCtaHref({ linkType: "anchor", href: "#contact" }, { pageMap }),
  "#contact",
  "Anchor href must remain unchanged in render resolver",
);
assert.equal(
  resolveRenderedCtaHref({ linkType: "external", href: "https://example.com" }, { pageMap }),
  "https://example.com",
  "External href must remain unchanged in render resolver",
);

const pbCanvas = fs.readFileSync("components/website-builder/page-builder/pbCanvasComponents.js", "utf8");
assert(pbCanvas.includes("Page / URL"), "Hero link type label should expose Page / URL");
assert(!pbCanvas.includes("normalized.href || \"#contact\""), "Hero CTA normalization must not default to #contact");
assert(pbCanvas.includes("ctaLink: nextCta.href"), "Primary CTA href should persist to legacy CTA field for compatibility");
assert(pbCanvas.includes("secondaryCtaLink: nextCta.href"), "Secondary CTA href should persist to legacy secondary CTA field for compatibility");

const renderer = fs.readFileSync("components/website-builder/WebsiteBlockRenderer.js", "utf8");
const sharedRenderer = fs.readFileSync("components/website-builder/website-renderer/wbBlockComponents.js", "utf8");
assert(renderer.includes("resolveRenderedCtaHref"), "Preview renderer must use shared CTA resolver");
assert(sharedRenderer.includes("resolveRenderedCtaHref"), "Live/shared renderer must use shared CTA resolver");

console.log("website builder button link regression checks passed");