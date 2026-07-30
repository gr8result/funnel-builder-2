import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSelectionTags,
  validateSelectionsProductCsvRecord,
} from "../lib/product-library/selectionsClassification.js";

test("Product Library selections classification validates CSV records", () => {
  assert.deepEqual(parseSelectionTags("Basin Mixer; Wet Area | bench_mounted"), ["basin-mixer", "wet-area", "bench-mounted"]);

  const valid = validateSelectionsProductCsvRecord({
    product_name: "Phoenix Vivid Slimline Basin Mixer",
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
});
