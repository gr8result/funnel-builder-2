import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { Archive, ArrowLeft, Boxes, Check, Copy, Edit3, FileDown, FileUp, FolderOpen, ImagePlus, Package, Pencil, Plus, RefreshCw, Upload, X } from "lucide-react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import {
  AUSTRALIAN_REGIONS,
  BUILDER_PRODUCT_MODES,
  BUILDER_PRODUCT_TIERS,
  BUILDER_ENABLEMENT_STORAGE_KEY,
  GARAGE_DOOR_SELECTION_KEY,
  MASTER_IMAGE_STATUSES,
  MASTER_PRICE_STATUSES,
  MASTER_CATALOGUE_STORAGE_KEY,
  MASTER_PRODUCT_CATALOGUE_IMPORT_TEMPLATE,
  PRODUCT_ENTITY_FIELDS,
  PRODUCT_FAMILIES,
  PRODUCT_LIBRARY_IMPORT_COLUMNS,
  PRODUCT_LIBRARY_SELECTIONS_KEY,
  TAXONOMY_CATEGORY_DEFINITIONS,
  TOP_LEVEL_AREAS,
  createProductEntity,
  createBuilderProductReference,
  ensureBuilderCompletedFamilyEnablements,
  ensureDemoBuilderCatalogueEnablements,
  exportMasterCatalogueCsv,
  exportMasterCatalogueJson,
  familyByKey,
  familyCatalogueStatus,
  familyIsLocked,
  isProductLibraryEligibleProduct,
  mergeMasterCatalogueProducts,
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
import { supabase } from "../../../utils/supabase-client";
import qldBrickMasterCatalogue from "../../../data/product-library/catalogues/bricks/QLD-BRICKS-MASTER-CATALOGUE.json";
import auMetalRoofingCatalogue from "../../../data/product-library/catalogues/roofing/AU-METAL-ROOFING-CATALOGUE.json";
import exteriorOpeningsCatalogue from "../../../data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json";
import exteriorFinishesCatalogue from "../../../data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json";
import kitchenProductCatalogue from "../../../data/product-library/catalogues/kitchen/AU-KITCHEN-PRODUCT-CATALOGUE.json";

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
  if (filters.category && product.categoryKey !== filters.category && product.category !== filters.category) return false;
  if (filters.family && product.familyKey !== filters.family) return false;
  if (filters.manufacturer && product.manufacturer !== filters.manufacturer) return false;
  if (filters.brand && product.brand !== filters.brand) return false;
  if (filters.supplier && product.supplier !== filters.supplier) return false;
  if (filters.range && product.range !== filters.range) return false;
  if (filters.region && !(product.regions || []).includes("AU") && !(product.regions || []).includes(filters.region)) return false;
  if (filters.imageStatus && product.imageStatus !== filters.imageStatus) return false;
  if (filters.priceStatus && product.priceStatus !== filters.priceStatus) return false;
  if (filters.status === "active" && product.active === false) return false;
  if (filters.status === "discontinued" && !product.discontinued) return false;
  return true;
}

