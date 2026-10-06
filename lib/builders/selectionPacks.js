// Selection Packs: a pre-built group of Product Library products selected as ONE choice
// (Bathroom Accessory Pack, later Powder Room / WC / Shower / Appliance / Laundry / Door Furniture).
//
//   PACK LEVEL       what the client chooses: brand, range, finish, price per pack, packs required
//   COMPONENT LEVEL  what is estimated and ordered: each product x (packs x quantity per pack)
//
// A selected pack is never stored as one product. It EXPANDS into the existing product -> room
// allocation -> quantity lines (plumbingFixtureAllocation.js) of each component's own requirement
// (Towel Rails, Robe Hooks, ...), so Client Selections totals, allowances / variations, the
// Quotation Builder, BOQ and Procurement all read it through the paths they already use. Every
// expanded line carries line.selectionPack (pack id, name, packs, quantity per pack), so the pack
// level is always recoverable from the component level and the two cannot disagree.
//
// Nothing here lists products. Packs are either
//   generated   from SELECTION_PACK_TEMPLATES against the live Product Library, one per coordinated
//               brand + range + finish that can fill the template; or
//   configured  explicit builder records (saveBuilderSelectionPacks) naming component product codes.

import { numberValue, roundMoney } from "./selectionBudget.js";
import { PRICE_STATES, priceStateForProduct, productClientPrice } from "./clientSelectionWorkflow.js";
import { plumbingLineFromProduct, plumbingLineWithTotals, plumbingLocationKey, plumbingLocationType } from "./plumbingFixtureAllocation.js";
import { discoverBathroomAccessoryTypes } from "../product-library/bathroomAccessoryDiscovery.js";
import { requireWorkspaceId, tenantStorageKey } from './tenantScope.js';

export const SELECTION_PACK_SCHEMA_VERSION = "selection-pack.v1";
export const BATHROOM_ACCESSORY_PACK_GROUP = "bathroom-accessory-pack";

// One entry per kind of pack. roomRules = packs required per project room of that type; a room
// type that is absent (or 0) never counts. This is the only place the room-to-pack rule lives.
export const SELECTION_PACK_GROUPS = {
  [BATHROOM_ACCESSORY_PACK_GROUP]: {
    key: BATHROOM_ACCESSORY_PACK_GROUP,
    label: "Bathroom Accessory Packs",
    unitLabel: "Bathroom Accessory Pack",
    categoryKey: "bathroom-accessories",
    roomRules: { bathroom: 1, ensuite: 1, "powder-room": 0, wc: 0, laundry: 0 },
    // null = the default (standard) pack's price is the allowance per pack.
    allowancePerPack: null,
  },
};

// What a pack of each tier contains. requirementKey is the Client Selections requirement the
// component expands into. preferSizesMm orders the range's own products; it never excludes one.
// An optional component is included only where the same brand + finish offers it.
export const SELECTION_PACK_TEMPLATES = [
  {
    templateKey: "standard",
    packGroup: BATHROOM_ACCESSORY_PACK_GROUP,
    tier: "standard",
    tierLabel: "Standard",
    description: "Towel rail, hand towel rail / ring, toilet roll holder and robe hook.",
    components: [
      { componentKey: "towel-rail", requirementKey: "towel-rail", label: "Towel Rail", quantity: 1, preferSizesMm: [600] },
      { componentKey: "hand-towel", requirementKey: "hand-towel", label: "Hand Towel Rail / Ring", quantity: 1 },
      { componentKey: "toilet-roll-holder", requirementKey: "toilet-roll-holder", label: "Toilet Roll Holder", quantity: 1 },
      { componentKey: "robe-hook", requirementKey: "robe-hook", label: "Robe Hook", quantity: 1 },
    ],
  },
  {
    templateKey: "upgraded",
    packGroup: BATHROOM_ACCESSORY_PACK_GROUP,
    tier: "upgraded",
    tierLabel: "Upgraded",
    description: "Larger towel rail, two robe hooks and a shower shelf where the range offers one.",
    components: [
      { componentKey: "towel-rail", requirementKey: "towel-rail", label: "Towel Rail", quantity: 1, preferSizesMm: [800, 600] },
      { componentKey: "hand-towel", requirementKey: "hand-towel", label: "Hand Towel Rail / Ring", quantity: 1 },
      { componentKey: "toilet-roll-holder", requirementKey: "toilet-roll-holder", label: "Toilet Roll Holder", quantity: 1 },
      { componentKey: "robe-hook", requirementKey: "robe-hook", label: "Robe Hook", quantity: 2 },
      { componentKey: "shower-shelf", requirementKey: "shower-shelf", label: "Shower Shelf", quantity: 1, optional: true },
    ],
  },
];

