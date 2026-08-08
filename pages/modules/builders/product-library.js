import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Boxes, Check, Edit3, FileUp, ImagePlus, Package, Plus, RefreshCw, Upload } from "lucide-react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import {
  PRODUCT_ENTITY_FIELDS,
  PRODUCT_FAMILIES,
  PRODUCT_LIBRARY_IMPORT_COLUMNS,
  TAXONOMY_CATEGORY_DEFINITIONS,
  TOP_LEVEL_AREAS,
  createProductEntity,
  familiesForArea,
  familyByKey,
  productsForFamily,
  selectionQueryForFamily,
  validateProductImportRows,
} from "../../../lib/product-library/catalogueModel";
import { supabase } from "../../../utils/supabase-client";

const EMPTY_PRODUCT = {
  product_code: "",
  product_name: "",
  supplier_name: "",
  brand: "",
  range: "",
  model: "",
  colour: "",
  finish: "",
  size: "",
  primary_image: "",
  official_product_url: "",
  specification_url: "",
  builder_cost: "",
  client_price: "",
  active: true,
};

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function money(value) {
  return Number(value || 0).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
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
    effectiveDate: entity.effectiveDate || "",
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
  const [selectedProductCode, setSelectedProductCode] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
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
    () => products.map((product) => mapDbProductToEntity(product, categoryById.get(product.category_id), supplierById.get(product.supplier_id), manufacturerById.get(product.manufacturer_id))),
    [categoryById, manufacturerById, products, supplierById]
  );

  const visibleCategories = useMemo(
    () => (selectedArea ? TAXONOMY_CATEGORY_DEFINITIONS.filter((category) => category.topLevelArea === selectedArea.key) : []),
    [selectedArea]
  );
  const visibleFamilies = useMemo(() => {
    if (!selectedArea) return [];
    const areaFamilies = familiesForArea(selectedArea.key);
    if (!selectedCategory) return areaFamilies;
    return areaFamilies.filter((familyItem) => familyItem.category === selectedCategory.category || familyItem.subcategory === selectedCategory.category || familyItem.subcategory === selectedCategory.subcategory);
  }, [selectedArea, selectedCategory]);
  const visibleProducts = useMemo(() => {
    if (!selectedFamily) return [];
    return productsForFamily(orgProducts, selectedFamily);
  }, [orgProducts, selectedFamily]);
  const selectedProduct = visibleProducts.find((product) => product.productCode === selectedProductCode || product.productId === selectedProductCode) || visibleProducts[0] || null;
  const selectionQuery = selectedFamily ? selectionQueryForFamily({ areaKey: selectedFamily.topLevelArea, familyKey: selectedFamily.familyKey }) : null;
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
    setSelectedProductCode("");
    setProductForm(EMPTY_PRODUCT);
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
    setAdminOpen(false);
  }

  function openArea(areaKey) {
    setSelectedAreaKey(areaKey);
    setSelectedCategoryKey("");
    setSelectedFamilyKey("");
    setSelectedProductCode("");
  }

  function openCategory(categoryKey) {
    setSelectedCategoryKey(categoryKey);
    setSelectedFamilyKey("");
    setSelectedProductCode("");
    setAdminOpen(false);
  }

  function countProductsForFamily(familyItem) {
    return productsForFamily(orgProducts, familyItem).length;
  }

  function countProductsForCategory(categoryItem) {
    return PRODUCT_FAMILIES
      .filter((familyItem) => familyItem.topLevelArea === categoryItem.topLevelArea && (familyItem.category === categoryItem.category || familyItem.subcategory === categoryItem.category || familyItem.subcategory === categoryItem.subcategory))
      .reduce((total, familyItem) => total + countProductsForFamily(familyItem), 0);
  }

  function statusForCount(count) {
    return count ? "Ready" : "Needs products";
  }

  function exportTemplateCsv() {
    downloadCsv("product-library-supplier-import-template.csv", [
      PRODUCT_LIBRARY_IMPORT_COLUMNS,
      [
        "DEMO-STONE-WHITE",
        "approved-family:stone-benchtops",
        "Generic Stone Supplier",
        "Generic Stone",
        "Essentials",
        "Generic Stone Range - White",
        "",
        "Benchtops",
        "Stone Tops",
        "stone-benchtops",
        "White",
        "Honed",
        "20mm",
        "",
        "",
        "",
        "White / Honed",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "AUD",
        "GST inclusive",
        "",
        "true",
        "false",
      ],
    ]);
  }

  function handleProductCsvPreview(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const records = csvRecords(String(reader.result || ""));
      const preview = validateProductImportRows(records, workspaceId || "");
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
        approvedSourceKey: entity.approvedSourceKey,
      },
      updated_at: new Date().toISOString(),
    };
    const existing = products.find((product) => product.sku && product.sku === entity.productCode);
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
      const validRows = importPreview.preview.filter((row) => !row.errors.length && row.entity);
      for (const row of validRows) {
        await saveEntityProduct(row.entity);
      }
      setSuccess(`Imported ${validRows.length} product${validRows.length === 1 ? "" : "s"}. Rows with errors were skipped.`);
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
      const entity = createProductEntity({
        ...productForm,
        productCode: productForm.product_code,
        productName: productForm.product_name,
        supplier: productForm.supplier_name,
        familyKey: selectedFamily.familyKey,
        linkedQuoteItemCode: selectedFamily.linkedQuoteItemCode || selectedFamily.approvedSourceKey,
        primaryImage: productForm.primary_image,
        officialProductURL: productForm.official_product_url,
        specificationURL: productForm.specification_url,
        builderCost: productForm.builder_cost,
        clientPrice: productForm.client_price,
      }, workspaceId);
      await saveEntityProduct(entity);
      setProductForm(EMPTY_PRODUCT);
      setSuccess(`${entity.productName} saved to ${selectedFamily.displayName}.`);
    } catch (saveError) {
      setError(saveError.message || "Could not save product.");
    }
    setSaving(false);
  }

  function addToSelection(entity) {
    if (!selectedFamily || !entity) return;
    const query = selectionQueryForFamily({ areaKey: selectedFamily.topLevelArea, familyKey: selectedFamily.familyKey });
    setSuccess(`Added ${entity.productName} to selections context ${query.area} / ${query.familyKey} / ${query.linkedQuoteItemCode}.`);
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
            <span>{loading ? "Loading..." : success || "Saved to organisation catalogue"}</span>
            <div className="file-controls">
              <button type="button" onClick={loadLibrary} disabled={!workspaceId || loading}><RefreshCw size={16} /> Refresh</button>
            </div>
          </div>
        </header>

        {error ? <div className="alert error">{error}</div> : null}
        {success ? <div className="alert success">{success}</div> : null}

        {!selectedArea ? (
          <section className="purpose">
            <div className="section-heading">
              <span>Catalogue Areas</span>
              <strong>Choose one area</strong>
            </div>
            <div className="tile-grid area-grid">
              {TOP_LEVEL_AREAS.map((area) => {
                const areaFamilies = familiesForArea(area.key);
                const count = areaFamilies.reduce((total, familyItem) => total + countProductsForFamily(familyItem), 0);
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
                return (
                  <button key={categoryItem.key} type="button" className="visual-tile" onClick={() => openCategory(categoryItem.key)} data-category-key={categoryItem.key}>
                    <span className="tile-image" style={{ backgroundImage: `url(${categoryItem.image})` }} />
                    <span className="tile-body">
                      <strong>{categoryItem.category}</strong>
                      <small>{count} product{count === 1 ? "" : "s"}</small>
                      <em>{statusForCount(count)}</em>
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
                        <em>{statusForCount(count)}</em>
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
                <img src={selectedFamily.image} alt={`${selectedFamily.displayName} generic category`} />
                <div>
                  <h2>{selectedFamily.displayName}</h2>
                  <p>{selectedFamily.category} / {selectedFamily.subcategory}</p>
                  <div className="chips">
                    <span>{selectionQuery.area}</span>
                    <span>{selectionQuery.familyKey}</span>
                    <span>{selectionQuery.linkedQuoteItemCode}</span>
                  </div>
                </div>
              </div>

              <div className="product-grid">
                {visibleProducts.map((product) => (
                  <button
                    key={product.productId}
                    type="button"
                    className={selectedProduct?.productId === product.productId ? "product-option selected" : "product-option"}
                    onClick={() => setSelectedProductCode(product.productCode || product.productId)}
                  >
                    <img src={product.primaryImage || selectedFamily.image} alt={product.imageAltText || product.productName} />
                    <strong>{product.productName}</strong>
                    <small>{product.supplier} / {product.brand}</small>
                    <small>{product.range} / {product.colour || product.finish || product.size}</small>
                    <span>{money(product.clientPrice || product.builderCost)}</span>
                  </button>
                ))}
              </div>

              {!visibleProducts.length ? (
                <div className="empty-state">
                  <strong>No products have been added for this category yet.</strong>
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
                  <img src={selectedProduct.primaryImage || selectedFamily.image} alt={selectedProduct.imageAltText || selectedProduct.productName} />
                  <h3>{selectedProduct.productName}</h3>
                  <p>{selectedProduct.description}</p>
                  <div className="swatches">
                    {(selectedProduct.colourSwatches?.length ? selectedProduct.colourSwatches : [selectedProduct.colour, selectedProduct.finish].filter(Boolean)).map((swatch) => (
                      <span key={swatch}>{swatch}</span>
                    ))}
                  </div>
                  <button type="button" onClick={() => addToSelection(selectedProduct)}><Check size={16} /> Add to Selections</button>
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
                <button type="button" onClick={() => setProductForm(EMPTY_PRODUCT)}><Plus size={16} /> Add Product</button>
                <button type="button" onClick={() => setSuccess("Add Supplier: enter supplier_name in the import CSV or save a product with a new supplier.")}>Add Supplier</button>
                <button type="button" onClick={() => setSuccess("Add Brand: enter brand in the import CSV or save a product with a new brand.")}>Add Brand</button>
                <button type="button" onClick={() => setSuccess("Add Range: enter range on a product or import row.")}>Add Range</button>
                <button type="button" onClick={() => setSuccess("Add Variant: enter colour, finish, size or variant_name in the import CSV.")}>Add Variant</button>
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
                    <strong>Add Product to {selectedFamily.displayName}</strong>
                  </div>
                  <div className="form-grid">
                    <input value={productForm.product_code} onChange={(event) => setProductForm((current) => ({ ...current, product_code: event.target.value }))} placeholder="product_code" required />
                    <input value={productForm.product_name} onChange={(event) => setProductForm((current) => ({ ...current, product_name: event.target.value }))} placeholder="product_name" required />
                    <input value={productForm.supplier_name} onChange={(event) => setProductForm((current) => ({ ...current, supplier_name: event.target.value }))} placeholder="supplier_name" />
                    <input value={productForm.brand} onChange={(event) => setProductForm((current) => ({ ...current, brand: event.target.value }))} placeholder="brand" />
                    <input value={productForm.range} onChange={(event) => setProductForm((current) => ({ ...current, range: event.target.value }))} placeholder="range" />
                    <input value={productForm.model} onChange={(event) => setProductForm((current) => ({ ...current, model: event.target.value }))} placeholder="model" />
                    <input value={productForm.colour} onChange={(event) => setProductForm((current) => ({ ...current, colour: event.target.value }))} placeholder="colour" />
                    <input value={productForm.finish} onChange={(event) => setProductForm((current) => ({ ...current, finish: event.target.value }))} placeholder="finish" />
                    <input value={productForm.size} onChange={(event) => setProductForm((current) => ({ ...current, size: event.target.value }))} placeholder="size" />
                    <input value={productForm.primary_image} onChange={(event) => setProductForm((current) => ({ ...current, primary_image: event.target.value }))} placeholder="primary_image" />
                    <input value={productForm.official_product_url} onChange={(event) => setProductForm((current) => ({ ...current, official_product_url: event.target.value }))} placeholder="official_product_url" />
                    <input value={productForm.specification_url} onChange={(event) => setProductForm((current) => ({ ...current, specification_url: event.target.value }))} placeholder="specification_url" />
                    <input value={productForm.builder_cost} onChange={(event) => setProductForm((current) => ({ ...current, builder_cost: event.target.value }))} placeholder="builder_cost" />
                    <input value={productForm.client_price} onChange={(event) => setProductForm((current) => ({ ...current, client_price: event.target.value }))} placeholder="client_price" />
                  </div>
                  <button type="submit" disabled={saving || !workspaceId}><ImagePlus size={16} /> Save Product</button>
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
                  <p>{importPreview.preview.length} rows previewed. {importPreview.preview.filter((row) => row.errors.length).length} row-level error(s).</p>
                  <div className="preview-list">
                    {importPreview.preview.slice(0, 12).map((row) => (
                      <div key={row.rowNumber} className={row.errors.length ? "preview-row error" : "preview-row"}>
                        <strong>Row {row.rowNumber}</strong>
                        <span>{row.record.product_name || "Unnamed product"}</span>
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
        .preview-list {
          display: grid;
          gap: 8px;
        }
        .preview-row {
          display: grid;
          grid-template-columns: 90px minmax(0, 1fr) minmax(120px, auto);
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
          .product-flow {
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
          .preview-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
