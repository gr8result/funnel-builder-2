// Resource and method policy for /api/freedom/[resource] (M2.1).
//
// Before this policy existed the route accepted ANY key of FREEDOM_TABLES - 36
// tables including portfolios, portfolio_holdings, transactions, cash_balance
// and performance_history - across GET, POST, PUT, PATCH and DELETE, through a
// service-role client, with no authentication.
//
// The allowlist below is deliberately EMPTY.
//
// A repository-wide search of pages/, components/ and lib/ found that every
// /api/freedom/<name> call made by the current UI resolves to its own dedicated
// route file (chart.js, long-term.js, trades.js, opportunities.js,
// cmc-market-import.js, resolve-ticker.js, import-trades.js and the other named
// handlers). Nothing in the application reaches the [resource] catch-all, and no
// script or server module calls it either. It has no known consumer.
//
// So the safe emergency posture is to close it entirely rather than guess which
// of the 36 tables ought to stay reachable. Re-enabling a resource is a
// deliberate, reviewable act: add an entry below naming the resource, the
// methods it needs, and the fields a client may write.
//
// Shape of an entry:
//   companies: { methods: ["GET"], writableFields: [] }

/** @type {Record<string, {methods: string[], writableFields: string[]}>} */
export const FREEDOM_RESOURCE_POLICY = Object.freeze({
  // Intentionally empty. See the note above before adding anything.
});

/**
 * Fields a client may never set, on any resource, regardless of allowlist.
 * These carry ownership, identity, role or audit meaning and must be decided by
 * the server.
 */
export const NEVER_WRITABLE_FIELDS = Object.freeze([
  "id",
  "user_id",
  "userId",
  "workspace_id",
  "workspaceId",
  "account_id",
  "accountId",
  "owner_id",
  "ownerId",
  "org_id",
  "organisation_id",
  "organization_id",
  "role",
  "roles",
  "is_admin",
  "isAdmin",
  "is_owner",
  "admin",
  "permissions",
  "entitlements",
  "created_by",
  "createdBy",
  "created_at",
  "updated_at",
]);

export function isResourceAllowed(resource) {
  const key = String(resource ?? "").trim();
  if (!key) return false;
  return Object.prototype.hasOwnProperty.call(FREEDOM_RESOURCE_POLICY, key);
}

export function isMethodAllowed(resource, method) {
  if (!isResourceAllowed(resource)) return false;
  const allowed = FREEDOM_RESOURCE_POLICY[String(resource).trim()].methods || [];
  return allowed.includes(String(method || "").toUpperCase());
}

export function allowedMethodsFor(resource) {
  if (!isResourceAllowed(resource)) return [];
  return [...(FREEDOM_RESOURCE_POLICY[String(resource).trim()].methods || [])];
}

/**
 * Reduce a client payload to the fields the policy permits for this resource,
 * with the never-writable list applied on top. Returns a new object; the input
 * is not mutated.
 */
export function filterWritableFields(resource, payload = {}) {
  if (!isResourceAllowed(resource)) return {};
  const allowed = FREEDOM_RESOURCE_POLICY[String(resource).trim()].writableFields || [];
  const out = {};
  for (const key of Object.keys(payload || {})) {
    if (NEVER_WRITABLE_FIELDS.includes(key)) continue;
    if (!allowed.includes(key)) continue;
    out[key] = payload[key];
  }
  return out;
}
