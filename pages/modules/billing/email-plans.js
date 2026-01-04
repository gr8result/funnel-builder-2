// /pages/modules/billing/email-plans.js
// Cleaned feature list – only what exists today
// Same layout, fixed redirects, safe feature promises

import Link from "next/link";
import { supabase } from "../../../utils/supabase-client";
import ICONS from "../../../components/iconMap";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function EmailPlans() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      setUser(session?.session?.user || null);
    })();
  }, []);

  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: 29,
      lists: 3,
      subs: "500",
      emails: "1,000",
      sms: "—",
      color: "#94a3b8",
    },
    {
      id: "growth",
      name: "Growth",
      price: 75,
      lists: 5,
      subs: "2,000",
      emails: "10,000",
      sms: "500",
      color: "#facc15",
    },
    {
      id: "expansion",
      name: "Expansion",
      price: 250,
      lists: "Unlimited",
      subs: "15,000",
      emails: "30,000",
      sms: "2,500",
      color: "#3b82f6",
      recommended: true,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: 350,
      lists: "Unlimited",
      subs: "25,000",
      emails: "100,000",
      sms: "5,000",
      color: "#10b981",
    },
    {
      id: "agency",
      name: "Agency",
      price: "Custom",
      lists: "Unlimited",
      subs: "Unlimited",
      emails: "Unlimited",
      sms: "Custom",
      color: "#a855f7",
    },
  ];

  // Only features we can genuinely do today
  const features = [
    "Lists allowed",
    "Total subscribers",
    "Monthly emails",
    "SMS credits",
    "Contacts import/export",
    "Scheduled sends",
    "campaigns sequences",
    "Automation workflows",
    "Conditional logic",
    "Standard templates",
    "Template library",
    "Custom HTML editor",
    "Click tracking",
    "Open tracking",
    "Basic list / tag segments",
    "CRM integration",
    "Priority support",
  ];

  async function handleSelect(p) {
    try {
      if (!user) {
        alert("Please log in to select a plan.");
        return;
      }

      const { error } = await supabase
        .from("accounts")
        .update({
          email_plan: p.name,
          email_plan_price: p.price === "Custom" ? null : p.price,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      alert(`✅ ${p.name} plan selected successfully! Redirecting to Billing...`);
      setTimeout(() => router.push("/modules/billing"), 1200);
    } catch (err) {
      alert("Error saving plan: " + err.message);
    }
  }

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        {/* Banner */}
        <div style={page.banner}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {ICONS.email({ size: 28 })}
            <div>
              <h1 style={page.bannerTitle}>Email & SMS Marketing Plans</h1>
              <p style={page.bannerDesc}>Choose your plan — upgrade anytime.</p>
            </div>
          </div>
          <Link href="/billing">
            <button style={page.backBtn}>← Back</button>
          </Link>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={page.table}>
            <thead>
              <tr>
                <th style={page.th}>Features</th>
                {plans.map((p) => (
                  <th
                    key={p.id}
                    style={{
                      ...page.th,
                      background: p.recommended ? "#1e3a8a" : "#1f2937",
                      color: p.recommended ? "#60a5fa" : "#e5e7eb",
                      boxShadow: p.recommended
                        ? "0 0 20px 2px rgba(59,130,246,0.7)"
                        : "none",
                      position: "relative",
                      verticalAlign: "top",
                    }}
                  >
                    <div style={{ fontSize: 20, fontWeight: 800 }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 14, opacity: 0.9 }}>
                      {p.price === "Custom" ? "Contact us" : `$${p.price}/mo`}
                    </div>
                    {p.recommended && (
                      <div style={page.recommendedBadge}>💙 Best Value</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {features.map((f, i) => (
                <tr key={i}>
                  <td style={page.tdFeature}>{f}</td>
                  {plans.map((p) => (
                    <td
                      key={p.id}
                      style={{
                        ...page.td,
                        background: p.recommended
                          ? "rgba(30,58,138,0.2)"
                          : "rgba(255,255,255,0.02)",
                      }}
                    >
                      {renderValue(f, p)}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Buttons row */}
              <tr>
                <td style={page.tdFeature}> </td>
                {plans.map((p) => (
                  <td key={p.id} style={page.td}>
                    <button
                      onClick={() => handleSelect(p)}
                      style={{
                        background: p.recommended ? "#3b82f6" : "#1e293b",
                        border: "1px solid #334155",
                        color: "#fff",
                        borderRadius: 8,
                        padding: "8px 16px",
                        cursor: "pointer",
                        fontWeight: 700,
                        marginTop: 8,
                      }}
                    >
                      Select Plan
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function renderValue(feature, plan) {
  const always = [
    "Lists allowed",
    "Total subscribers",
    "Monthly emails",
    "SMS credits",
  ];
  if (always.includes(feature)) {
    if (feature === "Lists allowed") return plan.lists;
    if (feature === "Total subscribers") return plan.subs;
    if (feature === "Monthly emails") return plan.emails;
    if (feature === "SMS credits") return plan.sms;
  }

  // TRUE current capabilities per tier
  const tiers = {
    // Good starter: basics + scheduling + editor + tracking
    starter: [
      "Contacts import/export",
      "Scheduled sends",
      "Standard templates",
      "Custom HTML editor",
      "Click tracking",
      "Open tracking",
    ],

    // Adds sequences & simple workflows + segments & CRM
    growth: [
      "Contacts import/export",
      "Scheduled sends",
      "campaigns sequences",
      "Automation workflows",
      "Conditional logic",
      "Standard templates",
      "Template library",
      "Custom HTML editor",
      "Click tracking",
      "Open tracking",
      "Basic list / tag segments",
      "CRM integration",
    ],

    // Same engine, bigger limits; more serious users
    expansion: [
      "Contacts import/export",
      "Scheduled sends",
      "campaigns sequences",
      "Automation workflows",
      "Conditional logic",
      "Standard templates",
      "Template library",
      "Custom HTML editor",
      "Click tracking",
      "Open tracking",
      "Basic list / tag segments",
      "CRM integration",
      "Priority support",
    ],

    // Enterprise: same features + priority support
    enterprise: [
      "Contacts import/export",
      "Scheduled sends",
      "campaigns sequences",
      "Automation workflows",
      "Conditional logic",
      "Standard templates",
      "Template library",
      "Custom HTML editor",
      "Click tracking",
      "Open tracking",
      "Basic list / tag segments",
      "CRM integration",
      "Priority support",
    ],

    // Agency: same feature set, agency limits/pricing
    agency: [
      "Contacts import/export",
      "Scheduled sends",
      "campaigns sequences",
      "Automation workflows",
      "Conditional logic",
      "Standard templates",
      "Template library",
      "Custom HTML editor",
      "Click tracking",
      "Open tracking",
      "Basic list / tag segments",
      "CRM integration",
      "Priority support",
    ],
  };

  return tiers[plan.id].includes(feature) ? "✔️" : "—";
}

const page = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
    padding: "28px 22px",
  },
  inner: { width: "100%", maxWidth: 1320, margin: "0 auto" },
  banner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#facc15",
    color: "#000",
    padding: "14px 20px",
    borderRadius: 12,
    marginBottom: 28,
  },
  bannerTitle: { margin: 0, fontSize: 22, fontWeight: 900 },
  bannerDesc: { margin: 0, fontSize: 15, opacity: 0.9 },
  backBtn: {
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 13,
    cursor: "pointer",
  },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 900 },
  th: {
    textAlign: "center",
    padding: "14px",
    background: "#1f2937",
    borderBottom: "2px solid #334155",
  },
  tdFeature: {
    textAlign: "left",
    padding: "10px 14px",
    borderBottom: "1px solid #1e293b",
    background: "#111827",
    fontWeight: 600,
  },
  td: {
    textAlign: "center",
    padding: "10px 14px",
    borderBottom: "1px solid #1e293b",
  },
  recommendedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    background: "#3b82f6",
    color: "#fff",
    padding: "3px 8px",
    fontSize: 10,
    borderRadius: 6,
    fontWeight: 800,
    letterSpacing: 0.5,
  },
};
