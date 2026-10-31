// One builder's configuration: THEIR suppliers, THEIR products and prices, THEIR margins,
// THEIR inclusion schedules and quotation settings. One document per builder, kept in that
// builder's storage (lib/job-storage: the builder's job server, or this computer in Local Only).
//
//   GR8 RESULT MASTER TEMPLATE   the product catalogue and structure shipped with the application
//                                (lib/product-library). Read-only here; the same for every builder.
//   BUILDER CONFIGURATION        this document. It never contains a copy of the master: a master
//                                product the builder has changed is stored as a DELTA against its
//                                master product code, so a master update cannot overwrite it and a
//                                builder's change cannot reach the master or another builder.
//
// Everything has a stable id. Suppliers, products, schedules and schedule items keep their id
// through every edit, import and master update: jobs and quotation rows refer to those ids, never
// to names or descriptions.
//
// Pure functions: every change returns a new configuration and leaves its argument untouched.

export const BUILDER_CONFIG_FORMAT = "gr8-builder-config";
export const BUILDER_CONFIG_SCHEMA = 1;
export const PRICING_METHODS = Object.freeze(["markup", "margin"]);

const text = (value) => String(value ?? "").trim();
const slug = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const amount = (value) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));
const money = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const newId = (prefix) => `${prefix}:${globalThis.crypto.randomUUID()}`;

export class BuilderConfigError extends Error {
  constructor(message, detail = null) { super(message); this.name = "BuilderConfigError"; this.detail = detail; }
}

export function createBuilderConfig({ builderId, name = "" } = {}) {
  if (!text(builderId)) throw new BuilderConfigError("A builder is required: configuration always belongs to one builder.");
  return {
    format: BUILDER_CONFIG_FORMAT, schema: BUILDER_CONFIG_SCHEMA, builderId: text(builderId), name: text(name),
    changes: 0, updatedAt: "",
    // Which master template release this builder has reviewed. Never changes builder data.
    masterTemplate: { version: "", reviewedAt: "", review: [] },
    suppliers: [],
    // source "master": a delta against masterProductCode. source "builder": the builder's own product.
    products: [],
    // No margin is assumed. Until the builder sets one, sell prices come only from explicit prices.
    pricing: { method: "markup", defaultPercent: null, categoryPercent: {}, supplierPercent: {}, gstPercent: null },
    inclusionSchedules: [],
    quotationSettings: {},
  };
}

export function assertBuilderConfig(config, builderId = "") {
  if (!config || config.format !== BUILDER_CONFIG_FORMAT) throw new BuilderConfigError("This is not a builder configuration.");
  if (config.schema > BUILDER_CONFIG_SCHEMA) throw new BuilderConfigError("This builder configuration was written by a newer version of GR8 Result.");
  if (!text(config.builderId)) throw new BuilderConfigError("The configuration does not name its builder.");
  if (text(builderId) && config.builderId !== text(builderId)) throw new BuilderConfigError("This configuration belongs to another builder.", { expected: text(builderId), found: config.builderId });
  return config;
}

const changed = (config, patch, now = new Date().toISOString()) => ({ ...config, ...patch, changes: (config.changes || 0) + 1, updatedAt: now });

// ---- suppliers ---------------------------------------------------------------------------------------
export function upsertSupplier(config, supplier = {}, { now } = {}) {
  assertBuilderConfig(config);
  if (!text(supplier.name) && !supplier.id) throw new BuilderConfigError("A supplier needs a name.");
  const existing = supplier.id ? config.suppliers.find((item) => item.id === supplier.id) : null;
  if (supplier.id && !existing) throw new BuilderConfigError("That supplier is not in this builder's configuration.", { id: supplier.id });
  const name = text(supplier.name) || existing.name;
  const clash = config.suppliers.find((item) => item.id !== existing?.id && slug(item.name) === slug(name));
  if (clash) throw new BuilderConfigError(`A supplier named "${clash.name}" already exists.`, { id: clash.id });
  const next = { active: true, code: "", contact: {}, connector: null, ...existing, ...supplier, id: existing?.id || newId("supplier"), name };
  return changed(config, { suppliers: existing ? config.suppliers.map((item) => (item.id === next.id ? next : item)) : [...config.suppliers, next] }, now);
}
export const supplierById = (config, id) => config.suppliers.find((item) => item.id === id) || null;
export const supplierByName = (config, name) => config.suppliers.find((item) => slug(item.name) === slug(name)) || null;

