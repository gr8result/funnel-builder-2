// Shared, structured catalogue discovery. Descriptions and supplier URLs are deliberately
// not taxonomy: a mixer description mentioning matching towel rails must not become a rail.
export function normalizeProductType(value = "") {
  return String(value).replace(/([a-z])([A-Z])/g, "$1 $2").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/([a-z])['’]s\b/g, "$1").replace(/[^a-z0-9]+/g, " ").trim()
    .split(/\s+/).map((word) => ({ shelves: "shelf", accessories: "accessory", caddies: "caddy", brushes: "brush", dishes: "dish" }[word]
      || (word.endsWith("s") && !/(ss|us)$/.test(word) ? word.slice(0, -1) : word))).join(" ");
}

function values(value) {
  if (Array.isArray(value)) return value.flatMap(values);
  if (value && typeof value === "object") return [value.name, value.label, value.key, value.value].flatMap(values);
  return value == null || value === "" ? [] : [String(value)];
}

export function productClassification(product = {}) {
  const entity = product.metadata?.productEntity || {};
  const sources = [product, product.attributes, product.metadata, entity, entity.attributes].filter(Boolean);
  const read = (keys) => [...new Set(sources.flatMap((source) => keys.flatMap((key) => values(source[key]))))];
  return {
    types: read(["productType", "product_type", "subcategory", "subCategory", "sub_category", "subcategoryKey", "hncSubCategory", "type"]),
    categories: read(["category", "categoryKey", "category_key", "categories", "categoryPath", "category_path", "familyKey", "family_key", "plumbingCategoryKey"]),
    tags: read(["tags", "requirementKeys", "requirement_keys", "clientSelectionRequirement"]),
    rooms: read(["topLevelArea", "top_level_area", "applicableRooms", "compatibleAreaTypes"]),
    name: product.productName || product.product_name || entity.productName || "",
  };
}

export function isSelectableDiscoveryProduct(product = {}) {
  return product.active !== false && product.enabled !== false && !product.archived && !product.discontinued;
}

export function matchesSelectionProductType(product, aliases = []) {
  const classification = productClassification(product);
  const expected = new Set(aliases.filter(Boolean).map(normalizeProductType));
  return isSelectableDiscoveryProduct(product)
    && [...classification.types, ...classification.tags].some((value) => expected.has(normalizeProductType(value)));
}

export function indexSelectionProductTypes(products = []) {
  const index = new Map();
  for (const product of products) {
    if (!isSelectableDiscoveryProduct(product)) continue;
    const classification = productClassification(product);
    for (const key of new Set([...classification.types, ...classification.tags].map(normalizeProductType).filter(Boolean))) {
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(product);
    }
  }
  return index;
}

// Every card and its product query share this grouping, including de-duplication and order.
// A classifier may return a new type discovered from library metadata; no registry entry needed.
export function discoverProductTypes(products, classify) {
  const groups = new Map();
  for (const product of products) {
    if (!isSelectableDiscoveryProduct(product)) continue;
    const type = classify(product);
    if (!type) continue;
    if (!groups.has(type.key)) groups.set(type.key, { ...type, products: [], identities: new Set() });
    const group = groups.get(type.key);
    const identity = product.productCode || product.product_code || product.productId || product.id || product;
    if (group.identities.has(identity)) continue;
    group.identities.add(identity);
    group.products.push(product);
  }
  return [...groups.values()].sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000) || a.label.localeCompare(b.label))
    .map(({ identities, ...group }) => group);
}
