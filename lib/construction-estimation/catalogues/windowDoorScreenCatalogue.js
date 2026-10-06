import Papa from "papaparse";
import templateRows from "./data/trendWindowsStandardSizesAndScreensPricedTemplate.json";

// Template catalogue: the supplied Trend national-size CSV, pre-converted to JSON (see
// data/trendWindowsStandardSizesAndScreensPricedTemplate.csv for the original/provenance) and
// imported the same way the legacy Excel catalogue is (estimateBuilderWorkbookDefaults.js's own
// `import importedWorkbook from "./importedExcelWorkbookTemplate.json"`) so it bundles for the
// browser instead of needing a runtime filesystem read. Every price carries its own
// price_status/price_basis straight from the CSV - never re-labelled as verified. A builder's own
// supplier CSV (same column shape) can later be merged in via applyWindowCatalogueOverrides()
// below, matched by `code`, without touching this file. Runtime CSV parsing (Papa, the same
// dependency Product Library's own productLibraryCsv.js already uses) is reserved for that
// supplier-upload path only - see parseSupplierWindowCatalogueCsv().

// openingStyle (from AI Plan Takeoff's own subType, see WINDOW_SUBTYPE_LABELS / DOOR_SUBTYPE_LABELS
// in lib/construction-estimation/takeoffMaterialQuantities.js) -> the exact category/product_type
// strings this catalogue's own CSV rows use. Kept here (not in the takeoff module) because it is
// catalogue-shape knowledge, not takeoff knowledge - the takeoff never needs to know what a
// catalogue calls its own product types.
export const OPENING_STYLE_TO_CATALOGUE_PRODUCT_TYPE = Object.freeze({
  "Sliding Window": { category: "Window", productType: "Sliding Window" },
  "Double Hung Window": { category: "Window", productType: "Double Hung" },
  "Awning Window": { category: "Window", productType: "Awning" },
  "Louvre Window": { category: "Window", productType: "Louvre" },
  "Fixed Window": { category: "Window", productType: "Fixed Glass" },
  "Casement Window": { category: "Window", productType: "Casement" },
  // AI Plan Takeoff's DOOR_SUBTYPE_LABELS (takeoffMaterialQuantities.js) only distinguishes
  // 'SlidingGlass' (-> doorStyleLabel 'Sliding Glass Door') and 'Stacker' among glass sliding door
  // configurations today - there is no existing subtype code for "Centre Opening" or "Corner", so
  // those two catalogue product types (present in the CSV) are genuinely unreachable from the
  // takeoff until the AI Plan Takeoff door editor grows those options. Not mapped here rather than
  // guessed, per "do not invent a product" - see the catalogue's own Centre Opening/Corner rows,
  // which remain available for a future explicit mapping once that takeoff data exists.
  "Glass Sliding Door": { category: "Glass Door", productType: "Glass Sliding Door - Single Opening Panel" },
  "Sliding Glass Door": { category: "Glass Door", productType: "Glass Sliding Door - Single Opening Panel" },
  "Stacker Door": { category: "Glass Door", productType: "Glass Sliding Door - Stacker" },
});

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// One catalogue product per CSV row, PLUS one synthetic flyscreen product and one synthetic
// security-screen product derived from that same row's own paired flyscreen_*/security_screen_*
// columns - never invented, never a different price than what the row itself already states. This
// is what lets FLYSCREENS/SECURITY SCREENS be genuinely separate, separately-quantifiable
// quotation line items instead of a column bolted onto the window row.
function buildCatalogueFromRows(rows) {
  const windows = [];
  const flyscreens = [];
  const securityScreens = [];
  (rows || []).forEach((row) => {
    if (!row.code) return;
    const heightMm = numberOrNull(row.height_mm);
    const widthMm = numberOrNull(row.width_mm);
    const basePrice = numberOrNull(row.estimated_base_price_ex_gst);
    const priceStatus = row.price_status || "ESTIMATED TEMPLATE PRICE — REPLACE WITH SUPPLIER CSV";
    const priceBasis = row.price_basis || "";
    const source = row.source || "";
    windows.push({
      code: row.code,
      category: row.category,
      productType: row.product_type,
      heightMm,
      widthMm,
      sizeDescription: row.size_description || "",
      glassType: row.glass_type || "",
      unit: "EACH",
      price: basePrice,
      priceStatus,
      priceBasis,
      source,
      supplier: "Trend",
      brand: "Trend",
    });
    const flyscreenPrice = numberOrNull(row.estimated_flyscreen_ex_gst);
    if (flyscreenPrice !== null && row.flyscreen_type) {
      flyscreens.push({
        code: `${row.code}-FS`,
        windowCode: row.code,
        category: "Flyscreen",
        productType: row.flyscreen_type,
        heightMm,
        widthMm,
        sizeDescription: row.size_description || "",
        unit: "EACH",
        price: flyscreenPrice,
        priceStatus,
        priceBasis,
        source,
        supplier: "Trend",
        brand: "Trend",
      });
    }
    const securityScreenPrice = numberOrNull(row.estimated_security_screen_ex_gst);
    if (securityScreenPrice !== null && row.security_screen_type) {
      securityScreens.push({
        code: `${row.code}-SS`,
        windowCode: row.code,
        category: "Security Screen",
        productType: row.security_screen_type,
        heightMm,
        widthMm,
        sizeDescription: row.size_description || "",
        unit: "EACH",
        price: securityScreenPrice,
        priceStatus,
        priceBasis,
        source,
        supplier: "Trend",
        brand: "Trend",
      });
    }
  });
  return { windows, flyscreens, securityScreens };
}

let cachedTemplateCatalogue = null;
export function loadTemplateWindowDoorScreenCatalogue() {
  if (cachedTemplateCatalogue) return cachedTemplateCatalogue;
  cachedTemplateCatalogue = buildCatalogueFromRows(templateRows);
  return cachedTemplateCatalogue;
}

// Parses a builder-supplied supplier CSV of the SAME column shape as the template CSV. Used by
// applyWindowCatalogueOverrides() below, never by the calculation engine directly.
export function parseSupplierWindowCatalogueCsv(csvText) {
  const result = Papa.parse(String(csvText || "").trim(), { header: true, skipEmptyLines: true });
  return buildCatalogueFromRows(result.data);
}

// Master -> override merge, matched by `code` (mirrors catalogueService.js's
// masterProductCode-keyed override layer used elsewhere in Product Library): a supplier row
// replaces the template row with the identical code; a supplier row with a NEW code is added;
// every template row with no matching supplier code is preserved unchanged. Never mutates its inputs.
export function applyWindowCatalogueOverrides(templateCatalogue, supplierCatalogue) {
  const merge = (templateList, supplierList) => {
    const byCode = new Map(templateList.map((item) => [item.code, item]));
    (supplierList || []).forEach((item) => byCode.set(item.code, item));
    return Array.from(byCode.values());
  };
  return {
    windows: merge(templateCatalogue.windows, supplierCatalogue.windows),
    flyscreens: merge(templateCatalogue.flyscreens, supplierCatalogue.flyscreens),
    securityScreens: merge(templateCatalogue.securityScreens, supplierCatalogue.securityScreens),
  };
}