// A supplier that products still refer to is not removed out from under them: name the supplier
// that takes those products over (replace), or remove the products first.
export function removeSupplier(config, supplierId, { replaceWith = "", now } = {}) {
  assertBuilderConfig(config);
  if (!supplierById(config, supplierId)) throw new BuilderConfigError("That supplier is not in this builder's configuration.");
  if (replaceWith && (replaceWith === supplierId || !supplierById(config, replaceWith))) throw new BuilderConfigError("The replacement supplier is not in this builder's configuration.");
  const used = config.products.filter((product) => product.supplierId === supplierId && !product.removed);
  if (used.length && !replaceWith) throw new BuilderConfigError(`${used.length} product(s) still use this supplier. Choose a replacement supplier or remove those products first.`, { productIds: used.map((product) => product.id) });
  return changed(config, {
    suppliers: config.suppliers.filter((item) => item.id !== supplierId),
    products: config.products.map((product) => (product.supplierId === supplierId ? { ...product, supplierId: replaceWith || "" } : product)),
  }, now);
}

// ---- products ----------------------------------------------------------------------------------------
const PRODUCT_FIELDS = ["supplierId", "supplierSku", "importKey", "name", "description", "brand", "range", "categoryKey", "familyKey", "subcategory", "unit", "cost", "price", "marginPercent",
  "selectionSlotIds", "imageUrl", "active", "enabled", "availability", "leadTimeDays", "notes", "attributes"];

export const productById = (config, id) => config.products.find((product) => product.id === id) || null;
export const masterDeltaFor = (config, masterProductCode) => config.products.find((product) => product.source === "master" && product.masterProductCode === masterProductCode) || null;
// The stable identity of an imported product: the builder's supplier and that supplier's SKU, or
// an explicit import key. Names and descriptions are never identities.
export function productMatchKey({ supplierId = "", supplierSku = "", importKey = "" } = {}) {
  if (text(supplierId) && text(supplierSku)) return `sku|${supplierId}|${text(supplierSku).toLowerCase()}`;
  if (text(importKey)) return `key|${text(importKey).toLowerCase()}`;
  return "";
}

function cleanProduct(input, existing) {
  const next = { ...existing };
  for (const field of PRODUCT_FIELDS) if (input[field] !== undefined) next[field] = input[field];
  for (const field of ["cost", "price", "marginPercent"]) {
    if (next[field] === undefined) continue;
    const value = amount(next[field]);
    if (next[field] !== null && next[field] !== "" && (value === null || value < 0)) throw new BuilderConfigError(`"${field}" must be a non-negative number.`);
    next[field] = value;
  }
  return next;
}

// The builder's own product (create or edit). The id is kept for the life of the product.
export function upsertBuilderProduct(config, product = {}, { now } = {}) {
  assertBuilderConfig(config);
  const existing = product.id ? productById(config, product.id) : null;
  if (product.id && !existing) throw new BuilderConfigError("That product is not in this builder's configuration.", { id: product.id });
  if (existing && existing.source !== "builder") throw new BuilderConfigError("Use overrideMasterProduct to change a master template product.");
  const next = cleanProduct(product, existing || { id: newId("product"), source: "builder", active: true, enabled: true, selectionSlotIds: [] });
  if (!text(next.name)) throw new BuilderConfigError("A product needs a name.");
  if (next.supplierId && !supplierById(config, next.supplierId)) throw new BuilderConfigError("The product's supplier is not in this builder's configuration.", { supplierId: next.supplierId });
  const key = productMatchKey(next);
  const clash = key && config.products.find((item) => item.id !== next.id && !item.removed && productMatchKey(item) === key);
  if (clash) throw new BuilderConfigError("Another product already has this supplier and SKU.", { id: clash.id });
  next.updatedAt = now || new Date().toISOString();
  delete next.removed; delete next.removedAt;
  return changed(config, { products: existing ? config.products.map((item) => (item.id === next.id ? next : item)) : [...config.products, next] }, now);
}

