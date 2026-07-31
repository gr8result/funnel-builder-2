import type { ProductReference } from "./productReferenceTypes";

export type SelectionVisibility = "client_selectable" | "builder_selectable" | "estimating_only" | "hidden" | "archived";
export type ActiveStatus = "active" | "inactive" | "archived";
export type DiscontinuedStatus = "current" | "discontinued" | "unknown";

const visibilityValues = new Set<SelectionVisibility>(["client_selectable", "builder_selectable", "estimating_only", "hidden", "archived"]);

export function normalizeSelectionVisibility(product: Partial<ProductReference>): SelectionVisibility {
  const explicit = String(product.selectionVisibility ?? "").trim().toLowerCase() as SelectionVisibility;
  if (visibilityValues.has(explicit)) return explicit;
  if (product.isEstimatingResource) return "estimating_only";
  if (product.isBuilderSelectable) return "builder_selectable";
  if (product.isClientSelectable === false) return "hidden";
  if (product.active === false) return "hidden";
  return "client_selectable";
}

export function activeStatusForProduct(product: Partial<ProductReference>): ActiveStatus {
  if (product.activeStatus === "archived") return "archived";
  if (product.activeStatus === "inactive" || product.active === false) return "inactive";
  return "active";
}

export function discontinuedStatusForProduct(product: Partial<ProductReference>): DiscontinuedStatus {
  if (product.discontinuedStatus === "discontinued" || product.discontinued || product.availabilityStatus === "discontinued") return "discontinued";
  if (product.discontinuedStatus === "unknown") return "unknown";
  return "current";
}

export function isProductVisibleInSelections(product: Partial<ProductReference>, includeBuilderSelectable = true): boolean {
  const visibility = normalizeSelectionVisibility(product);
  if (visibility !== "client_selectable" && !(includeBuilderSelectable && visibility === "builder_selectable")) return false;
  if (activeStatusForProduct(product) !== "active") return false;
  if (discontinuedStatusForProduct(product) === "discontinued") return false;
  return true;
}
