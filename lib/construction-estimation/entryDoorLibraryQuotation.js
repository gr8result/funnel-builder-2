import { getMasterProducts, toCanonicalProductContract } from "../product-library/catalogueService.js";
import supplierPrices from "../../data/pricing/supplier-prices.json";

const ENTRY_DOOR_BRANDS = new Set(["Hume Doors & Timber", "Corinthian Doors"]);
// Doors priced from a supplier's store (data/pricing/supplier-prices.json; rate applied by ownerQuotePrices.js).
const SUPPLIER_PRICED_DOORS = new Set(Object.keys(supplierPrices.entryDoors || {}));

function hasVerifiedLibraryPrice(product) {
  const canonical = toCanonicalProductContract(product);
  return canonical.price != null
    && ["supplier_price", "catalogue_rrp"].includes(canonical.priceSource)
    && typeof canonical.priceIncludesGst === "boolean"
    && Boolean(canonical.priceUpdatedAt && canonical.sourceUrl);
}

function entryDoorDesigns() {
  return getMasterProducts().filter((product) => product.familyKey === "entry-doors"
    && product.attributes?.recordType === "entry_door_design"
    && ENTRY_DOOR_BRANDS.has(product.manufacturer || product.brand)
    && product.active !== false && !product.discontinued && !product.archived);
}

// Owner instruction 11 Nov 2026: the quotation lists only doors a regular supplier prices (a verified
// Product Library price or a supplier store price). The Product Library records are not changed.
export function entryDoorHasQuotePrice(product) {
  return SUPPLIER_PRICED_DOORS.has(product.productId) || hasVerifiedLibraryPrice(product);
}

// Removes saved DOORS catalogue rows for doors no regular supplier prices, unless the builder has used
// the row (a quantity, or a rate of their own). Returns the same object when nothing is removed.
// The catalogue and the supplier price list do not change while the app runs: worked out once.
let unpricedEntryDoorIds = null;
export function withoutUnpricedEntryDoors(quotation = {}) {
  unpricedEntryDoorIds ||= new Set(entryDoorDesigns().filter((product) => !entryDoorHasQuotePrice(product)).map((product) => product.productId));
  const unpriced = unpricedEntryDoorIds;
  const used = (row) => Number(String(row.quantity ?? "").replace(/[$,s]/g, "")) > 0 || [row.manualRate, row.supplierQuote, row.quotedSupplierRate].some((value) => String(value ?? "").trim());
  let changed = false;
  const next = Object.fromEntries(Object.entries(quotation || {}).map(([name, section]) => {
    if (!Array.isArray(section?.rows)) return [name, section];
    const rows = section.rows.filter((row) => !(row?.entryDoorLibraryRow && unpriced.has(row.canonicalProductId) && !used(row)));
    if (rows.length === section.rows.length) return [name, section];
    changed = true;
    return [name, { ...section, rows }];
  }));
  return changed ? next : quotation;
}

