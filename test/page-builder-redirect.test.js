import test from "node:test";
import assert from "node:assert/strict";
import { getPageBuilderRedirect } from "../lib/page-builder/redirect.js";

test("page builder redirect preserves legacy query parameters", () => {
  const result = getPageBuilderRedirect({
    resolvedUrl: "/modules/page-builder?page=projectEstimate&projectId=example",
  });

  assert.equal(result.redirect.permanent, false);
  assert.equal(
    result.redirect.destination,
    "/modules/website-builder/visual-builder?page=projectEstimate&projectId=example",
  );
});
