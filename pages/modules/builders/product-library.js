import { EXTERIOR_CATALOGUE_SECTIONS, exteriorSectionForProduct } from "../../../lib/product-library/exteriorCatalogueSections";
import { useDoorFurniturePicker } from '../../../components/estimate-builder/DoorFurniturePicker';
import VerifiedProductImage from '../../../components/product-library/VerifiedProductImage';
import { safeSelectionNavigate } from "../../../lib/navigation/selectionNavigation.js";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { Archive, ArrowLeft, Boxes, Check, Copy, Edit3, FileDown, FileUp, FolderOpen, ImagePlus, Package, Pencil, Plus, RefreshCw, Upload, X } from "lucide-react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import {
  AUSTRALIAN_REGIONS,
  BUILDER_PRODUCT_MODES,
  BUILDER_PRODUCT_TIERS,
  EXPLICIT_BUILDER_DISABLE_REASON,
  GARAGE_DOOR_SELECTION_KEY,
  MASTER_IMAGE_STATUSES,
  MASTER_PRICE_STATUSES,
  MASTER_PRODUCT_CATALOGUE_IMPORT_TEMPLATE,
  PRODUCT_ENTITY_FIELDS,
  PRODUCT_FAMILIES,
  PRODUCT_LIBRARY_IMPORT_COLUMNS,
  PRODUCT_LIBRARY_SELECTIONS_KEY,
  TAXONOMY_CATEGORY_DEFINITIONS,
  TOP_LEVEL_AREAS,
  builderEnablementState,
  createBuilderProductReference,
  exportMasterCatalogueCsv,
  exportMasterCatalogueJson,
  familyByKey,
  familyCatalogueStatus,
  familyIsLocked,
  isProductLibraryEligibleProduct,
  parseMasterProductCatalogueImport,
  previewMasterProductImport,
  commitMasterProductImport,
  normalizeMasterProductRecord,
  queryClientSelectableProducts,
  resolveProductLibraryImage,
  productLibrarySelectionsFromJobFile,
  selectionKeyForFamily,
  previewProductImportRows,
} from "../../../lib/product-library/catalogueModel";
import {
  addBuilderProduct,
  disableProduct,
  getBuilderEnablementRefs,
  getEffectiveProductCatalogue,
  getMasterProducts,
  updateBuilderProductOverride,
} from "../../../lib/product-library/catalogueService";
import {
  PRODUCT_LIBRARY_ROOMS,
  PRODUCT_LIBRARY_ROOM_CATEGORIES,
  PRODUCT_LIBRARY_CATALOGUE_SECTIONS,
  getProductLibraryRoom,
  getProductLibraryRoomCategories,
  getProductLibraryRoomCategory,
  getProductLibraryCatalogueSection,
  getProductLibrarySectionFamilies,
  productBelongsToRoom,
  productBelongsToRoomCategory,
  resolveProductLibrarySectionForFamily,
  resolveQuotationBuilderMappingForProduct,
} from "../../../lib/product-library/productLibraryTaxonomy";
import {
  PRODUCT_LIBRARY_EXCHANGE_COLUMNS,
  buildProductLibraryExportPackage,
  commitProductLibraryPackageImport,
  filterProductsForProductLibraryExchange,
  parseProductLibraryPackageFile,
  previewProductLibraryPackageImport,
  productLibraryExchangeTemplateRows,
} from "../../../lib/product-library/productLibraryExchange";
import { PRODUCT_LIBRARY_CABINETRY_BRAND_ASSETS } from "../../../lib/product-library/cabinetryCatalogueSelectors";
import {
  APPLIANCE_ELIGIBILITY_STATES,
  APPLIANCE_IMAGE_FALLBACK_LABEL,
  filterApplianceRecords,
  getApplianceBrandsByFamily,
  getApplianceFamilies,
  getApplianceModelsByFamilyAndBrand,
  getApplianceProductById,
  getApplianceRecordsByFamily,
  getApplianceRecordsRequiringVerification,
  getActiveProductLibraryApplianceRecords,
  getClientSelectableApplianceRecords,
  getApplianceBrands,
  getApplianceBrandByName,
  getLegacyQuotationCompatibleApplianceRecords,
  getPlatformMasterApplianceRecords,
} from "../../../lib/product-library/applianceCatalogueSelectors";
import { supabase } from "../../../utils/supabase-client";

// Product Library kitchen seed/import coverage includes AU-KITCHEN-PRODUCT-CATALOGUE.json.
const EMPTY_PRODUCT = {
  product_code: "",
  product_name: "",
  supplier_name: "",
  brand: "",
  range: "",
  model: "",
  description: "",
  colour: "",
  finish: "",
  size: "",
  texture: "",
  primary_image: "",
  official_product_url: "",
  specification_url: "",
  supplier_url: "",
  width: "",
  height: "",
  depth: "",
  variant_name: "",
  gallery_images: "",
  rrp: "",
  builder_cost: "",
  client_price: "",
  currency: "AUD",
  gst_treatment: "GST inclusive",
  price_unit: "",
  price_status: "price_pending",
  price_source_url: "",
  price_verified_at: "",
  image_source_url: "",
  image_status: "missing",
  image_verified_at: "",
  region: "QLD",
  price_effective_date: "",
  discontinued: false,
  archived: false,
  active: true,
};

