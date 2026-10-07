// Client Selections > Shower Screens & Mirrors: configured, made-to-measure selections.
//
// The products are Product Library records (AU-SHOWER-SCREENS-MIRRORS-CATALOGUE.json, built by
// scripts/import-shower-screens-mirrors.mjs) reached through catalogueService by their
// clientSelectionRequirement tag. Nothing here names a supplier or a product: groups, filters,
// options, sizes and prices are all read from each record's attributes (selectionFacets,
// specifications, configurator), so importing another supplier's catalogue needs no change here.
//
// A selection is one CONFIGURED LINE per room - supplier, range, type, configuration, width,
// height, glass, finish, quantity, allowance and the quoted / selected price - stored as an ordinary
// allocation line (plumbingFixtureAllocation.js). Two showers are therefore two lines that can hold
// different products, and totals, variations, the Quotation Builder and Procurement all come from
// the existing allocation engine (allocatedSelectionQuotation.js) - there is no second pricing path.

import { numberValue, roundMoney } from "../builders/selectionBudget.js";
import { plumbingLineWithTotals, plumbingLocationKey, plumbingLocationType } from "../builders/plumbingFixtureAllocation.js";

export const CONFIGURED_SELECTION_AREA_KEY = "shower-screens-mirrors";
export const QUOTE_REQUIRED_LABEL = "Supplier Quote Required";
export const SUPPLIER_QUOTE_PRICE_BASIS = "Supplier quote inc GST";

export function isConfiguredSelectionRequirement(requirement = {}) {
  return requirement?.areaKey === CONFIGURED_SELECTION_AREA_KEY;
}

// First-level groups per requirement: which facet splits the range, and the wording of each card.
// Group VALUES are discovered from the catalogue; only their order and labels are defined here.
const GROUPING = {
  "shower-screen": {
    heading: "Shower Screens",
    facet: "Screen Type",
    order: ["Framed", "Semi-Frameless", "Frameless"],
    label: (value) => (value === "Frameless" ? "Full Frameless Shower Screens" : `${value} Shower Screens`),
  },
  mirror: { heading: "Mirrors", facet: "Mirror Type", order: ["Frameless Mirrors", "Framed Mirrors", "Shaped Mirrors"], label: (value) => value },
  "shaving-cabinet": { heading: "Shaving Cabinets", facet: "", order: [], label: () => "Shaving Cabinets" },
};

const attributesOf = (product = {}) => product.attributes || product.metadata?.productEntity?.attributes || {};
const list = (value) => (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);
const unique = (values = []) => Array.from(new Set(values.filter(Boolean)));

export function productFacetValues(product = {}, facet = "") {
  return list(attributesOf(product).selectionFacets?.[facet]);
}

// Products already in the Product Library without the grouping facet (the Harvey Norman Commercial
// mirror range) stay selectable in their own "Other" group - never dropped, never re-imported.
export const OTHER_GROUP_VALUE = "Other";

export function productGroupValue(requirementKey = "", product = {}) {
  const grouping = GROUPING[requirementKey];
  if (!grouping?.facet) return "";
  return productFacetValues(product, grouping.facet)[0] || OTHER_GROUP_VALUE;
}

// { heading, groups: [{ key, label, facet, value, count, suppliers, imageUrl, imageAlt }] }
export function selectionGroupsForRequirement(requirementKey = "", products = []) {
  const grouping = GROUPING[requirementKey];
  if (!grouping) return { heading: "", groups: [] };
  const build = (value, members) => {
    const hero = members.find((product) => product.primaryImageUrl || product.imageUrl);
    return {
      key: `${requirementKey}:${value || "all"}`,
      requirementKey,
      label: value === OTHER_GROUP_VALUE ? `Other ${grouping.heading}` : grouping.label(value),
      facet: grouping.facet,
      value,
      count: members.length,
      suppliers: unique(members.map((product) => product.supplier || product.brand)).sort(),
      configurations: unique(members.flatMap((product) => productFacetValues(product, "Configuration"))),
      imageUrl: hero?.primaryImageUrl || hero?.imageUrl || "",
      imageAlt: hero ? `${hero.supplier || hero.brand} ${hero.productName}` : "",
    };
  };
  if (!grouping.facet) return { heading: grouping.heading, groups: products.length ? [build("", products)] : [] };
  const values = unique(products.map((product) => productGroupValue(requirementKey, product)));
  const rank = (value) => (value === OTHER_GROUP_VALUE ? grouping.order.length + 1 : grouping.order.includes(value) ? grouping.order.indexOf(value) : grouping.order.length);
  return {
    heading: grouping.heading,
    groups: values
      .sort((left, right) => rank(left) - rank(right) || left.localeCompare(right))
      .map((value) => build(value, products.filter((product) => productGroupValue(requirementKey, product) === value))),
  };
}

