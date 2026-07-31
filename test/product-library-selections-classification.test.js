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
  const drawer = fs.readFileSync(path.join(process.cwd(), "components", "product-library", "ProductDetailDrawer.jsx"), "utf8");
  const productPicker = fs.readFileSync(path.join(process.cwd(), "src", "modules", "inclusions-selections", "products", "selectionVisibility.ts"), "utf8");

  assert.match(page, /selectionVisibility: "client_selectable"/);
  assert.match(page, /const \[activeTab, setActiveTab\] = useState\("selections"\)/);
  assert.match(page, /ProductLibraryTabs/);
  assert.match(page, /Selection Products/);
  assert.match(page, /Client Selectable Products/);
  assert.match(page, /Estimating Catalogue/);
  assert.match(page, /Internal Estimating Catalogue/);
  assert.match(page, /selectionVisibility: activeTab === "estimating" \? "estimating_only" : filters\.selectionVisibility/);
  assert.match(page, /Import Products/);
  assert.match(page, /Categories & Tags/);
  assert.match(page, /Suppliers/);
  assert.match(page, /Open Supplier Website/);
  assert.match(page, /product\.product_url/);
  assert.match(page, /create_only/);
  assert.match(page, /update_only/);
  assert.match(page, /upsert/);
  assert.match(page, /ACTIVE_SELECTION_VISIBILITIES/);
  assert.match(page, /filters\.selectionVisibility !== "all"/);
  assert.doesNotMatch(page, /viewMode === "table" \?/);
  assert.match(toolbar, /SELECTION_VISIBILITY_VALUES/);
  assert.match(toolbar, /Manage the products, finishes and fixtures available for project inclusions and client selections\./);
  assert.match(toolbar, /Add Selection Product/);
  assert.match(constants, /Client Selectable/);
  assert.match(constants, /Builder Selectable/);
  assert.match(toolbar, /Missing supplier link/);
  assert.match(toolbar, /Missing requirement tags/);
  assert.match(drawer, /Selection Visibility/);
  assert.match(drawer, /View Official Product Page/);
  assert.match(listApi, /query\.selectionVisibility \? String\(query\.selectionVisibility\) : "client_selectable"/);
  assert.match(listApi, /estimating_only/);
  assert.match(productPicker, /includeBuilderSelectable/);
  assert.match(productPicker, /client_selectable/);
  assert.match(productPicker, /builder_selectable/);
});
