// /lib/calendar/getCalendarPlan.js

import { CALENDAR_PLANS } from "./planConfig";
import { supabase } from "../../utils/supabase-client";

function parseLegacyCalendarStatus(status) {
  if (typeof status !== "string" || !status) {
    return { hasAccess: false, tier: null };
  }

  if (status === "active") {
    return { hasAccess: true, tier: "calendar-starter" };
  }

  if (status.startsWith("active:")) {
    const tier = status.slice("active:".length) || null;
    if (tier && tier.startsWith("calendar-")) {
      return { hasAccess: true, tier };
    }
    return { hasAccess: true, tier: "calendar-starter" };
  }

  return { hasAccess: false, tier: null };
}

export async function getCalendarPlan(userId) {
  const { data, error } = await supabase
    .from("accounts")
    .select("calendar_plan_tier")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    const isMissingTierColumn = /calendar_plan_tier/i.test(error.message || "");
    if (!isMissingTierColumn) {
      return { tier: null, hasAccess: false, config: null };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("calendar_subscription_status")
      .eq("user_id", userId)
      .maybeSingle();

    const parsed = parseLegacyCalendarStatus(profile?.calendar_subscription_status);
    const hasLegacyAccess = parsed.hasAccess;
    const legacyTier = parsed.tier;
    return {
      tier: legacyTier,
      hasAccess: hasLegacyAccess,
      config: hasLegacyAccess ? CALENDAR_PLANS[legacyTier] : null,
    };
  }

  const latest = Array.isArray(data) ? data[0] : null;
  const tier = latest?.calendar_plan_tier || null;
  const hasAccess = !!tier;

  return {
    tier,
    hasAccess,
    config: hasAccess
      ? CALENDAR_PLANS[tier] || CALENDAR_PLANS["calendar-starter"]
      : null,
  };
}