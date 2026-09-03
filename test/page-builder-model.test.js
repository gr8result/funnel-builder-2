import test from "node:test";
import assert from "node:assert/strict";
import { addPage, createPage, insertShape, movePage } from "../lib/page-builder/model.js";

test("page operations add and reorder pages", () => {
  const pages = addPage([createPage("Home")], "Estimate");
  assert.equal(pages[1].name, "Estimate");
  assert.equal(movePage(pages, 1, -1)[0].name, "Estimate");
});

test("shape insertion creates an editable shape element", () => {
  const page = insertShape(createPage(), "triangle");
  assert.equal(page.elements[0].type, "triangle");
  assert.equal(page.elements[0].mode, "color");
});