// ---------------------------------------------------------------------------------------------
// Project quantity: the showers this job actually has. AI Plan Takeoff counts fixtures per room
// ("Shower - Ensuite"); a bathroom without a shower is never assumed to have one. Returns null when
// the project has no fixture takeoff, and the category then keeps the manual path.
// ---------------------------------------------------------------------------------------------
const TAKEOFF_FIXTURE_TYPES = { "shower-screen": "Shower" };

export function projectFixtureRequirement(requirementKey = "", workbook = {}) {
  const fixtureType = TAKEOFF_FIXTURE_TYPES[requirementKey];
  if (!fixtureType) return null;
  const job = workbook?.aiPlanTakeoffJob || workbook?.takeoffEngine?.aiPlanTakeoffJob || null;
  const analysis = job?.aiAnalysis || job?.scheduleState?.aiAnalysis || null;
  // Same acceptance rule as the Takeoff Schedule's Custom Takeoffs rows (scheduleEvidence.js).
  const fixtures = (Array.isArray(analysis?.fixtures) ? analysis.fixtures : [])
    .filter((item) => item?.type === fixtureType && item.basis !== "ASSUMED" && !(Number(item.confidence) < 0.5) && Number(item.quantity) > 0);
  if (!fixtures.length) return null;
  const byRoom = new Map();
  fixtures.forEach((item) => {
    const room = String(item.room || "").trim() || "Room not named on plan";
    byRoom.set(room, (byRoom.get(room) || 0) + Math.round(Number(item.quantity)));
  });
  const rooms = Array.from(byRoom, ([room, quantity]) => ({ room, quantity }));
  return {
    quantity: rooms.reduce((total, item) => total + item.quantity, 0),
    rooms,
    source: "AI Plan Takeoff fixtures",
    label: rooms.map((item) => `${item.quantity} x ${item.room} ${fixtureType.toLowerCase()}`).join(", "),
  };
}

// Locations offered for a selection. Nothing here is a fixed list: every entry is a physical project
// location (projectLocations.js) or a room the takeoff found the fixture in.
//   primary - where this product belongs: for shower screens, the rooms the takeoff shows a shower
//             in; with no fixture takeoff, the project's rooms of the relevant type
//   other   - the project's remaining rooms of the relevant type (a bathroom whose shower the takeoff
//             did not find), offered behind "Other project locations" - never pre-listed
// A room that already holds a saved line is always kept so it stays editable.
const ROOM_TYPES = { "shower-screen": ["bathroom", "ensuite"], mirror: ["bathroom", "ensuite", "powder-room", "wc"], "shaving-cabinet": ["bathroom", "ensuite", "powder-room"] };

export function configuredSelectionLocations(requirementKey = "", locations = [], required = null, lines = []) {
  const types = ROOM_TYPES[requirementKey] || [];
  const byKey = new Map(locations.map((location) => [location.key, location]));
  const seen = new Set();
  const entry = (name, source, quantity = null) => {
    const label = String(name || "").trim();
    const key = plumbingLocationKey(label);
    if (!label || !key || seen.has(key)) return null;
    seen.add(key);
    const known = byKey.get(key);
    return { id: known?.id || `location-${key}`, key, label: known?.name || label, type: known?.type || plumbingLocationType(label), source, ...(quantity ? { requiredQuantity: quantity } : {}) };
  };
  const fixtureRooms = (required?.rooms || []).filter((item) => item.room !== "Room not named on plan");
  const relevant = locations.filter((location) => types.includes(location.type));
  const primary = fixtureRooms.length
    ? fixtureRooms.map((item) => entry(item.room, "takeoff-fixture", item.quantity))
    : relevant.map((location) => entry(location.name, location.source));
  const saved = lines.flatMap((line) => (line.allocations || []).map((allocation) => entry(allocation.location, "saved")));
  const other = fixtureRooms.length ? relevant.map((location) => entry(location.name, location.source)) : [];
  return { primary: [...primary, ...saved].filter(Boolean), other: other.filter(Boolean), basis: fixtureRooms.length ? required.source : "project rooms" };
}

