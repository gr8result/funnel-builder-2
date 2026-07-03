import PRICING, { BASE_PLAN_INCLUDES } from "./pricing";

export const PLATFORM_PLAN_RANK = { starter: 1, growth: 2, scale: 3, professional: 4 };

export const PLATFORM_BASE_PLANS = [
  { id: "starter", name: "Starter", price: 79, introDiscountPercent: null, introMonths: 0, trialDays: 0, color: "#6366f1", badge: null, users: "2 users", tagline: "For sole traders and startups." },
  { id: "growth", name: "Growth", price: 249, introDiscountPercent: null, introMonths: 0, trialDays: 0, color: "#22c55e", badge: "Most Popular", users: "5 users", tagline: "For builders, trades and growing service businesses." },
  { id: "scale", name: "Scale", price: 399, introDiscountPercent: null, introMonths: 0, trialDays: 0, color: "#f59e0b", badge: "Best Value", users: "10 users", tagline: "For established businesses managing more projects, teams and automation." },
  { id: "professional", name: "Professional", price: 799, introDiscountPercent: null, introMonths: 0, trialDays: 0, color: "#7c3aed", badge: "Premium", users: "25 users", tagline: "For high-volume businesses with advanced reporting, higher usage and premium support." },
];

export const PLATFORM_PRICING_PLANS = [
  {
    id: "starter",
    name: "Starter",
    color: "#6366f1",
    badge: null,
    price: "$79",
    period: "/mo",
    tagline: "For sole traders and startups.",
    features: [
      { label: "Team Seats", value: "2 users" },
      { label: "CRM", value: true },
      { label: "Website Builder", value: true },
      { label: "Funnel Builder", value: true },
      { label: "Calendar Bookings", value: true },
      { label: "Email Marketing", value: true },
      { label: "SMS Marketing", value: true },
      { label: "Basic Automation", value: true },
      { label: "Basic Reporting", value: true },
      { label: "Marketplace Access", value: true },
    ],
    quotas: [
      { label: "Contacts", value: "2,500" },
      { label: "Monthly Email Sends Included", value: "10,000" },
      { label: "SMS/mo", value: "100" },
      { label: "AI credits/mo", value: "100" },
      { label: "Projects Hub", value: "Not included" },
    ],
  },
  {
    id: "growth",
    name: "Growth",
    color: "#22c55e",
    badge: "Most Popular",
    price: "$249",
    period: "/mo",
    tagline: "For builders, trades and growing service businesses.",
    features: [
      { label: "Team Seats", value: "5 users" },
      { label: "Everything in Starter", value: true },
      { label: "Social Media Scheduler", value: true },
      { label: "Projects Hub", value: true },
      { label: "More CRM pipelines", value: true },
      { label: "More automation workflows", value: true },
      { label: "Priority email support", value: true },
    ],
    quotas: [
      { label: "Contacts", value: "10,000" },
      { label: "Monthly Email Sends Included", value: "25,000" },
      { label: "SMS/mo", value: "500" },
      { label: "AI credits/mo", value: "500" },
      { label: "Projects Hub", value: "Included" },
    ],
  },
  {
    id: "scale",
    name: "Scale",
    color: "#f59e0b",
    badge: "Best Value",
    price: "$399",
    period: "/mo",
    tagline: "For established businesses managing more projects, teams and automation.",
    features: [
      { label: "Team Seats", value: "10 users" },
      { label: "Everything in Growth", value: true },
      { label: "Advanced Reporting", value: true },
      { label: "Team Permissions", value: true },
      { label: "More websites/funnels", value: true },
      { label: "More social profiles", value: true },
      { label: "Dedicated onboarding", value: true },
    ],
    quotas: [
      { label: "Contacts", value: "30,000" },
      { label: "Monthly Email Sends Included", value: "50,000" },
      { label: "SMS/mo", value: "2,000" },
      { label: "AI credits/mo", value: "2,000" },
      { label: "Projects Hub", value: "Included" },
    ],
  },
  {
    id: "professional",
    name: "Professional",
    color: "#7c3aed",
    badge: "Premium",
    price: "$799",
    period: "/mo",
    tagline: "For high-volume businesses with advanced reporting, higher usage and premium support.",
    features: [
      { label: "Team Seats", value: "25 users" },
      { label: "Everything in Scale", value: true },
      { label: "Executive dashboards", value: true },
      { label: "Cross-module reporting", value: true },
      { label: "Higher usage limits", value: true },
      { label: "Account manager", value: true },
      { label: "SLA support", value: true },
    ],
    quotas: [
      { label: "Contacts", value: "100,000" },
      { label: "Monthly Email Sends Included", value: "100,000" },
      { label: "SMS/mo", value: "10,000" },
      { label: "AI credits/mo", value: "10,000" },
      { label: "Projects Hub", value: "Included" },
    ],
  },
];

export const PROJECT_CREDIT_PACKS = [
  { id: "credit-1", label: "1 Project Credit", price: 59, badge: "" },
  { id: "credit-10", label: "10 Project Credits", price: 531, badge: "Save 10%" },
  { id: "credit-25", label: "25 Project Credits", price: 1254, badge: "Save 15%" },
];

export const EMAIL_PACKS = [
  { label: "+10,000 emails", price: 25 },
  { label: "+25,000 emails", price: 65 },
  { label: "+50,000 emails", price: 120 },
  { label: "+100,000 emails", price: 199 },
];

export const SMS_PACKS = [
  { label: "+100 SMS", price: 10 },
  { label: "+500 SMS", price: 35 },
  { label: "+1,000 SMS", price: 60 },
  { label: "+5,000 SMS", price: 250 },
];

export const AI_PACKS = [
  { label: "+500 AI credits", price: 29 },
  { label: "+2,000 AI credits", price: 99 },
  { label: "+10,000 AI credits", price: 399 },
];

export function calcPlatformBundleValue(planId) {
  const included = BASE_PLAN_INCLUDES[planId];
  if (!included) return 0;
  return Object.entries(included).reduce((sum, [key, value]) => {
    if (!value || key === "funnels") return sum;
    return sum + (PRICING[value.tierId]?.price || 0);
  }, 0);
}

export function getPlatformBasePlan(planId) {
  return PLATFORM_BASE_PLANS.find((plan) => plan.id === planId) || null;
}

export function getPlatformChartPlans() {
  return PLATFORM_BASE_PLANS.map((plan) => ({
    id: plan.id,
    name: plan.name,
    color: plan.color,
    billingPrice: plan.price,
    individualPrice: calcPlatformBundleValue(plan.id),
  }));
}

export function getPlatformPricingTablePlans() {
  return PLATFORM_PRICING_PLANS.map((plan) => ({
    id: plan.id,
    name: plan.name,
    price: plan.price,
    description: plan.tagline,
    includedFeatures: plan.features.map((feature) => feature.value === true ? feature.label : `${feature.label} - ${feature.value}`),
    features: plan.features.map((feature) => feature.value === true ? feature.label : `${feature.label} - ${feature.value}`),
    extras: plan.quotas.map((quota) => `${quota.label} - ${quota.value}`),
    featureIcon: "tick",
    badge: plan.badge || "",
    cta: "Select This Plan",
    ctaUrl: "/billing",
    highlighted: plan.id === "growth",
    individualPrice: `$${calcPlatformBundleValue(plan.id)}`,
    color: plan.color,
  }));
}