function productPriceLabel(product) {
  const status = product.priceStatus || "price_pending";
  if (status === "current") return money(product.clientPrice ?? product.rrp ?? product.normalizedUnitPrice);
  if (status === "quote_required") return "Quote required";
  if (status === "allowance_only") return "Allowance only";
  if (status === "expired") return "Price expired";
  return "Price pending";
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

const PRODUCT_LIBRARY_HOME_AREAS = [
  TOP_LEVEL_AREAS.find((area) => area.key === "exterior"),
  { ...TOP_LEVEL_AREAS.find((area) => area.key === "interior"), description: "Internal finishes, kitchens, bathrooms, laundry, garage interiors and living area selections." },
].filter(Boolean);

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

export default function BuilderProductLibraryPage() {
  const router = useRouter();
  const { workspaceId, activeWorkspace, loading: workspaceLoading } = useWorkspace();
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
  const [masterCatalogueOpen, setMasterCatalogueOpen] = useState(true);
  const [masterProducts, setMasterProducts] = useState([]);
  const [builderEnablements, setBuilderEnablements] = useState([]);
  const [masterImportPreview, setMasterImportPreview] = useState(null);
  const [masterFilters, setMasterFilters] = useState({ search: "", area: "", category: "", family: "", manufacturer: "", brand: "", supplier: "", range: "", region: "", imageStatus: "", priceStatus: "", status: "" });
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [editingProductId, setEditingProductId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedArea = TOP_LEVEL_AREAS.find((area) => area.key === selectedAreaKey) || null;
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
  const bannerTitle = selectedFamily?.displayName || selectedCategory?.category || selectedArea?.displayName || "Product Library";
  const bannerSubtitle = selectedFamily
    ? `${selectedFamily.category} / ${selectedFamily.subcategory}`
    : selectedCategory
      ? `Choose products and families for ${selectedCategory.category}.`
      : selectedArea
        ? `Choose one ${selectedArea.displayName} category.`
        : "Choose an area, then a category, then the products available for selections.";

  useEffect(() => {
    if (!workspaceId) return;
    loadLibrary();
  }, [workspaceId]);

  useEffect(() => {
    if (!router.isReady || routeHydrated) return;
    const area = typeof router.query.area === "string" ? router.query.area : "";
    const category = typeof router.query.category === "string" ? router.query.category : "";
    const family = typeof router.query.family === "string" ? router.query.family : "";
    if (area) setSelectedAreaKey(area);
    if (category) setSelectedCategoryKey(category);
    if (family) setSelectedFamilyKey(family);
    setRouteHydrated(true);
  }, [routeHydrated, router.isReady, router.query.area, router.query.category, router.query.family]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const baselineProducts = [
      ...(Array.isArray(qldBrickMasterCatalogue?.products) ? qldBrickMasterCatalogue.products : []),
      ...(Array.isArray(auMetalRoofingCatalogue?.products) ? auMetalRoofingCatalogue.products.map((product) => normalizeMasterProductRecord(product)) : []),
      ...(Array.isArray(exteriorOpeningsCatalogue?.products) ? exteriorOpeningsCatalogue.products.map((product) => normalizeMasterProductRecord(product)) : []),
      ...(Array.isArray(exteriorFinishesCatalogue?.products) ? exteriorFinishesCatalogue.products.map((product) => normalizeMasterProductRecord(product)) : []),
      ...(Array.isArray(kitchenProductCatalogue?.products) ? kitchenProductCatalogue.products.map((product) => normalizeMasterProductRecord(product)) : []),
    ];
    try {
      const storedProducts = JSON.parse(window.localStorage.getItem(MASTER_CATALOGUE_STORAGE_KEY) || "[]");
      const nextProducts = mergeMasterCatalogueProducts(baselineProducts, storedProducts);
      const storedEnablements = JSON.parse(window.localStorage.getItem(BUILDER_ENABLEMENT_STORAGE_KEY) || "[]");
      const nextEnablements = ensureBuilderCompletedFamilyEnablements(
        nextProducts,
        ensureDemoBuilderCatalogueEnablements(nextProducts, Array.isArray(storedEnablements) ? storedEnablements : [], workspaceId || ""),
        workspaceId || "",
      );
      setMasterProducts(nextProducts);
      setBuilderEnablements(nextEnablements);
      if (Array.isArray(storedProducts) && nextProducts.length !== storedProducts.length) {
        window.localStorage.setItem(MASTER_CATALOGUE_STORAGE_KEY, JSON.stringify(nextProducts));
      }
      if (JSON.stringify(nextEnablements) !== JSON.stringify(storedEnablements)) {
        window.localStorage.setItem(BUILDER_ENABLEMENT_STORAGE_KEY, JSON.stringify(nextEnablements));
      }
    } catch {
      const fallbackEnablements = ensureBuilderCompletedFamilyEnablements(
        baselineProducts,
        ensureDemoBuilderCatalogueEnablements(baselineProducts, [], workspaceId || ""),
        workspaceId || "",
      );
      setMasterProducts(baselineProducts);
      setBuilderEnablements(fallbackEnablements);
      if (fallbackEnablements.length) window.localStorage.setItem(BUILDER_ENABLEMENT_STORAGE_KEY, JSON.stringify(fallbackEnablements));
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!routeHydrated || !router.isReady) return;
    const query = {};
    if (selectedAreaKey) query.area = selectedAreaKey;
    if (selectedCategoryKey) query.category = selectedCategoryKey;
    if (selectedFamilyKey) query.family = selectedFamilyKey;
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  }, [routeHydrated, router, selectedAreaKey, selectedCategoryKey, selectedFamilyKey]);

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
    setError("");
    setSuccess("");
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
    router.push("/modules/builders");
  }

  function openFamily(familyKey) {
    setSelectedFamilyKey(familyKey);
    setSelectedSupplierName("");
    setSelectedRangeName("");
    setAdminOpen(false);
  }

  function openArea(areaKey) {
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

  function statusForCount(count) {
    return count ? "Ready" : "Needs products";
  }

  function exportTemplateCsv() {
    downloadCsv("MASTER-PRODUCT-CATALOGUE-IMPORT-TEMPLATE.csv", [PRODUCT_LIBRARY_IMPORT_COLUMNS]);
  }

  function persistMasterCatalogue(nextProducts, nextEnablements = builderEnablements) {
    const targetFamily = nextProducts.map((product) => product.familyKey).filter(Boolean).every((familyKey, _index, families) => familyKey === families[0])
      ? nextProducts.find((product) => product.familyKey)?.familyKey || ""
      : "";
    const preservedProducts = mergeMasterCatalogueProducts(masterProducts, nextProducts, { explicitFamilyKey: targetFamily });
    setMasterProducts(preservedProducts);
    setBuilderEnablements(nextEnablements);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MASTER_CATALOGUE_STORAGE_KEY, JSON.stringify(preservedProducts));
      window.localStorage.setItem(BUILDER_ENABLEMENT_STORAGE_KEY, JSON.stringify(nextEnablements));
    }
  }

  function handleMasterImportPreview(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const format = file.name.toLowerCase().endsWith(".json") ? "json" : "csv";
        const records = parseMasterProductCatalogueImport(reader.result || "", { format });
        const preview = previewMasterProductImport(records, masterProducts);
        setMasterImportPreview({ fileName: file.name, format, records, preview });
        setMasterCatalogueOpen(true);
        setSuccess(`Previewed ${preview.totalProducts} master product${preview.totalProducts === 1 ? "" : "s"} from ${file.name}.`);
      } catch (previewError) {
        setError(previewError.message || "Could not parse that catalogue import.");
      }
    };
    reader.onerror = () => setError("Could not read that catalogue import file.");
    reader.readAsText(file);
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

  function toggleBuilderProduct(masterProduct) {
    if (!workspaceId || !masterProduct) return;
    const existing = builderEnablements.find((item) => item.organisationId === workspaceId && item.masterProductCode === masterProduct.productCode);
    const nextEnablements = existing
      ? builderEnablements.map((item) => item === existing ? { ...item, enabled: !item.enabled, active: !item.enabled } : item)
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
        ? { ...existing, enabled, active: enabled }
        : createBuilderProductReference(product, { organisationId: workspaceId, enabled, active: enabled, tier: BUILDER_PRODUCT_TIERS[0], selectionMode: BUILDER_PRODUCT_MODES[1] }));
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
    const archivedRecord = normalizeMasterProductRecord({ ...entity, active: false, archived: true, discontinued: entity.discontinued });
    persistMasterCatalogue(masterProducts.map((product) => product.productCode === archivedRecord.productCode ? archivedRecord : product));
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
    router.push("/modules/builders");
  }

  return (
    <>
      <Head>
        <title>Product Library | Gr8 Result</title>
      </Head>
      <main className="page">
        <header className="standard-banner">
          <button type="button" className="back-button" onClick={goBack} aria-label="Back">
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
          <div className="banner-icon">
            <Package size={28} />
          </div>
          <div className="banner-copy">
            <h1>{bannerTitle}</h1>
            <p>{bannerSubtitle}</p>
          </div>
          <div className="banner-meta">
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

        <section className="master-catalogue" data-admin-surface="master-catalogue">
          <div className="section-heading">
            <span>Product Library Management</span>
            <strong>Master Catalogue</strong>
          </div>
          <div className="master-toolbar">
            <button type="button" onClick={() => setMasterCatalogueOpen((current) => !current)}><Boxes size={16} /> Master Catalogue</button>
            <label className="file-button">
              <Upload size={16} />
              Import Products
              <input type="file" accept=".csv,text/csv,.json,application/json" onChange={handleMasterImportPreview} />
            </label>
            <button type="button" onClick={exportTemplateCsv}><FileUp size={16} /> Import Template</button>
            <button type="button" onClick={exportMasterCsv}><FileDown size={16} /> Export Catalogue CSV</button>
            <button type="button" onClick={exportMasterJson}><FileDown size={16} /> Export Catalogue JSON</button>
            <button type="button" onClick={() => setSuccess(`Add Product uses the canonical schema from ${MASTER_PRODUCT_CATALOGUE_IMPORT_TEMPLATE}.`)}><Plus size={16} /> Add Product</button>
          </div>
          {masterCatalogueOpen ? (
            <div className="master-body">
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
                <select value={masterFilters.category} onChange={(event) => setMasterFilters((current) => ({ ...current, category: event.target.value }))}>
                  <option value="">Category</option>
                  {TAXONOMY_CATEGORY_DEFINITIONS.map((categoryItem) => <option key={categoryItem.key} value={categoryItem.key}>{categoryItem.category}</option>)}
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
                <select value={masterFilters.status} onChange={(event) => setMasterFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="">Active/Discontinued</option>
                  <option value="active">Active</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>

              <div className="master-summary">
                <span>Total: {masterProducts.length}</span>
                <span>Filtered: {filteredMasterProducts.length}</span>
                <span>Builder enabled: {builderEnablements.filter((item) => item.organisationId === workspaceId && item.enabled).length}</span>
                <span data-client-selections-query-proof="enabled-compatible-products">Client Selections query proof: {selectableProof.length} enabled compatible product{selectableProof.length === 1 ? "" : "s"}</span>
              </div>

              {masterImportPreview ? (
                <div className="import-preview" data-import-preview="master-catalogue">
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

        {!selectedArea ? (
          <section className="purpose">
            <div className="section-heading">
              <span>Catalogue Areas</span>
              <strong>Choose one area</strong>
            </div>
            <div className="tile-grid area-grid">
              {PRODUCT_LIBRARY_HOME_AREAS.map((area) => {
                const count = countProductsForArea(area);
                return (
                  <button key={area.key} type="button" className="visual-tile" onClick={() => openArea(area.key)} data-area-key={area.key}>
                    <span className="tile-image" style={{ backgroundImage: `url(${area.image})` }} />
                    <span className="tile-body">
                      <strong>{area.displayName}</strong>
                      <small>{count} product{count === 1 ? "" : "s"}</small>
                      <em>{statusForCount(count)}</em>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {selectedArea && !selectedCategory ? (
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

        {selectedArea && selectedCategory && !selectedFamily ? (
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

        {selectedFamily ? (
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
                          <img src={productDisplayImage(product, selectedFamily)} alt={product.productName} />
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
                  <img src={productDisplayImage(selectedProduct, selectedFamily)} alt={selectedProduct.productName} />
                  <div className="gallery" data-gallery-count={(selectedProduct.galleryImages || []).length}>
                    {((selectedProduct.galleryImageUrls || selectedProduct.galleryImages)?.length ? (selectedProduct.galleryImageUrls || selectedProduct.galleryImages) : [productDisplayImage(selectedProduct, selectedFamily)]).map((image, index) => (
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
        .tile-body {
          display: grid;
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
        .master-filters input,
        .master-filters select,
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
        @media (max-width: 980px) {
          .standard-banner,
          .family-layout,
          .family-hero,
          .product-flow,
          .master-row {
            grid-template-columns: 1fr;
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
          .master-filters input {
            grid-column: span 1;
          }
          .preview-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
