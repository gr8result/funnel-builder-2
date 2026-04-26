// /pages/modules/billing/email-plans.js

import Link from "next/link";
import { supabase } from "../../../utils/supabase-client";
import ICONS from "../../../components/iconMap";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function EmailPlans() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      setUser(session?.session?.user || null);
    })();
  }, []);

  const asParam = (value) => (typeof value === "string" ? value : "");

  const buildBillingUrl = (next) => {
    const params = new URLSearchParams();
    const emailPlan = next?.emailPlan || asParam(router.query.emailPlan);
    const smsPlan = next?.smsPlan || asParam(router.query.smsPlan);
    const calendarPlan = next?.calendarPlan || asParam(router.query.calendarPlan);

    if (emailPlan) params.set("emailPlan", emailPlan);
    if (smsPlan) params.set("smsPlan", smsPlan);
    if (calendarPlan) params.set("calendarPlan", calendarPlan);

    const query = params.toString();
    return query ? `/billing?${query}` : "/billing";
  };

  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: 19,
      subs: "500",
      emails: "1,000",
    },
    {
      id: "growth",
      name: "Growth",
      price: 99,
      subs: "5,000",
      emails: "10,000",
    },
    {
      id: "pro",
      name: "Pro",
      price: 259,
      subs: "15,000",
      emails: "30,000",
      recommended: true,
    },
    {
      id: "advanced",
      name: "Advanced",
      price: 429,
      subs: "50,000",
      emails: "100,000",
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: 799,
      subs: "100,000+",
      emails: "Custom",
    },
  ];

  const features = [
    "Total subscribers",
    "Monthly emails",
    "Contacts import/export",
    "Scheduled sends",
    "Automation level",
    "Segmentation level",
    "A/B testing",
    "Templates",
    "Custom HTML editor",
    "Tracking (opens & clicks)",
    "AI email writer",
    "API / integrations",
    "Team access",
    "Priority support",
  ];

  function renderValue(feature, plan) {
    const tier = plan.id;

    const map = {
      starter: {
        "Total subscribers": "500",
        "Monthly emails": "1,000",
        "Contacts import/export": "✔️",
        "Scheduled sends": "✔️",
        "Automation level": "1-step (autoresponder)",
        "Segmentation level": "Lists only",
        "A/B testing": "—",
        "Templates": "Basic",
        "Custom HTML editor": "✔️",
        "Tracking (opens & clicks)": "✔️",
        "AI email writer": "—",
        "API / integrations": "—",
        "Team access": "1 user",
        "Priority support": "—",
      },

      growth: {
        "Total subscribers": "5,000",
        "Monthly emails": "10,000",
        "Contacts import/export": "✔️",
        "Scheduled sends": "✔️",
        "Automation level": "Multi-step (max 5)",
        "Segmentation level": "Tags",
        "A/B testing": "✔️",
        "Templates": "Standard",
        "Custom HTML editor": "✔️",
        "Tracking (opens & clicks)": "✔️",
        "AI email writer": "—",
        "API / integrations": "✔️",
        "Team access": "1 user",
        "Priority support": "—",
      },

      pro: {
        "Total subscribers": "15,000",
        "Monthly emails": "30,000",
        "Contacts import/export": "✔️",
        "Scheduled sends": "✔️",
        "Automation level": "Advanced (branching)",
        "Segmentation level": "Advanced filters",
        "A/B testing": "✔️",
        "Templates": "Full library",
        "Custom HTML editor": "✔️",
        "Tracking (opens & clicks)": "✔️",
        "AI email writer": "✔️",
        "API / integrations": "✔️",
        "Team access": "3 users",
        "Priority support": "✔️",
      },

      advanced: {
        "Total subscribers": "50,000",
        "Monthly emails": "100,000",
        "Contacts import/export": "✔️",
        "Scheduled sends": "✔️",
        "Automation level": "Unlimited",
        "Segmentation level": "Advanced filters",
        "A/B testing": "✔️",
        "Templates": "Full library",
        "Custom HTML editor": "✔️",
        "Tracking (opens & clicks)": "✔️",
        "AI email writer": "✔️",
        "API / integrations": "✔️",
        "Team access": "5 users",
        "Priority support": "✔️",
      },

      enterprise: {
        "Total subscribers": "100k+",
        "Monthly emails": "Custom",
        "Contacts import/export": "✔️",
        "Scheduled sends": "✔️",
        "Automation level": "Unlimited",
        "Segmentation level": "Advanced filters",
        "A/B testing": "✔️",
        "Templates": "Full library",
        "Custom HTML editor": "✔️",
        "Tracking (opens & clicks)": "✔️",
        "AI email writer": "✔️",
        "API / integrations": "✔️",
        "Team access": "Unlimited",
        "Priority support": "Dedicated",
      },
    };

    return map[tier][feature] || "—";
  }

  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        
        {/* 🔥 KEEPING YOUR BANNER EXACTLY SAME */}
        <div style={page.banner}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {ICONS.email({ size: 48 })}
            <div>
              <h1 style={page.bannerTitle}>Email Marketing Plans</h1>
              <p style={page.bannerDesc}>Choose your plan — upgrade anytime.</p>
            </div>
          </div>
          <Link href="/billing">
            <button style={page.backBtn}>← Back</button>
          </Link>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={page.table}>
            <thead>
              <tr>
                <th style={page.th}>Features</th>
                {plans.map((p) => (
                  <th key={p.id} style={page.th}>
                    <div style={{ fontSize: 22 }}>{p.name}</div>
                    <div style={{ fontSize: 18 }}>${p.price}/mo</div>
                    {p.recommended && (
                      <div style={page.recommendedBadge}>Best Value</div>
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
                    <td key={p.id} style={page.td}>
                      {renderValue(f, p)}
                    </td>
                  ))}
                </tr>
              ))}

              <tr>
                <td></td>
                {plans.map((p) => (
                  <td key={p.id} style={page.td}>
                    <button
                      onClick={() => {
                        const tierKey = `email-${p.id}`;
                        router.push(buildBillingUrl({ emailPlan: tierKey }));
                      }}
                      style={page.btn}
                    >
                      Select Plan
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div style={page.total}>
          Monthly Total:{" "}
          {selectedPlan
            ? `$${plans.find((p) => p.id === selectedPlan)?.price}/mo`
            : "$0/mo"}
        </div>
      </div>
    </div>
  );
}

const page = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
    padding: "28px 22px",
  },
  inner: { maxWidth: 1320, margin: "0 auto" },

  // 🔒 BANNER UNTOUCHED
  banner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#facc15",
    color: "#fff",
    padding: "14px 20px",
    borderRadius: 12,
    marginBottom: 28,
  },

  bannerTitle: { margin: 0, fontSize: 48, fontWeight: 600 },
  bannerDesc: { margin: 0, fontSize: 18, opacity: 0.9 },

  backBtn: {
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 18,
    cursor: "pointer",
  },

  table: { width: "100%", borderCollapse: "collapse" },

  th: {
    padding: 14,
    background: "#1f2937",
  },

  tdFeature: {
    padding: 10,
    background: "#111827",
  },

  td: {
    padding: 10,
    textAlign: "center",
  },

  btn: {
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#fff",
    borderRadius: 8,
    padding: "8px 16px",
    cursor: "pointer",
  },

  total: {
    marginTop: 30,
    textAlign: "right",
    color: "#38bdf8",
    fontWeight: 700,
  },

  recommendedBadge: {
    marginTop: 6,
    background: "#3b82f6",
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 12,
  },
};