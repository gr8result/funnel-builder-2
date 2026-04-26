// /pages/modules/billing/calendar-plans.js
// ✅ Calendar Booking Pricing Plans with Full Feature Comparison Table

import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { supabase } from "../../../utils/supabase-client";
import ICONS from "../../../components/iconMap";

export default function CalendarPlans() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState("Loading...");
  const [user, setUser] = useState(null);

  const parseLegacyCalendarStatus = (status) => {
    if (typeof status !== "string" || !status) return null;
    if (status === "active") return "calendar-starter";
    if (status.startsWith("active:")) {
      const tier = status.slice("active:".length);
      return tier && tier.startsWith("calendar-") ? tier : "calendar-starter";
    }
    return null;
  };

  const toFormattedTier = (tier) => tier
    .replace("calendar-", "")
    .replace("-", " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  useEffect(() => {
    const fetchUser = async () => {
      // Try session cookie first (no network round-trip) before falling back to getUser
      const { data: sessionData } = await supabase.auth.getSession();
      const resolvedUser = sessionData?.session?.user;
      if (!resolvedUser) {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          router.push("/login");
          return;
        }
        setUser(userData.user);
        return;
      }

      setUser(resolvedUser);

      const { data: accRows } = await supabase
        .from("accounts")
        .select("calendar_plan_tier")
        .eq("user_id", resolvedUser.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      const { data: profile } = await supabase
        .from("profiles")
        .select("calendar_subscription_status")
        .eq("user_id", resolvedUser.id)
        .maybeSingle();

      const acc = accRows?.[0] || null;
      const fallbackTier = parseLegacyCalendarStatus(profile?.calendar_subscription_status);
      const tier = acc?.calendar_plan_tier || fallbackTier;

      if (tier) {
        setCurrentPlan(toFormattedTier(tier));
      } else {
        setCurrentPlan("Starter");
      }
    };

    fetchUser();
  }, [router]);

  const asParam = (value) => (typeof value === "string" ? value : "");

  const buildBillingUrl = (next) => {
    const params = new URLSearchParams();
    const emailPlan = next?.emailPlan || asParam(router.query.emailPlan);
    const smsPlan = next?.smsPlan || asParam(router.query.smsPlan);
    const calendarPlan = next?.calendarPlan || asParam(router.query.calendarPlan);
    const socialPlan = next?.socialPlan || asParam(router.query.socialPlan);

    if (emailPlan) params.set("emailPlan", emailPlan);
    if (smsPlan) params.set("smsPlan", smsPlan);
    if (calendarPlan) params.set("calendarPlan", calendarPlan);
    if (socialPlan) params.set("socialPlan", socialPlan);

    const query = params.toString();
    return query ? `/billing?${query}` : "/billing";
  };

  const selectPlan = async (tier) => {
    if (!user) return;
    // Send plan selection back to billing page with correct tier key
    router.push(buildBillingUrl({ calendarPlan: tier }));
  };

  return (
    <div className="page">
      <div className="container">

        <div className="banner">
          <div className="banner-left">
            <div className="icon-wrap">
              {ICONS.calendar({ size: 48 })}
            </div>
            <div className="title-wrap">
              <h1 className="banner-title">Calendar Booking Plans</h1>
              <p className="banner-subtitle">
                Choose your plan — upgrade anytime.
              </p>
            </div>
          </div>
          <button
            className="back-btn"
            onClick={() => router.push("/billing")}
          >
            ← Back
          </button>
        </div>

        <div className="current-plan">
          Current Plan: <strong>{currentPlan}</strong>
        </div>

        <div className="pricing-grid">
          <div className="tier" style={{ position: "relative" }}>
            <h2>Starter</h2>
            <p className="price">$29<span>/month</span></p>
            <button onClick={() => selectPlan("calendar-starter")}> 
              Select Starter
            </button>
          </div>

          <div className="tier" style={{ position: "relative" }}>
            <h2>Growth</h2>
            {currentPlan === "Growth" && (
              <div style={{
                position: "absolute",
                top: 0,
                right: 0,
                background: "#38bdf8",
                color: "#fff",
                borderRadius: "0 8px 0 8px",
                padding: "6px 16px",
                fontWeight: 700,
                fontSize: 16,
                zIndex: 2,
              }}>
                Selected: $79/mo
              </div>
            )}
            <p className="price">$79<span>/month</span></p>
            <button onClick={() => selectPlan("calendar-growth")}> 
              Select Growth
            </button>
          </div>

          <div className="tier highlight" style={{ position: "relative" }}>
            <h2>Professional</h2>
            {currentPlan === "Professional" && (
              <div style={{
                position: "absolute",
                top: 0,
                right: 0,
                background: "#38bdf8",
                color: "#fff",
                borderRadius: "0 8px 0 8px",
                padding: "6px 16px",
                fontWeight: 700,
                fontSize: 16,
                zIndex: 2,
              }}>
                Selected: $149/mo
              </div>
            )}
            <p className="price">$149<span>/month</span></p>
            <button onClick={() => selectPlan("calendar-professional")}> 
              Select Professional
            </button>
          </div>

          <div className="tier" style={{ position: "relative" }}>
            <h2>Agency</h2>
            {currentPlan === "Agency" && (
              <div style={{
                position: "absolute",
                top: 0,
                right: 0,
                background: "#38bdf8",
                color: "#fff",
                borderRadius: "0 8px 0 8px",
                padding: "6px 16px",
                fontWeight: 700,
                fontSize: 16,
                zIndex: 2,
              }}>
                Selected: From $349/mo
              </div>
            )}
            <p className="price">From $349/mo</p>
            <button onClick={() => router.push("/contact")}> 
              Contact Sales
            </button>
          </div>
        </div>

        <div className="feature-table">
          <h2>Full Feature Comparison</h2>
          <table>
            <thead>
              <tr>
                <th>Features</th>
                <th>Starter</th>
                <th>Growth</th>
                <th>Professional</th>
                <th>Agency</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Calendars</td><td>1</td><td>5</td><td>Unlimited</td><td>Unlimited</td></tr>
              <tr><td>Unlimited bookings</td><td>✔</td><td>✔</td><td>✔</td><td>✔</td></tr>
              <tr><td>Email confirmations</td><td>✔</td><td>✔</td><td>✔</td><td>✔</td></tr>
              <tr><td>SMS reminders</td><td>—</td><td>✔</td><td>✔</td><td>✔</td></tr>
              <tr><td>Custom booking forms</td><td>—</td><td>✔</td><td>✔</td><td>✔</td></tr>
              <tr><td>Team members</td><td>—</td><td>✔</td><td>✔</td><td>✔</td></tr>
              <tr><td>Round robin scheduling</td><td>—</td><td>—</td><td>✔</td><td>✔</td></tr>
              <tr><td>Advanced availability rules</td><td>—</td><td>—</td><td>✔</td><td>✔</td></tr>
              <tr><td>CRM integration</td><td>—</td><td>—</td><td>✔</td><td>✔</td></tr>
              <tr><td>Custom branding</td><td>—</td><td>✔</td><td>✔</td><td>✔</td></tr>
              <tr><td>White-label booking pages</td><td>—</td><td>—</td><td>—</td><td>✔</td></tr>
              <tr><td>Multi-location support</td><td>—</td><td>—</td><td>✔</td><td>✔</td></tr>
              <tr><td>Priority support</td><td>—</td><td>—</td><td>✔</td><td>✔</td></tr>
              <tr><td>Dedicated account manager</td><td>—</td><td>—</td><td>—</td><td>✔</td></tr>
              <tr><td>API access</td><td>—</td><td>—</td><td>✔</td><td>✔</td></tr>
            </tbody>
          </table>
        </div>

      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #0c121a;
          color: #fff;
          padding: 28px;
          display: flex;
          justify-content: center;
        }

        .container {
          width: 100%;
          max-width: 1320px;
        }

        .banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #84cc16;
          padding: 24px 28px;
          border-radius: 12px;
          margin-bottom: 30px;
        }

        .banner-left {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .title-wrap {
          display: flex;
          flex-direction: column;
          text-align: left;
        }

        .banner-title {
          font-size: 42px;
          margin: 0;
        }

        .banner-subtitle {
          font-size: 18px;
          margin-top: 6px;
        }

        .back-btn {
          background: #0c121a;
          border: 2px solid #fff;
          color: #fff;
          padding: 8px 16px;
          border-radius: 20px;
          cursor: pointer;
          font-weight: 600;
        }

        .current-plan {
          margin-bottom: 30px;
          font-size: 18px;
        }

        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }

        .tier {
          background: #111827;
          border: 1px solid #333;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }

        .highlight {
          border: 2px solid #84cc16;
        }

        .price {
          font-size: 30px;
          font-weight: 700;
        }

        .price span {
          font-size: 14px;
        }

        button {
          margin-top: 15px;
          background: #3b82f6;
          border: none;
          padding: 10px;
          border-radius: 8px;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
        }

        .feature-table {
          background: #111827;
          border-radius: 12px;
          padding: 24px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 12px;
          border-bottom: 1px solid #333;
          text-align: center;
        }

        th:first-child,
        td:first-child {
          text-align: left;
        }

        th {
          background: #1f2937;
        }
      `}</style>
    </div>
  );
}