// The builder's change to a master template product: only the fields given are stored.
export function overrideMasterProduct(config, masterProductCode, patch = {}, { now } = {}) {
  assertBuilderConfig(config);
  if (!text(masterProductCode)) throw new BuilderConfigError("A master product code is required.");
  const existing = masterDeltaFor(config, masterProductCode);
  const next = cleanProduct(patch, existing || { id: `master:${masterProductCode}`, source: "master", masterProductCode });
  if (next.supplierId && !supplierById(config, next.supplierId)) throw new BuilderConfigError("The product's supplier is not in this builder's configuration.", { supplierId: next.supplierId });
  next.updatedAt = now || new Date().toISOString();
  return changed(config, { products: existing ? config.products.map((item) => (item.id === next.id ? next : item)) : [...config.products, next] }, now);
}
// Back to the master template's own record for that product.
export function clearMasterOverride(config, masterProductCode, { now } = {}) {
  assertBuilderConfig(config);
  return changed(config, { products: config.products.filter((product) => !(product.source === "master" && product.masterProductCode === masterProductCode)) }, now);
}

const scheduleUses = (config, productId) => config.inclusionSchedules.flatMap((schedule) => schedule.items.filter((item) => item.productId === productId).map((item) => ({ scheduleId: schedule.id, itemId: item.id })));

// Removing a product: a builder product is kept as a removed record (its id is never reused and
// existing jobs still resolve it); a master product is hidden for this builder only. A product
// that an inclusion schedule still names needs a replacement.
export function removeProduct(config, productId, { replaceWith = "", now } = {}) {
  assertBuilderConfig(config);
  const product = productById(config, productId);
  const uses = scheduleUses(config, productId);
  if (uses.length && !replaceWith) throw new BuilderConfigError(`${uses.length} inclusion schedule item(s) use this product. Choose a replacement product.`, { uses });
  let next = config;
  if (replaceWith) next = replaceProduct(next, productId, replaceWith, { now });
  const at = now || new Date().toISOString();
  if (product?.source === "builder") return changed(next, { products: next.products.map((item) => (item.id === productId ? { ...item, removed: true, removedAt: at, active: false, enabled: false } : item)) }, now);
  // A master product: recorded as this builder's delta.
  const code = product?.masterProductCode || text(productId).replace(/^master:/, "");
  return overrideMasterProduct(next, code, { enabled: false }, { now });
}
// Every inclusion schedule item that named `fromId` now names `toId`. Schedules get a new
// version. Jobs are not touched: they keep the snapshot they were priced with.
export function replaceProduct(config, fromId, toId, { now } = {}) {
  assertBuilderConfig(config);
  if (!text(toId) || fromId === toId) throw new BuilderConfigError("Choose a different product as the replacement.");
  const at = now || new Date().toISOString();
  const schedules = config.inclusionSchedules.map((schedule) => (schedule.items.some((item) => item.productId === fromId)
    ? { ...schedule, version: schedule.version + 1, updatedAt: at, items: schedule.items.map((item) => (item.productId === fromId ? { ...item, productId: toId, replaced: { productId: fromId, at } } : item)) }
    : schedule));
  const products = config.products.map((product) => (product.id === fromId ? { ...product, replacedBy: toId } : product));
  return changed(config, { inclusionSchedules: schedules, products }, now);
}

