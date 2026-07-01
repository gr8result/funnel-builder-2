// /pages/billing.js 
// ✅ FINAL version — integrates Email Plan display + upgrade link
// Keeps existing discount logic, design, icons, and layout intact

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabase-client";
import ICONS from "../components/iconMap";
import PRICING, { BASE_PLAN_INCLUDES } from "../data/pricing";

const ACTIVE_MODULE_ALIASES = {
  email_marketing: "email",
  sms_marketing: "sms",
  social_media: "social",
  booking_calendar: "calendar",
  website_builder: "website-builder",
  business_automation: "automation",
  evergreen_webinars: "webinars",
  pipelines: "subscription",
  affiliate_management: "affiliates",
  projects_hub: "projects-hub",
};

const formatTierLabel = (tier) => {
  const p = PRICING[tier];
  if (!p) return "Contact Support";
  if (typeof p.price === "number" && p.price > 0) return `A$${p.price} / month`;
  if (p.price === 0 && tier !== "email-free") return "Contact Support";
  return "A$0 / month";
};
const getPlanPrice = (tier) => PRICING[tier]?.price || 0;
const getBasePlanModuleKey = (moduleId) => {
  if (moduleId === "website-builder") return "website";
  if (moduleId === "projects-hub") return "projectsHub";
  return moduleId;
};
const getModuleDeltaLabel = (moduleKey, tierKey, basePlan) => {
  if (!tierKey) return null;
  const includedPrice = BASE_PLAN_INCLUDES[basePlan]?.[moduleKey]?.price ?? 0;
  const tierPrice = PRICING[tierKey]?.price;
  if (tierPrice == null) return "Contact Sales";
  const delta = tierPrice - includedPrice;
  if (delta <= 0) return "Included in plan";
  return `+$${delta}/mo extra`;
};

function normalizeActiveModuleId(moduleId) {
  return ACTIVE_MODULE_ALIASES[moduleId] || moduleId;
}

function moduleStatusLabel(module, selectedPlan, selected) {
  const selectedRank = PLAN_RANK[selectedPlan] || 0;
  if (module.comingSoon) return "Coming Soon";
  if (module.addOn) {
    if (selectedRank < PLAN_RANK[module.requiredPlan]) return "Requires Growth or higher";
    return selected.includes(module.id) ? "Optional Add-on selected" : "Optional Add-on";
  }
  if (module.includedFrom && selectedRank >= PLAN_RANK[module.includedFrom]) {
    if (module.id === "email" || module.id === "sms") return "Included - quota based";
    if (module.id === "automation") return "Included - higher limits by plan";
    if (module.id === "reporting") return selectedPlan === "starter" ? "Basic in Starter" : "Included";
    return "Included";
  }
  if (module.includedFrom) return "Upgrade Required";
  return "Optional Add-on";
}

function canToggleModule(module, selectedPlan) {
  if (!module || module.comingSoon) return false;
  if (module.addOn) return (PLAN_RANK[selectedPlan] || 0) >= PLAN_RANK[module.requiredPlan];
  return true;
}

function isModuleIncludedInPlan(module, selectedPlan) {
  if (!module?.includedFrom || !selectedPlan) return false;
  return (PLAN_RANK[selectedPlan] || 0) >= (PLAN_RANK[module.includedFrom] || 99);
}

const MODULES = [
  { id: "email",          name: "Email Marketing",         price: 0,  color: "#facc15", icon: ICONS.email,          emoji: "📧", includedFrom: "starter", quotaBased: true },
  { id: "crm",            name: "CRM",                     price: 0,  color: "#ec4899", icon: ICONS.account,         emoji: "🗂️", includedFrom: "starter" },
  { id: "projects-hub",   name: "Projects Hub",            price: 0,  color: "#f97316",                             emoji: "🏗️", includedFrom: "growth" },
  { id: "sms",            name: "SMS Marketing",           price: 0,  color: "#38bdf8", icon: ICONS.sms,            emoji: "💬", includedFrom: "starter", quotaBased: true },
  { id: "social",         name: "Social Media",            price: 0,  color: "#8126e9", icon: ICONS.social,         emoji: "📱", includedFrom: "growth" },
  { id: "calendar",       name: "Calendar Bookings",       price: 0,  color: "#84cc16", icon: ICONS.calendar,       emoji: "📅", includedFrom: "starter" },
  { id: "website-builder",name: "Website Builder",         price: 0,  color: "#3b82f6", icon: ICONS.websiteBuilder, emoji: "🌐", includedFrom: "starter" },
  { id: "funnels",        name: "Funnel Builder",          price: 0,  color: "#ef465d", icon: ICONS.funnels,        includedFrom: "starter" },
  { id: "automation",     name: "Business Automation",     price: 0,  color: "#fb923c", icon: ICONS.automation,     emoji: "⚙️", includedFrom: "starter", quotaBased: true },
  { id: "reporting",      name: "Reporting",               price: 0,  color: "#60a5fa",                             emoji: "📊", includedFrom: "starter" },
  { id: "builder-pro",    name: "Builder Pro",             price: 49, color: "#14b8a6",                             emoji: "🏗", addOn: true, requiredPlan: "growth" },
  { id: "communities",    name: "Communities",             price: 0,  color: "#06b6d4",                             emoji: "👥", comingSoon: true },
  { id: "marketplace",    name: "Marketplace",             price: 0,  color: "#f59e0b",                             emoji: "🛒", includedFrom: "starter" },
  { id: "webinars",       name: "Webinars",                price: 29, color: "#ef4444", icon: ICONS.webinars,       emoji: "🎥", comingSoon: true },
  { id: "subscription",   name: "Subscription Pipeline",   price: 19, color: "#7c3aed", icon: ICONS.subscription,   emoji: "🌿", comingSoon: true },
  { id: "subaccounts",    name: "Subaccounts",             price: 19, color: "#10b981", icon: ICONS.subaccounts,    comingSoon: true },
];

const PLAN_RANK = { starter: 1, growth: 2, scale: 3, professional: 4 };
const BUILDER_PRO_FEATURES = [
  "AI Estimate Builder",
  "AI Plan Recognition",
  "Quotation Builder",
  "Projects Hub",
  "Procurement",
  "Purchase Orders",
  "Work Orders",
  "Gantt Charts",
  "Variations",
  "EOT Tracking",
  "LD Tracking",
  "Client Portal",
];
const PROJECT_CREDIT_PACKS = [
  { id: "credit-1", label: "1 Project Credit", price: 59, badge: "" },
  { id: "credit-10", label: "10 Project Credits", price: 531, badge: "Save 10%" },
  { id: "credit-25", label: "25 Project Credits", price: 1254, badge: "Save 15%" },
];
const EMAIL_PACKS = [
  { label: "+10,000 emails", price: 25 },
  { label: "+25,000 emails", price: 65 },
  { label: "+50,000 emails", price: 120 },
  { label: "+100,000 emails", price: 199 },
];
const SMS_PACKS = [
  { label: "+100 SMS", price: 10 },
  { label: "+500 SMS", price: 35 },
  { label: "+1,000 SMS", price: 60 },
  { label: "+5,000 SMS", price: 250 },
];
const AI_PACKS = [
  { label: "+500 AI credits", price: 29 },
  { label: "+2,000 AI credits", price: 99 },
  { label: "+10,000 AI credits", price: 399 },
];

const BASE_PLANS = [
  { id: "starter",      name: "Starter",      price: 79,  introDiscountPercent: null, introMonths: 0, trialDays: 0, color: "#6366f1", badge: null,           users: "2 users",        tagline: "For sole traders and startups." },
  { id: "growth",       name: "Growth",       price: 249, introDiscountPercent: null, introMonths: 0, trialDays: 0, color: "#22c55e", badge: "Most Popular",  users: "5 users",        tagline: "For builders, trades and growing service businesses." },
  { id: "scale",        name: "Scale",        price: 399, introDiscountPercent: null, introMonths: 0, trialDays: 0, color: "#f59e0b", badge: "Best Value",    users: "10 users",       tagline: "For established businesses managing more projects, teams and automation." },
  { id: "professional", name: "Professional", price: 799, introDiscountPercent: null, introMonths: 0, trialDays: 0, color: "#7c3aed", badge: "Premium",       users: "25 users",       tagline: "For high-volume businesses with advanced reporting, higher usage and premium support." },
];

