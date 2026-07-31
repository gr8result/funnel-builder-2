import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { COST_ROLES } from "../../../lib/product-library/constants";
import { selectionVisibilityFlags } from "../../../lib/product-library/selectionVisibility";

const SORTABLE_COLUMNS = new Set(["product_name", "sku", "updated_at", "cost_price", "sell_price", "display_order", "pricing_tier"]);
const MAX_PAGE_SIZE = 200;

export function buildProductListQuery(query = {}, workspaceId) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.pageSize) || 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sortBy = SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : "updated_at";
  const sortAscending = query.sortDirection === "asc";

  const filters = {
    search: String(query.search || "").trim(),
    categoryId: query.categoryId && query.categoryId !== "all" ? String(query.categoryId) : null,
    supplierId: query.supplierId && query.supplierId !== "all" ? String(query.supplierId) : null,
    manufacturerId: query.manufacturerId && query.manufacturerId !== "all" ? String(query.manufacturerId) : null,
    pricingTier: query.pricingTier && query.pricingTier !== "all" ? String(query.pricingTier).toUpperCase() : null,
    active: query.active === "active" ? true : query.active === "inactive" ? false : null,
    availableForSelection: query.availableForSelection === "true" ? true : query.availableForSelection === "false" ? false : null,
    selectionVisibility: query.selectionVisibility === "all" ? null : query.selectionVisibility ? String(query.selectionVisibility) : "client_selectable",
    discontinued: query.discontinued && query.discontinued !== "all" ? String(query.discontinued) : "current",
    standardInclusion: query.standardInclusion === "true" ? true : query.standardInclusion === "false" ? false : null,
    missingImages: query.missingImages === "missing",
    missingSupplierLink: query.missingSupplierLink === "missing",
    missingTags: query.missingTags === "missing",
  };

  return { page, pageSize, from, to, sortBy, sortAscending, filters, workspaceId };
}

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { pageSize, from, to, sortBy, sortAscending, filters, page } = buildProductListQuery(req.query, req.workspaceId);

    let request = supabaseAdmin
      .from("builder_products")
      .select("*", { count: "exact" })
      .eq("workspace_id", req.workspaceId)
      .in("library_scope", filters.selectionVisibility === "estimating_only" ? ["ESTIMATING"] : filters.selectionVisibility ? ["CLIENT_SELECTION", "BOTH"] : ["CLIENT_SELECTION", "BOTH", "ESTIMATING"]);

    if (filters.categoryId) request = request.eq("category_id", filters.categoryId);
    if (filters.supplierId) request = request.eq("supplier_id", filters.supplierId);
    if (filters.manufacturerId) request = request.eq("manufacturer_id", filters.manufacturerId);
    if (filters.pricingTier) request = request.eq("pricing_tier", filters.pricingTier);
    if (filters.active !== null) request = request.eq("active", filters.active);
    if (filters.availableForSelection !== null) request = request.eq("available_for_selection", filters.availableForSelection);
    if (filters.selectionVisibility) request = request.eq("selection_visibility", filters.selectionVisibility);
    if (filters.discontinued === "current") request = request.neq("discontinued_status", "discontinued");
    if (filters.discontinued === "discontinued") request = request.eq("discontinued_status", "discontinued");
    if (filters.standardInclusion !== null) request = request.eq("standard_included", filters.standardInclusion);
    if (filters.missingImages) request = request.eq("requires_image", true).is("primary_image_url", null);
    if (filters.missingSupplierLink) request = request.is("product_url", null);
    if (filters.missingTags) request = request.or("requirement_tags.is.null,requirement_tags.eq.");
    if (filters.search) {
      const term = filters.search.replace(/[%,]/g, "");
      request = request.or(
        `product_name.ilike.%${term}%,sku.ilike.%${term}%,model.ilike.%${term}%,description.ilike.%${term}%`
      );
    }

    request = request.order(sortBy, { ascending: sortAscending }).range(from, to);

    const { data, count, error } = await request;
    if (error) throw error;

    const canViewCosts = COST_ROLES.has(req.memberRole);
    const decorated = (data || []).filter((product) => {
      const flags = selectionVisibilityFlags(product);
      if (filters.selectionVisibility && flags.selectionVisibility !== filters.selectionVisibility) return false;
      if (filters.discontinued === "current" && flags.discontinuedStatus === "discontinued") return false;
      if (filters.discontinued === "discontinued" && flags.discontinuedStatus !== "discontinued") return false;
      return true;
    });
    const rows = canViewCosts
      ? decorated
      : decorated.map(({ cost_price, sell_price, markup_percent, ...rest }) => rest);

    return res.status(200).json({
      ok: true,
      rows,
      page,
      pageSize,
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "Could not load products." });
  }
}

export default withWorkspace(handler);
