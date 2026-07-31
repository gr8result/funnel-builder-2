import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../utils/supabase-client";
import { ProductLibraryToolbar, ProductLibraryFilters } from "../../../components/product-library/ProductLibraryToolbar";
import ProductLibraryTable from "../../../components/product-library/ProductLibraryTable";
import ProductLibraryCards from "../../../components/product-library/ProductLibraryCards";
import ProductDetailDrawer from "../../../components/product-library/ProductDetailDrawer";
import {
  downloadCsv,
  isProductLibraryProduct,
  productTypeForProduct,
  productSearchText,
  roomAreaForProduct,
  useDebouncedValue,
  effectiveUpgradeValue,
  money,
  PRODUCT_CSV_HEADERS,
  selectionVisibilityFlags,
} from "../../../lib/product-library/helpers";
import {
  LIBRARY_SCOPES,
  PRICING_TIERS,
  ROOM_AREA_OPTIONS,
  VIEW_MODE_STORAGE_KEY,
  COST_ROLES,
  CLIENT_SELECTABLE_CATEGORY_GROUPS,
} from "../../../lib/product-library/constants";

const DEFAULT_FILTERS = {
  roomArea: "all",
  categoryId: "all",
  supplierId: "all",
  manufacturerId: "all",
  visualType: "all",
  missingImages: "all",
  active: "active",
  room: "",
  priceStatus: "all",
  pricingTier: "all",
  standardInclusion: "all",
  availableForSelection: "all",
  selectionVisibility: "client_selectable",
  discontinued: "current",
  missingSupplierLink: "all",
  missingTags: "all",
};

const TABLE_PAGE_SIZE = 50;
const PRODUCT_LIBRARY_TABS = [
  { key: "selections", label: "Selection Products" },
  { key: "estimating", label: "Estimating Catalogue" },
  { key: "suppliers", label: "Suppliers" },
  { key: "imports", label: "Import Products" },
  { key: "categories", label: "Categories & Tags" },
];
const TAB_ALIASES = new Map([
  ["selection-products", "selections"],
  ["selection", "selections"],
  ["client-selectable", "selections"],
  ["import", "imports"],
  ["import-products", "imports"],
  ["estimating-catalogue", "estimating"],
  ["categories-tags", "categories"],
]);
const ACTIVE_SELECTION_VISIBILITIES = new Set(["client_selectable", "builder_selectable"]);

