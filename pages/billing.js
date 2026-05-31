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

const MODULES = [
  { id: "email",          name: "Email Marketing",         price: 59, color: "#facc15", icon: ICONS.email,          emoji: "📧" },
  { id: "crm",            name: "CRM",                     price: 19, color: "#ec4899", icon: ICONS.account,         emoji: "🗂️" },
  { id: "projects-hub",  name: "Projects Hub",            price: 35, color: "#f97316",                             emoji: "🏗️" },
  { id: "sms",            name: "SMS Marketing",           price: 25, color: "#38bdf8", icon: ICONS.sms,            emoji: "💬" },
  { id: "social",         name: "Social Media",            price: 29, color: "#8126e9", icon: ICONS.social,         emoji: "📱" },
  { id: "calendar",       name: "Booking Calendar",         price: 19, color: "#84cc16", icon: ICONS.calendar,       emoji: "📅" },
  { id: "website-builder",name: "Website Builder",         price: 29, color: "#3b82f6", icon: ICONS.websiteBuilder, emoji: "🌐" },
  { id: "funnels",        name: "Funnels & Landing Pages", price: 19, color: "#ef465d", icon: ICONS.funnels },
  { id: "automation",     name: "Business Automation",     price: 29, color: "#fb923c", icon: ICONS.automation,     emoji: "⚙️" },
  { id: "webinars",       name: "Webinars",                price: 29, color: "#ef4444", icon: ICONS.webinars,       emoji: "🎥" },
  { id: "subscription",   name: "Subscription Pipeline",   price: 19, color: "#7c3aed", icon: ICONS.subscription,   emoji: "🌿" },
  { id: "subaccounts",    name: "Subaccounts",             price: 19, color: "#10b981", icon: ICONS.subaccounts },
];

const BASE_PLANS = [
  { id: "starter",      name: "Starter",      price: 159, color: "#6366f1", badge: null,           users: "2 users",        tagline: "Core tools for solo operators & small teams" },
  { id: "growth",       name: "Growth",       price: 359, color: "#22c55e", badge: "Most Popular",  users: "5 users",        tagline: "Scale sales, marketing & automation" },
  { id: "scale",        name: "Scale",        price: 499, color: "#f59e0b", badge: "Best Value",    users: "10 users",       tagline: "Advanced AI, analytics & full automation suite" },
  { id: "professional", name: "Professional", price: 999, color: "#7c3aed", badge: "Enterprise",    users: "Up to 25 users", tagline: "Full agency OS with dedicated account manager" },
];

