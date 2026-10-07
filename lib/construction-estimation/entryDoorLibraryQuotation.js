import { getMasterProducts, toCanonicalProductContract } from "../product-library/catalogueService.js";

const ENTRY_DOOR_BRANDS = new Set(["Hume Doors & Timber", "Corinthian Doors"]);

// Use the same canonical records as Product Library and Client Selections. Glass
// options also belong to entry-doors, but are not additional door designs.
export function entryDoorLibraryQuoteRows(section = "DOORS") {
  return getMasterProducts()
    .filter((product) => product.familyKey === "entry-doors"
      && product.attributes?.recordType === "entry_door_design"
      && ENTRY_DOOR_BRANDS.has(product.manufacturer || product.brand)
      && product.active !== false && !product.discontinued && !product.archived)
    .map((product) => {
      const canonical = toCanonicalProductContract(product);
      // Quotation Builder rates are ex GST (it adds GST itself); a GST-inclusive price arrives / 1.1.
      const rate = canonical.price == null ? null : canonical.priceIncludesGst ? Math.round((canonical.price / 1.1) * 10000) / 10000 : canonical.price;
      const snapshot = JSON.parse(JSON.stringify(product));
      const sizes = snapshot.attributes?.sizes || [];
      const notes = [
        sizes.length ? `Available sizes: ${sizes.join("; ")}` : "",
        canonical.price == null ? "Quote required" : "",
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
        sourceOfRate: canonical.price == null ? "Quote required" : "Product Library",
        quoteRequired: canonical.price == null,
        priceStatus: canonical.priceStatus,
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
