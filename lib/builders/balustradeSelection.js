// Client Selections -> Balustrades: configurable systems priced per lineal metre.
//
//   Product Library balustrade system (AU-BALUSTRADE-SYSTEMS-CATALOGUE + ProtectorAl records)
//     -> configuration (mounting, finish, glass / timber options the system supports)
//     -> LM per location (Balcony, Stairs, Void, ...)
//     -> line value = indicative $/LM x LM, compared with the project's balustrade allowance/LM.
//
// Lines use the shared allocation model (plumbingFixtureAllocation.js) with unit "LM", so the
// existing connector writes them to the Quotation Builder and Procurement unchanged. The rate is an
// ESTIMATING allowance (rateBasis "indicative_estimating_rate"), never a supplier quote.
import { numberValue, roundMoney } from "./selectionBudget.js";
import { plumbingLineWithTotals, plumbingLocationKey } from "./plumbingFixtureAllocation.js";
import { INDICATIVE_RATE_BASIS } from "./allocatedSelectionQuotation.js";

export const BALUSTRADE_UNIT = "LM";

export const BALUSTRADE_LOCATIONS = ["Internal Stair", "Void", "Balcony", "Deck", "Upper Patio", "Verandah", "External Stair"];

export const BALUSTRADE_FILTERS = [
  { key: "material", label: "Material" },
  { key: "glassSystem", label: "Glass System" },
  { key: "mounting", label: "Mounting" },
  { key: "application", label: "Application" },
  { key: "finish", label: "Finish" },
];

function attributesOf(product = {}) {
  return product.attributes || product.metadata?.productEntity?.attributes || {};
}

export function isBalustradeSystem(product = {}) {
  const entity = product.metadata?.productEntity || product;
  return (entity.familyKey || product.familyKey) === "balustrades"
    && attributesOf(product).recordType === "balustrade_system"
    && entity.active !== false && !entity.archived && !entity.discontinued;
}

export function balustradeSystems(products = []) {
  const seen = new Set();
  return products
    .filter(isBalustradeSystem)
    .filter((product) => {
      const code = product.productCode || product.metadata?.productEntity?.productCode || product.id;
      if (seen.has(code)) return false;
      seen.add(code);
      return true;
    })
    .sort((left, right) => (numberValue(attributesOf(left).clientSelectionOrder) || 999) - (numberValue(attributesOf(right).clientSelectionOrder) || 999));
}

// Mounting options are stored with detail ("Top mounted (spigot)"); the filter uses the family.
export function mountingFamily(option = "") {
  const text = String(option).toLowerCase();
  if (text.includes("spigot")) return "Spigot";
  if (text.includes("channel")) return "Channel";
  if (text.includes("pin") || text.includes("standoff")) return "Pin Fixed";
  if (text.includes("stair")) return "Stair Mounted";
  if (text.includes("face") || text.includes("fascia")) return "Face Mounted";
  if (text.includes("side")) return "Side Mounted";
  return "Top Mounted";
}

function mountingFamilies(product) {
  const options = attributesOf(product).mountingOptions || [];
  const families = new Set(options.map(mountingFamily));
  options.forEach((option) => {
    const text = option.toLowerCase();
    if (text.startsWith("top")) families.add("Top Mounted");
    if (text.startsWith("side")) families.add("Side Mounted");
    if (text.startsWith("face")) families.add("Face Mounted");
  });
  return Array.from(families);
}

function applicationFamilies(product) {
  return (attributesOf(product).applications || []).map((item) => (/stairs/i.test(item) ? "Stairs" : /verandah|patio/i.test(item) ? "Patio / Verandah" : item));
}

function finishFamilies(product) {
  return (attributesOf(product).finishOptions || []).map((item) => {
    const text = item.toLowerCase();
    if (text.includes("stainless")) return "Stainless";
    if (text.includes("black")) return "Black";
    if (text.includes("white")) return "White";
    if (text.includes("paint")) return "Painted";
    if (text.includes("stain") || text.includes("clear") || text.includes("natural")) return "Stained / Natural";
    if (text.includes("anodised")) return "Anodised";
    return "Powder-coat colours";
  });
}

function facetValues(product, key) {
  const attributes = attributesOf(product);
  if (key === "material") return [attributes.material].filter(Boolean);
  if (key === "glassSystem") return [attributes.glassSystem].filter(Boolean);
  if (key === "mounting") return mountingFamilies(product);
  if (key === "application") return applicationFamilies(product);
  if (key === "finish") return finishFamilies(product);
  return [];
}

export function balustradeFilterOptions(systems = []) {
  return Object.fromEntries(BALUSTRADE_FILTERS.map(({ key }) => [key, Array.from(new Set(systems.flatMap((system) => facetValues(system, key)))).sort()]));
}

export function filterBalustradeSystems(systems = [], filters = {}) {
  return systems.filter((system) => BALUSTRADE_FILTERS.every(({ key }) => !filters[key] || facetValues(system, key).includes(filters[key])));
}

export function balustradeRate(product = {}) {
  const rate = attributesOf(product).estimatingRate || {};
  const value = numberValue(rate.ratePerLm ?? product.selectedCost ?? product.clientPrice);
  return value > 0 ? roundMoney(value) : null;
}

// ------------------------------------------------------------------------------------------
// Project data: the estimate's balustrade rows give the project LM and the $/LM allowance.
// ------------------------------------------------------------------------------------------
function moneyNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

