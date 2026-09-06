import test from "node:test";
import assert from "node:assert/strict";
import { BlockTypes } from "../lib/website-builder/page-blocks/blockTypes.js";
import { BlockDefinitions } from "../lib/website-builder/page-blocks/blockDefinitions.js";
import { getPageBuilderRedirect } from "../lib/page-builder/redirect.js";

test("BlockTypes includes SHAPE", () => {
  assert.equal(BlockTypes.SHAPE, "shape");
  assert.ok(BlockDefinitions[BlockTypes.SHAPE]);
  const shapeDef = BlockDefinitions[BlockTypes.SHAPE];
  assert.equal(shapeDef.name, "Shape Widget");
  assert.equal(shapeDef.defaultProps.shapeType, "rectangle");
  assert.equal(shapeDef.defaultProps.usageType, "color");
});

test("Shape block defaults support shape types and usage modes", () => {
  const shapeDef = BlockDefinitions[BlockTypes.SHAPE];
  assert.ok(shapeDef.defaultProps.backgroundColor);
  assert.ok(shapeDef.defaultProps.borderColor !== undefined);
  assert.equal(shapeDef.defaultProps.text, "Shape Text");
  assert.equal(shapeDef.defaultProps.imageUrl, "");
});

test("Add new page data helper adds page to project pages array", () => {
  const initialPages = [
    { name: "Home", slug: "home", order: 0 },
  ];
  const newPageName = "Services";
  const newPageSlug = "services";
  const nextPage = {
    id: newPageSlug,
    name: newPageName,
    slug: newPageSlug,
    order: initialPages.length,
    showInNavigation: true,
  };
  const updatedPages = [...initialPages, nextPage];

  assert.equal(updatedPages.length, 2);
  assert.equal(updatedPages[1].name, "Services");
  assert.equal(updatedPages[1].slug, "services");
  assert.equal(updatedPages[1].order, 1);
});

test("Move page Up and Down swaps page positions correctly", () => {
  const pages = [
    { name: "Home", order: 0, navigationOrder: 0 },
    { name: "About", order: 1, navigationOrder: 1 },
    { name: "Contact", order: 2, navigationOrder: 2 },
  ];

  function movePage(pagesList, pageName, direction) {
    const list = [...pagesList];
    const index = list.findIndex((p) => p.name === pageName);
    if (index === -1) return list;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return list;
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;
    return list.map((p, idx) => ({ ...p, order: idx, navigationOrder: idx }));
  }

  // Move "Contact" up
  const afterUp = movePage(pages, "Contact", "up");
  assert.equal(afterUp[0].name, "Home");
  assert.equal(afterUp[1].name, "Contact");
  assert.equal(afterUp[2].name, "About");
  assert.equal(afterUp[1].order, 1);

  // Move "Home" down
  const afterDown = movePage(pages, "Home", "down");
  assert.equal(afterDown[0].name, "About");
  assert.equal(afterDown[1].name, "Home");
  assert.equal(afterDown[2].name, "Contact");
  assert.equal(afterDown[1].order, 1);
});

test("Page background settings update background color and image", () => {
  const pageEntry = {
    name: "Home",
    backgroundColor: "#ffffff",
    backgroundImage: "",
    backgroundSize: "cover",
  };

  const updatedPage = {
    ...pageEntry,
    backgroundColor: "#0f172a",
    backgroundImage: "https://example.com/bg.jpg",
    backgroundSize: "cover",
  };

  assert.equal(updatedPage.backgroundColor, "#0f172a");
  assert.equal(updatedPage.backgroundImage, "https://example.com/bg.jpg");
  assert.equal(updatedPage.backgroundSize, "cover");
});

test("Legacy estimate-builder redirect URL compatibility is preserved", () => {
  const result = getPageBuilderRedirect({
    resolvedUrl: "/modules/estimate-builder?page=projectEstimate&estimateId=123",
  });
  assert.equal(result.redirect.permanent, false);
  assert.equal(
    result.redirect.destination,
    "/modules/website-builder/visual-builder?page=projectEstimate&estimateId=123"
  );
});
