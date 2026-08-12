import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildApprovedClientSelectionsCatalogue,
  classifyApprovedCatalogueRow,
  imageForFamilyKey,
  PRODUCT_ENRICHMENT_COLUMNS,
} from "../lib/product-library/catalogueModel.js";
import {
  EXTERIOR_REQUIREMENTS,
  INTERIOR_REQUIREMENTS,
  KITCHEN_REQUIREMENTS,
  PRICE_STATES,
  classifyApprovedSelectionRow,
  createSelectionPayloadFromProduct,
  guidedRequirementByKey,
  priceStateForProduct,
  productsForRequirement,
  statusForRequirement,
} from "../lib/builders/clientSelectionWorkflow.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(repoRoot, "data", "product-library", "PRODUCTS-LIBRARY.csv");
const csv = fs.readFileSync(sourcePath, "utf8");
const catalogue = buildApprovedClientSelectionsCatalogue(csv, { organisationId: "test-org" });

assert.equal(catalogue.audit.totalPhysicalRows, 746, "all physical CSV rows must be counted");
assert.equal(catalogue.audit.usableRows.length, 614, "all usable approved CSV rows must parse");
assert.ok(catalogue.audit.headingRows.length >= 29, "repeated section headings must be excluded from products");
assert.ok(catalogue.audit.identifiableProductRows.length > 200, "commercial products/models must be detected");
assert.ok(catalogue.audit.genericRows.length > 300, "generic/specification rows must be preserved");
assert.ok(catalogue.audit.rowsMissingPrice.every((row) => row.priceStatus === "price_pending" || row.priceStatus === "quote_required"), "missing prices must retain pending/quote-required states");
assert.equal(catalogue.products.length, 614, "one catalogue entity must be produced for every usable row");
assert.ok(catalogue.productFamilies.length >= 16, "approved rows must map to product families");
assert.equal(classifyApprovedCatalogueRow({ itemDescription: "FACE BRICKS - PREMIER RANGE", familyKey: "bricks" }), "allowance_specification", "brick range rows must not be actual products");
assert.equal(classifyApprovedCatalogueRow({ itemDescription: "FACE BRICKS - PREMIUM RANGE", familyKey: "bricks" }), "allowance_specification", "premium brick range rows must not be actual products");
assert.equal(classifyApprovedCatalogueRow({ itemDescription: "METAL ROOFING - COLOUR", familyKey: "metal-roofing" }), "variant", "roof colour rows must be Roofing variants");
assert.equal(classifyApprovedSelectionRow({ sourceDescription: "FACE BRICKS - PREMIER RANGE", familyKey: "bricks" }), "allowance_specification", "runtime classifier must match catalogue brick row classification");
assert.equal(classifyApprovedSelectionRow({ sourceDescription: "METAL ROOFING - COLOUR", familyKey: "metal-roofing" }), "variant", "runtime classifier must keep roof colour inside Roofing");
assert.deepEqual(PRODUCT_ENRICHMENT_COLUMNS, [
  "product_code",
  "family_key",
  "brand",
  "supplier",
  "range",
  "model",
  "product_name",
  "colour",
  "finish",
  "size",
  "primary_image_url",
  "gallery_image_urls",
  "image_source_url",
  "official_product_url",
  "specification_url",
  "current_price",
  "price_source_url",
  "price_verified_at",
  "price_status",
  "notes",
], "web enrichment template columns must remain stable");

const areas = new Map(catalogue.hierarchy.map((area) => [area.key, area]));
assert.ok(areas.has("exterior"), "hierarchy must expose Exterior");
assert.ok(areas.has("interior"), "hierarchy must expose Interior");
assert.ok(!JSON.stringify(catalogue.hierarchy).includes("Site Works"), "old estimating-only Site Works category must not reappear");
assert.ok(!JSON.stringify(catalogue.hierarchy).includes("Soil Tests"), "old estimating-only Soil Tests category must not reappear");

const ovenRequirement = KITCHEN_REQUIREMENTS.find((item) => item.requirementKey === "oven");
const garageRequirement = EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "garage-door");
const internalDoorRequirement = INTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "internal-doors");

const ovenProducts = productsForRequirement(catalogue.products, ovenRequirement);
const brickProducts = productsForRequirement(catalogue.products, EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "bricks"));
const garageProducts = productsForRequirement(catalogue.products, garageRequirement);
const internalDoorProducts = productsForRequirement(catalogue.products, internalDoorRequirement);

assert.ok(ovenProducts.length > 0, "Oven requirement must query oven products");
assert.ok(ovenProducts.every((product) => product.familyKey === "ovens"), "Oven query must not include non-oven products");
assert.ok(!brickProducts.some((product) => /FACE BRICKS - PREM(ier|ium) RANGE/i.test(product.productName || product.sourceDescription || "")), "Bricks product query must not expose allowance range rows as products");
assert.ok(garageProducts.length > 0, "Garage Door requirement must query garage-door products");
assert.ok(garageProducts.every((product) => product.familyKey === "garage-doors"), "Garage Door query must not fall back to bricks");
assert.ok(internalDoorProducts.length > 0, "Internal Doors requirement must query internal-door products");
assert.ok(internalDoorProducts.every((product) => product.familyKey === "internal-doors"), "Internal Door query must not include exterior doors");

const pendingSpecific = catalogue.products.find((product) => product.priceReviewRequired && product.productSpecific);
assert.ok(pendingSpecific, "at least one identifiable product should be pending enrichment");
assert.equal(priceStateForProduct(pendingSpecific), PRICE_STATES.pending, "unknown identifiable price must not become current $0");
assert.equal(pendingSpecific.currentPrice, null, "unknown currentPrice must be null, not zero");
assert.match(imageForFamilyKey("ovens"), /images\.unsplash\.com/, "oven missing exact image must use oven-family image");
assert.match(imageForFamilyKey("garage-doors"), /images\.unsplash\.com/, "garage door missing exact image must use garage-door image");

const selectedProduct = ovenProducts.find((product) => product.priceStatus === "current") || ovenProducts[0];
const payload = createSelectionPayloadFromProduct({
  workspaceId: "test-org",
  projectId: "project-a",
  snapshotId: "snapshot-a",
  sessionId: "session-a",
  requirement: ovenRequirement,
  product: selectedProduct,
});
assert.equal(payload.selected_details.area, "kitchen", "selection must persist area");
assert.equal(payload.selected_details.requirementKey, "oven", "selection must persist requirement");
assert.equal(payload.selected_details.productCode, selectedProduct.productCode, "selection must persist product code");
assert.equal(payload.source_quote_row_id, selectedProduct.linkedQuoteItemCode, "quote item linkage must persist");
assert.ok(["complete", "incomplete"].includes(statusForRequirement(ovenRequirement, payload)), "selection status must be derived from price state");
assert.equal(guidedRequirementByKey("garage-door").familyKey, "garage-doors", "Garage Door visible route must map to garage-door family");

console.log("Approved Client Selections catalogue import tests passed.");
