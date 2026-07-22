import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { listItemAltText, resolveListItemImage } from "../lib/website-builder/listBlockItems.js";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const crmTitle = '<span style="font-size: 32px;"><span style="text-align: center;"><span style="font-size: 32px;">Centralise All Your Data</span></span></span>';
const crmItem = {
  id: "crm-list-1",
  title: crmTitle,
  image: "/assets/website-builder/2208a52a-8175-477e-823c-fc6de7fe4afe/crm-list-card-1.png",
};
const crmPagePath = "website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/crm.json";
const crmPage = JSON.parse(read(crmPagePath));
const actualCrmListBlock = (crmPage.blocks || []).find((block) => block?.type === "feature-list");
const actualCrmItem = actualCrmListBlock?.props?.items?.[0] || {};
const expectedCrmImage = "/assets/website-builder/2208a52a-8175-477e-823c-fc6de7fe4afe/crm-list-card-1.png";

assert.equal(
  resolveListItemImage(crmItem, { appBaseUrl: "https://app.gr8result.digital" }),
  "https://app.gr8result.digital/assets/website-builder/2208a52a-8175-477e-823c-fc6de7fe4afe/crm-list-card-1.png",
  "A CRM List Block item with a permanent app-owned image URL must render through the platform app host on the live custom domain."
);

assert.equal(
  actualCrmItem.image,
  expectedCrmImage,
  "The actual CRM page's first List Block item must keep its saved image reference."
);

assert.equal(
  resolveListItemImage(actualCrmItem, { appBaseUrl: "https://app.gr8result.digital" }),
  "https://app.gr8result.digital/assets/website-builder/2208a52a-8175-477e-823c-fc6de7fe4afe/crm-list-card-1.png",
  "The actual CRM page's first List Block image must resolve to the permanent app-hosted URL for live rendering."
);

assert.equal(
  listItemAltText(actualCrmItem),
  "Centralise All Your Customer Data",
  "The actual CRM page's first List Block rich-text title must become plain image alt text."
);

assert.equal(
  resolveListItemImage({ imageUrl: "https://cdn.example.com/list-card.png" }),
  "https://cdn.example.com/list-card.png",
  "A List Block item with permanent imageUrl must render the image live."
);

assert.equal(
  resolveListItemImage(
    { imageAssetId: "crm-asset-1" },
    { assets: { images: [{ id: "crm-asset-1", src: "https://cdn.example.com/from-asset.png" }] } }
  ),
  "https://cdn.example.com/from-asset.png",
  "A List Block item with imageAssetId must resolve through the media resolver."
);

assert.equal(
  listItemAltText(crmItem),
  "Centralise All Your Data",
  "Rich-text CRM title must become plain image alt text."
);

assert.equal(
  listItemAltText({ title: "&lt;span style=&quot;color:red&quot; onclick=&quot;bad()&quot;&gt;Track Every Opportunity&lt;/span&gt;<script>bad()</script>" }),
  "Track Every Opportunity",
  "Raw span markup, event attributes and scripts must not appear in image alt text."
);

assert.equal(
  resolveListItemImage({ image: "blob:http://localhost:3000/temp" }),
  "",
  "Invalid live image sources must fall back to the controlled placeholder."
);

const renderer = read("components/website-builder/WebsiteBlockRenderer.js");
const featureListRender = renderer.slice(
  renderer.indexOf("case \"feature-list\""),
  renderer.indexOf("case \"testimonial\"")
);
assert.match(renderer, /resolveListItemImage\(rawItem, \{ normalizedItem: item, assets, appBaseUrl: navigationContext\?\.appBaseUrl \|\| "", editor \}\)/, "Feature-list img src must be resolved through the canonical List Block helper.");
assert.match(renderer, /listItemAltText\(rawItem, \{ normalizedItem: item, fallback: `Feature \$\{idx \+ 1\}` \}\)/, "Feature-list alt text must be derived through the plain-text helper.");
assert.doesNotMatch(featureListRender, /alt=\{item\.imageAlt \|\| item\.title/, "Feature-list images must not pass raw rich-text titles into alt.");

console.log("Website List Block image rendering regression checks passed.");