// ---------------------------------------------------------------------------------------------
// Configurator: options, variants and size rules exactly as the supplier publishes them.
// ---------------------------------------------------------------------------------------------
export function productConfigurator(product = {}) {
  const configurator = attributesOf(product).configurator || {};
  return {
    madeToMeasure: Boolean(configurator.madeToMeasure),
    priceMode: configurator.priceMode || "supplier-quote",
    options: Array.isArray(configurator.options) ? configurator.options.filter((option) => option.values?.length) : [],
    dimensions: configurator.dimensions || null,
    variants: Array.isArray(configurator.variants) ? configurator.variants : [],
  };
}

// Values still available for one option given the other choices (a size not made in a finish).
export function availableOptionValues(product = {}, optionKey = "", selected = {}) {
  const { options, variants } = productConfigurator(product);
  const option = options.find((item) => item.key === optionKey);
  if (!option) return [];
  if (!variants.length) return option.values;
  const others = Object.entries(selected).filter(([key, value]) => key !== optionKey && value);
  return option.values.filter((value) => variants.some((variant) => variant.options?.[optionKey] === value && others.every(([key, chosen]) => variant.options?.[key] === chosen)));
}

// The supplier SKU for a complete set of choices, or null until every option is chosen.
export function variantForOptions(product = {}, selected = {}) {
  const { options, variants } = productConfigurator(product);
  if (!variants.length || options.some((option) => !selected[option.key])) return null;
  return variants.find((variant) => options.every((option) => variant.options?.[option.key] === selected[option.key])) || null;
}

export function dimensionProblems(product = {}, { widthMm, heightMm, depthMm } = {}) {
  const { madeToMeasure, dimensions } = productConfigurator(product);
  if (!madeToMeasure) return [];
  const problems = [];
  const check = (label, value, rule, required) => {
    const amount = numberValue(value);
    if (!amount) { if (required) problems.push(`${label} is required for a made-to-measure quote.`); return; }
    if (rule?.maxMm && amount > rule.maxMm) problems.push(`${label} ${amount}mm exceeds the supplier maximum of ${rule.maxMm}mm.`);
  };
  check("Width", widthMm, dimensions?.width, true);
  check("Height", heightMm, dimensions?.height, true);
  if (dimensions?.depth) check("Depth / return", depthMm, dimensions.depth, false);
  return problems;
}

export function configuredLineSpecification(line = {}) {
  const config = line.configuration || {};
  const size = [config.widthMm ? `W ${config.widthMm}mm` : "", config.heightMm ? `H ${config.heightMm}mm` : "", config.depthMm ? `D ${config.depthMm}mm` : ""].filter(Boolean).join(" x ");
  return [
    config.type,
    config.configuration,
    size || config.size,
    config.glass ? `Glass: ${config.glass}` : "",
    config.finish ? `Finish: ${config.finish}` : "",
    ...Object.entries(config.otherOptions || {}).map(([label, value]) => `${label}: ${value}`),
    config.madeToMeasure ? "Made to measure" : "",
    line.quoteReference ? `Quote ref ${line.quoteReference}` : "",
  ].filter(Boolean).join(" · ");
}

function nextLineId(product = {}, roomKey = "", lines = []) {
  const base = `${product.productId || product.id || product.productCode}::${roomKey}`;
  let index = 1;
  while (lines.some((line) => line.lineId === `${base}::${index}`)) index += 1;
  return `${base}::${index}`;
}

