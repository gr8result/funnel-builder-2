import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PRODUCT_LIBRARY_ROOMS,
  PRODUCT_LIBRARY_ROOM_CATEGORIES,
  PRODUCT_LIBRARY_CATALOGUE_SECTIONS,
  getProductLibraryRoomCategories,
  productBelongsToRoom,
  productBelongsToRoomCategory,
  resolveProductLibrarySectionForQuotationRow,
} from "../lib/product-library/productLibraryTaxonomy.js";
import { getMasterProducts } from "../lib/product-library/catalogueService.js";
import { PRODUCT_LIBRARY_IMPORT_COLUMNS } from "../lib/product-library/catalogueModel.js";
import {
  getApplianceBrands,
  getAppliancePacks,
  getPlatformMasterApplianceRecords,
} from "../lib/product-library/applianceCatalogueSelectors.js";

const ROOT = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

const requiredSections = [
  "Appliances",
  "Cabinetry & Joinery",
  "Benchtops & Surfaces",
  "Plumbing Fixtures & Fittings",
  "Electrical Fixtures & Fittings",
  "Windows & External Doors",
  "Internal Doors & Door Hardware",
  "Roofing & Rainwater Goods",
  "Wall & Ceiling Finishes",
  "Flooring",
  "Tiles",
  "Paint Products & Colours",
  "Fix Out",
  "External Products",
];

const requiredRooms = [
  "Kitchen",
  "Butler's Pantry",
  "Bathroom",
  "Ensuite",
  "Powder Room",
  "Laundry",
  "Living Areas",
  "Bedrooms",
  "Internal Areas",
  "Exterior",
  "Garage",
  "Alfresco & Outdoor",
];

assert.deepEqual(
  PRODUCT_LIBRARY_ROOMS.map((room) => room.name),
  requiredRooms,
  "Product Library default taxonomy must be the approved room/area list"
);
PRODUCT_LIBRARY_ROOMS.forEach((room) => {
  assert.ok(room.id && room.slug && room.heroImage && room.active === true, `${room.name} must have stable room metadata`);
});
assert.ok(getProductLibraryRoomCategories("kitchen").some((category) => category.name === "Ovens"), "Kitchen must show ovens");
assert.ok(getProductLibraryRoomCategories("kitchen").some((category) => category.name === "Appliance Packages"), "Kitchen must show appliance packages");
assert.ok(getProductLibraryRoomCategories("bathroom").some((category) => category.name === "Basin Mixers"), "Bathroom must show basin mixers");
assert.ok(getProductLibraryRoomCategories("bathroom").some((category) => category.name === "Tapware"), "Bathroom must show tapware");
assert.ok(getProductLibraryRoomCategories("laundry").some((category) => category.name === "Laundry Tubs"), "Laundry must show laundry tubs");
assert.ok(getProductLibraryRoomCategories("internal-areas").some((category) => category.name === "Internal Doors"), "Internal Areas must show internal doors");
assert.ok(PRODUCT_LIBRARY_ROOM_CATEGORIES.every((category) => category.id && category.slug && category.representativeImage && Array.isArray(category.applicableRoomIds) && Array.isArray(category.familyKeys)), "Room categories must carry stable category metadata");
[
  "applicable_room_ids",
  "applicable_room_slugs",
  "category_ids",
  "category_slugs",
  "brand_logo_url",
  "wels_rating",
  "wels_registration",
  "warranty",
  "package_id",
  "package_name",
  "package_price",
  "package_component_ids",
  "package_component_models",
].forEach((column) => assert.ok(PRODUCT_LIBRARY_IMPORT_COLUMNS.includes(column), `Master import schema must support ${column}`));
const importTemplateHeader = read("PRODUCT_LIBRARY_IMPORT_TEMPLATE.csv").split(/\r?\n/)[0].split(",");
["applicable_room_ids", "category_ids", "brand_logo_url", "wels_rating", "warranty", "package_component_ids"].forEach((column) => {
  assert.ok(importTemplateHeader.includes(column), `CSV/XLSX import template must support ${column}`);
});

assert.deepEqual(
  PRODUCT_LIBRARY_CATALOGUE_SECTIONS.map((section) => section.displayName),
  requiredSections,
  "Browse All Products must retain the approved physical-product catalogue sections"
);

assert.equal(resolveProductLibrarySectionForQuotationRow({ category_id: "category:plumbing-fixtures", current_description: "Basin mixer" }), "plumbing-fixtures-fittings");
assert.equal(resolveProductLibrarySectionForQuotationRow({ current_description: "Internal doors and architraves" }), "internal-doors-hardware");
assert.equal(resolveProductLibrarySectionForQuotationRow({ current_description: "Skirting fix out" }), "fix-out");
assert.equal(resolveProductLibrarySectionForQuotationRow({ current_description: "900mm Smeg gas cooktop" }), "appliances");