// ---- pricing -----------------------------------------------------------------------------------------
export function setPricing(config, pricing = {}, { now } = {}) {
  assertBuilderConfig(config);
  const next = { ...config.pricing, ...pricing, categoryPercent: { ...config.pricing.categoryPercent, ...(pricing.categoryPercent || {}) }, supplierPercent: { ...config.pricing.supplierPercent, ...(pricing.supplierPercent || {}) } };
  if (!PRICING_METHODS.includes(next.method)) throw new BuilderConfigError('Pricing method must be "markup" (on cost) or "margin" (of sell price).');
  const check = (value, label) => { if (value === null || value === undefined) return; if (!Number.isFinite(Number(value)) || Number(value) < 0 || (next.method === "margin" && Number(value) >= 100)) throw new BuilderConfigError(`${label} is not a valid percentage.`); };
  check(next.defaultPercent, "The default percentage"); check(next.gstPercent, "GST");
  for (const [key, value] of [...Object.entries(next.categoryPercent), ...Object.entries(next.supplierPercent)]) check(value, `The percentage for "${key}"`);
  return changed(config, { pricing: next }, now);
}
// Which percentage applies to a product: its own, then its category's, then its supplier's, then
// the builder's default. null when the builder has set none - nothing is assumed.
export function percentFor(config, product = {}) {
  const from = [["product", product.marginPercent], ["category", config.pricing.categoryPercent[product.categoryKey]], ["supplier", config.pricing.supplierPercent[product.supplierId]], ["default", config.pricing.defaultPercent]]
    .find(([, value]) => amount(value) !== null);
  return from ? { percent: amount(from[1]), source: from[0] } : { percent: null, source: "" };
}
// { price, source }: the builder's explicit price; else their cost with their percentage; else
// the master template's price; else no price (priceRequired) - never a guessed one.
export function sellPriceFor(config, product = {}, masterPrice = null) {
  const explicit = amount(product.price);
  if (explicit !== null) return { price: explicit, source: "builder-price", priceRequired: false };
  const cost = amount(product.cost);
  const { percent, source } = percentFor(config, product);
  if (cost !== null && percent !== null) {
    const price = config.pricing.method === "margin" ? cost / (1 - percent / 100) : cost * (1 + percent / 100);
    return { price: money(price), source: `builder-cost+${config.pricing.method}:${source}`, percent, priceRequired: false };
  }
  if (amount(masterPrice) !== null) return { price: amount(masterPrice), source: "master-template", priceRequired: false };
  return { price: null, source: "", priceRequired: true };
}

// ---- inclusion schedules ---------------------------------------------------------------------------
// items: [{ id, selectionSlotId, productId, locationId?, quantityRule?, allowance?, notes? }]
export function upsertInclusionSchedule(config, schedule = {}, { now } = {}) {
  assertBuilderConfig(config);
  const existing = schedule.id ? config.inclusionSchedules.find((item) => item.id === schedule.id) : null;
  if (schedule.id && !existing) throw new BuilderConfigError("That inclusion schedule is not in this builder's configuration.");
  const name = text(schedule.name) || existing?.name;
  if (!name) throw new BuilderConfigError("An inclusion schedule needs a name.");
  const clash = config.inclusionSchedules.find((item) => item.id !== existing?.id && slug(item.name) === slug(name));
  if (clash) throw new BuilderConfigError(`An inclusion schedule named "${clash.name}" already exists.`);
  const items = (schedule.items || existing?.items || []).map((item) => {
    if (!text(item.selectionSlotId)) throw new BuilderConfigError("Every inclusion needs a selection slot.");
    return { quantityRule: null, allowance: null, notes: "", locationId: "", ...item, id: item.id || newId("inclusion") };
  });
  const seen = new Set();
  for (const item of items) { const key = `${item.selectionSlotId}|${item.locationId || ""}`; if (seen.has(key)) throw new BuilderConfigError(`"${item.selectionSlotId}" is included twice for the same location.`); seen.add(key); }
  const at = now || new Date().toISOString();
  const next = { active: true, ...existing, ...schedule, id: existing?.id || newId("schedule"), name, items, version: (existing?.version || 0) + 1, updatedAt: at };
  return changed(config, { inclusionSchedules: existing ? config.inclusionSchedules.map((item) => (item.id === next.id ? next : item)) : [...config.inclusionSchedules, next] }, now);
}
export function removeInclusionSchedule(config, scheduleId, { now } = {}) {
  assertBuilderConfig(config);
  if (!config.inclusionSchedules.some((item) => item.id === scheduleId)) throw new BuilderConfigError("That inclusion schedule is not in this builder's configuration.");
  return changed(config, { inclusionSchedules: config.inclusionSchedules.filter((item) => item.id !== scheduleId) }, now);
}
export function setQuotationSettings(config, settings = {}, { now } = {}) {
  assertBuilderConfig(config);
  return changed(config, { quotationSettings: { ...config.quotationSettings, ...settings } }, now);
}

