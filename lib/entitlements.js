// /lib/entitlements.js
// Returns the current workspace's plan and feature entitlements.
// Replaces the old user_modules / cookie-based approach.
//
// Server-side: use getWorkspacePlan(workspaceId) directly.
// Client-side: use the useEntitlements() hook (hooks/useEntitlements.js).

import { supabaseAdmin } from "./supabaseAdmin";
import { canUseFeature, getLimit, PLANS } from "./featureGates";

/**
 * Server-side: fetch a workspace's current plan from the DB.
 * @param {string} workspaceId
 * @returns {Promise<string>} plan name ("starter" | "growth" | "professional")
 */
export async function getWorkspacePlan(workspaceId) {
  if (!workspaceId) return "starter";

  try {
    const { data, error } = await supabaseAdmin
      .from("workspaces")
      .select("plan")
      .eq("id", workspaceId)
      .single();

    if (error || !data?.plan) return "starter";
    return data.plan;
  } catch (err) {
    console.error("getWorkspacePlan error:", err);
    return "starter";
  }
}

/**
 * Server-side: check if a workspace can use a feature.
 * @param {string} workspaceId
 * @param {string} feature - key from FEATURE_PLANS
 * @returns {Promise<boolean>}
 */
export async function workspaceCanUse(workspaceId, feature) {
  const plan = await getWorkspacePlan(workspaceId);
  return canUseFeature(plan, feature);
}

/**
 * Server-side: get the usage limit for a resource on this workspace's plan.
 * @param {string} workspaceId
 * @param {string} resource
 * @returns {Promise<number|null>} null = unlimited
 */
export async function getWorkspaceLimit(workspaceId, resource) {
  const plan = await getWorkspacePlan(workspaceId);
  return getLimit(plan, resource);
}

// Legacy compat — kept so any existing imports don't crash.
// Returns an empty Set; callers should migrate to workspaceCanUse().
export async function getEntitlements() {
  console.warn(
    "[entitlements] getEntitlements() is deprecated. Use workspaceCanUse(workspaceId, feature) instead."
  );
  return new Set();
}

