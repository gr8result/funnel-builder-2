// Internal Doors discovery: DOOR TYPE first, then products, then supplier.
//
// The catalogue is never listed by supplier or alphabetically. Every door is given a type from the
// Product Library's own data (range, glazing), types are ordered by an explicit priority - Flush
// Panel, the standard door on most houses, is always first - and the query filters by type, orders
// by standard / priority, and only then paginates, so the standard doors always start on page 1.
//
// Nothing here names an individual product. A product can carry its own metadata, which wins over
// what is derived: doorType, isStandard, isPopular, displayPriority (top level or in attributes).

export const INTERNAL_DOOR_FAMILY = "internal-doors";
export const ALL_DOOR_TYPES = "all";

// priority: lower shows first. standard: the type's products are flagged as standard inclusions.
export const INTERNAL_DOOR_TYPES = Object.freeze([
  { key: "flush", label: "Flush Panel", priority: 1, standard: true, description: "Plain flat-faced doors - the standard internal door." },
  { key: "moulded", label: "Moulded Panel", priority: 2, description: "Pressed panel designs." },
  { key: "routed", label: "Routed / Feature", priority: 3, description: "Routed, grooved and stile-and-rail feature doors." },
  { key: "glazed", label: "Glass / Glazed", priority: 4, description: "Doors with glass panels." },
  { key: "barn", label: "Barn / Sliding", priority: 5, description: "Face-mounted sliding barn doors." },
  { key: "other", label: "Other Internal Doors", priority: 6, description: "Joinery and other internal doors." },
]);
const TYPE_BY_KEY = new Map(INTERNAL_DOOR_TYPES.map((type) => [type.key, type]));
export const internalDoorType = (key) => TYPE_BY_KEY.get(key) || TYPE_BY_KEY.get("other");

// Which type a manufacturer RANGE is. Ranges, not products: a new door in a listed range is typed
// automatically, and a range not listed here lands in Other rather than being hidden.
export const INTERNAL_DOOR_RANGE_TYPES = Object.freeze([
  [/flush/i, "flush"],
  [/barn/i, "barn"],
  [/moulded panel|impressions|madison/i, "moulded"],
  [/deco|moda|manhattan|balmoral|motive|roma|allure|bayview|humecraft|accent|hampton|linear|strata|luxe|sorrento/i, "routed"],
]);
const GLASS = /clear|translucent|cathedral|tint|reeded|narrow lines|frost|glaz|rice paper|laminate/i;

const entityOf = (product = {}) => product.metadata?.productEntity || product;
const attributesOf = (product = {}) => entityOf(product).attributes || product.attributes || {};
const meta = (product, key) => entityOf(product)[key] ?? attributesOf(product)[key] ?? product[key];

export function isGlazedDoor(product = {}) {
  const options = attributesOf(product).glazingOptions || [];
  return options.length > 0 && !options.includes("None") && options.some((option) => GLASS.test(option));
}

export function classifyInternalDoor(product = {}) {
  const declared = String(meta(product, "doorType") || "").toLowerCase();
  if (TYPE_BY_KEY.has(declared)) return declared;
  const entity = entityOf(product);
  const range = `${entity.range || product.range || ""} ${entity.productName || product.productName || ""}`;
  const byRange = INTERNAL_DOOR_RANGE_TYPES.find(([pattern]) => pattern.test(range))?.[1] || "other";
  // A flush or barn door stays what it is; any other door with glass in it is a glazed door.
  if (byRange !== "flush" && byRange !== "barn" && isGlazedDoor(product)) return "glazed";
  return byRange;
}

// Hollow core / solid core, in the words builders search with, from the supplier's construction text.
export function doorCore(product = {}) {
  const text = `${attributesOf(product).construction || ""} ${attributesOf(product).constructionDescription || ""}`.toLowerCase();
  if (/honeycomb|hollow ?core|lightweight/.test(text)) return "hollow core";
  if (/solid|ultima|infill/.test(text)) return "solid core";
  return "";
}

export function internalDoorMeta(product = {}) {
  const typeKey = classifyInternalDoor(product);
  const type = internalDoorType(typeKey);
  const declaredPriority = Number(meta(product, "displayPriority"));
  const declaredStandard = meta(product, "isStandard");
  return {
    typeKey,
    typeLabel: type.label,
    core: doorCore(product),
    isStandard: typeof declaredStandard === "boolean" ? declaredStandard : Boolean(type.standard),
    isPopular: meta(product, "isPopular") === true,
    displayPriority: Number.isFinite(declaredPriority) && declaredPriority > 0 ? declaredPriority : type.priority,
  };
}