const products = getPlatformMasterApplianceRecords();
const packs = getAppliancePacks();
const brands = getApplianceBrands();
const masterProducts = getMasterProducts();
const rawPackCatalogue = JSON.parse(read("data/product-library/catalogues/appliances/AU-APPLIANCE-PACKS.json"));
assert.equal(products.length, 83, "Checkpoint A appliance products must remain 83 canonical records");
assert.equal(packs.length, 35, "Checkpoint A appliance packages must remain 35 canonical packages");
assert.equal(rawPackCatalogue.packs.reduce((total, pack) => total + (pack.componentRelationships || []).length, 0), 159, "Canonical pack JSON must preserve 159 component relationships");
assert.equal(packs.reduce((total, pack) => total + (pack.components || []).length, 0), 159, "Selectors must expose the full package component relationship list");
assert.equal(products.filter((product) => product.primaryImage && product.imageStatus === "verified-official-remote-reference").length, 18, "Product Library owner JSON must expose verified official remote image references where discovered");
const wveOven = masterProducts.find((product) => product.productId === "product:appliances:ovens:westinghouse:wve6314dd");
assert.ok(wveOven, "Westinghouse oven must be available through canonical master products");
assert.equal(productBelongsToRoom(wveOven, "kitchen"), true, "Kitchen appliance must be room-browsable without a duplicate record");
assert.equal(productBelongsToRoom(wveOven, "butlers-pantry"), true, "A product can belong to multiple rooms by reference");
const kitchenOvens = PRODUCT_LIBRARY_ROOM_CATEGORIES.find((category) => category.key === "kitchen-ovens");
assert.equal(productBelongsToRoomCategory(wveOven, kitchenOvens), true, "Oven product must be accessible through Kitchen > Ovens");
assert.deepEqual(brands.map((brand) => brand.brandName), ["Ariston", "Blanco", "Euromaid", "Omega", "Smeg", "Westinghouse"]);
brands.forEach((brand) => {
  assert.ok(brand.logoUrl, `${brand.brandName} needs a real logo URL`);
  assert.notEqual(brand.logoStatus, "missing", `${brand.brandName} logo must not be initials-only`);
});

[
  "public/images/catalogues/appliances/fallbacks/appliance-pack.svg",
  "public/images/catalogues/appliances/fallbacks/oven.svg",
  "public/images/catalogues/appliances/fallbacks/cooktop.svg",
  "public/images/catalogues/appliances/fallbacks/rangehood.svg",
  "public/images/catalogues/appliances/fallbacks/dishwasher.svg",
  "public/images/catalogues/appliances/fallbacks/freestanding-cooker.svg",
  "public/images/catalogues/appliances/fallbacks/generic.svg",
].forEach((relativePath) => assert.ok(exists(relativePath), `${relativePath} must exist`));

const productLibraryPage = read("pages/modules/builders/product-library.js");
assert.match(productLibraryPage, /data-testid="product-library-room-landing"/, "Product Library page must default to Browse by Room");
assert.match(productLibraryPage, /Browse by Room/, "Browse by Room mode must be visible");
assert.match(productLibraryPage, /Browse All Products/, "Browse All Products mode must be visible");
assert.match(productLibraryPage, /data-testid="product-library-room-page"/, "Room pages must render");
assert.match(productLibraryPage, /data-testid="product-library-category-page"/, "Room category pages must render");
assert.match(productLibraryPage, /data-testid="product-library-product-detail"/, "Product detail pages must render");
assert.match(productLibraryPage, /PRODUCT_LIBRARY_CATALOGUE_SECTIONS/, "Product Library page must render the physical-product catalogue section layer");
assert.match(productLibraryPage, /data-testid="appliance-brand-list"/, "Appliances page must render brand cards first");
assert.match(productLibraryPage, /data-appliance-size-group/, "Brand page must group products by size/configuration");
assert.match(productLibraryPage, /data-testid="appliance-package-card"/, "Brand page must show package cards");
assert.match(productLibraryPage, /data-testid="appliance-product-packages"/, "Product detail page must show packages containing the product");
assert.doesNotMatch(productLibraryPage, /PRODUCT_LIBRARY_HOME_AREAS/, "Rejected room-based landing helper must not be used");

const selectionsBook = read("pages/modules/builders/selections-book.js");
assert.doesNotMatch(selectionsBook, /AU-APPLIANCE-CATALOGUE\.json|AU-APPLIANCE-PACKS\.json|AU-APPLIANCE-BRANDS\.json/, "Client Selections must not own or import canonical appliance JSON files");

const estimateWorkbook = read("components/estimate-builder/EstimateBuilderWorkbook.js");
assert.doesNotMatch(estimateWorkbook, /AU-APPLIANCE-CATALOGUE\.json|AU-APPLIANCE-PACKS\.json|AU-APPLIANCE-BRANDS\.json/, "Quotation/Estimate builder must not own or import canonical appliance JSON files");

console.log("Product Library Checkpoint A correction tests passed.");
