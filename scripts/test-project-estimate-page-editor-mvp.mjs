import assert from "node:assert/strict";
import {
  createMvpBlock,
  createMvpPage,
  moveMvpPage,
  normaliseMvpBlock,
  serialiseMvpDocument,
  updateMvpBlockFrame,
} from "../components/estimate-builder/project-estimate/pageEditorMvp.js";

const firstPage = createMvpPage(0, { id: "page-a", title: "Page A" });
let builder = { id: "estimate-mvp", pages: [firstPage] };

const addedPage = createMvpPage(builder.pages.length, { id: "page-b", title: "Page B" });
builder = { ...builder, pages: [...builder.pages, addedPage], activePageId: addedPage.id };
assert.equal(builder.pages.length, 2, "Add Page creates a page");
assert.equal(builder.activePageId, "page-b", "Add Page selects the new page");

builder = { ...builder, pages: moveMvpPage(builder.pages, "page-b", -1), activePageId: "page-b" };
assert.deepEqual(builder.pages.map((page) => page.id), ["page-b", "page-a"], "Move Page Up changes order");

builder = { ...builder, pages: moveMvpPage(builder.pages, "page-b", 1), activePageId: "page-b" };
assert.deepEqual(builder.pages.map((page) => page.id), ["page-a", "page-b"], "Move Page Down changes order");

const textBlock = createMvpBlock("text", 0, {
  id: "text-1",
  x: 74,
  y: 96,
  width: 320,
  height: 120,
  text: "MVP text",
  fontSize: 18,
  fontWeight: 600,
  color: "#111827",
  align: "left",
});
const movedTextBlock = updateMvpBlockFrame(textBlock, { x: 145, y: 188, width: 320, height: 120 });
assert.equal(movedTextBlock.x, 145, "Text move updates x");
assert.equal(movedTextBlock.y, 188, "Text move updates y");
assert.equal(movedTextBlock.design.frame.x, 145, "Text move syncs design.frame.x");

const imageBlock = createMvpBlock("image", 1, {
  id: "image-1",
  x: 100,
  y: 220,
  width: 300,
  height: 220,
  src: "https://example.com/image.jpg",
});
const resizedImageBlock = updateMvpBlockFrame(imageBlock, { x: 100, y: 220, width: 420, height: 280 });
assert.equal(resizedImageBlock.width, 420, "Image resize updates width");
assert.equal(resizedImageBlock.height, 280, "Image resize updates height");
assert.equal(resizedImageBlock.design.frame.width, 420, "Image resize syncs design.frame.width");

builder = {
  ...builder,
  pages: builder.pages.map((page) => page.id === "page-b" ? {
    ...page,
    blocks: [movedTextBlock, resizedImageBlock],
  } : page),
};

const saved = JSON.stringify(serialiseMvpDocument(builder));
const reloaded = serialiseMvpDocument(JSON.parse(saved));
assert.deepEqual(reloaded.pages.map((page) => page.id), ["page-a", "page-b"], "Persistence round-trip restores page order");
assert.equal(reloaded.pages[1].blocks[0].x, 145, "Persistence round-trip restores text x");
assert.equal(reloaded.pages[1].blocks[0].y, 188, "Persistence round-trip restores text y");
assert.equal(reloaded.pages[1].blocks[1].src, "https://example.com/image.jpg", "Persistence round-trip restores image src");
assert.equal(reloaded.pages[1].blocks[1].width, 420, "Persistence round-trip restores image width");
assert.equal(reloaded.pages[1].blocks[1].height, 280, "Persistence round-trip restores image height");

const legacyLogo = normaliseMvpBlock({
  id: "logo-1",
  type: "logo",
  content: { logoUrl: "https://example.com/logo.svg" },
  design: { frame: { x: 10, y: 20, width: 120, height: 60 } },
}, 2);
assert.equal(legacyLogo.type, "logo", "Normalizer preserves non-MVP block types");
assert.equal(legacyLogo.content.logoUrl, "https://example.com/logo.svg", "Normalizer preserves non-MVP block content");

console.log("Project Estimate page editor MVP checks passed.");
