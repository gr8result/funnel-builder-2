import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, hydrateDocument, serializeDocument } from "../core/documentState.js";
import { createTextObject } from "../objects/textObject.js";
import { addObjectToPage } from "../core/pageEngine.js";

test("document save and reload preserves objects", () => {
  const doc = createDocument({ pages: [{ id: "p1", name: "A4", objects: [] }] });
  const page = addObjectToPage(doc.pages[0], createTextObject({ id: "text_1", data: { text: "Hello" } }));
  const saved = serializeDocument({ ...doc, pages: [page] });
  const reloaded = hydrateDocument(saved);
  assert.equal(reloaded.pages[0].objects[0].id, "text_1");
  assert.equal(reloaded.pages[0].objects[0].data.text, "Hello");
});
