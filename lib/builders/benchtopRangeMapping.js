// Supplier -> Supplier Price Group -> GR8 canonical quotation range.
//
// A benchtop surface is priced on the Quotation Builder row of its canonical range (Base Range
// Stone, Mid Range Stone, High End Stone, ...). Suppliers publish their own price groups instead
// (Stone Ambassador "Prestige", Caesarstone "M1", Smartstone "Deluxe"). Which canonical range a
// supplier's group belongs to is a commercial decision of the builder: it is configured here once
// per builder and every product in that group inherits it. NOTHING is mapped by default - an
// unmapped group is reported as unmapped, never placed on a guessed tier.
//
// Stored per builder workspace: { groups: { [groupKey]: { rangeKey, supplier, priceGroup, updatedAt } } }

import { BENCHTOP_RANGES } from "../construction-estimation/cabinetryRequirements.js";
import { tenantStorageKey } from "./tenantScope.js";

export const BENCHTOP_RANGE_MAPPING_STORAGE_KEY = "gr8:builder-benchtop-range-mapping";
let storageAdapter = null;
export function setBenchtopRangeMappingStorage(adapter) { storageAdapter = adapter || null; }
function storage() {
  if (storageAdapter) return storageAdapter;
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  const map = new Map();
  storageAdapter = { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)) };
  return storageAdapter;
}

const text = (value) => String(value ?? "").trim();
const slug = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const validRange = (key) => BENCHTOP_RANGES.some((range) => range.key === key);

// The supplier's own published price group. "Confirm Category" is the catalogue saying the
// supplier has not published one for that product.
export function supplierPriceGroupOf(product = {}) {
  const group = text(product.priceGroup || product.supplierPriceGroup);
  return /^confirm/i.test(group) ? "" : group;
}

// What a product is mapped by: its supplier price group, or - where the supplier publishes none -
// its collection, so individual colours are never mapped one at a time.
export function benchtopPriceGroupKey(product = {}) {
  const group = supplierPriceGroupOf(product);
  return group ? `${slug(product.supplier)}|${slug(group)}` : `${slug(product.supplier)}|collection-${slug(product.collection || product.range || product.materialType || "unspecified")}`;
}

// Every supplier price group in a catalogue: [{ key, supplier, priceGroup, label, published, products, examples }].
export function supplierPriceGroups(products = []) {
  const groups = new Map();
  products.forEach((product) => {
    const key = benchtopPriceGroupKey(product);
    const priceGroup = supplierPriceGroupOf(product);
    const entry = groups.get(key) || { key, supplier: text(product.supplier), priceGroup, published: Boolean(priceGroup), label: priceGroup || `${text(product.collection || product.materialType) || "Unspecified"} (no supplier price group published)`, materialType: text(product.materialType), products: 0, examples: [] };
    entry.products += 1;
    if (entry.examples.length < 3) entry.examples.push(text(product.colourName));
    groups.set(key, entry);
  });
  return [...groups.values()].sort((a, b) => a.supplier.localeCompare(b.supplier) || Number(b.published) - Number(a.published) || a.label.localeCompare(b.label));
}

export function getBuilderBenchtopRangeMapping(organisationId = "") {
  if (!organisationId) return { groups: {} };
  let entry;
  try { entry = JSON.parse(storage().getItem(tenantStorageKey(BENCHTOP_RANGE_MAPPING_STORAGE_KEY, organisationId)) || "null"); } catch { entry = null; }
  const groups = Object.fromEntries(Object.entries(entry?.groups || {}).filter(([, value]) => validRange(value?.rangeKey)));
  return { groups, updatedAt: entry?.updatedAt || "" };
}

// groups: { [groupKey]: rangeKey | "" } - an empty range removes the mapping. Returns the new mapping.
export function saveBuilderBenchtopRangeMapping(organisationId = "", groups = {}, { catalogue = [], now = new Date().toISOString() } = {}) {
  if (!organisationId) throw Error("A builder workspace is required to save benchtop price group mappings.");
  const known = new Map(supplierPriceGroups(catalogue).map((group) => [group.key, group]));
  const current = getBuilderBenchtopRangeMapping(organisationId).groups;
  const next = { ...current };
  Object.entries(groups).forEach(([key, rangeKey]) => {
    if (!validRange(rangeKey)) { delete next[key]; return; }
    if (current[key]?.rangeKey === rangeKey) return;
    next[key] = { rangeKey, supplier: known.get(key)?.supplier || current[key]?.supplier || "", priceGroup: known.get(key)?.priceGroup || current[key]?.priceGroup || "", updatedAt: now };
  });
  storage().setItem(tenantStorageKey(BENCHTOP_RANGE_MAPPING_STORAGE_KEY, organisationId), JSON.stringify({ groups: next, updatedAt: now }));
  return getBuilderBenchtopRangeMapping(organisationId);
}

export const mappedBenchtopRangeKey = (mapping = { groups: {} }, groupKey = "") => (validRange(mapping?.groups?.[groupKey]?.rangeKey) ? mapping.groups[groupKey].rangeKey : "");
