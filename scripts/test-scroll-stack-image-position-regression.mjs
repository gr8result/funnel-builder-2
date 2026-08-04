import assert from "node:assert/strict";
import { generateWebsitePageHtml } from "../lib/website-builder/projectStore.js";

const imageUrl = "https://example.com/funnels-panel.png";

const project = {
  id: "image-position-regression",
  name: "Image Position Regression",
  brief: { businessName: "Regression Test" },
};

const page = {
  id: "funnels",
  name: "Funnels",
  slug: "funnels",
};

const block = {
  id: "funnels-scroll-stack",
  type: "scroll-stack",
  props: {
    backgroundColor: "#07111f",
    contentVerticalAlign: "top",
    activeCardHeight: 560,
    activeCardMaxHeight: "70vh",
    cardPadding: 48,
    cardGap: 40,
    closedRowHeight: 64,
    imageFit: "contain",
    imageObjectPosition: "center top",
    imagePositionX: 50,
    imagePositionY: 0,
    panelImageHeightMode: "fixed",
    panelImageFixedHeight: 420,
    imageMaxWidth: 620,
    panels: [
      {
        id: "panel-1",
        eyebrow: "Traffic",
        heading: "Bring the right visitors in",
        body: "A panel body that should remain visually dominant.",
        image: imageUrl,
        imageUrl,
        imagePosition: "right",
        useBlockImageSettings: true,
      },
      {
        id: "panel-2",
        eyebrow: "Capture",
        heading: "Capture the enquiry",
        body: "Second panel body.",
        image: imageUrl,
        imageUrl,
        imagePosition: "right",
        useBlockImageSettings: true,
      },
    ],
  },
};

const html = generateWebsitePageHtml(project, page, [block]);

assert.match(html, /data-wb-static-accordion-block="scroll-stack"/, "scroll-stack static fallback should render explicit accordion markup");
assert.match(html, /object-fit:contain/, "published fallback must preserve Image Fit: Contain");
assert.match(html, /object-position:50% 0%/, "published fallback must preserve Image Position: Top Centre numeric controls");
assert.match(html, /align-items:start/, "open row grid should top-align content when contentVerticalAlign is top");
assert.match(html, /align-content:start/, "open row grid content should top-align when contentVerticalAlign is top");
assert.match(html, /data-wb-static-accordion-image-wrapper="true" style="align-items:flex-start;"/, "image wrapper should start at the top for Top Centre");
assert.doesNotMatch(html, /data-wb-controlled-image="scroll-stack"[^>]*object-fit:cover/, "scroll-stack images must not fall back to cover when contain is selected");
assert.doesNotMatch(html, /data-wb-controlled-image="scroll-stack"[^>]*object-position:center center/, "scroll-stack images must not fall back to center when top centre is selected");

console.log("Scroll Stack image fit/position regression passed.");
