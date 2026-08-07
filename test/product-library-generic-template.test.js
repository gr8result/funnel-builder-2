import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { auditApprovedProductLibraryCsv, parseApprovedProductLibraryCsv } from "../lib/product-library/approvedCsvParser.js";
import {
  GENERIC_CATEGORY_IMAGES,
  GENERIC_DEMONSTRATION_OPTIONS,
  PRODUCT_FAMILY_TEMPLATES,
  PRODUCT_LIBRARY_CATEGORY_HIERARCHY,
  SUPPLIER_CATALOGUE_IMPORT_FIELDS,
  validateSupplierCatalogueImportRow,
} from "../lib/product-library/genericProductLibraryTemplate.js";

const csvPath = "C:\\Users\\grant\\Downloads\\PRODUCTS LIBRARY.csv";

function source(...parts) {
  return fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

test("approved Product Library CSV parses items without repeated section headers", () => {
  assert.equal(fs.existsSync(csvPath), true, "Approved CSV should be available for this audit test.");
  const csv = fs.readFileSync(csvPath, "utf8");
  const parsed = parseApprovedProductLibraryCsv(csv);
  const audit = auditApprovedProductLibraryCsv(csv);

  assert.equal(parsed.physicalRows, 748);
  assert.equal(parsed.items.length, 615);
  assert(audit.sections.length >= 21);
  assert(!parsed.items.some((item) => item.description === "ITEM" || item.unit === "UNIT"), "Repeated section headers are not product rows.");
  assert(parsed.ignoredRows.some((row) => row.reason === "section_header" && row.section === "ROOFING MATERIALS"));
  assert(parsed.items.some((item) => item.description === "ROOFING IRON" && item.stableQuotationItemCode === "SEL-EXT-ROOF-METAL"));
  assert(parsed.items.some((item) => item.description.includes("HUME") || item.sourceText.includes("HUME")));
  assert(audit.supplierSpecificRows.some((item) => /HUME/.test(item.sourceText)), "Hume rows are audited as supplier-specific evidence.");
});

test("stable generated quotation item codes are unique and source-row traceable", () => {
  const csv = fs.readFileSync(csvPath, "utf8");
  const parsed = parseApprovedProductLibraryCsv(csv);
  const codes = parsed.items.map((item) => item.stableQuotationItemCode);
  assert.equal(new Set(codes).size, codes.length);
  assert(parsed.items.every((item) => item.sourceRow > 0 && item.sourceText));
  assert(parsed.items.every((item) => item.quotationItemCode ? item.stableQuotationItemCode === item.quotationItemCode : item.stableQuotationItemCode.startsWith("SEL-")));
});

test("generic product-family templates are supplier-ready and prove four families", () => {
  const families = new Map(PRODUCT_FAMILY_TEMPLATES.map((family) => [family.productFamily, family]));
  for (const familyName of ["Stone Benchtops", "Metal Roofing", "Bricks", "Internal Doors"]) {
    const family = families.get(familyName);
    assert(family, `${familyName} family exists.`);
    assert.equal(family.supplierOptionalInStandardTemplate, true);
    assert(family.requiredAttributes.includes("supplier"));
    assert(family.requiredAttributes.some((attribute) => attribute.includes("official")));
    assert(family.allowedVariantTypes.length >= 3);
    assert(family.linkedQuotationItemCodes.every((code) => code.startsWith("SEL-")));
  }
  assert.equal(families.get("Internal Doors").topLevelArea, "Interior");
  assert.equal(families.get("Internal Doors").category, "Fix Out");
  assert(families.get("Internal Doors").sourceEvidence.some((item) => item.includes("HUME BUILDERS RANGE")));
  assert(PRODUCT_LIBRARY_CATEGORY_HIERARCHY.some((node) => node.topLevelArea === "Interior" && node.category === "Fix Out" && node.subcategories.includes("Internal Doors")));
});

test("generic images and demonstration options do not invent commercial products or prices", () => {
  for (const key of ["Stone Benchtops", "Metal Roofing", "Bricks", "Internal Doors"]) {
    assert.match(GENERIC_CATEGORY_IMAGES[key], /^\/.+\.(png|jpe?g|webp)$/i);
  }
  assert(GENERIC_DEMONSTRATION_OPTIONS.every((option) => option.label.startsWith("Demonstration Product")));
  const templateSource = source("lib", "product-library", "genericProductLibraryTemplate.js");
  assert(!templateSource.includes("Caesarstone"));
  assert(!templateSource.includes("Colorbond"));
  assert(!templateSource.includes("Hume data may"));
  assert(!templateSource.match(/rrp:\s*\d|clientPrice:\s*\d|builderCost:\s*\d/));
});

test("supplier catalogue import validates approved links before activation", () => {
  assert(SUPPLIER_CATALOGUE_IMPORT_FIELDS.includes("linked_quote_item_code"));
  assert(SUPPLIER_CATALOGUE_IMPORT_FIELDS.includes("official_product_url"));
  const approved = new Set(["SEL-KIT-BENCH-20-STANDARD"]);
  const valid = validateSupplierCatalogueImportRow({
    product_code: "BUILDER-STONE-001",
    linked_quote_item_code: "SEL-KIT-BENCH-20-STANDARD",
    product_family: "Stone Benchtops",
    product_name: "Builder-entered stone colour",
    official_product_url: "https://supplier.example/products/stone",
  }, approved);
  assert.equal(valid.ok, true);
  const invalid = validateSupplierCatalogueImportRow({ product_code: "X", linked_quote_item_code: "SEL-UNKNOWN", product_family: "Stone Benchtops", product_name: "Stone" }, approved);
  assert.equal(invalid.ok, false);
  assert(invalid.errors.includes("linked_quote_item_code must match an approved selection item"));
});

test("Product Library and Inclusions browser expose normal-user flow without admin controls", () => {
  const page = source("pages", "modules", "builders", "product-library.js");
  const modal = source("src", "modules", "inclusions-selections", "components", "ProductSelectionModal.tsx");
  const templates = source("src", "modules", "inclusions-selections", "templates", "standardAreaTemplates.ts");
  assert(page.includes("Stone Benchtops"));
  assert(page.includes("Metal Roofing"));
  assert(page.includes("Internal Doors"));
  assert(page.includes("svgTileDataUri"));
  assert(page.includes("title=\"Product Library\""));
  assert(page.includes("backLabel={browserBackLabel}"));
  assert(!page.includes("linear-gradient(135deg"));
  assert(!page.includes("PRODUCT_TYPE_IMAGE_URLS"));
  assert(page.includes("No products have been imported for this category."));
  assert(page.includes("Import Products"));
  assert(page.includes("Add Product"));
  assert(page.includes("onBack={handleBrowserBack}"));
  assert(page.includes("Choose An Area"));
  assert(page.includes("Choose A Category"));
  assert(page.includes("Step 3"));
  assert(!page.includes("brand-row"));
  assert(!page.includes("All Brands"));
  assert(modal.includes("View Official Product Page"));
  assert(modal.includes("Add To Selections"));
  assert(!modal.includes("builderCost"));
  assert(templates.includes('{ title: "Internal Door", category: "fixture", subtype: "internal_doors" }'));
});
