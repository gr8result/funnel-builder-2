// The one mapping from Product Library categories to the modules that consume them.
//
// Product Library is the canonical catalogue. Client Selections, Quotation Builder and
// BOQ/Procurement read products for these categories through this registry (see
// catalogueService.getCategoryProducts), never through their own copies of the catalogue, so a
// correctly categorised product - including one a builder imports from a supplier CSV into the
// same catalogue - appears everywhere its category is enabled without another code change.
//
// Pure data and predicates only: this module imports nothing, so catalogueService and the
// taxonomy can both depend on it without an import cycle.

const internalDoorFurniture = (product = {}) => /internal[- ]door/i.test(String(product.attributes?.handleUse || ""));

export const PRODUCT_CATEGORY_REGISTRY = Object.freeze({
  "internal-doors": Object.freeze({
    key: "internal-doors",
    label: "Internal Doors",
    familyKeys: Object.freeze(["internal-doors"]),
    clientSelectionRequirementKey: "internal-doors",
    modules: Object.freeze({ productLibrary: true, clientSelections: true, quotation: true, procurement: true }),
    // Used for a Takeoff door size until the client selects a door. Builders change it through
    // workbook.productCategoryDefaults["internal-doors"]; it is a product reference, not a copy.
    defaultProductCode: "INT-CORINTHIAN-DOORS-PMDF-HONEYCOMB-PRIMED-NONE",
  }),
  "door-furniture": Object.freeze({
    key: "door-furniture",
    label: "Door Furniture",
    familyKeys: Object.freeze(["door-hardware"]),
    matches: internalDoorFurniture,
    clientSelectionRequirementKey: "door-hardware",
    modules: Object.freeze({ productLibrary: true, clientSelections: true, quotation: true, procurement: true }),
  }),
  "cavity-sliding-door-cages": Object.freeze({
    key: "cavity-sliding-door-cages",
    label: "Cavity Sliding Door Cages",
    familyKeys: Object.freeze(["cavity-sliding-door-cages"]),
    // Framing products ordered for the build, never a client finish choice.
    modules: Object.freeze({ productLibrary: true, clientSelections: false, quotation: true, procurement: true }),
  }),
});

export const PRODUCT_CATEGORY_MODULES = Object.freeze(["productLibrary", "clientSelections", "quotation", "procurement"]);

export function productCategory(categoryKey = "") {
  return PRODUCT_CATEGORY_REGISTRY[categoryKey] || null;
}

export function productMatchesCategory(product = {}, categoryKey = "") {
  const category = productCategory(categoryKey);
  if (!category || !category.familyKeys.includes(product.familyKey)) return false;
  return category.matches ? category.matches(product) : true;
}

// The registry categories a product belongs to (a family can be shared by several categories).
export function productCategoriesForProduct(product = {}) {
  return Object.values(PRODUCT_CATEGORY_REGISTRY).filter((category) => productMatchesCategory(product, category.key));
}

export function categoryEnabledFor(categoryKey = "", module = "") {
  return productCategory(categoryKey)?.modules?.[module] === true;
}

// False only when every registry category the product belongs to is disabled for the module;
// products outside the registry are unaffected.
export function productEnabledForModule(product = {}, module = "") {
  const categories = productCategoriesForProduct(product);
  if (!categories.length) return true;
  return categories.some((category) => category.modules?.[module] === true);
}