const slug = (value = "") => String(value).trim().toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const productIdOf = (product = {}) => String(product.productId || product.id || product.productCode || "");
const finishOf = (product = {}) => String(product.finish || product.colour || product.attributes?.finish || product.attributes?.colour || "").trim();

// The collection a product belongs to. Suppliers often leave `range` blank and carry the
// collection only at the front of the name ("Vivid Slimline 800mm Single Towel Rail").
const RANGE_STOP = /^(\d.*|single|double|triple|heated|hand|towel|toilet|robe|shower|spare|metal|glass|round|square|soap|bathroom|rail|ring|hook|holder|shelf)$/i;
export function productRangeName(product = {}) {
  const words = String(product.productName || "").replace(/’/g, "'").trim().split(/\s+/);
  const stop = words.findIndex((word) => RANGE_STOP.test(word));
  const fromName = (stop < 0 ? [] : words.slice(0, stop)).join(" ").replace(/\s*\+$/, " +").trim();
  // The name carries the full collection ("Olde English"); a stored range may be its first word.
  return fromName || String(product.range || product.collection || "").trim();
}

function sizeRank(product = {}, sizes = []) {
  const match = String(product.productName || "").match(/(\d{3,4})\s*mm/i);
  const index = match ? sizes.indexOf(Number(match[1])) : -1;
  return index < 0 ? sizes.length : index;
}

function unitPriceOf(product = {}) {
  return priceStateForProduct(product) === PRICE_STATES.current ? roundMoney(productClientPrice(product)) : null;
}

// The range's product for one component: preferred size first, then the lower price; unpriced last.
function pickComponentProduct(candidates = [], component = {}) {
  const sizes = component.preferSizesMm || [];
  return [...candidates].sort((left, right) => (
    sizeRank(left, sizes) - sizeRank(right, sizes)
    || Number(unitPriceOf(left) === null) - Number(unitPriceOf(right) === null)
    || (unitPriceOf(left) || 0) - (unitPriceOf(right) || 0)
    || String(left.productName).localeCompare(String(right.productName))
  ))[0] || null;
}

// ---------------------------------------------------------------------------------------------
// Pack records
// ---------------------------------------------------------------------------------------------

// The stored shape of a pack (generated or builder-configured). Components reference Product
// Library products by id / code; resolveSelectionPack attaches the live products and prices.
export function normaliseSelectionPack(pack = {}) {
  const group = pack.packGroup || BATHROOM_ACCESSORY_PACK_GROUP;
  return {
    schemaVersion: SELECTION_PACK_SCHEMA_VERSION,
    packId: String(pack.packId || `${group}:${slug(pack.packName || "pack")}`),
    packGroup: group,
    packName: String(pack.packName || "").trim(),
    brand: String(pack.brand || "").trim(),
    range: String(pack.range || "").trim(),
    finish: String(pack.finish || "").trim(),
    imageUrl: pack.imageUrl || "",
    description: pack.description || "",
    tier: pack.tier || "standard",
    tierLabel: pack.tierLabel || "",
    components: (pack.components || []).map((component) => ({
      componentKey: component.componentKey || component.requirementKey,
      requirementKey: component.requirementKey,
      label: component.label || "",
      quantity: Math.max(1, Math.round(numberValue(component.quantity) || 1)),
      productId: component.productId || "",
      productCode: component.productCode || "",
    })).filter((component) => component.requirementKey),
    // null = the sum of its components; a number is a builder-set pack price.
    packPrice: pack.packPrice === null || pack.packPrice === undefined || pack.packPrice === "" ? null : roundMoney(numberValue(pack.packPrice)),
    applicableRoomTypes: pack.applicableRoomTypes || Object.entries(SELECTION_PACK_GROUPS[group]?.roomRules || {}).filter(([, packs]) => packs > 0).map(([type]) => type),
    supplier: pack.supplier || "",
    active: pack.active !== false,
    isDefault: Boolean(pack.isDefault),
    coordination: pack.coordination || "configured",
    source: pack.source || "configured",
  };
}

