import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  parseSelectionTags,
  normalizeSelectionVisibilityForCsv,
  validateSelectionsProductCsvRecord,
} from "../lib/product-library/selectionsClassification.js";

test("Product Library selections classification validates CSV records", () => {
  assert.deepEqual(parseSelectionTags("Basin Mixer; Wet Area | bench_mounted"), ["basin-mixer", "wet-area", "bench-mounted"]);
  assert.equal(normalizeSelectionVisibilityForCsv("Builder Selectable"), "builder_selectable");

  const valid = validateSelectionsProductCsvRecord({
    product_name: "Phoenix Vivid Slimline Basin Mixer",
    selection_visibility: "client_selectable",
    category: "Tapware",
    subcategory: "Basin Mixers",
    requirement_tags: "tapware; basin mixer; wet area",
    tier: "Premium",
    supplier: "Phoenix",
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.tags, ["tapware", "basin-mixer", "wet-area"]);

  const missing = validateSelectionsProductCsvRecord({});
  assert.equal(missing.ok, false);
  assert(missing.errors.includes("category is required"));
  assert(missing.errors.includes("requirement_tags is required"));

  const unknown = validateSelectionsProductCsvRecord({
    product_name: "Mystery product",
    category: "Tapware",
    subcategory: "Basin Mixers",
    requirement_tags: "basin mixer; mystery tag",
    tier: "Premium",
    supplier: "Supplier",
  });
  assert.equal(unknown.ok, false);
  assert(unknown.errors.some((error) => error.includes("Unknown requirement_tags: mystery-tag")));

  const invalidVisibility = validateSelectionsProductCsvRecord({
    product_name: "Hidden tap",
    selection_visibility: "public",
    category: "Tapware",
    subcategory: "Basin Mixers",
    requirement_tags: "basin mixer",
    tier: "Classic",
    supplier_name: "Supplier",
  });
  assert.equal(invalidVisibility.ok, false);
  assert(invalidVisibility.errors.some((error) => error.includes("selection_visibility must be one of")));
});

test("Product Library defaults to client selectable catalogue filters", () => {
  const page = fs.readFileSync(path.join(process.cwd(), "pages", "modules", "builders", "product-library.js"), "utf8");
  const toolbar = fs.readFileSync(path.join(process.cwd(), "components", "product-library", "ProductLibraryToolbar.jsx"), "utf8");
  const constants = fs.readFileSync(path.join(process.cwd(), "lib", "product-library", "constants.js"), "utf8");
  const listApi = fs.readFileSync(path.join(process.cwd(), "pages", "api", "product-library", "list.js"), "utf8");

  assert.match(page, /selectionVisibility: "client_selectable"/);
  assert.match(page, /filters\.selectionVisibility !== "all"/);
  assert.match(toolbar, /SELECTION_VISIBILITY_VALUES/);
  assert.match(constants, /Client Selectable/);
  assert.match(toolbar, /Missing supplier link/);
  assert.match(toolbar, /Missing requirement tags/);
  assert.match(listApi, /query\.selectionVisibility \? String\(query\.selectionVisibility\) : "client_selectable"/);
  assert.match(listApi, /estimating_only/);
});
