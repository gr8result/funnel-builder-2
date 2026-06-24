// /lib/featureGates.js
// Single source of truth for plan-based feature gating.
// Plans: starter | growth | scale | professional
//
// Usage (server-side):
//   import { canUseFeature } from "../../lib/featureGates";
//   if (!canUseFeature(workspacePlan, "multiple_pipelines")) {
//     return res.status(403).json({ ok: false, error: "Upgrade required" });
//   }
//
// Usage (client-side hook): see useFeatureGate in hooks/useFeatureGate.js

// ─────────────────────────────────────────────────────────────────────────────
// PLAN DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
export const PLANS = {
  starter:      { name: "Starter",      price: 129, order: 1 },
  growth:       { name: "Growth",       price: 299, order: 2 },
  scale:        { name: "Scale",        price: 449, order: 3 },
  professional: { name: "Professional", price: 899, order: 4 },
};

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE → MINIMUM REQUIRED PLAN
// ─────────────────────────────────────────────────────────────────────────────
export const FEATURE_PLANS = {
  // CRM
  crm_basic:                    "starter",
  crm_tasks:                    "starter",
  crm_notes:                    "starter",
  crm_lead_pipeline:            "starter",    // 1 pipeline on starter
  crm_multiple_pipelines:       "growth",
  crm_lead_assignment:          "growth",
  crm_automation:               "growth",
  crm_reporting:                "growth",
  crm_ai_scoring:               "scale",
  crm_advanced_automation:      "scale",
  crm_analytics:                "scale",

  // Email
  email_marketing:              "starter",
  email_automation:             "growth",
  email_advanced:               "scale",

  // Funnels
  funnels:                      "growth",     // starter = landing pages only; growth+ = full funnels
  funnel_ab_test:               "scale",

  // Website builder
  website_builder:              "starter",
  ai_website_builder:           "scale",

  // Bookings / calendar
  booking_calendar:             "starter",

  // Automation
  business_automation:          "starter",

  // Communities
  communities_single:           "starter",    // 1 community on starter
  communities_multiple:         "growth",
  communities_gamification:     "scale",

  // Social media
  social_media:                 "starter",
  social_media_advanced:        "growth",

  // Analytics
  analytics_basic:              "starter",
  analytics_advanced:           "growth",
  analytics_custom:             "scale",

  // SMS
  sms:                          "starter",

  // Courses
  online_courses:               "growth",

  // Digital products
  digital_products:             "starter",

  // Physical products
  physical_products:            "growth",

  // Telephony
  call_recording:               "growth",
  ai_transcription:             "growth",
  ai_transcription_sentiment:   "scale",
  ai_telephone_full:            "professional",

  // Affiliate
  affiliate_management:         "growth",

  // AI features
  ai_copy:                      "growth",
  ai_lead_scoring:              "scale",
  ai_funnel_optimisation:       "scale",
  ai_email_automation:          "scale",
  ai_full_suite:                "professional",

  // White-label / agency
  white_label_reports:          "professional",
  dedicated_account_manager:    "professional",
};

// ─────────────────────────────────────────────────────────────────────────────
// USAGE LIMITS BY PLAN
// ─────────────────────────────────────────────────────────────────────────────
export const PLAN_LIMITS = {
  starter: {
    leads:               5000,
    contacts:            5000,
    email_monthly:       50000,
    sms_monthly:         500,
    websites:            1,
    funnels:             0,       // landing pages only; no full funnels
    automations:         5,
    team_members:        2,
    pipelines:           1,
    communities:         1,
    social_profiles:     5,
    ai_credits_monthly:  50,
    storage_gb:          5,
  },
  growth: {
    leads:               15000,
    contacts:            15000,
    email_monthly:       150000,
    sms_monthly:         2500,
    websites:            2,
    funnels:             1,
    automations:         15,
    team_members:        5,
    pipelines:           null,    // unlimited
    communities:         3,
    social_profiles:     10,
    ai_credits_monthly:  250,
    storage_gb:          25,
  },
  scale: {
    leads:               40000,
    contacts:            40000,
    email_monthly:       400000,
    sms_monthly:         5000,
    websites:            3,
    funnels:             3,
    automations:         null,    // unlimited
    team_members:        10,
    pipelines:           null,    // unlimited
    communities:         null,    // unlimited
    social_profiles:     50,
    ai_credits_monthly:  750,
    storage_gb:          100,
  },
  professional: {
    leads:               null,    // unlimited
    contacts:            null,    // unlimited
    email_monthly:       null,    // unlimited (separate email plan)
    sms_monthly:         10000,
    websites:            5,
    funnels:             null,    // unlimited
    automations:         null,    // unlimited
    team_members:        25,
    pipelines:           null,    // unlimited
    communities:         null,    // unlimited
    social_profiles:     null,    // unlimited
    ai_credits_monthly:  null,    // unlimited
    storage_gb:          1000,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the given plan has access to the feature.
 * @param {string} plan - "starter" | "growth" | "scale" | "professional"
 * @param {string} feature - key from FEATURE_PLANS
 */
export function canUseFeature(plan, feature) {
  const required = FEATURE_PLANS[feature];
  if (!required) return false; // unknown feature = denied by default

  const planOrder   = PLANS[plan]?.order ?? 0;
  const reqOrder    = PLANS[required]?.order ?? 999;

  return planOrder >= reqOrder;
}

/**
 * Returns the usage limit for a specific resource on this plan.
 * Returns null for unlimited, or a number.
 * @param {string} plan
 * @param {string} resource - key from PLAN_LIMITS
 */
export function getLimit(plan, resource) {
  return PLAN_LIMITS[plan]?.[resource] ?? null;
}

/**
 * Returns the minimum plan name that grants access to a feature.
 * Useful for upgrade prompts.
 * @param {string} feature
 * @returns {string|null}
 */
export function requiredPlanFor(feature) {
  return FEATURE_PLANS[feature] || null;
}
