import { PRODUCT_LIBRARY_SCOPES, SELECTION_VISIBILITY_SET, normalizeLibraryScope } from "./constants.js";

export function normalizeSelectionVisibility(value, product = {}) {
  const explicit = String(value ?? product.selection_visibility ?? product.selectionVisibility ?? "").trim().toLowerCase();
  if (SELECTION_VISIBILITY_SET.has(explicit)) return explicit;

  const activeStatus = normalizeActiveStatus(product.active_status ?? product.activeStatus, product);
  if (activeStatus === "archived") return "archived";
  if (activeStatus === "inactive" && product.available_for_selection === false) return "hidden";

  const scope = normalizeLibraryScope(product.library_scope ?? product.libraryScope, "CLIENT_SELECTION");
  if (scope === "ESTIMATING") return "estimating_only";
  if (scope === "BOTH") return product.available_for_selection === false ? "estimating_only" : "builder_selectable";
  if (product.available_for_selection === false) return "hidden";
  return "client_selectable";
}

export function normalizeActiveStatus(value, product = {}) {
  const text = String(value ?? product.activeStatus ?? "").trim().toLowerCase();
  if (text === "archived" || product.archived === true) return "archived";
  if (text === "inactive" || product.active === false) return "inactive";
  return "active";
}

export function normalizeDiscontinuedStatus(value, product = {}) {
  const text = String(value ?? product.discontinued_status ?? product.discontinuedStatus ?? "").trim().toLowerCase();
  if (text === "discontinued" || product.discontinued === true || product.availability_status === "discontinued" || product.verification_status === "discontinued") return "discontinued";
  if (text === "unknown") return "unknown";
  return "current";
}

export function selectionVisibilityFlags(product = {}) {
  const selectionVisibility = normalizeSelectionVisibility(product.selection_visibility, product);
  const activeStatus = normalizeActiveStatus(product.active_status, product);
  const discontinuedStatus = normalizeDiscontinuedStatus(product.discontinued_status, product);
  return {
    selectionVisibility,
    isClientSelectable: selectionVisibility === "client_selectable",
    isBuilderSelectable: selectionVisibility === "builder_selectable",
    isEstimatingResource: selectionVisibility === "estimating_only" || !PRODUCT_LIBRARY_SCOPES.has(normalizeLibraryScope(product.library_scope, "CLIENT_SELECTION")),
    activeStatus,
    discontinuedStatus,
  };
}

export function isSelectionsCatalogueProduct(product = {}, options = {}) {
  const { includeBuilderSelectable = true, includeInactive = false, includeDiscontinued = false } = options;
  const flags = selectionVisibilityFlags(product);
  const visible = flags.isClientSelectable || (includeBuilderSelectable && flags.isBuilderSelectable);
  if (!visible) return false;
  if (!includeInactive && flags.activeStatus !== "active") return false;
  if (!includeDiscontinued && flags.discontinuedStatus === "discontinued") return false;
  return true;
}

export function selectionVisibilityToLegacyScope(selectionVisibility) {
  if (selectionVisibility === "estimating_only") return "ESTIMATING";
  if (selectionVisibility === "builder_selectable") return "BOTH";
  return "CLIENT_SELECTION";
}