// Attaches live Product Library products + prices. A pack whose component product is no longer in
// the effective catalogue (disabled / discontinued) resolves as unavailable rather than half a pack.
export function resolveSelectionPack(pack = {}, products = []) {
  const record = normaliseSelectionPack(pack);
  const byId = new Map();
  products.forEach((product) => {
    [product.productId, product.id, product.productCode].filter(Boolean).forEach((key) => { if (!byId.has(String(key))) byId.set(String(key), product); });
  });
  const components = record.components.map((component) => {
    const product = byId.get(String(component.productId)) || byId.get(String(component.productCode)) || null;
    const unitPrice = product ? unitPriceOf(product) : null;
    return {
      ...component,
      product,
      productId: product ? productIdOf(product) : component.productId,
      productCode: product?.productCode || component.productCode,
      productName: product?.productName || "",
      imageUrl: product?.imageUrl || product?.primaryImageUrl || "",
      unitPrice,
      lineTotal: unitPrice === null ? null : roundMoney(unitPrice * component.quantity),
    };
  });
  const available = components.length > 0 && components.every((component) => component.product);
  const allPriced = available && components.every((component) => component.unitPrice !== null);
  const componentTotal = allPriced ? roundMoney(components.reduce((total, component) => total + component.lineTotal, 0)) : null;
  return {
    ...record,
    components,
    available,
    allPriced,
    componentTotal,
    pricePerPack: record.packPrice ?? componentTotal,
    imageUrl: record.imageUrl || components.find((component) => component.imageUrl)?.imageUrl || "",
    supplier: record.supplier || Array.from(new Set(components.map((component) => component.product?.supplier).filter(Boolean))).join(", "),
  };
}

// One pack per template per coordinated range. Products are only ever combined within one brand
// and one finish: a complete single range first ("Phoenix Wiltern"); otherwise the brand's
// best-covered range in that finish, completed from the same brand + finish. Brands or finishes
// are never mixed - that needs a configured pack.
export function generateCoordinatedPacks(products = [], templates = SELECTION_PACK_TEMPLATES) {
  const byType = new Map(discoverBathroomAccessoryTypes(products).map((type) => [type.key, type.products]));
  const packs = [];
  templates.forEach((template) => {
    const groups = new Map();
    template.components.forEach((component) => (byType.get(component.requirementKey) || []).forEach((product) => {
      const finish = finishOf(product);
      if (!product.brand || !finish) return;
      const key = `${slug(product.brand)}|${slug(finish)}`;
      if (!groups.has(key)) groups.set(key, { brand: product.brand, finish, byComponent: new Map() });
      const group = groups.get(key);
      if (!group.byComponent.has(component.componentKey)) group.byComponent.set(component.componentKey, []);
      group.byComponent.get(component.componentKey).push(product);
    }));
    groups.forEach((group) => {
      const required = template.components.filter((component) => !component.optional);
      if (!required.every((component) => group.byComponent.get(component.componentKey)?.length)) return;
      const ranges = Array.from(new Set([...group.byComponent.values()].flat().map(productRangeName).filter(Boolean)));
      const inRange = (component, range) => (group.byComponent.get(component.componentKey) || []).filter((product) => productRangeName(product) === range);
      const build = (range, coordination) => {
        const components = template.components.map((component) => {
          const product = pickComponentProduct(inRange(component, range), component)
            || (coordination === "range" && !component.optional ? null : pickComponentProduct(group.byComponent.get(component.componentKey) || [], component));
          return product ? { ...component, productId: productIdOf(product), productCode: product.productCode || "" } : component.optional ? null : { ...component, missing: true };
        }).filter(Boolean);
        if (components.some((component) => component.missing)) return null;
        const packName = [group.brand, coordination === "range" ? range : "", template.tier === "standard" ? "" : template.tierLabel, "Accessory Pack"].filter(Boolean).join(" ");
        return normaliseSelectionPack({
          packId: [template.packGroup, template.templateKey, slug(group.brand), slug(coordination === "range" ? range : "mixed"), slug(group.finish)].join(":"),
          packGroup: template.packGroup,
          packName,
          brand: group.brand,
          range: coordination === "range" ? range : "",
          finish: group.finish,
          description: template.description,
          tier: template.tier,
          tierLabel: template.tierLabel,
          components,
          coordination,
          source: "generated",
        });
      };
      const complete = ranges.map((range) => build(range, "range")).filter(Boolean);
      if (complete.length) { packs.push(...complete); return; }
      // No single range fills the pack: lead with the range covering the most components.
      const coverage = (range) => required.filter((component) => inRange(component, range).length).length;
      const lead = [...ranges].sort((left, right) => coverage(right) - coverage(left) || left.localeCompare(right))[0];
      const mixed = lead ? build(lead, "brand-finish") : null;
      if (mixed) packs.push(mixed);
    });
  });
  return packs;
}