// Full plan details (features + quotas) — used for the rich plan cards at the top of the page
const PLANS = [
  {
    name: "Starter", color: "#6366f1", badge: null,
    price: "$79", period: "/mo",
    tagline: "For sole traders and startups.",
    features: [
      { label: "Team Seats",              value: "2 users" },
      { label: "CRM",                     value: true },
      { label: "Website Builder",         value: true },
      { label: "Funnel Builder",          value: true },
      { label: "Calendar Bookings",       value: true },
      { label: "Email Marketing",         value: true },
      { label: "SMS Marketing",           value: true },
      { label: "Basic Automation",        value: true },
      { label: "Basic Reporting",         value: true },
      { label: "Marketplace Access",      value: true },
    ],
    quotas: [
      { label: "Contacts",              value: "2,500" },
      { label: "Monthly Email Sends Included", value: "10,000" },
      { label: "SMS/mo",                value: "100" },
      { label: "AI credits/mo",         value: "100" },
      { label: "Projects Hub",          value: "Not included" },
    ],
  },
  {
    name: "Growth", color: "#22c55e", badge: "Most Popular",
    price: "$249", period: "/mo",
    tagline: "For builders, trades and growing service businesses.",
    features: [
      { label: "Team Seats",              value: "5 users" },
      { label: "Everything in Starter",   value: true },
      { label: "Social Media Scheduler",  value: true },
      { label: "Projects Hub",            value: true },
      { label: "More CRM pipelines",      value: true },
      { label: "More automation workflows", value: true },
      { label: "Priority email support",  value: true },
    ],
    quotas: [
      { label: "Contacts",              value: "10,000" },
      { label: "Monthly Email Sends Included", value: "25,000" },
      { label: "SMS/mo",                value: "500" },
      { label: "AI credits/mo",         value: "500" },
      { label: "Projects Hub",          value: "Included" },
    ],
  },
  {
    name: "Scale", color: "#f59e0b", badge: "Best Value",
    price: "$399", period: "/mo",
    tagline: "For established businesses managing more projects, teams and automation.",
    features: [
      { label: "Team Seats",              value: "10 users" },
      { label: "Everything in Growth",    value: true },
      { label: "Advanced Reporting",      value: true },
      { label: "Team Permissions",        value: true },
      { label: "More websites/funnels",   value: true },
      { label: "More social profiles",    value: true },
      { label: "Dedicated onboarding",    value: true },
    ],
    quotas: [
      { label: "Contacts",              value: "30,000" },
      { label: "Monthly Email Sends Included", value: "50,000" },
      { label: "SMS/mo",                value: "2,000" },
      { label: "AI credits/mo",         value: "2,000" },
      { label: "Projects Hub",          value: "Included" },
    ],
  },
  {
    name: "Professional", color: "#7c3aed", badge: "Premium",
    price: "$799", period: "/mo",
    tagline: "For high-volume businesses with advanced reporting, higher usage and premium support.",
    features: [
      { label: "Team Seats",              value: "25 users" },
      { label: "Everything in Scale",      value: true },
      { label: "Executive dashboards",     value: true },
      { label: "Cross-module reporting",   value: true },
      { label: "Higher usage limits",      value: true },
      { label: "Account manager",          value: true },
      { label: "SLA support",              value: true },
    ],
    quotas: [
      { label: "Contacts",              value: "100,000" },
      { label: "Monthly Email Sends Included", value: "100,000" },
      { label: "SMS/mo",                value: "10,000" },
      { label: "AI credits/mo",         value: "10,000" },
      { label: "Projects Hub",          value: "Included" },
    ],
  },
];

function calcBundleValue(planId) {
  const inc = BASE_PLAN_INCLUDES[planId];
  if (!inc) return 0;
  return Object.entries(inc).reduce((sum, [key, val]) => {
    if (!val || key === "funnels") return sum;
    return sum + (PRICING[val.tierId]?.price || 0);
  }, 0);
}

