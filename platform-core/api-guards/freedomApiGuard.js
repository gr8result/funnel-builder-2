// Emergency access guard for the Freedom module API (M2.1).
//
// Every Freedom route was reachable with no authentication. This guard closes
// that. It runs BEFORE any Freedom data client is created, so an anonymous
// request never reaches a service-role query.
//
// Three rules this guard exists to enforce:
//
//   1. A service-role client is NOT authentication. The Supabase admin client is
//      used here for exactly one purpose - validating the caller's bearer token -
//      and never to read Freedom data before the caller has passed both the
//      session and entitlement checks.
//
//   2. Identity is never taken from the request. workspace_id, user_id and
//      account_id in the query, body or headers are ignored entirely. The
//      caller's workspaces are resolved from workspace_members using the id
//      inside their validated token.
//
//   3. Freedom tables have no workspace_id column and no RLS yet (M5A). So
//      authentication plus entitlement does NOT give tenant isolation: every
//      Freedom row is currently global. Rather than serve global financial rows
//      to everyone holding a freedom entitlement, data routes FAIL CLOSED unless
//      the platform can prove a single owner holds the entitlement. See
//      resolveSoleFreedomOwner below.
//
// Dependencies are injected so this is testable without a database.

import { resolveEntitlements } from "../subscription-entitlements/resolveEntitlements.js";

export const FREEDOM_MODULE_CODE = "freedom";

export const DENY = Object.freeze({
  NO_TOKEN: { status: 401, error: "Authentication required." },
  BAD_TOKEN: { status: 401, error: "Authentication required." },
  NO_WORKSPACE: { status: 403, error: "No workspace membership." },
  NOT_ENTITLED: { status: 403, error: "The Freedom module is not included in your subscription." },
  NO_PROVABLE_OWNER: {
    status: 503,
    error:
      "Freedom data is temporarily unavailable. Per-workspace isolation is not yet in place, " +
      "so access is withheld until the tenancy migration completes.",
  },
});

function bearerToken(req) {
  const raw = String(req?.headers?.authorization || "").trim();
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

/** Default loader set. Imported lazily so tests never touch the database. */
async function defaultDeps() {
  const { supabaseAdmin } = await import("../../lib/supabaseAdmin.js");
  return {
    // Token validation only. Never used for Freedom data before checks pass.
    async getUserFromToken(token) {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data?.user?.id) return null;
      return { id: data.user.id };
    },
    async listWorkspaceIdsForUser(userId) {
      const { data } = await supabaseAdmin
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", userId);
      return (data || []).map((row) => row.workspace_id).filter(Boolean);
    },
    async listModuleCodesForUser(userId) {
      const { data } = await supabaseAdmin
        .from("user_modules")
        .select("module_id")
        .eq("user_id", userId);
      return (data || []).map((row) => row.module_id).filter(Boolean);
    },
    async listModuleCodesForWorkspaces(workspaceIds) {
      if (!workspaceIds.length) return [];
      const { data } = await supabaseAdmin
        .from("workspace_entitlements")
        .select("module_id, enabled")
        .in("workspace_id", workspaceIds)
        .eq("enabled", true);
      return (data || []).map((row) => row.module_id).filter(Boolean);
    },
    // Distinct holders of the freedom entitlement, across both entitlement stores.
    async listFreedomHolders() {
      const [{ data: users }, { data: workspaces }] = await Promise.all([
        supabaseAdmin.from("user_modules").select("user_id").eq("module_id", FREEDOM_MODULE_CODE),
        supabaseAdmin
          .from("workspace_entitlements")
          .select("workspace_id")
          .eq("module_id", FREEDOM_MODULE_CODE)
          .eq("enabled", true),
      ]);
      return {
        userIds: [...new Set((users || []).map((r) => r.user_id).filter(Boolean))],
        workspaceIds: [...new Set((workspaces || []).map((r) => r.workspace_id).filter(Boolean))],
      };
    },
  };
}

/**
 * Decide whether the caller may reach Freedom DATA.
 *
 * Freedom rows are global today, so "entitled" is not the same as "owns these
 * rows". Access is granted only when the entitlement is provably held by a
 * single owner and the caller is that owner. Any other shape - nobody holds it,
 * or several parties do - fails closed, because serving the rows would show one
 * customer's financial data to another.
 *
 * This deliberately derives the owner from entitlement records at runtime. There
 * is no hardcoded email, id or domain anywhere in this file.
 */
export async function resolveSoleFreedomOwner(deps, { userId, workspaceIds }) {
  const holders = await deps.listFreedomHolders();
  const holderCount = holders.userIds.length + holders.workspaceIds.length;

  if (holderCount !== 1) {
    return { allowed: false, reason: holderCount === 0 ? "no-holder" : "multiple-holders", holderCount };
  }

  const isOwner =
    holders.userIds.includes(userId) ||
    holders.workspaceIds.some((id) => workspaceIds.includes(id));

  return isOwner
    ? { allowed: true, holderCount, ownerWorkspaceIds: holders.workspaceIds }
    : { allowed: false, reason: "not-owner", holderCount };
}

/**
 * Authenticate and authorise a Freedom API request.
 *
 * @param {object} req                     Next.js request
 * @param {object} [options]
 * @param {boolean} [options.touchesData]  true when the handler reads or writes
 *                                         Freedom tables. Data routes are held
 *                                         to the extra isolation rule above.
 * @param {object} [options.deps]          injected dependencies (tests)
 * @returns {Promise<{ok: true, auth: object} | {ok: false, status: number, error: string}>}
 */
export async function authoriseFreedomRequest(req, { touchesData = true, deps } = {}) {
  const d = deps || (await defaultDeps());

  const token = bearerToken(req);
  if (!token) return { ok: false, ...DENY.NO_TOKEN };

  const user = await d.getUserFromToken(token);
  if (!user?.id) return { ok: false, ...DENY.BAD_TOKEN };

  // Identity comes from the token, never from the request payload.
  const workspaceIds = (await d.listWorkspaceIdsForUser(user.id)) || [];

  const [userCodes, workspaceCodes] = await Promise.all([
    d.listModuleCodesForUser(user.id),
    d.listModuleCodesForWorkspaces(workspaceIds),
  ]);

  const entitled = resolveEntitlements({
    legacyModuleIds: [...(userCodes || []), ...(workspaceCodes || [])],
  });

  if (!entitled.has(FREEDOM_MODULE_CODE)) return { ok: false, ...DENY.NOT_ENTITLED };

  if (!touchesData) {
    return { ok: true, auth: { userId: user.id, workspaceIds, ownerVerified: false } };
  }

  const owner = await resolveSoleFreedomOwner(d, { userId: user.id, workspaceIds });
  if (!owner.allowed) {
    return { ok: false, ...DENY.NO_PROVABLE_OWNER, reason: owner.reason };
  }

  return { ok: true, auth: { userId: user.id, workspaceIds, ownerVerified: true } };
}

/**
 * Wrap a Next.js API handler so it cannot run without a valid session and the
 * freedom entitlement.
 */
export function withFreedomApi(handler, options = {}) {
  return async function guardedFreedomHandler(req, res) {
    const result = await authoriseFreedomRequest(req, options);
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }
    req.freedomAuth = result.auth;
    return handler(req, res);
  };
}
