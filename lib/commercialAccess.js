export const INTERNAL_COMMERCIAL_ROLES = Object.freeze([
  "owner", "admin", "builder", "builder_admin", "builder_staff", "estimator",
  "interior_designer", "sales",
]);

export function hasInternalCommercialAccess(role) {
  return INTERNAL_COMMERCIAL_ROLES.includes(String(role || "").trim().toLowerCase());
}