function PlanCheckIcon({ color }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="8" cy="8" r="8" fill={color} fillOpacity="0.18" />
      <path d="M4.5 8.5l2.5 2.5 4.5-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Billing() {
    // Read selected plan tiers from query string
    // Track selected pricing tiers for all three modules
    const [emailPlanTier, setEmailPlanTier] = useState(null);
    const _planResetMounted = useRef(false);
    const _autoSelectOnPlan = useRef(false);
    const [smsPlanTier, setSmsPlanTier] = useState(null);
    const [calendarPlanTier, setCalendarPlanTier] = useState(null);
    const [socialPlanTier, setSocialPlanTier] = useState(null);
    const [crmPlanTier, setCrmPlanTier] = useState(null);
    const [funnelPackTier, setFunnelPackTier] = useState(null);
    const [websitePlanTier, setWebsitePlanTier] = useState(null);
    const [projectsHubPlanTier, setProjectsHubPlanTier] = useState(null);
    const [extraSeats, setExtraSeats] = useState(0);
    const [emailPackIndex, setEmailPackIndex] = useState(-1);
    const [smsPackIndex, setSmsPackIndex] = useState(-1);
    const [aiPackIndex, setAiPackIndex] = useState(-1);
    const [projectCreditPack, setProjectCreditPack] = useState("");
    const [queryTiersLoaded, setQueryTiersLoaded] = useState(false);
    // tiersFromUrl = tiers actively selected via URL params right now
    const [tiersFromUrl, setTiersFromUrl] = useState({});
    // dbPlanTiers = tiers already in DB (already paid)
    const [dbPlanTiers, setDbPlanTiers] = useState({});
    useEffect(() => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const emailTier = params.get("emailPlan");
        const smsTier = params.get("smsPlan");
        const calendarTier = params.get("calendarPlan");
        const socialTier   = params.get("socialPlan");
        const crmTier       = params.get("crmPlan");
        const funnelTier    = params.get("funnelPlan");
        const websiteTier   = params.get("websitePlan");
        const projectsHubTier = params.get("projectsHubPlan");

        const urlTierMap = {};
        if (emailTier) {
          urlTierMap.email = emailTier;
          setEmailPlanTier(emailTier);
          setSelected((prev) => prev.includes("email") ? prev : [...prev, "email"]);
        }
        if (smsTier) {
          urlTierMap.sms = smsTier;
          setSmsPlanTier(smsTier);
          setSelected((prev) => (prev.includes("sms") ? prev : [...prev, "sms"]));
        }
        if (calendarTier) {
          urlTierMap.calendar = calendarTier;
          setCalendarPlanTier(calendarTier);
          setSelected((prev) => (prev.includes("calendar") ? prev : [...prev, "calendar"]));
        }
        if (socialTier) {
          urlTierMap.social = socialTier;
          setSocialPlanTier(socialTier);
          setSelected((prev) => (prev.includes("social") ? prev : [...prev, "social"]));
        }
        if (crmTier) {
          urlTierMap.crm = crmTier;
          setCrmPlanTier(crmTier);
          setSelected((prev) => (prev.includes("crm") ? prev : [...prev, "crm"]));
        }
        if (funnelTier) {
          urlTierMap.funnels = funnelTier;
          setFunnelPackTier(funnelTier);
          setSelected((prev) => (prev.includes("funnels") ? prev : [...prev, "funnels"]));
        }
        if (websiteTier) {
          urlTierMap.website = websiteTier;
          setWebsitePlanTier(websiteTier);
          setSelected((prev) => (prev.includes("website-builder") ? prev : [...prev, "website-builder"]));
        }
        if (projectsHubTier) {
          urlTierMap.projectsHub = projectsHubTier;
          setProjectsHubPlanTier(projectsHubTier);
          setSelected((prev) => (prev.includes("projects-hub") ? prev : [...prev, "projects-hub"]));
        }
        // Accept both "plan" (direct link) and "basePlan" (returned from plan pages)
        const planFromUrl = params.get("plan") || params.get("basePlan");
        if (planFromUrl && BASE_PLANS.find((p) => p.id === planFromUrl)) {
          setSelectedPlan(planFromUrl);
        }
        setTiersFromUrl(urlTierMap);
        setQueryTiersLoaded(true);
      }
    }, []);
  const [selected, setSelected] = useState([]);
  const [activeModules, setActiveModules] = useState(new Set());
  const [discountCode, setDiscountCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountMessage, setDiscountMessage] = useState("");
  const [user, setUser] = useState(null);
  const [emailPlan, setEmailPlan] = useState("Loading...");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const router = useRouter();

  const buildPlanPageUrl = (basePath, planParamKey, tierValue) => {
    const params = new URLSearchParams();
    if (selectedPlan) params.set("basePlan", selectedPlan);
    // Carry all already-selected module tiers so the plan page round-trips them
    // back in the billing URL — otherwise selecting a second plan drops the first.
    if (tiersFromUrl.email    || emailPlanTier)    params.set("emailPlan",    tiersFromUrl.email    || emailPlanTier);
    if (tiersFromUrl.sms      || smsPlanTier)      params.set("smsPlan",      tiersFromUrl.sms      || smsPlanTier);
    if (tiersFromUrl.calendar || calendarPlanTier) params.set("calendarPlan", tiersFromUrl.calendar || calendarPlanTier);
    if (tiersFromUrl.social   || socialPlanTier)   params.set("socialPlan",   tiersFromUrl.social   || socialPlanTier);
    if (tiersFromUrl.crm      || crmPlanTier)      params.set("crmPlan",      tiersFromUrl.crm      || crmPlanTier);
    if (tiersFromUrl.funnels  || funnelPackTier)   params.set("funnelPlan",   tiersFromUrl.funnels  || funnelPackTier);
    if (tiersFromUrl.website  || websitePlanTier)  params.set("websitePlan",  tiersFromUrl.website  || websitePlanTier);
    if (tiersFromUrl.projectsHub || projectsHubPlanTier) params.set("projectsHubPlan", tiersFromUrl.projectsHub || projectsHubPlanTier);
    // The specific plan being changed overrides whatever was carried above
    if (planParamKey && tierValue) params.set(planParamKey, tierValue);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  useEffect(() => {
    if (!queryTiersLoaded) return;

    const fetchData = async () => {
      // getSession is synchronous from cookie — use it first to avoid
      // a flash redirect when the session token is already present.
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user;

      if (!currentUser) {
        // Give the client one extra tick to hydrate before giving up.
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          router.push("/login");
          return;
        }
        setUser(userData.user);
        return fetchAccountData(userData.user);
      }

      setUser(currentUser);
      return fetchAccountData(currentUser);
    };

    const fetchAccountData = async (currentUser) => {
      const params = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
      const emailTierFromUrl = params?.get("emailPlan");
      const smsTierFromUrl = params?.get("smsPlan");
      const calendarTierFromUrl = params?.get("calendarPlan");
      const socialTierFromUrl = params?.get("socialPlan");

      const { data: accountRows, error: accountErr } = await supabase
        .from("accounts")
        .select("email_plan_tier, sms_plan_tier, calendar_plan_tier")
        .eq("user_id", currentUser.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (accountErr) {
        console.error("Error loading account tiers:", accountErr);
      }

      // Load purchased modules from user_modules table
      let acc = accountRows?.[0] || null;

      // Record DB plan tiers (already paid — don't charge again for same tier)
      setDbPlanTiers({
        email: acc?.email_plan_tier || null,
        sms: acc?.sms_plan_tier || null,
        calendar: acc?.calendar_plan_tier || null,
      });

      // Seed tier badges from DB so module cards show the user's current
      // subscription — URL params (from plan pages) take priority over DB.
      // NOTE: we do NOT seed the display tier states here — those are only set
      // by URL params when a user actively selects a plan. DB tiers feed into
      // dbPlanTiers for billing delta calculation only.

      // Load active base plan via admin-backed API route (bypasses RLS on subscriptions table)
      const { data: sessionData2 } = await supabase.auth.getSession();
      const accessToken = sessionData2?.session?.access_token;
      let activePlanId = null;
      if (accessToken) {
        try {
          const subRes = await fetch("/api/billing/get-subscription", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (subRes.ok) {
            const subData = await subRes.json();
            activePlanId = subData?.plan || null;
          }
        } catch (e) {
          console.warn("get-subscription fetch failed:", e);
        }
      }
      if (activePlanId) {
        setCurrentPlan(activePlanId);
        // Pre-select the paid plan unless the URL is already specifying one
        // (e.g. returning from an upgrade flow on a module sub-page).
        const planFromUrl = params?.get("plan") || params?.get("basePlan");
        if (!planFromUrl) setSelectedPlan(activePlanId);
      }

      const { data: moduleRows } = await supabase
        .from("user_modules")
        .select("module_id")
        .eq("user_id", currentUser.id);

      if (moduleRows && moduleRows.length > 0) {
        const ids = moduleRows.map((r) => r.module_id);
        // Extract social plan tier stored as __social_plan_tier:xxx (only apply if set via URL)
        const realIds = ids
          .filter((id) => !id.startsWith("__") && id !== "automation")
          .map(normalizeActiveModuleId);
        setActiveModules(new Set(realIds));
        setSelected((prev) => {
          const merged = new Set([...prev, ...realIds]);
          return Array.from(merged);
        });
      }
    };

    fetchData();
  }, [router, queryTiersLoaded]);

  useEffect(() => {
    if (emailPlanTier) {
      setEmailPlan(PRICING[emailPlanTier]?.name || emailPlanTier);
    }
  }, [emailPlanTier]);

  // When the base plan changes, reset any module tier that wasn't explicitly chosen
  // via URL params — so the "· Included" badge updates reactively.
  useEffect(() => {
    // Skip on initial mount — URL param tiers are already set by the params effect
    if (!_planResetMounted.current) { _planResetMounted.current = true; return; }
    if (!tiersFromUrl.email) setEmailPlanTier(null);
    if (!tiersFromUrl.sms) setSmsPlanTier(null);
    if (!tiersFromUrl.calendar) setCalendarPlanTier(null);
    if (!tiersFromUrl.social) setSocialPlanTier(null);
    if (!tiersFromUrl.crm) setCrmPlanTier(null);
    if (!tiersFromUrl.website) setWebsitePlanTier(null);
    if (!tiersFromUrl.funnels) setFunnelPackTier(null);
    if (!tiersFromUrl.projectsHub) setProjectsHubPlanTier(null);
  }, [selectedPlan]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if ((PLAN_RANK[selectedPlan] || 0) >= PLAN_RANK.growth) return;
    setSelected((prev) => prev.filter((id) => id !== "builder-pro"));
    setProjectCreditPack("");
  }, [selectedPlan]);

  // When the user actively picks a plan, auto-select all available modules so
  // the cards light up immediately. Skips the initial mount so URL-loaded state
  // (e.g. returning from a module plan page) is never overridden.
  useEffect(() => {
    if (!_autoSelectOnPlan.current) { _autoSelectOnPlan.current = true; return; }
    if (selectedPlan) {
      const availableIds = MODULES.filter(m => canToggleModule(m, selectedPlan)).map(m => m.id);
      setSelected(prev => Array.from(new Set([...prev, ...availableIds])));
    }
  }, [selectedPlan]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelect = (id) => {
    if (activeModules.has(id)) return; // can't deselect an active/purchased module
    const module = MODULES.find((m) => m.id === id);
    if (!canToggleModule(module, selectedPlan)) return;
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAll = () => setSelected(MODULES.filter((m) => canToggleModule(m, selectedPlan)).map((m) => m.id));
  const clearAll = () => {
    setEmailPlanTier(null);
    setSmsPlanTier(null);
    setCalendarPlanTier(null);
    setSocialPlanTier(null);
    setCrmPlanTier(null);
    setWebsitePlanTier(null);
    setFunnelPackTier(null);
    setProjectsHubPlanTier(null);
    setTiersFromUrl({});
    setProjectCreditPack("");
    setSelected([]);
  };

  const applyDiscount = async () => {
    const code = discountCode.trim();
    if (!code) return alert("Enter a discount code first.");
    try {
      const { data, error } = await supabase
        .from("discount_codes")
        .select("code, discount_percent, description, active, expiry_date")
        .filter("code", "ilike", code)
        .eq("active", true)
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setDiscountPercent(0);
        setDiscountMessage("❌ Invalid or inactive code.");
        return;
      }
      if (data.expiry_date && new Date(data.expiry_date) < new Date()) {
        setDiscountPercent(0);
        setDiscountMessage("⚠️ This code has expired.");
        return;
      }
      setDiscountPercent(Number(data.discount_percent) || 0);
      setDiscountMessage(`✅ ${data.discount_percent}% off applied — ${data.description || ""}`);
    } catch (err) {
      console.error("Discount fetch error:", err);
      setDiscountPercent(0);
      setDiscountMessage("❌ Could not verify code.");
    }
  };

  const moduleSubtotal = MODULES.filter((m) => {
    if (!selected.includes(m.id)) return false;
    if (activeModules.has(m.id)) return false; // already purchased, don't charge again
    if (isModuleIncludedInPlan(m, selectedPlan)) return false;
    if (m.id === "email" && emailPlanTier) return false;
    if (m.id === "sms" && smsPlanTier) return false;
    if (m.id === "calendar" && calendarPlanTier) return false;
    if (m.id === "social" && socialPlanTier) return false;
    if (m.id === "crm" && crmPlanTier) return false;
    if (m.id === "funnels" && funnelPackTier) return false;
    if (m.id === "projects-hub" && projectsHubPlanTier) return false;
    return true;
  }).reduce((sum, m) => sum + m.price, 0);
  // Only charge for plan tiers that are:
  // 1. Present as a URL param (user actively selected this session), AND
  // 2. Different from what's already in DB (not already paid for)
  const emailPlanPrice    = (tiersFromUrl.email    && tiersFromUrl.email    !== dbPlanTiers.email)    ? getPlanPrice(tiersFromUrl.email)    : 0;
  const smsPlanPrice      = (tiersFromUrl.sms      && tiersFromUrl.sms      !== dbPlanTiers.sms)      ? getPlanPrice(tiersFromUrl.sms)      : 0;
  const calendarPlanPrice = (tiersFromUrl.calendar && tiersFromUrl.calendar !== dbPlanTiers.calendar) ? getPlanPrice(tiersFromUrl.calendar) : 0;
  const socialPlanPrice   = (tiersFromUrl.social   && tiersFromUrl.social   !== dbPlanTiers.social)   ? getPlanPrice(tiersFromUrl.social)   : 0;
  const crmPlanPrice      = (tiersFromUrl.crm      && tiersFromUrl.crm      !== dbPlanTiers.crm)      ? getPlanPrice(tiersFromUrl.crm)      : 0;
  const funnelPackPrice   = (tiersFromUrl.funnels  && tiersFromUrl.funnels  !== dbPlanTiers.funnels)  ? getPlanPrice(tiersFromUrl.funnels)  : 0;
  const projectsHubPlanPrice = (tiersFromUrl.projectsHub && tiersFromUrl.projectsHub !== dbPlanTiers.projectsHub) ? getPlanPrice(tiersFromUrl.projectsHub) : 0;
  const basePlanPrice = selectedPlan ? (BASE_PLANS.find((p) => p.id === selectedPlan)?.price || 0) : 0;
  const extraSeatsCost = extraSeats * 15;
  const selectedProjectCreditPack = PROJECT_CREDIT_PACKS.find((pack) => pack.id === projectCreditPack);
  const selectedEmailPack = emailPackIndex >= 0 ? EMAIL_PACKS[emailPackIndex] : null;
  const selectedSmsPack = smsPackIndex >= 0 ? SMS_PACKS[smsPackIndex] : null;
  const selectedAiPack = aiPackIndex >= 0 ? AI_PACKS[aiPackIndex] : null;
  const projectCreditCost = selected.includes("builder-pro") && selectedProjectCreditPack ? selectedProjectCreditPack.price : 0;
  const emailPackCost = selectedEmailPack?.price || 0;
  const smsPackCost = selectedSmsPack?.price || 0;
  const aiPackCost = selectedAiPack?.price || 0;
  const annualMultiplier = isAnnual ? 0.95 : 1;
  const billingSubtotal = basePlanPrice + moduleSubtotal + emailPlanPrice + smsPlanPrice + calendarPlanPrice + socialPlanPrice + crmPlanPrice + funnelPackPrice + projectsHubPlanPrice + extraSeatsCost + projectCreditCost + emailPackCost + smsPackCost + aiPackCost;
  const selectedBasePlan = selectedPlan ? BASE_PLANS.find((p) => p.id === selectedPlan) : null;
  const introDiscountPercent = !isAnnual ? (selectedBasePlan?.introDiscountPercent || 0) : 0;
  const introBasePlanPrice = introDiscountPercent > 0 ? basePlanPrice * (1 - introDiscountPercent / 100) : basePlanPrice;
  const introBillingSubtotal = introBasePlanPrice + moduleSubtotal + emailPlanPrice + smsPlanPrice + calendarPlanPrice + socialPlanPrice + crmPlanPrice + funnelPackPrice + projectsHubPlanPrice + extraSeatsCost + projectCreditCost + emailPackCost + smsPackCost + aiPackCost;
  const total = billingSubtotal * annualMultiplier * (1 - discountPercent / 100);
  const introTotal = introBillingSubtotal * (1 - discountPercent / 100);
  const introPrepaidTotal = selectedBasePlan?.introMonths ? introTotal * selectedBasePlan.introMonths : introTotal;

  const handleProceed = async () => {
    if (!user) return alert("Please log in first.");
    if (selected.length === 0) return alert("Please select at least one module.");
    if (discountPercent === 100) {
      const manualParams = new URLSearchParams();
      manualParams.set("provider", "manual");
      if (selectedPlan) manualParams.set("plan", selectedPlan);
      if (emailPlanTier) manualParams.set("emailPlan", emailPlanTier);
      if (smsPlanTier) manualParams.set("smsPlan", smsPlanTier);
      if (calendarPlanTier) manualParams.set("calendarPlan", calendarPlanTier);
      if (socialPlanTier) manualParams.set("socialPlan", socialPlanTier);
      if (crmPlanTier) manualParams.set("crmPlan", crmPlanTier);
      if (funnelPackTier) manualParams.set("funnelPlan", funnelPackTier);
      if (projectsHubPlanTier) manualParams.set("projectsHubPlan", projectsHubPlanTier);
      if (selected.length) manualParams.set("selected", selected.join(","));
      if (extraSeats > 0) manualParams.set("extraSeats", String(extraSeats));
      if (selectedProjectCreditPack) manualParams.set("projectCreditPack", selectedProjectCreditPack.id);
      if (selectedEmailPack) manualParams.set("emailPack", selectedEmailPack.label);
      if (selectedSmsPack) manualParams.set("smsPack", selectedSmsPack.label);
      if (selectedAiPack) manualParams.set("aiPack", selectedAiPack.label);
      router.push(`/checkout/success?${manualParams.toString()}`);
      return;
    }
    const params = new URLSearchParams();
    params.set("selected", selected.join(","));
    if (selectedPlan) params.set("plan", selectedPlan);
    if (emailPlanTier) params.set("emailPlan", emailPlanTier);
    if (smsPlanTier) params.set("smsPlan", smsPlanTier);
    if (calendarPlanTier) params.set("calendarPlan", calendarPlanTier);
    if (socialPlanTier) params.set("socialPlan", socialPlanTier);
    if (crmPlanTier) params.set("crmPlan", crmPlanTier);
    if (funnelPackTier) params.set("funnelPlan", funnelPackTier);
    if (projectsHubPlanTier) params.set("projectsHubPlan", projectsHubPlanTier);
    if (extraSeats > 0) params.set("extraSeats", String(extraSeats));
    if (selectedProjectCreditPack) params.set("projectCreditPack", selectedProjectCreditPack.id);
    if (selectedEmailPack) params.set("emailPack", selectedEmailPack.label);
    if (selectedSmsPack) params.set("smsPack", selectedSmsPack.label);
    if (selectedAiPack) params.set("aiPack", selectedAiPack.label);
    if (isAnnual) params.set("annual", "1");
    router.push(`/checkout?${params.toString()}`);
  };

  return (
    <div className="wrap">
      <div className="banner">
        <div className="banner-left">
          <span className="banner-icon" style={{ fontSize: 36, lineHeight: 1 }}>🧾</span>
          <div>
            <h1 className="banner-title">Pricing & Billing</h1>
            <p className="banner-subtitle">Choose your plan, add the modules you need, and get started.</p>
          </div>
        </div>
        <button className="back-btn" onClick={() => router.push("/dashboard")}>← Back</button>
      </div>

      <section className="gift-panel" aria-labelledby="gift-title">
        <div className="gift-kicker">Limited onboarding offer</div>
        <h2 id="gift-title">Our Special Gift To You!</h2>
        <p>
          We believe you should experience the power of Gr8 Result Digital Solutions before paying a cent. That's why we're giving every new customer a <strong>full 14-day free trial</strong>, allowing you to onboard, configure, and customise your platform without any upfront costs.
        </p>
        <p>
          Annual billing is available with a <strong>5% saving</strong> for customers who prefer to commit for the year and keep their platform costs predictable.
        </p>
        <p>
          Choose the core plan that suits your business, then add module upgrades or Builder Pro when you need more specialist workflows.
        </p>
        <p>
          There's never been a better time to transform the way you run and grow your business. Start your free trial today and discover how easy business growth can be when everything you need is finally all in one place.
        </p>
      </section>

      {/* ── Step 1: Platform Plan (rich cards) ── */}
      <div className="section-header">
        <h2 className="section-title">Step 1 — Choose Your Platform Plan</h2>
        <p className="section-sub">Controls features, team size, automation access &amp; support level. Click a plan to select it.</p>
      </div>
      <div className="billing-toggle">
        <span className={`toggle-label ${!isAnnual ? "active" : ""}`}>Monthly</span>
        <button className={`toggle-switch ${isAnnual ? "on" : ""}`} onClick={() => setIsAnnual((v) => !v)} aria-label="Toggle annual billing">
          <span className="toggle-knob" />
        </button>
        <span className={`toggle-label ${isAnnual ? "active" : ""}`}>Annual <span className="save-badge">Save 5%</span></span>
      </div>
      <div className="plans-grid">
        {PLANS.map((plan) => {
          const planId = plan.name.toLowerCase();
          const isSelected = selectedPlan === planId;
          const isCurrentPlan = currentPlan === planId;
          const basePlan = BASE_PLANS.find((p) => p.id === planId);
          const planPrice = basePlan?.price || parseInt(plan.price.replace("$", ""), 10);
          const introDiscountPercent = basePlan?.introDiscountPercent || 0;
          const introMonths = basePlan?.introMonths || 0;
          const trialDays = basePlan?.trialDays || 14;
          const introPrice = introDiscountPercent > 0 ? planPrice * (1 - introDiscountPercent / 100) : null;
          return (
            <div
              key={plan.name}
              className="plan-card"
              style={{
                "--plan-color": plan.color,
                borderColor: plan.color,
                background: isSelected ? `${plan.color}15` : isCurrentPlan ? `${plan.color}10` : "#111827",
                boxShadow: isSelected ? `0 0 0 3px ${plan.color}` : isCurrentPlan ? `0 0 0 2px ${plan.color}88` : "none",
              }}
            >
              {isCurrentPlan && (
                <div className="current-plan-badge" style={{ background: plan.color, color: plan.color === "#f59e0b" ? "#000" : "#fff" }}>
                  ✓ YOUR CURRENT PLAN
                </div>
              )}
              {plan.badge && !isCurrentPlan && (
                <div className="plan-badge" style={{ background: plan.color, color: plan.color === "#f59e0b" ? "#000" : "#fff" }}>
                  {plan.badge}
                </div>
              )}
              <h2 className="plan-name">{plan.name}</h2>
              <div className="plan-price">
                {isAnnual ? (
                  <>
                    <span className="plan-amount" style={{ color: plan.color }}>${Math.round(planPrice * 12 * 0.95).toLocaleString()}</span>
                    <span className="plan-period">/yr</span>
                  </>
                ) : (
                  <>
                    <span className="plan-amount" style={{ color: plan.color }}>{plan.price}</span>
                    <span className="plan-period">{plan.period}</span>
                  </>
                )}
              </div>
              {isAnnual && (
                <div className="annual-note" style={{ color: plan.color }}>equiv. ${Math.round(planPrice * 0.95)}/mo billed annually</div>
              )}
              {!isAnnual && introPrice && (
                <div className="intro-note" style={{ borderColor: plan.color }}>
                  <strong style={{ color: plan.color }}>{trialDays} days free</strong>, then <strong>${(introPrice * introMonths).toFixed(2)}</strong> upfront for your first {introMonths} months. Ongoing ${planPrice}/mo.
                </div>
              )}
              <p className="plan-tagline">{plan.tagline}</p>

              <button
                className="plan-btn"
                style={{
                  background: isSelected ? plan.color : "transparent",
                  color: isSelected ? (plan.color === "#f59e0b" ? "#000" : "#fff") : plan.color,
                  border: `2px solid ${plan.color}`,
                }}
                onClick={() => setSelectedPlan(isSelected ? null : planId)}
              >
                {isSelected ? "✓ Selected" : "Select This Plan"}
              </button>

              {(() => {
                const bundleVal = calcBundleValue(planId);
                const planPriceNum = parseInt(plan.price.replace("$", ""), 10);
                const savings = bundleVal - planPriceNum;
                if (savings <= 0) return (
                  <div className="plan-bundle-note" style={{ color: plan.color }}>
                    Bundle value <strong>${bundleVal}/mo</strong> included
                  </div>
                );
                return (
                  <div className="plan-savings-banner">
                    <div className="savings-modules">Buy modules separately: <strong>${bundleVal}/mo</strong></div>
                    <div className="savings-amount" style={{ color: plan.color }}>You save <strong>${savings}/mo</strong> &mdash; ${(savings * 12).toLocaleString()}/yr</div>
                  </div>
                );
              })()}

              <div className="plan-divider" style={{ background: plan.color }} />

              <ul className="plan-features">
                {plan.features.map((f, i) => (
                  <li key={i} className="feature-row">
                    <PlanCheckIcon color={plan.color} />
                    <span className="feature-label">{f.label}</span>
                    {f.value !== true && (
                      <span className="feature-value" style={{ color: plan.color }}>{f.value}</span>
                    )}
                  </li>
                ))}
              </ul>

              <div className="quota-header" style={{ borderColor: plan.color, color: plan.color }}>
                Base Quotas Included
              </div>
              <ul className="quota-list">
                {plan.quotas.map((q, i) => (
                  <li key={i} className="quota-row">
                    <span className="quota-label">{q.label}</span>
                    <span className="quota-value" style={{ color: plan.color }}>{q.value}</span>
                  </li>
                ))}
              </ul>
              <button
                className="plan-btn"
                style={{
                  background: isSelected ? plan.color : "transparent",
                  color: isSelected ? (plan.color === "#f59e0b" ? "#000" : "#fff") : plan.color,
                  border: `2px solid ${plan.color}`,
                  marginTop: 16,
                }}
                onClick={() => setSelectedPlan(isSelected ? null : planId)}
              >
                {isSelected ? "✓ Selected" : "Select This Plan"}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Optional Extras ── */}
      <div className="section-header" style={{ marginTop: 8 }}>
        <h2 className="section-title">Optional Add-ons</h2>
        <p className="section-sub">Included email, SMS, and AI quotas are monthly allowances. Add usage packs when customers need more capacity.</p>
      </div>
      <div className="extras-box">
        {selected.includes("builder-pro") && (PLAN_RANK[selectedPlan] || 0) >= PLAN_RANK.growth && (
          <>
            <div className="extra-row">
              <div className="extra-info">
                <div className="extra-title">Builder Pro Project Credits</div>
                <div className="extra-desc">Each Project Credit unlocks one complete Builder Pro project workspace from estimate through to completion.</div>
                <div className="extra-price">Builder Pro extras only</div>
              </div>
              <div className="pack-options">
                {PROJECT_CREDIT_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    className={`pack-btn ${projectCreditPack === pack.id ? "active" : ""}`}
                    onClick={() => setProjectCreditPack(projectCreditPack === pack.id ? "" : pack.id)}
                    type="button"
                  >
                    <span>{pack.label}</span>
                    <strong>${pack.price}/mo</strong>
                    {pack.badge && <em>{pack.badge}</em>}
                  </button>
                ))}
              </div>
            </div>
            <div className="extra-divider" />
          </>
        )}
        <div className="extra-row">
          <div className="extra-info">
            <div className="extra-title">👤 Extra Team Seats</div>
            <div className="extra-desc">Add more user seats beyond what your plan includes</div>
            <div className="extra-price">$15 / month per seat</div>
          </div>
          <div className="extra-controls">
            <button onClick={() => setExtraSeats(n => Math.max(0, n - 1))} className="qty-btn">−</button>
            <span className="qty-val">{extraSeats}</span>
            <button onClick={() => setExtraSeats(n => n + 1)} className="qty-btn">+</button>
          </div>
        </div>
        <div className="extra-divider" />
        <div className="extra-row">
          <div className="extra-info">
            <div className="extra-title">📧 Email Packs</div>
            <div className="extra-desc">Add monthly email sends above the included plan allowance</div>
            <div className="extra-price">From $25 / month</div>
          </div>
          <div className="pack-options">
            {EMAIL_PACKS.map((pack, index) => (
              <button
                key={pack.label}
                className={`pack-btn ${emailPackIndex === index ? "active" : ""}`}
                onClick={() => setEmailPackIndex(emailPackIndex === index ? -1 : index)}
                type="button"
              >
                <span>{pack.label}</span>
                <strong>${pack.price}/mo</strong>
              </button>
            ))}
          </div>
        </div>
        <div className="extra-divider" />
        <div className="extra-row">
          <div className="extra-info">
            <div className="extra-title">💬 SMS Packs</div>
            <div className="extra-desc">Add monthly SMS capacity above the included plan allowance</div>
            <div className="extra-price">From $10 / month</div>
          </div>
          <div className="pack-options">
            {SMS_PACKS.map((pack, index) => (
              <button
                key={pack.label}
                className={`pack-btn ${smsPackIndex === index ? "active" : ""}`}
                onClick={() => setSmsPackIndex(smsPackIndex === index ? -1 : index)}
                type="button"
              >
                <span>{pack.label}</span>
                <strong>${pack.price}/mo</strong>
              </button>
            ))}
          </div>
        </div>
        <div className="extra-divider" />
        <div className="extra-row">
          <div className="extra-info">
            <div className="extra-title">AI Credits</div>
            <div className="extra-desc">Add monthly AI credits above the included plan allowance</div>
            <div className="extra-price">From $29 / month</div>
          </div>
          <div className="pack-options">
            {AI_PACKS.map((pack, index) => (
              <button
                key={pack.label}
                className={`pack-btn ${aiPackIndex === index ? "active" : ""}`}
                onClick={() => setAiPackIndex(aiPackIndex === index ? -1 : index)}
                type="button"
              >
                <span>{pack.label}</span>
                <strong>${pack.price}/mo</strong>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Step 2: Feature Modules ── */}
      <div className="section-header" style={{ marginTop: 8 }}>
        <h2 className="section-title">Step 2 — Add or Upgrade Features in Specific Modules</h2>
        <p className="section-sub" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>Optional modules available on all plans</span>
          <button onClick={selectAll} className="btn select-all">Select All</button>
          <button onClick={clearAll} className="btn clear">Clear</button>
        </p>
      </div>

      <div className={`grid${selectedPlan ? " plan-active" : ""}`}>
        {MODULES.map((m) => {
          // Per-module tier config
          const TIER_CFG = {
            "email":           { tier: emailPlanTier,    path: "/modules/billing/email-plans",     key: "emailPlan",    strip: "Email Marketing — ",  btnBg: null },
            "sms":             { tier: smsPlanTier,       path: "/modules/billing/sms-plans",       key: "smsPlan",      strip: "SMS Marketing — ",    btnBg: "#38bdf8" },
            "calendar":        { tier: calendarPlanTier,  path: "/modules/billing/calendar-plans",  key: "calendarPlan", strip: "Calendar — ",          btnBg: null },
            "social":          { tier: socialPlanTier,    path: "/modules/billing/social-plans",    key: "socialPlan",   strip: "Social Media — ",      btnBg: null },
            "crm":             { tier: crmPlanTier,       path: "/modules/billing/crm-plans",       key: "crmPlan",      strip: "CRM — ",               btnBg: "#ec4899" },
            "funnels":         { tier: funnelPackTier,    path: "/modules/billing/funnel-plans",    key: "funnelPlan",   strip: "Funnels — ",           btnBg: "#ef465d" },
            "website-builder": { tier: websitePlanTier,    path: "/modules/billing/website-plans",       key: "websitePlan",      strip: "Website Builder — ",   btnBg: "#3b82f6" },
            "projects-hub":    { tier: projectsHubPlanTier, path: "/modules/billing/projects-hub-plans",  key: "projectsHubPlan",  strip: "Projects Hub — ",      btnBg: "#f97316" },
          };
          const tierCfg  = TIER_CFG[m.id];
          const tier      = tierCfg?.tier || null;
          const isSelected = selected.includes(m.id);
          const isActive   = activeModules.has(m.id);
          const planName   = selectedPlan ? BASE_PLANS.find(p => p.id === selectedPlan)?.name : null;
          const deltaKey   = m.id === "website-builder" ? "website" : m.id === "projects-hub" ? "projectsHub" : m.id;

          const isDead = Boolean(m.comingSoon);
          const hasTier = !!tier;
          const statusLabel = moduleStatusLabel(m, selectedPlan, selected);

          // Top-right corner badge — shows the selected base plan name on any coloured card
          let cornerBadge = null;
          if (planName && (isSelected || hasTier || isActive)) {
            const _planObj = BASE_PLANS.find(p => p.id === selectedPlan);
            const _badgeTextColor = _planObj?.color === '#f59e0b' ? '#000' : '#fff';
            cornerBadge = (
              <span style={{ fontSize: 11, color: _badgeTextColor, background: _planObj?.color || m.color, borderRadius: 6, padding: "3px 9px", fontWeight: 700, boxShadow: "0 2px 8px rgba(0,0,0,0.35)", letterSpacing: "0.05em", whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                {planName}
              </span>
            );
          }

          return (
          <div
            key={m.id}
            className={`card ${isSelected ? "selected" : ""} ${isActive ? "active-module" : ""} ${isDead ? "dead-module" : ""} ${hasTier ? "tier-selected" : ""}`}
            style={isDead ? { cursor: "default" } : {
              borderColor: m.color,
              "--hover-color": m.color,
              "--fill-color": m.color,
              cursor: isActive ? "default" : "pointer",
            }}
            onClick={() => {
              if (isActive || isDead) return;
              if (tier) return; // tiered module: must go to plan page to select
              toggleSelect(m.id);
            }}
          >
            {/* Active badge (bottom-right) */}
            {isActive && (
              <span style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(34,197,94,0.85)", color: "#000", fontSize: 13, fontWeight: 600, borderRadius: 5, padding: "2px 7px", letterSpacing: 0.4 }}>✓ ACTIVE</span>
            )}

            {/* Top-right corner badge — show whenever a tier has been chosen */}
            {cornerBadge && (
              <div style={{ position: "absolute", top: 8, right: 8 }}>{cornerBadge}</div>
            )}

            <span className="icon">{m.emoji ? <span style={{ fontSize: 24, lineHeight: 1 }}>{m.emoji}</span> : m.icon({ size: 28 })}</span>
            <div className="card-info">
              <h3>{m.name}</h3>
              <div className="module-status">{statusLabel}</div>
              {m.id === "builder-pro" && (
                <div className="module-mini-list">{BUILDER_PRO_FEATURES.slice(0, 4).join(" · ")}</div>
              )}
              {tierCfg ? (
                <button
                  className="upgrade-btn"
                  style={tierCfg.btnBg ? { background: tierCfg.btnBg, color: tierCfg.btnBg === "#38bdf8" ? "#000" : "#fff" } : {}}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(buildPlanPageUrl(tierCfg.path, tierCfg.key, tier));
                  }}
                >
                  {tier ? "Manage / Upgrade Plan" : "See Plans / Upgrade"}
                </button>
              ) : m.addOn ? (
                <p>A${m.price} / month</p>
              ) : (
                <p>{m.includedFrom ? "Included in eligible plans" : `A$${m.price} / month`}</p>
              )}
            </div>
          </div>
          );
        })}
      </div>
      <div className="discount-box">
        <h2>Enter Discount Code</h2>
        <div className="discount-row">
          <input
            type="text"
            value={discountCode}
            onChange={(e) => setDiscountCode(e.target.value)}
            placeholder="Enter discount code"
          />
          <button onClick={applyDiscount} className="apply-btn">Apply</button>
        </div>
        {discountMessage && <p className="discount-applied">{discountMessage}</p>}
      </div>

      <div className="total-box">
        <h2>Summary</h2>
        {selectedPlan ? (
          <p>Platform Plan: <span style={{ color: BASE_PLANS.find((p) => p.id === selectedPlan)?.color, fontWeight: 500 }}>
            {BASE_PLANS.find((p) => p.id === selectedPlan)?.name} — ${BASE_PLANS.find((p) => p.id === selectedPlan)?.price}/mo
          </span></p>
        ) : (
          <p style={{ color: "#f87171", fontSize: 20 }}>⚠ No platform plan selected — choose one above</p>
        )}
        <p>Email Plan: <span>{emailPlanTier ? `${PRICING[emailPlanTier]?.name || emailPlanTier} (${getModuleDeltaLabel("email", emailPlanTier, selectedPlan)})` : "-"}</span></p>
        <p>SMS Plan: <span>{smsPlanTier ? `${PRICING[smsPlanTier]?.name || smsPlanTier} (${getModuleDeltaLabel("sms", smsPlanTier, selectedPlan)})` : "-"}</span></p>
        <p>Calendar Plan: <span>{calendarPlanTier ? `${PRICING[calendarPlanTier]?.name || calendarPlanTier} (${getModuleDeltaLabel("calendar", calendarPlanTier, selectedPlan)})` : "-"}</span></p>
        <p>Social Media Plan: <span>{socialPlanTier ? `${PRICING[socialPlanTier]?.name || socialPlanTier} (${getModuleDeltaLabel("social", socialPlanTier, selectedPlan)})` : "-"}</span></p>
        <p>CRM Plan: <span>{crmPlanTier ? `${PRICING[crmPlanTier]?.name || crmPlanTier} (${getModuleDeltaLabel("crm", crmPlanTier, selectedPlan)})` : "-"}</span></p>
        <p>Funnels Pack: <span>{funnelPackTier ? `${PRICING[funnelPackTier]?.name || funnelPackTier} (${getModuleDeltaLabel("funnels", funnelPackTier, selectedPlan)})` : "-"}</span></p>
        <p>Website Builder Plan: <span>{websitePlanTier ? `${PRICING[websitePlanTier]?.name || websitePlanTier} (${getModuleDeltaLabel("website", websitePlanTier, selectedPlan)})` : "-"}</span></p>
        <p>Projects Hub Plan: <span>{projectsHubPlanTier ? `${PRICING[projectsHubPlanTier]?.name || projectsHubPlanTier} (${getModuleDeltaLabel("projectsHub", projectsHubPlanTier, selectedPlan)})` : "-"}</span></p>
        {selected.includes("builder-pro") && (
          <p>Builder Pro: <span>$49/mo</span></p>
        )}
        {selectedProjectCreditPack && (
          <p>Project Credits: <span>{selectedProjectCreditPack.label} (+${selectedProjectCreditPack.price}/mo)</span></p>
        )}
        {extraSeats > 0 && (
          <p>Extra Team Seats: <span>{extraSeats} × $15 = ${extraSeats * 15}/mo</span></p>
        )}
        {selectedEmailPack && (
          <p>Email Pack: <span>{selectedEmailPack.label} (+${selectedEmailPack.price}/mo)</span></p>
        )}
        {selectedSmsPack && (
          <p>SMS Pack: <span>{selectedSmsPack.label} (+${selectedSmsPack.price}/mo)</span></p>
        )}
        {selectedAiPack && (
          <p>AI Pack: <span>{selectedAiPack.label} (+${selectedAiPack.price}/mo)</span></p>
        )}
        <p>Subtotal: <span>A${billingSubtotal.toFixed(2)}</span></p>
        {!isAnnual && selectedBasePlan?.introDiscountPercent > 0 && (
          <div className="offer-note">
            <strong>Onboarding offer:</strong> To take advantage of the {selectedBasePlan.trialDays}-day free trial and {selectedBasePlan.introDiscountPercent}% off your first {selectedBasePlan.introMonths} months, your first {selectedBasePlan.introMonths} paid months are billed upfront as one onboarding payment. No payment is processed today. If you do not cancel before the trial ends, A${introPrepaidTotal.toFixed(2)} will be charged after the trial, then your account continues at A${total.toFixed(2)}/mo after the prepaid onboarding period.
          </div>
        )}
        {isAnnual && <p style={{ color: "#22c55e" }}>Annual billing discount: <span>-5%</span></p>}
        {discountPercent > 0 && <p>Promo discount: <span>{discountPercent}%</span></p>}
        <p className="grand-total">
          {isAnnual
            ? <><strong>A${total.toFixed(2)}/mo</strong> <span style={{ fontSize: 16, color: "#9ca3af", fontWeight: 400 }}>(A${(total * 12).toFixed(2)} billed annually)</span></>
            : selectedBasePlan?.introDiscountPercent > 0
              ? <><strong>A${introPrepaidTotal.toFixed(2)}</strong> <span style={{ fontSize: 16, color: "#9ca3af", fontWeight: 400 }}>(due after trial for first {selectedBasePlan.introMonths} months, then A${total.toFixed(2)}/mo)</span></>
              : <strong>A${total.toFixed(2)}/mo</strong>}
        </p>
        <p className="terms">
          Your 14 Day Free Trial — no charge will be made until the trial period ends.
          {isAnnual
            ? " By proceeding, you authorise us to charge your payment method the annual amount shown above at the end of the trial. Annual base plan subscriptions are non-refundable. Module add-ons may be cancelled at any time and a credit for the unused portion will be applied to your account."
            : selectedBasePlan?.introDiscountPercent > 0
              ? ` By proceeding, you authorise us to charge your payment method the prepaid onboarding amount shown above after the trial, covering your first ${selectedBasePlan.introMonths} paid months in advance. After that prepaid period, your subscription continues at the ongoing monthly amount shown above, charged in advance at the start of each monthly billing period, unless you cancel beforehand. Charges already processed are non-refundable.`
              : " By proceeding, you authorise us to charge your payment method the amount shown above in advance at the start of each monthly billing period, starting after your trial ends, unless you cancel beforehand. Charges already processed are non-refundable."}
        </p>
        <button onClick={handleProceed} className="pay-btn">
          Proceed to Payment
        </button>
      </div>

      <style jsx>{`
        .wrap { min-height: 100vh; background: #0c121a; color: #fff; padding: 28px; display: flex; flex-direction: column; align-items: center; }
        /* ── Banner ── */
        .banner { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #f59e0b; color: #000; padding: 24px; border-radius: 12px; margin-bottom: 32px; width: 100%; max-width: 1320px; }
        .banner-left { display: flex; align-items: center; gap: 16px; flex: 1; }
        .banner-icon { background: rgba(0,0,0,0.12); border-radius: 50%; padding: 10px; display: flex; align-items: center; flex-shrink: 0; }
        .banner > div { flex: 1; }
        .banner-title { font-size: 48px; font-weight: 600; margin: 0; line-height: 1.15; color: #000; }
        .banner-subtitle { font-size: 20px; margin: 6px 0 0; opacity: 0.8; color: #000; }
        .back-btn { background: rgba(0,0,0,0.15); border: 2px solid #000; color: #000; font-size: 20px; font-weight: 600; cursor: pointer; padding: 8px 20px; flex-shrink: 0; border-radius: 20px; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
        .back-btn:hover { background: #000; color: #f59e0b; }
        .gift-panel { width: 100%; max-width: 1320px; background: linear-gradient(135deg, rgba(34,197,94,0.12), rgba(59,130,246,0.10)); border: 1px solid rgba(34,197,94,0.42); border-radius: 12px; padding: 24px 28px; margin: -12px 0 32px; box-shadow: 0 18px 45px rgba(0,0,0,0.18); }
        .gift-kicker { display: inline-flex; align-items: center; background: rgba(34,197,94,0.16); color: #86efac; border: 1px solid rgba(34,197,94,0.36); border-radius: 999px; padding: 5px 12px; font-size: 14px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px; }
        .gift-panel h2 { margin: 0 0 12px; font-size: 32px; line-height: 1.15; color: #fff; }
        .gift-panel p { margin: 10px 0 0; color: #d1d5db; font-size: 18px; line-height: 1.7; max-width: 1180px; }
        .gift-panel strong { color: #86efac; font-weight: 800; }
        /* ── Billing toggle ── */
        .billing-toggle { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
        .toggle-label { font-size: 18px; font-weight: 600; color: #6b7280; }
        .toggle-label.active { color: #fff; }
        .toggle-switch { width: 52px; height: 28px; border-radius: 14px; background: #374151; border: none; cursor: pointer; position: relative; transition: background 0.2s; padding: 0; }
        .toggle-switch.on { background: #22c55e; }
        .toggle-knob { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: transform 0.2s; display: block; }
        .toggle-switch.on .toggle-knob { transform: translateX(24px); }
        .save-badge { background: #22c55e; color: #000; font-size: 13px; font-weight: 700; padding: 2px 7px; border-radius: 10px; margin-left: 6px; }
        .annual-note { font-size: 15px; margin: -4px 0 8px; opacity: 0.85; }
        .intro-note { font-size: 16px; line-height: 1.45; color: #d1d5db; background: rgba(255,255,255,0.04); border: 1px solid; border-radius: 8px; padding: 10px 12px; margin: -2px 0 12px; }
        /* ── Section headers ── */
        .section-header { width: 100%; max-width: 1320px; margin-bottom: 18px; }
        .section-title { font-size: 28px; font-weight: 700; margin: 0 0 4px; }
        .section-sub { font-size: 20px; color: #9ca3af; margin: 0; }
        /* ── Core Plan Cards ── */
        .plans-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; width: 100%; max-width: 1320px; margin-bottom: 48px; align-items: start; }
        .plan-card { position: relative; border: 2px solid; border-radius: 16px; padding: 28px 20px 24px; display: flex; flex-direction: column; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
        .plan-card:hover { transform: translateY(-4px); }
        .plan-badge { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); font-size: 18px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; padding: 5px 16px; border-radius: 20px; white-space: nowrap; }
        .current-plan-badge { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 5px 14px; border-radius: 20px; white-space: nowrap; }
        .plan-name { font-size: 26px; font-weight: 600; margin: 10px 0 5px; }
        .plan-price { display: flex; align-items: baseline; gap: 3px; margin-bottom: 8px; }
        .plan-amount { font-size: 48px; font-weight: 600; line-height: 1; }
        .plan-period { font-size: 20px; color: #9ca3af; }
        .plan-tagline { font-size: 18px; color: #9ca3af; margin: 0 0 14px; line-height: 1.5; min-height: 36px; }
        .plan-btn { width: 100%; padding: 16px; border-radius: 10px; font-size: 20px; font-weight: 600; cursor: pointer; margin-bottom: 16px; transition: opacity 0.2s; }
        .plan-btn:hover { opacity: 0.85; }
        .plan-bundle-note { font-size: 16px; color: #9ca3af; margin-bottom: 10px; }
        .plan-savings-banner { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px 14px; margin-bottom: 10px; font-size: 17px; }
        .savings-modules { color: #9ca3af; margin-bottom: 2px; }
        .savings-amount { font-size: 18px; font-weight: 700; }
        .plan-divider { height: 2px; opacity: 0.22; border-radius: 2px; margin-bottom: 14px; }
        .plan-features { list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-direction: column; gap: 8px; }
        .feature-row { display: flex; align-items: flex-start; gap: 7px; font-size: 18px; line-height: 1.45; }
        .feature-label { flex: 1; color: #d1d5db; }
        .feature-value { font-weight: 600; font-size: 18px; text-align: right; white-space: nowrap; flex-shrink: 0; }
        .quota-header { font-size: 18px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; border-top: 1px solid; padding-top: 12px; margin-bottom: 10px; opacity: 0.8; }
        .quota-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .quota-row { display: flex; justify-content: space-between; font-size: 18px; }
        .quota-label { color: #9ca3af; }
        .quota-value { font-weight: 600; }
        /* ── Module grid ── */
        .actions { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; max-width: 1320px; width: 100%; }
        .btn { padding: 12px 20px; border: none; border-radius: 8px; font-size: 20px; font-weight: 600; cursor: pointer; }
        .select-all { background: #22c55e; color: #000; }
        .clear { background: #ef4444; color: #fff; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; width: 100%; max-width: 1320px; margin-bottom: 30px; }
        .card { position: relative; display: flex; align-items: flex-start; gap: 12px; padding: 20px; border: 2px solid; border-radius: 12px; transition: all 0.25s ease; background: #0c121a; cursor: pointer; }
        .card:not(.dead-module):hover { border-width: 3px; }
        /* Fill when base plan chosen AND card is in selected (drives Select All / Clear) */
        .plan-active .card.selected:not(.dead-module) { background: var(--fill-color); color: #fff; border-width: 3px; }
        .plan-active .card.selected:not(.dead-module):hover { opacity: 0.85; }
        /* Fill when module tier explicitly chosen from sub-page — only when a base plan is active */
        .plan-active .card.tier-selected:not(.dead-module) { background: var(--fill-color); color: #fff; border-width: 3px; }
        .plan-active .card.tier-selected:not(.dead-module):hover { opacity: 0.85; }
        /* Always fill active/purchased modules */
        .card.active-module { background: var(--fill-color); color: #fff; border-width: 3px; }
        .card.dead-module { border-color: #2a3347; color: #4b5563; cursor: default; opacity: 0.5; }
        .card-info { flex: 1; }
        .card-info h3 { margin: 0; font-size: 30px; font-weight: 600;}
        .module-status { margin-top: 6px; color: #cbd5e1; font-size: 17px; font-weight: 700; }
        .module-mini-list { margin-top: 5px; color: #9ca3af; font-size: 15px; line-height: 1.45; }
        .plan-active .card.selected .module-status,
        .plan-active .card.tier-selected .module-status,
        .card.active-module .module-status,
        .plan-active .card.selected .module-mini-list,
        .plan-active .card.tier-selected .module-mini-list,
        .card.active-module .module-mini-list { color: rgba(255,255,255,0.86); }
        .plan-display { font-size: 20px; margin-top: 6px; }
        .upgrade-btn { margin-top: 10px; background: #facc15; color: #000; border: none; padding: 12px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 20px; }
        .sms-btn { background: #38bdf8; color: #fff; }
        /* ── Discount + Summary ── */
        .discount-box { width: 100%; max-width: 600px; margin-top: 20px; }
        .discount-row { display: flex; gap: 10px; }
        input { flex: 1; padding: 14px; border-radius: 8px; border: 1px solid #444; background: #1a2232; color: #fff; font-size: 18px; }
        .apply-btn { background: #22c55e; color: #000; padding: 14px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 20px; }
        .discount-applied { margin-top: 8px; color: #a3e635; font-size: 18px; }
        .total-box { margin-top: 30px; width: 100%; max-width: 600px; background: #111827; border: 1px solid #333; border-radius: 12px; padding: 24px; font-size: 20px; }
        .total-box p { display: flex; justify-content: space-between; margin: 10px 0; }
        .offer-note { background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.42); border-radius: 8px; color: #d1fae5; font-size: 16px; line-height: 1.65; margin: 12px 0; padding: 12px 14px; }
        .offer-note strong { color: #22c55e; }
        .grand-total { font-size: 24px; font-weight: 600; margin-top: 12px; }
        .terms { margin-top: 16px; font-size: 18px; line-height: 1.8; opacity: 0.9; text-align: center; }
        .pay-btn { width: 100%; background: #3b82f6; color: #fff; margin-top: 20px; padding: 20px; border-radius: 10px; font-weight: 600; font-size: 24px; cursor: pointer; border: none; }
        .pay-btn:hover { background: #2563eb; }
        /* ── Optional Extras ── */
        .extras-box { width: 100%; max-width: 1320px; background: #111827; border: 1px solid #1f2937; border-radius: 14px; padding: 24px 28px; margin-bottom: 36px; }
        .extra-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
        .extra-divider { border: none; border-top: 1px solid #1f2937; margin: 20px 0; }
        .extra-info { flex: 1; }
        .extra-title { font-size: 26px; font-weight: 600; margin-bottom: 4px; }
        .extra-desc { font-size: 20px; color: #9ca3af; margin-bottom: 6px; }
        .extra-price { font-size: 20px; font-weight: 600; color: #f59e0b; }
        .extra-controls { display: flex; align-items: center; gap: 16px; }
        .pack-options { display: grid; grid-template-columns: repeat(2, minmax(160px, 1fr)); gap: 10px; min-width: 420px; max-width: 560px; }
        .pack-btn { background: #0c121a; border: 1px solid #334155; color: #e5e7eb; border-radius: 10px; padding: 11px 13px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 4px; font-size: 16px; transition: border-color 0.15s, background 0.15s; }
        .pack-btn strong { color: #f59e0b; font-size: 17px; }
        .pack-btn em { color: #22c55e; font-size: 13px; font-style: normal; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
        .pack-btn.active { border-color: #22c55e; background: rgba(34,197,94,0.12); }
        .qty-btn { width: 44px; height: 44px; border-radius: 8px; border: 2px solid #f59e0b; background: transparent; color: #f59e0b; font-size: 24px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; transition: background 0.15s; }
        .qty-btn:hover { background: #f59e0b; color: #000; }
        .qty-val { font-size: 26px; font-weight: 800; min-width: 36px; text-align: center; }
        @media (max-width: 1100px) {
          .plans-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .plans-grid { grid-template-columns: 1fr; }
          .banner-title { font-size: 32px; }
          .extra-row { align-items: flex-start; flex-direction: column; }
          .pack-options { grid-template-columns: 1fr; min-width: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
