// Master product filter matching for the Product Library browse/manage views.
// Extracted from pages/modules/builders/product-library.js; logic unchanged.
import { matchesFurnitureFilters } from "./doorFurnitureVariants.js";
import { productBelongsToCatalogueSection } from "./catalogueSectionRules.js";
import {
  PRODUCT_LIBRARY_CATALOGUE_SECTIONS,
  getProductLibraryRoomCategory,
  productBelongsToRoom,
  productBelongsToRoomCategory,
  resolveProductLibrarySectionForFamily,
  resolveQuotationBuilderMappingForProduct,
} from "./productLibraryTaxonomy.js";

export function masterProductMatchesFilters(product, filters) {
  if ((product.familyKey === 'door-hardware' || product.attributes?.handleUse === 'internal-door') && !matchesFurnitureFilters(product, filters)) return false;
  const search = String(filters.search || "").trim().toLowerCase();
  const haystack = [product.productName, product.brand, product.manufacturer, product.supplier, product.range, product.model, product.sku, product.productCode, ...(product.attributes?.controlledVariants || []).map(v=>v.productCode)].filter(Boolean).join(" ").toLowerCase();
  if (search && !haystack.includes(search)) return false;
  if (filters.area && product.topLevelArea !== filters.area) return false;
  if (filters.section) {
    const section = PRODUCT_LIBRARY_CATALOGUE_SECTIONS.find((item) => item.key === filters.section);
    const quotationMapping = resolveQuotationBuilderMappingForProduct(product);
    const productSection = resolveProductLibrarySectionForFamily(product.familyKey || product.familyId || "");
    const sectionMatches = quotationMapping.quotationSectionId
      ? quotationMapping.quotationSectionId === filters.section
      : productSection?.key === filters.section || productBelongsToCatalogueSection(product, section);
    if (section && !sectionMatches) return false;
  }
  if (filters.category) {
    const roomCategory = getProductLibraryRoomCategory(filters.category, filters.room || filters.area);
    if (roomCategory) {
      if (!productBelongsToRoomCategory(product, roomCategory)) return false;
    } else if (product.categoryKey !== filters.category && product.category !== filters.category) {
      return false;
    }
  }
  if (filters.family && product.familyKey !== filters.family) return false;
  if (filters.manufacturer && product.manufacturer !== filters.manufacturer) return false;
  if (filters.brand && product.brand !== filters.brand) return false;
  if (filters.supplier && product.supplier !== filters.supplier) return false;
  if (filters.range && product.range !== filters.range) return false;
  if (filters.room && !productBelongsToRoom(product, filters.room)) return false;
  if (filters.region && !(product.regions || []).includes("AU") && !(product.regions || []).includes(filters.region)) return false;
  if (filters.imageStatus && product.imageStatus !== filters.imageStatus) return false;
  if (filters.priceStatus && product.priceStatus !== filters.priceStatus) return false;
  if (filters.ownership === "builder-private" && !product.isCustom && !product.organisationId && !product.builderId) return false;
  if (filters.ownership === "platform-master" && (product.isCustom || product.organisationId || product.builderId)) return false;
  if (filters.clientSelectable) {
    const selectable = product.clientSelectable ?? product.attributes?.clientSelectable ?? product.attributes?.selectableStatus !== "reference-only";
    if (filters.clientSelectable === "yes" && selectable === false) return false;
    if (filters.clientSelectable === "no" && selectable !== false) return false;
  }
  if (filters.quotationEnabled) {
    const quotationEnabled = product.quotationEnabled ?? product.attributes?.quotationEnabled ?? true;
    if (filters.quotationEnabled === "yes" && quotationEnabled === false) return false;
    if (filters.quotationEnabled === "no" && quotationEnabled !== false) return false;
  }
  if (filters.status === "active" && product.active === false) return false;
  if (filters.status === "inactive" && product.active !== false && product.archived !== true) return false;
  if (filters.status === "discontinued" && !product.discontinued) return false;
  return true;
}
