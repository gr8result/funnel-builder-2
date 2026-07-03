import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  cacheWebsiteProject,
  generateWebsitePageHtml,
  getWebsiteProject,
  updateWebsiteProject,
} from "../lib/website-builder/projectStore.js";
import { BlockTypes } from "../lib/website-builder/pageBlockComponents.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://builder.test/",
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});

window.localStorage.clear();

const headlineHtml = '<span style="font-size: 74px; font-weight: 800; line-height: 1.05; color: #aa1122; text-align: right;">Styled headline</span>';
const bodyHtml = '<p style="font-size: 23px; line-height: 1.7; color: #334455; text-align: justify;">Styled body copy</p>';
const textHtml = '<h2 style="font-size: 42px; line-height: 1.2; color: #123456; text-align: center;">Text heading</h2><p style="font-size: 21px; color: #654321; text-align: right;">Text body</p>';
const pricingTitleHtml = '<span style="font-size: 58px; font-weight: 900; color: #112233; text-align: right;">Pricing headline</span>';

const project = {
  id: "typography-persistence-test",
  name: "Typography Persistence Test",
  mode: "ai",
  buildType: "website",
  stylePack: "executive",
  status: "draft",
  brief: {},
  pages: [{ id: "home", name: "Home", slug: "home" }],
  pagesContent: {},
  pageBlocks: {
    Home: [
      {
        id: "hero-styled",
        type: BlockTypes.HERO,
        props: {
          headline: headlineHtml,
          subheadline: bodyHtml,
          headlineBlock: {
            content: headlineHtml,
            fontSize: 74,
            fontWeight: "800",
            lineHeight: 1.05,
            color: "#aa1122",
            alignment: "right",
          },
          bodyBlock: {
            content: bodyHtml,
            fontSize: 23,
            lineHeight: 1.7,
            color: "#334455",
            alignment: "justify",
          },
          headlineFontSize: 74,
          headlineFontWeight: "800",
          headlineLineHeight: 1.05,
          headlineColor: "#aa1122",
          headlineAlignment: "right",
          subheadlineFontSize: 23,
          subheadlineLineHeight: 1.7,
          textColor: "#334455",
          alignment: "justify",
        },
      },
      {
        id: "text-styled",
        type: BlockTypes.TEXT,
        props: {
          text: textHtml,
          textFontSize: 21,
          textLineHeight: 1.35,
          textColor: "#654321",
          alignment: "right",
          paddingTop: 48,
          paddingBottom: 52,
        },
      },
      {
        id: "pricing-styled",
        type: BlockTypes.PRICING_TABLE,
        props: {
          title: pricingTitleHtml,
          headlineFontSize: 58,
          headlineFontWeight: "900",
          headlineColor: "#112233",
          headlineAlignment: "right",
          plans: [
            {
              name: '<span style="font-size: 30px; color: #224466;">Pro</span>',
              price: '<span style="font-size: 48px; text-align: center;">$99</span>',
              description: '<span style="color: #445566;">Styled description</span>',
              includedFeatures: ['<span style="font-weight: 700;">Styled feature</span>'],
              extras: [],
              cta: '<span style="font-size: 20px;">Select plan</span>',
            },
          ],
        },
      },
    ],
  },
};

cacheWebsiteProject(project, { onlyIfNewer: false });
const saved = updateWebsiteProject(project.id, { pageBlocks: project.pageBlocks });
assert.ok(saved, "project should save");

const reloaded = getWebsiteProject(project.id);
const blocks = reloaded?.pageBlocks?.Home || [];
const savedHero = blocks.find((block) => block.id === "hero-styled")?.props;
const savedText = blocks.find((block) => block.id === "text-styled")?.props;
const savedPricing = blocks.find((block) => block.id === "pricing-styled")?.props;

assert.equal(savedHero?.headlineBlock?.fontSize, 74);
assert.equal(savedHero?.headlineBlock?.alignment, "right");
assert.equal(savedHero?.bodyBlock?.alignment, "justify");
assert.equal(savedText?.textFontSize, 21);
assert.equal(savedText?.alignment, "right");
assert.equal(savedPricing?.headlineFontSize, 58);
assert.equal(savedPricing?.headlineAlignment, "right");
assert.match(savedPricing?.title || "", /font-size:\s*58px/);

const html = generateWebsitePageHtml(reloaded, reloaded.pages[0], blocks);
assert.match(html, /font-size:74px/);
assert.match(html, /font-weight:800/);
assert.match(html, /line-height:1\.05/);
assert.match(html, /text-align:right/);
assert.match(html, /font-size: 42px/);
assert.match(html, /text-align: center/);
assert.match(html, /font-size:58px/);
assert.match(html, /Pricing headline/);
assert.match(html, /Styled feature/);

console.log("Website Builder typography persistence test passed.");