// ---------------------------------------------------------------------------------------------
// Builder-configured packs + settings (same organisation-scoped local storage model as the
// Product Library's builder overrides / custom products).
// ---------------------------------------------------------------------------------------------

export const BUILDER_SELECTION_PACKS_STORAGE_KEY = "gr8:builder-selection-packs";
let storageAdapter = null;
export function setSelectionPackStorage(adapter) { storageAdapter = adapter || null; }
function storage() {
  if (storageAdapter) return storageAdapter;
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  const map = new Map();
  storageAdapter = { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)) };
  return storageAdapter;
}
function readStore() {
  try {
    const parsed = JSON.parse(storage().getItem(BUILDER_SELECTION_PACKS_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// { packs: [pack records], settings: { [packGroup]: { allowancePerPack, defaultPackId, roomRules, hiddenPackIds } } }
export function getBuilderSelectionPackConfig(organisationId = "") {
  if (!organisationId) return { packs: [], settings: {} };
  const key = tenantStorageKey(BUILDER_SELECTION_PACKS_STORAGE_KEY, organisationId);
  let entry;
  try { entry = JSON.parse(storage().getItem(key) || 'null'); } catch { entry = null; }
  entry ||= readStore()[organisationId] || {};
  return { packs: Array.isArray(entry.packs) ? entry.packs.map(normaliseSelectionPack) : [], settings: entry.settings || {} };
}

export function saveBuilderSelectionPackConfig(organisationId = "", { packs, settings } = {}) {
  requireWorkspaceId(organisationId);
  const current = getBuilderSelectionPackConfig(organisationId);
  const next = {
    packs: packs ? packs.map(normaliseSelectionPack) : current.packs || [],
    settings: settings ? { ...(current.settings || {}), ...settings } : current.settings || {},
  };
  storage().setItem(tenantStorageKey(BUILDER_SELECTION_PACKS_STORAGE_KEY, organisationId), JSON.stringify(next));
  return getBuilderSelectionPackConfig(organisationId);
}

export function selectionPackGroup(packGroup = BATHROOM_ACCESSORY_PACK_GROUP, settings = {}) {
  const base = SELECTION_PACK_GROUPS[packGroup] || { key: packGroup, label: "Selection Packs", unitLabel: "Pack", roomRules: {} };
  const override = settings[packGroup] || {};
  return { ...base, ...override, roomRules: { ...base.roomRules, ...(override.roomRules || {}) } };
}

// Every pack this builder offers for a group: configured packs first, then the generated
// coordinated ranges, resolved against the effective catalogue. The default (standard option) is
// the builder's chosen pack, else a pack flagged isDefault, else the lowest-priced standard pack.
export function availableSelectionPacks({ packGroup = BATHROOM_ACCESSORY_PACK_GROUP, products = [], config = { packs: [], settings: {} }, templates = SELECTION_PACK_TEMPLATES } = {}) {
  const group = selectionPackGroup(packGroup, config.settings);
  const hidden = new Set(group.hiddenPackIds || []);
  const configured = (config.packs || []).filter((pack) => pack.packGroup === packGroup);
  const configuredIds = new Set(configured.map((pack) => pack.packId));
  const generated = generateCoordinatedPacks(products, templates.filter((template) => template.packGroup === packGroup)).filter((pack) => !configuredIds.has(pack.packId));
  const packs = [...configured, ...generated]
    .filter((pack) => pack.active && !hidden.has(pack.packId))
    .map((pack) => resolveSelectionPack(pack, products))
    .filter((pack) => pack.available);
  const priced = packs.filter((pack) => pack.pricePerPack !== null);
  const fallback = [...priced].sort((left, right) => Number(right.tier === "standard") - Number(left.tier === "standard") || left.pricePerPack - right.pricePerPack)[0];
  const defaultPack = packs.find((pack) => pack.packId === group.defaultPackId) || packs.find((pack) => pack.isDefault) || fallback || null;
  const tierOrder = (pack) => Math.max(0, templates.findIndex((template) => template.tier === pack.tier));
  return {
    group,
    defaultPackId: defaultPack?.packId || "",
    allowancePerPack: roundMoney(numberValue(group.allowancePerPack ?? defaultPack?.pricePerPack)),
    allowanceSource: group.allowancePerPack !== null && group.allowancePerPack !== undefined ? "builder pack allowance" : defaultPack ? `standard pack (${defaultPack.packName} - ${defaultPack.finish})` : "",
    packs: packs
      .map((pack) => ({ ...pack, isDefault: pack.packId === defaultPack?.packId }))
      .sort((left, right) => tierOrder(left) - tierOrder(right) || (left.pricePerPack ?? Infinity) - (right.pricePerPack ?? Infinity) || left.packName.localeCompare(right.packName)),
  };
}

// ---------------------------------------------------------------------------------------------
// Required quantity from the project's rooms
// ---------------------------------------------------------------------------------------------

// "Main Bathroom" (Selections Book), "Bathroom" (Takeoff opening) and "Bathroom Vanity" (Cabinetry)
// are one room; "Bathroom 2" / "Ensuite 2" are different rooms.
function packRoomKey(name = "") {
  return plumbingLocationKey(String(name).replace(/\b(main|master|family|common|vanity|vanities|cabinetry|cabinet|joinery)\b/gi, " "));
}

// roomNames: the project's real room names (Selections Book rooms, Tiling rooms, Cabinetry
// locations, Takeoff opening rooms). Returns each wet area and the packs it needs under the group's
// roomRules; `excluded` lists wet areas the rules deliberately leave out (Powder Room, WC, Laundry).
// notRooms: names that are selection categories, not rooms - the Selections Book keeps each
// category's rows in a "room" named after it ("Bathroom Accessories"), which is not a bathroom.
export function selectionPackRooms(packGroup = BATHROOM_ACCESSORY_PACK_GROUP, roomNames = [], settings = {}, { notRooms = [] } = {}) {
  const { roomRules } = selectionPackGroup(packGroup, settings);
  const seen = new Set(notRooms.map(packRoomKey));
  const rooms = [];
  const excluded = [];
  roomNames.forEach((name) => {
    const label = String(name || "").trim();
    const type = plumbingLocationType(label);
    const key = packRoomKey(label);
    if (!label || !key || !(type in roomRules) || seen.has(key)) return;
    seen.add(key);
    const packs = Math.max(0, Math.round(numberValue(roomRules[type])));
    if (packs) rooms.push({ key, label, type, packs });
    else excluded.push({ key, label, type });
  });
  return { rooms, excluded, quantity: rooms.reduce((total, room) => total + room.packs, 0), source: rooms.length ? "project rooms" : "" };
}

// ---------------------------------------------------------------------------------------------
// Pack -> component allocation lines
// ---------------------------------------------------------------------------------------------

// Splits a per-pack amount across the components in proportion to their value, in whole cents per
// UNIT, so unit figure x quantity always adds back to the pack amount where it divides exactly.
function unitShares(amount, components = []) {
  const weights = components.map((component) => (component.unitPrice === null ? 0 : component.unitPrice * component.quantity));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const cents = Math.round(numberValue(amount) * 100);
  const units = components.map((component, index) => {
    const share = totalWeight ? (cents * weights[index]) / totalWeight : cents / components.length;
    return Math.round(share / component.quantity);
  });
  let drift = cents - units.reduce((total, unit, index) => total + unit * components[index].quantity, 0);
  // Any rounding remainder lands on single-quantity components, where a cent is a cent.
  for (let index = 0; drift !== 0 && index < components.length; index += 1) {
    if (components[index].quantity !== 1) continue;
    units[index] += drift;
    drift = 0;
  }
  return units.map((unit) => unit / 100);
}

export const selectionPackLineId = (packGroup, componentKey) => `pack:${packGroup}:${componentKey}`;
export const isSelectionPackLine = (line = {}, packGroup = "") => Boolean(line?.selectionPack?.packId) && (!packGroup || line.selectionPack.packGroup === packGroup);

// The component lines of `pack` applied to `rooms` (from selectionPackRooms): one line per
// component, allocated to each room at packs-in-room x quantity-per-pack.
export function selectionPackLines(pack = {}, rooms = [], { allowancePerPack = 0 } = {}) {
  const packQuantity = rooms.reduce((total, room) => total + room.packs, 0);
  if (!pack?.components?.length || !packQuantity) return [];
  // A builder-set pack price is carried by the components pro rata, so component totals x packs
  // always equal pack price x packs.
  const repriced = pack.allPriced && pack.packPrice !== null && pack.packPrice !== pack.componentTotal;
  const unitPrices = repriced ? unitShares(pack.packPrice, pack.components) : pack.components.map((component) => component.unitPrice);
  const unitAllowances = unitShares(allowancePerPack, pack.components);
  return pack.components.map((component, index) => ({
    requirementKey: component.requirementKey,
    line: plumbingLineWithTotals({
      ...plumbingLineFromProduct(component.product, {
        unitPrice: unitPrices[index],
        unitAllowance: unitAllowances[index],
        priceState: unitPrices[index] === null ? PRICE_STATES.pending : PRICE_STATES.current,
        allocations: rooms.map((room) => ({ locationKey: plumbingLocationKey(room.label), location: room.label, quantity: room.packs * component.quantity })),
      }),
      lineId: selectionPackLineId(pack.packGroup, component.componentKey),
      selectionPack: {
        schemaVersion: SELECTION_PACK_SCHEMA_VERSION,
        packGroup: pack.packGroup,
        packId: pack.packId,
        packName: pack.packName,
        brand: pack.brand,
        range: pack.range,
        finish: pack.finish,
        tier: pack.tier,
        imageUrl: pack.imageUrl,
        packQuantity,
        pricePerPack: pack.pricePerPack,
        allowancePerPack: roundMoney(numberValue(allowancePerPack)),
        componentKey: component.componentKey,
        componentLabel: component.label,
        quantityPerPack: component.quantity,
        packProductId: component.productId,
        packProductName: component.productName,
        packUnitPrice: unitPrices[index],
        substituted: false,
      },
    }),
  }));
}

// linesByRequirement: { [requirementKey]: current allocation lines }. Returns the requirements whose
// lines change when `pack` replaces whatever pack of that group is selected (pack = null removes
// it). Lines a client allocated individually are never touched.
export function selectionPackChanges(linesByRequirement = {}, packGroup = BATHROOM_ACCESSORY_PACK_GROUP, pack = null, rooms = [], options = {}) {
  const next = pack ? selectionPackLines(pack, rooms, options) : [];
  const keys = new Set([
    ...Object.keys(linesByRequirement).filter((key) => (linesByRequirement[key] || []).some((line) => isSelectionPackLine(line, packGroup))),
    ...next.map((entry) => entry.requirementKey),
  ]);
  return [...keys].map((requirementKey) => ({
    requirementKey,
    lines: [
      ...(linesByRequirement[requirementKey] || []).filter((line) => !isSelectionPackLine(line, packGroup)),
      ...next.filter((entry) => entry.requirementKey === requirementKey).map((entry) => entry.line),
    ],
  }));
}

// The pack-level view rebuilt from the component lines: which pack, how many, what each component
// is now (including substitutions and any quantity edited on a component), and the totals.
export function selectedSelectionPack(linesByRequirement = {}, packGroup = BATHROOM_ACCESSORY_PACK_GROUP) {
  const components = Object.entries(linesByRequirement).flatMap(([requirementKey, lines]) => (lines || [])
    .filter((line) => isSelectionPackLine(line, packGroup))
    .map((line) => ({ requirementKey, line: plumbingLineWithTotals(line) })));
  if (!components.length) return null;
  const meta = components[0].line.selectionPack;
  const allPriced = components.every(({ line }) => line.unitPrice !== null);
  const selectedTotal = allPriced ? roundMoney(components.reduce((total, { line }) => total + line.selectedTotal, 0)) : null;
  const allowanceTotal = roundMoney(components.reduce((total, { line }) => total + line.allowanceTotal, 0));
  const packQuantity = numberValue(meta.packQuantity) || 1;
  return {
    packGroup,
    packId: meta.packId,
    packName: meta.packName,
    brand: meta.brand,
    range: meta.range,
    finish: meta.finish,
    tier: meta.tier,
    imageUrl: meta.imageUrl,
    packQuantity,
    allowancePerPack: meta.allowancePerPack,
    originalPricePerPack: meta.pricePerPack,
    pricePerPack: selectedTotal === null ? null : roundMoney(selectedTotal / packQuantity),
    selectedTotal,
    allowanceTotal,
    variation: selectedTotal === null ? null : roundMoney(selectedTotal - allowanceTotal),
    allPriced,
    substituted: components.some(({ line }) => line.selectionPack.substituted),
    components: components.map(({ requirementKey, line }) => ({
      requirementKey,
      componentKey: line.selectionPack.componentKey,
      label: line.selectionPack.componentLabel,
      quantityPerPack: line.selectionPack.quantityPerPack,
      quantity: line.quantity,
      substituted: Boolean(line.selectionPack.substituted),
      packProductName: line.selectionPack.packProductName,
      line,
    })),
  };
}

// Swaps one component's product and keeps everything else about the line: its rooms, quantities,
// allowance share and pack membership. Choosing the pack's own product again clears the flag.
export function substituteSelectionPackComponent(line = {}, product = {}) {
  const unitPrice = unitPriceOf(product);
  const original = productIdOf(product) === String(line.selectionPack?.packProductId || "");
  return plumbingLineWithTotals({
    ...plumbingLineFromProduct(product, {
      unitPrice: original && line.selectionPack?.packUnitPrice !== undefined ? line.selectionPack.packUnitPrice : unitPrice,
      unitAllowance: line.unitAllowance,
      priceState: unitPrice === null ? PRICE_STATES.pending : PRICE_STATES.current,
      allocations: line.allocations,
    }),
    lineId: line.lineId,
    selectionPack: { ...line.selectionPack, substituted: !original },
  });
}

// What a component may be swapped for: the same product type, the pack's own brand + finish first,
// then the same brand, then the rest of the library's range.
export function selectionPackComponentAlternatives(products = [], component = {}) {
  const range = discoverBathroomAccessoryTypes(products).find((type) => type.key === component.requirementKey)?.products || [];
  const pack = component.line?.selectionPack || {};
  const rank = (product) => (slug(product.brand) !== slug(pack.brand) ? 2 : slug(finishOf(product)) !== slug(pack.finish) ? 1 : 0);
  return [...range]
    .sort((left, right) => rank(left) - rank(right) || `${left.brand} ${left.productName}`.localeCompare(`${right.brand} ${right.productName}`, undefined, { numeric: true }))
    .map((product) => ({ product, productId: productIdOf(product), unitPrice: unitPriceOf(product), finish: finishOf(product), coordinated: rank(product) === 0, current: productIdOf(product) === String(component.line?.productId || "") }));
}
