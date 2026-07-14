import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../utils/supabase-client";

const PRICE_BANDS = [
  { value: "budget", label: "Budget" },
  { value: "mid_range", label: "Mid Range" },
  { value: "higher_end", label: "Higher End" },
  { value: "luxury", label: "Luxury" },
];

const EMPTY_PRODUCT = {
  product_name: "",
  category_id: "",
  manufacturer_id: "",
  supplier_id: "",
  quote_structure_section: "",
  quote_structure_item: "",
  quote_structure_row_id: "",
  selection_type: "",
  sku: "",
  model: "",
  description: "",
  price_band: "mid_range",
  standard_included: false,
  base_allowance: "",
  upgrade_cost: "",
  primary_image_url: "",
  datasheet_pdf_url: "",
  warranty_document_url: "",
  product_url: "",
  notes: "",
  active: true,
};

const PRODUCT_CSV_HEADERS = [
  "quote_structure_section",
  "quote_structure_item",
  "quote_structure_row_id",
  "selection_type",
  "product_name",
  "category",
  "manufacturer",
  "supplier",
  "sku",
  "model",
  "description",
  "price_band",
  "base_allowance",
  "upgrade_cost",
  "primary_image_url",
  "product_url",
  "datasheet_pdf_url",
  "warranty_document_url",
  "standard_included",
  "active",
  "notes",
];

const EMPTY_CATEGORY = {
  category_name: "",
  description: "",
};

const EMPTY_MANUFACTURER = {
  manufacturer_name: "",
  website_url: "",
};

const EMPTY_SUPPLIER = {
  supplier_name: "",
  contact_name: "",
  email: "",
  phone: "",
  website_url: "",
};

const EMPTY_IMAGE = {
  image_url: "",
  alt_text: "",
  is_primary: true,
};

