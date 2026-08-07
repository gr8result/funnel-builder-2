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
  const workbook = fs.readFileSync(path.join(process.cwd(), "components", "estimate-builder", "EstimateBuilderWorkbook.js"), "utf8");
  const workbookHook = fs.readFileSync(path.join(process.cwd(), "hooks", "estimate-builder", "useEstimateBuilderWorkbook.js"), "utf8");
  const cardsStart = workbook.indexOf("const DASHBOARD_WORKSPACE_CARDS");
  const cardsEnd = workbook.indexOf("function ProjectDashboardSheet");
  const dashboardCards = workbook.slice(cardsStart, cardsEnd);
  const selectionsStart = page.indexOf('{activeTab === "selections"');
  const adminStart = page.indexOf('{activeTab === "admin"');
  const estimatingStart = page.indexOf('{activeTab === "estimating"');
  const selectionsPanel = page.slice(selectionsStart, adminStart);
  const adminPanel = page.slice(adminStart, estimatingStart);
  const estimatingPanel = page.slice(estimatingStart, page.indexOf('{activeTab === "suppliers"'));
  const visualBrowser = page.slice(page.indexOf("function VisualSelectionsBrowser"), page.indexOf("const visualBrowserCss"));

  assert.match(page, /selectionVisibility: "client_selectable"/);
  assert.match(page, /const \[activeTab, setActiveTab\] = useState\("selections"\)/);
  assert.match(page, /Product Library Admin/);
  assert.match(page, /Exterior/);
  assert.match(page, /Kitchen/);
  assert.match(page, /Bathroom/);
  assert.match(page, /Bedroom/);
  assert.match(page, /productCategory\("garage-door", "Garage Door"\)/);
  assert.match(page, /productCategory\("oven", "Oven"\)/);
  assert.match(page, /productCategory\("cooktop", "Cooktop"\)/);
  assert.match(page, /View Official Product Page/);
  assert.match(page, /Supplier product page not available\./);
  assert.match(page, /Add To Selections/);
  assert.match(page, /Back to \$\{selectedArea\.label\}/);
  assert.match(page, /Back to \$\{categoryTitle\(selectedBrowserCategory\)\}/);
  assert.match(page, /ProductLibraryTabs/);
  assert.match(page, /Selection Products/);
  assert.match(page, /Client Selectable Products/);
  assert.match(page, /Estimating Catalogue/);
  assert.match(page, /Internal Estimating Catalogue/);
  assert.match(page, /Internal labour, materials, BOQ and rate items used for estimating and quotations\. These items are not available for client selections\./);
  assert.match(page, /selectionVisibility: activeTab === "estimating" \? "estimating_only" : filters\.selectionVisibility/);
  assert.match(page, /selectionVisibility: "client_selectable"/);
  assert.match(page, /Import Products/);
  assert.match(page, /Categories & Tags/);
  assert.match(page, /Suppliers/);
  assert.match(page, /Open Supplier Website/);
  assert.match(page, /product\.product_url/);
  assert.match(page, /create_only/);
  assert.match(page, /update_only/);
  assert.match(page, /upsert/);
  assert.match(page, /ACTIVE_SELECTION_VISIBILITIES/);
  assert.match(page, /function explicitSelectionVisibility\(product\)/);
  assert.match(page, /if \(!explicitVisibility\) return false/);
  assert.match(page, /filters\.selectionVisibility !== "all"/);
  assert.match(page, /filters\.selectionVisibility === "all" && !ACTIVE_SELECTION_VISIBILITIES\.has\(explicitVisibility\)/);
  assert.match(page, /No client-selectable products have been added yet\./);
  assert.match(page, /Add Selection Product/);
  assert.match(page, /Import Products/);
  assert.doesNotMatch(page, /View Import Instructions/);
  assert.match(page, /empty-actions/);
  assert.doesNotMatch(selectionsPanel, /SelectionProductsView/);
  assert.match(selectionsPanel, /VisualSelectionsBrowser/);
  assert.doesNotMatch(selectionsPanel, /onOpenAdmin/);
  assert.doesNotMatch(selectionsPanel, /onBackDashboard/);
  assert.doesNotMatch(selectionsPanel, /onOpenJob/);
  assert.doesNotMatch(selectionsPanel, /Search products/);
  assert.doesNotMatch(selectionsPanel, /product categories/);
  assert.doesNotMatch(selectionsPanel, /quick-row/);
  assert.doesNotMatch(selectionsPanel, /LibraryDashboard/);
  assert.doesNotMatch(selectionsPanel, /ProductLibraryFilters/);
  assert.doesNotMatch(selectionsPanel, /ProductLibraryTable/);
  assert.match(page, /PRODUCT_BROWSER_AREAS/);
  assert.match(page, /Exterior/);
  assert.match(page, /Interior/);
  assert.match(page, /Kitchen/);
  assert.match(page, /Bathroom/);
  assert.match(page, /EXTERIOR_CATEGORIES/);
  assert.match(page, /KITCHEN_CATEGORIES/);
  assert.match(page, /productCategory\("bricks", "Bricks"\)/);
  assert.match(page, /productCategory\("garage-door", "Garage Door"\)/);
  assert.match(page, /productCategory\("cabinetry", "Cabinetry"\)/);
  assert.match(page, /productCategory\("sink-mixer", "Sink Mixer"\)/);
  assert.match(page, /productCategory\("oven", "Oven"\)/);
  assert.match(page, /browserArea\("kitchen", "Kitchen", KITCHEN_CATEGORIES\)/);
  assert.match(visualBrowser, /Choose An Area/);
  assert.match(visualBrowser, /Choose An Interior Area/);
  assert.match(visualBrowser, /Choose A Category/);
  assert.match(visualBrowser, /The selected category could not be opened\./);
  assert.match(visualBrowser, /No \{category\?\.label \|\| "category"\} products have been imported yet\./);
  assert.match(visualBrowser, /data-area-key=\{selectedArea\.key\}/);
  assert.match(visualBrowser, /data-category-key=\{child\.kind === "category" \? child\.key : ""\}/);
  assert.match(visualBrowser, /data-product-type-key=\{child\.kind === "category" \? child\.productTypeKey : ""\}/);
  assert.match(visualBrowser, /data-return-route=\{selectedParent\?\.key \|\| "choose-area"\}/);
  assert.match(page, /selectedBrowserParent\?\.label \|\| "Choose Area"/);
  assert.match(page, /setSelectedAreaKey\(selectedBrowserParent\?\.key \|\| ""\)/);
  assert.match(page, /categoryTitle\(selectedCategory\)/);
  assert.match(visualBrowser, /visual-tile-image/);
  assert.doesNotMatch(visualBrowser, /brand-row/);
  assert.doesNotMatch(visualBrowser, /All Brands/);
  assert.doesNotMatch(visualBrowser, /Product Library Admin/);
  assert.doesNotMatch(visualBrowser, /<dt>Tier<\/dt>/);
  assert.doesNotMatch(visualBrowser, /Master Bedroom/);
  assert.match(adminPanel, /LibraryDashboard/);
  assert.match(adminPanel, /ProductLibraryFilters/);
  assert.match(estimatingPanel, /ProductLibraryTable/);
  assert.doesNotMatch(page, /EstimateBuilderWorkbook/);
  assert.doesNotMatch(page, /viewMode === "table" \?/);
  assert.match(toolbar, /SELECTION_VISIBILITY_VALUES/);
  assert.match(toolbar, /Manage client-selectable products, finishes and fixtures used in project inclusions and selections\./);
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
  assert.match(dashboardCards, /title: "Product Library"/);
  assert.match(dashboardCards, /subtitle: "Manage client-selectable products, finishes, fixtures, images, variants, suppliers and pricing\."/);
  assert.match(dashboardCards, /href: "\/modules\/builders\/product-library\?tab=selections"/);
  assert.match(dashboardCards, /title: "Estimating Catalogue"/);
  assert.match(dashboardCards, /subtitle: "Manage internal labour, material, BOQ and rate items used by estimating and quotations\."/);
  assert.match(dashboardCards, /page: "productLibrary"/);
  assert.equal((dashboardCards.match(/title: "Product Library"/g) ?? []).length, 1);
  assert.equal((dashboardCards.match(/title: "Estimating Catalogue"/g) ?? []).length, 1);
  assert.match(workbook, /function dashboardHrefWithProjectContext\(href, sheet, workspaceId = "", activeProjectId = ""\)/);
  assert.match(workbook, /dashboardHrefWithProjectContext\(card\.href, sheet, workspaceId, activeProjectId\)/);
  assert.match(workbook, /organisationId: workspaceId/);
  assert.match(workbook, /projectId,/);
  assert.match(workbook, /projectName: clientWorkbookDataValue\(sheet, "projectName"\)/);
  assert.match(workbook, /client: clientWorkbookDataValue\(sheet, "clientName"\)/);
  assert.match(workbook, /siteAddress: clientWorkbookDataValue\(sheet, "projectAddress"\)/);
  assert.match(workbook, /jobNumber: clientWorkbookDataValue\(sheet, "jobNumber"\)/);
  assert.match(workbook, /if \(!params\.has\(key\)\) params\.set\(key, value\)/);
  assert.match(page, /Price on Request/);
  assert.match(page, /target="_blank" rel="noopener noreferrer"/);
  assert.match(workbook, /<h2 style=\{styles\.dashboardTitle\}>Internal Estimating Catalogue<\/h2>/);
  assert.match(workbook, /Internal labour, materials, BOQ and rate items used for estimating and quotations\. These items are not available for client selections\./);
  assert.match(workbookHook, /\{ key: "productLibrary", label: "Estimating Catalogue" \}/);
  assert.doesNotMatch(workbookHook, /\{ key: "productLibrary", label: "Product Library" \}/);
  assert.doesNotMatch(dashboardCards, /\/modules\/builders\/selections-book/);
});