export default function BuilderProductLibraryPage() {
  const router = useRouter();
  const { workspaceId, role } = useWorkspace();
  const { user } = useAuth();
  const canViewCosts = COST_ROLES.has(role);
  const [categories, setCategories] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("selections");

  const [viewMode, setViewMode] = useState("catalogue");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(VIEW_MODE_STORAGE_KEY) : null;
    if (stored === "card") setViewMode("card");
    if (stored === "catalogue" || stored === "table") setViewMode("catalogue");
  }, []);
  function changeViewMode(mode) {
    setViewMode(mode);
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  function updateFilter(field, value) {
    if (field === "__clear") {
      setFilters(DEFAULT_FILTERS);
      setSearch("");
      return;
    }
    setFilters((current) => ({ ...current, [field]: value }));
  }

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerProduct, setDrawerProduct] = useState(null);

  const [tableRows, setTableRows] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(TABLE_PAGE_SIZE);
  const [tableTotal, setTableTotal] = useState(0);
  const [tableTotalPages, setTableTotalPages] = useState(1);
  const [tableSort, setTableSort] = useState({ key: "updated_at", direction: "desc" });

  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMode, setImportMode] = useState("upsert");

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c.category_name])), [categories]);
  const categoryObjectById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s.supplier_name])), [suppliers]);
  const manufacturerById = useMemo(() => new Map(manufacturers.map((m) => [m.id, m.manufacturer_name])), [manufacturers]);

  useEffect(() => {
    if (!workspaceId) return;
    loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  useEffect(() => {
    if (!router.isReady) return;
    const rawTab = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab;
    const normalized = String(rawTab || "selections").trim().toLowerCase();
    const nextTab = TAB_ALIASES.get(normalized) || normalized;
    if (PRODUCT_LIBRARY_TABS.some((tab) => tab.key === nextTab)) setActiveTab(nextTab);
    else setActiveTab("selections");
  }, [router.isReady, router.query.tab]);

  function changeTab(tabKey) {
    setActiveTab(tabKey);
    const nextQuery = { ...router.query, tab: tabKey };
    router.push({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  }

  async function loadLibrary() {
    setLoading(true);
    setError("");
    const [categoryResult, manufacturerResult, supplierResult, productResult] = await Promise.all([
      supabase.from("builder_product_categories").select("*").or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`).order("sort_order", { ascending: true }),
      supabase.from("builder_product_manufacturers").select("*").or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`).order("manufacturer_name", { ascending: true }),
      supabase.from("builder_product_suppliers").select("*").or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`).order("supplier_name", { ascending: true }),
      supabase.from("builder_products").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(1000),
    ]);
    const firstError = categoryResult.error || manufacturerResult.error || supplierResult.error || productResult.error;
    if (firstError) {
      setError(firstError.message || "Could not load the Product Library.");
      setLoading(false);
      return;
    }
    const categoryRows = categoryResult.data || [];
    const productRows = productResult.data || [];
    const categoryMap = new Map(categoryRows.map((category) => [category.id, category]));
    const libraryRows = productRows.filter((product) => isProductLibraryProduct(product, categoryMap.get(product.category_id)));
    const visibleCategoryIds = new Set(libraryRows.map((product) => product.category_id).filter(Boolean));
    const libraryCategories = categoryRows.filter((category) => visibleCategoryIds.has(category.id) || isProductLibraryProduct({ library_scope: category.metadata?.library_scope }, category));
    setCategories(libraryCategories);
    setManufacturers(manufacturerResult.data || []);
    setSuppliers(supplierResult.data || []);
    setProducts(libraryRows);
    setLoading(false);
  }

  async function fetchTablePage() {
    if (!workspaceId) return;
    setTableLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || "";
    const params = new URLSearchParams({
      page: String(tablePage),
      pageSize: String(tablePageSize),
      sortBy: tableSort.key,
      sortDirection: tableSort.direction,
      search: debouncedSearch.trim(),
      categoryId: filters.categoryId,
      supplierId: filters.supplierId,
      manufacturerId: filters.manufacturerId,
      pricingTier: filters.pricingTier,
      active: activeTab === "estimating" ? "all" : filters.active,
      availableForSelection: filters.availableForSelection,
      selectionVisibility: activeTab === "estimating" ? "estimating_only" : filters.selectionVisibility,
      discontinued: activeTab === "estimating" ? "all" : filters.discontinued,
      standardInclusion: filters.standardInclusion,
      missingImages: filters.missingImages,
      missingSupplierLink: filters.missingSupplierLink,
      missingTags: filters.missingTags,
    });
    const response = await fetch(`/api/product-library/list?${params.toString()}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    setTableLoading(false);
    if (!response.ok || !payload?.ok) {
      setError(payload?.error || "Could not load products.");
      return;
    }
    setTableRows(payload.rows || []);
    setTableTotal(payload.total || 0);
    setTableTotalPages(payload.totalPages || 1);
  }

  useEffect(() => {
    if (activeTab !== "estimating" || !workspaceId) return;
    fetchTablePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, workspaceId, tablePage, tablePageSize, tableSort, debouncedSearch, filters]);

  useEffect(() => {
    setTablePage(1);
  }, [debouncedSearch, filters]);

  const libraryStats = useMemo(() => {
    const activeProducts = products.filter((product) => product.active !== false);
    const categoryIds = new Set(products.map((product) => product.category_id).filter(Boolean));
    const supplierIds = new Set(products.map((product) => product.supplier_id).filter(Boolean));

    const urlCounts = new Map();
    const skuCounts = new Map();
    products.forEach((product) => {
      if (product.product_url) urlCounts.set(product.product_url, (urlCounts.get(product.product_url) || 0) + 1);
      if (product.sku) skuCounts.set(product.sku.trim().toLowerCase(), (skuCounts.get(product.sku.trim().toLowerCase()) || 0) + 1);
    });
    const duplicateUrlCount = Array.from(urlCounts.values()).filter((count) => count > 1).reduce((total, count) => total + count, 0);
    const duplicateSkuCount = Array.from(skuCounts.values()).filter((count) => count > 1).reduce((total, count) => total + count, 0);

    return {
      totalActive: activeProducts.length,
      totalCategories: categoryIds.size,
      totalSuppliers: supplierIds.size,
      classicCount: activeProducts.filter((product) => (product.pricing_tier || "CLASSIC") === "CLASSIC").length,
      premierCount: activeProducts.filter((product) => product.pricing_tier === "PREMIER").length,
      premiumCount: activeProducts.filter((product) => product.pricing_tier === "PREMIUM").length,
      standardInclusionCount: activeProducts.filter((product) => product.standard_included).length,
      missingImageCount: activeProducts.filter((product) => product.requires_image && !product.primary_image_url).length,
      inactiveCount: products.filter((product) => product.active === false).length,
      noProductUrlCount: activeProducts.filter((product) => !product.product_url).length,
      unverifiedCount: activeProducts.filter((product) => (product.verification_status || "unverified") === "unverified").length,
      imageUnavailableCount: activeProducts.filter((product) => product.verification_status === "image_unavailable").length,
      linkBrokenCount: activeProducts.filter((product) => product.verification_status === "link_broken").length,
      discontinuedCount: activeProducts.filter((product) => product.verification_status === "discontinued").length,
      duplicateUrlCount,
      duplicateSkuCount,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return products.filter((product) => {
      const category = categoryObjectById.get(product.category_id);
      if (!isProductLibraryProduct(product, category)) return false;
      if (term) {
        const text = productSearchText(
          product,
          categoryById.get(product.category_id),
          supplierById.get(product.supplier_id),
          manufacturerById.get(product.manufacturer_id)
        );
        if (!text.includes(term)) return false;
      }
      if (filters.roomArea !== "all" && roomAreaForProduct(product, category) !== filters.roomArea) return false;
      if (filters.categoryId !== "all" && product.category_id !== filters.categoryId) return false;
      if (filters.supplierId !== "all" && product.supplier_id !== filters.supplierId) return false;
      if (filters.manufacturerId !== "all" && product.manufacturer_id !== filters.manufacturerId) return false;
      if (filters.visualType === "visual" && !product.is_visual_product) return false;
      if (filters.visualType === "non_visual" && product.is_visual_product) return false;
      if (filters.missingImages === "missing" && !(product.requires_image && !product.primary_image_url)) return false;
      if (filters.active === "active" && product.active === false) return false;
      if (filters.active === "inactive" && product.active !== false) return false;
      if (filters.room.trim() && !(product.room_or_usage || "").toLowerCase().includes(filters.room.trim().toLowerCase())) return false;
      if (filters.priceStatus === "priced" && product.sell_price == null && !(product.pricing_mode === "markup" && product.cost_price != null)) return false;
      if (filters.priceStatus === "unpriced" && (product.sell_price != null || (product.pricing_mode === "markup" && product.cost_price != null))) return false;
      if (filters.pricingTier !== "all" && (product.pricing_tier || "CLASSIC") !== filters.pricingTier) return false;
      if (filters.standardInclusion === "yes" && !product.standard_included) return false;
      if (filters.standardInclusion === "no" && product.standard_included) return false;
      if (filters.availableForSelection === "yes" && product.available_for_selection === false) return false;
      if (filters.availableForSelection === "no" && product.available_for_selection !== false) return false;
      const visibility = selectionVisibilityFlags(product);
      if (filters.selectionVisibility !== "all" && visibility.selectionVisibility !== filters.selectionVisibility) return false;
      if (filters.selectionVisibility === "all" && !ACTIVE_SELECTION_VISIBILITIES.has(visibility.selectionVisibility)) return false;
      if (filters.discontinued === "current" && visibility.discontinuedStatus === "discontinued") return false;
      if (filters.discontinued === "discontinued" && visibility.discontinuedStatus !== "discontinued") return false;
      if (filters.missingSupplierLink === "missing" && product.product_url) return false;
      if (filters.missingTags === "missing" && String(product.requirement_tags || "").trim()) return false;
      return true;
    });
  }, [products, debouncedSearch, filters, categoryById, categoryObjectById, supplierById, manufacturerById]);

  function openDrawerForNew() {
    setDrawerProduct(null);
    setDrawerOpen(true);
  }
  function openDrawerForProduct(product) {
    setDrawerProduct(product);
    setDrawerOpen(true);
  }
  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerProduct(null);
  }

  async function authHeaders() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || "";
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
    };
  }

  async function saveProductFromDrawer(form, { close = true } = {}) {
    if (!workspaceId) return;
    setSaving(true);
    setError("");
    const payload = {
      product_name: form.product_name.trim(),
      sku: form.sku,
      description: form.description,
      product_type: form.product_type,
      requirement_tags: form.requirement_tags,
      compatible_area_types: form.compatible_area_types,
      fuel_type: form.fuel_type,
      mounting_type: form.mounting_type,
      installation_type: form.installation_type,
      availability_status: form.availability_status,
      pricing_tier: form.pricing_tier,
      category_id: form.category_id || null,
      subcategory: form.subcategory,
      room_or_usage: form.room_or_usage,
      is_visual_product: Boolean(form.is_visual_product),
      requires_image: Boolean(form.requires_image),
      library_scope: form.library_scope || "CLIENT_SELECTION",
      selection_visibility: form.selection_visibility || "client_selectable",
      active_status: form.active_status || (form.active ? "active" : "inactive"),
      discontinued_status: form.discontinued_status || "current",
      active: Boolean(form.active),
      available_for_selection: Boolean(form.available_for_selection),
      display_order: form.display_order === "" ? 0 : Number(form.display_order),
      manufacturer_id: form.manufacturer_id || null,
      supplier_id: form.supplier_id || null,
      model: form.model,
      colour: form.colour,
      finish: form.finish,
      size_dimensions: form.size_dimensions,
      product_url: form.product_url,
      supplier_category_url: form.supplier_category_url,
      warranty_url: form.warranty_url,
      cost_price: form.cost_price === "" ? null : Number(form.cost_price),
      base_allowance: form.base_allowance === "" ? 0 : Number(form.base_allowance),
      upgrade_value_mode: form.upgrade_value_mode,
      upgrade_cost: form.upgrade_cost === "" ? 0 : Number(form.upgrade_cost),
      retail_price: form.retail_price === "" ? null : Number(form.retail_price),
      gst_included: Boolean(form.gst_included),
      sell_price: form.sell_price === "" ? null : Number(form.sell_price),
      markup_percent: form.markup_percent === "" ? null : Number(form.markup_percent),
      pricing_mode: form.pricing_mode,
      price_band: form.price_band,
      standard_included: Boolean(form.standard_included),
      variant_label: form.variant_label,
      parent_product_id: form.parent_product_id || null,
      primary_image_url: form.primary_image_url,
      additional_image_urls: form.additional_image_urls || [],
      datasheet_pdf_url: form.datasheet_pdf_url,
      notes: form.notes,
      client_notes: form.client_notes,
    };

    const response = await fetch("/api/product-library/products", {
      method: drawerProduct ? "PATCH" : "POST",
      headers: await authHeaders(),
      body: JSON.stringify(drawerProduct ? { id: drawerProduct.id, ...payload } : payload),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Could not save product.");
      return;
    }
    const data = result.product;
    setProducts((current) => {
      const exists = current.some((product) => product.id === data.id);
      return exists ? current.map((product) => (product.id === data.id ? data : product)) : [data, ...current];
    });
    setSuccess(`Saved ${data.product_name}.`);
    if (close) closeDrawer();
    else setDrawerProduct(data);
    if (viewMode === "table") fetchTablePage();
  }

  async function deleteProductFromDrawer(productId) {
    if (!window.confirm("Archive this product from the selections catalogue? Products already used by a project will be archived, not deleted.")) return;
    setSaving(true);
    const response = await fetch("/api/product-library/products", {
      method: "DELETE",
      headers: await authHeaders(),
      body: JSON.stringify({ id: productId }),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Could not delete product.");
      return;
    }
    if (result.deleted) {
      setProducts((current) => current.filter((product) => product.id !== productId));
    } else {
      setProducts((current) => current.map((product) => (product.id === productId ? { ...product, active: false, available_for_selection: false } : product)));
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(productId);
      return next;
    });
    closeDrawer();
    setSuccess(result.deleted ? "Product deleted." : "Product archived (already used by a project).");
  }

  async function duplicateProductFromDrawer(product) {
    setSaving(true);
    setError("");
    const { id, created_at, updated_at, created_by, updated_by, workspace_id, ...rest } = product;
    const response = await fetch("/api/product-library/products", {
      method: "POST",
      headers: await authHeaders(),
      // A duplicate can never inherit standard_included — two active products in the
      // same category/tier would violate the standard-inclusion uniqueness rule.
      body: JSON.stringify({ ...rest, standard_included: false, product_name: `${product.product_name} (Copy)` }),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Could not duplicate product.");
      return;
    }
    setProducts((current) => [result.product, ...current]);
    setSuccess(`Duplicated as ${result.product.product_name}.`);
    openDrawerForProduct(result.product);
  }

  function toggleSelect(productId) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  async function applyBulkUpdate(updates) {
    if (!selectedIds.size) return;
    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || "";
    const response = await fetch("/api/product-library/bulk-update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
      },
      body: JSON.stringify({ productIds: Array.from(selectedIds), updates, action: updates.__delete ? "delete" : "update" }),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok || !payload?.ok) {
      setError(payload?.error || "Bulk update failed.");
      return;
    }
    setSuccess(updates.__delete ? `Archived ${payload.archived || 0} products.` : `Updated ${payload.updated} products.`);
    setSelectedIds(new Set());
    setBulkModalOpen(false);
    await loadLibrary();
  }

  function exportProductsCsv() {
    const rows = filteredProducts.map((product) => [
      product.sku || "",
      product.product_name || "",
      categoryById.get(product.category_id) || "",
      product.subcategory || "",
      categoryObjectById.get(product.category_id)?.selection_group || "",
      product.pricing_tier || "CLASSIC",
      product.is_visual_product ? "yes" : "no",
      product.requires_image ? "yes" : "no",
      product.library_scope || "CLIENT_SELECTION",
      manufacturerById.get(product.manufacturer_id) || "",
      product.model || "",
      supplierById.get(product.supplier_id) || "",
      product.sku || "",
      product.size_dimensions || "",
      product.colour || "",
      product.finish || "",
      canViewCosts ? (product.cost_price ?? "") : "",
      canViewCosts ? (product.base_allowance ?? "") : "",
      canViewCosts ? effectiveUpgradeValue(product) : "",
      product.retail_price ?? "",
      canViewCosts ? (product.sell_price ?? "") : "",
      canViewCosts ? (product.markup_percent ?? "") : "",
      product.gst_included === false ? "no" : "yes",
      "",
      product.standard_included ? "yes" : "no",
      product.available_for_selection === false ? "no" : "yes",
      product.active === false ? "no" : "yes",
      product.display_order ?? 0,
      product.primary_image_url || "",
      (Array.isArray(product.additional_image_urls) ? product.additional_image_urls : []).join("|"),
      product.product_url || "",
      product.manufacturer_product_url || "",
      product.image_source_url || "",
      product.verification_status || "unverified",
      product.date_last_verified || "",
      product.datasheet_pdf_url || "",
      product.description || "",
      product.notes || "",
      product.client_notes || "",
    ]);
    downloadCsv("product-library-export.csv", [PRODUCT_CSV_HEADERS, ...rows]);
  }

  function downloadCsvTemplate() {
    const exampleRow = [
      "OVEN-001", "Series 8 Built-in Oven", "Ovens", "Built-in", "Kitchen and appliances", "PREMIER",
      "yes", "yes", "CLIENT_SELECTION", "Bosch", "HBG7241B1", "Reece", "OVEN-001", "900mm", "Stainless Steel", "Matte",
      "850", "500", "", "1350", "1200", "", "yes", "each", "no", "yes", "yes", "10",
      "https://www.bosch-home.com.au/productdetail/HBG7241B1",
      "",
      "https://www.bosch-home.com.au/productdetail/HBG7241B1",
      "",
      "https://www.bosch-home.com.au/productdetail/HBG7241B1",
      "exact_model_verified",
      "2026-07-28",
      "",
      "Premium built-in oven with pyrolytic self-clean.", "", "",
    ];
    downloadCsv("product-library-import-template.csv", [PRODUCT_CSV_HEADERS, exampleRow]);
  }

  async function runImportPreview() {
    if (!importFile) return;
    setImportBusy(true);
    setError("");
    const csvText = await importFile.text();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || "";
    const response = await fetch("/api/product-library/import-preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
      },
      body: JSON.stringify({ csvText }),
    });
    const payload = await response.json().catch(() => ({}));
    setImportBusy(false);
    if (!response.ok || !payload?.ok) {
      setError(payload?.error || "Could not preview the import.");
      return;
    }
    setImportPreview({ ...payload, csvText });
  }

  async function confirmImport() {
    if (!importPreview?.csvText) return;
    setImportBusy(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || "";
    const response = await fetch("/api/product-library/import-commit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
      },
      body: JSON.stringify({ csvText: importPreview.csvText, applyMode: importMode, fileName: importFile?.name }),
    });
    const payload = await response.json().catch(() => ({}));
    setImportBusy(false);
    if (!response.ok || !payload?.ok) {
      setError(payload?.error || "Import failed.");
      return;
    }
    if (payload.errors?.length) {
      downloadCsv("product-library-import-errors.csv", [
        ["row", "error", "product_name"],
        ...payload.errors.map((entry) => [entry.row, entry.error, entry.record?.product_name || ""]),
      ]);
    }
    setSuccess(`Imported ${payload.totalRows} rows: ${payload.created} created, ${payload.updated} updated, ${payload.errorCount} errors.`);
    setImportModalOpen(false);
    setImportFile(null);
    setImportPreview(null);
    await loadLibrary();
  }

  return (
    <>
      <Head>
        <title>Product Library | Gr8 Result</title>
      </Head>
      <main className="page">
        <ProductLibraryToolbar
          viewMode={viewMode}
          onChangeViewMode={changeViewMode}
          onAddProduct={openDrawerForNew}
          onExportCsv={exportProductsCsv}
          selectedCount={selectedIds.size}
          onBulkUpdate={() => setBulkModalOpen(true)}
        />
        <ProductLibraryTabs activeTab={activeTab} onChangeTab={changeTab} />

        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        {activeTab === "selections" && (
          <>
            <LibraryDashboard stats={libraryStats} canViewCosts={canViewCosts} />
            <ProductLibraryFilters
              search={search}
              onSearch={setSearch}
              categories={categories}
              suppliers={suppliers}
              manufacturers={manufacturers}
              filters={filters}
              onChangeFilter={updateFilter}
              roomAreas={ROOM_AREA_OPTIONS}
              resultCount={filteredProducts.length}
            />
            <section className="content">
              {loading ? (
                <p className="loading">Loading products...</p>
              ) : viewMode === "card" ? (
                <ProductLibraryCards
                  products={filteredProducts}
                  categoryById={categoryById}
                  supplierById={supplierById}
                  manufacturerById={manufacturerById}
                  canViewCosts={canViewCosts}
                  onOpenProduct={openDrawerForProduct}
                />
              ) : (
                <SelectionProductsView
                  products={filteredProducts}
                  categoryById={categoryById}
                  supplierById={supplierById}
                  manufacturerById={manufacturerById}
                  canViewCosts={canViewCosts}
                  onOpenProduct={openDrawerForProduct}
                  onDuplicateProduct={duplicateProductFromDrawer}
                  onArchiveProduct={deleteProductFromDrawer}
                />
              )}
            </section>
          </>
        )}

        {activeTab === "estimating" && (
          <section className="content tab-panel">
            <div className="panel-heading">
              <div>
                <h2>Internal Estimating Catalogue</h2>
                <p>Internal labour, material, BOQ and rate items used by estimating and quotations. These items do not appear in client selections.</p>
              </div>
            </div>
            <ProductLibraryFilters
              search={search}
              onSearch={setSearch}
              categories={categories}
              suppliers={suppliers}
              manufacturers={manufacturers}
              filters={filters}
              onChangeFilter={updateFilter}
              roomAreas={ROOM_AREA_OPTIONS}
              resultCount={tableTotal}
            />
            <ProductLibraryTable
              products={tableRows}
              categoryById={categoryById}
              supplierById={supplierById}
              manufacturerById={manufacturerById}
              onOpenProduct={openDrawerForProduct}
              server={{
                page: tablePage,
                pageSize: tablePageSize,
                total: tableTotal,
                totalPages: tableTotalPages,
                sortBy: tableSort.key,
                sortDirection: tableSort.direction,
                onPageChange: setTablePage,
                onPageSizeChange: (size) => { setTablePageSize(size); setTablePage(1); },
                onSortChange: (key) => setTableSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" })),
              }}
            />
            {tableLoading && <p className="loading">Loading estimating catalogue...</p>}
          </section>
        )}

        {activeTab === "suppliers" && (
          <SuppliersTab
            suppliers={suppliers}
            products={products}
            categoryById={categoryById}
            onManageSuppliers={() => setCategoriesModalOpen(true)}
          />
        )}

        {activeTab === "imports" && (
          <ImportProductsTab
            importFile={importFile}
            importPreview={importPreview}
            importBusy={importBusy}
            importMode={importMode}
            onSetImportMode={setImportMode}
            onSetImportFile={(file) => { setImportFile(file); setImportPreview(null); }}
            onDownloadTemplate={downloadCsvTemplate}
            onPreview={runImportPreview}
            onConfirm={confirmImport}
          />
        )}

        {activeTab === "categories" && (
          <CategoriesAndTagsTab
            categories={categories}
            onManageCategories={() => setCategoriesModalOpen(true)}
          />
        )}
      </main>

      <ProductDetailDrawer
        open={drawerOpen}
        product={drawerProduct}
        categories={categories}
        manufacturers={manufacturers}
        suppliers={suppliers}
        products={products}
        supabase={supabase}
        userId={user?.id}
        saving={saving}
        error={error}
        canViewCosts={canViewCosts}
        onSave={saveProductFromDrawer}
        onCancel={closeDrawer}
        onDelete={deleteProductFromDrawer}
        onDuplicate={duplicateProductFromDrawer}
      />

      {importModalOpen && (
        <div className="modal-overlay" onClick={() => !importBusy && setImportModalOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>Import Products CSV</h2>
            <p>Upload a CSV, preview matched/new/error rows, then confirm to apply.</p>
            <button type="button" className="ghost" onClick={downloadCsvTemplate}>Download CSV Template</button>
            <input type="file" accept=".csv,text/csv" onChange={(event) => { setImportFile(event.target.files?.[0] || null); setImportPreview(null); }} />
            {!importPreview ? (
              <button type="button" disabled={!importFile || importBusy} onClick={runImportPreview}>
                {importBusy ? "Previewing..." : "Preview Import"}
              </button>
            ) : (
              <>
                <div className="preview-summary">
                  <span>{importPreview.summary.totalRows} rows</span>
                  <span className="new">{importPreview.summary.new} new</span>
                  <span className="matched">{importPreview.summary.matched} matched</span>
                  <span className="errors">{importPreview.summary.errors} errors</span>
                </div>
                <button type="button" disabled={importBusy} onClick={confirmImport}>
                  {importBusy ? "Importing..." : "Confirm Import"}
                </button>
              </>
            )}
            <button type="button" className="ghost" onClick={() => { setImportModalOpen(false); setImportFile(null); setImportPreview(null); }}>Close</button>
          </div>
        </div>
      )}

      {bulkModalOpen && (
        <BulkUpdateModal
          categories={categories}
          suppliers={suppliers}
          onApply={applyBulkUpdate}
          onClose={() => setBulkModalOpen(false)}
          saving={saving}
        />
      )}

      {categoriesModalOpen && (
        <ManageCategoriesModal
          workspaceId={workspaceId}
          categories={categories}
          manufacturers={manufacturers}
          suppliers={suppliers}
          onChanged={loadLibrary}
          onClose={() => setCategoriesModalOpen(false)}
        />
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f6f8fb;
          color: #172033;
          padding: 24px;
          display: grid;
          gap: 16px;
          align-content: start;
        }
        .alert {
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: #ffffff;
          border-radius: 8px;
          padding: 12px 14px;
        }
        .alert.error {
          border-color: rgba(248, 113, 113, 0.45);
          color: #fecaca;
        }
        .alert.success {
          border-color: rgba(34, 197, 94, 0.45);
          color: #166534;
        }
        .content {
          min-width: 0;
        }
        .tab-panel {
          display: grid;
          gap: 14px;
        }
        .panel-heading {
          border: 1px solid #d8e0ea;
          background: #ffffff;
          border-radius: 8px;
          padding: 16px;
        }
        .panel-heading h2 {
          margin: 0 0 4px;
          color: #172033;
          font-size: 20px;
        }
        .panel-heading p {
          margin: 0;
          color: #64748b;
          font-size: 13px;
        }
        .loading {
          color: #93a4bd;
        }
        .cap-notice {
          margin: 0;
          color: #fbbf24;
          font-size: 12px;
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.6);
          display: grid;
          place-items: center;
          z-index: 70;
        }
        .modal {
          width: min(480px, 92vw);
          background: #0b1626;
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 12px;
          padding: 20px;
          display: grid;
          gap: 12px;
        }
        .modal h2 {
          margin: 0;
        }
        .modal p {
          margin: 0;
          color: #93a4bd;
          font-size: 13px;
        }
        .preview-summary {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          font-size: 12px;
        }
        .preview-summary span {
          padding: 4px 8px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.14);
        }
        .preview-summary .new {
          color: #4ade80;
        }
        .preview-summary .matched {
          color: #38bdf8;
        }
        .preview-summary .errors {
          color: #fca5a5;
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
        button.ghost {
          background: transparent;
          border: 1px solid rgba(148, 163, 184, 0.35);
          color: #e5eefb;
        }
        button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
      `}</style>
    </>
  );
}

function ProductLibraryTabs({ activeTab, onChangeTab }) {
  return (
    <nav className="module-tabs" aria-label="Product Library sections">
      {PRODUCT_LIBRARY_TABS.map((tab) => (
        <button key={tab.key} type="button" className={activeTab === tab.key ? "active" : ""} onClick={() => onChangeTab(tab.key)}>
          {tab.label}
        </button>
      ))}
      <style jsx>{`
        .module-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          border-bottom: 1px solid #d8e0ea;
          padding-bottom: 2px;
        }
        button {
          border: 0;
          border-radius: 8px 8px 0 0;
          background: transparent;
          color: #475569;
          cursor: pointer;
          font-size: 13px;
          font-weight: 800;
          padding: 11px 14px;
          white-space: nowrap;
        }
        button.active {
          background: #ffffff;
          color: #17406f;
          box-shadow: inset 0 -3px 0 #2563eb;
        }
      `}</style>
    </nav>
  );
}

function SelectionProductsView({
  products,
  categoryById,
  supplierById,
  manufacturerById,
  canViewCosts,
  onOpenProduct,
  onDuplicateProduct,
  onArchiveProduct,
}) {
  if (!products.length) {
    return (
      <section className="selection-products empty">
        <h2>Client Selectable Products</h2>
        <p>No client-selectable products match the current filters.</p>
        <style jsx>{selectionProductsCss}</style>
      </section>
    );
  }

  return (
    <section className="selection-products">
      <div className="list-heading">
        <div>
          <p className="active-filter">Client Selectable Products</p>
          <h2>Selection Products</h2>
        </div>
        <span>{products.length} visible products</span>
      </div>
      <div className="catalogue-list" role="table" aria-label="Client selectable product catalogue">
        <div className="catalogue-header" role="row">
          <span>Product</span>
          <span>Brand</span>
          <span>Model</span>
          <span>Code</span>
          <span>Supplier</span>
          <span>Category</span>
          <span>Subcategory</span>
          <span>Tier</span>
          <span>Client Price</span>
          <span>Upgrade</span>
          <span>Availability</span>
          <span>Actions</span>
        </div>
        {products.map((product) => {
          const supplierName = supplierById.get(product.supplier_id) || "No supplier";
          const categoryName = categoryById.get(product.category_id) || "Uncategorised";
          const brandName = manufacturerById.get(product.manufacturer_id) || "No brand";
          const priceStatus = product.sell_price != null || product.retail_price != null ? money(product.sell_price ?? product.retail_price) : "Price required";
          const upgradePrice = canViewCosts ? money(effectiveUpgradeValue(product)) || "Included" : product.base_allowance ? money(product.base_allowance) : "Allowance TBC";
          const status = product.active === false ? "Inactive" : product.availability_status || "available";
          return (
            <article key={product.id} className="catalogue-row" role="row">
              <button type="button" className="product-cell" onClick={() => onOpenProduct(product)}>
                <span className="thumb">
                  {product.primary_image_url ? <img src={product.primary_image_url} alt={product.product_name || "Product"} loading="lazy" /> : <span>{(product.product_name || "P")[0]}</span>}
                </span>
                <span className="product-copy">
                  <strong>{product.product_name}</strong>
                  <small>{[product.colour, product.finish].filter(Boolean).join(" / ") || product.product_type || "Selection product"}</small>
                </span>
              </button>
              <span>{brandName}</span>
              <span>{product.model || "-"}</span>
              <span>{product.sku || "-"}</span>
              <span>{supplierName}</span>
              <span>{categoryName}</span>
              <span>{product.subcategory || product.product_type || "-"}</span>
              <span>{product.pricing_tier || "CLASSIC"}</span>
              <span>{priceStatus}</span>
              <span>{upgradePrice}</span>
              <span><mark className={status === "available" || status === "Active" ? "available" : "unavailable"}>{status}</mark></span>
              <span className="row-actions">
                <button type="button" onClick={() => onOpenProduct(product)}>Edit</button>
                <button type="button" onClick={() => onOpenProduct(product)}>View Details</button>
                <button type="button" onClick={() => onDuplicateProduct(product)}>Duplicate</button>
                <button type="button" onClick={() => onArchiveProduct(product.id)}>Archive</button>
                {product.product_url ? <a href={product.product_url} target="_blank" rel="noopener noreferrer">Open Supplier Website</a> : <span className="muted">No supplier link</span>}
              </span>
            </article>
          );
        })}
      </div>
      <style jsx>{selectionProductsCss}</style>
    </section>
  );
}

const selectionProductsCss = `
  .selection-products {
    display: grid;
    gap: 12px;
    min-width: 0;
  }
  .selection-products.empty {
    border: 1px solid #d8e0ea;
    background: #ffffff;
    border-radius: 8px;
    padding: 28px;
    text-align: center;
  }
  .selection-products.empty h2 {
    margin: 0 0 6px;
  }
  .selection-products.empty p {
    margin: 0;
    color: #64748b;
  }
  .list-heading {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: end;
    border: 1px solid #d8e0ea;
    background: #ffffff;
    border-radius: 8px;
    padding: 16px;
  }
  .active-filter {
    margin: 0 0 4px;
    color: #2563eb;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  h2 {
    margin: 0;
    color: #172033;
    font-size: 22px;
  }
  .list-heading span {
    color: #64748b;
    font-size: 13px;
    font-weight: 700;
  }
  .catalogue-list {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .catalogue-header,
  .catalogue-row {
    display: grid;
    grid-template-columns: minmax(260px, 1.7fr) minmax(95px, 0.7fr) minmax(95px, 0.7fr) minmax(95px, 0.7fr) minmax(120px, 0.8fr) minmax(120px, 0.8fr) minmax(120px, 0.8fr) 80px minmax(105px, 0.7fr) minmax(95px, 0.7fr) minmax(105px, 0.7fr) minmax(220px, 1.2fr);
    gap: 10px;
    align-items: center;
  }
  .catalogue-header {
    color: #64748b;
    font-size: 11px;
    font-weight: 900;
    padding: 0 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .catalogue-row {
    border: 1px solid #d8e0ea;
    background: #ffffff;
    border-radius: 8px;
    color: #243044;
    font-size: 13px;
    padding: 10px 12px;
  }
  .catalogue-row > span,
  .catalogue-row a,
  .catalogue-row button {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .product-cell {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 0;
    text-align: left;
  }
  .thumb {
    width: 58px;
    height: 58px;
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid #d8e0ea;
    border-radius: 8px;
    background: #edf4fb;
    color: #2563eb;
    font-weight: 900;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .product-copy {
    display: grid;
    gap: 3px;
    min-width: 0;
  }
  .product-copy strong {
    color: #172033;
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .product-copy small {
    color: #64748b;
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  mark {
    border-radius: 999px;
    background: #f1f5f9;
    color: #475569;
    font-weight: 800;
    padding: 3px 8px;
  }
  mark.available {
    background: #dcfce7;
    color: #166534;
  }
  mark.unavailable {
    background: #fee2e2;
    color: #991b1b;
  }
  .row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .row-actions button,
  .row-actions a {
    border: 1px solid #d8e0ea;
    border-radius: 7px;
    background: #f8fafc;
    color: #17406f;
    cursor: pointer;
    font-size: 11px;
    font-weight: 800;
    padding: 6px 8px;
    text-decoration: none;
  }
  .row-actions .muted {
    color: #94a3b8;
    font-size: 11px;
  }
  @media (max-width: 1180px) {
    .catalogue-header {
      display: none;
    }
    .catalogue-row {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }
    .product-cell,
    .row-actions {
      grid-column: 1 / -1;
    }
    .catalogue-row > span:not(.row-actions)::before {
      display: block;
      color: #94a3b8;
      font-size: 10px;
      font-weight: 900;
      margin-bottom: 2px;
      text-transform: uppercase;
    }
    .catalogue-row > span:nth-of-type(1)::before { content: "Brand"; }
    .catalogue-row > span:nth-of-type(2)::before { content: "Model"; }
    .catalogue-row > span:nth-of-type(3)::before { content: "Code"; }
    .catalogue-row > span:nth-of-type(4)::before { content: "Supplier"; }
    .catalogue-row > span:nth-of-type(5)::before { content: "Category"; }
    .catalogue-row > span:nth-of-type(6)::before { content: "Subcategory"; }
    .catalogue-row > span:nth-of-type(7)::before { content: "Tier"; }
    .catalogue-row > span:nth-of-type(8)::before { content: "Client Price"; }
    .catalogue-row > span:nth-of-type(9)::before { content: "Upgrade"; }
    .catalogue-row > span:nth-of-type(10)::before { content: "Availability"; }
  }
  @media (max-width: 640px) {
    .list-heading {
      align-items: start;
      flex-direction: column;
    }
    .catalogue-row {
      grid-template-columns: 1fr;
    }
    .product-cell {
      grid-template-columns: 52px minmax(0, 1fr);
    }
    .thumb {
      width: 52px;
      height: 52px;
    }
  }
`;

function SuppliersTab({ suppliers, products, categoryById, onManageSuppliers }) {
  const supplierRows = suppliers.map((supplier) => {
    const supplierProducts = products.filter((product) => product.supplier_id === supplier.id);
    const categories = Array.from(new Set(supplierProducts.map((product) => categoryById.get(product.category_id)).filter(Boolean)));
    return {
      supplier,
      categories,
      productCount: supplierProducts.length,
      missingLinks: supplierProducts.filter((product) => !product.product_url).length,
      missingImages: supplierProducts.filter((product) => product.requires_image && !product.primary_image_url).length,
    };
  });
  return (
    <section className="admin-panel">
      <div className="panel-heading">
        <div>
          <h2>Suppliers</h2>
          <p>Track supplier coverage, product links and image gaps for the selection catalogue.</p>
        </div>
        <button type="button" onClick={onManageSuppliers}>Edit Suppliers</button>
      </div>
      <div className="supplier-list">
        <div className="supplier-header">
          <span>Supplier</span><span>Categories</span><span>Status</span><span>Website</span><span>Products</span><span>Missing Links</span><span>Missing Images</span><span>Action</span>
        </div>
        {supplierRows.map(({ supplier, categories, productCount, missingLinks, missingImages }) => (
          <div key={supplier.id} className="supplier-row">
            <strong>{supplier.supplier_name}</strong>
            <span>{categories.join(", ") || "No categories yet"}</span>
            <span>{supplier.active === false ? "Inactive" : "Active"}</span>
            <span>{supplier.website_url ? <a href={supplier.website_url} target="_blank" rel="noopener noreferrer">{supplier.website_url}</a> : "No website"}</span>
            <span>{productCount}</span>
            <span>{missingLinks}</span>
            <span>{missingImages}</span>
            <button type="button" onClick={onManageSuppliers}>Edit</button>
          </div>
        ))}
      </div>
      <style jsx>{adminPanelCss}</style>
    </section>
  );
}

function ImportProductsTab({
  importFile,
  importPreview,
  importBusy,
  importMode,
  onSetImportMode,
  onSetImportFile,
  onDownloadTemplate,
  onPreview,
  onConfirm,
}) {
  return (
    <section className="admin-panel">
      <div className="panel-heading">
        <div>
          <h2>Import Products</h2>
          <p>Upload client-selectable product CSVs, preview row-level validation, detect duplicates and choose how updates are applied.</p>
        </div>
        <button type="button" onClick={onDownloadTemplate}>Download CSV Template</button>
      </div>
      <div className="import-card">
        <label>
          CSV upload
          <input type="file" accept=".csv,text/csv" onChange={(event) => onSetImportFile(event.target.files?.[0] || null)} />
        </label>
        <div className="mode-row">
          <label><input type="radio" checked={importMode === "create_only"} onChange={() => onSetImportMode("create_only")} /> Add-new mode</label>
          <label><input type="radio" checked={importMode === "update_only"} onChange={() => onSetImportMode("update_only")} /> Update-existing mode</label>
          <label><input type="radio" checked={importMode === "upsert"} onChange={() => onSetImportMode("upsert")} /> Add or update</label>
        </div>
        <button type="button" disabled={!importFile || importBusy} onClick={onPreview}>{importBusy ? "Previewing..." : "Preview Import"}</button>
        {importPreview && (
          <div className="preview">
            <h3>Import preview</h3>
            <div className="preview-summary">
              <span>{importPreview.summary.totalRows} rows</span>
              <span>{importPreview.summary.new} new</span>
              <span>{importPreview.summary.matched} matched / duplicates</span>
              <span>{importPreview.summary.errors} row errors</span>
            </div>
            {importPreview.errors?.length ? (
              <div className="errors-table">
                {importPreview.errors.slice(0, 20).map((entry) => (
                  <p key={`${entry.row}-${entry.error}`}><strong>Row {entry.row}:</strong> {entry.error}</p>
                ))}
              </div>
            ) : <p className="ok">No row-level errors detected.</p>}
            <button type="button" disabled={importBusy || importPreview.summary.errors > 0} onClick={onConfirm}>{importBusy ? "Importing..." : "Import Products"}</button>
          </div>
        )}
      </div>
      <style jsx>{adminPanelCss}</style>
    </section>
  );
}

function CategoriesAndTagsTab({ categories, onManageCategories }) {
  const practicalGroups = [
    "Kitchen Appliances", "Tapware", "Sanitaryware", "Bathroom Accessories", "Tiles", "Flooring", "Cabinetry", "Benchtops", "Doors", "Door Hardware", "Robe Fitouts", "Roofing", "Bricks and Cladding", "Garage Doors", "Pool Finishes", "Paint and Colours",
  ];
  return (
    <section className="admin-panel">
      <div className="panel-heading">
        <div>
          <h2>Categories &amp; Tags</h2>
          <p>Manage selection categories, subcategories, requirement tags, compatible area types and inclusion tiers.</p>
        </div>
        <button type="button" onClick={onManageCategories}>Manage Categories</button>
      </div>
      <div className="taxonomy-grid">
        <article>
          <h3>Practical Groups</h3>
          <ul>{practicalGroups.map((group) => <li key={group}>{group}</li>)}</ul>
        </article>
        <article>
          <h3>Selection Category Groups</h3>
          {CLIENT_SELECTABLE_CATEGORY_GROUPS.map((group) => (
            <div key={group.group} className="tag-group">
              <strong>{group.group}</strong>
              <p>{group.categories.join(", ")}</p>
            </div>
          ))}
        </article>
        <article>
          <h3>Active Categories</h3>
          <ul>{categories.map((category) => <li key={category.id}>{category.category_name}{category.subcategory ? ` / ${category.subcategory}` : ""}</li>)}</ul>
        </article>
      </div>
      <style jsx>{adminPanelCss}</style>
    </section>
  );
}

const adminPanelCss = `
  .admin-panel {
    display: grid;
    gap: 14px;
  }
  .panel-heading,
  .import-card,
  .supplier-list,
  .taxonomy-grid article {
    border: 1px solid #d8e0ea;
    background: #ffffff;
    border-radius: 8px;
    padding: 16px;
  }
  .panel-heading {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: start;
  }
  h2,
  h3 {
    margin: 0;
    color: #172033;
  }
  .panel-heading p,
  .tag-group p {
    margin: 4px 0 0;
    color: #64748b;
    font-size: 13px;
  }
  button {
    border: 0;
    border-radius: 8px;
    background: #2563eb;
    color: #ffffff;
    cursor: pointer;
    font-weight: 800;
    padding: 9px 12px;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .supplier-list,
  .import-card {
    display: grid;
    gap: 10px;
  }
  .supplier-header,
  .supplier-row {
    display: grid;
    grid-template-columns: 1fr 1.4fr 0.7fr 1.3fr 0.55fr 0.7fr 0.7fr 0.55fr;
    gap: 10px;
    align-items: center;
  }
  .supplier-header {
    color: #64748b;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .supplier-row {
    border-top: 1px solid #e5eaf1;
    padding-top: 10px;
    color: #243044;
    font-size: 13px;
  }
  .supplier-row a {
    color: #2563eb;
    overflow-wrap: anywhere;
  }
  label {
    display: grid;
    gap: 7px;
    color: #243044;
    font-size: 13px;
    font-weight: 800;
  }
  input[type="file"] {
    border: 1px dashed #b7c3d2;
    border-radius: 8px;
    padding: 16px;
    background: #f8fafc;
  }
  .mode-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .mode-row label {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .preview {
    display: grid;
    gap: 10px;
    border-top: 1px solid #e5eaf1;
    padding-top: 12px;
  }
  .preview-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .preview-summary span {
    border-radius: 999px;
    background: #edf4fb;
    color: #17406f;
    font-size: 12px;
    font-weight: 800;
    padding: 5px 9px;
  }
  .errors-table {
    display: grid;
    gap: 5px;
    color: #991b1b;
  }
  .errors-table p,
  .ok {
    margin: 0;
    font-size: 13px;
  }
  .ok {
    color: #166534;
  }
  .taxonomy-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.4fr) minmax(0, 0.9fr);
    gap: 14px;
  }
  ul {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: grid;
    gap: 7px;
    color: #243044;
    font-size: 13px;
  }
  li {
    border: 1px solid #e5eaf1;
    border-radius: 7px;
    padding: 7px 9px;
    background: #f8fafc;
  }
  .tag-group {
    border-top: 1px solid #e5eaf1;
    margin-top: 10px;
    padding-top: 10px;
  }
  @media (max-width: 1000px) {
    .supplier-header {
      display: none;
    }
    .supplier-row {
      grid-template-columns: 1fr 1fr;
    }
    .taxonomy-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 640px) {
    .panel-heading {
      flex-direction: column;
    }
    .supplier-row {
      grid-template-columns: 1fr;
    }
  }
`;

function LibraryDashboard({ stats, canViewCosts }) {
  const tiles = [
    { label: "Active Products", value: stats.totalActive },
    { label: "Categories", value: stats.totalCategories },
    { label: "Suppliers", value: stats.totalSuppliers },
    { label: "Classic", value: stats.classicCount },
    { label: "Premier", value: stats.premierCount },
    { label: "Premium", value: stats.premiumCount },
    { label: "Standard Inclusions", value: stats.standardInclusionCount },
    { label: "Missing Images", value: stats.missingImageCount, warn: stats.missingImageCount > 0 },
    { label: "Inactive", value: stats.inactiveCount },
  ];
  // Product media/link verification report — surfaces exactly what the brief
  // asks an administrator to be able to see: missing links, unverified or
  // flagged images, broken links, discontinued products, and duplicates.
  const mediaReportTiles = [
    { label: "No Product URL", value: stats.noProductUrlCount, warn: stats.noProductUrlCount > 0 },
    { label: "Unverified Images", value: stats.unverifiedCount, warn: stats.unverifiedCount > 0 },
    { label: "Image Unavailable / Flagged", value: stats.imageUnavailableCount, warn: stats.imageUnavailableCount > 0 },
    { label: "Broken Links", value: stats.linkBrokenCount, warn: stats.linkBrokenCount > 0 },
    { label: "Discontinued", value: stats.discontinuedCount, warn: stats.discontinuedCount > 0 },
    { label: "Duplicate Product URLs", value: stats.duplicateUrlCount, warn: stats.duplicateUrlCount > 0 },
    { label: "Duplicate Product Codes", value: stats.duplicateSkuCount, warn: stats.duplicateSkuCount > 0 },
  ];
  return (
    <section className="dashboard">
      {tiles.map((tile) => (
        <div key={tile.label} className={tile.warn ? "tile warn" : "tile"}>
          <strong>{tile.value}</strong>
          <span>{tile.label}</span>
        </div>
      ))}
      <div className="reportHeading">Media &amp; Link Verification Report</div>
      {mediaReportTiles.map((tile) => (
        <div key={tile.label} className={tile.warn ? "tile warn" : "tile"}>
          <strong>{tile.value}</strong>
          <span>{tile.label}</span>
        </div>
      ))}
      <style jsx>{`
        .reportHeading {
          grid-column: 1 / -1;
          margin-top: 6px;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #93a4bd;
        }
        .dashboard {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
        }
        .tile {
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(15, 23, 42, 0.85);
          border-radius: 10px;
          padding: 12px;
          display: grid;
          gap: 2px;
        }
        .tile strong {
          font-size: 22px;
          color: #f8fafc;
        }
        .tile span {
          font-size: 11px;
          color: #93a4bd;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .tile.warn strong {
          color: #fbbf24;
        }
      `}</style>
    </section>
  );
}

function BulkUpdateModal({ categories, suppliers, onApply, onClose, saving }) {
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [active, setActive] = useState("");
  const [markupPercent, setMarkupPercent] = useState("");
  const [requiresImage, setRequiresImage] = useState("");
  const [libraryScope, setLibraryScope] = useState("");
  const [pricingTier, setPricingTier] = useState("");
  const [availableForSelection, setAvailableForSelection] = useState("");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>Bulk Update</h2>
        <label>
          Category
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Leave unchanged</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.category_name}</option>)}
          </select>
        </label>
        <label>
          Supplier
          <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">Leave unchanged</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>)}
          </select>
        </label>
        <label>
          Active status
          <select value={active} onChange={(event) => setActive(event.target.value)}>
            <option value="">Leave unchanged</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
        <label>
          Markup %
          <input type="number" step="0.1" value={markupPercent} onChange={(event) => setMarkupPercent(event.target.value)} placeholder="Leave blank to keep unchanged" />
        </label>
        <label>
          Requires image
          <select value={requiresImage} onChange={(event) => setRequiresImage(event.target.value)}>
            <option value="">Leave unchanged</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label>
          Library scope
          <select value={libraryScope} onChange={(event) => setLibraryScope(event.target.value)}>
            <option value="">Leave unchanged</option>
            {LIBRARY_SCOPES.map((scope) => <option key={scope.value} value={scope.value}>{scope.label}</option>)}
          </select>
        </label>
        <label>
          Pricing tier
          <select value={pricingTier} onChange={(event) => setPricingTier(event.target.value)}>
            <option value="">Leave unchanged</option>
            {PRICING_TIERS.map((tier) => <option key={tier.value} value={tier.value}>{tier.label}</option>)}
          </select>
        </label>
        <label>
          Available for selection
          <select value={availableForSelection} onChange={(event) => setAvailableForSelection(event.target.value)}>
            <option value="">Leave unchanged</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <div className="row">
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              onApply({
                ...(categoryId ? { category_id: categoryId } : {}),
                ...(supplierId ? { supplier_id: supplierId } : {}),
                ...(active ? { active: active === "true" } : {}),
                ...(markupPercent !== "" ? { markup_percent: Number(markupPercent) } : {}),
                ...(requiresImage ? { requires_image: requiresImage === "true" } : {}),
                ...(libraryScope ? { library_scope: libraryScope } : {}),
                ...(pricingTier ? { pricing_tier: pricingTier } : {}),
                ...(availableForSelection ? { available_for_selection: availableForSelection === "true" } : {}),
              })
            }
          >
            Apply to selected
          </button>
          <button type="button" className="danger" disabled={saving} onClick={() => onApply({ __delete: true })}>Archive selected</button>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        </div>
        <style jsx>{`
          label {
            display: grid;
            gap: 6px;
            font-size: 13px;
            font-weight: 700;
            color: #bfd0e8;
          }
          select,
          input {
            border: 1px solid rgba(148, 163, 184, 0.25);
            border-radius: 8px;
            background: #0f1c30;
            color: #e5eefb;
            padding: 9px 10px;
            font: inherit;
          }
          .row {
            display: flex;
            gap: 8px;
            margin-top: 6px;
          }
          button.danger {
            background: #b91c1c;
          }
        `}</style>
      </div>
    </div>
  );
}

function ProductLibraryCatalogue({ tree, onOpenProduct }) {
  if (!tree.length) return <p className="empty-catalogue">No client selection products match the current filters.</p>;
  return (
    <div className="catalogue">
      {tree.map((area) => (
        <section key={area.areaName} className="area">
          <h2>{area.areaName}</h2>
          <div className="category-grid">
            {area.categories.map((category) => (
              <article key={category.categoryName} className="category">
                <h3>{category.categoryName}</h3>
                {category.types.map((type) => (
                  <div key={type.typeName} className="type-group">
                    <h4>{type.typeName}</h4>
                    <div className="product-list">
                      {type.products.map((product) => (
                        <button key={product.id} type="button" className="product" onClick={() => onOpenProduct(product)}>
                          <span className="thumb">
                            {product.primary_image_url ? <img src={product.primary_image_url} alt="" loading="lazy" /> : <span>{product.product_name?.[0] || "P"}</span>}
                          </span>
                          <span className="copy">
                            <strong>{product.product_name}</strong>
                            <small>{[product.manufacturerName, product.model].filter(Boolean).join(" · ") || product.supplierName || "Selection item"}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </article>
            ))}
          </div>
        </section>
      ))}
      <style jsx>{`
        .catalogue {
          display: grid;
          gap: 22px;
        }
        .area {
          display: grid;
          gap: 12px;
        }
        h2,
        h3,
        h4 {
          margin: 0;
        }
        h2 {
          font-size: 21px;
          color: #f8fafc;
        }
        .category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 12px;
        }
        .category {
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.88);
          padding: 14px;
          display: grid;
          gap: 14px;
          align-content: start;
        }
        h3 {
          font-size: 15px;
          color: #bfdbfe;
        }
        .type-group {
          display: grid;
          gap: 8px;
        }
        h4 {
          font-size: 12px;
          color: #94a3b8;
          text-transform: uppercase;
        }
        .product-list {
          display: grid;
          gap: 8px;
        }
        .product {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          text-align: left;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 8px;
          background: rgba(2, 6, 23, 0.35);
          color: #e5eefb;
          padding: 8px;
        }
        .thumb {
          width: 48px;
          height: 48px;
          border-radius: 6px;
          background: #0b1626;
          display: grid;
          place-items: center;
          overflow: hidden;
          color: #38bdf8;
          font-weight: 800;
        }
        .thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .copy {
          display: grid;
          gap: 3px;
          min-width: 0;
        }
        .copy strong,
        .copy small {
          overflow-wrap: anywhere;
        }
        .copy strong {
          font-size: 13px;
        }
        .copy small {
          color: #93a4bd;
          font-size: 12px;
        }
        .empty-catalogue {
          color: #93a4bd;
          text-align: center;
          padding: 40px 0;
        }
      `}</style>
    </div>
  );
}

function ManageCategoriesModal({ workspaceId, categories, manufacturers, suppliers, onChanged, onClose }) {
  const [categoryName, setCategoryName] = useState("");
  const [manufacturerName, setManufacturerName] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [busy, setBusy] = useState(false);

  async function addCategory() {
    if (!categoryName.trim() || !workspaceId) return;
    setBusy(true);
    await supabase.from("builder_product_categories").insert({
      workspace_id: workspaceId,
      category_key: categoryName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      category_name: categoryName.trim(),
      active: true,
    });
    setCategoryName("");
    setBusy(false);
    onChanged();
  }
  async function addManufacturer() {
    if (!manufacturerName.trim() || !workspaceId) return;
    setBusy(true);
    await supabase.from("builder_product_manufacturers").insert({ workspace_id: workspaceId, manufacturer_name: manufacturerName.trim(), active: true });
    setManufacturerName("");
    setBusy(false);
    onChanged();
  }
  async function addSupplier() {
    if (!supplierName.trim() || !workspaceId) return;
    setBusy(true);
    await supabase.from("builder_product_suppliers").insert({ workspace_id: workspaceId, supplier_name: supplierName.trim(), active: true });
    setSupplierName("");
    setBusy(false);
    onChanged();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={(event) => event.stopPropagation()}>
        <h2>Manage Categories, Brands &amp; Suppliers</h2>
        <div className="columns">
          <div>
            <h3>Categories ({categories.length})</h3>
            <div className="add-row">
              <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="New category" />
              <button type="button" disabled={busy} onClick={addCategory}>Add</button>
            </div>
            <ul>{categories.map((category) => <li key={category.id}>{category.category_name}{category.workspace_id === null ? " (platform)" : ""}</li>)}</ul>
          </div>
          <div>
            <h3>Brands ({manufacturers.length})</h3>
            <div className="add-row">
              <input value={manufacturerName} onChange={(event) => setManufacturerName(event.target.value)} placeholder="New brand" />
              <button type="button" disabled={busy} onClick={addManufacturer}>Add</button>
            </div>
            <ul>{manufacturers.map((manufacturer) => <li key={manufacturer.id}>{manufacturer.manufacturer_name}</li>)}</ul>
          </div>
          <div>
            <h3>Suppliers ({suppliers.length})</h3>
            <div className="add-row">
              <input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="New supplier" />
              <button type="button" disabled={busy} onClick={addSupplier}>Add</button>
            </div>
            <ul>{suppliers.map((supplier) => <li key={supplier.id}>{supplier.supplier_name}{supplier.workspace_id === null ? " (platform)" : ""}</li>)}</ul>
          </div>
        </div>
        <button type="button" className="ghost" onClick={onClose}>Close</button>
        <style jsx>{`
          .modal.wide {
            width: min(760px, 94vw);
          }
          .columns {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 16px;
          }
          h3 {
            margin: 0 0 8px;
            font-size: 13px;
            color: #38bdf8;
            text-transform: uppercase;
          }
          .add-row {
            display: flex;
            gap: 6px;
            margin-bottom: 10px;
          }
          input {
            flex: 1;
            border: 1px solid rgba(148, 163, 184, 0.25);
            border-radius: 8px;
            background: #0f1c30;
            color: #e5eefb;
            padding: 8px 10px;
            font: inherit;
          }
          ul {
            list-style: none;
            margin: 0;
            padding: 0;
            max-height: 220px;
            overflow-y: auto;
            display: grid;
            gap: 4px;
            font-size: 12px;
            color: #cbd5e1;
          }
          @media (max-width: 720px) {
            .columns {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