const PRODUCT_LIBRARY_JOB_STORAGE_KEY = "gr8:product-library:job-file";
const DEFAULT_JOB_FILE_NAME = "product-library-selections.gr8job";

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function downloadJson(fileName, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadText(fileName, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  downloadBlob(fileName, blob);
}

function downloadBlob(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function money(value) {
  return Number(value || 0).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

function uniqueValues(values) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function masterProductMatchesFilters(product, filters) {
  const search = String(filters.search || "").trim().toLowerCase();
  const haystack = [product.productName, product.brand, product.manufacturer, product.supplier, product.range, product.model, product.sku, product.productCode].filter(Boolean).join(" ").toLowerCase();
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
    const roomCategory = getProductLibraryRoomCategory(filters.category);
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

function productPriceLabel(product) {
  const status = product.priceStatus || "price_pending";
  if (product.builderPrice != null) return money(product.builderPrice);
  if (status === "current") return money(product.clientPrice ?? product.rrp ?? product.normalizedUnitPrice);
  if (status === "quote_required") return "Quote required";
  if (status === "allowance_only") return "Allowance only";
  if (status === "expired") return "Price expired";
  return "Price pending";
}

function productUnitLabel(product = {}) {
  return product.priceUnit || product.unit || product.uom || "EACH";
}

function productEnabledLabel(product = {}, field = "clientSelectable") {
  const attributes = product.attributes || {};
  const value = product[field] ?? attributes[field] ?? (field === "quotationEnabled" ? true : attributes.selectableStatus !== "reference-only");
  return value === false ? "No" : "Yes";
}

function quotationSectionLabel(product = {}) {
  const mapping = resolveQuotationBuilderMappingForProduct(product);
  return mapping.quotationSection || "Unmapped";
}

function productCategoryLabel(product = {}) {
  if (product.sourceType === "canonical_cabinetry_workflow") return product.categoryKey;
  const category = PRODUCT_LIBRARY_ROOM_CATEGORIES.find((item) => productBelongsToRoomCategory(product, item));
  return category?.name || familyByKey(product.familyKey)?.displayName || product.category || product.categoryKey || "Uncategorised";
}

function catalogueProductSelectionKey(product = {}) {
  return product.productId || product.productCode || product.model || product.sku || "";
}

const CABINETRY_SECTION_KEY = "cabinetry-joinery";
const PLUMBING_SECTION_KEY = "plumbing-fixtures-tapware";
const LIGHTING_ELECTRICAL_SECTION_KEY = "lighting-electrical";
const CABINETRY_SUBCATEGORIES = [
  { key: "all", label: "All Cabinetry", fileName: "cabinetry-all.csv" },
  { key: "cabinetry-products", label: "Cabinetry Products", fileName: "cabinetry-products.csv" },
  { key: "cabinet-doors-panels", label: "Cabinet Doors & Panels", fileName: "cabinet-doors-panels.csv" },
  { key: "board-colours-finishes", label: "Board Colours & Finishes", fileName: "cabinet-board-colours-finishes.csv" },
  { key: "cabinet-handles", label: "Handles", fileName: "cabinet-handles.csv" },
  { key: "cabinet-hardware", label: "Cabinet Hardware", fileName: "cabinet-hardware.csv" },
  { key: "cabinet-benchtops", label: "Benchtops & Surfaces", fileName: "cabinet-benchtops.csv" },
  { key: "cabinet-accessories", label: "Cabinet Accessories", fileName: "cabinet-accessories.csv" },
];

const PLUMBING_SUBCATEGORIES = [
  { key: "all", label: "All Plumbing", fileName: "plumbing-fixtures-tapware-all.csv" },
  { key: "toilets", label: "Toilets", fileName: "plumbing-toilets.csv" },
  { key: "basins", label: "Basins", fileName: "plumbing-basins.csv" },
  { key: "baths", label: "Baths", fileName: "plumbing-baths.csv" },
  { key: "showers-screens", label: "Showers and Screens", fileName: "plumbing-showers-screens.csv" },
  { key: "kitchen-sinks", label: "Kitchen Sinks", fileName: "plumbing-kitchen-sinks.csv" },
  { key: "laundry-tubs", label: "Laundry Tubs", fileName: "plumbing-laundry-tubs.csv" },
  { key: "basin-mixers", label: "Basin Mixers", fileName: "tapware-basin-mixers.csv" },
  { key: "sink-mixers", label: "Sink Mixers", fileName: "tapware-sink-mixers.csv" },
  { key: "shower-mixers", label: "Shower Mixers", fileName: "tapware-shower-mixers.csv" },
  { key: "bath-mixers", label: "Bath Mixers", fileName: "tapware-bath-mixers.csv" },
  { key: "shower-outlets", label: "Shower Outlets", fileName: "tapware-shower-outlets.csv" },
  { key: "accessories", label: "Accessories", fileName: "plumbing-accessories.csv" },
];

const LIGHTING_ELECTRICAL_SUBCATEGORIES = [
  { key: "all", label: "All Lighting & Electrical", fileName: "lighting-electrical-all.csv" },
  { key: "interior-lighting", label: "Interior Lighting", fileName: "lighting-interior.csv" },
  { key: "exterior-lighting", label: "Exterior Lighting", fileName: "lighting-exterior.csv" },
  { key: "downlights", label: "Downlights", fileName: "lighting-downlights.csv" },
  { key: "pendant-lights", label: "Pendant Lights", fileName: "lighting-pendant-lights.csv" },
  { key: "wall-lights", label: "Wall Lights", fileName: "lighting-wall-lights.csv" },
  { key: "power-points", label: "Power Points", fileName: "electrical-power-points.csv" },
  { key: "switches", label: "Switches", fileName: "electrical-switches.csv" },
  { key: "fans", label: "Fans", fileName: "electrical-fans.csv" },
  { key: "smoke-alarms", label: "Smoke Alarms", fileName: "electrical-smoke-alarms.csv" },
  { key: "electrical-appliances-accessories", label: "Electrical Appliances/Accessories", fileName: "electrical-appliances-accessories.csv" },
];

const CATALOGUE_GROUP_SUBCATEGORIES = {
  roofing: EXTERIOR_CATALOGUE_SECTIONS.roofing.map(([key, label]) => ({ key, label, fileName: `roofing-${key}.csv` })),
  [CABINETRY_SECTION_KEY]: CABINETRY_SUBCATEGORIES,
  [PLUMBING_SECTION_KEY]: PLUMBING_SUBCATEGORIES,
  [LIGHTING_ELECTRICAL_SECTION_KEY]: LIGHTING_ELECTRICAL_SUBCATEGORIES,
};

const SECTION_EXPORT_FILE_NAMES = {
  appliances: "appliances-white-goods.csv",
  [CABINETRY_SECTION_KEY]: "cabinetry-all.csv",
  [PLUMBING_SECTION_KEY]: "plumbing-fixtures-tapware-all.csv",
  "doors-door-furniture": "doors-door-furniture.csv",
  windows: "windows.csv",
  roofing: "roofing.csv",
  cladding: "cladding.csv",
  flooring: "flooring.csv",
  tiles: "tiles.csv",
  painting: "painting.csv",
  [LIGHTING_ELECTRICAL_SECTION_KEY]: "lighting-electrical-all.csv",
  "fix-out": "fix-out.csv",
  "external-products": "external-products.csv",
};

function cabinetrySubcategoryForProduct(product = {}) {
  const assignedCategory = CABINETRY_SUBCATEGORIES.find((item) => item.label === product.categoryKey);
  if (assignedCategory) return assignedCategory.key;
  const familyKey = product.familyKey || product.familyId || "";
  const attributes = product.attributes || {};
  const canonicalType = String(attributes.canonicalType || attributes.categoryType || "").toLowerCase();
  const productType = String(product.productType || product.product_type || attributes.productType || "").toLowerCase();
  const text = [
    product.categoryKey,
    product.category,
    product.categoryId,
    product.section,
    product.sectionName,
    product.range,
    product.collection,
    product.productName,
    product.model,
    product.sku,
    product.productCode,
    product.description,
    product.sourceName,
    product.sourceType,
    attributes.fixtureType,
    attributes.handleUse,
    attributes.choiceType,
    attributes.productApplication,
    attributes.application,
    attributes.quotationMappingId,
  ].filter(Boolean).join(" ").toLowerCase();
  if (/oven|cooktop|rangehood|dishwasher|microwave|fridge|refrigerat|appliance/.test(familyKey) || /appliance catalogue|appliance pack|white goods/.test(text)) return "";
  if (["entry-doors", "garage-doors", "internal-doors", "door-hardware"].includes(familyKey)) return "";
  if (/entry door|external door|garage door|internal door|door furniture|mortice lock|deadbolt|smart lock|digital lock|door closer/.test(text)) return "";
  if (["stone-benchtops", "stone-20mm-tops", "stone-40mm-tops"].includes(familyKey) || /benchtop|stone benchtop|caesarstone|smartstone|neolith|stone ambassador/.test(text)) return "cabinet-benchtops";
  if (familyKey === "cabinet-finish" || canonicalType === "finish_product" || productType === "cabinet-finish" || /cabinet finish|board colour|board color|laminex|polytec|decorated panel|decorative board|colour collection/.test(text)) return "board-colours-finishes";
  if (familyKey === "handles") return /entry|external|door/.test(text) ? "" : "cabinet-handles";
  if (canonicalType === "handle_product" || productType === "handles" || /cabinet handle|handle house|pull handle|finger pull|sharkfin|channel pull/.test(text)) return /entry|external|door furniture/.test(text) ? "" : "cabinet-handles";
  if (canonicalType === "hardware_product" || productType === "hardware" || /blum|hinge|runner|hardware|soft-close|soft close|drawer runner|cabinet hardware/.test(text)) return "cabinet-hardware";
  if (canonicalType === "cabinet_unit" || productType === "cabinetry" || /cabinet unit|base unit|wall unit|overhead|pantry|vanity|cupboard|cabinet product|cabinetry product/.test(text)) return "cabinetry-products";
  if (/cabinet door|door panel|drawer front|end panel|appliance panel|kick panel|doors & panels|doors and panels/.test(text)) return "cabinet-doors-panels";
  if (familyKey === "cabinetry") return "cabinet-accessories";
  if (/cabinet|cabinetry|joinery|cleated shelving|bulkhead|shelving/.test(text)) return "cabinet-accessories";
  return "";
}

function productBelongsToCabinetryCatalogue(product = {}) {
  return cabinetrySubcategoryForProduct(product) !== "";
}

function productMatchesCabinetrySubcategory(product = {}, subcategoryKey = "all") {
  if (subcategoryKey === "cabinetry-products") return product.categoryKey === "Cabinetry Products";
  if (!productBelongsToCabinetryCatalogue(product)) return false;
  if (!subcategoryKey || subcategoryKey === "all") return true;
  return cabinetrySubcategoryForProduct(product) === subcategoryKey;
}

function catalogueProductText(product = {}) {
  const attributes = product.attributes || {};
  return [
    product.familyKey,
    product.familyId,
    product.categoryKey,
    product.category,
    product.categoryId,
    product.section,
    product.sectionName,
    product.range,
    product.collection,
    product.productName,
    product.model,
    product.sku,
    product.productCode,
    product.description,
    product.sourceName,
    product.productType,
    attributes.fixtureType,
    attributes.handleUse,
    attributes.choiceType,
    attributes.productApplication,
    attributes.application,
    attributes.canonicalType,
    attributes.categoryType,
    attributes.quotationMappingId,
    attributes.quotationLineCategory,
  ].filter(Boolean).join(" ").toLowerCase();
}

function plumbingSubcategoryForProduct(product = {}) {
  const familyKey = product.familyKey || product.familyId || "";
  const text = catalogueProductText(product);
  if (/oven|cooktop|rangehood|dishwasher|microwave|fridge|refrigerat|appliance/.test(familyKey) || /appliance catalogue|appliance pack|white goods/.test(text)) return "";
  if (familyKey === "toilet" || /toilet|wc suite/.test(text)) return "toilets";
  if (familyKey === "basin" || /basin/.test(text) && !/mixer|tap/.test(text)) return "basins";
  if (familyKey === "bath" || /bath/.test(text) && !/mixer|tap/.test(text)) return "baths";
  if (familyKey === "shower-screen" || /shower screen|shower panel|shower rail/.test(text)) return "showers-screens";
  if (familyKey === "kitchen-sinks" && /laundry|tub/.test(text)) return "laundry-tubs";
  if (familyKey === "kitchen-sinks" || /kitchen sink|sink bowl|flushline sink/.test(text)) return "kitchen-sinks";
  if (familyKey === "basin-mixer" || /basin mixer/.test(text)) return "basin-mixers";
  if (familyKey === "kitchen-sink-mixers" || /sink mixer|kitchen mixer|laundry mixer/.test(text)) return "sink-mixers";
  if (familyKey === "shower-mixer" || /shower mixer/.test(text)) return "shower-mixers";
  if (/bath mixer|bath tap/.test(text)) return "bath-mixers";
  if (familyKey === "shower-outlet" || /shower outlet|shower head|hand shower|rail shower/.test(text)) return "shower-outlets";
  if (familyKey === "tapware" || /mixer|tapware|tap /.test(text)) return "sink-mixers";
  if (["vanity", "accessories"].includes(familyKey) || /accessor|towel rail|floor waste|soap|robe hook|toilet roll/.test(text)) return "accessories";
  return "";
}

function lightingElectricalSubcategoryForProduct(product = {}) {
  const familyKey = product.familyKey || product.familyId || "";
  const text = catalogueProductText(product);
  if (!["lighting", "external-lighting", "electrical", "electrical-fixtures"].includes(familyKey) && !/light|downlight|pendant|wall light|power point|switch|fan|smoke alarm|electrical/.test(text)) return "";
  if (familyKey === "external-lighting" || /external|exterior|outdoor|alfresco/.test(text) && /light/.test(text)) return "exterior-lighting";
  if (/downlight/.test(text)) return "downlights";
  if (/pendant/.test(text)) return "pendant-lights";
  if (/wall light|wall sconce/.test(text)) return "wall-lights";
  if (/power point|gpo|outlet/.test(text)) return "power-points";
  if (/switch/.test(text)) return "switches";
  if (/fan|ceiling fan|exhaust fan/.test(text)) return "fans";
  if (/smoke alarm|smoke detector/.test(text)) return "smoke-alarms";
  if (/appliance|accessor|electrical/.test(text) && !/light/.test(text)) return "electrical-appliances-accessories";
  return "interior-lighting";
}

function catalogueSubcategoryForProduct(product = {}, sectionKey = "") {
  if (sectionKey === "roofing") return exteriorSectionForProduct(product, "roofing");
  if (sectionKey === CABINETRY_SECTION_KEY) return cabinetrySubcategoryForProduct(product);
  if (sectionKey === PLUMBING_SECTION_KEY) return plumbingSubcategoryForProduct(product);
  if (sectionKey === LIGHTING_ELECTRICAL_SECTION_KEY) return lightingElectricalSubcategoryForProduct(product);
  return "";
}

function productBelongsToCatalogueSection(product = {}, sectionItem = null) {
  if (!sectionItem) return false;
  if (sectionItem.key === CABINETRY_SECTION_KEY || sectionItem.key === PLUMBING_SECTION_KEY || sectionItem.key === LIGHTING_ELECTRICAL_SECTION_KEY) {
    return catalogueSubcategoryForProduct(product, sectionItem.key) !== "";
  }
  const familyKey = product.familyKey || product.familyId || "";
  return new Set(sectionItem.familyKeys || []).has(familyKey);
}

function productMatchesCatalogueSubcategory(product = {}, sectionKey = "", subcategoryKey = "all") {
  if (sectionKey === CABINETRY_SECTION_KEY && subcategoryKey === "cabinetry-products") return product.categoryKey === "Cabinetry Products";
  if (!subcategoryKey || subcategoryKey === "all") return true;
  return catalogueSubcategoryForProduct(product, sectionKey) === subcategoryKey;
}

function catalogueSectionExportFileName(sectionItem = null) {
  if (!sectionItem) return "product-library-section.csv";
  return SECTION_EXPORT_FILE_NAMES[sectionItem.key] || `${slugify(sectionItem.displayName)}.csv`;
}

function swatchLabel(swatch) {
  if (swatch && typeof swatch === "object") return swatch.name || swatch.officialName || swatch.hex || swatch.swatchHex || "Colour";
  return String(swatch || "");
}

function swatchStyle(swatch) {
  const colour = swatch && typeof swatch === "object" ? swatch.hex || swatch.swatchHex : "";
  return colour ? { "--swatch-colour": colour } : {};
}

function masterProductsForFamily(products = [], familyItem) {
  if (!familyItem) return [];
  return products.filter((product) => product.familyKey === familyItem.familyKey);
}

function builderEnablementForProduct(product, enablements = [], organisationId = "") {
  return enablements.find((item) => item.organisationId === organisationId && item.masterProductCode === product?.productCode) || null;
}

function productDisplayImage(product, familyItem) {
  return resolveProductLibraryImage({ product, family: familyItem, familyKey: familyItem?.familyKey, areaKey: familyItem?.topLevelArea });
}

function productHasVerifiedImage(product = {}) {
  const image = product.primaryImage || product.primaryImageUrl || product.primary_image || product.primary_image_url || "";
  const status = String(product.imageStatus || product.image_status || "").toLowerCase();
  if (!image) return false;
  if (/unavailable|missing|pending|review|required/.test(status)) return false;
  return /verified|exact|official/.test(status);
}

function productVerifiedImage(product = {}) {
  return productHasVerifiedImage(product) ? (product.primaryImage || product.primaryImageUrl || product.primary_image || product.primary_image_url) : "";
}

function ProductImageAwaitingVerification({ product, large = false }) {
  return (
    <span className={large ? "product-image-awaiting large" : "product-image-awaiting"} role="img" aria-label="Product image awaiting verification">
      <strong>{product?.brand || product?.manufacturer || "Product Library"}</strong>
      <small>Image awaiting verification</small>
    </span>
  );
}

function ProductLibraryProductImage({ product, familyItem, large = false }) {
  const verifiedImage = productVerifiedImage(product);
  if (product.attributes?.internalAreasCatalogue) return <div><VerifiedProductImage src={verifiedImage} name={product.productName} style={{width:'100%',height:large?360:220}}/>{product.attributes.imageScope?<small>{product.attributes.imageScope}</small>:null}</div>;
  if (verifiedImage) return <img src={verifiedImage} alt={product.productName} loading={large ? "eager" : "lazy"} decoding="async" />;
  if (productIsAppliance(product, familyItem)) {
    return <ProductImageAwaitingVerification product={product} large={large} />;
  }
  return <img src={productDisplayImage(product, familyItem)} alt={product.productName} loading={large ? "eager" : "lazy"} decoding="async" />;
}

function supplierNameForProduct(product) {
  return product.supplier || product.manufacturer || product.brand || "Unassigned Supplier";
}

function rangeNameForProduct(product) {
  return product.range || product.collection || product.profile || "Unassigned Range";
}

function groupedSupplierHierarchy(products = [], familyItem = null, enablements = [], organisationId = "") {
  const suppliers = new Map();
  products.forEach((product) => {
    const supplierName = supplierNameForProduct(product);
    const rangeName = rangeNameForProduct(product);
    if (!suppliers.has(supplierName)) {
      suppliers.set(supplierName, { name: supplierName, products: [], ranges: new Map(), enabled: 0 });
    }
    const supplier = suppliers.get(supplierName);
    const enabled = Boolean(builderEnablementForProduct(product, enablements, organisationId)?.enabled);
    supplier.products.push(product);
    if (enabled) supplier.enabled += 1;
    if (!supplier.ranges.has(rangeName)) {
      supplier.ranges.set(rangeName, { name: rangeName, products: [], enabled: 0, image: productDisplayImage(product, familyItem) });
    }
    const range = supplier.ranges.get(rangeName);
    range.products.push(product);
    if (enabled) range.enabled += 1;
    if (!range.image) range.image = productDisplayImage(product, familyItem);
  });
  return Array.from(suppliers.values()).map((supplier) => ({
    ...supplier,
    image: productDisplayImage(supplier.products[0], familyItem),
    ranges: Array.from(supplier.ranges.values()).sort((left, right) => left.name.localeCompare(right.name)),
  })).sort((left, right) => left.name.localeCompare(right.name));
}

const APPLIANCE_FALLBACK_IMAGES = {
  ovens: "/images/catalogues/appliances/fallbacks/oven.svg",
  cooktops: "/images/catalogues/appliances/fallbacks/cooktop.svg",
  rangehoods: "/images/catalogues/appliances/fallbacks/rangehood.svg",
  dishwashers: "/images/catalogues/appliances/fallbacks/dishwasher.svg",
  "freestanding-cookers": "/images/catalogues/appliances/fallbacks/freestanding-cooker.svg",
  microwaves: "/images/catalogues/appliances/fallbacks/microwave.svg",
  fridges: "/images/catalogues/appliances/fallbacks/refrigerator.svg",
  "appliance-packs": "/images/catalogues/appliances/fallbacks/appliance-pack.svg",
  generic: "/images/catalogues/appliances/fallbacks/generic.svg",
};

const APPLIANCE_FAMILY_KEYS = new Set(Object.keys(APPLIANCE_FALLBACK_IMAGES));

function productIsAppliance(product = {}, familyItem = null) {
  const familyKey = product.familyKey || familyItem?.familyKey || "";
  return APPLIANCE_FAMILY_KEYS.has(familyKey)
    || familyItem?.categoryKey === "appliances"
    || product.categoryKey === "appliances"
    || product.sourceName === "Canonical Appliance Catalogue";
}

function appliancePriceLabel(record, { admin = true } = {}) {
  if (!admin) return record.priceStatus === "quote_required" ? "Quote required" : "Price held in Product Library";
  if (record.priceStatus === "quote_required") return "Quote required";
  if (record.priceStatus === "price_pending") return "Price pending";
  if (record.price == null || record.price === "") return record.priceStatus || "No price";
  return `${money(record.price)} ${record.unit || ""}`.trim();
}

function applianceStatusClass(status = "") {
  if (status === "active-selectable") return "status-pill on";
  if (status === "active-reference-only") return "status-pill";
  return "status-pill off";
}

function applianceValue(value, fallback = "Not supplied") {
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  if (value == null || value === "") return fallback;
  return String(value);
}

function applianceSizeBucket(record = {}) {
  const widthText = `${record.width || ""} ${record.widthMm || ""} ${record.name || ""} ${record.productName || ""}`.toUpperCase();
  if (/\b90\s*CM\b|\b900\s*MM\b/.test(widthText) || Number(record.widthMm) >= 850) return "900 mm";
  if (/\b60\s*CM\b|\b600\s*MM\b/.test(widthText) || (Number(record.widthMm) >= 550 && Number(record.widthMm) < 850)) return "600 mm";
  return "Other size";
}

function applianceConfigurationBucket(record = {}) {
  const text = [
    record.fuelOrEnergyType,
    record.installationType,
    record.finish,
    record.name,
    record.productName,
    record.specificationSummary?.rangehoodType,
    record.specificationSummary?.cooktopType,
  ].join(" ").toLowerCase();
  if (/induction/.test(text)) return "Induction";
  if (/ceramic/.test(text)) return "Ceramic";
  if (/\bgas\b/.test(text)) return "Gas";
  if (/electric/.test(text)) return "Electric";
  if (/canopy/.test(text)) return "Canopy";
  if (/slide/.test(text)) return "Slide-out";
  if (/fixed/.test(text)) return "Fixed";
  if (/undermount|under mount/.test(text)) return "Undermount";
  if (/freestanding|free standing/.test(text)) return "Freestanding";
  return "Other configuration";
}

function applianceDimensionLabel(record = {}) {
  const width = record.width || (record.widthMm ? `W${record.widthMm}` : "");
  const depth = record.depth || (record.depthMm ? `D${record.depthMm}` : "");
  const height = record.height || (record.heightMm ? `H${record.heightMm}` : "");
  return [width, depth, height].filter(Boolean).join(" x ");
}

function applianceFeatureList(record = {}) {
  const specs = record.specificationSummary || record.specifications || {};
  const candidates = [
    specs.capacity,
    specs.functions,
    specs.zones,
    specs.placeSettings,
    specs.rangehoodType,
    specs.cooktopType,
    specs.energyRating,
    specs.warranty,
    record.warranty,
  ];
  return uniqueValues(candidates.flatMap((value) => Array.isArray(value) ? value : [value])).slice(0, 8);
}

function applianceFilterOptionValues(records = []) {
  return {
    widths: uniqueValues(records.map(applianceSizeBucket)),
    fuels: uniqueValues(records.map((record) => record.fuelOrEnergyType || applianceConfigurationBucket(record))),
    installs: uniqueValues(records.map((record) => record.installationType)),
    finishes: uniqueValues(records.map((record) => record.finish)),
    verifications: uniqueValues(records.map((record) => record.verificationStatus)),
  };
}

function groupAppliancesForBrand(records = []) {
  return records.reduce((groups, record) => {
    const family = record.familyId || "other";
    const size = applianceSizeBucket(record);
    const configuration = applianceConfigurationBucket(record);
    const key = `${family}::${size}::${configuration}`;
    if (!groups.has(key)) groups.set(key, { family, size, configuration, records: [] });
    groups.get(key).records.push(record);
    return groups;
  }, new Map());
}

function ApplianceImage({ record, large = false }) {
  if (record?.image) return <img src={record.image} alt={`${record.name || record.productName || "Appliance"} product`} loading={large ? "eager" : "lazy"} />;
  return (
    <span
      className={large ? "appliance-image-fallback large" : "appliance-image-fallback"}
      role="img"
      aria-label={`${record?.familyName || "Appliance"} exact image required`}
    >
      <strong>{record?.brandName || record?.brand || "Product Library"}</strong>
      <small>{record?.imageFallbackLabel || APPLIANCE_IMAGE_FALLBACK_LABEL}</small>
    </span>
  );
}

function ApplianceCard({ record, brand, onOpen, onSelect, compareLabel = "Compare" }) {
  return (
    <article className="product-option management-card appliance-visual-card" data-appliance-product={record.productId} data-appliance-family={record.familyId}>
      <div className="appliance-card-logo">{brand ? <ApplianceBrandLogo brand={brand} /> : <strong>{record.brand || "Brand"}</strong>}</div>
      <div className="appliance-card-media">
        <ApplianceImage record={record} />
      </div>
      <div className="appliance-card-copy">
        <span>{record.familyName || "Appliance"}</span>
        <strong>{record.name}</strong>
        <small>{record.model || record.productCode || "Model pending"}</small>
        <small>{[
          applianceDimensionLabel(record),
          applianceConfigurationBucket(record),
          record.finish,
        ].filter(Boolean).join(" / ")}</small>
      </div>
      <div className="appliance-card-footer">
        <strong>{appliancePriceLabel(record)}</strong>
        <span className={record.image ? "status-pill on" : "status-pill"}>{record.image ? "verified image" : "exact image required"}</span>
      </div>
      <div className="card-actions appliance-card-actions">
        <button type="button" onClick={() => onOpen(record)}>View Details</button>
        <button type="button" onClick={() => onSelect(record)}><Check size={15} /> Select Product</button>
        <button type="button" className="secondary" onClick={() => onOpen(record)}><Copy size={15} /> {compareLabel}</button>
      </div>
    </article>
  );
}

function ApplianceBrandLogo({ brand }) {
  if (brand?.logoUrl) {
    return (
      <span className="appliance-brand-logo" style={brand.logoBackground ? { "--brand-logo-background": brand.logoBackground } : {}}>
        <img src={brand.logoUrl} alt={`${brand.brandName} logo`} />
      </span>
    );
  }
  return <span className="appliance-brand-logo text-logo">{brand?.brandName || "Brand"}</span>;
}

function categoryBelongsToArea(categoryItem, areaKey) {
  if (areaKey === "exterior") return categoryItem.topLevelArea === "exterior";
  if (areaKey === "interior") return categoryItem.topLevelArea !== "exterior";
  return categoryItem.topLevelArea === areaKey;
}

function familyBelongsToArea(familyItem, areaKey) {
  if (areaKey === "exterior") return familyItem.topLevelArea === "exterior";
  if (areaKey === "kitchen") {
    const kitchenFamilyKeys = new Set([
      "cabinetry",
      "cabinet-finish",
      "handles",
      "stone-benchtops",
      "stone-20mm-tops",
      "stone-40mm-tops",
      "splashback",
      "kitchen-sinks",
      "kitchen-sink-mixers",
      "ovens",
      "cooktops",
      "rangehoods",
      "dishwashers",
      "microwaves",
      "flooring",
      "lighting",
      "paint",
    ]);
    return familyItem.topLevelArea === "kitchen" || kitchenFamilyKeys.has(familyItem.familyKey);
  }
  if (areaKey === "interior") return familyItem.topLevelArea !== "exterior";
  return familyItem.topLevelArea === areaKey;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function csvRecords(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows[0].map((header) => slugify(header).replace(/-/g, "_"));
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(fileName, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function mapDbProductToEntity(product, categoryName = "", supplierName = "", brandName = "") {
  const entity = product.metadata?.productEntity || {};
  return {
    productId: product.id,
    productCode: product.sku || entity.productCode || "",
    organisationId: product.workspace_id || "",
    linkedQuoteItemCode: product.quote_structure_row_id || entity.linkedQuoteItemCode || "",
    approvedSourceKey: entity.approvedSourceKey || product.metadata?.approvedSourceKey || "",
    familyKey: entity.familyKey || product.metadata?.familyKey || "",
    topLevelArea: entity.topLevelArea || product.metadata?.topLevelArea || "",
    category: categoryName || entity.category || product.quote_structure_section || "",
    subcategory: entity.subcategory || product.selection_type || "",
    productType: entity.productType || product.selection_type || "",
    tags: entity.tags || [],
    compatibleAreaTypes: entity.compatibleAreaTypes || [],
    productName: product.product_name,
    supplier: supplierName || entity.supplier || "",
    brand: brandName || entity.brand || "",
    range: entity.range || product.metadata?.range || "",
    model: product.model || "",
    description: product.description || "",
    colour: entity.colour || product.metadata?.colour || "",
    finish: entity.finish || product.metadata?.finish || "",
    size: entity.size || product.metadata?.size || "",
    width: entity.width || entity.dimensions?.width || "",
    height: entity.height || entity.dimensions?.height || "",
    depth: entity.depth || entity.dimensions?.depth || "",
    dimensions: entity.dimensions || {},
    variants: entity.variants || [],
      primaryImage: product.primary_image_url || entity.primaryImage || "",
    thumbnail: product.primary_image_url || entity.thumbnail || "",
    galleryImages: entity.galleryImages || [],
    colourSwatches: entity.colourSwatches || [],
    imageAltText: entity.imageAltText || product.product_name,
    imageSource: entity.imageSource || "",
    officialProductURL: product.product_url || entity.officialProductURL || "",
    specificationURL: product.datasheet_pdf_url || entity.specificationURL || "",
      supplierURL: product.supplier_website_url || entity.supplierURL || "",
    RRP: entity.RRP || 0,
    builderCost: entity.builderCost || Number(product.base_allowance || 0),
    clientPrice: entity.clientPrice || Number(product.upgrade_cost || 0),
    allowance: Number(product.base_allowance || 0),
    upgradePrice: Number(product.upgrade_cost || 0),
    currency: entity.currency || "AUD",
    gstTreatment: entity.gstTreatment || "GST inclusive",
    priceSource: entity.priceSource || "workspace product",
    priceEffectiveDate: entity.priceEffectiveDate || entity.effectiveDate || "",
    effectiveDate: entity.priceEffectiveDate || entity.effectiveDate || "",
    priceStatus: entity.priceStatus || "workspace",
    active: product.active !== false,
    discontinued: entity.discontinued || false,
    archived: product.active === false,
    unavailable: entity.unavailable || false,
    imageReviewRequired: !product.primary_image_url,
    priceReviewRequired: !product.base_allowance && !product.upgrade_cost,
    raw: product,
  };
}

export default function BuilderProductLibraryPage({ embeddedInEstimateBuilder = false, workbook, projectId, onClientSelectionsSave, selectionBook, selectionMode } = {}) {
  const router = useRouter();
  const { workspaceId, activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const furniturePicker = useDoorFurniturePicker({workbook, projectId, workspaceId, onClientSelectionsSave, selectionBook, selectionMode});
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedAreaKey, setSelectedAreaKey] = useState("");
  const [selectedCategoryKey, setSelectedCategoryKey] = useState("");
  const [selectedFamilyKey, setSelectedFamilyKey] = useState("");
  const [selectedSupplierName, setSelectedSupplierName] = useState("");
  const [selectedRangeName, setSelectedRangeName] = useState("");
  const [selectedProductCode, setSelectedProductCode] = useState("");
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [routeHydrated, setRouteHydrated] = useState(false);
  const [jobFile, setJobFile] = useState({ [PRODUCT_LIBRARY_SELECTIONS_KEY]: {}, workbook: { [PRODUCT_LIBRARY_SELECTIONS_KEY]: {} } });
  const [jobFileName, setJobFileName] = useState(DEFAULT_JOB_FILE_NAME);
  const [adminOpen, setAdminOpen] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [masterCatalogueOpen, setMasterCatalogueOpen] = useState(false);
  const [masterProducts, setMasterProducts] = useState([]);
  const [builderEnablements, setBuilderEnablements] = useState([]);
  const [masterImportPreview, setMasterImportPreview] = useState(null);
  const [packageImportPreview, setPackageImportPreview] = useState(null);
  const [packageImportMode, setPackageImportMode] = useState("update");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({ scope: "current-filtered", sectionId: "", categoryId: "", brand: "", range: "", mode: "zip" });
  const [selectedCatalogueItemIds, setSelectedCatalogueItemIds] = useState([]);
  const [catalogueRevision, setCatalogueRevision] = useState(0);
  const [masterFilters, setMasterFilters] = useState({ search: "", area: "", section: "", category: "", family: "", manufacturer: "", brand: "", supplier: "", range: "", room: "", region: "", imageStatus: "", priceStatus: "", ownership: "", clientSelectable: "", quotationEnabled: "", status: "" });
  const [applianceFilters, setApplianceFilters] = useState({ search: "", productType: "", width: "", fuel: "", install: "", finish: "", status: "", verification: "", selectable: "", sourcePlatform: "", tenantId: "", sort: "name" });
  const [applianceImportInfoOpen, setApplianceImportInfoOpen] = useState(false);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [editingProductId, setEditingProductId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedArea = TOP_LEVEL_AREAS.find((area) => area.key === selectedAreaKey) || null;
  const catalogueMode = typeof router.query.catalogue === "string" ? router.query.catalogue : "";
  const applianceMode = catalogueMode === "appliances";
  const browseMode = router.query.browse === "all" ? "all" : "room";
  const selectedRoomKey = typeof router.query.room === "string" ? router.query.room : "";
  const selectedRoomCategoryKey = typeof router.query.roomCategory === "string" ? router.query.roomCategory : "";
  const [roomVisibleCount,setRoomVisibleCount]=useState(48);
  const paginatedInternalCategory=['internal-doors','door-furniture','skirting-architraves','skirting','architraves'].includes(selectedRoomCategoryKey);
  useEffect(()=>setRoomVisibleCount(48),[selectedRoomCategoryKey,masterFilters.brand,masterFilters.range,masterFilters.search]);
  const selectedRoomProductId = typeof router.query.roomProduct === "string" ? router.query.roomProduct : "";
  const selectedRoom = selectedRoomKey ? getProductLibraryRoom(selectedRoomKey) : null;
  const selectedRoomCategories = useMemo(() => selectedRoomKey ? getProductLibraryRoomCategories(selectedRoomKey) : [], [selectedRoomKey]);
  const selectedRoomCategory = selectedRoomCategoryKey ? getProductLibraryRoomCategory(selectedRoom?.key === "exterior" && selectedRoomCategoryKey === "door-furniture" ? "external-door-furniture" : selectedRoomCategoryKey) : null;
  const catalogueSectionKey = typeof router.query.catalogueSection === "string" ? router.query.catalogueSection : "";
  const selectedCatalogueSection = catalogueSectionKey ? getProductLibraryCatalogueSection(catalogueSectionKey) : null;
  const cabinetrySubcategoryKey = typeof router.query.cabinetrySubcategory === "string" ? router.query.cabinetrySubcategory : "all";
  const selectedCabinetrySubcategory = CABINETRY_SUBCATEGORIES.find((item) => item.key === cabinetrySubcategoryKey) || CABINETRY_SUBCATEGORIES[0];
  const catalogueSubcategoryKey = typeof router.query.catalogueSubcategory === "string" ? router.query.catalogueSubcategory : cabinetrySubcategoryKey;
  const selectedCatalogueSubcategories = selectedCatalogueSection ? CATALOGUE_GROUP_SUBCATEGORIES[selectedCatalogueSection.key] || [] : [];
  const selectedCatalogueSubcategory = selectedCatalogueSubcategories.find((item) => item.key === catalogueSubcategoryKey) || selectedCatalogueSubcategories[0] || null;
  const catalogueSectionFamilies = useMemo(() => getProductLibrarySectionFamilies(catalogueSectionKey), [catalogueSectionKey]);
  const applianceFamilyKey = typeof router.query.applianceFamily === "string" ? router.query.applianceFamily : "";
  const applianceBrandName = typeof router.query.applianceBrand === "string" ? router.query.applianceBrand : "";
  const applianceProductId = typeof router.query.applianceProduct === "string" ? router.query.applianceProduct : "";
  const selectedCategory = TAXONOMY_CATEGORY_DEFINITIONS.find((category) => category.key === selectedCategoryKey) || null;
  const selectedFamily = familyByKey(selectedFamilyKey);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category.category_name])), [categories]);
  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier.supplier_name])), [suppliers]);
  const manufacturerById = useMemo(() => new Map(manufacturers.map((manufacturer) => [manufacturer.id, manufacturer.manufacturer_name])), [manufacturers]);

  const orgProducts = useMemo(
    () => products
      .map((product) => mapDbProductToEntity(product, categoryById.get(product.category_id), supplierById.get(product.supplier_id), manufacturerById.get(product.manufacturer_id)))
      .filter(isProductLibraryEligibleProduct),
    [categoryById, manufacturerById, products, supplierById]
  );

  const visibleCategories = useMemo(
    () => (selectedArea ? TAXONOMY_CATEGORY_DEFINITIONS.filter((category) => categoryBelongsToArea(category, selectedArea.key)) : []),
    [selectedArea]
  );
  const visibleFamilies = useMemo(() => {
    if (!selectedArea) return [];
    const areaFamilies = PRODUCT_FAMILIES.filter((familyItem) => familyBelongsToArea(familyItem, selectedArea.key));
    if (!selectedCategory) return areaFamilies;
    return areaFamilies.filter((familyItem) => familyItem.category === selectedCategory.category || familyItem.subcategory === selectedCategory.category || familyItem.subcategory === selectedCategory.subcategory);
  }, [selectedArea, selectedCategory]);
  const familyMasterProducts = useMemo(() => masterProductsForFamily(masterProducts, selectedFamily), [masterProducts, selectedFamily]);
  const supplierHierarchy = useMemo(() => groupedSupplierHierarchy(familyMasterProducts, selectedFamily, builderEnablements, workspaceId || ""), [builderEnablements, familyMasterProducts, selectedFamily, workspaceId]);
  const selectedSupplierGroup = supplierHierarchy.find((supplier) => supplier.name === selectedSupplierName) || null;
  const selectedRangeGroup = selectedSupplierGroup?.ranges.find((range) => range.name === selectedRangeName) || null;
  const visibleProducts = useMemo(() => {
    if (!selectedFamily) return [];
    if (selectedRangeGroup) return selectedRangeGroup.products;
    if (selectedSupplierGroup) return selectedSupplierGroup.products;
    return familyMasterProducts;
  }, [familyMasterProducts, selectedFamily, selectedRangeGroup, selectedSupplierGroup]);
  const selectedProduct = visibleProducts.find((product) => product.productCode === selectedProductCode || product.productId === selectedProductCode) || visibleProducts[0] || null;
  const masterManufacturers = useMemo(() => uniqueValues(masterProducts.map((product) => product.manufacturer)), [masterProducts]);
  const masterBrands = useMemo(() => uniqueValues(masterProducts.map((product) => product.brand)), [masterProducts]);
  const masterSuppliers = useMemo(() => uniqueValues(masterProducts.map((product) => product.supplier)), [masterProducts]);
  const masterRanges = useMemo(() => uniqueValues(masterProducts.map((product) => product.range)), [masterProducts]);
  const filteredMasterProducts = useMemo(() => masterProducts.filter((product) => masterProductMatchesFilters(product, masterFilters)), [masterFilters, masterProducts]);
  const effectiveCatalogueProducts = useMemo(() => getEffectiveProductCatalogue({
    tenantId: workspaceId || "",
    builderId: workspaceId || "",
    catalogueVersion: "product-library.current",
  }).products, [builderEnablements, catalogueRevision, masterProducts, workspaceId]);
  const managementCatalogueProducts = useMemo(() => getEffectiveProductCatalogue({
    tenantId: workspaceId || "",
    builderId: workspaceId || "",
    catalogueVersion: "product-library.current",
    includeDisabled: true,
  }).products, [builderEnablements, catalogueRevision, masterProducts, workspaceId]);
  const roomProducts = useMemo(() => selectedRoom ? effectiveCatalogueProducts.filter((product) => productBelongsToRoom(product, selectedRoom.key)) : [], [effectiveCatalogueProducts, selectedRoom]);
  const exteriorSections = EXTERIOR_CATALOGUE_SECTIONS[selectedRoomCategory?.key] || [];
  const exteriorSectionKey = typeof router.query.exteriorSection === "string" && exteriorSections.some(([key]) => key === router.query.exteriorSection) ? router.query.exteriorSection : "all";
  const allRoomCategoryProducts = useMemo(() => effectiveCatalogueProducts.filter((product) => productBelongsToRoomCategory(product, selectedRoomCategory)), [effectiveCatalogueProducts, selectedRoomCategory]);
  const roomCategoryProducts = useMemo(() => {
    if (!selectedRoomCategory) return [];
    return effectiveCatalogueProducts
      .filter((product) => productBelongsToRoomCategory(product, selectedRoomCategory))
      .filter((product) => exteriorSectionKey === "all" || (selectedRoomCategory.key === 'skirting-architraves' ? productBelongsToRoomCategory(product, getProductLibraryRoomCategory(exteriorSectionKey)) : exteriorSectionForProduct(product, selectedRoomCategory.key) === exteriorSectionKey))
      .filter((product) => !selectedRoom || productBelongsToRoom(product, selectedRoom.key))
      .filter((product) => masterProductMatchesFilters(product, masterFilters));
  }, [effectiveCatalogueProducts, masterFilters, selectedRoom, selectedRoomCategory, exteriorSectionKey]);
  const currentFilteredProducts = useMemo(() => {
    if (selectedRoomCategory) return roomCategoryProducts;
    if (selectedRoom) return roomProducts.filter((product) => masterProductMatchesFilters(product, masterFilters));
    return effectiveCatalogueProducts.filter((product) => masterProductMatchesFilters(product, masterFilters));
  }, [effectiveCatalogueProducts, masterFilters, roomCategoryProducts, roomProducts, selectedRoom, selectedRoomCategory]);
  const exportableProducts = useMemo(() => filterProductsForProductLibraryExchange(effectiveCatalogueProducts, {
    scope: exportOptions.scope,
    sectionId: exportOptions.sectionId,
    categoryId: exportOptions.categoryId,
    brand: exportOptions.brand,
    range: exportOptions.range,
    currentProducts: currentFilteredProducts,
    builderId: workspaceId || "",
  }), [currentFilteredProducts, effectiveCatalogueProducts, exportOptions, workspaceId]);
  const manageableProducts = useMemo(() => managementCatalogueProducts.filter((product) => masterProductMatchesFilters(product, masterFilters)), [managementCatalogueProducts, masterFilters]);
  const selectedCatalogueItemSet = useMemo(() => new Set(selectedCatalogueItemIds), [selectedCatalogueItemIds]);
  const selectedCatalogueProducts = useMemo(() => managementCatalogueProducts.filter((product) => selectedCatalogueItemSet.has(catalogueProductSelectionKey(product))), [managementCatalogueProducts, selectedCatalogueItemSet]);
  const cabinetryCatalogueProducts = useMemo(() => managementCatalogueProducts.filter(productBelongsToCabinetryCatalogue), [managementCatalogueProducts]);
  const cabinetryVisibleProducts = useMemo(
    () => cabinetryCatalogueProducts.filter((product) => productMatchesCabinetrySubcategory(product, selectedCabinetrySubcategory.key)),
    [cabinetryCatalogueProducts, selectedCabinetrySubcategory.key]
  );
  const selectedCabinetryProducts = useMemo(
    () => cabinetryCatalogueProducts.filter((product) => selectedCatalogueItemSet.has(catalogueProductSelectionKey(product))),
    [cabinetryCatalogueProducts, selectedCatalogueItemSet]
  );
  const catalogueGroupProducts = useMemo(
    () => selectedCatalogueSection ? managementCatalogueProducts.filter((product) => productBelongsToCatalogueSection(product, selectedCatalogueSection)) : [],
    [managementCatalogueProducts, selectedCatalogueSection]
  );
  const catalogueGroupVisibleProducts = useMemo(
    () => catalogueGroupProducts.filter((product) => productMatchesCatalogueSubcategory(product, selectedCatalogueSection?.key, selectedCatalogueSubcategory?.key || "all")),
    [catalogueGroupProducts, selectedCatalogueSection?.key, selectedCatalogueSubcategory?.key]
  );
  const selectedCatalogueGroupProducts = useMemo(
    () => catalogueGroupProducts.filter((product) => selectedCatalogueItemSet.has(catalogueProductSelectionKey(product))),
    [catalogueGroupProducts, selectedCatalogueItemSet]
  );
  const cabinetryBrandName = typeof router.query.cabinetryBrand === "string" ? router.query.cabinetryBrand : "";
  const cabinetryRangeName = typeof router.query.cabinetryRange === "string" ? router.query.cabinetryRange : "";
  const cabinetDoorPanelProducts = useMemo(() => {
    if (selectedRoomCategory?.key !== "cabinet-doors-panels") return [];
    return roomCategoryProducts.filter((product) => product.familyKey === "cabinet-finish" && ["Laminex", "Polytec"].includes(product.brand || product.supplier));
  }, [roomCategoryProducts, selectedRoomCategory]);
  const cabinetryBrandGroups = useMemo(() => {
    const groups = new Map();
    cabinetDoorPanelProducts.forEach((product) => {
      const brandName = product.brand || product.supplier || "Unassigned";
      if (!groups.has(brandName)) {
        groups.set(brandName, { name: brandName, logo: PRODUCT_LIBRARY_CABINETRY_BRAND_ASSETS[brandName]?.logo || "", products: [], ranges: new Map() });
      }
      const group = groups.get(brandName);
      group.products.push(product);
      const rangeName = product.range || product.collection || "Unassigned Range";
      if (!group.ranges.has(rangeName)) group.ranges.set(rangeName, { name: rangeName, products: [], image: product.primaryImageUrl || product.thumbnailUrl || "" });
      group.ranges.get(rangeName).products.push(product);
    });
    return Array.from(groups.values()).map((group) => ({
      ...group,
      ranges: Array.from(group.ranges.values()).sort((left, right) => left.name.localeCompare(right.name)),
    })).sort((left, right) => left.name.localeCompare(right.name));
  }, [cabinetDoorPanelProducts]);
  const cabinetrySelectedBrand = cabinetryBrandGroups.find((group) => group.name === cabinetryBrandName) || null;
  const cabinetrySelectedRange = cabinetrySelectedBrand?.ranges.find((range) => range.name === cabinetryRangeName) || null;
  const cabinetryVisibleColourProducts = cabinetrySelectedRange?.products || cabinetrySelectedBrand?.products || cabinetDoorPanelProducts;
  const selectedRoomProduct = useMemo(() => {
    if (!selectedRoomProductId) return null;
    return effectiveCatalogueProducts.find((product) => product.productId === selectedRoomProductId || product.productCode === selectedRoomProductId) || null;
  }, [effectiveCatalogueProducts, selectedRoomProductId]);
  const applianceFamilies = useMemo(() => getApplianceFamilies(), []);
  const applianceFamily = applianceFamilies.find((family) => family.familyId === applianceFamilyKey) || null;
  const applianceBrands = useMemo(() => applianceFamilyKey ? getApplianceBrandsByFamily(applianceFamilyKey) : getApplianceBrands().map((brand) => brand.brandName), [applianceFamilyKey]);
  const applianceBrandCards = useMemo(() => getApplianceBrands({ familyId: applianceFamilyKey }), [applianceFamilyKey]);
  const selectedApplianceBrand = useMemo(() => getApplianceBrandByName(applianceBrandName), [applianceBrandName]);
  const applianceSourceRecordsForBrand = useMemo(() => {
    if (!applianceBrandName) return getPlatformMasterApplianceRecords();
    return getPlatformMasterApplianceRecords().filter((record) => record.brand === applianceBrandName || record.brandName === applianceBrandName);
  }, [applianceBrandName]);
  const applianceFilterOptions = useMemo(() => applianceFilterOptionValues(applianceSourceRecordsForBrand), [applianceSourceRecordsForBrand]);
  const applianceModels = useMemo(() => {
    if (!applianceBrandName) return [];
    const sourceRecords = applianceFamilyKey
      ? getApplianceModelsByFamilyAndBrand(applianceFamilyKey, applianceBrandName)
      : getPlatformMasterApplianceRecords().filter((record) => record.brand === applianceBrandName || record.brandName === applianceBrandName);
    return filterApplianceRecords(sourceRecords, { ...applianceFilters, family: applianceFamilyKey, brand: applianceBrandName });
  }, [applianceBrandName, applianceFamilyKey, applianceFilters]);
  const appliancePacksForBrand = useMemo(() => {
    if (!applianceBrandName) return [];
    if (applianceFamilyKey && applianceFamilyKey !== "appliance-packs") return [];
    return filterApplianceRecords(getApplianceRecordsByFamily("appliance-packs"), { ...applianceFilters, family: "", productType: "", brand: applianceBrandName });
  }, [applianceBrandName, applianceFamilyKey, applianceFilters]);
  const visibleApplianceFamilies = useMemo(() => {
    const physicalFamilies = applianceFamilies.filter((family) => family.familyId !== "appliance-packs");
    if (applianceFamilyKey && applianceFamilyKey !== "appliance-packs") return physicalFamilies.filter((family) => family.familyId === applianceFamilyKey);
    return physicalFamilies;
  }, [applianceFamilies, applianceFamilyKey]);
  const selectedApplianceProductContainers = useMemo(() => {
    if (!applianceProductId) return [];
    return getApplianceRecordsByFamily("appliance-packs").filter((pack) => (pack.components || []).some((component) => component.productId === applianceProductId));
  }, [applianceProductId]);
  const selectedApplianceProduct = useMemo(() => applianceProductId ? getApplianceProductById(applianceProductId) : null, [applianceProductId]);
  const applianceCatalogueStats = useMemo(() => ({
    platformMaster: getPlatformMasterApplianceRecords().length,
    active: getActiveProductLibraryApplianceRecords().length,
    clientSelectable: getClientSelectableApplianceRecords().length,
    legacyCompatible: getLegacyQuotationCompatibleApplianceRecords().length,
    requiringVerification: getApplianceRecordsRequiringVerification().length,
  }), []);
  const roofingAdminProof = useMemo(() => {
    const roofingProducts = masterProducts.filter((product) => product.familyKey === "roofing");
    const colourNames = new Set();
    roofingProducts.forEach((product) => {
      const colours = product.attributes?.colours || [];
      if (Array.isArray(colours)) colours.forEach((colour) => colourNames.add(colour.name || colour.officialName));
    });
    return {
      systems: uniqueValues(roofingProducts.map((product) => [product.manufacturer, product.brand, product.material].filter(Boolean).join(" / "))).length,
      profiles: uniqueValues(roofingProducts.map((product) => product.profile || product.productName)).length,
      colours: Array.from(colourNames).filter(Boolean).length,
      enabled: builderEnablements.filter((item) => item.organisationId === workspaceId && item.enabled && roofingProducts.some((product) => product.productCode === item.masterProductCode)).length,
    };
  }, [builderEnablements, masterProducts, workspaceId]);
  const roofingGroupProof = useMemo(() => {
    const roofingProducts = familyMasterProducts.filter((product) => product.familyKey === "roofing");
    const packageStep = (product, step) => product.attributes?.roofPackageStep === step || product.configuration === step;
    return {
      metal: roofingProducts.filter((product) => product.attributes?.roofType === "metal_roofing" || product.roofType === "metal_roofing" || product.configuration === "metal_roofing").length,
      tiles: roofingProducts.filter((product) => product.attributes?.roofType === "roof_tiles" || product.roofType === "roof_tiles" || product.configuration === "roof_tiles").length,
      fascia: roofingProducts.filter((product) => packageStep(product, "fascia")).length,
      gutters: roofingProducts.filter((product) => packageStep(product, "gutters")).length,
      downpipes: roofingProducts.filter((product) => packageStep(product, "downpipes")).length,
    };
  }, [familyMasterProducts]);
  const selectableProof = useMemo(() => queryClientSelectableProducts({
    organisationId: workspaceId || "",
    familyKey: selectedFamily?.familyKey || "ovens",
    region: masterFilters.region || "AU",
    masterProducts,
    builderProducts: builderEnablements,
    organisationProducts: [],
  }), [builderEnablements, masterFilters.region, masterProducts, selectedFamily, workspaceId]);
  const selections = productLibrarySelectionsFromJobFile(jobFile);
  const garageDoorSelection = selections[GARAGE_DOOR_SELECTION_KEY] || null;
  const bannerTitle = applianceMode
    ? (selectedApplianceProduct?.name || applianceBrandName || applianceFamily?.name || "Appliances")
    : selectedRoomProduct?.productName || selectedRoomCategory?.name || selectedRoom?.name || selectedFamily?.displayName || selectedCategory?.category || selectedArea?.displayName || selectedCatalogueSection?.displayName || "Product Library";
  const bannerSubtitle = applianceMode
    ? "Product Library appliance catalogue: family, brand, model and product details from the canonical AU appliance data."
    : selectedRoomProduct
    ? [selectedRoomProduct.brand, selectedRoomProduct.model, selectedRoomProduct.familyKey].filter(Boolean).join(" / ")
    : selectedRoomCategory
    ? `${selectedRoom?.name || "Room"} / ${selectedRoomCategory.group}`
    : selectedRoom
    ? selectedRoom.description
    : selectedCatalogueSection
    ? selectedCatalogueSection.description
    : selectedFamily
    ? `${selectedFamily.category} / ${selectedFamily.subcategory}`
    : selectedCategory
      ? `Choose products and families for ${selectedCategory.category}.`
      : selectedArea
        ? `Choose one ${selectedArea.displayName} category.`
        : "Browse master physical-product catalogues by trade/product section, supplier, brand, model, image status and source status.";

  const routeArea = typeof router.query.area === 'string' ? router.query.area : '';
  const routeCategory = typeof router.query.category === 'string' ? router.query.category : '';
  const routeFamily = typeof router.query.family === 'string' ? router.query.family : '';
  const routePage = typeof router.query.page === 'string' ? router.query.page : '';
  function productLibraryRouteQuery(query = {}) {
    const nextQuery = { ...query };
    if (furniturePicker.enabled) { nextQuery.mode='client-selection';nextQuery.returnPage='clientSelections'; }
    if (furniturePicker.enabled) for (const key of ['mode','returnPage','door','projectId','jobId']) {
      if (router.query[key]) nextQuery[key] = router.query[key];
    }
    if (embeddedInEstimateBuilder || router.pathname === "/modules/estimate-builder") {
      nextQuery.page = furniturePicker.enabled && router.query.page === "clientSelections" ? "clientSelections" : "productLibrary";
    }
    return nextQuery;
  }

  function pushProductLibraryRoute(query = {}, options = {}) {
    if (embeddedInEstimateBuilder && (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('page') : router.query.page) !== "productLibrary" && !furniturePicker.enabled) return Promise.resolve(false);
    return safeSelectionNavigate(router, { pathname: router.pathname, query: productLibraryRouteQuery(query) }, { shallow: true, ...options });
  }

  function replaceProductLibraryRoute(query = {}, options = {}) {
    if (embeddedInEstimateBuilder && (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('page') : router.query.page) !== "productLibrary" && !furniturePicker.enabled) return Promise.resolve(false);
    return safeSelectionNavigate(router, { pathname: router.pathname, query: productLibraryRouteQuery(query) }, { replace: true, shallow: true, ...options });
  }

  useEffect(() => {
    if (!workspaceId) return;
    loadLibrary();
  }, [workspaceId]);

  useEffect(() => {
    if (!router.isReady || routeHydrated) return;
    if (typeof router.query.catalogue === "string" && router.query.catalogue) {
      setRouteHydrated(true);
      return;
    }
    const area = typeof router.query.area === "string" ? router.query.area : "";
    const category = typeof router.query.category === "string" ? router.query.category : "";
    const family = typeof router.query.family === "string" ? router.query.family : "";
    if (area) setSelectedAreaKey(area);
    if (category) setSelectedCategoryKey(category);
    if (family) setSelectedFamilyKey(family);
    setRouteHydrated(true);
  }, [routeHydrated, router.isReady, routeArea, routeCategory, routeFamily]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PRODUCT_LIBRARY_JOB_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      setJobFile(saved.jobFile || saved);
      setJobFileName(saved.fileName || DEFAULT_JOB_FILE_NAME);
    } catch {
      setJobFile({ [PRODUCT_LIBRARY_SELECTIONS_KEY]: {}, workbook: { [PRODUCT_LIBRARY_SELECTIONS_KEY]: {} } });
    }
  }, []);

  // Master products always come from the committed catalogue JSON; browser
  // state contributes builder overrides only. Same source as Client Selections.
  useEffect(() => {
    setMasterProducts(getMasterProducts());
    setBuilderEnablements(getBuilderEnablementRefs(workspaceId || ""));
  }, [workspaceId]);

  useEffect(() => {
    if (!routeHydrated || !router.isReady) return;
    if (applianceMode || catalogueSectionKey || selectedRoomKey || browseMode === "all") return;
    const hasLegacyRouteState = Boolean(
      selectedAreaKey
      || selectedCategoryKey
      || selectedFamilyKey
      || router.query.area
      || router.query.category
      || router.query.family
    );
    if (!hasLegacyRouteState) return;
    const query = {};
    if (selectedAreaKey) query.area = selectedAreaKey;
    if (selectedCategoryKey) query.category = selectedCategoryKey;
    if (selectedFamilyKey) query.family = selectedFamilyKey;
    const nextQuery = productLibraryRouteQuery(query);
    const currentQuery = router.query || {};
    const keys = new Set([...Object.keys(currentQuery), ...Object.keys(nextQuery)]);
    const changed = Array.from(keys).some((key) => String(currentQuery[key] || "") !== String(nextQuery[key] || ""));
    if (changed) replaceProductLibraryRoute(query);
  }, [
    applianceMode,
    browseMode,
    catalogueSectionKey,
    routeHydrated,
    router.isReady,
    routeArea,
    routeCategory,
    routeFamily,
    routePage,
    selectedAreaKey,
    selectedCategoryKey,
    selectedFamilyKey,
    selectedRoomKey,
  ]);

  useEffect(() => {
    if (!routeHydrated || !router.isReady) return;
    if (selectedRoomCategory?.key !== "cabinet-doors-panels") return;
    if (!selectedRoom || !masterProducts.length || !cabinetDoorPanelProducts.length) return;
    if (cabinetryBrandName && !cabinetrySelectedBrand) {
      replaceProductLibraryRoute({ room: selectedRoom.key, roomCategory: selectedRoomCategoryKey });
      return;
    }
    if (cabinetryBrandName && cabinetryRangeName && !cabinetrySelectedRange) {
      replaceProductLibraryRoute({ room: selectedRoom.key, roomCategory: selectedRoomCategory.key, cabinetryBrand: cabinetryBrandName });
    }
  }, [
    cabinetDoorPanelProducts.length,
    cabinetryBrandName,
    cabinetryRangeName,
    Boolean(cabinetrySelectedBrand),
    Boolean(cabinetrySelectedRange),
    masterProducts.length,
    routeHydrated,
    router.isReady,
    selectedRoom?.key,
    selectedRoomCategory?.key,
  ]);

  useEffect(() => {
    setSelectedSupplierName("");
    setSelectedRangeName("");
    setSelectedProductCode("");
    setSelectedVariantIndex(0);
    setProductForm(EMPTY_PRODUCT);
    setEditingProductId("");
  }, [selectedFamilyKey]);

  async function loadLibrary() {
    if (!workspaceId) return;
    setLoading(true);
    setError("");
    const [categoryResult, supplierResult, manufacturerResult, productResult] = await Promise.all([
      supabase.from("builder_product_categories").select("*").or(`workspace_id.eq.${workspaceId},workspace_id.is.null`).order("sort_order", { ascending: true }),
      supabase.from("builder_product_suppliers").select("*").eq("workspace_id", workspaceId).order("supplier_name", { ascending: true }),
      supabase.from("builder_product_manufacturers").select("*").eq("workspace_id", workspaceId).order("manufacturer_name", { ascending: true }),
      supabase.from("builder_products").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }),
    ]);
    const firstError = categoryResult.error || supplierResult.error || manufacturerResult.error || productResult.error;
    if (firstError) {
      setError(firstError.message || "Could not load the Product Library.");
      setCategories([]);
      setSuppliers([]);
      setManufacturers([]);
      setProducts([]);
    } else {
      setCategories(categoryResult.data || []);
      setSuppliers(supplierResult.data || []);
      setManufacturers(manufacturerResult.data || []);
      setProducts(productResult.data || []);
    }
    setLoading(false);
  }

  function goBack() {
    if (furniturePicker.enabled) { furniturePicker.returnToDoor(); return; }
    setError("");
    setSuccess("");
    if (applianceMode) {
      if (applianceProductId) {
        const query = { catalogue: "appliances" };
        if (applianceFamilyKey) query.applianceFamily = applianceFamilyKey;
        if (applianceBrandName) query.applianceBrand = applianceBrandName;
        pushProductLibraryRoute(query);
        return;
      }
      if (applianceBrandName) {
        pushProductLibraryRoute({ catalogue: "appliances" });
        return;
      }
      if (applianceFamilyKey) {
        pushProductLibraryRoute({ catalogue: "appliances" });
        return;
      }
      pushProductLibraryRoute({});
      return;
    }
    if (selectedRoomProductId && selectedRoom && selectedRoomCategory) {
      pushProductLibraryRoute({ room: selectedRoom.key, roomCategory: selectedRoomCategory.key });
      return;
    }
    if (selectedRoomCategory?.key === "cabinet-doors-panels" && cabinetryRangeName && selectedRoom) {
      pushProductLibraryRoute({ room: selectedRoom.key, roomCategory: selectedRoomCategory.key, cabinetryBrand: cabinetryBrandName });
      return;
    }
    if (selectedRoomCategory?.key === "cabinet-doors-panels" && cabinetryBrandName && selectedRoom) {
      pushProductLibraryRoute({ room: selectedRoom.key, roomCategory: selectedRoomCategory.key });
      return;
    }
    if (selectedRoomCategory && selectedRoom) {
      pushProductLibraryRoute({ room: selectedRoom.key });
      return;
    }
    if (selectedRoom) {
      pushProductLibraryRoute({});
      return;
    }
    if (selectedCatalogueSection) {
      pushProductLibraryRoute({});
      return;
    }
    if (selectedFamilyKey) {
      setSelectedFamilyKey("");
      setSelectedSupplierName("");
      setSelectedRangeName("");
      return;
    }
    if (selectedCategoryKey) {
      setSelectedCategoryKey("");
      return;
    }
    if (selectedAreaKey) {
      setSelectedAreaKey("");
      return;
    }
    safeSelectionNavigate(router, embeddedInEstimateBuilder ? "/modules/estimate-builder" : "/modules/builders");
  }

  function openFamily(familyKey) {
    setSelectedFamilyKey(familyKey);
    setSelectedSupplierName("");
    setSelectedRangeName("");
    setAdminOpen(false);
  }

  function openArea(areaKey) {
    replaceProductLibraryRoute({});
    setSelectedAreaKey(areaKey);
    setSelectedCategoryKey("");
    setSelectedFamilyKey("");
    setSelectedSupplierName("");
    setSelectedRangeName("");
    setSelectedProductCode("");
  }

  function openCategory(categoryKey) {
    setSelectedCategoryKey(categoryKey);
    setSelectedFamilyKey("");
    setSelectedSupplierName("");
    setSelectedRangeName("");
    setSelectedProductCode("");
    setAdminOpen(false);
  }

  function openCatalogueSection(sectionKey) {
    setSelectedAreaKey("");
    setSelectedCategoryKey("");
    setSelectedFamilyKey("");
    setSelectedSupplierName("");
    setSelectedRangeName("");
    setSelectedProductCode("");
    setAdminOpen(false);
    pushProductLibraryRoute({ catalogueSection: sectionKey });
  }

  function openBrowseAllProducts() {
    setSelectedAreaKey("");
    setSelectedCategoryKey("");
    setSelectedFamilyKey("");
    setSelectedSupplierName("");
    setSelectedRangeName("");
    setSelectedProductCode("");
    setAdminOpen(false);
    pushProductLibraryRoute({ browse: "all" });
  }

  function openRoom(roomKey) {
    setSelectedAreaKey("");
    setSelectedCategoryKey("");
    setSelectedFamilyKey("");
    setSelectedSupplierName("");
    setSelectedRangeName("");
    setSelectedProductCode("");
    setAdminOpen(false);
    pushProductLibraryRoute({ room: roomKey });
  }

  function openRoomCategory(categoryKey) {
    if (!selectedRoom) return;
    setSelectedFamilyKey("");
    setSelectedSupplierName("");
    setSelectedRangeName("");
    setSelectedProductCode("");
    setAdminOpen(false);
    pushProductLibraryRoute({ room: selectedRoom.key, roomCategory: furniturePicker.enabled ? selectedRoomCategoryKey : categoryKey });
  }

  function openCabinetryBrand(brandName) {
    if (!selectedRoom || selectedRoomCategory?.key !== "cabinet-doors-panels") return;
    pushProductLibraryRoute({ room: selectedRoom.key, roomCategory: selectedRoomCategory.key, cabinetryBrand: brandName });
  }

  function openCabinetryRange(rangeName) {
    if (!selectedRoom || selectedRoomCategory?.key !== "cabinet-doors-panels" || !cabinetrySelectedBrand) return;
    pushProductLibraryRoute({ room: selectedRoom.key, roomCategory: selectedRoomCategory.key, cabinetryBrand: cabinetrySelectedBrand.name, cabinetryRange: rangeName });
  }

  function openRoomProduct(productId) {
    if (!selectedRoom || !selectedRoomCategory) return;
    pushProductLibraryRoute({ room: selectedRoom.key, roomCategory: selectedRoomCategoryKey, roomProduct: productId });
  }

  function openApplianceCatalogue(next = {}) {
    setSelectedAreaKey("");
    setSelectedCategoryKey("");
    setSelectedFamilyKey("");
    setSelectedSupplierName("");
    setSelectedRangeName("");
    setSelectedProductCode("");
    setAdminOpen(false);
    const query = { catalogue: "appliances" };
    if (next.applianceFamily) query.applianceFamily = next.applianceFamily;
    if (next.applianceBrand) query.applianceBrand = next.applianceBrand;
    if (next.applianceProduct) query.applianceProduct = next.applianceProduct;
    pushProductLibraryRoute(query);
  }

  function clearApplianceFilters() {
    setApplianceFilters({ search: "", productType: "", width: "", fuel: "", install: "", finish: "", status: "", verification: "", selectable: "", sourcePlatform: "", tenantId: "", sort: "name" });
  }

  function selectApplianceRecord(record) {
    if (!record?.productId) return;
    const selectionKey = `appliances:${record.recordType === "appliance-pack" ? "package" : record.familyId}:${record.productId}`;
    const selectedAt = new Date().toISOString();
    const nextSelection = {
      productId: record.productId,
      stableProductId: record.stableProductId || record.productId,
      recordType: record.recordType || "appliance-product",
      familyId: record.familyId,
      familyName: record.familyName,
      brand: record.brand,
      model: record.model,
      productName: record.name,
      description: record.description,
      specifications: record.specificationSummary || {},
      dimensions: {
        width: record.width || "",
        widthMm: record.widthMm ?? null,
        height: record.height || "",
        heightMm: record.heightMm ?? null,
        depth: record.depth || "",
        depthMm: record.depthMm ?? null,
      },
      image: record.image || "",
      imageFallbackLabel: record.image ? "" : record.imageFallbackLabel || APPLIANCE_IMAGE_FALLBACK_LABEL,
      selectedPrice: record.price,
      priceStatus: record.priceStatus,
      allowance: 0,
      variation: 0,
      catalogueVersion: record.schemaVersion || "product-library.appliance-catalogue.v1",
      selectedAt,
      components: record.recordType === "appliance-pack" ? (record.components || []).map((component) => ({
        productId: component.productId,
        familyId: component.familyId,
        brand: component.brand,
        model: component.model,
        name: component.name,
        image: component.image || "",
        price: component.price ?? null,
      })) : [],
    };
    const currentSelections = productLibrarySelectionsFromJobFile(jobFile);
    const nextSelections = { ...currentSelections, [selectionKey]: nextSelection };
    persistJobFile({
      ...jobFile,
      [PRODUCT_LIBRARY_SELECTIONS_KEY]: nextSelections,
      workbook: {
        ...(jobFile.workbook || {}),
        [PRODUCT_LIBRARY_SELECTIONS_KEY]: nextSelections,
      },
    });
    setSuccess(`${record.name || record.model || "Appliance"} selected from Product Library.`);
  }

  function countProductsForFamily(familyItem) {
    return masterProductsForFamily(masterProducts, familyItem).filter((product) => product.active !== false && product.archived !== true).length;
  }

  function countProductsForCategory(categoryItem) {
    return PRODUCT_FAMILIES
      .filter((familyItem) => familyItem.topLevelArea === categoryItem.topLevelArea && (familyItem.category === categoryItem.category || familyItem.subcategory === categoryItem.category || familyItem.subcategory === categoryItem.subcategory))
      .reduce((total, familyItem) => total + countProductsForFamily(familyItem), 0);
  }

  function countProductsForArea(areaItem) {
    return PRODUCT_FAMILIES
      .filter((familyItem) => familyBelongsToArea(familyItem, areaItem.key))
      .reduce((total, familyItem) => total + countProductsForFamily(familyItem), 0);
  }

  function countProductsForSection(sectionItem) {
    if (sectionItem.key === "appliances") return applianceCatalogueStats.platformMaster;
    return masterProducts
      .filter((product) => productBelongsToCatalogueSection(product, sectionItem))
      .filter((product) => product.active !== false && product.archived !== true)
      .length;
  }

  function countProductsForRoom(roomItem) {
    return masterProducts
      .filter((product) => productBelongsToRoom(product, roomItem.key))
      .filter((product) => product.active !== false && product.archived !== true)
      .length;
  }

  function countProductsForRoomCategory(categoryItem, roomItem = selectedRoom) {
    return masterProducts
      .filter((product) => productBelongsToRoomCategory(product, categoryItem))
      .filter((product) => !roomItem || productBelongsToRoom(product, roomItem.key))
      .filter((product) => product.active !== false && product.archived !== true)
      .length;
  }

  function reviewCountForSection(sectionItem) {
    if (sectionItem.key === "appliances") return applianceCatalogueStats.requiringVerification;
    return masterProducts
      .filter((product) => productBelongsToCatalogueSection(product, sectionItem))
      .filter((product) => ["missing", "review_required", "pending", "unverified"].includes(product.imageStatus) || !product.description)
      .length;
  }

  function statusForCount(count) {
    return count ? "Ready" : "Needs products";
  }

  function exportTemplateCsv() {
    downloadCsv("PRODUCT-LIBRARY-CATEGORY-IMPORT-TEMPLATE.csv", productLibraryExchangeTemplateRows());
  }

  // Builder edits persist as organisation-specific products and per-product
  // overrides. The static master catalogue is never rewritten, so no Product
  // Library action can replace or empty a committed family.
  function persistMasterCatalogue(nextProducts, nextEnablements = builderEnablements) {
    if (!workspaceId) return;
    const staticCodes = new Set(getMasterProducts().map((product) => product.productCode));
    (Array.isArray(nextProducts) ? nextProducts : []).forEach((product) => {
      if (!product?.productCode || staticCodes.has(product.productCode)) return;
      try {
        addBuilderProduct(workspaceId, product);
      } catch (addError) {
        console.error("[Product Library] custom product rejected", addError);
      }
    });
    (Array.isArray(nextEnablements) ? nextEnablements : []).forEach((ref) => {
      if (!ref?.masterProductCode || ref.organisationId !== workspaceId) return;
      const patch = { enabled: ref.enabled !== false };
      const price = ref.clientPrice ?? ref.overrides?.clientPrice;
      if (price != null && Number.isFinite(Number(price))) patch.builderPrice = Number(price);
      updateBuilderProductOverride(workspaceId, ref.masterProductCode, patch);
    });
    setMasterProducts(getMasterProducts());
    setBuilderEnablements(getBuilderEnablementRefs(workspaceId));
    setCatalogueRevision((current) => current + 1);
  }

  function handleMasterImportPreview(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const fileName = file.name || "";
    const lowerName = fileName.toLowerCase();
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        let format = "csv";
        let records = [];
        if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
          format = "xlsx";
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(reader.result, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          records = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
        } else {
          format = lowerName.endsWith(".json") ? "json" : "csv";
          records = parseMasterProductCatalogueImport(reader.result || "", { format });
        }
        const preview = previewMasterProductImport(records, masterProducts);
        setMasterImportPreview({ fileName, format, records, preview });
        setMasterCatalogueOpen(true);
        setSuccess(`Previewed ${preview.totalProducts} master product${preview.totalProducts === 1 ? "" : "s"} from ${fileName}.`);
      } catch (previewError) {
        setError(previewError.message || "Could not parse that catalogue import.");
      }
    };
    reader.onerror = () => setError("Could not read that catalogue import file.");
    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
    event.target.value = "";
  }

  function commitMasterPreview() {
    if (!masterImportPreview) return;
    const result = commitMasterProductImport(masterImportPreview.preview, masterProducts);
    persistMasterCatalogue(result.products);
    setMasterImportPreview(null);
    setSuccess(`Master import committed: ${result.created.length} created, ${result.updated.length} updated, ${result.skipped.length} unchanged, ${result.invalid.length} invalid skipped.`);
  }

  function exportMasterCsv() {
    downloadText("master-product-catalogue-export.csv", exportMasterCatalogueCsv(masterProducts), "text/csv;charset=utf-8");
  }

  function exportMasterJson() {
    downloadText("master-product-catalogue-export.json", exportMasterCatalogueJson(masterProducts), "application/json;charset=utf-8");
  }

  async function exportProductLibraryPackage() {
    try {
      setSaving(true);
      const includeImages = exportOptions.mode !== "csv";
      const scope = {
        scope: exportOptions.scope,
        sectionId: exportOptions.sectionId,
        sectionName: PRODUCT_LIBRARY_CATALOGUE_SECTIONS.find((section) => section.key === exportOptions.sectionId)?.displayName || "",
        categoryId: exportOptions.categoryId,
        categoryName: PRODUCT_LIBRARY_ROOM_CATEGORIES.find((category) => category.key === exportOptions.categoryId)?.name || "",
        brand: exportOptions.brand,
        range: exportOptions.range,
        activeFilters: masterFilters,
      };
      const result = await buildProductLibraryExportPackage({
        products: exportableProducts,
        scope,
        tenantId: workspaceId || "",
        builderId: workspaceId || "",
        includeImages,
      });
      if (result.blob) downloadBlob(result.fileName, result.blob);
      else downloadText(result.fileName, result.csv, result.contentType);
      setSuccess(`Exported ${exportableProducts.length} Product Library product${exportableProducts.length === 1 ? "" : "s"} as ${includeImages ? "CSV + images ZIP" : "CSV"}. Missing images: ${result.manifest.totals.missingImages}.`);
      setExportDialogOpen(false);
    } catch (exportError) {
      setError(exportError.message || "Could not export that Product Library package.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadProducts(productsToDownload = [], { includeImages = false, label = "selected", fileName = "" } = {}) {
    if (!productsToDownload.length) {
      setError("Select at least one Product Library item before downloading.");
      return;
    }
    try {
      setSaving(true);
      const result = await buildProductLibraryExportPackage({
        products: productsToDownload,
        scope: {
          scope: label,
          sectionId: masterFilters.section,
          categoryId: masterFilters.category,
          brand: masterFilters.brand,
          range: masterFilters.range,
          activeFilters: masterFilters,
        },
        tenantId: workspaceId || "",
        builderId: workspaceId || "",
        includeImages,
      });
      const outputFileName = fileName || result.fileName;
      if (result.blob) downloadBlob(outputFileName, result.blob);
      else downloadText(outputFileName, result.csv, result.contentType);
      setSuccess(`Downloaded ${productsToDownload.length} Product Library item${productsToDownload.length === 1 ? "" : "s"} as ${includeImages ? "CSV + images ZIP" : "CSV"}.`);
    } catch (downloadError) {
      setError(downloadError.message || "Could not download those Product Library items.");
    } finally {
      setSaving(false);
    }
  }

  function toggleCatalogueItemSelection(product) {
    const key = catalogueProductSelectionKey(product);
    if (!key) return;
    setSelectedCatalogueItemIds((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function selectAllFilteredCatalogueItems() {
    const visibleKeys = manageableProducts.map(catalogueProductSelectionKey).filter(Boolean);
    setSelectedCatalogueItemIds(Array.from(new Set(visibleKeys)));
  }

  function selectAllVisibleCabinetryItems() {
    const visibleKeys = cabinetryVisibleProducts.map(catalogueProductSelectionKey).filter(Boolean);
    setSelectedCatalogueItemIds(Array.from(new Set(visibleKeys)));
  }

  function selectAllVisibleCatalogueGroupItems() {
    const visibleKeys = catalogueGroupVisibleProducts.map(catalogueProductSelectionKey).filter(Boolean);
    setSelectedCatalogueItemIds(Array.from(new Set(visibleKeys)));
  }

  function setCabinetrySubcategory(subcategoryKey) {
    pushProductLibraryRoute({ catalogueSection: CABINETRY_SECTION_KEY, cabinetrySubcategory: subcategoryKey === "all" ? "" : subcategoryKey });
    setSelectedCatalogueItemIds([]);
  }

  function setCatalogueSubcategory(subcategoryKey) {
    if (!selectedCatalogueSection) return;
    pushProductLibraryRoute({ catalogueSection: selectedCatalogueSection.key, catalogueSubcategory: subcategoryKey === "all" ? "" : subcategoryKey });
    setSelectedCatalogueItemIds([]);
  }

  function clearCatalogueItemSelection() {
    setSelectedCatalogueItemIds([]);
  }

  function openManageCatalogueItems(filterPatch = {}) {
    setMasterCatalogueOpen(true);
    setMasterFilters((current) => ({
      ...current,
      search: "",
      ...filterPatch,
    }));
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.querySelector('[data-testid="manage-catalogue-items"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  async function handlePackageImportPreview(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setSaving(true);
      const parsed = await parseProductLibraryPackageFile(file);
      const preview = previewProductLibraryPackageImport(parsed, managementCatalogueProducts, { tenantId: workspaceId || "", builderId: workspaceId || "", importMode: packageImportMode });
      setPackageImportPreview(preview);
      setMasterImportPreview(null);
      setMasterCatalogueOpen(true);
      setSuccess(`Previewed ${preview.totalProducts} Product Library package product${preview.totalProducts === 1 ? "" : "s"} from ${file.name}.`);
    } catch (previewError) {
      setError(previewError.message || "Could not parse that Product Library import package.");
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  }

  function commitPackageImportPreview() {
    if (!packageImportPreview) return;
    const result = commitProductLibraryPackageImport(packageImportPreview, managementCatalogueProducts);
    result.masterOverrides.forEach((row) => {
      const price = row.product.clientPrice ?? row.product.normalizedUnitPrice ?? row.product.rrp;
      const patch = {
        enabled: row.product.active !== false && row.product.archived !== true,
        customFields: {
          description: row.product.description || "",
          model: row.product.model || "",
          productName: row.product.productName || "",
          clientSelectable: row.product.attributes?.clientSelectable !== false,
          quotationEnabled: row.product.attributes?.quotationEnabled !== false,
          ...(row.product.attributes?.internalAreasCatalogue ? {productAttributes:row.product.attributes,range:row.product.range,finish:row.product.finish,size:row.product.size,profile:row.product.profile,priceUnit:row.product.priceUnit,priceStatus:row.product.priceStatus,imageStatus:row.product.imageStatus} : {}),
        },
      };
      if (price != null && Number.isFinite(Number(price))) patch.builderPrice = Number(price);
      if (row.product.primaryImageUrl) patch.imageOverride = row.product.primaryImageUrl;
      updateBuilderProductOverride(workspaceId || "", row.existingProduct?.productCode || row.product.productCode, patch);
    });
    persistMasterCatalogue(result.products);
    setPackageImportPreview(null);
    setSelectedCatalogueItemIds([]);
    setSuccess(`Product Library import committed: ${result.created.length} builder-private products created, ${result.updated.length} updated, ${result.masterOverrides.length} matching master products updated by builder override, ${result.skipped.length} unchanged, ${result.invalid.length} invalid skipped. Client Selections and Quotation Builder will read through getEffectiveProductCatalogue.`);
  }

  function toggleBuilderProduct(masterProduct) {
    if (!workspaceId || !masterProduct) return;
    const existing = builderEnablements.find((item) => item.organisationId === workspaceId && item.masterProductCode === masterProduct.productCode);
    const nextEnablements = existing
      ? builderEnablements.map((item) => item === existing ? builderEnablementState(item, !item.enabled) : item)
      : [...builderEnablements, createBuilderProductReference(masterProduct, { organisationId: workspaceId, enabled: true, active: true, tier: BUILDER_PRODUCT_TIERS[0], selectionMode: BUILDER_PRODUCT_MODES[1] })];
    persistMasterCatalogue(masterProducts, nextEnablements);
    setSuccess(`${masterProduct.productName} ${existing?.enabled ? "disabled" : "enabled"} for this builder.`);
  }

  function setBuilderProductsEnabled(productsToToggle = [], enabled = true) {
    if (!workspaceId || !productsToToggle.length) return;
    const byCode = new Map(builderEnablements.map((item) => [`${item.organisationId}:${item.masterProductCode}`, item]));
    productsToToggle.forEach((product) => {
      const key = `${workspaceId}:${product.productCode}`;
      const existing = byCode.get(key);
      byCode.set(key, existing
        ? builderEnablementState(existing, enabled)
        : createBuilderProductReference(product, { organisationId: workspaceId, enabled, active: enabled, disableReason: enabled ? "" : EXPLICIT_BUILDER_DISABLE_REASON, tier: BUILDER_PRODUCT_TIERS[0], selectionMode: BUILDER_PRODUCT_MODES[1] }));
    });
    persistMasterCatalogue(masterProducts, Array.from(byCode.values()));
    setSuccess(`${productsToToggle.length} product${productsToToggle.length === 1 ? "" : "s"} ${enabled ? "enabled" : "disabled"} for this builder.`);
  }

  function handleProductCsvPreview(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const records = csvRecords(String(reader.result || ""));
      const preview = previewProductImportRows(records, { organisationId: workspaceId || "", existingProducts: orgProducts });
      setImportPreview({ fileName: file.name, records, preview });
      setAdminOpen(true);
      setSuccess(`Previewed ${preview.length} row${preview.length === 1 ? "" : "s"} from ${file.name}.`);
    };
    reader.onerror = () => setError("Could not read that CSV file.");
    reader.readAsText(file);
    event.target.value = "";
  }

  async function ensureCategory(familyItem) {
    const key = slugify(`${familyItem.topLevelArea}-${familyItem.category}-${familyItem.subcategory}`);
    const existing = categories.find((category) => category.category_key === key || slugify(category.category_name) === key);
    if (existing) return existing.id;
    const { data, error: createError } = await supabase
      .from("builder_product_categories")
      .insert({
        workspace_id: workspaceId,
        category_key: key,
        category_name: `${familyItem.category} - ${familyItem.subcategory}`,
        description: `${familyItem.displayName} product family`,
        metadata: { familyKey: familyItem.familyKey, topLevelArea: familyItem.topLevelArea },
      })
      .select("*")
      .single();
    if (createError) throw createError;
    setCategories((current) => [...current, data]);
    return data.id;
  }

  async function ensureSupplier(name) {
    const clean = String(name || "").trim();
    if (!clean) return null;
    const key = slugify(clean);
    const existing = suppliers.find((supplier) => slugify(supplier.supplier_name) === key);
    if (existing) return existing.id;
    const { data, error: createError } = await supabase.from("builder_product_suppliers").insert({ workspace_id: workspaceId, supplier_name: clean, active: true }).select("*").single();
    if (createError) throw createError;
    setSuppliers((current) => [...current, data]);
    return data.id;
  }

  async function ensureManufacturer(name) {
    const clean = String(name || "").trim();
    if (!clean) return null;
    const key = slugify(clean);
    const existing = manufacturers.find((manufacturer) => slugify(manufacturer.manufacturer_name) === key);
    if (existing) return existing.id;
    const { data, error: createError } = await supabase.from("builder_product_manufacturers").insert({ workspace_id: workspaceId, manufacturer_name: clean, active: true }).select("*").single();
    if (createError) throw createError;
    setManufacturers((current) => [...current, data]);
    return data.id;
  }

  async function saveEntityProduct(entity, mode = "create") {
    if (!workspaceId) throw new Error("Choose an organisation before saving products.");
    if (entity.organisationId && entity.organisationId !== workspaceId) throw new Error("Product organisation does not match the active organisation.");
    const familyItem = familyByKey(entity.familyKey);
    const categoryId = await ensureCategory(familyItem);
    const supplierId = await ensureSupplier(entity.supplier);
    const manufacturerId = await ensureManufacturer(entity.brand);
    const payload = {
      workspace_id: workspaceId,
      category_id: categoryId,
      supplier_id: supplierId,
      manufacturer_id: manufacturerId,
      product_name: entity.productName,
      sku: entity.productCode,
      model: entity.model,
      description: entity.description,
      primary_image_url: entity.primaryImage,
      product_url: entity.officialProductURL,
      datasheet_pdf_url: entity.specificationURL,
      supplier_website_url: entity.supplierURL,
      base_allowance: entity.builderCost || entity.allowance || 0,
      upgrade_cost: entity.clientPrice || entity.upgradePrice || 0,
      quote_structure_section: familyItem.category,
      quote_structure_item: familyItem.displayName,
      quote_structure_row_id: entity.linkedQuoteItemCode || familyItem.approvedSourceKey,
      selection_type: familyItem.familyKey,
      active: entity.active !== false,
      metadata: {
        productEntity: entity,
        familyKey: familyItem.familyKey,
        topLevelArea: familyItem.topLevelArea,
        category: familyItem.category,
        subcategory: familyItem.subcategory,
        range: entity.range,
        colour: entity.colour,
        finish: entity.finish,
        size: entity.size,
        width: entity.width,
        height: entity.height,
        depth: entity.depth,
        dimensions: entity.dimensions,
        variants: entity.variants,
        galleryImages: entity.galleryImages,
        colourSwatches: entity.colourSwatches,
        officialProductURL: entity.officialProductURL,
        specificationURL: entity.specificationURL,
        supplierURL: entity.supplierURL,
        RRP: entity.RRP,
        builderCost: entity.builderCost,
        clientPrice: entity.clientPrice,
        allowance: entity.allowance,
        upgradePrice: entity.upgradePrice,
        currency: entity.currency,
        gstTreatment: entity.gstTreatment,
        priceSource: entity.priceSource,
        priceEffectiveDate: entity.priceEffectiveDate,
        active: entity.active,
        discontinued: entity.discontinued,
        archived: entity.archived,
        unavailable: entity.unavailable,
        approvedSourceKey: entity.approvedSourceKey,
      },
      updated_at: new Date().toISOString(),
    };
    const existing = products.find((product) => product.workspace_id === workspaceId && product.sku && product.sku === entity.productCode);
    const request = existing && mode !== "duplicate"
      ? supabase.from("builder_products").update(payload).eq("workspace_id", workspaceId).eq("id", existing.id).select("*").single()
      : supabase.from("builder_products").insert(payload).select("*").single();
    const { data, error: saveError } = await request;
    if (saveError) throw saveError;
    setProducts((current) => [data, ...current.filter((product) => product.id !== data.id)]);
    return data;
  }

  async function importPreviewRows() {
    if (!workspaceId || !importPreview) return;
    setSaving(true);
    setError("");
    try {
      const actionableRows = importPreview.preview.filter((row) => !row.errors.length && row.entity && row.action !== "skip-unchanged");
      for (const row of actionableRows) {
        await saveEntityProduct(row.entity, row.action === "update" ? "update" : "create");
      }
      const created = actionableRows.filter((row) => row.action === "create").length;
      const updated = actionableRows.filter((row) => row.action === "update").length;
      const skipped = importPreview.preview.filter((row) => row.action === "skip-unchanged").length;
      const errored = importPreview.preview.filter((row) => row.errors.length).length;
      setSuccess(`Import complete: ${created} created, ${updated} updated, ${skipped} unchanged skipped, ${errored} row error${errored === 1 ? "" : "s"}.`);
      setImportPreview(null);
      await loadLibrary();
    } catch (saveError) {
      setError(saveError.message || "Product import failed.");
    }
    setSaving(false);
  }

  async function saveManualProduct(event) {
    event.preventDefault();
    if (!workspaceId || !selectedFamily) return;
    setSaving(true);
    setError("");
    try {
      const masterRecord = normalizeMasterProductRecord({
        product_code: productForm.product_code,
        family_key: selectedFamily.familyKey,
        requirement_keys: selectedFamily.familyKey,
        category_key: selectedFamily.category,
        top_level_area: selectedFamily.topLevelArea,
        manufacturer: productForm.supplier_name || productForm.brand,
        brand: productForm.brand,
        supplier: productForm.supplier_name,
        range: productForm.range,
        product_name: productForm.product_name,
        model: productForm.model,
        sku: productForm.model,
        description: productForm.description,
        colour: productForm.colour,
        finish: productForm.finish,
        size: productForm.size,
        dimensions: { width: productForm.width, height: productForm.height, depth: productForm.depth },
        texture: productForm.texture,
        primary_image_url: productForm.primary_image,
        thumbnail_url: productForm.primary_image,
        gallery_image_urls: productForm.gallery_images,
        image_source_url: productForm.image_source_url || productForm.primary_image,
        image_status: productForm.primary_image ? (productForm.image_status === "missing" ? "review_required" : productForm.image_status) : "missing",
        image_verified_at: productForm.image_verified_at,
        official_product_url: productForm.official_product_url,
        specification_url: productForm.specification_url,
        supplier_url: productForm.supplier_url,
        rrp: productForm.rrp,
        client_price: productForm.client_price,
        currency: productForm.currency,
        price_unit: productForm.price_unit,
        price_status: productForm.price_status,
        price_source_url: productForm.price_source_url,
        price_verified_at: productForm.price_verified_at || productForm.price_effective_date,
        regions: productForm.region,
        active: productForm.active,
        discontinued: productForm.discontinued,
        archived: productForm.archived,
        source_type: editingProductId ? "product_library_edit" : "product_library_manual",
        source_name: "Product Library",
        source_url: productForm.official_product_url || "product-library",
        notes: productForm.description,
      });
      const nextProducts = [...masterProducts.filter((product) => product.productCode !== masterRecord.productCode), masterRecord];
      const builderOverridePrice = productForm.builder_cost === "" ? null : Number(productForm.builder_cost);
      const hasEnablement = builderEnablements.some((item) => item.organisationId === workspaceId && item.masterProductCode === masterRecord.productCode);
      const nextEnablements = hasEnablement
        ? builderEnablements.map((item) => item.organisationId === workspaceId && item.masterProductCode === masterRecord.productCode
          ? { ...item, clientPrice: Number.isFinite(builderOverridePrice) ? builderOverridePrice : item.clientPrice, overrides: { ...(item.overrides || {}), clientPrice: Number.isFinite(builderOverridePrice) ? builderOverridePrice : item.overrides?.clientPrice } }
          : item)
        : [...builderEnablements, createBuilderProductReference(masterRecord, { organisationId: workspaceId, enabled: true, active: true, tier: BUILDER_PRODUCT_TIERS[0], selectionMode: BUILDER_PRODUCT_MODES[1], clientPrice: Number.isFinite(builderOverridePrice) ? builderOverridePrice : null })];
      persistMasterCatalogue(nextProducts, nextEnablements);
      setProductForm(EMPTY_PRODUCT);
      setEditingProductId("");
      setSelectedProductCode(masterRecord.productCode);
      setSuccess(`${masterRecord.productName} saved to the shared master catalogue.`);
    } catch (saveError) {
      setError(saveError.message || "Could not save product.");
    }
    setSaving(false);
  }

  function editProduct(entity) {
    if (!entity) return;
    setSelectedProductCode(entity.productCode || entity.productId);
    setEditingProductId(entity.productId || entity.raw?.id || "");
    setProductForm({
      product_code: entity.productCode || "",
      product_name: entity.productName || "",
      supplier_name: entity.supplier || "",
      brand: entity.brand || "",
      range: entity.range || "",
      model: entity.model || "",
      description: entity.description || "",
      colour: entity.colour || "",
      finish: entity.finish || "",
      size: entity.size || "",
      texture: entity.texture || "",
      width: entity.width || entity.dimensions?.width || "",
      height: entity.height || entity.dimensions?.height || "",
      depth: entity.depth || entity.dimensions?.depth || "",
      variant_name: entity.variants?.[0]?.variantName || "",
      primary_image: entity.primaryImageUrl || entity.primaryImage || "",
      gallery_images: (entity.galleryImageUrls || entity.galleryImages || []).join("|"),
      official_product_url: entity.officialProductUrl || entity.officialProductURL || "",
      specification_url: entity.specificationUrl || entity.specificationURL || "",
      supplier_url: entity.supplierUrl || entity.supplierURL || "",
      rrp: entity.rrp ?? entity.RRP ?? "",
      builder_cost: entity.builder?.clientPrice ?? "",
      client_price: entity.clientPrice || "",
      currency: entity.currency || "AUD",
      gst_treatment: entity.gstTreatment || "GST inclusive",
      price_unit: entity.priceUnit || "",
      price_status: entity.priceStatus || "price_pending",
      price_source_url: entity.priceSourceUrl || "",
      price_verified_at: entity.priceVerifiedAt || "",
      image_source_url: entity.imageSourceUrl || "",
      image_status: entity.imageStatus || (entity.primaryImageUrl || entity.primaryImage ? "review_required" : "missing"),
      image_verified_at: entity.imageVerifiedAt || "",
      region: (entity.regions || [])[0] || "QLD",
      price_effective_date: entity.priceEffectiveDate || entity.priceVerifiedAt || "",
      active: entity.active !== false,
      discontinued: entity.discontinued || false,
      archived: entity.archived || false,
    });
    setAdminOpen(true);
  }

  function duplicateProduct(entity) {
    if (!entity) return;
    editProduct({
      ...entity,
      productId: "",
      productCode: `${entity.productCode || slugify(entity.productName)}-copy`,
      productName: `${entity.productName} Copy`,
    });
    setEditingProductId("");
    setSuccess("Duplicating product. Review the new code and save when ready.");
  }

  function startNewProduct(overrides = {}) {
    if (!selectedFamily) {
      setError("Choose a product family before adding supplier, range or product records.");
      return;
    }
    setError("");
    setEditingProductId("");
    setProductForm({
      ...EMPTY_PRODUCT,
      supplier_name: selectedSupplierName || "",
      range: selectedRangeName || "",
      ...overrides,
    });
    setAdminOpen(true);
  }

  function addSupplier() {
    const supplierName = typeof window !== "undefined" ? window.prompt("Supplier name") : "";
    if (supplierName === null) return;
    const name = String(supplierName || "").trim();
    if (!name) {
      setError("Enter a supplier name before adding supplier-managed products.");
      return;
    }
    setSelectedSupplierName(name);
    setSelectedRangeName("");
    startNewProduct({ supplier_name: name, range: "" });
    setSuccess(`Supplier "${name}" is ready. Add the first product to save it in the master catalogue.`);
  }

  function addRange() {
    const rangeName = typeof window !== "undefined" ? window.prompt("Range name") : "";
    if (rangeName === null) return;
    const name = String(rangeName || "").trim();
    if (!name) {
      setError("Enter a range name before adding range-managed products.");
      return;
    }
    const supplierName = selectedSupplierName || productForm.supplier_name || selectedProduct?.supplier || "";
    setSelectedRangeName(name);
    startNewProduct({ supplier_name: supplierName, range: name });
    setSuccess(`Range "${name}" is ready. Add the first product to save it in the master catalogue.`);
  }

  async function archiveProduct(entity) {
    if (!entity?.productCode) return;
    setSaving(true);
    setError("");
    // Archiving hides the product from new selections via a builder override.
    // The master record itself is retained - see catalogueService B4/B8.
    disableProduct(workspaceId, entity.productCode);
    setBuilderEnablements(getBuilderEnablementRefs(workspaceId || ""));
    setSuccess("Product archived for new selections. Existing saved selections keep their product reference.");
    setSaving(false);
  }

  function persistJobFile(nextJobFile, nextFileName = jobFileName) {
    setJobFile(nextJobFile);
    setJobFileName(nextFileName || DEFAULT_JOB_FILE_NAME);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PRODUCT_LIBRARY_JOB_STORAGE_KEY, JSON.stringify({ fileName: nextFileName || DEFAULT_JOB_FILE_NAME, jobFile: nextJobFile }));
    }
  }

  function saveJobFile() {
    const fileName = String(jobFileName || DEFAULT_JOB_FILE_NAME).toLowerCase().endsWith(".gr8job") ? jobFileName : `${jobFileName || "product-library-selections"}.gr8job`;
    const payload = {
      ...jobFile,
      fileType: "gr8job",
      savedAt: new Date().toISOString(),
      productLibrarySelections: productLibrarySelectionsFromJobFile(jobFile),
    };
    persistJobFile(payload, fileName);
    downloadJson(fileName, payload);
    setSuccess(`Saved Garage Door selections to ${fileName}.`);
  }

  function openJobFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        const selectionsFromFile = productLibrarySelectionsFromJobFile(parsed);
        const nextJobFile = {
          ...parsed,
          [PRODUCT_LIBRARY_SELECTIONS_KEY]: selectionsFromFile,
          workbook: {
            ...(parsed.workbook || {}),
            [PRODUCT_LIBRARY_SELECTIONS_KEY]: selectionsFromFile,
          },
        };
        persistJobFile(nextJobFile, file.name || DEFAULT_JOB_FILE_NAME);
        setSuccess(`Opened ${file.name || "job file"} with ${Object.keys(selectionsFromFile).length} product selection${Object.keys(selectionsFromFile).length === 1 ? "" : "s"}.`);
      } catch {
        setError("Could not open that .gr8job file.");
      }
    };
    reader.onerror = () => setError("Could not read that .gr8job file.");
    reader.readAsText(file);
    event.target.value = "";
  }

  function closeProductLibrary() {
    setSelectedAreaKey("");
    setSelectedCategoryKey("");
    setSelectedFamilyKey("");
    setSelectedSupplierName("");
    setSelectedRangeName("");
    setSelectedProductCode("");
    setSelectedVariantIndex(0);
    safeSelectionNavigate(router, "/modules/builders");
  }

  return (
    <>
      <Head>
        <title>Product Library | Gr8 Result</title>
      </Head>
      <main className="page">
        {furniturePicker.panel}
        {furniturePicker.enabled?<div aria-label="Door furniture brands" style={{display:'flex',gap:12,flexWrap:'wrap'}}>{['Lockwood','Gainsborough','Lemaar','Zanda'].map(brand=><button type="button" key={brand} data-testid={`furniture-brand-${brand}`} onClick={()=>setMasterFilters(current=>({...current,brand:current.brand===brand?'':brand}))}>{brand}</button>)}</div>:null}
        <header className="standard-banner">
          <button type="button" className="back-button" onClick={goBack} aria-label="Back">
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
          <div className="banner-icon">
            <Package size={28} />
          </div>
          <div className="banner-copy">
            <h1>{furniturePicker.enabled ? "Exterior Door Furniture" : bannerTitle}</h1>
            <p>{furniturePicker.enabled ? "Choose hardware for the active job and entry door." : bannerSubtitle}</p>
          </div>
          <div className="banner-meta" style={furniturePicker.enabled ? {display:"none"} : undefined}>
            <span>{workspaceLoading ? "Loading organisation..." : activeWorkspace?.name || "No organisation selected"}</span>
            <span>{loading ? "Loading..." : success || `${Object.keys(selections).length} selection${Object.keys(selections).length === 1 ? "" : "s"} in ${jobFileName}`}</span>
            <div className="file-controls">
              <button type="button" onClick={loadLibrary} disabled={!workspaceId || loading}><RefreshCw size={16} /> Refresh</button>
              <label className="file-button">
                <FolderOpen size={16} />
                Open .gr8job
                <input type="file" accept=".gr8job,application/json" onChange={openJobFile} />
              </label>
              <button type="button" onClick={saveJobFile}><FileDown size={16} /> Save .gr8job</button>
              <button type="button" onClick={closeProductLibrary}><X size={16} /> Close</button>
            </div>
          </div>
        </header>

        {error ? <div className="alert error">{error}</div> : null}
        {success ? <div className="alert success">{success}</div> : null}

        <section className="master-catalogue" data-admin-surface="master-catalogue" style={furniturePicker.enabled ? {display:"none"} : undefined}>
          <div className="section-heading">
            <span>Product Library Management</span>
            <strong>Master Catalogue</strong>
          </div>
          <div className="master-toolbar">
            <button type="button" onClick={() => setMasterCatalogueOpen((current) => !current)}><Boxes size={16} /> Master Catalogue</button>
            <label className="file-button">
              <Upload size={16} />
              Import Package
              <input data-testid="product-library-import-catalogue-input" type="file" accept=".zip,application/zip,.csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.json,application/json" onChange={handlePackageImportPreview} />
            </label>
            <select aria-label="Product Library import mode" value={packageImportMode} onChange={(event) => setPackageImportMode(event.target.value)}>
              <option value="update">Update matching products</option>
              <option value="add">Add as new products</option>
            </select>
            <button type="button" onClick={exportTemplateCsv}><FileUp size={16} /> Import Template</button>
            <button type="button" onClick={() => setExportDialogOpen((current) => !current)}><FileDown size={16} /> Export Package</button>
            <button type="button" onClick={exportMasterJson}><FileDown size={16} /> Export Catalogue JSON</button>
            <button type="button" onClick={() => setSuccess(`Add Product uses the canonical schema from ${MASTER_PRODUCT_CATALOGUE_IMPORT_TEMPLATE}.`)}><Plus size={16} /> Add Product</button>
          </div>
          {masterCatalogueOpen ? (
            <div className="master-body">
              {exportDialogOpen ? (
                <div className="import-preview" data-testid="product-library-export-dialog" data-export-preview="product-library-package">
                  <div className="panel-title">
                    <FileDown size={18} />
                    <strong>Export Product Library Package</strong>
                  </div>
                  <div className="master-filters">
                    <select value={exportOptions.scope} onChange={(event) => setExportOptions((current) => ({ ...current, scope: event.target.value }))}>
                      <option value="current-filtered">Current filtered results</option>
                      <option value="all">Entire effective catalogue</option>
                      <option value="builder-private">Builder-private products</option>
                      <option value="missing-images">Missing images</option>
                      <option value="missing-prices">Missing prices</option>
                      <option value="inactive">Inactive/discontinued</option>
                    </select>
                    <select value={exportOptions.sectionId} onChange={(event) => setExportOptions((current) => ({ ...current, sectionId: event.target.value }))}>
                      <option value="">Any section/category</option>
                      {PRODUCT_LIBRARY_CATALOGUE_SECTIONS.map((section) => <option key={section.key} value={section.key}>{section.displayName}</option>)}
                    </select>
                    <select value={exportOptions.categoryId} onChange={(event) => setExportOptions((current) => ({ ...current, categoryId: event.target.value }))}>
                      <option value="">Any product type</option>
                      {PRODUCT_LIBRARY_ROOM_CATEGORIES.map((category) => <option key={category.key} value={category.key}>{category.name}</option>)}
                    </select>
                    <select value={exportOptions.brand} onChange={(event) => setExportOptions((current) => ({ ...current, brand: event.target.value }))}>
                      <option value="">Any brand</option>
                      {masterBrands.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <select value={exportOptions.range} onChange={(event) => setExportOptions((current) => ({ ...current, range: event.target.value }))}>
                      <option value="">Any range</option>
                      {masterRanges.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <select value={exportOptions.mode} onChange={(event) => setExportOptions((current) => ({ ...current, mode: event.target.value }))}>
                      <option value="zip">CSV + Images ZIP</option>
                      <option value="csv">CSV only</option>
                    </select>
                  </div>
                  <div className="master-summary">
                    <span>Products: {exportableProducts.length}</span>
                    <span>Platform/master: {exportableProducts.filter((product) => !product.isCustom && !product.organisationId && !product.builderId).length}</span>
                    <span>Builder-private: {exportableProducts.filter((product) => product.isCustom || product.organisationId || product.builderId).length}</span>
                    <span>Schema columns: {PRODUCT_LIBRARY_EXCHANGE_COLUMNS.length}</span>
                  </div>
                  <button type="button" onClick={exportProductLibraryPackage} disabled={saving || !exportableProducts.length}><Archive size={16} /> Download</button>
                </div>
              ) : null}
              <div className="roofing-admin-sections" data-roofing-admin="systems-profiles-colours-compatibility-builder-availability">
                <button type="button" onClick={() => setMasterFilters((current) => ({ ...current, area: "exterior", family: "roofing" }))}>Roof Systems</button>
                <button type="button" onClick={() => setMasterFilters((current) => ({ ...current, area: "exterior", family: "roofing" }))}>Profiles</button>
                <button type="button" onClick={() => setMasterFilters((current) => ({ ...current, area: "exterior", family: "roofing" }))}>Colours</button>
                <button type="button" onClick={() => setMasterFilters((current) => ({ ...current, area: "exterior", family: "roofing" }))}>Compatibility</button>
                <button type="button" onClick={() => setMasterFilters((current) => ({ ...current, area: "exterior", family: "roofing" }))}>Builder availability</button>
                <span>{roofingAdminProof.systems} systems / {roofingAdminProof.profiles} profiles / {roofingAdminProof.colours} colours / {roofingAdminProof.enabled} enabled</span>
              </div>
              <div className="master-filters">
                <input value={masterFilters.search} onChange={(event) => setMasterFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search product name, model, SKU, product code" />
                <select value={masterFilters.area} onChange={(event) => setMasterFilters((current) => ({ ...current, area: event.target.value }))}>
                  <option value="">Area</option>
                  {TOP_LEVEL_AREAS.map((area) => <option key={area.key} value={area.key}>{area.displayName}</option>)}
                </select>
                <select value={masterFilters.section} onChange={(event) => setMasterFilters((current) => ({ ...current, section: event.target.value }))}>
                  <option value="">Section</option>
                  {PRODUCT_LIBRARY_CATALOGUE_SECTIONS.map((section) => <option key={section.key} value={section.key}>{section.displayName}</option>)}
                </select>
                <select value={masterFilters.category} onChange={(event) => setMasterFilters((current) => ({ ...current, category: event.target.value }))}>
                  <option value="">Category</option>
                  {TAXONOMY_CATEGORY_DEFINITIONS.map((categoryItem) => <option key={categoryItem.key} value={categoryItem.key}>{categoryItem.category}</option>)}
                  {PRODUCT_LIBRARY_ROOM_CATEGORIES.map((categoryItem) => <option key={categoryItem.key} value={categoryItem.key}>{categoryItem.name}</option>)}
                </select>
                <select value={masterFilters.family} onChange={(event) => setMasterFilters((current) => ({ ...current, family: event.target.value }))}>
                  <option value="">Product Family</option>
                  {PRODUCT_FAMILIES.map((familyItem) => <option key={familyItem.familyKey} value={familyItem.familyKey}>{familyItem.displayName}</option>)}
                </select>
                <select value={masterFilters.manufacturer} onChange={(event) => setMasterFilters((current) => ({ ...current, manufacturer: event.target.value }))}>
                  <option value="">Manufacturer</option>
                  {masterManufacturers.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select value={masterFilters.brand} onChange={(event) => setMasterFilters((current) => ({ ...current, brand: event.target.value }))}>
                  <option value="">Brand</option>
                  {masterBrands.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select value={masterFilters.supplier} onChange={(event) => setMasterFilters((current) => ({ ...current, supplier: event.target.value }))}>
                  <option value="">Supplier</option>
                  {masterSuppliers.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select value={masterFilters.range} onChange={(event) => setMasterFilters((current) => ({ ...current, range: event.target.value }))}>
                  <option value="">Range</option>
                  {masterRanges.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select value={masterFilters.room} onChange={(event) => setMasterFilters((current) => ({ ...current, room: event.target.value }))}>
                  <option value="">Room</option>
                  {PRODUCT_LIBRARY_ROOMS.map((room) => <option key={room.key} value={room.key}>{room.name}</option>)}
                </select>
                <select value={masterFilters.region} onChange={(event) => setMasterFilters((current) => ({ ...current, region: event.target.value }))}>
                  <option value="">Region</option>
                  {AUSTRALIAN_REGIONS.map((region) => <option key={region} value={region}>{region}</option>)}
                </select>
                <select value={masterFilters.imageStatus} onChange={(event) => setMasterFilters((current) => ({ ...current, imageStatus: event.target.value }))}>
                  <option value="">Image Status</option>
                  {MASTER_IMAGE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <select value={masterFilters.priceStatus} onChange={(event) => setMasterFilters((current) => ({ ...current, priceStatus: event.target.value }))}>
                  <option value="">Price Status</option>
                  {MASTER_PRICE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <select value={masterFilters.ownership} onChange={(event) => setMasterFilters((current) => ({ ...current, ownership: event.target.value }))}>
                  <option value="">Ownership</option>
                  <option value="platform-master">Platform/master</option>
                  <option value="builder-private">Builder-private</option>
                </select>
                <select value={masterFilters.clientSelectable} onChange={(event) => setMasterFilters((current) => ({ ...current, clientSelectable: event.target.value }))}>
                  <option value="">Client selectable</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                <select value={masterFilters.quotationEnabled} onChange={(event) => setMasterFilters((current) => ({ ...current, quotationEnabled: event.target.value }))}>
                  <option value="">Quotation enabled</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                <select value={masterFilters.status} onChange={(event) => setMasterFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="">Active/Discontinued</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>

              <div className="master-summary">
                <span>Total: {masterProducts.length}</span>
                <span>Filtered: {manageableProducts.length}</span>
                <span>Selected: {selectedCatalogueProducts.length}</span>
                <span>Builder enabled: {builderEnablements.filter((item) => item.organisationId === workspaceId && item.enabled).length}</span>
                <span data-client-selections-query-proof="enabled-compatible-products">Client Selections query proof: {selectableProof.length} enabled compatible product{selectableProof.length === 1 ? "" : "s"}</span>
              </div>

              <div className="manage-catalogue-items" data-testid="manage-catalogue-items">
                <div className="panel-title">
                  <Boxes size={18} />
                  <strong>Manage Catalogue Items</strong>
                </div>
                <div className="admin-actions catalogue-selection-actions">
                  <button type="button" onClick={selectAllFilteredCatalogueItems} disabled={!manageableProducts.length}><Check size={16} /> Select All Visible</button>
                  <button type="button" className="secondary" onClick={clearCatalogueItemSelection} disabled={!selectedCatalogueProducts.length}><X size={16} /> Clear Selection</button>
                  <button type="button" onClick={() => downloadProducts(selectedCatalogueProducts, { includeImages: false, label: "selected" })} disabled={!selectedCatalogueProducts.length || saving}><FileDown size={16} /> Download Selected CSV</button>
                  <button type="button" onClick={() => downloadProducts(manageableProducts, { includeImages: false, label: "current-filtered" })} disabled={!manageableProducts.length || saving}><FileDown size={16} /> Download Filtered Section CSV</button>
                  <button type="button" onClick={() => downloadProducts(selectedCatalogueProducts, { includeImages: true, label: "selected" })} disabled={!selectedCatalogueProducts.length || saving}><Archive size={16} /> Download Selected + Images ZIP</button>
                  <span>{selectedCatalogueProducts.length} selected from {manageableProducts.length} filtered</span>
                </div>
                <div className="catalogue-items-table" role="table" aria-label="Manage catalogue items">
                  <div className="catalogue-items-head" role="row">
                    <span role="columnheader">Select</span>
                    <span role="columnheader">Thumbnail</span>
                    <span role="columnheader">Product name</span>
                    <span role="columnheader">Brand</span>
                    <span role="columnheader">Range</span>
                    <span role="columnheader">Model / SKU</span>
                    <span role="columnheader">Product Library category</span>
                    <span role="columnheader">Quotation Builder section</span>
                    <span role="columnheader">Price</span>
                    <span role="columnheader">Unit</span>
                    <span role="columnheader">Status</span>
                    <span role="columnheader">Client Selections</span>
                    <span role="columnheader">Quotation Builder</span>
                  </div>
                  {manageableProducts.length ? manageableProducts.map((product) => {
                    const key = catalogueProductSelectionKey(product);
                    const checked = selectedCatalogueItemSet.has(key);
                    const familyItem = familyByKey(product.familyKey);
                    return (
                      <div key={key} className="catalogue-items-row" role="row" data-catalogue-product-id={key}>
                        <label className="table-check">
                          <input type="checkbox" checked={checked} onChange={() => toggleCatalogueItemSelection(product)} />
                          <span className="sr-only">Select {product.productName}</span>
                        </label>
                        <span className="catalogue-thumb"><ProductLibraryProductImage product={product} familyItem={familyItem} /></span>
                        <strong>{product.productName || "Unnamed product"}</strong>
                        <span>{product.brand || product.manufacturer || product.supplier || "No brand"}</span>
                        <span>{product.range || product.collection || "No range"}</span>
                        <span>{[product.model, product.sku, product.productCode].filter(Boolean).join(" / ") || "No model"}</span>
                        <span>{productCategoryLabel(product)}</span>
                        <span>{quotationSectionLabel(product)}</span>
                        <span>{productPriceLabel(product)}</span>
                        <span>{productUnitLabel(product)}</span>
                        <span>{product.active === false || product.archived ? "Inactive" : product.enabled === false ? "Disabled" : product.discontinued ? "Discontinued" : "Active"}</span>
                        <span>{productEnabledLabel(product, "clientSelectable")}</span>
                        <span>{productEnabledLabel(product, "quotationEnabled")}</span>
                      </div>
                    );
                  }) : (
                    <div className="empty-state compact">
                      <strong>No catalogue items match the current filters.</strong>
                      <span>Adjust section, product type, brand, range or active status to manage another set.</span>
                    </div>
                  )}
                </div>
              </div>

              {masterImportPreview ? (
                <div className="import-preview" data-testid="product-library-import-preview" data-import-preview="master-catalogue">
                  <div className="panel-title">
                    <FileUp size={18} />
                    <strong>Import Preview: {masterImportPreview.fileName}</strong>
                  </div>
                  <p>
                    Total rows/products: {masterImportPreview.preview.totalProducts}.{" "}
                    New products: {masterImportPreview.preview.newProducts}.{" "}
                    Existing products: {masterImportPreview.preview.existingProducts}.{" "}
                    Changed products: {masterImportPreview.preview.changedProducts}.{" "}
                    Unchanged products: {masterImportPreview.preview.unchangedProducts}.{" "}
                    Invalid products: {masterImportPreview.preview.invalidProducts}.
                  </p>
                  <p>
                    Missing family mapping: {masterImportPreview.preview.missingFamilyMapping}.{" "}
                    Missing image: {masterImportPreview.preview.missingImage}.{" "}
                    Unverified image: {masterImportPreview.preview.unverifiedImage}.{" "}
                    Missing official URL: {masterImportPreview.preview.missingOfficialUrl}.{" "}
                    Missing price: {masterImportPreview.preview.missingPrice}.{" "}
                    Expired price: {masterImportPreview.preview.expiredPrice}.{" "}
                    Duplicate product codes: {masterImportPreview.preview.duplicateProductCodes}.{" "}
                    Duplicate manufacturer/model combinations: {masterImportPreview.preview.duplicateManufacturerModelCombinations}.{" "}
                    Unknown regions: {masterImportPreview.preview.unknownRegions}.{" "}
                    Potential discontinued products: {masterImportPreview.preview.potentialDiscontinuedProducts}.
                  </p>
                  <div className="preview-list">
                    {masterImportPreview.preview.rows.slice(0, 16).map((row) => (
                      <div key={`${row.rowNumber}-${row.productCode}`} className={row.valid ? "preview-row" : "preview-row error"}>
                        {row.record.primaryImageUrl ? <img src={row.record.primaryImageUrl} alt={`${row.productName || "Product"} preview`} /> : <span className="preview-image-empty">No image</span>}
                        <strong>Row/Product {row.rowNumber}</strong>
                        <span>
                          {row.productName || row.productCode || "Unnamed product"}
                          <small>{row.familyMapping?.displayName || "Missing family mapping"} / {row.imageStatus} / {row.priceStatus}</small>
                        </span>
                        <small>{row.issues.length ? row.issues.map((issue) => `${issue.field}: ${issue.problem}`).join("; ") : row.action}</small>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={commitMasterPreview} disabled={saving}><Upload size={16} /> Commit Valid Rows</button>
                </div>
              ) : null}

              {packageImportPreview ? (
                <div className="import-preview" data-testid="product-library-package-import-preview" data-import-preview="product-library-package">
                  <div className="panel-title">
                    <Archive size={18} />
                    <strong>Package Import Preview: {packageImportPreview.fileName}</strong>
                  </div>
                  <p>
                    Total products: {packageImportPreview.totalProducts}.{" "}
                    New products: {packageImportPreview.newProducts}.{" "}
                    Updated products: {packageImportPreview.updatedProducts}.{" "}
                    Master overrides: {packageImportPreview.masterOverrideProducts}.{" "}
                    Unchanged products: {packageImportPreview.unchangedProducts}.{" "}
                    Invalid rows: {packageImportPreview.invalidProducts}.{" "}
                    Duplicate IDs/models: {packageImportPreview.duplicateIdsModels}.{" "}
                    Missing prices: {packageImportPreview.missingPrices}.{" "}
                    Missing images: {packageImportPreview.missingImages}.
                  </p>
                  {packageImportPreview.manifest ? (
                    <p>
                      Manifest schema: {packageImportPreview.manifest.schemaVersion || "unknown"}.{" "}
                      Exported: {packageImportPreview.manifest.exportDate || "unknown"}.{" "}
                      Source builder: {packageImportPreview.manifest.builderId || "not supplied"}.
                    </p>
                  ) : null}
                  <div className="preview-list">
                    {packageImportPreview.rows.slice(0, 16).map((row) => (
                      <div key={`${row.rowNumber}-${row.product.productCode || row.product.productId}`} className={row.valid ? "preview-row" : "preview-row error"}>
                        {row.product.primaryImageUrl ? <img src={row.product.primaryImageUrl} alt={`${row.product.productName || "Product"} preview`} /> : <span className="preview-image-empty">No image</span>}
                        <strong>Row/Product {row.rowNumber}</strong>
                        <span>
                          {row.product.productName || row.product.productCode || "Unnamed product"}
                          <small>{row.product.brand || "No brand"} / {row.product.familyKey || "No family"} / {row.action}</small>
                        </span>
                        <small>{row.issues.length ? row.issues.map((issue) => `${issue.field}: ${issue.problem}`).join("; ") : "Ready to commit to builder-private Product Library"}</small>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={commitPackageImportPreview} disabled={saving || !packageImportPreview.validProducts}><Upload size={16} /> Commit Valid Rows</button>
                </div>
              ) : null}

              <div className="master-table" data-builder-catalogue="reference-layer">
                {filteredMasterProducts.length ? filteredMasterProducts.slice(0, 24).map((product) => {
                  const enabled = builderEnablements.some((item) => item.organisationId === workspaceId && item.masterProductCode === product.productCode && item.enabled);
                  return (
                    <div key={product.productCode} className="master-row">
                      <strong>{product.productName}</strong>
                      <span>{product.productCode}</span>
                      <span>{[product.manufacturer, product.brand, product.range, product.model].filter(Boolean).join(" / ") || "No manufacturer detail"}</span>
                      <span>{product.familyKey} / {(product.regions || []).join(";")}</span>
                      <span>{product.imageStatus} / {product.priceStatus === "price_pending" ? "Price Pending" : product.priceStatus === "quote_required" ? "Quote Required" : product.priceStatus === "allowance_only" ? "Allowance Only" : product.priceStatus}</span>
                      <button type="button" onClick={() => toggleBuilderProduct(product)}><Check size={16} /> {enabled ? "Disable" : "Enable"}</button>
                    </div>
                  );
                }) : (
                  <div className="empty-state compact">
                    <strong>Master Catalogue is ready for real researched supplier data.</strong>
                    <span>No commercial supplier products have been seeded.</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>

        {applianceMode ? (
          <section className="appliance-catalogue" data-testid="product-library-appliance-catalogue">
            <div className="section-heading">
              <span>Appliances</span>
              <strong>{applianceBrandName ? `${applianceBrandName} Catalogue` : "Browse Appliance Brands"}</strong>
            </div>
            <div className="appliance-admin-bar">
              <span>{applianceCatalogueStats.platformMaster} products</span>
              <span>{applianceCatalogueStats.active} active records</span>
              <span>{applianceCatalogueStats.clientSelectable} client-selectable</span>
              <span>{applianceCatalogueStats.legacyCompatible} legacy quotation-compatible</span>
              <span>{applianceCatalogueStats.requiringVerification} requiring verification</span>
              <button type="button" onClick={() => setApplianceImportInfoOpen((current) => !current)}><Upload size={16} /> Import Product Catalogue CSV</button>
            </div>
            {applianceImportInfoOpen ? (
              <div className="import-preview" data-testid="appliance-import-placeholder">
                <div className="panel-title">
                  <FileUp size={18} />
                  <strong>Import Product Catalogue CSV</strong>
                </div>
                <p>Checkpoint 4 will preview and validate appliance CSV imports into the canonical Product Library schema. This checkpoint only exposes the placeholder action.</p>
              </div>
            ) : null}

            <div className="master-filters appliance-filters">
              <input value={applianceFilters.search} onChange={(event) => setApplianceFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search model, name, family, brand, width, fuel, install, finish" />
              <select value={applianceFilters.productType || applianceFamilyKey} onChange={(event) => {
                const nextType = event.target.value;
                setApplianceFilters((current) => ({ ...current, productType: nextType }));
                if (nextType) openApplianceCatalogue({ applianceBrand: applianceBrandName, applianceFamily: nextType });
              }}>
                <option value="">All product types</option>
                {applianceFamilies.map((family) => <option key={family.familyId} value={family.familyId}>{family.name}</option>)}
              </select>
              <select value={applianceFilters.width} onChange={(event) => setApplianceFilters((current) => ({ ...current, width: event.target.value }))}>
                <option value="">All widths</option>
                {applianceFilterOptions.widths.map((width) => <option key={width} value={width}>{width}</option>)}
              </select>
              <select value={applianceFilters.fuel} onChange={(event) => setApplianceFilters((current) => ({ ...current, fuel: event.target.value }))}>
                <option value="">All fuel/config</option>
                {applianceFilterOptions.fuels.map((fuel) => <option key={fuel} value={fuel}>{fuel}</option>)}
              </select>
              <select value={applianceFilters.install} onChange={(event) => setApplianceFilters((current) => ({ ...current, install: event.target.value }))}>
                <option value="">All install types</option>
                {applianceFilterOptions.installs.map((install) => <option key={install} value={install}>{install}</option>)}
              </select>
              <select value={applianceFilters.finish} onChange={(event) => setApplianceFilters((current) => ({ ...current, finish: event.target.value }))}>
                <option value="">All finishes</option>
                {applianceFilterOptions.finishes.map((finish) => <option key={finish} value={finish}>{finish}</option>)}
              </select>
              <select value={applianceFilters.status} onChange={(event) => setApplianceFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="">Eligibility Status</option>
                {APPLIANCE_ELIGIBILITY_STATES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <select value={applianceFilters.verification} onChange={(event) => setApplianceFilters((current) => ({ ...current, verification: event.target.value }))}>
                <option value="">Verification</option>
                {applianceFilterOptions.verifications.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <select value={applianceFilters.selectable} onChange={(event) => setApplianceFilters((current) => ({ ...current, selectable: event.target.value }))}>
                <option value="">Selectable</option>
                <option value="client-selectable">Client-selectable</option>
                <option value="not-client-selectable">Not client-selectable</option>
              </select>
              <select value={applianceFilters.sourcePlatform} onChange={(event) => setApplianceFilters((current) => ({ ...current, sourcePlatform: event.target.value }))}>
                <option value="">Source</option>
                <option value="platform-master">Platform master</option>
                <option value="tenant">Tenant-specific</option>
              </select>
              <input value={applianceFilters.tenantId} onChange={(event) => setApplianceFilters((current) => ({ ...current, tenantId: event.target.value }))} placeholder="Tenant ID" />
              <select value={applianceFilters.sort} onChange={(event) => setApplianceFilters((current) => ({ ...current, sort: event.target.value }))}>
                <option value="name">Sort by name</option>
                <option value="price-asc">Price low to high</option>
                <option value="price-desc">Price high to low</option>
              </select>
              <button type="button" onClick={clearApplianceFilters}>Clear all</button>
            </div>

            <div className="catalogue-breadcrumb">
              <button type="button" onClick={() => openApplianceCatalogue()}>Appliances</button>
              {applianceBrandName ? <button type="button" onClick={() => openApplianceCatalogue({ applianceBrand: applianceBrandName })}>{applianceBrandName}</button> : null}
              {applianceFamily ? <button type="button" onClick={() => openApplianceCatalogue({ applianceFamily: applianceFamily.familyId, applianceBrand: applianceBrandName })}>{applianceFamily.name}</button> : null}
              {selectedApplianceProduct ? <span>{selectedApplianceProduct.model || selectedApplianceProduct.name}</span> : null}
            </div>

            {!applianceBrandName ? (
              <div className="tile-grid supplier-grid" data-testid="appliance-brand-list">
                {applianceBrandCards.map((brand) => {
                  const brandProducts = getPlatformMasterApplianceRecords().filter((record) => (record.brand || record.brandName) === brand.brandName);
                  const brandPacks = getApplianceRecordsByFamily("appliance-packs").filter((record) => (record.brand || record.brandName) === brand.brandName);
                  const selectableCount = brandProducts.filter((record) => record.selectableStatus === "client-selectable").length + brandPacks.filter((record) => record.selectableStatus === "client-selectable").length;
                  return (
                    <article key={brand.brandId || brand.brandName} className="visual-tile management-tile appliance-brand-tile" data-appliance-brand={brand.brandName}>
                      <ApplianceBrandLogo brand={brand} />
                      <span className="tile-body">
                        <strong>{brand.brandName}</strong>
                        <small>{brandProducts.length} individual product{brandProducts.length === 1 ? "" : "s"}</small>
                        <em>{brandPacks.length} safe package{brandPacks.length === 1 ? "" : "s"} / {selectableCount} selectable</em>
                        {brand.homepageUrl ? <a href={brand.homepageUrl} target="_blank" rel="noreferrer">Official brand source</a> : null}
                        <span className="tile-actions">
                          <button type="button" onClick={() => openApplianceCatalogue({ applianceBrand: brand.brandName })}>Browse Brand</button>
                        </span>
                      </span>
                    </article>
                  );
                })}
                {!applianceBrands.length ? (
                  <div className="empty-state compact">
                    <strong>No appliance brands are available.</strong>
                    <span>Import appliance brands into the Product Library catalogue.</span>
                  </div>
                ) : null}
              </div>
            ) : applianceBrandName && !applianceProductId ? (
              <div className="appliance-brand-page" data-testid="appliance-model-list">
                <section className="appliance-type-picker" data-testid="appliance-product-type-picker">
                  <div className="section-heading compact-heading">
                    <span>{applianceBrandName}</span>
                    <strong>Choose Package or Individual Products</strong>
                  </div>
                  <div className="appliance-type-grid">
                    {[...applianceFamilies].map((family) => {
                      const count = family.familyId === "appliance-packs"
                        ? getApplianceRecordsByFamily("appliance-packs").filter((record) => (record.brand || record.brandName) === applianceBrandName).length
                        : getPlatformMasterApplianceRecords().filter((record) => (record.brand || record.brandName) === applianceBrandName && record.familyId === family.familyId).length;
                      return (
                        <button
                          key={family.familyId}
                          type="button"
                          className={applianceFamilyKey === family.familyId ? "selected" : ""}
                          onClick={() => openApplianceCatalogue({ applianceBrand: applianceBrandName, applianceFamily: family.familyId })}
                        >
                          <strong>{family.name}</strong>
                          <span>{count} {family.familyId === "appliance-packs" ? "package" : "model"}{count === 1 ? "" : "s"}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
                {(!applianceFamilyKey || applianceFamilyKey === "appliance-packs") ? (
                <section className="appliance-category-section" data-appliance-category="appliance-packs">
                  <div className="section-heading compact-heading">
                    <span>Complete Appliance Packages</span>
                    <strong>{appliancePacksForBrand.length} package{appliancePacksForBrand.length === 1 ? "" : "s"}</strong>
                  </div>
                  <div className="product-grid appliance-model-grid">
                    {appliancePacksForBrand.map((record) => (
                      <article key={record.productId} className="product-option management-card appliance-pack-card appliance-visual-card" data-testid="appliance-package-card" data-appliance-product={record.productId}>
                        <div className="appliance-card-logo">{selectedApplianceBrand ? <ApplianceBrandLogo brand={selectedApplianceBrand} /> : <strong>{record.brand}</strong>}</div>
                        <div className="appliance-card-copy">
                          <span>Appliance Package</span>
                          <strong>{record.name}</strong>
                          <small>{record.brand} package / {record.components.length} component products</small>
                          <small>{appliancePriceLabel(record)}</small>
                        </div>
                        <span className={applianceStatusClass(record.eligibility)}>{record.eligibility}</span>
                        <div className="component-mini-list visual-components">
                          {record.components.slice(0, 5).map((component, componentIndex) => (
                            <button key={`${record.productId}:${component.productId}:${component.relationshipId || componentIndex}`} type="button" onClick={() => openApplianceCatalogue({ applianceFamily: component.familyId, applianceBrand: applianceBrandName, applianceProduct: component.productId })}>
                              <ApplianceImage record={component} />
                              <span>{component.familyName}</span>
                              <strong>{component.model || component.name}</strong>
                            </button>
                          ))}
                        </div>
                        <div className="card-actions appliance-card-actions">
                          <button type="button" onClick={() => openApplianceCatalogue({ applianceFamily: "appliance-packs", applianceBrand: applianceBrandName, applianceProduct: record.productId })}>View Package Details</button>
                          <button type="button" onClick={() => selectApplianceRecord(record)}><Check size={15} /> Select Package</button>
                        </div>
                      </article>
                    ))}
                    {!appliancePacksForBrand.length ? <div className="empty-state compact"><strong>No complete packages for this brand.</strong><span>Packages can be imported into Product Library later.</span></div> : null}
                  </div>
                </section>
                ) : null}
                {visibleApplianceFamilies.map((family) => {
                  const familyRecords = applianceModels.filter((record) => record.familyId === family.familyId);
                  const groups = Array.from(groupAppliancesForBrand(familyRecords).values()).sort((left, right) => `${left.size} ${left.configuration}`.localeCompare(`${right.size} ${right.configuration}`));
                  return (
                    <section key={family.familyId} className="appliance-category-section" data-appliance-category={family.familyId}>
                      <div className="section-heading compact-heading">
                        <span>{family.name}</span>
                        <strong>{familyRecords.length} product{familyRecords.length === 1 ? "" : "s"}</strong>
                      </div>
                      {familyRecords.length ? groups.map((group) => (
                        <div key={`${group.family}-${group.size}-${group.configuration}`} className="appliance-size-group" data-appliance-size-group={`${group.size} ${group.configuration}`}>
                          <h3>{group.size} / {group.configuration}</h3>
                          <div className="product-grid appliance-model-grid">
                            {group.records.map((record) => (
                              <ApplianceCard
                                key={record.productId}
                                record={record}
                                brand={selectedApplianceBrand}
                                onOpen={(nextRecord) => openApplianceCatalogue({ applianceFamily: nextRecord.familyId, applianceBrand: applianceBrandName, applianceProduct: nextRecord.productId })}
                                onSelect={selectApplianceRecord}
                              />
                            ))}
                          </div>
                        </div>
                      )) : (
                        <div className="empty-state compact">
                          <strong>No {family.name.toLowerCase()} models in the canonical Product Library data for {applianceBrandName}.</strong>
                          <span>The section is available for future CSV/XLSX imports without code changes.</span>
                        </div>
                      )}
                    </section>
                  );
                })}
                {!applianceModels.length && !appliancePacksForBrand.length ? (
                  <div className="empty-state compact">
                    <strong>No appliance records match the current filters.</strong>
                    <span>Clear filters or choose another brand.</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <section className="family-layout appliance-detail-layout">
                <div className="family-main">
                  {selectedApplianceProduct ? (
                    <>
                      <div className="family-hero">
                        <ApplianceImage record={selectedApplianceProduct} large />
                        <div className="appliance-detail-summary">
                          {getApplianceBrandByName(selectedApplianceProduct.brand) ? <ApplianceBrandLogo brand={getApplianceBrandByName(selectedApplianceProduct.brand)} /> : null}
                          <h2>{selectedApplianceProduct.name}</h2>
                          <p>{[selectedApplianceProduct.brand, selectedApplianceProduct.model, selectedApplianceProduct.familyName].filter(Boolean).join(" / ")}</p>
                          <strong className="appliance-detail-price">{appliancePriceLabel(selectedApplianceProduct)}</strong>
                          <dl className="appliance-detail-quick-specs">
                            <dt>Product Code</dt>
                            <dd>{selectedApplianceProduct.model || selectedApplianceProduct.productCode}</dd>
                            <dt>Finish</dt>
                            <dd>{applianceValue(selectedApplianceProduct.finish)}</dd>
                            <dt>Size</dt>
                            <dd>{applianceValue(applianceDimensionLabel(selectedApplianceProduct), "Partial size data")}</dd>
                            <dt>Configuration</dt>
                            <dd>{[selectedApplianceProduct.fuelOrEnergyType, selectedApplianceProduct.installationType, applianceConfigurationBucket(selectedApplianceProduct)].filter(Boolean).join(" / ")}</dd>
                          </dl>
                          {applianceFeatureList(selectedApplianceProduct).length ? (
                            <ul className="appliance-feature-list">
                              {applianceFeatureList(selectedApplianceProduct).map((feature) => <li key={feature}>{feature}</li>)}
                            </ul>
                          ) : null}
                          <div className="chips">
                            <span className={applianceStatusClass(selectedApplianceProduct.eligibility)}>{selectedApplianceProduct.eligibility}</span>
                            <span>{selectedApplianceProduct.verificationStatus}</span>
                            <span>{selectedApplianceProduct.selectableStatus}</span>
                          </div>
                          <div className="card-actions appliance-detail-actions">
                            <button type="button" onClick={() => selectApplianceRecord(selectedApplianceProduct)}><Check size={16} /> Select {selectedApplianceProduct.recordType === "appliance-pack" ? "Package" : "Product"}</button>
                            <button type="button" className="secondary" onClick={() => openApplianceCatalogue({ applianceFamily: selectedApplianceProduct.familyId, applianceBrand: selectedApplianceProduct.brand })}><ArrowLeft size={16} /> Back to Product Grid</button>
                            <button type="button" className="secondary" onClick={() => setSuccess(`${selectedApplianceProduct.name} is ready for comparison from the canonical Product Library record.`)}><Copy size={16} /> Compare</button>
                          </div>
                        </div>
                      </div>
                      <p className="appliance-description">{selectedApplianceProduct.description}</p>
                      {selectedApplianceProduct.recordType === "appliance-pack" ? (
                        <div className="component-list" data-testid="appliance-pack-components">
                          <strong>Component Products</strong>
                          <div className="product-grid appliance-model-grid">
                          {selectedApplianceProduct.components.map((component, componentIndex) => (
                            <button key={`${selectedApplianceProduct.productId}:${component.productId}:${component.relationshipId || componentIndex}`} type="button" className="component-row visual-component-card" onClick={() => openApplianceCatalogue({ applianceFamily: component.familyId, applianceBrand: applianceBrandName, applianceProduct: component.productId })}>
                              <ApplianceImage record={component} />
                              <span>
                                <strong>{component.name}</strong>
                                <small>{[component.brand, component.model, component.familyName, component.eligibility].filter(Boolean).join(" / ")}</small>
                              </span>
                            </button>
                          ))}
                          </div>
                          {selectedApplianceProduct.componentWarnings.length ? (
                            <small className="warning-text">{selectedApplianceProduct.componentWarnings.join("; ")}</small>
                          ) : null}
                        </div>
                      ) : null}
                      {selectedApplianceProduct.recordType !== "appliance-pack" && selectedApplianceProductContainers.length ? (
                        <div className="component-list" data-testid="appliance-product-packages">
                          <strong>Packages Containing This Product</strong>
                          {selectedApplianceProductContainers.map((pack) => (
                            <div key={pack.productId} className="component-row">
                              <ApplianceImage record={pack} />
                              <span>
                                <strong>{pack.name}</strong>
                                <small>{[pack.brand, appliancePriceLabel(pack), `${pack.components.length} components`].filter(Boolean).join(" / ")}</small>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="empty-state compact">
                      <strong>Appliance product not found.</strong>
                      <button type="button" onClick={() => openApplianceCatalogue({ applianceBrand: applianceBrandName })}>Back to Models</button>
                    </div>
                  )}
                </div>
                <aside className="detail-panel">
                  {selectedApplianceProduct ? (
                    <div className="selected-product">
                      <dl>
                        <dt>Stable Product ID</dt>
                        <dd>{selectedApplianceProduct.stableProductId}</dd>
                        <dt>Category / Family</dt>
                        <dd>{selectedApplianceProduct.categoryId || "category:appliances"} / {selectedApplianceProduct.familyId}</dd>
                        <dt>Supplier / Brand / Range</dt>
                        <dd>{[selectedApplianceProduct.supplier, selectedApplianceProduct.brand, selectedApplianceProduct.range].filter(Boolean).join(" / ") || "Not supplied"}</dd>
                        <dt>Product / Model</dt>
                        <dd>{[selectedApplianceProduct.name, selectedApplianceProduct.model].filter(Boolean).join(" / ")}</dd>
                        <dt>Specifications</dt>
                        <dd>{[
                          selectedApplianceProduct.width || (selectedApplianceProduct.widthMm ? `${selectedApplianceProduct.widthMm} mm wide` : ""),
                          selectedApplianceProduct.height || (selectedApplianceProduct.heightMm ? `${selectedApplianceProduct.heightMm} mm high` : ""),
                          selectedApplianceProduct.depth || (selectedApplianceProduct.depthMm ? `${selectedApplianceProduct.depthMm} mm deep` : ""),
                          selectedApplianceProduct.finish,
                          selectedApplianceProduct.fuelOrEnergyType,
                          selectedApplianceProduct.installationType,
                        ].filter(Boolean).join(" / ") || "Partial specifications only"}</dd>
                        <dt>Price / Status</dt>
                        <dd>{appliancePriceLabel(selectedApplianceProduct)} / {selectedApplianceProduct.priceStatus}</dd>
                        <dt>Product Page</dt>
                        <dd>{selectedApplianceProduct.productPageUrl ? <a href={selectedApplianceProduct.productPageUrl} target="_blank" rel="noreferrer">{selectedApplianceProduct.productPageUrl}</a> : "Not supplied"}</dd>
                        <dt>Documents</dt>
                        <dd>{selectedApplianceProduct.documentUrls?.length ? selectedApplianceProduct.documentUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer">{url}</a>) : "Not supplied"}</dd>
                        <dt>Image Attribution</dt>
                        <dd>{applianceValue(selectedApplianceProduct.imageAttribution || selectedApplianceProduct.imageFallbackLabel)}</dd>
                        <dt>Source Checked</dt>
                        <dd>{applianceValue(selectedApplianceProduct.sourceCheckedAt)}</dd>
                        <dt>Catalogue Version</dt>
                        <dd>{selectedApplianceProduct.schemaVersion || "product-library.appliance-catalogue.v1"}</dd>
                        <dt>Image Status</dt>
                        <dd>{selectedApplianceProduct.image ? "exact image referenced" : "exact image required - category fallback shown"}</dd>
                        <dt>Applicable Rooms</dt>
                        <dd>{applianceValue(selectedApplianceProduct.applicableRooms)}</dd>
                        <dt>Selectable Status</dt>
                        <dd>{selectedApplianceProduct.selectableStatus}</dd>
                        <dt>Admin Non-selectable Reasons</dt>
                        <dd>{applianceValue(selectedApplianceProduct.eligibilityReasons)}</dd>
                      </dl>
                    </div>
                  ) : null}
                </aside>
              </section>
            )}
          </section>
        ) : null}

        {!applianceMode && !selectedCatalogueSection ? (
          <div className="browse-switch" data-testid="product-library-browse-mode">
            <button type="button" className={browseMode === "room" ? "selected" : ""} onClick={() => pushProductLibraryRoute({})}>Browse by Room</button>
            <button type="button" className={browseMode === "all" ? "selected" : ""} onClick={openBrowseAllProducts}>Browse All Products</button>
          </div>
        ) : null}

        {!selectedArea && !applianceMode && !selectedCatalogueSection && browseMode === "room" && !selectedRoom ? (
          <section className="purpose room-landing" data-testid="product-library-room-landing">
            <div className="section-heading">
              <span>Browse by Room</span>
              <strong>Choose a room or area</strong>
            </div>
            <div className="tile-grid room-grid">
              {PRODUCT_LIBRARY_ROOMS.map((roomItem) => {
                const roomCategories = getProductLibraryRoomCategories(roomItem.key);
                const count = countProductsForRoom(roomItem);
                return (
                  <button key={roomItem.key} type="button" className="visual-tile room-tile" onClick={() => openRoom(roomItem.key)} data-room-key={roomItem.key}>
                    <span className="tile-image" style={{ backgroundImage: `url(${roomItem.heroImage})` }}>
                      <strong>{roomItem.name}</strong>
                    </span>
                    <span className="tile-body">
                      <small>{roomCategories.length} product categor{roomCategories.length === 1 ? "y" : "ies"}</small>
                      <em>{count} active product{count === 1 ? "" : "s"}</em>
                      <span className="tile-actions"><span className="button-look">Browse Products</span></span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {!selectedArea && !applianceMode && !selectedCatalogueSection && browseMode === "room" && selectedRoom && !selectedRoomCategory ? (
          <section className="purpose room-page" data-testid="product-library-room-page" data-room-key={selectedRoom.key}>
            <div className="room-hero" style={{ backgroundImage: `url(${selectedRoom.heroImage})` }}>
              <div>
                <span>Product Library</span>
                <h2>{selectedRoom.name}</h2>
                <p>{selectedRoom.description}</p>
              </div>
            </div>
            <div className="catalogue-breadcrumb">
              <button type="button" onClick={() => pushProductLibraryRoute({})}>Rooms</button>
              <span>{selectedRoom.name}</span>
            </div>
            {selectedRoom.key === "exterior" ? <small>Entrance hardware photo: <a href="https://pxhere.com/en/photo/653551" target="_blank" rel="noreferrer">PxHere</a>, <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer">CC0</a>.</small> : null}
            <div className="master-filters">
              <input value={masterFilters.search} onChange={(event) => setMasterFilters((current) => ({ ...current, search: event.target.value }))} placeholder={`Search ${selectedRoom.name} categories`} />
              <select value={masterFilters.brand} onChange={(event) => setMasterFilters((current) => ({ ...current, brand: event.target.value }))}>
                <option value="">Brand</option>
                {masterBrands.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select value={masterFilters.imageStatus} onChange={(event) => setMasterFilters((current) => ({ ...current, imageStatus: event.target.value }))}>
                <option value="">Missing image</option>
                <option value="missing">Missing</option>
                <option value="review_required">Review required</option>
              </select>
            </div>
            <div className="tile-grid category-grid">
              {selectedRoomCategories.map((categoryItem) => {
                const count = countProductsForRoomCategory(categoryItem, selectedRoom);
                const search = String(masterFilters.search || "").toLowerCase();
                if (search && !`${categoryItem.name} ${categoryItem.group}`.toLowerCase().includes(search)) return null;
                return (
                  <button key={categoryItem.key} type="button" className="visual-tile category-tile" onClick={() => openRoomCategory(categoryItem.key)} data-room-category={categoryItem.key}>
                    {['internal-doors','door-furniture','skirting-architraves'].includes(categoryItem.key) ? <VerifiedProductImage className="tile-image contain-image" src={categoryItem.representativeImage} name={categoryItem.name} style={{width:'100%'}}/> : categoryItem.key === "bricks" ? (
                      <img className="tile-image bricks-category-image" src={categoryItem.representativeImage} alt="Light clay brick exterior wall sample" width="1200" height="784" />
                    ) : (
                      <span className="tile-image contain-image" style={{ backgroundImage: `url(${categoryItem.representativeImage})` }} />
                    )}
                    <span className="tile-body">
                      <strong>{categoryItem.name}</strong>
                      <small>{count} active product{count === 1 ? "" : "s"}</small>
                      <em>{categoryItem.filterDefinitions.map((filter) => filter.label).slice(0, 4).join(" / ")}</em>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {!selectedArea && !applianceMode && !selectedCatalogueSection && browseMode === "room" && selectedRoom && selectedRoomCategory && !selectedRoomProduct ? (
          <section className="purpose category-page" data-testid="product-library-category-page" data-room-category={selectedRoomCategory.key}>
            <div className="catalogue-breadcrumb">
              <button type="button" onClick={() => pushProductLibraryRoute({})}>Rooms</button>
              <button type="button" onClick={() => openRoom(selectedRoom.key)}>{selectedRoom.name}</button>
              <span>{selectedRoomCategory.name}</span>
            </div>
            <div className="section-heading">
              <span>{selectedRoom.name}</span>
              <strong>{selectedRoomCategory.name}</strong>
            </div>
            {selectedRoomCategory.key === "cabinet-doors-panels" ? (
              <div className="cabinetry-catalogue-browser" data-testid="product-library-cabinet-doors-panels-browser">
                {!cabinetrySelectedBrand ? (
                  <>
                    <div className="category-toolbar">
                      <span>{cabinetDoorPanelProducts.length} colour/finish records</span>
                      <strong>{cabinetryBrandGroups.length} cabinetry brands</strong>
                      <button type="button" onClick={() => openManageCatalogueItems({ room: selectedRoom?.key || "", category: selectedRoomCategory?.key || "", section: "cabinetry-joinery" })}><Boxes size={16} /> Manage Catalogue Items</button>
                    </div>
                    <div className="tile-grid cabinetry-brand-grid" data-testid="cabinetry-brand-page">
                      {cabinetryBrandGroups.map((brandGroup) => (
                        <button key={brandGroup.name} type="button" className="visual-tile cabinetry-brand-card" onClick={() => openCabinetryBrand(brandGroup.name)} data-cabinetry-brand={brandGroup.name}>
                          <span className="tile-image contain-image brand-logo-card" style={{ backgroundImage: brandGroup.logo ? `url(${brandGroup.logo})` : "" }} />
                          <span className="tile-body">
                            <strong>{brandGroup.name}</strong>
                            <small>{brandGroup.products.length} colour/finish record{brandGroup.products.length === 1 ? "" : "s"}</small>
                            <em>{brandGroup.ranges.length} product range{brandGroup.ranges.length === 1 ? "" : "s"}</em>
                            <span className="button-look">View Ranges</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
                {cabinetrySelectedBrand && !cabinetrySelectedRange ? (
                  <>
                    <div className="catalogue-breadcrumb">
                      <button type="button" onClick={() => openRoomCategory(selectedRoomCategory.key)}>{selectedRoomCategory.name}</button>
                      <span>{cabinetrySelectedBrand.name}</span>
                    </div>
                    <div className="category-toolbar">
                      <span>{cabinetrySelectedBrand.products.length} colour/finish records</span>
                      <strong>{cabinetrySelectedBrand.ranges.length} ranges</strong>
                      <button type="button" onClick={() => openManageCatalogueItems({ room: selectedRoom?.key || "", category: selectedRoomCategory?.key || "", section: "cabinetry-joinery", brand: cabinetrySelectedBrand.name })}><Boxes size={16} /> Manage Catalogue Items</button>
                    </div>
                    <div className="tile-grid cabinetry-range-grid" data-testid="cabinetry-range-page" data-cabinetry-brand={cabinetrySelectedBrand.name}>
                      {cabinetrySelectedBrand.ranges.map((rangeGroup) => (
                        <button key={rangeGroup.name} type="button" className="visual-tile cabinetry-range-card" onClick={() => openCabinetryRange(rangeGroup.name)} data-cabinetry-range={rangeGroup.name}>
                          <span className="tile-image contain-image swatch-range-card" style={{ backgroundImage: `url(${rangeGroup.image || cabinetrySelectedBrand.logo})` }} />
                          <span className="tile-body">
                            <strong>{rangeGroup.name}</strong>
                            <small>{rangeGroup.products.length} colour/finish record{rangeGroup.products.length === 1 ? "" : "s"}</small>
                            <em>{uniqueValues(rangeGroup.products.map((product) => product.finish)).slice(0, 4).join(" / ")}</em>
                            <span className="button-look">View Colours</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
                {cabinetrySelectedBrand && cabinetrySelectedRange ? (
                  <>
                    <div className="catalogue-breadcrumb">
                      <button type="button" onClick={() => openRoomCategory(selectedRoomCategory.key)}>{selectedRoomCategory.name}</button>
                      <button type="button" onClick={() => openCabinetryBrand(cabinetrySelectedBrand.name)}>{cabinetrySelectedBrand.name}</button>
                      <span>{cabinetrySelectedRange.name}</span>
                    </div>
                    <div className="category-toolbar">
                      <span>{cabinetrySelectedRange.products.length} colour/finish records</span>
                      <strong>{cabinetrySelectedRange.name}</strong>
                      <button type="button" onClick={() => openManageCatalogueItems({ room: selectedRoom?.key || "", category: selectedRoomCategory?.key || "", section: "cabinetry-joinery", brand: cabinetrySelectedBrand.name, range: cabinetrySelectedRange.name })}><Boxes size={16} /> Manage Catalogue Items</button>
                    </div>
                    <div className="product-grid room-product-grid cabinetry-colour-grid" data-testid="cabinetry-colour-grid" data-cabinetry-brand={cabinetrySelectedBrand.name} data-cabinetry-range={cabinetrySelectedRange.name}>
                      {cabinetryVisibleColourProducts.map((product) => (
                        <article key={product.productId} className="product-option management-card room-product-card cabinetry-colour-card" data-room-product={product.productId} data-cabinetry-colour-id={product.productCode}>
                          <div className="product-card-logo">{cabinetrySelectedBrand.logo ? <img src={cabinetrySelectedBrand.logo} alt={`${cabinetrySelectedBrand.name} logo`} /> : <strong>{cabinetrySelectedBrand.name}</strong>}</div>
                          <button type="button" className="product-pick contain-product swatch-product" onClick={() => openRoomProduct(product.productId)}>
                            <ProductLibraryProductImage product={product} familyItem={familyByKey(product.familyKey)} />
                            <strong>{product.colour || product.productName}</strong>
                          </button>
                          <small>{product.model || product.sku || product.productCode}</small>
                          <small>{[product.finish, product.material, product.attributes?.sheetDoorApplicability].filter(Boolean).join(" / ")}</small>
                          <span>{productPriceLabel(product)}</span>
                          <div className="card-actions">
                            <button type="button" onClick={() => openRoomProduct(product.productId)}>Colour Details</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : (
              <>
                {exteriorSections.length ? <>
                  <div className="cabinetry-subcategory-tabs" data-testid="exterior-section-tabs">
                    {exteriorSections.map(([key, label]) => <button type="button" key={key} className={exteriorSectionKey === key ? "selected" : ""} onClick={() => pushProductLibraryRoute({ room: selectedRoom.key, roomCategory: selectedRoomCategory.key, exteriorSection: key })}>{label}</button>)}
                  </div>
                  <div className="admin-actions catalogue-selection-actions">
                    <button type="button" onClick={() => setSelectedCatalogueItemIds((current) => [...new Set([...current, ...roomCategoryProducts.map(catalogueProductSelectionKey)])])}>Select All Visible</button>
                    <button type="button" onClick={() => setSelectedCatalogueItemIds([])}>Clear Selection</button>
                    <button type="button" disabled={saving || !allRoomCategoryProducts.length} onClick={() => downloadProducts(allRoomCategoryProducts, { label: selectedRoomCategory.key, fileName: `${selectedRoomCategory.key}.csv` })}>Download All {selectedRoomCategory.key === 'roofing' ? 'Roofing' : selectedRoomCategory.key === 'skirting-architraves' ? 'Skirting & Architraves' : 'Entry Doors'} CSV</button>
                    <button type="button" disabled={saving || !roomCategoryProducts.length} onClick={() => downloadProducts(roomCategoryProducts, { label: exteriorSectionKey, fileName: `${selectedRoomCategory.key}-${exteriorSectionKey}.csv` })}>Download Current Section CSV</button>
                    <button type="button" disabled={saving || !allRoomCategoryProducts.some((product) => selectedCatalogueItemSet.has(catalogueProductSelectionKey(product)))} onClick={() => downloadProducts(allRoomCategoryProducts.filter((product) => selectedCatalogueItemSet.has(catalogueProductSelectionKey(product))), { label: `${selectedRoomCategory.key}-selected` })}>Download Selected CSV</button>
                    <button type="button" disabled={saving || !allRoomCategoryProducts.some((product) => selectedCatalogueItemSet.has(catalogueProductSelectionKey(product)))} onClick={() => downloadProducts(allRoomCategoryProducts.filter((product) => selectedCatalogueItemSet.has(catalogueProductSelectionKey(product))), { includeImages: true, label: `${selectedRoomCategory.key}-selected` })}>Download Selected + Images ZIP</button>
                  </div>
                </> : null}
                <div className="category-toolbar">
                  <span>{roomCategoryProducts.length} product{roomCategoryProducts.length === 1 ? "" : "s"}</span>
                  {!furniturePicker.enabled ? <button type="button" onClick={() => openManageCatalogueItems({ room: selectedRoom?.key || "", category: selectedRoomCategory?.key || "" })}><Boxes size={16} /> Manage Catalogue Items</button> : null}
                  <label>Sort By <select value={masterFilters.sort || "name"} onChange={(event) => setMasterFilters((current) => ({ ...current, sort: event.target.value }))}><option value="name">Name</option><option value="brand">Brand</option><option value="price">Price</option></select></label>
                </div>
                <div className="master-filters product-filter-bar" data-testid="product-category-filters">
                  <input value={masterFilters.search} onChange={(event) => setMasterFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search products, models, brands or codes" />
                  <select value={masterFilters.brand} onChange={(event) => setMasterFilters((current) => ({ ...current, brand: event.target.value }))}>
                    <option value="">Brand</option>
                    {masterBrands.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  <select value={masterFilters.range} onChange={(event) => setMasterFilters((current) => ({ ...current, range: event.target.value }))}>
                    <option value="">Product range</option>
                    {masterRanges.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  <select value={masterFilters.status} onChange={(event) => setMasterFilters((current) => ({ ...current, status: event.target.value }))}>
                    <option value="">Active/inactive</option>
                    <option value="active">Active</option>
                    <option value="discontinued">Inactive</option>
                  </select>
                  <select value={masterFilters.imageStatus} onChange={(event) => setMasterFilters((current) => ({ ...current, imageStatus: event.target.value }))}>
                    <option value="">Missing image</option>
                    <option value="missing">Missing</option>
                    <option value="review_required">Review required</option>
                    <option value="verified_exact">Verified</option>
                  </select>
                </div>
                <div className="product-grid room-product-grid">
                  {roomCategoryProducts.slice(0,paginatedInternalCategory?roomVisibleCount:roomCategoryProducts.length).map((product) => {
                    const brand = getApplianceBrandByName(product.brand || product.manufacturer || "");
                    return (
                      <article key={product.productId} className="product-option management-card room-product-card" style={furniturePicker.enabled && furniturePicker.isSelected(product) ? {border:"3px solid #1764d9",background:"#eef6ff"} : undefined} data-room-product={product.productId}>
                        {exteriorSections.length ? <label><input type="checkbox" aria-label={`Select ${product.productName} for export`} checked={selectedCatalogueItemSet.has(catalogueProductSelectionKey(product))} onChange={() => toggleCatalogueItemSelection(product)} /> Select for export</label> : null}
                        <div className="product-card-logo">{brand ? <ApplianceBrandLogo brand={brand} /> : <strong>{product.brand || product.manufacturer || "Brand pending"}</strong>}</div>
                        <button type="button" className="product-pick contain-product" onClick={() => openRoomProduct(product.productId)}>
                          <ProductLibraryProductImage product={product} familyItem={familyByKey(product.familyKey)} />
                          <strong>{product.productName}</strong>
                        </button>
                        <small>{product.model || product.sku || product.productCode}</small>
                        <small>{[product.size, product.configuration, product.finish].filter(Boolean).join(" / ") || product.familyKey}</small>
                        <span>{furniturePicker.enabled && product.clientPrice == null ? "Rate required" : productPriceLabel(product)}</span>
                        <div className="card-actions">
                          {furniturePicker.enabled && product.active !== false ? <button type="button" data-testid="select-door-furniture" onClick={() => furniturePicker.open(product)} style={{background:'#1764d9',color:'white',fontWeight:700}}>{furniturePicker.isSelected(product) ? 'Selected (Change Selection)' : 'Select'}</button> : null}
                          <button type="button" onClick={() => openRoomProduct(product.productId)}>View Details</button>
                          <button type="button" className="secondary" onClick={furniturePicker.enabled ? () => furniturePicker.compare(product) : undefined}>Compare</button>
                        </div>
                      </article>
                    );
                  })}
                  {paginatedInternalCategory&&roomVisibleCount<roomCategoryProducts.length?<button type="button" onClick={()=>setRoomVisibleCount(n=>n+48)}>Show more products ({roomCategoryProducts.length-roomVisibleCount} remaining)</button>:null}
                  {!roomCategoryProducts.length ? (
                    <div className="empty-state compact">
                      <strong>No products match this room/category yet.</strong>
                      <span>The category is available for Product Library import mapping without creating duplicate room records.</span>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </section>
        ) : null}

        {!selectedArea && !applianceMode && !selectedCatalogueSection && browseMode === "room" && selectedRoomProduct ? (
          <section className="family-layout room-product-detail" data-testid="product-library-product-detail" data-room-product={selectedRoomProduct.productId}>
            <div className="family-main">
              <div className="catalogue-breadcrumb">
                <button type="button" onClick={() => pushProductLibraryRoute({})}>Rooms</button>
                <button type="button" onClick={() => openRoom(selectedRoom.key)}>{selectedRoom.name}</button>
                <button type="button" onClick={() => openRoomCategory(selectedRoomCategory.key)}>{selectedRoomCategory.name}</button>
                <span>{selectedRoomProduct.model || selectedRoomProduct.productCode}</span>
              </div>
              <div className="product-detail-split">
                <div className="product-detail-media">
                  <ProductLibraryProductImage product={selectedRoomProduct} familyItem={familyByKey(selectedRoomProduct.familyKey)} large />
                </div>
                <div className="product-detail-info">
                  {getApplianceBrandByName(selectedRoomProduct.brand || selectedRoomProduct.manufacturer || "") ? <ApplianceBrandLogo brand={getApplianceBrandByName(selectedRoomProduct.brand || selectedRoomProduct.manufacturer || "")} /> : <strong>{selectedRoomProduct.brand || selectedRoomProduct.manufacturer || "Brand pending"}</strong>}
                  <h2>{selectedRoomProduct.productName}</h2>
                  <p className="price-line">{productPriceLabel(selectedRoomProduct)}</p>
                  <dl>
                    <dt>Model / Product Code</dt>
                    <dd>{selectedRoomProduct.model || selectedRoomProduct.sku || selectedRoomProduct.productCode}</dd>
                    <dt>Colour / Finish</dt>
                    <dd>{[selectedRoomProduct.colour, selectedRoomProduct.finish].filter(Boolean).join(" / ") || "Not supplied"}</dd>
                    <dt>Dimensions</dt>
                    <dd>{[selectedRoomProduct.width, selectedRoomProduct.height, selectedRoomProduct.depth, selectedRoomProduct.dimensions].filter((value) => value && typeof value !== "object").join(" x ") || selectedRoomProduct.size || "Not supplied"}</dd>
                    <dt>Key Specifications</dt>
                    <dd>{[selectedRoomProduct.familyKey, selectedRoomProduct.configuration, selectedRoomProduct.material, selectedRoomProduct.profile].filter(Boolean).join(" / ") || "Specifications pending"}</dd>
                    <dt>Availability</dt>
                    <dd>{selectedRoomProduct.active === false || selectedRoomProduct.archived ? "Inactive" : "Active"}</dd>
                    <dt>Specification Sheet</dt>
                    <dd>{selectedRoomProduct.specificationUrl ? <a href={selectedRoomProduct.specificationUrl} target="_blank" rel="noreferrer">Download Specification Sheet</a> : "Not supplied"}</dd>
                  </dl>
                  <div className="detail-actions">
                    <button type="button"><Check size={16} /> Select/Add to Job</button>
                    <button type="button" className="secondary">Compare</button>
                    <button type="button" className="secondary" onClick={() => editProduct(selectedRoomProduct)}><Pencil size={16} /> Edit Product</button>
                    <button type="button" className="secondary"><ImagePlus size={16} /> Replace Image</button>
                    <button type="button" className="secondary">Assign Rooms</button>
                    <button type="button" className="secondary">Assign Categories</button>
                  </div>
                </div>
              </div>
            </div>
            <aside className="detail-panel">
              <div className="selected-product">
                <h3>Canonical Record</h3>
                <dl>
                  <dt>Stable Product ID</dt>
                  <dd>{selectedRoomProduct.productId}</dd>
                  <dt>Rooms</dt>
                  <dd>{PRODUCT_LIBRARY_ROOMS.filter((roomItem) => productBelongsToRoom(selectedRoomProduct, roomItem.key)).map((roomItem) => roomItem.name).join(", ") || "Not assigned"}</dd>
                  <dt>Categories</dt>
                  <dd>{PRODUCT_LIBRARY_ROOM_CATEGORIES.filter((categoryItem) => productBelongsToRoomCategory(selectedRoomProduct, categoryItem)).map((categoryItem) => categoryItem.name).slice(0, 8).join(", ") || "Not assigned"}</dd>
                  <dt>Source</dt>
                  <dd>{selectedRoomProduct.sourceName || selectedRoomProduct.sourceUrl || "Product Library"}</dd>
                  <dt>Image Status</dt>
                  <dd>{selectedRoomProduct.imageStatus || "missing"}</dd>
                </dl>
              </div>
            </aside>
          </section>
        ) : null}

        {!selectedArea && !applianceMode && !selectedCatalogueSection && browseMode === "all" ? (
          <section className="purpose">
            <div className="section-heading">
              <span>Browse All Products</span>
              <strong>Administrative catalogue sections</strong>
            </div>
            <div className="tile-grid area-grid catalogue-section-grid" data-testid="product-library-browse-all-grid">
              {PRODUCT_LIBRARY_CATALOGUE_SECTIONS.map((sectionItem) => {
                const count = countProductsForSection(sectionItem);
                const reviewCount = reviewCountForSection(sectionItem);
                const familyCount = sectionItem.key === "appliances" ? applianceFamilies.length : getProductLibrarySectionFamilies(sectionItem.key).length;
                const browse = sectionItem.key === "appliances" ? openApplianceCatalogue : () => openCatalogueSection(sectionItem.key);
                return (
                  <button key={sectionItem.key} type="button" className="visual-tile catalogue-section-tile" onClick={browse} data-catalogue-section={sectionItem.key}>
                    <span className="tile-image" style={{ backgroundImage: `url(${sectionItem.image})` }} />
                    <span className="tile-body">
                      <strong>{sectionItem.displayName}</strong>
                      <small>{count} product{count === 1 ? "" : "s"}</small>
                      <em>{familyCount} product families / {reviewCount} needing image or review</em>
                      <span className="tile-actions">
                        <span className="button-look">Browse</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {selectedCatalogueSection && !applianceMode ? (
          <section className="purpose" data-testid={selectedCatalogueSection.key === CABINETRY_SECTION_KEY ? "product-library-cabinetry-catalogue" : "product-library-catalogue-section"} data-catalogue-section={selectedCatalogueSection.key}>
            <div className="section-heading">
              <span>Product Catalogue</span>
              <strong>{selectedCatalogueSection.displayName}</strong>
              <button type="button" onClick={() => openManageCatalogueItems({ section: selectedCatalogueSection.key })}><Boxes size={16} /> Manage Catalogue Items</button>
            </div>
            <div className="section-summary-card">
              <span className="tile-image" style={{ backgroundImage: `url(${selectedCatalogueSection.image})` }} />
              <div>
                <p>{selectedCatalogueSection.description}</p>
                <div className="chips">
                  <span>{catalogueGroupProducts.length} total records</span>
                  <span>{selectedCatalogueSubcategories.length ? selectedCatalogueSubcategories.length - 1 : catalogueSectionFamilies.length} section{(selectedCatalogueSubcategories.length ? selectedCatalogueSubcategories.length - 1 : catalogueSectionFamilies.length) === 1 ? "" : "s"}</span>
                  <span>{catalogueGroupVisibleProducts.length} currently visible</span>
                  <span>{reviewCountForSection(selectedCatalogueSection)} needing image or review</span>
                </div>
              </div>
            </div>
            {selectedCatalogueSubcategories.length ? (
              <div className="cabinetry-subcategory-tabs" data-testid={`${selectedCatalogueSection.key}-subcategory-tabs`}>
                {selectedCatalogueSubcategories.map((subcategory) => (
                  <button
                    key={subcategory.key}
                    type="button"
                    className={selectedCatalogueSubcategory?.key === subcategory.key ? "selected" : ""}
                    onClick={() => setCatalogueSubcategory(subcategory.key)}
                    data-catalogue-subcategory={subcategory.key}
                  >
                    {subcategory.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="admin-actions catalogue-selection-actions cabinetry-export-actions">
              <button type="button" onClick={selectAllVisibleCatalogueGroupItems} disabled={!catalogueGroupVisibleProducts.length}><Check size={16} /> Select All Visible</button>
              <button type="button" className="secondary" onClick={clearCatalogueItemSelection} disabled={!selectedCatalogueGroupProducts.length}><X size={16} /> Clear Selection</button>
              <button type="button" onClick={() => downloadProducts(catalogueGroupProducts, { includeImages: false, label: `${selectedCatalogueSection.key}-complete`, fileName: catalogueSectionExportFileName(selectedCatalogueSection) })} disabled={!catalogueGroupProducts.length || saving}><FileDown size={16} /> {selectedCatalogueSection.key === "roofing" ? "Download All Roofing CSV" : "Download Complete Group CSV"}</button>
              <button type="button" onClick={() => downloadProducts(catalogueGroupVisibleProducts, { includeImages: false, label: selectedCatalogueSubcategory?.key || selectedCatalogueSection.key, fileName: selectedCatalogueSubcategory?.fileName || catalogueSectionExportFileName(selectedCatalogueSection) })} disabled={!catalogueGroupVisibleProducts.length || saving}><FileDown size={16} /> Download Current Section CSV</button>
              <button type="button" onClick={() => downloadProducts(selectedCatalogueGroupProducts, { includeImages: false, label: `${selectedCatalogueSection.key}-selected`, fileName: `${slugify(selectedCatalogueSection.displayName)}-selected.csv` })} disabled={!selectedCatalogueGroupProducts.length || saving}><FileDown size={16} /> Download Selected CSV</button>
              <button type="button" onClick={() => downloadProducts(selectedCatalogueGroupProducts, { includeImages: true, label: `${selectedCatalogueSection.key}-selected`, fileName: `${slugify(selectedCatalogueSection.displayName)}-selected.zip` })} disabled={!selectedCatalogueGroupProducts.length || saving}><Archive size={16} /> Download Selected + Images ZIP</button>
              <span>{selectedCatalogueGroupProducts.length} selected from {catalogueGroupVisibleProducts.length} visible</span>
            </div>
            <div className="catalogue-items-table cabinetry-items-table" role="table" aria-label={`${selectedCatalogueSection.displayName} catalogue items`}>
              <div className="catalogue-items-head" role="row">
                <span role="columnheader">Select</span>
                <span role="columnheader">Thumbnail</span>
                <span role="columnheader">Product name</span>
                <span role="columnheader">Brand</span>
                <span role="columnheader">Range</span>
                <span role="columnheader">Model / SKU</span>
                <span role="columnheader">Product Library category</span>
                <span role="columnheader">Quotation Builder section</span>
                <span role="columnheader">Price</span>
                <span role="columnheader">Unit</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Client Selections</span>
                <span role="columnheader">Quotation Builder</span>
              </div>
              {catalogueGroupVisibleProducts.length ? catalogueGroupVisibleProducts.map((product) => {
                const key = catalogueProductSelectionKey(product);
                const checked = selectedCatalogueItemSet.has(key);
                const familyItem = familyByKey(product.familyKey);
                return (
                  <div key={key} className="catalogue-items-row" role="row" data-catalogue-product-id={key} data-catalogue-subcategory={catalogueSubcategoryForProduct(product, selectedCatalogueSection.key)} data-cabinetry-product-id={selectedCatalogueSection.key === CABINETRY_SECTION_KEY ? key : undefined} data-cabinetry-subcategory={selectedCatalogueSection.key === CABINETRY_SECTION_KEY ? cabinetrySubcategoryForProduct(product) : undefined}>
                    <label className="table-check">
                      <input type="checkbox" checked={checked} onChange={() => toggleCatalogueItemSelection(product)} />
                      <span className="sr-only">Select {product.productName}</span>
                    </label>
                    <span className="catalogue-thumb"><ProductLibraryProductImage product={product} familyItem={familyItem} /></span>
                    <strong>{product.productName || "Unnamed product"}</strong>
                    <span>{product.brand || product.manufacturer || product.supplier || "No brand"}</span>
                    <span>{product.range || product.collection || "No range"}</span>
                    <span>{[product.model, product.sku, product.productCode].filter(Boolean).join(" / ") || "No model"}</span>
                    <span>{selectedCatalogueSubcategories.find((item) => item.key === catalogueSubcategoryForProduct(product, selectedCatalogueSection.key))?.label || productCategoryLabel(product)}</span>
                    <span>{quotationSectionLabel(product)}</span>
                    <span>{productPriceLabel(product)}</span>
                    <span>{productUnitLabel(product)}</span>
                    <span>{product.active === false || product.archived ? "Inactive" : product.enabled === false ? "Disabled" : product.discontinued ? "Discontinued" : "Active"}</span>
                    <span>{productEnabledLabel(product, "clientSelectable")}</span>
                    <span>{productEnabledLabel(product, "quotationEnabled")}</span>
                  </div>
                );
              }) : (
                <div className="empty-state compact">
                  <strong>No records match this section.</strong>
                  <span>Choose a different section or import Product Library records before exporting.</span>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {selectedArea && !selectedCategory && !applianceMode ? (
          <section className="purpose">
            <div className="section-heading">
              <span>{selectedArea.displayName}</span>
              <strong>Choose one category</strong>
            </div>
            <div className="tile-grid category-grid">
              {visibleCategories.map((categoryItem) => {
                const count = countProductsForCategory(categoryItem);
                const selected = categoryItem.key === "exterior-garage-doors" ? garageDoorSelection : null;
                return (
                  <button key={categoryItem.key} type="button" className="visual-tile" onClick={() => openCategory(categoryItem.key)} data-category-key={categoryItem.key}>
                    <span className="tile-image" style={{ backgroundImage: `url(${selected?.primaryImage || categoryItem.image})` }} />
                    <span className="tile-body">
                      <strong>{categoryItem.category}</strong>
                      <small>{count} product{count === 1 ? "" : "s"}</small>
                      <em>{selected ? `Selected: ${selected.productName}` : statusForCount(count)}</em>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {selectedArea && selectedCategory && !selectedFamily && !applianceMode ? (
          <section className="purpose">
            <div className="section-heading">
              <span>{selectedArea.displayName}</span>
              <strong>{selectedCategory.category}</strong>
            </div>
            {visibleFamilies.length ? (
              <div className="tile-grid family-grid">
                {visibleFamilies.map((familyItem) => {
                  const count = countProductsForFamily(familyItem);
                  return (
                    <button key={familyItem.familyKey} type="button" className="visual-tile" onClick={() => openFamily(familyItem.familyKey)} data-family-key={familyItem.familyKey}>
                    <span className="tile-image" style={{ backgroundImage: `url(${familyItem.image || selectedCategory.image})` }} />
                    <span className="tile-body">
                      <strong>{familyItem.displayName}</strong>
                      <small>{count} product{count === 1 ? "" : "s"}</small>
                      <em>{selectionKeyForFamily(familyItem) === GARAGE_DOOR_SELECTION_KEY && garageDoorSelection ? `Selected: ${garageDoorSelection.productName}` : statusForCount(count)}</em>
                    </span>
                  </button>
                );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <strong>No products have been added for this category yet.</strong>
                <div>
                  <button type="button" onClick={() => setAdminOpen(true)}><Plus size={16} /> Add Product</button>
                  <label className="file-button">
                    <Upload size={16} />
                    Import Products
                    <input type="file" accept=".csv,text/csv" onChange={handleProductCsvPreview} />
                  </label>
                  <button type="button" onClick={() => setSelectedCategoryKey("")}>Back</button>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {selectedFamily && !applianceMode ? (
          <section className="family-layout">
            <div className="family-main">
              <div className="section-heading">
                <span>{selectedCategory?.category || selectedArea?.displayName || selectedFamily.topLevelArea}</span>
                <strong>{selectedFamily.displayName}</strong>
              </div>
              <div className="family-hero">
                <img src={resolveProductLibraryImage({ family: selectedFamily, familyKey: selectedFamily.familyKey, areaKey: selectedFamily.topLevelArea })} alt={`${selectedFamily.displayName} category`} />
                <div>
                  <h2>{selectedFamily.displayName}</h2>
                  <p>{selectedFamily.category} / {selectedFamily.subcategory}</p>
                  <div className="chips">
                    <span>{familyMasterProducts.length} master products</span>
                    <span>{supplierHierarchy.length} suppliers</span>
                    <span>{builderEnablements.filter((item) => item.organisationId === workspaceId && item.enabled && familyMasterProducts.some((product) => product.productCode === item.masterProductCode)).length} enabled</span>
                    <span className={familyIsLocked(selectedFamily.familyKey) ? "status-pill on" : "status-pill off"}>{familyCatalogueStatus(selectedFamily.familyKey).toUpperCase()}</span>
                  </div>
                  {selectedFamily.familyKey === "roofing" ? (
                    <div className="chips" data-testid="product-library-roofing-hierarchy-proof">
                      <span>Metal Roofing {roofingGroupProof.metal}</span>
                      <span>Roof Tiles {roofingGroupProof.tiles}</span>
                      <span>Fascia {roofingGroupProof.fascia}</span>
                      <span>Gutters {roofingGroupProof.gutters}</span>
                      <span>Downpipes {roofingGroupProof.downpipes}</span>
                    </div>
                  ) : null}
                  {familyIsLocked(selectedFamily.familyKey) ? (
                    <small className="lock-note">Locked - protected from bulk catalogue changes</small>
                  ) : null}
                </div>
              </div>

              <div className="catalogue-breadcrumb">
                <button type="button" onClick={() => { setSelectedSupplierName(""); setSelectedRangeName(""); }}>Suppliers</button>
                {selectedSupplierName ? <button type="button" onClick={() => setSelectedRangeName("")}>{selectedSupplierName}</button> : null}
                {selectedRangeName ? <span>{selectedRangeName}</span> : null}
              </div>

              {!selectedSupplierName ? (
                <div className="tile-grid supplier-grid" data-testid="product-library-suppliers">
                  {supplierHierarchy.map((supplier) => (
                    <article key={supplier.name} className="visual-tile management-tile">
                      <span className="tile-image" style={{ backgroundImage: `url(${supplier.image})` }} />
                      <span className="tile-body">
                        <strong>{supplier.name}</strong>
                        <small>{supplier.ranges.length} range{supplier.ranges.length === 1 ? "" : "s"} / {supplier.products.length} product{supplier.products.length === 1 ? "" : "s"}</small>
                        <em>{supplier.enabled} enabled for this builder</em>
                        <span className="tile-actions">
                          <button type="button" onClick={() => { setSelectedSupplierName(supplier.name); setSelectedRangeName(""); setSelectedProductCode(""); }}>View Ranges</button>
                          <button type="button" onClick={() => setBuilderProductsEnabled(supplier.products, supplier.enabled !== supplier.products.length)}>{supplier.enabled === supplier.products.length ? "Disable Supplier" : "Enable Supplier"}</button>
                        </span>
                      </span>
                    </article>
                  ))}
                </div>
              ) : selectedSupplierName && !selectedRangeName ? (
                <div className="tile-grid range-grid" data-testid="product-library-ranges">
                  {(selectedSupplierGroup?.ranges || []).map((range) => (
                    <article key={range.name} className="visual-tile management-tile">
                      <span className="tile-image" style={{ backgroundImage: `url(${range.image || selectedFamily.image})` }} />
                      <span className="tile-body">
                        <strong>{range.name}</strong>
                        <small>{range.products.length} product{range.products.length === 1 ? "" : "s"}</small>
                        <em>{range.enabled} enabled for this builder</em>
                        <span className="tile-actions">
                          <button type="button" onClick={() => { setSelectedRangeName(range.name); setSelectedProductCode(""); }}>View Products</button>
                          <button type="button" onClick={() => setBuilderProductsEnabled(range.products, range.enabled !== range.products.length)}>{range.enabled === range.products.length ? "Disable Range" : "Enable Range"}</button>
                          <button type="button" onClick={() => { setProductForm((current) => ({ ...current, supplier_name: selectedSupplierName, range: range.name })); setAdminOpen(true); }}>Add Product</button>
                        </span>
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="product-grid" data-testid="product-library-products">
                  {visibleProducts.map((product) => {
                    const enabled = Boolean(builderEnablementForProduct(product, builderEnablements, workspaceId || "")?.enabled);
                    return (
                      <article
                        key={product.productId}
                        className={selectedProduct?.productId === product.productId ? "product-option selected management-card" : "product-option management-card"}
                      >
                        <button type="button" className="product-pick" onClick={() => setSelectedProductCode(product.productCode || product.productId)}>
                          <ProductLibraryProductImage product={product} familyItem={selectedFamily} />
                          <strong>{product.productName}</strong>
                        </button>
                        <small>Manufacturer: {product.manufacturer || "Not set"}</small>
                        <small>Supplier: {product.supplier || "Not set"}</small>
                        <small>Range: {product.range || "Not set"}</small>
                        <small>Colour/variant: {[product.colour, product.finish, product.size].filter(Boolean).join(" / ") || "Not set"}</small>
                        <span>{productPriceLabel(product)}</span>
                        <span className={product.active !== false && !product.archived ? "status-pill on" : "status-pill off"}>{product.active !== false && !product.archived ? "Active" : "Archived"}</span>
                        <span className={enabled ? "status-pill on" : "status-pill off"}>{enabled ? "Enabled for builder" : "Disabled for builder"}</span>
                        <div className="card-actions">
                          <button type="button" onClick={() => editProduct(product)}><Pencil size={15} /> Edit</button>
                          <button type="button" onClick={() => toggleBuilderProduct(product)}><Check size={15} /> {enabled ? "Disable" : "Enable"}</button>
                          <button type="button" onClick={() => archiveProduct(product)}><Archive size={15} /> Archive</button>
                          {product.officialProductUrl ? <a href={product.officialProductUrl} target="_blank" rel="noreferrer">Official Page</a> : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {!familyMasterProducts.length ? (
                <div className="empty-state">
                  <strong>No products have been added to this master family yet.</strong>
                  <div>
                    <button type="button" onClick={() => setAdminOpen(true)}><Plus size={16} /> Add Product</button>
                    <label className="file-button">
                      <Upload size={16} />
                      Import Products
                      <input type="file" accept=".csv,text/csv" onChange={handleProductCsvPreview} />
                    </label>
                    <button type="button" onClick={() => setSelectedFamilyKey("")}>Back</button>
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="detail-panel">
              {selectedProduct ? (
                <div className="selected-product">
                  <ProductLibraryProductImage product={selectedProduct} familyItem={selectedFamily} large />
                  <div className="gallery" data-gallery-count={(selectedProduct.galleryImages || []).length}>
                    {((selectedProduct.galleryImageUrls || selectedProduct.galleryImages)?.length ? (selectedProduct.galleryImageUrls || selectedProduct.galleryImages) : (productVerifiedImage(selectedProduct) ? [productVerifiedImage(selectedProduct)] : [])).map((image, index) => (
                      <img key={`${image}-${index}`} src={image} alt={`${selectedProduct.productName} gallery ${index + 1}`} />
                    ))}
                  </div>
                  <h3>{selectedProduct.productName}</h3>
                  <p>{selectedProduct.description}</p>
                  <div className="swatches">
                    {(selectedProduct.colourSwatches?.length ? selectedProduct.colourSwatches : [selectedProduct.colour, selectedProduct.finish].filter(Boolean)).map((swatch) => (
                      <span key={swatchLabel(swatch)} style={swatchStyle(swatch)}>{swatchLabel(swatch)}</span>
                    ))}
                  </div>
                  {selectedProduct.variants?.length ? (
                    <div className="variant-list">
                      <strong>Sizes</strong>
                      {selectedProduct.variants.map((variant, index) => (
                        <button key={`${variant.variantName || "variant"}-${index}`} type="button" className={selectedVariantIndex === index ? "variant selected" : "variant"} onClick={() => setSelectedVariantIndex(index)}>
                          {variant.variantName || `Variant ${index + 1}`} {variant.size ? `- ${variant.size}` : ""}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <dl>
                    <dt>Supplier</dt>
                    <dd>{selectedProduct.supplier || "Not set"}</dd>
                    <dt>Brand / Range / Model</dt>
                    <dd>{[selectedProduct.brand, selectedProduct.range, selectedProduct.model].filter(Boolean).join(" / ") || "Not set"}</dd>
                    <dt>Specifications</dt>
                    <dd>{[selectedProduct.size, selectedProduct.width, selectedProduct.height, selectedProduct.depth].filter(Boolean).join(" / ") || "Not set"}</dd>
                    <dt>Colours</dt>
                    <dd>{[selectedProduct.colour, selectedProduct.finish].filter(Boolean).join(" / ") || "Not set"}</dd>
                    <dt>Official Product URL</dt>
                    <dd>{selectedProduct.officialProductUrl ? <a href={selectedProduct.officialProductUrl} target="_blank" rel="noreferrer">{selectedProduct.officialProductUrl}</a> : "Not supplied"}</dd>
                    <dt>Specification URL</dt>
                    <dd>{selectedProduct.specificationUrl ? <a href={selectedProduct.specificationUrl} target="_blank" rel="noreferrer">{selectedProduct.specificationUrl}</a> : "Not supplied"}</dd>
                    <dt>Price</dt>
                    <dd>{productPriceLabel(selectedProduct)}</dd>
                    <dt>Price Status</dt>
                    <dd>{selectedProduct.priceStatus || "price_pending"}</dd>
                    <dt>Image Status</dt>
                    <dd>{selectedProduct.imageStatus || "missing"}</dd>
                    <dt>Master Status</dt>
                    <dd>{selectedProduct.archived ? "Archived" : selectedProduct.discontinued ? "Discontinued" : selectedProduct.active === false ? "Disabled" : "Active"}</dd>
                    <dt>Builder Enablement</dt>
                    <dd>{builderEnablementForProduct(selectedProduct, builderEnablements, workspaceId || "")?.enabled ? "Enabled for this builder" : "Disabled for this builder"}</dd>
                  </dl>
                  <div className="detail-actions">
                    <button type="button" onClick={() => editProduct(selectedProduct)}><Pencil size={16} /> Edit Product</button>
                    <button type="button" className="secondary" onClick={() => toggleBuilderProduct(selectedProduct)}><Check size={16} /> {builderEnablementForProduct(selectedProduct, builderEnablements, workspaceId || "")?.enabled ? "Disable" : "Enable"} Builder</button>
                    <button type="button" className="secondary" onClick={() => archiveProduct(selectedProduct)}><Archive size={16} /> Archive</button>
                  </div>
                </div>
              ) : (
                <div className="empty-state compact">
                  <strong>No products have been added for this category yet.</strong>
                  <button type="button" onClick={() => setAdminOpen(true)}><Plus size={16} /> Add Product</button>
                </div>
              )}
            </aside>
          </section>
        ) : null}

        <section className={adminOpen ? "admin-panel open" : "admin-panel"}>
          <button type="button" className="admin-toggle" onClick={() => setAdminOpen((current) => !current)}>
            <Boxes size={18} />
            Product Library Admin
          </button>
          {adminOpen ? (
            <div className="admin-body">
              <div className="admin-actions">
                <button type="button" onClick={() => startNewProduct()}><Plus size={16} /> Add Product</button>
                <button type="button" onClick={addSupplier}>Add Supplier</button>
                <button type="button" onClick={() => setSuccess("Add Brand: enter brand in the import CSV or save a product with a new brand.")}>Add Brand</button>
                <button type="button" onClick={addRange}>Add Range</button>
                <button type="button" onClick={() => setSuccess("Add Variant: enter colour, finish, size or variant_name in the import CSV.")}>Add Variant</button>
                <button type="button" onClick={() => selectedProduct && editProduct(selectedProduct)} disabled={!selectedProduct}><Pencil size={16} /> Edit</button>
                <button type="button" onClick={() => selectedProduct && duplicateProduct(selectedProduct)} disabled={!selectedProduct}><Copy size={16} /> Duplicate</button>
                <button type="button" onClick={() => selectedProduct && archiveProduct(selectedProduct)} disabled={!selectedProduct || saving}><Archive size={16} /> Archive</button>
                <label className="file-button">
                  <Upload size={16} />
                  Import CSV
                  <input type="file" accept=".csv,text/csv" onChange={handleProductCsvPreview} />
                </label>
                <button type="button" onClick={exportTemplateCsv}><FileUp size={16} /> Export Template</button>
              </div>

              {selectedFamily ? (
                <form className="product-form" onSubmit={saveManualProduct}>
                  <div className="panel-title">
                    <Edit3 size={18} />
                    <strong>{editingProductId ? "Edit" : "Add"} Product to {selectedFamily.displayName}</strong>
                  </div>
                  <div className="form-grid">
                    <input value={productForm.product_code} onChange={(event) => setProductForm((current) => ({ ...current, product_code: event.target.value }))} placeholder="product_code" required />
                    <input value={productForm.product_name} onChange={(event) => setProductForm((current) => ({ ...current, product_name: event.target.value }))} placeholder="product_name" required />
                    <input value={productForm.supplier_name} onChange={(event) => setProductForm((current) => ({ ...current, supplier_name: event.target.value }))} placeholder="supplier_name" />
                    <input value={productForm.brand} onChange={(event) => setProductForm((current) => ({ ...current, brand: event.target.value }))} placeholder="brand" />
                    <input value={productForm.range} onChange={(event) => setProductForm((current) => ({ ...current, range: event.target.value }))} placeholder="range" />
                    <input value={productForm.model} onChange={(event) => setProductForm((current) => ({ ...current, model: event.target.value }))} placeholder="model" />
                    <input value={productForm.description} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} placeholder="description" />
                    <input value={productForm.colour} onChange={(event) => setProductForm((current) => ({ ...current, colour: event.target.value }))} placeholder="colour" />
                    <input value={productForm.finish} onChange={(event) => setProductForm((current) => ({ ...current, finish: event.target.value }))} placeholder="finish" />
                    <input value={productForm.size} onChange={(event) => setProductForm((current) => ({ ...current, size: event.target.value }))} placeholder="size" />
                    <input value={productForm.texture} onChange={(event) => setProductForm((current) => ({ ...current, texture: event.target.value }))} placeholder="texture" />
                    <input value={productForm.width} onChange={(event) => setProductForm((current) => ({ ...current, width: event.target.value }))} placeholder="width" />
                    <input value={productForm.height} onChange={(event) => setProductForm((current) => ({ ...current, height: event.target.value }))} placeholder="height" />
                    <input value={productForm.depth} onChange={(event) => setProductForm((current) => ({ ...current, depth: event.target.value }))} placeholder="depth" />
                    <input value={productForm.variant_name} onChange={(event) => setProductForm((current) => ({ ...current, variant_name: event.target.value }))} placeholder="variant_name" />
                    <input value={productForm.primary_image} onChange={(event) => setProductForm((current) => ({ ...current, primary_image: event.target.value }))} placeholder="primary_image" />
                    <input value={productForm.gallery_images} onChange={(event) => setProductForm((current) => ({ ...current, gallery_images: event.target.value }))} placeholder="gallery_images" />
                    <input value={productForm.image_source_url} onChange={(event) => setProductForm((current) => ({ ...current, image_source_url: event.target.value }))} placeholder="image_source_url" />
                    <select value={productForm.image_status} onChange={(event) => setProductForm((current) => ({ ...current, image_status: event.target.value }))}>
                      {MASTER_IMAGE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <input value={productForm.image_verified_at} onChange={(event) => setProductForm((current) => ({ ...current, image_verified_at: event.target.value }))} placeholder="image_verified_at" />
                    <input value={productForm.official_product_url} onChange={(event) => setProductForm((current) => ({ ...current, official_product_url: event.target.value }))} placeholder="official_product_url" />
                    <input value={productForm.specification_url} onChange={(event) => setProductForm((current) => ({ ...current, specification_url: event.target.value }))} placeholder="specification_url" />
                    <input value={productForm.supplier_url} onChange={(event) => setProductForm((current) => ({ ...current, supplier_url: event.target.value }))} placeholder="supplier_url" />
                    <input value={productForm.rrp} onChange={(event) => setProductForm((current) => ({ ...current, rrp: event.target.value }))} placeholder="rrp" />
                    <input value={productForm.builder_cost} onChange={(event) => setProductForm((current) => ({ ...current, builder_cost: event.target.value }))} placeholder="builder client price override" />
                    <input value={productForm.client_price} onChange={(event) => setProductForm((current) => ({ ...current, client_price: event.target.value }))} placeholder="client_price" />
                    <input value={productForm.currency} onChange={(event) => setProductForm((current) => ({ ...current, currency: event.target.value }))} placeholder="currency" />
                    <input value={productForm.gst_treatment} onChange={(event) => setProductForm((current) => ({ ...current, gst_treatment: event.target.value }))} placeholder="gst_treatment" />
                    <input value={productForm.price_unit} onChange={(event) => setProductForm((current) => ({ ...current, price_unit: event.target.value }))} placeholder="price_unit" />
                    <select value={productForm.price_status} onChange={(event) => setProductForm((current) => ({ ...current, price_status: event.target.value }))}>
                      {MASTER_PRICE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <input value={productForm.price_source_url} onChange={(event) => setProductForm((current) => ({ ...current, price_source_url: event.target.value }))} placeholder="price_source_url" />
                    <input value={productForm.price_verified_at} onChange={(event) => setProductForm((current) => ({ ...current, price_verified_at: event.target.value }))} placeholder="price_verified_at" />
                    <input value={productForm.region} onChange={(event) => setProductForm((current) => ({ ...current, region: event.target.value }))} placeholder="region" />
                    <input value={productForm.price_effective_date} onChange={(event) => setProductForm((current) => ({ ...current, price_effective_date: event.target.value }))} placeholder="price_effective_date" />
                    <label className="check-field">
                      <input type="checkbox" checked={Boolean(productForm.active)} onChange={(event) => setProductForm((current) => ({ ...current, active: event.target.checked }))} />
                      Active
                    </label>
                    <label className="check-field">
                      <input type="checkbox" checked={Boolean(productForm.discontinued)} onChange={(event) => setProductForm((current) => ({ ...current, discontinued: event.target.checked }))} />
                      Discontinued
                    </label>
                    <label className="check-field">
                      <input type="checkbox" checked={Boolean(productForm.archived)} onChange={(event) => setProductForm((current) => ({ ...current, archived: event.target.checked }))} />
                      Archived
                    </label>
                  </div>
                  <button type="submit" disabled={saving || !workspaceId}><ImagePlus size={16} /> Save Product</button>
                  {editingProductId ? <button type="button" className="secondary" onClick={() => { setProductForm(EMPTY_PRODUCT); setEditingProductId(""); }}>Cancel Edit</button> : null}
                </form>
              ) : (
                <p className="admin-note">Choose a product family before adding a product manually. Imports can still be previewed from any page.</p>
              )}

              {importPreview ? (
                <div className="import-preview">
                  <div className="panel-title">
                    <FileUp size={18} />
                    <strong>Import Preview: {importPreview.fileName}</strong>
                  </div>
                  <p>
                    {importPreview.preview.length} rows previewed.{" "}
                    {importPreview.preview.filter((row) => row.action === "create").length} create,{" "}
                    {importPreview.preview.filter((row) => row.action === "update").length} update,{" "}
                    {importPreview.preview.filter((row) => row.action === "skip-unchanged").length} unchanged,{" "}
                    {importPreview.preview.filter((row) => row.errors.length).length} row-level error(s).
                  </p>
                  <div className="preview-list">
                    {importPreview.preview.slice(0, 12).map((row) => (
                      <div key={row.rowNumber} className={row.errors.length ? "preview-row error" : "preview-row"}>
                        {row.imagePreview ? <img src={row.imagePreview} alt={`${row.record.product_name || "Product"} preview`} /> : <span className="preview-image-empty">No image</span>}
                        <strong>Row {row.rowNumber}</strong>
                        <span>
                          {row.record.product_name || "Unnamed product"}
                          <small>{row.familyMapping ? row.familyMapping.displayName : "No family"} / {row.quoteItemMapping || "No quote item"}</small>
                        </span>
                        <small>{row.errors.length ? row.errors.join("; ") : row.action}</small>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={importPreviewRows} disabled={saving || !workspaceId}><Upload size={16} /> Create / Update Valid Rows</button>
                </div>
              ) : null}

              <div className="entity-model">
                <strong>Shared Product Entity</strong>
                {Object.entries(PRODUCT_ENTITY_FIELDS).map(([section, fields]) => (
                  <p key={section}><span>{section}</span> {fields.join(", ")}</p>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </main>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f5f7fb;
          color: #172033;
          padding: 20px;
        }
        .standard-banner {
          display: grid;
          grid-template-columns: auto 48px minmax(0, 1fr) minmax(280px, auto);
          gap: 14px;
          align-items: center;
          border: 1px solid #d7deea;
          background: #ffffff;
          border-radius: 8px;
          padding: 14px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        }
        .back-button,
        .file-controls button,
        .file-button,
        button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          color: #172033;
          cursor: pointer;
          font-weight: 800;
          padding: 9px 12px;
          text-align: left;
        }
        button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .back-button,
        .file-controls button,
        .file-button {
          min-height: 38px;
        }
        .banner-icon {
          display: grid;
          width: 48px;
          height: 48px;
          place-items: center;
          border-radius: 8px;
          background: #1f6feb;
          color: #ffffff;
        }
        .banner-copy h1 {
          margin: 0;
          font-size: 48px;
          line-height: 1;
          letter-spacing: 0;
        }
        .banner-copy p {
          margin: 6px 0 0;
          color: #58657a;
          font-size: 18px;
        }
        .banner-meta {
          display: grid;
          gap: 8px;
          justify-items: end;
          color: #64748b;
          font-size: 13px;
        }
        .file-controls {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }
        .file-button {
          position: relative;
          overflow: hidden;
        }
        .file-button input {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
        }
        .alert {
          margin: 14px 0 0;
          border-radius: 8px;
          padding: 12px 14px;
          font-weight: 800;
        }
        .alert.error {
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #991b1b;
        }
        .alert.success {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }
        .purpose,
        .family-layout,
        .admin-panel {
          margin-top: 16px;
        }
        .browse-switch {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 16px;
        }
        .browse-switch button.selected {
          border-color: #1f6feb;
          background: #1f6feb;
          color: #ffffff;
        }
        .section-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 12px;
        }
        .section-heading span {
          color: #64748b;
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .section-heading strong {
          font-size: 24px;
        }
        .tile-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
        }
        .catalogue-section-grid {
          grid-template-columns: repeat(6, minmax(0, 1fr));
          align-items: stretch;
        }
        .visual-tile {
          display: grid;
          align-content: stretch;
          min-height: 250px;
          overflow: hidden;
          border-color: #d7deea;
          background: #ffffff;
          padding: 0;
        }
        .management-tile {
          text-align: left;
        }
        .visual-tile:hover,
        .product-option:hover {
          border-color: #1f6feb;
          box-shadow: 0 14px 34px rgba(31, 111, 235, 0.16);
        }
        .tile-image {
          display: block;
          min-height: 150px;
          background-position: center;
          background-size: cover;
        }
        .bricks-category-image {
          width: 100%;
          height: 150px;
          object-fit: cover;
          object-position: center;
        }
        .room-tile .tile-image {
          position: relative;
          display: grid;
          min-height: 190px;
          align-items: end;
          padding: 18px;
          isolation: isolate;
        }
        .room-tile .tile-image::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.62));
          z-index: -1;
        }
        .room-tile .tile-image strong {
          color: #ffffff;
          font-size: 28px;
          line-height: 1;
        }
        .contain-image {
          background-color: #f8fafc;
          background-size: contain;
          background-repeat: no-repeat;
        }
        .tile-body {
          display: grid;
          grid-template-rows: minmax(44px, auto) 22px minmax(46px, 1fr) auto;
          gap: 6px;
          padding: 14px;
        }
        .tile-body strong {
          font-size: 18px;
        }
        .tile-body small,
        .tile-body em {
          color: #64748b;
          font-style: normal;
          line-height: 1.35;
        }
        .tile-actions,
        .card-actions,
        .detail-actions,
        .catalogue-breadcrumb {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .tile-actions {
          align-self: end;
        }
        .catalogue-section-tile {
          height: 318px;
          min-height: 318px;
        }
        .catalogue-section-tile .tile-image {
          min-height: 126px;
          height: 126px;
          background-color: #f8fafc;
        }
        .catalogue-section-tile .tile-body strong {
          line-height: 1.15;
        }
        .button-look {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #0f172a;
          color: #ffffff;
          padding: 7px 11px;
          font-weight: 900;
        }
        .section-summary-card {
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          gap: 16px;
          align-items: stretch;
          border: 1px solid #d7deea;
          background: #ffffff;
          border-radius: 8px;
          padding: 14px;
          margin-bottom: 14px;
        }
        .section-summary-card .tile-image {
          min-height: 140px;
          border-radius: 8px;
          background-color: #e2e8f0;
        }
        .section-summary-card p {
          margin: 0 0 12px;
          color: #475569;
          line-height: 1.45;
        }
        .room-hero {
          display: grid;
          min-height: 300px;
          align-items: end;
          border-radius: 8px;
          overflow: hidden;
          background-color: #dbe7ef;
          background-position: center;
          background-size: cover;
          margin-bottom: 14px;
          isolation: isolate;
          position: relative;
          padding: 28px;
        }
        .room-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(15, 23, 42, 0.72), rgba(15, 23, 42, 0.16));
          z-index: -1;
        }
        .room-hero span {
          color: #bfdbfe;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .room-hero h2 {
          margin: 6px 0;
          color: #ffffff;
          font-size: 46px;
          line-height: 1;
        }
        .room-hero p {
          max-width: 640px;
          margin: 0;
          color: #e2e8f0;
          font-size: 18px;
        }
        .category-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .category-toolbar span,
        .category-toolbar label {
          color: #475569;
          font-weight: 900;
        }
        .room-product-card .product-card-logo {
          display: grid;
          min-height: 56px;
          align-items: center;
          justify-items: center;
        }
        .cabinetry-brand-card .brand-logo-card,
        .cabinetry-range-card .swatch-range-card {
          background-size: contain;
          background-repeat: no-repeat;
          background-color: #ffffff;
        }
        .cabinetry-colour-card .product-card-logo img {
          width: min(180px, 80%);
          max-height: 46px;
          object-fit: contain;
        }
        .cabinetry-colour-card .product-pick img,
        .swatch-product img {
          object-fit: contain;
        }
        .room-product-card .product-card-logo .appliance-brand-logo {
          min-height: 56px;
          border: 0;
          padding: 4px;
        }
        .contain-product img {
          height: 170px;
          object-fit: contain;
          padding: 10px;
        }
        .product-detail-split {
          display: grid;
          grid-template-columns: minmax(280px, 1fr) minmax(300px, 0.95fr);
          gap: 24px;
          align-items: start;
        }
        .product-detail-media {
          display: grid;
          min-height: 420px;
          place-items: center;
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #ffffff;
          padding: 18px;
        }
        .product-detail-media img {
          width: 100%;
          max-height: 520px;
          object-fit: contain;
        }
        .product-detail-info {
          display: grid;
          gap: 12px;
        }
        .product-detail-info .appliance-brand-logo {
          max-width: 260px;
          min-height: 76px;
        }
        .product-detail-info h2 {
          margin: 0;
          font-size: 30px;
          line-height: 1.1;
        }
        .price-line {
          margin: 0;
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #f8fafc;
          padding: 10px 12px;
          font-weight: 900;
        }
        .catalogue-breadcrumb {
          margin-bottom: 12px;
        }
        .catalogue-breadcrumb span {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #eef4ff;
          color: #1f3b6d;
          padding: 9px 12px;
          font-weight: 900;
        }
        .family-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 16px;
        }
        .family-main,
        .detail-panel,
        .admin-body {
          border: 1px solid #d7deea;
          background: #ffffff;
          border-radius: 8px;
          padding: 16px;
        }
        .family-hero {
          display: grid;
          grid-template-columns: 240px minmax(0, 1fr);
          gap: 16px;
          align-items: center;
          margin-bottom: 14px;
        }
        .family-hero img,
        .selected-product img,
        .product-option img {
          width: 100%;
          object-fit: cover;
          background: #e2e8f0;
        }
        .family-hero img {
          height: 160px;
          border-radius: 8px;
        }
        .appliance-brand-page,
        .appliance-category-section {
          display: grid;
          gap: 14px;
        }
        .appliance-category-section {
          border: 1px solid #d7deea;
          background: #ffffff;
          border-radius: 8px;
          padding: 14px;
        }
        .compact-heading {
          margin-bottom: 0;
        }
        .compact-heading strong {
          font-size: 18px;
        }
        .appliance-size-group {
          display: grid;
          gap: 10px;
        }
        .appliance-size-group h3 {
          margin: 0;
          color: #334155;
          font-size: 16px;
        }
        .appliance-pack-card {
          border-color: #b6d5de;
        }
        .component-mini-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .component-mini-list span {
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #f8fafc;
          color: #475569;
          font-size: 11px;
          font-weight: 800;
          padding: 4px 6px;
        }
        .family-hero h2 {
          margin: 0;
          font-size: 32px;
        }
        .family-hero p {
          margin: 6px 0 12px;
          color: #64748b;
        }
        .chips,
        .swatches {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .chips span,
        .swatches span {
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          background: #f8fafc;
          padding: 6px 9px;
          color: #475569;
          font-size: 12px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .swatches span::before {
          content: "";
          width: 10px;
          height: 10px;
          border: 1px solid #cbd5e1;
          background: var(--swatch-colour, transparent);
        }
        .product-flow {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }
        .product-flow div {
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #f8fafc;
          padding: 12px;
        }
        .product-flow span {
          display: block;
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .product-flow strong {
          display: block;
          margin-top: 4px;
        }
        .product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 12px;
        }
        .appliance-catalogue {
          display: grid;
          gap: 14px;
          margin-top: 16px;
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #ffffff;
          padding: 16px;
        }
        .appliance-admin-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .appliance-admin-bar span {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: var(--brand-logo-background, #f8fafc);
          padding: 8px 10px;
          color: #475569;
          font-size: 12px;
          font-weight: 900;
        }
        .appliance-filters input {
          grid-column: span 1;
        }
        .appliance-card-media {
          cursor: default;
        }
        .appliance-brand-tile {
          align-content: start;
        }
        .appliance-brand-logo {
          display: grid;
          min-height: 128px;
          width: 100%;
          place-items: center;
          box-sizing: border-box;
          border: 1px solid #d7deea;
          border-radius: 6px;
          background: #f8fafc;
          padding: 18px;
        }
        .appliance-brand-logo img {
          display: block;
          max-width: min(180px, 100%);
          max-height: 70px;
          object-fit: contain;
        }
        .appliance-brand-logo.text-logo {
          color: #0f172a;
          font-size: 22px;
          font-weight: 900;
        }
        .appliance-image-fallback {
          display: grid;
          min-height: 140px;
          width: 100%;
          align-content: center;
          gap: 8px;
          justify-items: center;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background-color: #eef2f7;
          color: #0f172a;
          padding: 14px;
          text-align: center;
          font-size: 12px;
          font-weight: 900;
          line-height: 1.35;
        }
        .appliance-image-fallback strong {
          color: #0f172a;
          font-size: 14px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .appliance-image-fallback small {
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          color: #334155;
          padding: 5px 8px;
          font-weight: 900;
        }
        .appliance-image-fallback.large {
          min-height: 160px;
          border-radius: 8px;
        }
        .appliance-description {
          margin: 0;
          color: #475569;
          line-height: 1.55;
        }
        .component-list {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }
        .component-row {
          display: grid;
          grid-template-columns: 90px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #f8fafc;
          padding: 10px;
        }
        .component-row .appliance-image-fallback {
          min-height: 64px;
          padding: 8px;
          font-size: 10px;
        }
        .component-row span {
          display: grid;
          gap: 4px;
        }
        .component-row small,
        .warning-text {
          color: #64748b;
          line-height: 1.35;
        }
        .warning-text {
          font-weight: 800;
        }
        .product-option {
          display: grid;
          gap: 8px;
          align-content: start;
          border-color: #d7deea;
          background: #ffffff;
          padding: 10px;
        }
        .management-card {
          border: 1px solid #d7deea;
          border-radius: 8px;
        }
        .product-pick {
          display: grid;
          gap: 8px;
          border: 0;
          padding: 0;
          background: transparent;
          color: inherit;
          justify-content: stretch;
        }
        .product-option.selected {
          border-color: #1f6feb;
          box-shadow: inset 0 0 0 1px #1f6feb;
        }
        .product-option img {
          height: 140px;
          border-radius: 6px;
        }
        .product-option small {
          color: #64748b;
        }
        .product-option span {
          color: #166534;
          font-size: 12px;
          font-weight: 900;
        }
        .product-option span.appliance-image-fallback {
          color: #475569;
        }
        .product-image-awaiting {
          display: grid;
          min-height: 140px;
          width: 100%;
          place-items: center;
          gap: 8px;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #f8fafc;
          color: #334155;
          padding: 14px;
          text-align: center;
        }
        .product-image-awaiting.large {
          min-height: 320px;
        }
        .product-image-awaiting strong {
          color: #0f172a;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .product-image-awaiting small,
        .product-option span.product-image-awaiting {
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
        }
        .status-pill {
          justify-self: start;
          border-radius: 999px;
          padding: 4px 8px;
          background: #f1f5f9;
        }
        .status-pill.on {
          color: #166534;
          background: #dcfce7;
        }
        .status-pill.off {
          color: #991b1b;
          background: #fee2e2;
        }
        .card-actions a {
          display: inline-flex;
          align-items: center;
          min-height: 34px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 7px 10px;
          color: #1f6feb;
          font-weight: 900;
          text-decoration: none;
        }
        .detail-panel {
          align-self: start;
          display: grid;
          gap: 14px;
        }
        .panel-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        dl {
          display: grid;
          gap: 8px;
          margin: 0;
        }
        dt {
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }
        dd {
          margin: 0 0 8px;
          color: #172033;
          line-height: 1.45;
        }
        .selected-product {
          display: grid;
          gap: 10px;
        }
        .selected-product img {
          height: 190px;
          border-radius: 8px;
        }
        .selected-product a {
          color: #1f6feb;
          overflow-wrap: anywhere;
          font-weight: 800;
        }
        .gallery {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .gallery img {
          height: 72px;
          border-radius: 6px;
        }
        .variant-list {
          display: grid;
          gap: 8px;
        }
        .variant-list > strong {
          font-size: 13px;
          text-transform: uppercase;
          color: #64748b;
        }
        .variant {
          justify-content: flex-start;
          background: #ffffff;
          color: #172033;
          border-color: #cbd5e1;
        }
        .variant.selected {
          border-color: #1f6feb;
          box-shadow: inset 0 0 0 1px #1f6feb;
        }
        .selected-product h3,
        .selected-product p {
          margin: 0;
        }
        .selected-product p {
          color: #64748b;
          line-height: 1.45;
        }
        .selected-product button,
        .product-form button,
        .import-preview button {
          background: #1f6feb;
          color: #ffffff;
          border-color: #1f6feb;
        }
        .selected-product button.secondary {
          background: #ffffff;
          color: #172033;
          border-color: #cbd5e1;
        }
        .empty-state {
          display: grid;
          gap: 12px;
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #f8fafc;
          padding: 16px;
        }
        .empty-state div {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .admin-toggle {
          background: #172033;
          color: #ffffff;
          border-color: #172033;
        }
        .admin-body {
          display: grid;
          gap: 14px;
          margin-top: 10px;
        }
        .master-catalogue {
          margin-top: 16px;
          border: 1px solid #d7deea;
          background: #ffffff;
          border-radius: 8px;
          padding: 16px;
        }
        .master-toolbar,
        .master-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .master-body {
          display: grid;
          gap: 14px;
          margin-top: 14px;
        }
        .roofing-admin-sections {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #f8fafc;
          padding: 10px;
        }
        .roofing-admin-sections button {
          background: #ffffff;
          color: #071827;
          border: 1px solid #cbd5e1;
        }
        .roofing-admin-sections span {
          color: #475569;
          font-weight: 850;
        }
        .master-filters {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 8px;
        }
        .appliance-type-picker {
          display: grid;
          gap: 12px;
          border: 1px solid #d7deea;
          background: #ffffff;
          border-radius: 8px;
          padding: 14px;
        }
        .appliance-type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
        }
        .appliance-type-grid button {
          display: grid;
          gap: 4px;
          min-height: 74px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #f8fafc;
          color: #0f172a;
          padding: 12px;
          text-align: left;
          cursor: pointer;
        }
        .appliance-type-grid button.selected {
          border-color: #1f6feb;
          box-shadow: inset 0 0 0 1px #1f6feb;
          background: #eff6ff;
        }
        .appliance-type-grid span {
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }
        .appliance-model-grid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
          align-items: stretch;
        }
        .appliance-filters button {
          min-height: 42px;
        }
        .appliance-card-logo .appliance-brand-logo {
          min-height: 52px;
          border: 0;
          background: transparent;
          padding: 4px;
        }
        .appliance-card-logo .appliance-brand-logo img {
          max-height: 34px;
        }
        .appliance-card-media {
          display: grid;
          min-height: 164px;
          place-items: center;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #ffffff;
          cursor: default;
          overflow: hidden;
        }
        .appliance-visual-card {
          min-height: 460px;
          grid-template-rows: auto 176px minmax(138px, 1fr) auto auto;
        }
        .appliance-visual-card img,
        .appliance-visual-card .appliance-card-media img,
        .appliance-detail-layout .family-hero img,
        .component-mini-list img,
        .visual-component-card img {
          width: 100%;
          object-fit: contain;
          background: #ffffff;
        }
        .appliance-visual-card .appliance-card-media img {
          height: 100%;
        }
        .appliance-detail-layout .family-hero img,
        .appliance-detail-layout .family-hero .appliance-image-fallback.large {
          height: 320px;
          min-height: 320px;
          object-fit: contain;
          background: #ffffff;
        }
        .appliance-card-copy {
          display: grid;
          gap: 5px;
          align-content: start;
        }
        .appliance-card-copy span {
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .appliance-card-copy strong {
          color: #0f172a;
          line-height: 1.25;
        }
        .appliance-card-copy small {
          line-height: 1.35;
        }
        .appliance-card-footer {
          display: grid;
          gap: 6px;
        }
        .appliance-card-actions {
          display: grid;
          grid-template-columns: 1fr;
        }
        .appliance-card-actions button {
          justify-content: center;
        }
        .component-mini-list.visual-components {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
          gap: 6px;
        }
        .component-mini-list.visual-components button {
          display: grid;
          gap: 4px;
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #f8fafc;
          padding: 6px;
          text-align: left;
          cursor: pointer;
        }
        .component-mini-list.visual-components .appliance-image-fallback,
        .component-mini-list.visual-components img {
          height: 56px;
          min-height: 56px;
          object-fit: contain;
          background: #ffffff;
        }
        .component-mini-list.visual-components strong,
        .component-mini-list.visual-components span {
          border: 0;
          background: transparent;
          color: #0f172a;
          padding: 0;
          font-size: 11px;
          line-height: 1.2;
        }
        .component-mini-list.visual-components span {
          color: #64748b;
        }
        .appliance-detail-summary {
          display: grid;
          gap: 12px;
          align-content: start;
        }
        .appliance-detail-summary .appliance-brand-logo {
          max-width: 220px;
          min-height: 72px;
        }
        .appliance-detail-price {
          display: inline-flex;
          justify-self: start;
          border-radius: 8px;
          background: #fff1f2;
          color: #334155;
          padding: 10px 14px;
          font-size: 18px;
        }
        .appliance-detail-quick-specs {
          display: grid;
          grid-template-columns: max-content minmax(0, 1fr);
          gap: 6px 12px;
          margin: 0;
        }
        .appliance-detail-quick-specs dt {
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .appliance-detail-quick-specs dd {
          margin: 0;
          color: #0f172a;
          font-weight: 700;
        }
        .appliance-feature-list {
          margin: 0;
          padding-left: 18px;
          color: #334155;
          line-height: 1.45;
        }
        .appliance-detail-actions {
          display: flex;
          flex-wrap: wrap;
        }
        .visual-component-card {
          width: 100%;
          min-height: 170px;
          grid-template-columns: 1fr;
          text-align: left;
          cursor: pointer;
        }
        .visual-component-card img,
        .visual-component-card .appliance-image-fallback {
          height: 96px;
          min-height: 96px;
          object-fit: contain;
          background: #ffffff;
        }
        .appliance-image-fallback small {
          border-radius: 8px;
        }
        @media (max-width: 1280px) {
          .appliance-model-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 760px) {
          .appliance-model-grid {
            grid-template-columns: 1fr;
          }
        }
        .master-filters input,
        .master-filters select,
        .master-toolbar select,
        .form-grid select {
          min-height: 38px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          color: #172033;
          padding: 8px 10px;
          font-weight: 700;
        }
        .master-filters input {
          grid-column: span 2;
        }
        .master-summary span {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #f8fafc;
          padding: 8px 10px;
          color: #475569;
          font-size: 12px;
          font-weight: 900;
        }
        .master-table {
          display: grid;
          gap: 8px;
        }
        .manage-catalogue-items {
          display: grid;
          gap: 12px;
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #ffffff;
          padding: 14px;
        }
        .catalogue-selection-actions {
          align-items: center;
        }
        .catalogue-selection-actions span {
          margin-left: auto;
          color: #475569;
          font-size: 12px;
          font-weight: 900;
        }
        .cabinetry-subcategory-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .cabinetry-subcategory-tabs button {
          min-height: 38px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          color: #0f172a;
          padding: 8px 12px;
          font-weight: 900;
          cursor: pointer;
        }
        .cabinetry-subcategory-tabs button.selected {
          border-color: #0f766e;
          background: #ecfdf5;
          color: #0f766e;
        }
        .cabinetry-export-actions {
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #f8fafc;
          padding: 10px;
        }
        .catalogue-items-table {
          display: grid;
          gap: 6px;
          overflow-x: auto;
        }
        .catalogue-items-head,
        .catalogue-items-row {
          display: grid;
          grid-template-columns: 64px 78px minmax(220px, 1.3fr) minmax(120px, 0.7fr) minmax(130px, 0.7fr) minmax(150px, 0.8fr) minmax(150px, 0.8fr) minmax(190px, 1fr) 110px 80px 100px 110px 120px;
          gap: 10px;
          align-items: center;
          min-width: 1780px;
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #f8fafc;
          padding: 8px 10px;
        }
        .catalogue-items-head {
          background: #eaf1fb;
          color: #334155;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .catalogue-items-row strong,
        .catalogue-items-row span {
          overflow-wrap: anywhere;
        }
        .catalogue-items-row span {
          color: #64748b;
          font-size: 12px;
        }
        .table-check {
          display: flex;
          justify-content: center;
        }
        .table-check input {
          width: 18px;
          height: 18px;
        }
        .catalogue-thumb {
          width: 64px;
          height: 48px;
          display: grid;
          place-items: center;
          border: 1px solid #d7deea;
          border-radius: 6px;
          background: #ffffff;
          overflow: hidden;
        }
        .catalogue-thumb img,
        .catalogue-thumb .product-image-awaiting {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .catalogue-thumb .product-image-awaiting {
          font-size: 9px;
          padding: 4px;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .master-row {
          display: grid;
          grid-template-columns: minmax(180px, 1.2fr) 140px minmax(180px, 1.1fr) 150px 170px auto;
          gap: 10px;
          align-items: center;
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #f8fafc;
          padding: 10px;
        }
        .master-row span {
          color: #64748b;
          font-size: 12px;
          overflow-wrap: anywhere;
        }
        .admin-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .product-form,
        .import-preview,
        .entity-model {
          display: grid;
          gap: 12px;
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #f8fafc;
          padding: 14px;
        }
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
        }
        input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 10px 11px;
          font: inherit;
        }
        .check-field {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          padding: 9px 11px;
          font-weight: 800;
        }
        .check-field input {
          width: auto;
        }
        .product-form button.secondary {
          background: #ffffff;
          color: #172033;
          border-color: #cbd5e1;
        }
        .preview-list {
          display: grid;
          gap: 8px;
        }
        .preview-row {
          display: grid;
          grid-template-columns: 74px 80px minmax(0, 1fr) minmax(120px, auto);
          gap: 8px;
          align-items: center;
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #ffffff;
          padding: 10px;
        }
        .preview-row.error {
          border-color: #fecaca;
          background: #fff1f2;
        }
        .preview-row small {
          color: #64748b;
        }
        .preview-row img,
        .preview-image-empty {
          width: 64px;
          height: 48px;
          border-radius: 6px;
          object-fit: cover;
          background: #e2e8f0;
        }
        .preview-image-empty {
          display: grid;
          place-items: center;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
        }
        .entity-model p {
          margin: 0;
          color: #475569;
          line-height: 1.45;
        }
        .entity-model span {
          color: #172033;
          font-weight: 900;
          text-transform: uppercase;
        }
        @media (max-width: 1400px) {
          .catalogue-section-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        @media (max-width: 980px) {
          .standard-banner,
          .family-layout,
          .family-hero,
          .product-flow,
          .master-row {
            grid-template-columns: 1fr;
          }
          .catalogue-section-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .banner-meta {
            justify-items: start;
          }
          .banner-copy h1 {
            font-size: 38px;
          }
        }
        @media (max-width: 560px) {
          .page {
            padding: 12px;
          }
          .banner-copy h1 {
            font-size: 30px;
          }
          .banner-copy p {
            font-size: 16px;
          }
          .tile-grid,
          .product-grid,
          .form-grid {
            grid-template-columns: 1fr;
          }
          .catalogue-section-grid {
            grid-template-columns: 1fr;
          }
          .master-filters input {
            grid-column: span 1;
          }
          .preview-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <style jsx global>{`
        .appliance-brand-logo {
          display: grid;
          min-height: 128px;
          width: 100%;
          place-items: center;
          box-sizing: border-box;
          border: 1px solid #d7deea;
          border-radius: 6px;
          background: #f8fafc;
          padding: 18px;
        }
        .appliance-brand-logo img {
          display: block;
          max-width: min(180px, 100%);
          max-height: 70px;
          object-fit: contain;
        }
        .appliance-brand-logo.text-logo {
          color: #0f172a;
          font-size: 22px;
          font-weight: 900;
        }
        .appliance-visual-card {
          display: grid;
          gap: 8px;
          min-height: 460px;
          grid-template-rows: auto 176px minmax(138px, 1fr) auto auto;
          align-content: start;
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #ffffff;
          padding: 10px;
        }
        .appliance-card-logo {
          display: grid;
          min-height: 52px;
          place-items: center;
        }
        .appliance-card-logo .appliance-brand-logo {
          min-height: 52px;
          border: 0;
          background: transparent;
          padding: 4px;
        }
        .appliance-card-logo .appliance-brand-logo img {
          max-height: 34px;
        }
        .appliance-card-media {
          display: grid;
          min-height: 164px;
          place-items: center;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #ffffff;
          cursor: default;
          overflow: hidden;
        }
        .appliance-card-media img,
        .appliance-visual-card img,
        .component-mini-list.visual-components img,
        .visual-component-card img,
        .appliance-detail-layout .family-hero img {
          width: 100%;
          object-fit: contain;
          background: #ffffff;
        }
        .appliance-card-media img {
          height: 100%;
        }
        .appliance-card-copy {
          display: grid;
          gap: 5px;
          align-content: start;
        }
        .appliance-card-copy span {
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .appliance-card-copy strong {
          color: #0f172a;
          line-height: 1.25;
        }
        .appliance-card-copy small {
          color: #64748b;
          line-height: 1.35;
        }
        .appliance-card-footer {
          display: grid;
          gap: 6px;
        }
        .appliance-card-actions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }
        .appliance-card-actions button,
        .appliance-detail-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 34px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #0f172a;
          color: #ffffff;
          padding: 7px 11px;
          font-weight: 900;
          cursor: pointer;
        }
        .appliance-card-actions button.secondary,
        .appliance-detail-actions button.secondary {
          background: #ffffff;
          color: #0f172a;
        }
        .appliance-image-fallback {
          display: grid;
          min-height: 140px;
          width: 100%;
          align-content: center;
          gap: 8px;
          justify-items: center;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background-color: #eef2f7;
          color: #0f172a;
          padding: 14px;
          text-align: center;
          font-size: 12px;
          font-weight: 900;
          line-height: 1.35;
        }
        .appliance-image-fallback strong {
          color: #0f172a;
          font-size: 14px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .appliance-image-fallback small {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.92);
          color: #334155;
          padding: 5px 8px;
          font-weight: 900;
        }
        .appliance-detail-layout .family-hero img,
        .appliance-detail-layout .family-hero .appliance-image-fallback.large {
          height: 320px;
          min-height: 320px;
        }
        .component-mini-list.visual-components {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
          gap: 6px;
        }
        .component-mini-list.visual-components button {
          display: grid;
          gap: 4px;
          border: 1px solid #d7deea;
          border-radius: 8px;
          background: #f8fafc;
          padding: 6px;
          text-align: left;
          cursor: pointer;
        }
        .component-mini-list.visual-components .appliance-image-fallback,
        .component-mini-list.visual-components img {
          height: 56px;
          min-height: 56px;
          object-fit: contain;
          background: #ffffff;
        }
        .component-mini-list.visual-components strong,
        .component-mini-list.visual-components span {
          border: 0;
          background: transparent;
          color: #0f172a;
          padding: 0;
          font-size: 11px;
          line-height: 1.2;
        }
        .component-mini-list.visual-components span {
          color: #64748b;
        }
        .visual-component-card {
          width: 100%;
          min-height: 170px;
          grid-template-columns: 1fr;
          text-align: left;
          cursor: pointer;
        }
        .visual-component-card img,
        .visual-component-card .appliance-image-fallback {
          height: 96px;
          min-height: 96px;
          object-fit: contain;
          background: #ffffff;
        }
      `}</style>
    </>
  );
}
