import { PLANS } from "./featureGates";
import PRICING, { BASE_PLAN_INCLUDES } from "../data/pricing";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);
const WEBSITE_PLAN_TO_BASE_PLAN = {
  "website-starter": "starter",
  "website-growth": "growth",
  "website-pro": "scale",
  "website-agency": "professional",
};

export function normalizePlanId(value) {
  const plan = String(value || "").trim().toLowerCase();
  return PLANS[plan] ? plan : "";
}

export function highestPlan(...values) {
  return values
    .map(normalizePlanId)
    .filter(Boolean)
    .sort((a, b) => (PLANS[b]?.order || 0) - (PLANS[a]?.order || 0))[0] || "starter";
}

export function normalizeWebsitePlanId(value) {
  const plan = String(value || "").trim().toLowerCase();
  return PRICING[plan]?.limits?.websites != null ? plan : "";
}

function includedWebsitePlanForBasePlan(plan) {
  return BASE_PLAN_INCLUDES[normalizePlanId(plan)]?.website?.tierId || "";
}

export async function getUserPlan(supabaseAdmin, userId) {
  const authUserId = String(userId || "").trim();
  if (!authUserId) {
    return { plan: "starter", workspaceId: null, workspacePlan: "starter", subscriptionPlan: null, accountId: null };
  }

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("id, plan")
    .eq("owner_id", authUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let accountId = null;
  try {
    const { data: account } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("user_id", authUserId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    accountId = account?.id ? String(account.id) : null;
  } catch (error) {
    console.warn("[planResolver] Could not read accounts table:", error?.message || error);
  }

  let subscriptionPlan = null;
  let websitePlan = null;
  try {
    const accountIds = Array.from(new Set([authUserId, accountId].filter(Boolean)));
    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_id, status, current_period_end")
      .in("account_id", accountIds)
      .in("status", Array.from(ACTIVE_SUBSCRIPTION_STATUSES))
      .limit(1)
      .maybeSingle();

    subscriptionPlan = normalizePlanId(subscription?.plan_id) || null;
  } catch (error) {
    console.warn("[planResolver] Could not read subscriptions table:", error?.message || error);
  }

  try {
    const { data: moduleRows } = await supabaseAdmin
      .from("user_modules")
      .select("module_id, activated_at")
      .eq("user_id", authUserId)
      .like("module_id", "__website_plan_tier:%")
      .order("activated_at", { ascending: false })
      .limit(1);

    const tier = String(moduleRows?.[0]?.module_id || "").replace(/^__website_plan_tier:/, "");
    websitePlan = normalizeWebsitePlanId(tier) || null;
  } catch (error) {
    console.warn("[planResolver] Could not read website plan tier:", error?.message || error);
  }

  const workspacePlan = normalizePlanId(workspace?.plan) || "starter";
  const plan = highestPlan(workspacePlan, subscriptionPlan, WEBSITE_PLAN_TO_BASE_PLAN[websitePlan]);
  if (workspace?.id && plan !== workspacePlan && (PLANS[plan]?.order || 0) > (PLANS[workspacePlan]?.order || 0)) {
    await supabaseAdmin
      .from("workspaces")
      .update({ plan, updated_at: new Date().toISOString() })
      .eq("id", workspace.id);
  }

  return {
    plan,
    workspaceId: workspace?.id || null,
    workspacePlan,
    subscriptionPlan,
    websitePlan,
    accountId,
  };
}

export function getWebsiteLimitForResolvedPlan(resolvedPlan) {
  const baseWebsitePlan = includedWebsitePlanForBasePlan(resolvedPlan?.plan);
  const bestWebsitePlan = [baseWebsitePlan, resolvedPlan?.websitePlan]
    .map(normalizeWebsitePlanId)
    .filter(Boolean)
    .sort((a, b) => {
      const aBase = WEBSITE_PLAN_TO_BASE_PLAN[a];
      const bBase = WEBSITE_PLAN_TO_BASE_PLAN[b];
      return (PLANS[bBase]?.order || 0) - (PLANS[aBase]?.order || 0);
    })[0] || "";

  const limit = PRICING[bestWebsitePlan]?.limits?.websites;
  return {
    websitePlan: bestWebsitePlan || null,
    limit: limit === "unlimited" ? null : Number.isFinite(Number(limit)) ? Number(limit) : null,
    planName: PRICING[bestWebsitePlan]?.name || PLANS[resolvedPlan?.plan]?.name || resolvedPlan?.plan || "Starter",
  };
}
