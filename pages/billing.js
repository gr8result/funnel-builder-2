// /pages/billing.js 
// ✅ FINAL version — integrates Email Plan display + upgrade link
// Keeps existing discount logic, design, icons, and layout intact

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabase-client";
import ICONS from "../components/iconMap";
import PRICING from "../data/pricing";

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
};

const formatTierLabel = (tier) => {
  const p = PRICING[tier];
  if (!p) return "Contact Support";
  if (typeof p.price === "number" && p.price > 0) return `A$${p.price} / month`;
  if (p.price === 0 && tier !== "email-free") return "Contact Support";
  return "A$0 / month";
};
const getPlanPrice = (tier) => PRICING[tier]?.price || 0;

function normalizeActiveModuleId(moduleId) {
  return ACTIVE_MODULE_ALIASES[moduleId] || moduleId;
}

const MODULES = [
  { id: "email", name: "Email Marketing", price: 29, color: "#facc15", icon: ICONS.email },
  { id: "crm", name: "CRM", price: 29, color: "#ec4899", icon: ICONS.account },
  { id: "sms", name: "SMS Marketing", price: 25, color: "#38bdf8", icon: ICONS.sms },
  { id: "social", name: "Social Media", price: 29, color: "#8126e9", icon: ICONS.social },
  { id: "calendar", name: "Calendar", price: 29, color: "#84cc16", icon: ICONS.calendar },
  { id: "website-builder", name: "Website Builder", price: 29, color: "#3b82f6", icon: ICONS.websiteBuilder },
  { id: "funnels", name: "Funnels", price: 29, color: "#ef465d", icon: ICONS.funnels },
  { id: "automation", name: "Business Automation", price: 29, color: "#fb923c", icon: ICONS.automation },
  { id: "webinars", name: "Webinars", price: 29, color: "#ef4444", icon: ICONS.webinars },
  { id: "subscription", name: "Subscription Pipeline", price: 19, color: "#7c3aed", icon: ICONS.subscription },
  { id: "subaccounts", name: "Subaccounts", price: 19, color: "#10b981", icon: ICONS.subaccounts },
];

