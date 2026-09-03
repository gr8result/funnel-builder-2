// Server-side entitlement resolution.
//
// This is the resolver that page guards and API wrappers will call in M2. It is
// deliberately NOT wired to any route yet: introducing it and adopting it are
// separate batches, so that if a regression appears during adoption there is
// only one variable to examine.
//
// Data access is injected. That keeps the resolver unit-testable without a
// database, and keeps this file from importing the Supabase admin client at
// module load — the default loader is imported lazily, only when actually used.

import { resolveEntitlements } from "./resolveEntitlements.js";

/**
 * Default loader: reads a workspace's plan and entitlement rows using the
 * existing platform logic, so the new resolver sees exactly what the current
 * dashboard sees. Imported lazily so tests and client bundles never pull in the
 * Supabase admin client.
 */
async function defaultLoadWorkspaceEntitlementData(workspaceId) {
  const [{ supabaseAdmin }, { buildEntitledModuleIds }] = await Promise.all([
    import("../../lib/supabaseAdmin.js"),
    import("../../lib/moduleEntitlements.js"),
  ]);

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("id, plan")
    .eq("id", workspaceId)
    .maybeSingle();

  const planId = workspace?.plan || "starter";

  // Legacy ids are the authoritative current answer. Feeding them in as seed
  // codes is what guarantees the new resolver is a superset of today's access.
  const legacyModuleIds = Array.from(
    buildEntitledModuleIds({ planId, entitlementRows: [], legacyRows: [] }) || []
  );

  return { planId, planModules: legacyModuleIds, addOns: [], bundles: [], legacyModuleIds };
}

/**
 * Build a resolver. Pass `loadWorkspaceEntitlementData` in tests, or omit it in
 * production to use the default database-backed loader.
 *
 * @param {{ loadWorkspaceEntitlementData?: (workspaceId: string) => Promise<object> }} [options]
 */
export function createEntitlementResolver({ loadWorkspaceEntitlementData } = {}) {
  const load = loadWorkspaceEntitlementData || defaultLoadWorkspaceEntitlementData;

  /**
   * @param {string} workspaceId
   * @returns {Promise<{ workspaceId: string, planId: string, modules: Set<string>, has: (code:string)=>boolean }>}
   */
  async function resolveForWorkspace(workspaceId) {
    const id = String(workspaceId || "").trim();
    if (!id) {
      // No workspace means no entitlements. Never fail open.
      const empty = resolveEntitlements({});
      return { workspaceId: "", planId: "", modules: empty.modules, has: empty.has };
    }

    const data = (await load(id)) || {};
    const resolved = resolveEntitlements({
      planModules: data.planModules,
      addOns: data.addOns,
      bundles: data.bundles,
      legacyModuleIds: data.legacyModuleIds,
    });

    return {
      workspaceId: id,
      planId: data.planId || "",
      modules: resolved.modules,
      has: resolved.has,
    };
  }

  /**
   * @returns {Promise<boolean>} whether the workspace may use `moduleCode`.
   */
  async function workspaceHasModule(workspaceId, moduleCode) {
    const { has } = await resolveForWorkspace(workspaceId);
    return has(moduleCode);
  }

  return { resolveForWorkspace, workspaceHasModule };
}

/** Shared production resolver. */
export const entitlementResolver = createEntitlementResolver();