function money(value) {
  return Number(value || 0).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeMoney(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function csvCell(input) {
  const text = String(input ?? "");
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
  const headers = rows[0].map((header) => slugify(header));
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function truthyCsv(value, fallback = false) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  return ["1", "true", "yes", "y", "included", "active"].includes(text);
}

function normalizePriceBand(value) {
  const key = slugify(value);
  return PRICE_BANDS.some((band) => band.value === key) ? key : "mid_range";
}

export default function BuilderProductLibraryPage() {
  const { workspaceId, activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const [categories, setCategories] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [images, setImages] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY);
  const [manufacturerForm, setManufacturerForm] = useState(EMPTY_MANUFACTURER);
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER);
  const [imageForm, setImageForm] = useState(EMPTY_IMAGE);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priceBandFilter, setPriceBandFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("active");
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category.category_name])), [categories]);
  const manufacturerById = useMemo(
    () => new Map(manufacturers.map((manufacturer) => [manufacturer.id, manufacturer.manufacturer_name])),
    [manufacturers]
  );
  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier.supplier_name])), [suppliers]);

  const primaryImageByProduct = useMemo(() => {
    const map = new Map();
    images.forEach((image) => {
      const existing = map.get(image.product_id);
      if (!existing || image.is_primary || image.sort_order < existing.sort_order) {
        map.set(image.product_id, image);
      }
    });
    return map;
  }, [images]);

  const selectedProductImages = useMemo(
    () => images.filter((image) => image.product_id === selectedProductId),
    [images, selectedProductId]
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        !term ||
        [product.product_name, product.sku, product.model, product.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesCategory = categoryFilter === "all" || product.category_id === categoryFilter;
      const matchesPriceBand = priceBandFilter === "all" || product.price_band === priceBandFilter;
      const matchesActive =
        activeFilter === "all" ||
        (activeFilter === "active" && product.active !== false) ||
        (activeFilter === "inactive" && product.active === false);
      return matchesSearch && matchesCategory && matchesPriceBand && matchesActive;
    });
  }, [products, search, categoryFilter, priceBandFilter, activeFilter]);

  useEffect(() => {
    if (!workspaceId) return;
    loadLibrary();
  }, [workspaceId]);

  useEffect(() => {
    if (!selectedProduct) {
      setProductForm(EMPTY_PRODUCT);
      return;
    }

    setProductForm({
      product_name: selectedProduct.product_name || "",
      category_id: selectedProduct.category_id || "",
      manufacturer_id: selectedProduct.manufacturer_id || "",
      supplier_id: selectedProduct.supplier_id || "",
      quote_structure_section: selectedProduct.quote_structure_section || selectedProduct.source_quote_section || "",
      quote_structure_item: selectedProduct.quote_structure_item || selectedProduct.source_quote_item_name || "",
      quote_structure_row_id: selectedProduct.quote_structure_row_id || selectedProduct.source_quote_row_id || "",
      selection_type: selectedProduct.selection_type || "",
      sku: selectedProduct.sku || "",
      model: selectedProduct.model || "",
      description: selectedProduct.description || "",
      price_band: selectedProduct.price_band || "mid_range",
      standard_included: Boolean(selectedProduct.standard_included),
      base_allowance: selectedProduct.base_allowance ?? "",
      upgrade_cost: selectedProduct.upgrade_cost ?? "",
      primary_image_url: selectedProduct.primary_image_url || "",
      datasheet_pdf_url: selectedProduct.datasheet_pdf_url || "",
      warranty_document_url: selectedProduct.warranty_document_url || "",
      product_url: selectedProduct.product_url || "",
      notes: selectedProduct.notes || "",
      active: selectedProduct.active !== false,
    });
  }, [selectedProduct]);

  async function loadLibrary() {
    setLoading(true);
    setError("");

    const [categoryResult, manufacturerResult, supplierResult, productResult] = await Promise.all([
      supabase
        .from("builder_product_categories")
        .select("*")
        .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
        .order("sort_order", { ascending: true })
        .order("category_name", { ascending: true }),
      supabase
        .from("builder_product_manufacturers")
        .select("*")
        .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
        .order("manufacturer_name", { ascending: true }),
      supabase
        .from("builder_product_suppliers")
        .select("*")
        .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
        .order("supplier_name", { ascending: true }),
      supabase
        .from("builder_products")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false }),
    ]);

    if (categoryResult.error || manufacturerResult.error || supplierResult.error || productResult.error) {
      setError(
        categoryResult.error?.message ||
          manufacturerResult.error?.message ||
          supplierResult.error?.message ||
          productResult.error?.message ||
          "Could not load the Product Library."
      );
      setLoading(false);
      return;
    }

    const productRows = productResult.data || [];
    setCategories(categoryResult.data || []);
    setManufacturers(manufacturerResult.data || []);
    setSuppliers(supplierResult.data || []);
    setProducts(productRows);
    setSelectedProductId((current) => productRows.find((product) => product.id === current)?.id || productRows[0]?.id || "");

    if (productRows.length) {
      const { data, error: imageError } = await supabase
        .from("builder_product_images")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("product_id", productRows.map((product) => product.id))
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (imageError) setError(imageError.message || "Could not load product images.");
      setImages(data || []);
    } else {
      setImages([]);
    }

    setLoading(false);
  }

  function updateProduct(field, value) {
    setProductForm((current) => ({ ...current, [field]: value }));
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (!workspaceId) {
      setError("Select a workspace before saving products.");
      return;
    }
    if (!productForm.product_name.trim()) {
      setError("Product Name is required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      workspace_id: workspaceId,
      product_name: productForm.product_name.trim(),
      category_id: productForm.category_id || null,
      manufacturer_id: productForm.manufacturer_id || null,
      supplier_id: productForm.supplier_id || null,
      quote_structure_section: productForm.quote_structure_section.trim() || null,
      quote_structure_item: productForm.quote_structure_item.trim() || null,
      quote_structure_row_id: productForm.quote_structure_row_id.trim() || null,
      selection_type: productForm.selection_type.trim() || null,
      source_quote_section: productForm.quote_structure_section.trim() || null,
      source_quote_item_name: productForm.quote_structure_item.trim() || null,
      source_quote_row_id: productForm.quote_structure_row_id.trim() || null,
      sku: productForm.sku.trim() || null,
      model: productForm.model.trim() || null,
      description: productForm.description.trim() || null,
      price_band: productForm.price_band || "mid_range",
      standard_included: Boolean(productForm.standard_included),
      base_allowance: normalizeMoney(productForm.base_allowance),
      upgrade_cost: normalizeMoney(productForm.upgrade_cost),
      primary_image_url: productForm.primary_image_url.trim() || null,
      datasheet_pdf_url: productForm.datasheet_pdf_url.trim() || null,
      warranty_document_url: productForm.warranty_document_url.trim() || null,
      product_url: productForm.product_url.trim() || null,
      notes: productForm.notes.trim() || null,
      active: Boolean(productForm.active),
      updated_at: new Date().toISOString(),
    };

    const request = selectedProductId
      ? supabase.from("builder_products").update(payload).eq("workspace_id", workspaceId).eq("id", selectedProductId).select("*").single()
      : supabase.from("builder_products").insert(payload).select("*").single();

    const { data, error: saveError } = await request;
    if (saveError) {
      setError(saveError.message || "Could not save product.");
    } else {
      if (payload.primary_image_url) await savePrimaryImage(data.id, payload.primary_image_url, data.product_name);
      await loadLibrary();
      setSelectedProductId(data.id);
      setSuccess(`Saved ${data.product_name}.`);
    }
    setSaving(false);
  }

  async function savePrimaryImage(productId, imageUrl, altText) {
    if (!workspaceId || !productId || !imageUrl) return;
    await supabase
      .from("builder_product_images")
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("product_id", productId);

    const { data: existing } = await supabase
      .from("builder_product_images")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("product_id", productId)
      .eq("image_url", imageUrl)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("builder_product_images")
        .update({ alt_text: altText, is_primary: true, active: true, updated_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .eq("id", existing.id);
      return;
    }

    await supabase.from("builder_product_images").insert({
      workspace_id: workspaceId,
      product_id: productId,
      image_url: imageUrl,
      alt_text: altText,
      is_primary: true,
      active: true,
      sort_order: 1,
    });
  }

  async function createCategory(event) {
    event.preventDefault();
    if (!workspaceId || !categoryForm.category_name.trim()) return;
    setSaving(true);
    const { data, error: createError } = await supabase
      .from("builder_product_categories")
      .insert({
        workspace_id: workspaceId,
        category_key: slugify(categoryForm.category_name),
        category_name: categoryForm.category_name.trim(),
        description: categoryForm.description.trim() || null,
        active: true,
        sort_order: categories.length + 1,
      })
      .select("*")
      .single();
    if (createError) setError(createError.message || "Could not create category.");
    else {
      setCategories((current) => [...current, data].sort((a, b) => a.category_name.localeCompare(b.category_name)));
      setCategoryForm(EMPTY_CATEGORY);
      setProductForm((current) => ({ ...current, category_id: data.id }));
      setSuccess(`Created category ${data.category_name}.`);
    }
    setSaving(false);
  }

  async function createManufacturer(event) {
    event.preventDefault();
    if (!workspaceId || !manufacturerForm.manufacturer_name.trim()) return;
    setSaving(true);
    const { data, error: createError } = await supabase
      .from("builder_product_manufacturers")
      .insert({
        workspace_id: workspaceId,
        manufacturer_name: manufacturerForm.manufacturer_name.trim(),
        website_url: manufacturerForm.website_url.trim() || null,
        active: true,
      })
      .select("*")
      .single();
    if (createError) setError(createError.message || "Could not create manufacturer.");
    else {
      setManufacturers((current) => [...current, data].sort((a, b) => a.manufacturer_name.localeCompare(b.manufacturer_name)));
      setManufacturerForm(EMPTY_MANUFACTURER);
      setProductForm((current) => ({ ...current, manufacturer_id: data.id }));
      setSuccess(`Created manufacturer ${data.manufacturer_name}.`);
    }
    setSaving(false);
  }

  async function createSupplier(event) {
    event.preventDefault();
    if (!workspaceId || !supplierForm.supplier_name.trim()) return;
    setSaving(true);
    const { data, error: createError } = await supabase
      .from("builder_product_suppliers")
      .insert({
        workspace_id: workspaceId,
        supplier_name: supplierForm.supplier_name.trim(),
        contact_name: supplierForm.contact_name.trim() || null,
        email: supplierForm.email.trim() || null,
        phone: supplierForm.phone.trim() || null,
        website_url: supplierForm.website_url.trim() || null,
        active: true,
      })
      .select("*")
      .single();
    if (createError) setError(createError.message || "Could not create supplier.");
    else {
      setSuppliers((current) => [...current, data].sort((a, b) => a.supplier_name.localeCompare(b.supplier_name)));
      setSupplierForm(EMPTY_SUPPLIER);
      setProductForm((current) => ({ ...current, supplier_id: data.id }));
      setSuccess(`Created supplier ${data.supplier_name}.`);
    }
    setSaving(false);
  }

  async function ensureCategory(name, cache) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return null;
    const key = slugify(cleanName);
    const cached = cache.get(key);
    if (cached) return cached.id;
    const existing = categories.find((category) => slugify(category.category_name) === key);
    if (existing) {
      cache.set(key, existing);
      return existing.id;
    }
    const { data, error: createError } = await supabase
      .from("builder_product_categories")
      .insert({
        workspace_id: workspaceId,
        category_key: key,
        category_name: cleanName,
        active: true,
        sort_order: categories.length + cache.size + 1,
      })
      .select("*")
      .single();
    if (createError) throw createError;
    cache.set(key, data);
    return data.id;
  }

  async function ensureManufacturer(name, cache) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return null;
    const key = slugify(cleanName);
    const cached = cache.get(key);
    if (cached) return cached.id;
    const existing = manufacturers.find((manufacturer) => slugify(manufacturer.manufacturer_name) === key);
    if (existing) {
      cache.set(key, existing);
      return existing.id;
    }
    const { data, error: createError } = await supabase
      .from("builder_product_manufacturers")
      .insert({ workspace_id: workspaceId, manufacturer_name: cleanName, active: true })
      .select("*")
      .single();
    if (createError) throw createError;
    cache.set(key, data);
    return data.id;
  }

  async function ensureSupplier(name, cache) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return null;
    const key = slugify(cleanName);
    const cached = cache.get(key);
    if (cached) return cached.id;
    const existing = suppliers.find((supplier) => slugify(supplier.supplier_name) === key);
    if (existing) {
      cache.set(key, existing);
      return existing.id;
    }
    const { data, error: createError } = await supabase
      .from("builder_product_suppliers")
      .insert({ workspace_id: workspaceId, supplier_name: cleanName, active: true })
      .select("*")
      .single();
    if (createError) throw createError;
    cache.set(key, data);
    return data.id;
  }

  function exportTemplateCsv() {
    downloadCsv("product-library-import-template.csv", [
      PRODUCT_CSV_HEADERS,
      [
        "Kitchen",
        "Oven",
        "quote-oven-001",
        "product_selection",
        "Westinghouse WVE6314DD",
        "Appliances",
        "Westinghouse",
        "Harvey Norman Commercial",
        "",
        "WVE6314DD",
        "60cm built-in oven",
        "mid_range",
        "0",
        "0",
        "",
        "",
        "",
        "",
        "yes",
        "yes",
        "Example only. Delete this row before importing real supplier data.",
      ],
    ]);
  }

  function exportProductsCsv() {
    const rows = products.map((product) => [
      product.quote_structure_section || product.source_quote_section || "",
      product.quote_structure_item || product.source_quote_item_name || "",
      product.quote_structure_row_id || product.source_quote_row_id || "",
      product.selection_type || "",
      product.product_name || "",
      categoryById.get(product.category_id) || "",
      manufacturerById.get(product.manufacturer_id) || "",
      supplierById.get(product.supplier_id) || "",
      product.sku || "",
      product.model || "",
      product.description || "",
      product.price_band || "mid_range",
      product.base_allowance ?? "",
      product.upgrade_cost ?? "",
      product.primary_image_url || "",
      product.product_url || "",
      product.datasheet_pdf_url || "",
      product.warranty_document_url || "",
      product.standard_included ? "yes" : "no",
      product.active === false ? "no" : "yes",
      product.notes || "",
    ]);
    downloadCsv("builder-product-library.csv", [PRODUCT_CSV_HEADERS, ...rows]);
  }

  async function importProductsCsv(event) {
    event.preventDefault();
    if (!workspaceId || !importFile) return;
    setImporting(true);
    setError("");
    setSuccess("");

    try {
      const records = csvRecords(await importFile.text()).filter((record) => String(record.product_name || "").trim());
      if (!records.length) throw new Error("No product rows found in the CSV.");

      const categoryCache = new Map();
      const manufacturerCache = new Map();
      const supplierCache = new Map();
      const productByIdentity = new Map(
        products.map((product) => [
          [product.sku, product.model, product.product_name, product.source_quote_row_id || product.quote_structure_row_id]
            .map((value) => slugify(value))
            .join("|"),
          product,
        ])
      );
      let created = 0;
      let updated = 0;

      const { data: batch } = await supabase
        .from("builder_product_import_batches")
        .insert({
          workspace_id: workspaceId,
          source_name: importFile.name,
          source_type: "csv",
          file_name: importFile.name,
          imported_count: records.length,
          status: "processing",
        })
        .select("*")
        .single();

      for (const record of records) {
        const categoryId = await ensureCategory(record.category || record.quote_structure_section, categoryCache);
        const manufacturerId = await ensureManufacturer(record.manufacturer, manufacturerCache);
        const supplierId = await ensureSupplier(record.supplier, supplierCache);
        const quoteSection = String(record.quote_structure_section || record.source_quote_section || "").trim();
        const quoteItem = String(record.quote_structure_item || record.source_quote_item_name || "").trim();
        const quoteRowId = String(record.quote_structure_row_id || record.source_quote_row_id || "").trim();
        const payload = {
          workspace_id: workspaceId,
          category_id: categoryId,
          manufacturer_id: manufacturerId,
          supplier_id: supplierId,
          quote_structure_section: quoteSection || null,
          quote_structure_item: quoteItem || null,
          quote_structure_row_id: quoteRowId || null,
          selection_type: String(record.selection_type || "").trim() || null,
          source_quote_section: quoteSection || null,
          source_quote_item_name: quoteItem || null,
          source_quote_row_id: quoteRowId || null,
          product_name: String(record.product_name || "").trim(),
          sku: String(record.sku || "").trim() || null,
          model: String(record.model || "").trim() || null,
          description: String(record.description || "").trim() || null,
          price_band: normalizePriceBand(record.price_band),
          standard_included: truthyCsv(record.standard_included, false),
          base_allowance: normalizeMoney(record.base_allowance),
          upgrade_cost: normalizeMoney(record.upgrade_cost),
          primary_image_url: String(record.primary_image_url || "").trim() || null,
          datasheet_pdf_url: String(record.datasheet_pdf_url || "").trim() || null,
          warranty_document_url: String(record.warranty_document_url || "").trim() || null,
          product_url: String(record.product_url || "").trim() || null,
          notes: String(record.notes || "").trim() || null,
          active: truthyCsv(record.active, true),
          source_type: "csv",
          source_workbook_metadata: {
            quote_structure_section: quoteSection,
            quote_structure_item: quoteItem,
            quote_structure_row_id: quoteRowId,
            import_file_name: importFile.name,
          },
          updated_at: new Date().toISOString(),
        };
        const identity = [payload.sku, payload.model, payload.product_name, quoteRowId].map((value) => slugify(value)).join("|");
        const existing = productByIdentity.get(identity);
        const request = existing?.id
          ? supabase.from("builder_products").update(payload).eq("workspace_id", workspaceId).eq("id", existing.id).select("*").single()
          : supabase.from("builder_products").insert(payload).select("*").single();
        const { data, error: importError } = await request;
        if (importError) throw importError;
        if (existing?.id) updated += 1;
        else created += 1;
        productByIdentity.set(identity, data);
        if (payload.primary_image_url) await savePrimaryImage(data.id, payload.primary_image_url, data.product_name);
      }

      if (batch?.id) {
        await supabase
          .from("builder_product_import_batches")
          .update({ created_count: created, updated_count: updated, status: "completed" })
          .eq("workspace_id", workspaceId)
          .eq("id", batch.id);
      }
      setImportFile(null);
      await loadLibrary();
      setSuccess(`Imported ${records.length} products. Created ${created}, updated ${updated}.`);
    } catch (importError) {
      setError(importError?.message || "Could not import products.");
    }
    setImporting(false);
  }

  async function addImage(event) {
    event.preventDefault();
    if (!workspaceId || !selectedProductId || !imageForm.image_url.trim()) return;
    setSaving(true);
    setError("");
    if (imageForm.is_primary) {
      await supabase
        .from("builder_product_images")
        .update({ is_primary: false, updated_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .eq("product_id", selectedProductId);
    }
    const { data, error: imageError } = await supabase
      .from("builder_product_images")
      .insert({
        workspace_id: workspaceId,
        product_id: selectedProductId,
        image_url: imageForm.image_url.trim(),
        alt_text: imageForm.alt_text.trim() || selectedProduct?.product_name || "Product image",
        is_primary: Boolean(imageForm.is_primary),
        active: true,
        sort_order: selectedProductImages.length + 1,
      })
      .select("*")
      .single();
    if (imageError) setError(imageError.message || "Could not add image.");
    else {
      if (imageForm.is_primary) {
        await supabase
          .from("builder_products")
          .update({ primary_image_url: data.image_url, updated_at: new Date().toISOString() })
          .eq("workspace_id", workspaceId)
          .eq("id", selectedProductId);
      }
      setImageForm(EMPTY_IMAGE);
      await loadLibrary();
      setSuccess("Image added.");
    }
    setSaving(false);
  }

  async function deactivateProduct(productId) {
    if (!workspaceId || !productId) return;
    setSaving(true);
    const { error: updateError } = await supabase
      .from("builder_products")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("id", productId);
    if (updateError) setError(updateError.message || "Could not deactivate product.");
    else {
      await loadLibrary();
      setSuccess("Product deactivated.");
    }
    setSaving(false);
  }

  return (
    <>
      <Head>
        <title>Builder Product Library | Gr8 Result</title>
      </Head>

      <main className="page">
        <header className="hero">
          <div>
            <p className="eyebrow">Builders Platform</p>
            <h1>Builder Product Library</h1>
            <p>
              Separate catalogue of selectable products. Each product can reference one Quote Structure item while the Quote
              Structure remains the master estimate order.
            </p>
          </div>
          <div className="hero-actions">
            <button type="button" onClick={exportTemplateCsv}>
              CSV Template
            </button>
            <button type="button" onClick={exportProductsCsv} disabled={!products.length}>
              Export Products CSV
            </button>
            <button type="button" onClick={loadLibrary} disabled={!workspaceId || loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </header>

        <section className="stats">
          <div>
            <span>Workspace</span>
            <strong>{workspaceLoading ? "Loading..." : activeWorkspace?.name || "No workspace"}</strong>
          </div>
          <div>
            <span>Products</span>
            <strong>{products.length}</strong>
          </div>
          <div>
            <span>Categories</span>
            <strong>{categories.length}</strong>
          </div>
          <div>
            <span>Standard Included</span>
            <strong>{products.filter((product) => product.standard_included).length}</strong>
          </div>
        </section>

        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        <section className="panel import-panel">
          <div>
            <p className="eyebrow">Supplier Import</p>
            <h2>Import Product Library CSV</h2>
            <p>
              Import products from supplier CSVs and map each row back to a Quote Structure section/item/row reference.
            </p>
          </div>
          <form className="import-form" onSubmit={importProductsCsv}>
            <input type="file" accept=".csv,text/csv" onChange={(event) => setImportFile(event.target.files?.[0] || null)} />
            <button type="submit" disabled={!workspaceId || !importFile || importing}>
              {importing ? "Importing..." : "Import Products"}
            </button>
          </form>
        </section>

        <section className="layout">
          <aside className="panel catalogue">
            <div className="panel-title">
              <h2>Products</h2>
              <button
                type="button"
                className="small"
                onClick={() => {
                  setSelectedProductId("");
                  setProductForm(EMPTY_PRODUCT);
                }}
              >
                New
              </button>
            </div>
            <div className="filters">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." />
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.category_name}
                  </option>
                ))}
              </select>
              <select value={priceBandFilter} onChange={(event) => setPriceBandFilter(event.target.value)}>
                <option value="all">All price bands</option>
                {PRICE_BANDS.map((band) => (
                  <option key={band.value} value={band.value}>
                    {band.label}
                  </option>
                ))}
              </select>
              <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="all">All</option>
              </select>
            </div>

            <div className="product-list">
              {filteredProducts.map((product) => {
                const imageUrl = primaryImageByProduct.get(product.id)?.image_url || product.primary_image_url;
                return (
                  <button
                    key={product.id}
                    type="button"
                    className={selectedProductId === product.id ? "product-card selected" : "product-card"}
                    onClick={() => setSelectedProductId(product.id)}
                  >
                    <span className="thumb">{imageUrl ? <img src={imageUrl} alt={product.product_name} /> : "No image"}</span>
                    <span>
                      <strong>{product.product_name}</strong>
                      <small>{categoryById.get(product.category_id) || "Uncategorised"}</small>
                      <small>{manufacturerById.get(product.manufacturer_id) || "No manufacturer"} · {product.model || "No model"}</small>
                    </span>
                  </button>
                );
              })}
              {!filteredProducts.length && <p className="empty">No products yet. Create the first product when you are ready.</p>}
            </div>
          </aside>

          <section className="main-column">
            <form className="panel form" onSubmit={saveProduct}>
              <div className="panel-title">
                <div>
                  <p className="eyebrow">Product Record</p>
                  <h2>{selectedProduct ? "Edit Product" : "New Product"}</h2>
                </div>
                <div className="actions">
                  {selectedProduct && selectedProduct.active !== false && (
                    <button type="button" className="danger" onClick={() => deactivateProduct(selectedProduct.id)} disabled={saving}>
                      Deactivate
                    </button>
                  )}
                  <button type="submit" disabled={saving || !workspaceId}>
                    {saving ? "Saving..." : "Save Product"}
                  </button>
                </div>
              </div>

              <div className="grid two">
                <label>
                  Quote Structure Section
                  <input
                    value={productForm.quote_structure_section}
                    onChange={(event) => updateProduct("quote_structure_section", event.target.value)}
                    placeholder="Kitchen"
                  />
                </label>
                <label>
                  Quote Structure Item
                  <input
                    value={productForm.quote_structure_item}
                    onChange={(event) => updateProduct("quote_structure_item", event.target.value)}
                    placeholder="Oven"
                  />
                </label>
                <label>
                  Quote Structure Row ID
                  <input
                    value={productForm.quote_structure_row_id}
                    onChange={(event) => updateProduct("quote_structure_row_id", event.target.value)}
                    placeholder="quote row id from master CSV"
                  />
                </label>
                <label>
                  Selection Type
                  <input
                    value={productForm.selection_type}
                    onChange={(event) => updateProduct("selection_type", event.target.value)}
                    placeholder="appliance, finish, fixture..."
                  />
                </label>
                <label>
                  Product Name
                  <input value={productForm.product_name} onChange={(event) => updateProduct("product_name", event.target.value)} required />
                </label>
                <label>
                  Category
                  <select value={productForm.category_id} onChange={(event) => updateProduct("category_id", event.target.value)}>
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.category_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Manufacturer
                  <select value={productForm.manufacturer_id} onChange={(event) => updateProduct("manufacturer_id", event.target.value)}>
                    <option value="">Select manufacturer</option>
                    {manufacturers.map((manufacturer) => (
                      <option key={manufacturer.id} value={manufacturer.id}>
                        {manufacturer.manufacturer_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Supplier
                  <select value={productForm.supplier_id} onChange={(event) => updateProduct("supplier_id", event.target.value)}>
                    <option value="">Select supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.supplier_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  SKU
                  <input value={productForm.sku} onChange={(event) => updateProduct("sku", event.target.value)} />
                </label>
                <label>
                  Model
                  <input value={productForm.model} onChange={(event) => updateProduct("model", event.target.value)} />
                </label>
              </div>

              <label>
                Description
                <textarea value={productForm.description} onChange={(event) => updateProduct("description", event.target.value)} rows={4} />
              </label>

              <div className="grid three">
                <label>
                  Price Band
                  <select value={productForm.price_band} onChange={(event) => updateProduct("price_band", event.target.value)}>
                    {PRICE_BANDS.map((band) => (
                      <option key={band.value} value={band.value}>
                        {band.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Base Allowance
                  <input type="number" step="0.01" value={productForm.base_allowance} onChange={(event) => updateProduct("base_allowance", event.target.value)} />
                </label>
                <label>
                  Upgrade Cost
                  <input type="number" step="0.01" value={productForm.upgrade_cost} onChange={(event) => updateProduct("upgrade_cost", event.target.value)} />
                </label>
              </div>

              <div className="grid two">
                <label>
                  Primary Image URL
                  <input value={productForm.primary_image_url} onChange={(event) => updateProduct("primary_image_url", event.target.value)} />
                </label>
                <label>
                  Product URL
                  <input value={productForm.product_url} onChange={(event) => updateProduct("product_url", event.target.value)} />
                </label>
                <label>
                  Datasheet URL
                  <input value={productForm.datasheet_pdf_url} onChange={(event) => updateProduct("datasheet_pdf_url", event.target.value)} />
                </label>
                <label>
                  Warranty URL
                  <input value={productForm.warranty_document_url} onChange={(event) => updateProduct("warranty_document_url", event.target.value)} />
                </label>
              </div>

              <label>
                Notes
                <textarea value={productForm.notes} onChange={(event) => updateProduct("notes", event.target.value)} rows={3} />
              </label>

              <div className="switch-row">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={productForm.standard_included}
                    onChange={(event) => updateProduct("standard_included", event.target.checked)}
                  />
                  Standard Included
                </label>
                <label className="check">
                  <input type="checkbox" checked={productForm.active} onChange={(event) => updateProduct("active", event.target.checked)} />
                  Active
                </label>
              </div>
            </form>

            <section className="panel image-panel">
              <div className="panel-title">
                <div>
                  <p className="eyebrow">Images</p>
                  <h2>Product Images</h2>
                </div>
              </div>
              <form className="image-form" onSubmit={addImage}>
                <input value={imageForm.image_url} onChange={(event) => setImageForm((current) => ({ ...current, image_url: event.target.value }))} placeholder="Image URL" />
                <input value={imageForm.alt_text} onChange={(event) => setImageForm((current) => ({ ...current, alt_text: event.target.value }))} placeholder="Alt text" />
                <label className="check">
                  <input
                    type="checkbox"
                    checked={imageForm.is_primary}
                    onChange={(event) => setImageForm((current) => ({ ...current, is_primary: event.target.checked }))}
                  />
                  Primary
                </label>
                <button type="submit" disabled={!selectedProductId || !imageForm.image_url.trim() || saving}>
                  Add Image
                </button>
              </form>
              <div className="image-grid">
                {selectedProductImages.map((image) => (
                  <div key={image.id} className="image-card">
                    <img src={image.image_url} alt={image.alt_text || "Product image"} />
                    <span>{image.is_primary ? "Primary image" : "Gallery image"}</span>
                  </div>
                ))}
                {!selectedProductImages.length && <p className="empty">Save a product, then add images.</p>}
              </div>
            </section>
          </section>

          <aside className="panel side">
            <h2>Foundation Records</h2>
            <form onSubmit={createCategory} className="mini-form">
              <h3>Category</h3>
              <input value={categoryForm.category_name} onChange={(event) => setCategoryForm((current) => ({ ...current, category_name: event.target.value }))} placeholder="Category name" />
              <input value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" />
              <button type="submit" disabled={saving || !categoryForm.category_name.trim()}>
                Add Category
              </button>
            </form>

            <form onSubmit={createManufacturer} className="mini-form">
              <h3>Manufacturer</h3>
              <input value={manufacturerForm.manufacturer_name} onChange={(event) => setManufacturerForm((current) => ({ ...current, manufacturer_name: event.target.value }))} placeholder="Manufacturer name" />
              <input value={manufacturerForm.website_url} onChange={(event) => setManufacturerForm((current) => ({ ...current, website_url: event.target.value }))} placeholder="Website URL" />
              <button type="submit" disabled={saving || !manufacturerForm.manufacturer_name.trim()}>
                Add Manufacturer
              </button>
            </form>

            <form onSubmit={createSupplier} className="mini-form">
              <h3>Supplier</h3>
              <input value={supplierForm.supplier_name} onChange={(event) => setSupplierForm((current) => ({ ...current, supplier_name: event.target.value }))} placeholder="Supplier name" />
              <input value={supplierForm.contact_name} onChange={(event) => setSupplierForm((current) => ({ ...current, contact_name: event.target.value }))} placeholder="Contact name" />
              <input value={supplierForm.email} onChange={(event) => setSupplierForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" />
              <input value={supplierForm.phone} onChange={(event) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" />
              <input value={supplierForm.website_url} onChange={(event) => setSupplierForm((current) => ({ ...current, website_url: event.target.value }))} placeholder="Website URL" />
              <button type="submit" disabled={saving || !supplierForm.supplier_name.trim()}>
                Add Supplier
              </button>
            </form>

            {selectedProduct && (
              <div className="summary">
                <h3>Selected Product</h3>
                <dl>
                  <dt>Category</dt>
                  <dd>{categoryById.get(selectedProduct.category_id) || "Not set"}</dd>
                  <dt>Manufacturer</dt>
                  <dd>{manufacturerById.get(selectedProduct.manufacturer_id) || "Not set"}</dd>
                  <dt>Supplier</dt>
                  <dd>{supplierById.get(selectedProduct.supplier_id) || "Not set"}</dd>
                  <dt>Quote Item</dt>
                  <dd>{selectedProduct.quote_structure_item || selectedProduct.source_quote_item_name || "Not linked"}</dd>
                  <dt>Base Allowance</dt>
                  <dd>{money(selectedProduct.base_allowance)}</dd>
                  <dt>Upgrade Cost</dt>
                  <dd>{money(selectedProduct.upgrade_cost)}</dd>
                </dl>
              </div>
            )}
          </aside>
        </section>
      </main>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #07111f;
          color: #e5eefb;
          padding: 24px;
        }
        .hero,
        .stats,
        .panel,
        .alert {
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(15, 23, 42, 0.92);
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.22);
        }
        .hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          border-radius: 10px;
          padding: 22px;
        }
        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 10px;
        }
        .eyebrow {
          margin: 0 0 6px;
          color: #38bdf8;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        h1,
        h2,
        h3,
        p {
          margin-top: 0;
        }
        h1 {
          margin-bottom: 8px;
          font-size: 30px;
        }
        h2 {
          margin-bottom: 0;
          font-size: 20px;
        }
        h3 {
          margin-bottom: 10px;
          font-size: 15px;
        }
        .hero p {
          max-width: 780px;
          margin-bottom: 0;
          color: #a8bbd4;
        }
        button {
          border: 0;
          border-radius: 8px;
          background: #2563eb;
          color: white;
          cursor: pointer;
          font-weight: 800;
          padding: 10px 14px;
        }
        button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        button.small {
          padding: 7px 10px;
          font-size: 12px;
        }
        button.danger {
          background: #b91c1c;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin: 16px 0;
          border-radius: 10px;
          padding: 16px;
        }
        .stats span {
          display: block;
          color: #93a4bd;
          font-size: 12px;
        }
        .stats strong {
          display: block;
          margin-top: 4px;
          font-size: 18px;
        }
        .alert {
          margin-bottom: 12px;
          border-radius: 8px;
          padding: 12px 14px;
        }
        .alert.error {
          border-color: rgba(248, 113, 113, 0.45);
          color: #fecaca;
        }
        .alert.success {
          border-color: rgba(34, 197, 94, 0.45);
          color: #bbf7d0;
        }
        .layout {
          display: grid;
          grid-template-columns: minmax(260px, 330px) minmax(0, 1fr) minmax(260px, 330px);
          gap: 16px;
        }
        .import-panel {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 480px);
          gap: 16px;
          align-items: end;
          margin-bottom: 16px;
        }
        .import-panel p {
          margin-bottom: 0;
          color: #a8bbd4;
        }
        .import-form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
        }
        .panel {
          border-radius: 10px;
          padding: 16px;
        }
        .panel-title,
        .actions,
        .switch-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .panel-title {
          margin-bottom: 16px;
        }
        .main-column,
        .filters,
        .form,
        .mini-form {
          display: grid;
          gap: 12px;
        }
        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 8px;
          background: #0b1626;
          color: #e5eefb;
          padding: 10px 11px;
          font: inherit;
        }
        textarea {
          resize: vertical;
        }
        label {
          display: grid;
          gap: 6px;
          color: #bfd0e8;
          font-size: 13px;
          font-weight: 700;
        }
        label.check {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        label.check input {
          width: auto;
        }
        .grid {
          display: grid;
          gap: 12px;
        }
        .grid.two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .grid.three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .product-list {
          display: grid;
          gap: 8px;
          max-height: 78vh;
          overflow: auto;
          padding-right: 4px;
        }
        .product-card {
          display: grid;
          grid-template-columns: 58px minmax(0, 1fr);
          gap: 12px;
          align-items: center;
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 8px;
          background: rgba(30, 41, 59, 0.62);
          color: #e5eefb;
          padding: 10px;
          text-align: left;
        }
        .product-card.selected {
          border-color: #38bdf8;
          background: rgba(14, 165, 233, 0.16);
        }
        .product-card strong,
        .product-card small {
          display: block;
        }
        .product-card small {
          color: #93a4bd;
        }
        .thumb {
          display: grid;
          place-items: center;
          width: 58px;
          height: 58px;
          overflow: hidden;
          border-radius: 8px;
          background: #0b1626;
          color: #64748b;
          font-size: 11px;
        }
        .thumb img,
        .image-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .image-form {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) auto auto;
          gap: 10px;
          align-items: center;
        }
        .image-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 10px;
          margin-top: 14px;
        }
        .image-card {
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 8px;
          background: rgba(2, 6, 23, 0.35);
        }
        .image-card img {
          height: 110px;
        }
        .image-card span {
          display: block;
          padding: 8px;
          color: #cbd5e1;
          font-size: 12px;
        }
        .side {
          display: grid;
          align-content: start;
          gap: 16px;
        }
        .summary {
          border-top: 1px solid rgba(148, 163, 184, 0.18);
          padding-top: 14px;
        }
        dl {
          display: grid;
          grid-template-columns: 110px minmax(0, 1fr);
          gap: 8px 12px;
          margin: 0;
        }
        dt {
          color: #93a4bd;
          font-size: 12px;
        }
        dd {
          margin: 0;
          overflow-wrap: anywhere;
          font-weight: 800;
        }
        .empty {
          color: #93a4bd;
          line-height: 1.5;
        }
        @media (max-width: 1280px) {
          .layout {
            grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
          }
          .side {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 900px) {
          .page {
            padding: 14px;
          }
          .hero,
          .import-panel,
          .layout {
            display: grid;
          }
          .layout,
          .stats,
          .grid.two,
          .grid.three,
          .import-form,
          .image-form {
            grid-template-columns: 1fr;
          }
          .hero-actions {
            justify-content: stretch;
          }
          .hero-actions button {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
