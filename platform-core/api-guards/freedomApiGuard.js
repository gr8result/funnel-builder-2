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
//   3. Tenant isolation depends on which storage backend is live, so this guard
//      applies a different rule to each (Stage 3):
//
//      SUPABASE backend - freedom_positions and friends carry workspace_id and
//      user_id, with RLS enforcing workspace membership. Isolation is real, so a
//      data route requires the caller to resolve to exactly one workspace and
//      operates inside it. See resolveFreedomWorkspaceId.
//
//      JSON backend - rows are still a single global file with no owner. So the
//      original emergency rule stands unchanged: data routes FAIL CLOSED unless
//      the platform can prove a single owner holds the entitlement, because
//      serving global rows to every entitled caller would show one customer's
//      financial data to another. See resolveSoleFreedomOwner.
//
//      The rule is gated on the backend rather than deleted, so rolling back to
//      the JSON store also rolls back to the protection that store requires.
//      Verified platform administrators use the existing adminUsers policy.
//
// Dependencies are injected so this is testable without a database.

import { resolveEntitlements } from "../subscription-entitlements/resolveEntitlements.js";
import { isDeveloperEmail } from "../../lib/adminUsers.js";
import { isSupabaseBackend } from "../../lib/freedom/freedomStoreBackend.js";

export const FREEDOM_MODULE_CODE = "freedom";

// Every denial carries a machine-readable `code`. This is a diagnosis aid, not a
// relaxation: the status codes are unchanged, and a code only describes the state
// of the caller's OWN request. It exists because "no token was sent" and "the token
// was rejected" are different failures with different fixes, and collapsing both
// into one opaque 401 made a signed-out browser look like a broken guard.
export const DENY = Object.freeze({
  NO_TOKEN: { status: 401, code: "no_token", error: "Not signed in. Sign in to continue." },
  BAD_TOKEN: { status: 401, code: "invalid_token", error: "Your session is no longer valid. Sign in again." },
  NO_WORKSPACE: { status: 403, code: "no_workspace", error: "No workspace membership." },
  NOT_ENTITLED: { status: 403, code: "not_entitled", error: "The Freedom module is not included in your subscription." },
  NO_PROVABLE_OWNER: {
    status: 503,
    code: "no_provable_owner",
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
      return { id: data.user.id, email: data.user.email, emailConfirmedAt: data.user.email_confirmed_at };
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

  // Identity comes from the token, never from the request payload. This is now
  // resolved for platform admins too: Freedom rows are workspace-scoped once the
  // Supabase backend is active, so even an admin request needs a workspace to
  // operate in. It is a lookup, not a permission - the admin check below is
  // unchanged.
  const workspaceIds = (await d.listWorkspaceIdsForUser(user.id)) || [];

  // Use the same platform-admin policy as the authenticated demo-company APIs.
  // Only Supabase's verified identity is consulted; request emails/roles are ignored.
  if (user.emailConfirmedAt && isDeveloperEmail(user.email)) {
    return {
      ok: true,
      auth: {
        userId: user.id,
        workspaceIds,
        freedomWorkspaceId: resolveFreedomWorkspaceId({ workspaceIds, platformAdmin: true }),
        ownerVerified: true,
        platformAdmin: true,
      },
    };
  }

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

  const freedomWorkspaceId = resolveFreedomWorkspaceId({ workspaceIds, platformAdmin: false });

  // Once Freedom rows carry workspace_id and RLS (Stage 3), tenancy is real and
  // the global fail-closed below is no longer what protects one customer's
  // financial data from another - the workspace scope is. Membership of a
  // resolvable workspace becomes the requirement instead.
  //
  // On the JSON backend nothing has changed: rows are still global and shared,
  // so the original sole-owner rule stays exactly as it was. This is gated on the
  // storage backend rather than removed, because removing it while the JSON store
  // is still live would expose global rows to every entitled caller.
  if (isSupabaseBackend()) {
    if (!freedomWorkspaceId) {
      return { ok: false, ...DENY.NO_WORKSPACE, reason: "unresolved-workspace" };
    }
    return { ok: true, auth: { userId: user.id, workspaceIds, freedomWorkspaceId, ownerVerified: true } };
  }

  const owner = await resolveSoleFreedomOwner(d, { userId: user.id, workspaceIds });
  if (!owner.allowed) {
    return { ok: false, ...DENY.NO_PROVABLE_OWNER, reason: owner.reason };
  }

  return { ok: true, auth: { userId: user.id, workspaceIds, freedomWorkspaceId, ownerVerified: true } };
}

/**
 * The single workspace a Freedom request operates in.
 *
 * Freedom stores one portfolio per workspace, so a request needs exactly one
 * workspace id, while a user may belong to several. Resolution order:
 *
 *   1. FREEDOM_WORKSPACE_ID, when the caller is actually a member of it. The
 *      membership check is what stops the variable becoming a way to reach
 *      someone else's data; a platform admin is exempt, matching the admin
 *      policy already applied above.
 *   2. The caller's only workspace, when they have exactly one.
 *   3. null - ambiguous. The caller belongs to several workspaces and none was
 *      nominated, so there is no safe way to guess which portfolio they mean.
 *      Callers treat null as a denial rather than picking one.
 *
 * Never read from the request. Query, body and headers are ignored entirely.
 */
export function resolveFreedomWorkspaceId({ workspaceIds = [], platformAdmin = false } = {}) {
  const configured = String(process.env.FREEDOM_WORKSPACE_ID || "").trim();
  if (configured) {
    if (platformAdmin || workspaceIds.includes(configured)) return configured;
    return null;
  }
  return workspaceIds.length === 1 ? workspaceIds[0] : null;
}

/**
 * Wrap a Next.js API handler so it cannot run without a valid session and the
 * freedom entitlement.
 */
export function withFreedomApi(handler, options = {}) {
  return async function guardedFreedomHandler(req, res) {
    try {
      const result = await authoriseFreedomRequest(req, options);
      if (!result.ok) {
        return res.status(result.status).json({ ok: false, code: result.code || "denied", error: result.error });
      }
      req.freedomAuth = result.auth;

      // Bind storage tenancy here rather than in each route, so a handler cannot
      // forget it and end up reading with no workspace scope. The ids come from
      // the validated token via result.auth - never from the request.
      if (isSupabaseBackend() && options.touchesData !== false) {
        const { setFreedomStoreContext } = await import("../../lib/freedom/freedomStoreSupabase.js");
        const restore = setFreedomStoreContext({
          workspaceId: result.auth.freedomWorkspaceId,
          userId: result.auth.userId,
        });
        try {
          return await handler(req, res);
        } finally {
          restore();
        }
      }

      return await handler(req, res);
    } catch {
      return res.status(500).json({ ok: false, error: "Freedom could not complete the request. Please retry." });
    }
  };
}
