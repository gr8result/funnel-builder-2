import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../core/documentState.js";
import { addObjectToPage } from "../core/pageEngine.js";
import { createTextObject } from "../objects/textObject.js";
import { renderDocumentForPdf } from "../export/pdfRenderer.js";

test("pdf render payload resolves dynamic placeholders", () => {
  const workbook = {
    data: {
      inputDataSheet: {
        rows: {
          projectName: { value: "Smith Residence" },
        },
      },
    },
  };
  const doc = createDocument({ pages: [{ id: "p1", objects: [] }] });
  const page = addObjectToPage(doc.pages[0], createTextObject({ id: "t1", data: { text: "{{PROJECT_NAME}}" } }));
  const payload = renderDocumentForPdf({ ...doc, pages: [page] }, workbook);
  assert.equal(payload.pages[0].objects[0].renderedText, "Smith Residence");
});
