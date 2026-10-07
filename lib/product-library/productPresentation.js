// Product presentation helpers: labels, images, supplier grouping and area scoping.
// Extracted from pages/modules/builders/product-library.js; logic unchanged.
import { familyByKey, resolveProductLibraryImage, resolveProductPrice } from "./catalogueModel.js";
import {
  PRODUCT_LIBRARY_ROOM_CATEGORIES,
  productBelongsToRoomCategory,
  resolveQuotationBuilderMappingForProduct,
} from "./productLibraryTaxonomy.js";
import { money } from "./productLibraryFormat.js";

export function productPriceLabel(product) {
  const status = product.priceStatus || "price_pending";
  // Same resolution Client Selections and the Quotation Builder use (builder price ?? master price).
  const resolved = resolveProductPrice(product);
  if (resolved.price !== null) return resolved.size ? `${money(resolved.price)} (${resolved.size})` : money(resolved.price);
  if (status === "current") return "Price required";
  if (status === "quote_required") return "Quote required";
  if (status === "allowance_only") return "Allowance only";
  if (status === "expired") return "Price expired";
  return "Price pending";
}

// Doors are tall, narrow products: their cards use DoorProductImage (a tall frame) instead of the
// generic landscape thumbnail, so the whole door is shown large and undistorted.
const DOOR_FAMILY_KEYS = new Set(["internal-doors", "entry-doors"]);
const DOOR_REQUIREMENT_KEYS = new Set(["internal-doors", "entry-door", "entry-doors"]);

export function isDoorProduct(product = {}, requirement = null) {
  const entity = product?.metadata?.productEntity || product || {};
  const familyKey = entity.familyKey || entity.family_key || product?.familyKey || product?.family_key || "";
  return DOOR_FAMILY_KEYS.has(familyKey) || DOOR_REQUIREMENT_KEYS.has(requirement?.requirementKey || "");
}

export function productUnitLabel(product = {}) {
  return product.priceUnit || product.unit || product.uom || "EACH";
}

export function productEnabledLabel(product = {}, field = "clientSelectable") {
  const attributes = product.attributes || {};
  const value = product[field] ?? attributes[field] ?? (field === "quotationEnabled" ? true : attributes.selectableStatus !== "reference-only");
  return value === false ? "No" : "Yes";
}

export function quotationSectionLabel(product = {}) {
  const mapping = resolveQuotationBuilderMappingForProduct(product);
  return mapping.quotationSection || "Unmapped";
}

export function productCategoryLabel(product = {}) {
  if (product.sourceType === "canonical_cabinetry_workflow") return product.categoryKey;
  const category = PRODUCT_LIBRARY_ROOM_CATEGORIES.find((item) => productBelongsToRoomCategory(product, item));
  return category?.name || familyByKey(product.familyKey)?.displayName || product.category || product.categoryKey || "Uncategorised";
}

export function catalogueProductSelectionKey(product = {}) {
  return product.productId || product.productCode || product.model || product.sku || "";
}

export function masterProductsForFamily(products = [], familyItem) {
  if (!familyItem) return [];
  return products.filter((product) => product.familyKey === familyItem.familyKey);
}

export function builderEnablementForProduct(product, enablements = [], organisationId = "") {
  return enablements.find((item) => item.organisationId === organisationId && item.masterProductCode === product?.productCode) || null;
}

export function productDisplayImage(product, familyItem) {
  return resolveProductLibraryImage({ product, family: familyItem, familyKey: familyItem?.familyKey, areaKey: familyItem?.topLevelArea });
}

export function productHasVerifiedImage(product = {}) {
  const image = product.primaryImage || product.primaryImageUrl || product.primary_image || product.primary_image_url || "";
  const status = String(product.imageStatus || product.image_status || "").toLowerCase();
  if (!image) return false;
  if (/unavailable|missing|pending|review|required/.test(status)) return false;
  return /verified|exact|official/.test(status);
}

export function productVerifiedImage(product = {}) {
  return productHasVerifiedImage(product) ? (product.primaryImage || product.primaryImageUrl || product.primary_image || product.primary_image_url) : "";
}

export function supplierNameForProduct(product) {
  return product.supplier || product.manufacturer || product.brand || "Unassigned Supplier";
}

export function rangeNameForProduct(product) {
  return product.range || product.collection || product.profile || "Unassigned Range";
}

export function groupedSupplierHierarchy(products = [], familyItem = null, enablements = [], organisationId = "") {
  const suppliers = new Map();
  products.forEach((product) => {
    const supplierName = supplierNameForProduct(product);
    const rangeName = rangeNameForProduct(product);
    if (!suppliers.has(supplierName)) {
      suppliers.set(supplierName, { name: supplierName, products: [], ranges: new Map(), enabled: 0 });
    }
    const supplier = suppliers.get(supplierName);
    const enabled = Boolean(builderEnablementForProduct(product, enablements, organisationId)?.enabled);
    supplier.products.push(product);
    if (enabled) supplier.enabled += 1;
    if (!supplier.ranges.has(rangeName)) {
      supplier.ranges.set(rangeName, { name: rangeName, products: [], enabled: 0, image: productDisplayImage(product, familyItem) });
    }
    const range = supplier.ranges.get(rangeName);
    range.products.push(product);
    if (enabled) range.enabled += 1;
    if (!range.image) range.image = productDisplayImage(product, familyItem);
  });
  return Array.from(suppliers.values()).map((supplier) => ({
    ...supplier,
    image: productDisplayImage(supplier.products[0], familyItem),
    ranges: Array.from(supplier.ranges.values()).sort((left, right) => left.name.localeCompare(right.name)),
  })).sort((left, right) => left.name.localeCompare(right.name));
}

export function categoryBelongsToArea(categoryItem, areaKey) {
  if (areaKey === "exterior") return categoryItem.topLevelArea === "exterior";
  if (areaKey === "interior") return categoryItem.topLevelArea !== "exterior";
  return categoryItem.topLevelArea === areaKey;
}

export function familyBelongsToArea(familyItem, areaKey) {
  if (areaKey === "exterior") return familyItem.topLevelArea === "exterior";
  if (areaKey === "kitchen") {
    const kitchenFamilyKeys = new Set([
      "cabinetry",
      "cabinet-finish",
      "handles",
      "stone-benchtops",
      "stone-20mm-tops",
      "stone-40mm-tops",
      "splashback",
      "kitchen-sinks",
      "kitchen-sink-mixers",
      "ovens",
      "cooktops",
      "rangehoods",
      "dishwashers",
      "microwaves",
      "flooring",
      "lighting",
      "paint",
    ]);
    return familyItem.topLevelArea === "kitchen" || kitchenFamilyKeys.has(familyItem.familyKey);
  }
  if (areaKey === "interior") return familyItem.topLevelArea !== "exterior";
  return familyItem.topLevelArea === areaKey;
}