// ---- the builder's effective catalogue ----------------------------------------------------------------
// Master template products with this builder's deltas applied, plus the builder's own products.
// masterProducts: lib/product-library records ({ productCode, productName, supplier, ... }).
// masterPrice(product) -> number | null lets the caller use the application's own price resolution.
export function effectiveCatalogue(config, masterProducts = [], { masterPrice = (product) => amount(product.clientPrice ?? product.price), includeHidden = false } = {}) {
  assertBuilderConfig(config);
  const deltas = new Map(config.products.filter((product) => product.source === "master").map((product) => [product.masterProductCode, product]));
  const supplierName = (id) => supplierById(config, id)?.name || "";
  const view = [];
  for (const master of masterProducts) {
    const delta = deltas.get(master.productCode);
    const merged = { supplierId: "", supplierSku: master.sku || master.model || "", categoryKey: master.categoryKey || "", familyKey: master.familyKey || "", ...(delta || {}) };
    const price = sellPriceFor(config, merged, masterPrice(master));
    const enabled = delta?.enabled !== false && master.active !== false;
    if (!enabled && !includeHidden) continue;
    view.push({
      productId: master.productCode, source: "master", masterProductCode: master.productCode, customised: Boolean(delta),
      name: delta?.name || master.productName || "", description: delta?.description || master.description || "",
      brand: delta?.brand || master.brand || "", range: delta?.range || master.range || "", familyKey: merged.familyKey, categoryKey: merged.categoryKey,
      unit: delta?.unit || master.priceUnit || "", imageUrl: delta?.imageUrl || master.primaryImageUrl || "",
      selectionSlotIds: delta?.selectionSlotIds || master.selectionSlotIds || [],
      supplierId: merged.supplierId, supplierName: supplierName(merged.supplierId) || master.supplier || "", supplierSku: merged.supplierSku,
      cost: amount(delta?.cost), ...price, availability: delta?.availability || "", leadTimeDays: delta?.leadTimeDays ?? null, enabled,
    });
  }
  for (const product of config.products) {
    if (product.source !== "builder") continue;
    const enabled = !product.removed && product.active !== false && product.enabled !== false;
    if (!enabled && !includeHidden) continue;
    view.push({
      productId: product.id, source: "builder", masterProductCode: "", customised: true,
      name: product.name, description: product.description || "", brand: product.brand || "", range: product.range || "", familyKey: product.familyKey || "", categoryKey: product.categoryKey || "",
      unit: product.unit || "", imageUrl: product.imageUrl || "", selectionSlotIds: product.selectionSlotIds || [],
      supplierId: product.supplierId || "", supplierName: supplierName(product.supplierId), supplierSku: product.supplierSku || "",
      cost: amount(product.cost), ...sellPriceFor(config, product), availability: product.availability || "", leadTimeDays: product.leadTimeDays ?? null, enabled,
      removed: product.removed === true, replacedBy: product.replacedBy || "",
    });
  }
  return view;
}
export const catalogueProduct = (catalogue, productId) => catalogue.find((product) => product.productId === productId) || null;

// What is wrong with a configuration, for the builder to fix. Nothing here is repaired silently.
export function validateBuilderConfig(config, { masterProductCodes = null } = {}) {
  assertBuilderConfig(config);
  const problems = [];
  const supplierIds = new Set(config.suppliers.map((supplier) => supplier.id));
  const productIds = new Set([...config.products.filter((product) => product.source === "builder" && !product.removed).map((product) => product.id), ...(masterProductCodes || [])]);
  const keys = new Map();
  for (const product of config.products) {
    if (product.supplierId && !supplierIds.has(product.supplierId)) problems.push({ code: "PRODUCT_SUPPLIER_MISSING", productId: product.id });
    const key = product.removed ? "" : productMatchKey(product);
    if (key && keys.has(key)) problems.push({ code: "DUPLICATE_SUPPLIER_SKU", productId: product.id, duplicateOf: keys.get(key) });
    if (key) keys.set(key, product.id);
    if (masterProductCodes && product.source === "master" && !masterProductCodes.has(product.masterProductCode)) problems.push({ code: "MASTER_PRODUCT_WITHDRAWN", productId: product.id, masterProductCode: product.masterProductCode });
  }
  for (const schedule of config.inclusionSchedules) for (const item of schedule.items) {
    if (item.productId && masterProductCodes && !productIds.has(item.productId)) problems.push({ code: "INCLUSION_PRODUCT_MISSING", scheduleId: schedule.id, itemId: item.id, productId: item.productId });
  }
  return problems;
}