// Lowest published price across a door's sizes (or its single price); null when it is quote-only.
export function doorFromPrice(product = {}) {
  const prices = (attributesOf(product).sizePrices || []).map((entry) => Number(entry.price)).filter((value) => value > 0);
  const single = Number(product.selectedCost ?? entityOf(product).clientPrice ?? entityOf(product).rrp);
  if (prices.length) return Math.min(...prices);
  return Number.isFinite(single) && single > 0 ? single : null;
}

const norm = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Everything a door can be found by, including the type name and the core in builders' wording,
// so "flush door", "internal flush", "hollow core" and "solid core" work whatever the supplier calls it.
export function internalDoorSearchText(product = {}) {
  const entity = entityOf(product);
  const info = internalDoorMeta(product);
  const attributes = attributesOf(product);
  return norm([
    entity.productName, entity.brand, entity.range, entity.model, entity.finish, entity.description, attributes.design, attributes.construction, attributes.constructionDescription,
    info.typeLabel, info.typeKey, info.core, info.core.replace(" ", ""), info.isStandard ? "standard common" : "", "internal interior door doors panel",
  ].join(" "));
}
export function matchesDoorSearch(product, search = "") {
  // "solid core" / "hollow core" are one idea: matched against the door's derived core, not against
  // the words "solid" and "core" scattered through a supplier description.
  const terms = norm(search).replace(/hollow ?core/g, "hollowcore").replace(/solid ?core/g, "solidcore").split(" ").filter(Boolean);
  if (!terms.length) return true;
  const text = ` ${internalDoorSearchText(product)} `;
  return terms.every((term) => text.includes(` ${term}`));
}

// Standard first, then explicit priority, popular, paint-grade hollow core before the upgrades,
// then name. Never alphabetical-first, never supplier-first.
function compareDoors(left, right) {
  const a = internalDoorMeta(left);
  const b = internalDoorMeta(right);
  const grade = (product, info) => (/veneer|oak|timber|merbau|blackbutt/i.test(`${entityOf(product).finish} ${attributesOf(product).construction}`) ? 2 : 0) + (info.core === "hollow core" ? 0 : 1);
  return a.displayPriority - b.displayPriority
    || Number(b.isStandard) - Number(a.isStandard)
    || Number(b.isPopular) - Number(a.isPopular)
    || grade(left, a) - grade(right, b)
    || String(entityOf(left).productName).localeCompare(String(entityOf(right).productName), undefined, { numeric: true })
    || String(entityOf(left).brand).localeCompare(String(entityOf(right).brand));
}

export function internalDoorSizes(products = []) {
  return [...new Set(products.flatMap((product) => attributesOf(product).sizeOptions || []))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

// The one query the picker uses: 1. filter (type, supplier, size, search)  2. standard / priority
// order  3. secondary sort  4. paginate.
export function queryInternalDoors(products = [], { type = "flush", suppliers = [], size = "", search = "", sort = "", page = 0, pageSize = 24 } = {}) {
  const searching = norm(search).length > 0;
  const base = products.filter((product) => matchesDoorSearch(product, search)
    && (!suppliers.length || suppliers.includes(entityOf(product).brand || product.brand))
    && (!size || (attributesOf(product).sizeOptions || []).includes(size)));
  // Counts per type for the filters applied, so the type list only offers types that have doors.
  const counts = new Map();
  base.forEach((product) => { const key = classifyInternalDoor(product); counts.set(key, (counts.get(key) || 0) + 1); });
  const types = INTERNAL_DOOR_TYPES.filter((item) => counts.get(item.key)).map((item) => ({ ...item, count: counts.get(item.key) }));
  // The default type falls back to the first type that has doors (a library with no flush doors).
  const activeType = type === ALL_DOOR_TYPES ? ALL_DOOR_TYPES : counts.get(type) ? type : searching ? ALL_DOOR_TYPES : types[0]?.key || ALL_DOOR_TYPES;
  const matched = base.filter((product) => activeType === ALL_DOOR_TYPES || classifyInternalDoor(product) === activeType).sort(compareDoors);
  if (sort === "price-asc" || sort === "price-desc") {
    const direction = sort === "price-asc" ? 1 : -1;
    matched.sort((left, right) => {
      const a = doorFromPrice(left);
      const b = doorFromPrice(right);
      if (a === null || b === null) return Number(a === null) - Number(b === null);
      return (a - b) * direction;
    });
  }
  const pages = Math.max(1, Math.ceil(matched.length / pageSize));
  const current = Math.min(Math.max(0, page), pages - 1);
  return { activeType, types, total: matched.length, allTotal: base.length, pages, page: current, items: matched.slice(current * pageSize, current * pageSize + pageSize) };
}