// Use the same canonical records as Product Library and Client Selections. Glass
// options also belong to entry-doors, but are not additional door designs.
export function entryDoorLibraryQuoteRows(section = "DOORS") {
  return entryDoorDesigns()
    .filter(entryDoorHasQuotePrice)
    .map((product) => {
      const canonical = toCanonicalProductContract(product);
      const verifiedPrice = hasVerifiedLibraryPrice(product);
      // Quotation Builder rates are ex GST; an estimate or unknown basis remains quote-required.
      const rate = !verifiedPrice ? null : canonical.priceIncludesGst ? Math.round((canonical.price / 1.1) * 10000) / 10000 : canonical.price;
      const snapshot = JSON.parse(JSON.stringify(product));
      const sizes = snapshot.attributes?.sizes || [];
      const notes = [
        sizes.length ? `Available sizes: ${sizes.join("; ")}` : "",
        !verifiedPrice ? "Quote required" : "",
      ].filter(Boolean).join(". ");
      return {
        id: `quote-entry-door-product-${product.productId}`,
        section,
        item: product.productName,
        quantity: "",
        importedQuantity: "",
        quantityKey: "",
        unit: product.priceUnit,
        excelRate: rate ?? "",
        supplierCatalogueRate: rate ?? "",
        quotedSupplierRate: "",
        manualRate: "",
        supplierQuote: "",
        sourceOfRate: !verifiedPrice ? "Quote required" : "Product Library",
        quoteRequired: !verifiedPrice,
        priceStatus: !verifiedPrice ? "quote_required" : canonical.priceStatus,
        priceSource: canonical.priceSource,
        priceUpdatedAt: canonical.priceUpdatedAt,
        lineType: "Standard rate item",
        active: true,
        importedCost: "",
        formulas: {},
        autoQuantity: false,
        quantityManualOverride: false,
        entryDoorLibraryRow: true,
        canonicalProductId: product.productId,
        productCode: product.productCode,
        productName: product.productName,
        productDescription: product.description,
        supplier: product.supplier,
        brand: product.brand,
        manufacturer: product.manufacturer,
        sku: product.sku,
        model: product.model,
        range: product.range,
        doorStyle: product.attributes.design,
        size: product.size,
        sizes,
        variants: snapshot.variants,
        productImageUrl: product.primaryImageUrl,
        thumbnailUrl: product.thumbnailUrl,
        productLibraryFamilyKey: product.familyKey,
        productLibraryCatalogueOwner: "product-library",
        productLibrarySnapshot: snapshot,
        canonicalMappingStatus: "matched",
        rawText: product.description,
        notes,
      };
    });
}

function productIdentities(row) {
  return [row, row.productLibrarySnapshot, row.selectedDetails, row.selected_details]
    .filter(Boolean)
    .flatMap((record) => [record.canonicalProductId, record.productId, record.productCode, record.product_id, record.product_code])
    .filter(Boolean);
}

// Append only missing products. A saved product may already be in a DOORS
// subsection or carry a different quote-row ID; preserve it and all its edits.
export function withEntryDoorLibraryQuotation(quotation = {}) {
  quotation = withoutUnpricedEntryDoors(quotation);
  const sectionName = Object.keys(quotation).find((name) => /^(doors|entrance doors)$/i.test(name.replace(/\s*\(\d+\)\s*$/, "").trim())) || "DOORS";
  const rows = Object.values(quotation).flatMap((section) => section?.rows || []);
  const rowIds = new Set(rows.map((row) => row.id));
  const identities = new Set(rows.flatMap(productIdentities));
  const libraryRows = entryDoorLibraryQuoteRows(sectionName);
  // Saved Product Library rows take the current Product Library price. The builder's own manualRate,
  // quotedSupplierRate, supplierQuote, quantity and every other edit are left exactly as saved.
  const libraryById = new Map(libraryRows.map((row) => [row.canonicalProductId, row]));
  let refreshed = false;
  const priced = Object.fromEntries(Object.entries(quotation).map(([name, section]) => {
    if (!Array.isArray(section?.rows)) return [name, section];
    const nextRows = section.rows.map((row) => {
      const library = row?.entryDoorLibraryRow ? libraryById.get(row.canonicalProductId) : null;
      if (!library || (String(row.excelRate ?? "") === String(library.excelRate) && row.sourceOfRate === library.sourceOfRate)) return row;
      refreshed = true;
      return { ...row, excelRate: library.excelRate, supplierCatalogueRate: library.supplierCatalogueRate, sourceOfRate: library.sourceOfRate, quoteRequired: library.quoteRequired, priceStatus: library.priceStatus, priceSource: library.priceSource, priceUpdatedAt: library.priceUpdatedAt, notes: library.notes };
    });
    return [name, nextRows === section.rows ? section : { ...section, rows: nextRows }];
  }));
  if (refreshed) quotation = priced;
  const missing = libraryRows.filter((row) => {
    if (rowIds.has(row.id) || productIdentities(row).some((id) => identities.has(id))) return false;
    rowIds.add(row.id);
    productIdentities(row).forEach((id) => identities.add(id));
    return true;
  });
  if (!missing.length) return quotation;
  const section = quotation[sectionName] || { collapsed: true, rows: [] };
  return { ...quotation, [sectionName]: { ...section, rows: [...(section.rows || []), ...missing] } };
}