export default function Billing() {
    // Read selected plan tiers from query string
    // Track selected pricing tiers for all three modules
    const [emailPlanTier, setEmailPlanTier] = useState(null);
    const [smsPlanTier, setSmsPlanTier] = useState(null);
    const [calendarPlanTier, setCalendarPlanTier] = useState(null);
    const [socialPlanTier, setSocialPlanTier] = useState(null);
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
        const socialTier = params.get("socialPlan");

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
  const router = useRouter();

  const buildPlanPageUrl = (basePath) => {
    const params = new URLSearchParams();
    if (emailPlanTier) params.set("emailPlan", emailPlanTier);
    if (smsPlanTier) params.set("smsPlan", smsPlanTier);
    if (calendarPlanTier) params.set("calendarPlan", calendarPlanTier);
    if (socialPlanTier) params.set("socialPlan", socialPlanTier);
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
      const { data: moduleRows } = await supabase
        .from("user_modules")
        .select("module_id")
        .eq("user_id", currentUser.id);

      if (moduleRows && moduleRows.length > 0) {
        const ids = moduleRows.map((r) => r.module_id);
        // Extract social plan tier stored as __social_plan_tier:xxx
        const socialTierRow = ids.find((id) => id.startsWith("__social_plan_tier:"));
        if (socialTierRow && !socialTierFromUrl && !socialPlanTier) {
          const tier = socialTierRow.split(":")[1];
          setSocialPlanTier(tier);
          setSelected((prev) => (prev.includes("social") ? prev : [...prev, "social"]));
        }
        const realIds = ids
          .filter((id) => !id.startsWith("__"))
          .map(normalizeActiveModuleId);
        setActiveModules(new Set(realIds));
        setSelected((prev) => {
          const merged = new Set([...prev, ...realIds]);
          return Array.from(merged);
        });
      }

      // Do not override plan already selected from query string.
      if (!emailTierFromUrl && !emailPlanTier && acc?.email_plan_tier) {
        setEmailPlanTier(acc.email_plan_tier);
        setSelected((prev) => (prev.includes("email") ? prev : [...prev, "email"]));
      }

      if (!smsTierFromUrl && !smsPlanTier && acc?.sms_plan_tier) {
        setSmsPlanTier(acc.sms_plan_tier);
        setSelected((prev) => (prev.includes("sms") ? prev : [...prev, "sms"]));
      }

      if (!calendarTierFromUrl && !calendarPlanTier && acc?.calendar_plan_tier) {
        setCalendarPlanTier(acc.calendar_plan_tier);
        setSelected((prev) => (prev.includes("calendar") ? prev : [...prev, "calendar"]));
      }
    };

    fetchData();
  }, [router, queryTiersLoaded]);

  useEffect(() => {
    if (emailPlanTier) {
      setEmailPlan(PRICING[emailPlanTier]?.name || emailPlanTier);
    }
  }, [emailPlanTier]);

  const toggleSelect = (id) => {
    if (activeModules.has(id)) return; // can't deselect an active/purchased module
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAll = () => setSelected(MODULES.map((m) => m.id));
  const clearAll = () => setSelected([]);

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
    return true;
  }).reduce((sum, m) => sum + m.price, 0);
  // Only charge for plan tiers that are:
  // 1. Present as a URL param (user actively selected this session), AND
  // 2. Different from what's already in DB (not already paid for)
  const emailPlanPrice = (tiersFromUrl.email && tiersFromUrl.email !== dbPlanTiers.email) ? getPlanPrice(tiersFromUrl.email) : 0;
  const smsPlanPrice = (tiersFromUrl.sms && tiersFromUrl.sms !== dbPlanTiers.sms) ? getPlanPrice(tiersFromUrl.sms) : 0;
  const calendarPlanPrice = (tiersFromUrl.calendar && tiersFromUrl.calendar !== dbPlanTiers.calendar) ? getPlanPrice(tiersFromUrl.calendar) : 0;
  const socialPlanPrice = (tiersFromUrl.social && tiersFromUrl.social !== dbPlanTiers.social) ? getPlanPrice(tiersFromUrl.social) : 0;
  const total = (subtotal + emailPlanPrice + smsPlanPrice + calendarPlanPrice + socialPlanPrice) * (1 - discountPercent / 100);

  const handleProceed = async () => {
    if (!user) return alert("Please log in first.");
    if (selected.length === 0) return alert("Please select at least one module.");
    if (discountPercent === 100) {
      const manualParams = new URLSearchParams();
      manualParams.set("provider", "manual");
      if (emailPlanTier) manualParams.set("emailPlan", emailPlanTier);
      if (smsPlanTier) manualParams.set("smsPlan", smsPlanTier);
      if (calendarPlanTier) manualParams.set("calendarPlan", calendarPlanTier);
      if (socialPlanTier) manualParams.set("socialPlan", socialPlanTier);
      if (selected.length) manualParams.set("selected", selected.join(","));
      router.push(`/checkout/success?${manualParams.toString()}`);
      return;
    }
    const params = new URLSearchParams();
    params.set("selected", selected.join(","));
    if (emailPlanTier) params.set("emailPlan", emailPlanTier);
    if (smsPlanTier) params.set("smsPlan", smsPlanTier);
    if (calendarPlanTier) params.set("calendarPlan", calendarPlanTier);
    if (socialPlanTier) params.set("socialPlan", socialPlanTier);
    router.push(`/checkout?${params.toString()}`);
  };

  return (
    <div className="wrap">
      <div className="banner">
        <span className="banner-icon">{ICONS.billing({ size: 48 })}</span>
        <div>
          <h1 className="banner-title">Billing & Modules</h1>
          <p className="banner-subtitle">Select your modules and manage your subscription plan.</p>
        </div>
        <button className="back-btn" onClick={() => router.push("/dashboard")}>&larr; Back</button>
      </div>

      <div className="actions">
        <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 600 }}>Select Modules</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
          <button onClick={selectAll} className="btn select-all">Select All</button>
          <button onClick={clearAll} className="btn clear">Clear</button>
        </div>
      </div>

      <div className="grid">
        {MODULES.map((m) => (
          <div
            key={m.id}
            className={`card ${selected.includes(m.id) ? "selected" : ""} ${activeModules.has(m.id) ? "active-module" : ""}`}
            style={{
              borderColor: m.color,
              "--hover-color": m.color,
              "--fill-color": m.color,
              cursor: activeModules.has(m.id) ? "default" : "pointer",
            }}
            onClick={() => {
              if (m.id === "email" && emailPlanTier) return;
              toggleSelect(m.id);
            }}
          >
            {activeModules.has(m.id) && (
              <span style={{
                position: "absolute", top: 8, left: 8,
                background: "rgba(34,197,94,0.85)", color: "#000",
                fontSize: 16, fontWeight: 600, borderRadius: 5,
                padding: "2px 7px", letterSpacing: 0.4,
              }}>✓ ACTIVE</span>
            )}
            <span className="icon">{m.icon({ size: 28 })}</span>
            <div className="card-info">
              <h3>{m.name}</h3>
              {m.id === "email" ? (
                <>
                  <div style={{ position: "absolute", top: 8, right: 8 }}>
                    {emailPlanTier && (
                      <span style={{ fontSize: "16px", color: "#fff", background: "rgba(0,0,0,0.5)", borderRadius: "6px", padding: "3px 10px", fontWeight: 600 }}>
                        {PRICING[emailPlanTier]?.name?.replace("Email Marketing — ", "") || emailPlanTier} · {formatTierLabel(emailPlanTier)}
                      </span>
                    )}
                  </div>
                  <button
                    className="upgrade-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(buildPlanPageUrl("/modules/billing/email-plans"));
                    }}
                  >
                    {emailPlanTier ? "Manage / Upgrade Plan" : "See Plans / Upgrade"}
                  </button>
                </>
              ) : m.id === "sms" ? (
                <>
                  <div style={{ position: "absolute", top: 8, right: 8 }}>
                    {smsPlanTier && (
                      <span style={{ fontSize: "16px", color: "#fff", background: "rgba(0,0,0,0.5)", borderRadius: "6px", padding: "3px 10px", fontWeight: 600 }}>
                        {PRICING[smsPlanTier]?.name?.replace("SMS Marketing — ", "") || smsPlanTier} · {formatTierLabel(smsPlanTier)}
                      </span>
                    )}
                  </div>
                  <button
                    className="upgrade-btn sms-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(buildPlanPageUrl("/modules/billing/sms-plans"));
                    }}
                  >
                    {smsPlanTier ? "Manage / Upgrade Plan" : "See Plans / Upgrade"}
                  </button>
                </>
              ) : m.id === "calendar" ? (
                <>
                  <div style={{ position: "absolute", top: 8, right: 8 }}>
                    {calendarPlanTier && (
                      <span style={{ fontSize: "16px", color: "#fff", background: "rgba(0,0,0,0.5)", borderRadius: "6px", padding: "3px 10px", fontWeight: 600 }}>
                        {PRICING[calendarPlanTier]?.name?.replace("Calendar — ", "") || calendarPlanTier} · {formatTierLabel(calendarPlanTier)}
                      </span>
                    )}
                  </div>
                  <button
                    className="upgrade-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(buildPlanPageUrl("/modules/billing/calendar-plans"));
                    }}
                  >
                    {calendarPlanTier ? "Manage / Upgrade Plan" : "See Plans / Upgrade"}
                  </button>
                </>
              ) : m.id === "social" ? (
                <>
                  <div style={{ position: "absolute", top: 8, right: 8 }}>
                    {socialPlanTier && (
                      <span style={{ fontSize: "16px", color: "#fff", background: "rgba(0,0,0,0.5)", borderRadius: "6px", padding: "3px 10px", fontWeight: 600 }}>
                        {PRICING[socialPlanTier]?.name?.replace("Social Media — ", "") || socialPlanTier} · {formatTierLabel(socialPlanTier)}
                      </span>
                    )}
                  </div>
                  <button
                    className="upgrade-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(buildPlanPageUrl("/modules/billing/social-plans"));
                    }}
                  >
                    {socialPlanTier ? "Manage / Upgrade Plan" : "See Plans / Upgrade"}
                  </button>
                </>
              ) : (
                <p>A${m.price} / month</p>
              )}
            </div>
          </div>
        ))}
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
        <p>Email Plan: <span>{emailPlanTier ? `${PRICING[emailPlanTier]?.name || emailPlanTier} (${formatTierLabel(emailPlanTier)})` : "-"}</span></p>
        <p>SMS Plan: <span>{smsPlanTier ? `${PRICING[smsPlanTier]?.name || smsPlanTier} (${formatTierLabel(smsPlanTier)})` : "-"}</span></p>
        <p>Calendar Plan: <span>{calendarPlanTier ? `${PRICING[calendarPlanTier]?.name || calendarPlanTier} (${formatTierLabel(calendarPlanTier)})` : "-"}</span></p>
        <p>Social Media Plan: <span>{socialPlanTier ? `${PRICING[socialPlanTier]?.name || socialPlanTier} (${formatTierLabel(socialPlanTier)})` : "-"}</span></p>
        <p>Subtotal: <span>A${subtotal.toFixed(2)}</span></p>
        <p>Discount: <span>{discountPercent}%</span></p>
        <p className="grand-total">
          Total Due: <strong>A${total.toFixed(2)}</strong>
        </p>
        <p className="terms">
          By proceeding, you confirm you are subscribing to a recurring monthly plan.  
          Charges will be billed automatically each month unless cancelled before renewal.
        </p>
        <button onClick={handleProceed} className="pay-btn">
          Proceed to Payment
        </button>
      </div>

      <style jsx>{`
        .wrap { min-height: 100vh; background: #0c121a; color: #fff; padding: 28px; display: flex; flex-direction: column; align-items: center; }
        .banner { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #f59e0b; padding: 24px; border-radius: 12px; margin-bottom: 26px; width: 100%; max-width: 1320px; }
        .banner-icon { background: rgba(255,255,255,0.15); border-radius: 50%; padding: 8px; display: flex; align-items: center; flex-shrink: 0; }
        .banner > div { flex: 1; }
        .banner-title { font-size: 48px; font-weight: 600; margin: 0; line-height: 1.2; }
        .banner-subtitle { font-size: 18px; margin: 8px 0 0 0; }
        .back-btn { background: #0c121a; border: 2px solid #fff; color: #fff; font-size: 16px; font-weight: 600; cursor: pointer; padding: 8px 16px; flex-shrink: 0; border-radius: 20px; display: flex; align-items: center; gap: 6px; }
        .back-btn:hover { background: #fff; color: #0c121a; }
        .actions { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; max-width: 1320px; width: 100%; }
        .btn { padding: 10px 14px; border: none; border-radius: 8px; font-size: 18px; font-weight: 600; cursor: pointer; }
        .select-all { background: #22c55e; color: #000; }
        .clear { background: #ef4444; color: #fff; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; width: 100%; max-width: 1320px; margin-bottom: 30px; }
        .card { position: relative; display: flex; align-items: flex-start; gap: 12px; padding: 16px; border: 2px solid; border-radius: 12px; transition: all 0.25s ease; background: #0c121a; cursor: pointer; }
        .card:not(.active-module):hover { background: var(--hover-color); color: #000; }
        .card.selected { background: var(--fill-color); color: #000; }
        .card.active-module { background: var(--fill-color); color: #000; border-width: 3px; }
        .card-info { flex: 1; }
        .card-info h3 { margin: 0; font-size: 26px; font-weight: 600;}
        .plan-display { font-size: 16px; margin-top: 6px; }
        .upgrade-btn { margin-top: 8px; background: #facc15; color: #000; border: none; padding: 6px 10px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 16px; }
        .sms-btn { background: #38bdf8; color: #fff; }
        .discount-box { width: 100%; max-width: 600px; margin-top: 20px; }
        .discount-row { display: flex; gap: 10px; }
        input { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #444; background: #1a2232; color: #fff; }
        .apply-btn { background: #22c55e; color: #000; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .discount-applied { margin-top: 8px; color: #a3e635; }
        .total-box { margin-top: 30px; width: 100%; max-width: 600px; background: #111827; border: 1px solid #333; border-radius: 12px; padding: 20px; }
        .total-box p { display: flex; justify-content: space-between; margin: 8px 0; }
        .grand-total { font-size: 18px; font-weight: 600; margin-top: 12px; }
        .terms { margin-top: 16px; font-size: 16px; line-height: 1.8; opacity: 0.9; text-align: center; }
        .pay-btn { width: 100%; background: #3b82f6; color: #fff; margin-top: 20px; padding: 14px; border-radius: 10px; font-weight: 600; font-size: 16px; }
        .pay-btn:hover { background: #2563eb; }
      `}</style>
    </div>
  );
}