export function projectBalustradeEstimate(workbook = {}) {
  const quotation = workbook?.quotation || {};
  const rows = Object.entries(quotation).flatMap(([sectionName, section]) => (Array.isArray(section?.rows) ? section.rows : []).map((row) => ({ sectionName, row })));
  const lines = rows
    .filter(({ row }) => /balustrad/i.test(String(row?.item || row?.description || "")) && row?.source !== "client-selections-allocated-product")
    .map(({ sectionName, row }) => ({
      sectionName,
      item: String(row.item || row.description || "").trim(),
      unit: String(row.unit || "").toUpperCase(),
      quantity: numberValue(row.qty ?? row.quantity),
      ratePerUnit: moneyNumber(row.manualRate) ?? moneyNumber(row.excelRate) ?? moneyNumber(row.rate),
    }));
  const lmLines = lines.filter((line) => line.unit === "LM");
  const totalLm = Math.round(lmLines.reduce((total, line) => total + line.quantity, 0) * 100) / 100;
  return { lines, lmLines, totalLm, source: totalLm > 0 ? "Project Estimate" : "" };
}

// The estimate row that applies to a system's material: its $/LM is the project allowance.
export function balustradeAllowanceForSystem(product = {}, estimate = projectBalustradeEstimate()) {
  const material = String(attributesOf(product).material || "").toLowerCase();
  const pattern = material === "glass" ? /glass/i
    : material === "timber" ? /timber/i
      : /cable|wire|steel|alumin|metal/i;
  const candidates = (estimate.lmLines || []).filter((line) => line.ratePerUnit > 0);
  const match = candidates.find((line) => pattern.test(line.item)) || null;
  return match ? { allowancePerLm: roundMoney(match.ratePerUnit), source: `${match.sectionName}: ${match.item}` } : { allowancePerLm: 0, source: "" };
}

// ------------------------------------------------------------------------------------------
// Configuration + lines
// ------------------------------------------------------------------------------------------
export function defaultBalustradeConfiguration(product = {}) {
  const attributes = attributesOf(product);
  const timber = attributes.timberOptions || null;
  return {
    mounting: attributes.defaultMounting || attributes.mountingOptions?.[0] || "",
    finish: attributes.finishOptions?.[0] || "",
    glass: attributes.glassOptions?.[0] || "",
    ...(timber ? { timber: Object.fromEntries(Object.entries(timber).map(([key, values]) => [key, values?.[0] || ""])) } : {}),
  };
}

// Only combinations the system record supports are accepted.
export function validateBalustradeConfiguration(product = {}, configuration = {}) {
  const attributes = attributesOf(product);
  const errors = [];
  const check = (label, value, allowed = []) => { if (allowed.length && !allowed.includes(value)) errors.push(`${label} "${value}" is not offered for this system.`); };
  check("Mounting", configuration.mounting, attributes.mountingOptions || []);
  check("Finish", configuration.finish, attributes.finishOptions || []);
  if ((attributes.glassOptions || []).length) check("Glass", configuration.glass, attributes.glassOptions);
  Object.entries(attributes.timberOptions || {}).forEach(([key, values]) => check(key, configuration.timber?.[key], values || []));
  return errors;
}

export function balustradeLineId(product = {}, configuration = {}) {
  const code = product.productCode || product.metadata?.productEntity?.productCode || product.id || "balustrade";
  const variant = [configuration.mounting, configuration.finish, configuration.glass, ...Object.values(configuration.timber || {})].filter(Boolean).join("|");
  return `${code}::${plumbingLocationKey(variant) || "default"}`;
}

export function balustradeLine(product = {}, { configuration = defaultBalustradeConfiguration(product), allocations = [], allowancePerLm = 0, allowanceSource = "", quantitySource = "" } = {}) {
  const entity = product.metadata?.productEntity || product;
  const attributes = attributesOf(product);
  const rate = balustradeRate(product);
  const summary = [attributes.systemType, configuration.mounting, configuration.finish, configuration.glass].filter(Boolean).join(" · ");
  return plumbingLineWithTotals({
    lineId: balustradeLineId(product, configuration),
    productId: product.productId || entity.productId || product.id || "",
    productCode: entity.productCode || product.productCode || "",
    supplierCode: attributes.referenceSystem?.name || entity.model || "",
    productName: product.productName || entity.productName || attributes.systemType || "Balustrade system",
    brand: product.brand || entity.brand || "",
    supplier: product.supplier || entity.supplier || "",
    model: entity.model || "",
    colour: configuration.finish || "",
    finish: configuration.finish || "",
    imageUrl: product.imageUrl || product.primaryImageUrl || entity.primaryImageUrl || "",
    officialProductURL: attributes.referenceSystem?.url || entity.officialProductUrl || "",
    priceBasis: attributes.priceBasis || "Indicative estimating rate inc GST (supply and install)",
    rateBasis: INDICATIVE_RATE_BASIS,
    rateSetAt: attributes.estimatingRate?.setAt || "",
    unit: BALUSTRADE_UNIT,
    unitPrice: rate,
    unitAllowance: numberValue(allowancePerLm),
    allowanceSource,
    quantitySource,
    priceState: "Indicative Rate",
    systemType: attributes.systemType || "",
    material: attributes.material || "",
    glassSystem: attributes.glassSystem || "",
    configuration,
    configurationSummary: summary,
    allocations: (allocations || []).map((allocation) => ({ ...allocation, locationKey: allocation.locationKey || plumbingLocationKey(allocation.location) })),
  });
}
