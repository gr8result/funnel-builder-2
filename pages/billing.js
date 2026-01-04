// /pages/billing.js
// ✅ FINAL version — integrates Email Plan display + upgrade link
// Keeps existing discount logic, design, icons, and layout intact

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabase-client";
import ICONS from "../components/iconMap";

const MODULES = [
  { id: "website-builder", name: "Website Builder", price: 29, color: "#3b82f6", icon: ICONS.websiteBuilder },
  { id: "funnels", name: "Funnels", price: 29, color: "#d946ef", icon: ICONS.funnels },
  { id: "automation", name: "Business Automation", price: 29, color: "#fb923c", icon: ICONS.automation },
  { id: "email", name: "Email Marketing", price: 29, color: "#facc15", icon: ICONS.email },
  { id: "courses", name: "Online Courses", price: 19, color: "#ec4899", icon: ICONS.courses },
  { id: "products", name: "Physical Products", price: 29, color: "#0ea5e9", icon: ICONS.products },
  { id: "webinars", name: "Webinars", price: 29, color: "#ef4444", icon: ICONS.webinars },
  { id: "calendar", name: "Calendar", price: 19, color: "#84cc16", icon: ICONS.calendar },
  { id: "subscription", name: "Subscription Pipeline", price: 19, color: "#7c3aed", icon: ICONS.subscription },
  { id: "communities", name: "Communities", price: 19, color: "#eab308", icon: ICONS.communities },
  { id: "social", name: "Social Media", price: 29, color: "#06b6d4", icon: ICONS.social },
  { id: "subaccounts", name: "Subaccounts", price: 19, color: "#10b981", icon: ICONS.subaccounts },
  { id: "digital-products", name: "Digital Products", price: 19, color: "#475569", icon: ICONS.digitalProducts },
];

export default function Billing() {
  const [selected, setSelected] = useState([]);
  const [discountCode, setDiscountCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountMessage, setDiscountMessage] = useState("");
  const [user, setUser] = useState(null);
  const [emailPlan, setEmailPlan] = useState("Loading...");
  const router = useRouter();

  // ✅ Load user + email plan from Supabase
  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
        const { data: acc } = await supabase
          .from("accounts")
          .select("email_plan_tier")
          .eq("user_id", data.user.id)
          .maybeSingle();
        if (acc?.email_plan_tier) {
          const planName = acc.email_plan_tier
            .replace("email-", "")
            .replace("-", " ")
            .replace(/\b\w/g, (l) => l.toUpperCase());
          setEmailPlan(planName);
        } else {
          setEmailPlan("Starter");
        }
      } else router.push("/login");
    };
    fetchData();
  }, [router]);

  const toggleSelect = (id) => {
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

  const subtotal = MODULES.filter((m) => selected.includes(m.id)).reduce((sum, m) => sum + m.price, 0);
  const total = subtotal * (1 - discountPercent / 100);

  const handleProceed = async () => {
    if (!user) return alert("Please log in first.");
    if (selected.length === 0) return alert("Please select at least one module.");
    if (discountPercent === 100) {
      router.push("/checkout/success?provider=manual");
      return;
    }
    const query = selected.join(",");
    router.push(`/checkout?selected=${query}`);
  };

  return (
    <div className="wrap">
      <div className="banner">
        <span className="banner-icon">{ICONS.billing({ size: 24 })}</span>
        <div>
          <h1 className="banner-title">Billing & Modules</h1>
          <p>Select your modules and manage your subscription plan.</p>
        </div>
      </div>

      <div className="actions">
        <button onClick={selectAll} className="btn select-all">Select All</button>
        <button onClick={clearAll} className="btn clear">Clear</button>
      </div>

      <h2>Select Modules</h2>
      <div className="grid">
        {MODULES.map((m) => (
          <div
            key={m.id}
            className={`card ${selected.includes(m.id) ? "selected" : ""}`}
            style={{
              borderColor: m.color,
              "--hover-color": m.color,
              "--fill-color": m.color,
            }}
            onClick={() => toggleSelect(m.id)}
          >
            <span className="icon">{m.icon({ size: 22 })}</span>
            <div className="card-info">
              <h3>{m.name}</h3>
              {m.id === "email" ? (
                <>
                  <p className="plan-display">
                    Current Plan: <b>{emailPlan}</b>
                  </p>
                  <button
                    className="upgrade-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push("/modules/billing/email-plans");
                    }}
                  >
                    See Plans / Upgrade
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
        .banner { display: flex; align-items: center; gap: 12px; background: #f59e0b; padding: 14px 18px; border-radius: 12px; margin-bottom: 26px; width: 100%; max-width: 1320px; }
        .banner-icon { background: rgba(255,255,255,0.15); border-radius: 50%; padding: 6px; }
        .actions { display: flex; gap: 10px; margin-bottom: 20px; max-width: 1320px; width: 100%; justify-content: flex-end; }
        .btn { padding: 10px 14px; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; }
        .select-all { background: #22c55e; color: #000; }
        .clear { background: #ef4444; color: #fff; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; width: 100%; max-width: 1320px; margin-bottom: 30px; }
        .card { display: flex; align-items: flex-start; gap: 12px; padding: 16px; border: 2px solid; border-radius: 12px; transition: all 0.25s ease; background: #0c121a; cursor: pointer; }
        .card:hover { background: var(--hover-color); color: #000; }
        .card.selected { background: var(--fill-color); color: #000; }
        .card-info { flex: 1; }
        .plan-display { font-size: 14px; margin-top: 6px; }
        .upgrade-btn { margin-top: 8px; background: #facc15; color: #000; border: none; padding: 6px 10px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px; }
        .discount-box { width: 100%; max-width: 600px; margin-top: 20px; }
        .discount-row { display: flex; gap: 10px; }
        input { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #444; background: #1a2232; color: #fff; }
        .apply-btn { background: #22c55e; color: #000; padding: 10px 18px; border-radius: 8px; font-weight: 800; cursor: pointer; }
        .discount-applied { margin-top: 8px; color: #a3e635; }
        .total-box { margin-top: 30px; width: 100%; max-width: 600px; background: #111827; border: 1px solid #333; border-radius: 12px; padding: 20px; }
        .total-box p { display: flex; justify-content: space-between; margin: 8px 0; }
        .grand-total { font-size: 18px; font-weight: 800; margin-top: 12px; }
        .terms { margin-top: 16px; font-size: 15px; line-height: 1.8; opacity: 0.9; text-align: center; }
        .pay-btn { width: 100%; background: #3b82f6; color: #fff; margin-top: 20px; padding: 14px; border-radius: 10px; font-weight: 800; font-size: 16px; }
        .pay-btn:hover { background: #2563eb; }
      `}</style>
    </div>
  );
}