// One configured line for one room. `draft`: { room, quantity, options, widthMm, heightMm, depthMm,
// unitAllowance, quotedPrice, quoteReference, notes }. The price is the supplier's published price
// for the chosen variant (or, for a fixed retail product with no variants, its catalogue price),
// else the quoted price entered - else unpriced (Supplier Quote Required).
export function configuredLineFromProduct(product = {}, draft = {}, { existingLine = null, lines = [], cataloguePrice = null } = {}) {
  const attributes = attributesOf(product);
  const specifications = attributes.specifications || {};
  const configurator = productConfigurator(product);
  const options = draft.options || {};
  const variant = variantForOptions(product, options);
  const quoted = draft.quotedPrice === "" || draft.quotedPrice == null ? null : numberValue(draft.quotedPrice);
  const listed = !configurator.variants.length && numberValue(cataloguePrice) > 0 ? roundMoney(numberValue(cataloguePrice)) : null;
  const unitPrice = quoted && quoted > 0 ? roundMoney(quoted) : variant ? roundMoney(variant.price) : listed;
  const priceSource = quoted && quoted > 0 ? "supplier-quote" : variant ? "catalogue-variant" : listed !== null ? "catalogue-price" : "quote-required";
  const roomLabel = String(draft.room || "").trim();
  const roomKey = plumbingLocationKey(roomLabel);
  const labelled = (key) => configurator.options.find((option) => option.key === key)?.label || key;
  const otherOptions = Object.fromEntries(Object.entries(options).filter(([key, value]) => value && !["size", "glass", "finish"].includes(key)).map(([key, value]) => [labelled(key), value]));
  const configuration = {
    type: specifications.supplierScreenType || specifications.screenType || specifications.mirrorGroup || (typeof specifications === "object" && specifications.mirroredDoor ? "Mirror cabinet" : ""),
    screenType: specifications.screenType || "",
    configuration: specifications.supplierConfiguration || specifications.configuration || specifications.shape || "",
    configurationCode: specifications.supplierConfigurationCode || "",
    doorType: specifications.doorType || "",
    range: product.range || "",
    size: options.size || "",
    widthMm: numberValue(draft.widthMm) || variant?.widthMm || null,
    heightMm: numberValue(draft.heightMm) || variant?.heightMm || null,
    depthMm: numberValue(draft.depthMm) || variant?.depthMm || null,
    glass: options.glass || "",
    finish: options.finish || "",
    otherOptions,
    madeToMeasure: configurator.madeToMeasure,
    notes: String(draft.notes || "").trim(),
  };
  const line = {
    lineId: existingLine?.lineId || nextLineId(product, roomKey, lines),
    productId: product.productId || product.id || "",
    productCode: product.productCode || "",
    supplierCode: variant?.sku || specifications.supplierConfigurationCode || attributes.hncProductCode || product.model || "",
    productName: product.productName || "",
    brand: product.brand || "",
    supplier: product.supplier || product.brand || "",
    model: variant?.sku || product.model || "",
    range: product.range || "",
    colour: options.finish || "",
    finish: options.finish || "",
    imageUrl: product.imageUrl || product.primaryImageUrl || "",
    officialProductURL: product.productUrl || product.officialProductUrl || "",
    unit: "EACH",
    unitPrice,
    unitAllowance: roundMoney(numberValue(draft.unitAllowance)),
    priceSource,
    priceBasis: priceSource === "supplier-quote" ? SUPPLIER_QUOTE_PRICE_BASIS : attributes.priceBasis || "",
    priceState: unitPrice === null ? QUOTE_REQUIRED_LABEL : "Current Price",
    quoteReference: String(draft.quoteReference || "").trim(),
    configuredSelection: true,
    // The project location's own id (Selections Book room id) beside its name.
    locationId: draft.locationId || existingLine?.locationId || (roomKey ? `location-${roomKey}` : ""),
    configuration,
    configurationOptions: options,
    allocations: roomKey ? [{ locationKey: roomKey, location: roomLabel, quantity: Math.max(1, Math.round(numberValue(draft.quantity) || 1)) }] : [],
  };
  line.specification = configuredLineSpecification(line);
  return plumbingLineWithTotals(line);
}

// Bulk add: the same product and options applied to several rooms creates ONE LINE PER ROOM, each
// with that room's own dimensions, so every room stays independently editable afterwards.
// draft.locations: [{ id, key, label, widthMm, heightMm, depthMm }], draft.quantity = per location.
export function configuredLinesFromProduct(product = {}, draft = {}, { lines = [], cataloguePrice = null } = {}) {
  const created = [];
  for (const location of draft.locations || []) {
    created.push(configuredLineFromProduct(product, {
      ...draft,
      room: location.label,
      locationId: location.id,
      widthMm: location.widthMm,
      heightMm: location.heightMm,
      depthMm: location.depthMm,
    }, { lines: [...lines, ...created], cataloguePrice }));
  }
  return created;
}

// The draft that re-opens a saved line for editing.
export function draftFromConfiguredLine(line = {}) {
  const config = line.configuration || {};
  const allocation = line.allocations?.[0] || {};
  return {
    locations: allocation.location ? [{ id: line.locationId || `location-${allocation.locationKey}`, key: allocation.locationKey, label: allocation.location, widthMm: config.widthMm || "", heightMm: config.heightMm || "", depthMm: config.depthMm || "" }] : [],
    room: allocation.location || "",
    quantity: allocation.quantity || 1,
    options: line.configurationOptions || {},
    widthMm: config.widthMm || "",
    heightMm: config.heightMm || "",
    depthMm: config.depthMm || "",
    unitAllowance: line.unitAllowance ?? 0,
    quotedPrice: line.priceSource === "supplier-quote" ? line.unitPrice ?? "" : "",
    quoteReference: line.quoteReference || "",
    notes: config.notes || "",
  };
}