// Full plan details (features + quotas) — used for the rich plan cards at the top of the page
const PLANS = [
  {
    name: "Starter", color: "#6366f1", badge: null,
    price: "$159", period: "/mo",
    tagline: "For solo operators and small teams just getting started.",
    features: [
      { label: "Team Seats",              value: "2 users" },
      { label: "CRM Pipelines",           value: "1" },
      { label: "Communities",             value: "1" },
      { label: "Connected Social Accounts", value: "3" },
      { label: "Automation Workflows",    value: "5" },
      { label: "Calendar & Bookings",     value: true },
      { label: "Shared Phone Number for SMS",      value: true },
      { label: "FREE Marketplace Access",      value: true },
      { label: "Reporting",               value: "Email & CRM stats" },
      { label: "Support",                 value: "Email" },
    ],
    quotas: [
      { label: "Email contacts",        value: "5,000" },
      { label: "Email sends/mo",        value: "50,000" },
      { label: "SMS credits/mo",        value: "500" },
      { label: "Websites",              value: "1" },
      { label: "Funnels",               value: "Landing pages only" },
      { label: "Projects Hub",           value: "3 jobs · 5 projects · 2 users" },
      { label: "AI credits/mo",         value: "50" },
      { label: "Storage",               value: "5 GB" },
    ],
  },
  {
    name: "Growth", color: "#22c55e", badge: "Most Popular",
    price: "$359", period: "/mo",
    tagline: "For growing teams scaling sales and marketing operations.",
    features: [
      { label: "Team Seats",              value: "5 users" },
      { label: "CRM Pipelines",           value: "3" },
      { label: "Communities",             value: "3" },
      { label: "Connected Social Accounts", value: "7" },
      { label: "Automation Workflows",    value: "8" },
      { label: "SMS Scheduled Campaigns",  value: "3" },
      { label: "Call Recording & AI Transcription", value: true },
      { label: "Calendar & Bookings",     value: true },
      { label: "Shared Phone Number for Calls and SMS",      value: true },
      { label: "Affiliate Management",    value: true },
      { label: "Reporting",               value: "Email, SMS & Call Analytics" },
      { label: "Support",                 value: "Priority Email" },
    ],
    quotas: [
      { label: "Email contacts",        value: "15,000" },
      { label: "Email sends/mo",        value: "150,000" },
      { label: "SMS credits/mo",        value: "2,500" },
      { label: "Websites",              value: "2" },
      { label: "Funnels",               value: "1 (+ extras at cost)" },
      { label: "Projects Hub",           value: "15 jobs · 20 projects · dependencies" },
      { label: "AI credits/mo",         value: "250" },
      { label: "Storage",               value: "25 GB" },
    ],
  },
  {
    name: "Scale", color: "#f59e0b", badge: "Best Value",
    price: "$499", period: "/mo",
    tagline: "For established businesses scaling teams and operations.",
    features: [
      { label: "Team Seats",              value: "10 users" },
      { label: "CRM Pipelines",           value: "10" },
      { label: "Communities",             value: "Unlimited" },
      { label: "Connected Social Accounts", value: "15" },
      { label: "Automation Workflows",    value: "10" },
      { label: "SMS Scheduled Campaigns",  value: "10" },
      { label: "AI Transcription + Sentiment", value: true },
      { label: "AI Website Builder",      value: true },
      { label: "Shared Phone Number",      value: true },
      { label: "Reporting",               value: "Full Analytics + CSV export" },
      { label: "Support",                 value: "Dedicated Onboarding" },
    ],
    quotas: [
      { label: "Email contacts",        value: "40,000" },
      { label: "Email sends/mo",        value: "400,000" },
      { label: "SMS credits/mo",        value: "5,000" },
      { label: "Websites",              value: "3" },
      { label: "Funnels",               value: "3 (+ extras at cost)" },
      { label: "Projects Hub",           value: "Unlimited jobs & projects · resource allocation · critical path" },
      { label: "AI credits/mo",         value: "750" },
      { label: "Storage",               value: "100 GB" },
    ],
  },
  {
    name: "Professional", color: "#7c3aed", badge: "Enterprise",
    price: "$999", period: "/mo",
    tagline: "Complete business OS for large teams and agencies.",
    features: [
      { label: "Team Seats",              value: "Up to 25 users" },
      { label: "CRM Pipelines",           value: "Unlimited" },
      { label: "Communities",             value: "Unlimited" },
      { label: "Connected Social Accounts", value: "Unlimited" },
      { label: "SMS Scheduled Campaigns",  value: "Unlimited" },
      { label: "Automation Workflows",    value: "Unlimited" },
      { label: "AI Call Transcription & Sentiment", value: true },
      { label: "AI Content & Post Generation", value: true },
      { label: "Shared Phone Number",      value: true },
      { label: "Reporting",               value: "Full Analytics + Scheduled Reports" },
      { label: "Support",                 value: "Account Manager + SLA" },
    ],
    quotas: [
      { label: "Email contacts",  value: "200,000" },
      { label: "Email sends/mo",  value: "2,000,000" },
      { label: "SMS credits/mo",  value: "10,000" },
      { label: "Websites",        value: "5" },
      { label: "Funnels",               value: "10 (+ extras at cost)" },
      { label: "Projects Hub",           value: "Unlimited · white-label · API" },
      { label: "AI credits/mo",         value: "5,000" },
      { label: "Storage",               value: "500 GB" },
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
    const [smsPlanTier, setSmsPlanTier] = useState(null);
    const [calendarPlanTier, setCalendarPlanTier] = useState(null);
    const [socialPlanTier, setSocialPlanTier] = useState(null);
    const [crmPlanTier, setCrmPlanTier] = useState(null);
    const [funnelPackTier, setFunnelPackTier] = useState(null);
    const [websitePlanTier, setWebsitePlanTier] = useState(null);
    const [projectsHubPlanTier, setProjectsHubPlanTier] = useState(null);  const [privateNumbers, setPrivateNumbers] = useState(0);  const [extraContactBlocks, setExtraContactBlocks] = useState(0);  const [extraSendBlocks, setExtraSendBlocks] = useState(0);  const [extraSeats, setExtraSeats] = useState(0);    const [queryTiersLoaded, setQueryTiersLoaded] = useState(false);
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

  const toggleSelect = (id) => {
    if (activeModules.has(id)) return; // can't deselect an active/purchased module
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAll = () => setSelected(MODULES.map((m) => m.id));
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

  const subtotal = MODULES.filter((m) => {
    if (!selected.includes(m.id)) return false;
    if (activeModules.has(m.id)) return false; // already purchased, don't charge again
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
  const privateNumbersCost = privateNumbers * 35;
  const extraContactsCost = extraContactBlocks * 10;
  const extraSendsCost = extraSendBlocks * 20;
  const extraSeatsCost = extraSeats * 15;
  const annualMultiplier = isAnnual ? 0.80 : 1;
  const total = (basePlanPrice + subtotal + emailPlanPrice + smsPlanPrice + calendarPlanPrice + socialPlanPrice + crmPlanPrice + funnelPackPrice + projectsHubPlanPrice + privateNumbersCost + extraContactsCost + extraSendsCost + extraSeatsCost) * annualMultiplier * (1 - discountPercent / 100);

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
        <span className={`toggle-label ${isAnnual ? "active" : ""}`}>Annual <span className="save-badge">Save 20% — 2 months free</span></span>
      </div>
      <div className="plans-grid">
        {PLANS.map((plan) => {
          const planId = plan.name.toLowerCase();
          const isSelected = selectedPlan === planId;
          return (
            <div
              key={plan.name}
              className="plan-card"
              style={{
                "--plan-color": plan.color,
                borderColor: plan.color,
                background: isSelected ? `${plan.color}15` : "#111827",
                boxShadow: isSelected ? `0 0 0 3px ${plan.color}` : "none",
              }}
            >
              {plan.badge && (
                <div className="plan-badge" style={{ background: plan.color, color: plan.color === "#f59e0b" ? "#000" : "#fff" }}>
                  {plan.badge}
                </div>
              )}
              <h2 className="plan-name">{plan.name}</h2>
              <div className="plan-price">
                {isAnnual ? (
                  <>
                    <span className="plan-amount" style={{ color: plan.color }}>${Math.round(parseInt(plan.price.replace("$",""), 10) * 12 * 0.95).toLocaleString()}</span>
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
                <div className="annual-note" style={{ color: plan.color }}>equiv. ${Math.round(parseInt(plan.price.replace("$",""), 10) * 0.80)}/mo billed annually</div>
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
        <p className="section-sub">Extend your plan with extra seats, phone numbers, email contacts, and send capacity.</p>
      </div>
      <div className="extras-box">
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
            <div className="extra-title">Private Dedicated Phone Number</div>
            <div className="extra-desc">Your own number for calls &amp; SMS — independent of the shared platform number</div>
            <div className="extra-price">$35 / month per number</div>
          </div>
          <div className="extra-controls">
            <button onClick={() => setPrivateNumbers(n => Math.max(0, n - 1))} className="qty-btn">−</button>
            <span className="qty-val">{privateNumbers}</span>
            <button onClick={() => setPrivateNumbers(n => n + 1)} className="qty-btn">+</button>
          </div>
        </div>
        <div className="extra-divider" />
        <div className="extra-row">
          <div className="extra-info">
            <div className="extra-title">📧 Extra Email Contacts</div>
            <div className="extra-desc">Add extra subscriber capacity above your email plan limit</div>
            <div className="extra-price">$10 / month per 1,000 contacts</div>
          </div>
          <div className="extra-controls">
            <button onClick={() => setExtraContactBlocks(n => Math.max(0, n - 1))} className="qty-btn">−</button>
            <span className="qty-val">{extraContactBlocks}</span>
            <button onClick={() => setExtraContactBlocks(n => n + 1)} className="qty-btn">+</button>
          </div>
        </div>
        <div className="extra-divider" />
        <div className="extra-row">
          <div className="extra-info">
            <div className="extra-title">📨 Extra Email Sends</div>
            <div className="extra-desc">Add extra monthly send capacity above your email plan limit</div>
            <div className="extra-price">$20 / month per 10,000 sends</div>
          </div>
          <div className="extra-controls">
            <button onClick={() => setExtraSendBlocks(n => Math.max(0, n - 1))} className="qty-btn">−</button>
            <span className="qty-val">{extraSendBlocks}</span>
            <button onClick={() => setExtraSendBlocks(n => n + 1)} className="qty-btn">+</button>
          </div>
        </div>
      </div>

      {/* ── Step 2: Feature Modules ── */}
      <div className="section-header" style={{ marginTop: 8 }}>
        <h2 className="section-title">Step 2 — Add Feature Modules</h2>
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

          // Dead modules — not yet built, no plan badge
          const DEAD_MODULES = new Set(["automation", "webinars", "subscription", "subaccounts"]);

          // Top-right corner badge
          let cornerBadge = null;
          if (tier) {
            // Module has a selected tier — show tier name prominently
            cornerBadge = (
              <span style={{ fontSize: 14, color: "#fff", background: m.color, borderRadius: 8, padding: "5px 12px", fontWeight: 700, boxShadow: "0 2px 8px rgba(0,0,0,0.4)", letterSpacing: "0.02em" }}>
                {PRICING[tier]?.name?.replace(tierCfg.strip, "") || tier}
              </span>
            );
          }

          const isDead = DEAD_MODULES.has(m.id);
          const hasTier = !!tier;

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
              ) : (
                <p>A${m.price} / month</p>
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
        {privateNumbers > 0 && (
          <p>Private Phone Numbers: <span>{privateNumbers} × $35 = ${privateNumbers * 35}/mo</span></p>
        )}
        {extraContactBlocks > 0 && (
          <p>Extra Email Contacts: <span>{extraContactBlocks} × 1,000 = {extraContactBlocks * 1000} contacts (+${extraContactBlocks * 10}/mo)</span></p>
        )}
        {extraSendBlocks > 0 && (
          <p>Extra Email Sends: <span>{extraSendBlocks} × 10,000 = {(extraSendBlocks * 10000).toLocaleString()} sends (+${extraSendBlocks * 20}/mo)</span></p>
        )}
        <p>Subtotal: <span>A${subtotal.toFixed(2)}</span></p>
        {isAnnual && <p style={{ color: "#22c55e" }}>Annual billing discount: <span>−20% (2 months free)</span></p>}
        {discountPercent > 0 && <p>Promo discount: <span>{discountPercent}%</span></p>}
        <p className="grand-total">
          {isAnnual
            ? <><strong>A${total.toFixed(2)}/mo</strong> <span style={{ fontSize: 16, color: "#9ca3af", fontWeight: 400 }}>(A${(total * 12).toFixed(2)} billed annually)</span></>
            : <strong>A${total.toFixed(2)}/mo</strong>}
        </p>
        <p className="terms">
          Your 14 Day Free Trial — no charge will be made until the trial period ends.
          {isAnnual
            ? " By proceeding, you authorise us to charge your payment method the annual amount shown above at the end of the trial. Annual base plan subscriptions are non-refundable. Module add-ons may be cancelled at any time and a credit for the unused portion will be applied to your account."
            : " By proceeding, you authorise us to charge your payment method the amount shown above at the end of each monthly billing period, starting after your trial ends, unless you cancel beforehand. Charges already processed are non-refundable."}
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
        /* ── Section headers ── */
        .section-header { width: 100%; max-width: 1320px; margin-bottom: 18px; }
        .section-title { font-size: 28px; font-weight: 700; margin: 0 0 4px; }
        .section-sub { font-size: 20px; color: #9ca3af; margin: 0; }
        /* ── Core Plan Cards ── */
        .plans-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; width: 100%; max-width: 1320px; margin-bottom: 48px; align-items: start; }
        .plan-card { position: relative; border: 2px solid; border-radius: 16px; padding: 28px 20px 24px; display: flex; flex-direction: column; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
        .plan-card:hover { transform: translateY(-4px); }
        .plan-badge { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); font-size: 18px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; padding: 5px 16px; border-radius: 20px; white-space: nowrap; }
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
        /* Fill when module tier explicitly chosen from sub-page */
        .card.tier-selected:not(.dead-module) { background: var(--fill-color); color: #fff; border-width: 3px; }
        .card.tier-selected:not(.dead-module):hover { opacity: 0.85; }
        /* Always fill active/purchased modules */
        .card.active-module { background: var(--fill-color); color: #fff; border-width: 3px; }
        .card.dead-module { border-color: #2a3347; color: #4b5563; cursor: default; opacity: 0.5; }
        .card-info { flex: 1; }
        .card-info h3 { margin: 0; font-size: 30px; font-weight: 600;}
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
        .qty-btn { width: 44px; height: 44px; border-radius: 8px; border: 2px solid #f59e0b; background: transparent; color: #f59e0b; font-size: 24px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; transition: background 0.15s; }
        .qty-btn:hover { background: #f59e0b; color: #000; }
        .qty-val { font-size: 26px; font-weight: 800; min-width: 36px; text-align: center; }
        @media (max-width: 1100px) {
          .plans-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .plans-grid { grid-template-columns: 1fr; }
          .banner-title { font-size: 32px; }
        }
      `}</style>
    </div>
  );
}