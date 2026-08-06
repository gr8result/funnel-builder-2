import assert from "node:assert/strict";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { getPlanGeometry, invalidatePlanGeometry } from "../geometry/planGeometryService.js";

const OPS = pdfjsLib.OPS;

let getPageCalls = 0;
let operatorListCalls = 0;
const pdfDocument = {
  async getPage(pageNumber) {
    getPageCalls += 1;
    assert.equal(pageNumber, 1);
    return {
      getViewport: ({ scale, rotation }) => {
        assert.equal(scale, 1);
        assert.equal(rotation, 0);
        return { width: 400, height: 300 };
      },
      async getOperatorList() {
        operatorListCalls += 1;
        return {
          fnArray: [OPS.constructPath, OPS.constructPath, OPS.constructPath],
          argsArray: [
            [OPS.stroke, [[0, 40, 40, 1, 180, 40]], [40, 40, 180, 40]],
            [OPS.stroke, [[0, 180, 40, 1, 180, 160]], [180, 40, 180, 160]],
            [OPS.stroke, [[0, 180, 160, 1, 40, 160]], [180, 160, 40, 160]],
          ],
        };
      },
    };
  },
};

const first = await getPlanGeometry(pdfDocument, 1);
const second = await getPlanGeometry(pdfDocument, 1);

assert.equal(first, second, "same document/page should reuse the cached geometry promise");
assert.equal(operatorListCalls, 1, "operator-list extraction should run once per document/page");
assert.equal(getPageCalls, 2, "first build reads page metadata plus operator list page; cached read adds no calls");
assert.equal(first.pageId, "pdf-page-1");
assert.equal(first.rotation, 0);
assert.equal(first.source, "vector");
assert.equal(first.lines.length, 3);
assert.equal(first.lines[0].source, "pdf-vector");

invalidatePlanGeometry(pdfDocument, 1);
const third = await getPlanGeometry(pdfDocument, 1);
assert.notEqual(third, first, "invalidating the page should force a fresh geometry promise");
assert.equal(operatorListCalls, 2);

console.log("planGeometryService.test.mjs passed");
