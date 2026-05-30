// /pages/modules/billing/funnel-plans.js
// Funnels & Landing Pages — add-on packs for extra funnels beyond base plan allowance

import Link from "next/link";
import { supabase } from "../../../utils/supabase-client";
import ICONS from "../../../components/iconMap";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { BASE_PLAN_INCLUDES } from "../../../data/pricing";

export default function FunnelPlans() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      setUser(session?.session?.user || null);
    })();
  }, []);

  const asParam = (value) => (typeof value === "string" ? value : "");

  const buildBillingUrl = (next) => {
    const params = new URLSearchParams();
    const emailPlan    = next?.emailPlan    || asParam(router.query.emailPlan);
    const smsPlan      = next?.smsPlan      || asParam(router.query.smsPlan);
    const calendarPlan = next?.calendarPlan || asParam(router.query.calendarPlan);
    const socialPlan   = next?.socialPlan   || asParam(router.query.socialPlan);
    const crmPlan      = next?.crmPlan      || asParam(router.query.crmPlan);
    const funnelPlan   = next?.funnelPlan   || asParam(router.query.funnelPlan);
    const basePlan     = asParam(router.query.basePlan);

    if (basePlan)     params.set("basePlan",     basePlan);
    if (emailPlan)    params.set("emailPlan",    emailPlan);
    if (smsPlan)      params.set("smsPlan",      smsPlan);
    if (calendarPlan) params.set("calendarPlan", calendarPlan);
    if (socialPlan)   params.set("socialPlan",   socialPlan);
    if (crmPlan)      params.set("crmPlan",      crmPlan);
    if (funnelPlan)   params.set("funnelPlan",   funnelPlan);

    const query = params.toString();
    return query ? `/billing?${query}` : "/billing";
  };

  const handleSelectPack = (pack) => {
    if (!user) { alert("Please log in to select a plan."); return; }
    router.push(buildBillingUrl({ funnelPlan: pack.id }));
  };

  // ── Base plan context ────────────────────────────────────────────────
  const basePlanId   = typeof router.query.basePlan  === "string" ? router.query.basePlan  : null;
  const activePack   = typeof router.query.funnelPlan === "string" ? router.query.funnelPlan : null;

  const basePlanLabel = {
    starter:      "Starter",
    growth:       "Growth",
    scale:        "Scale",
    professional: "Professional",
  }[basePlanId] || null;

  const includedFunnels = basePlanId ? (BASE_PLAN_INCLUDES[basePlanId]?.funnels?.included ?? 0) : null;
  // ────────────────────────────────────────────────────────────────────

  const packs = [
    {
      id: "funnel-pack-s",
      name: "Starter",
      price: 19,
      extra: 2,
      color: "#6366f1",
      tagline: "A small boost for growing businesses",
      features: [
        "+2 extra multi-step funnels",
        "A/B split testing per funnel",
        "Custom domain per funnel",
        "Analytics & conversion tracking",
        "Unlimited landing pages (always included)",
      ],
    },
    {
      id: "funnel-pack-m",
      name: "Growth",
      price: 39,
      extra: 5,
      color: "#22c55e",
      recommended: true,
      tagline: "Great for active marketers running multiple campaigns",
      features: [
        "+5 extra multi-step funnels",
        "A/B split testing per funnel",
        "Custom domain per funnel",
        "Analytics & conversion tracking",
        "Unlimited landing pages (always included)",
        "Priority template access",
      ],
    },
    {
      id: "funnel-pack-l",
      name: "Scale",
      price: 79,
      extra: 10,
      color: "#f59e0b",
      tagline: "Power users and marketing teams",
      features: [
        "+10 extra multi-step funnels",
        "A/B split testing per funnel",
        "Custom domain per funnel",
        "Analytics & conversion tracking",
        "Unlimited landing pages (always included)",
        "Priority template access",
        "Team collaboration",
      ],
    },
    {
      id: "funnel-unlimited",
      name: "Professional",
      price: 99,
      extra: "unlimited",
      color: "#7c3aed",
      tagline: "Agencies and high-volume teams with no ceiling",
      features: [
        "Unlimited multi-step funnels",
        "A/B split testing per funnel",
        "Custom domain per funnel",
        "Analytics & conversion tracking",
        "Unlimited landing pages (always included)",
        "Priority template access",
        "Team collaboration",
      ],
    },
  ];

  return (
    <div className="wrap">
      {/* Banner */}
      <div className="banner">
        <div className="banner-left">
          <span className="banner-icon">{ICONS.funnels({ size: 48 })}</span>
          <div>
            <h1 className="banner-title">Funnels &amp; Landing Pages</h1>
            <p className="banner-subtitle">Your plan includes landing pages. Add extra multi-step funnels when you need them.</p>
          </div>
        </div>
        <Link href={buildBillingUrl({})} className="back-btn">← Back to Billing</Link>
      </div>

      {/* What's included */}
      <div className="included-box">
        <div className="included-inner">
          <div className="included-section">
            <span className="included-icon">🏗️</span>
            <div>
              <p className="included-label">Landing Pages</p>
              <p className="included-value">Unlimited — on all plans</p>
            </div>
          </div>
          <div className="included-divider" />
          <div className="included-section">
            <span className="included-icon">🔀</span>
            <div>
              <p className="included-label">Multi-step Funnels</p>
              <p className="included-value">
                {includedFunnels !== null
                  ? includedFunnels === 0
                    ? `0 included in ${basePlanLabel} plan — add a pack below`
                    : `${includedFunnels} included in your ${basePlanLabel} plan`
                  : "Included count depends on your platform plan"}
              </p>
            </div>
          </div>
          <div className="included-divider" />
          <div className="included-section">
            <span className="included-icon">➕</span>
            <div>
              <p className="included-label">Extra Funnels</p>
              <p className="included-value">Add a pack below — billed monthly, cancel anytime</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pack heading */}
      <div className="section-header">
        <h2 className="section-title">Add-on Funnel Packs</h2>
        <p className="section-sub">These packs stack on top of your plan&apos;s included funnels. Pick the pack that fits your workflow.</p>
      </div>

      {/* Pack cards */}
      <div className="packs-grid">
        {packs.map((pack) => {
          const isActive = pack.id === activePack;
          return (
            <div
              key={pack.id}
              className={`pack-card${pack.recommended ? " recommended" : ""}${isActive ? " active" : ""}`}
              style={{ "--pack-color": pack.color, borderColor: pack.color + "55" }}
            >
              {pack.recommended && <span className="badge" style={{ background: pack.color }}>Most Popular</span>}
              {isActive          && <span className="badge active-badge">✓ Selected</span>}

              <h2 className="pack-name" style={{ color: pack.color }}>{pack.name}</h2>

              <div className="price-row">
                <span className="price-amt" style={{ color: pack.color }}>${pack.price}</span>
                <span className="price-period">/mo</span>
              </div>

              <div className="extra-tag" style={{ background: pack.color + "22", color: pack.color, border: `1px solid ${pack.color}44` }}>
                {typeof pack.extra === "number" ? `+${pack.extra} funnels` : "Unlimited funnels"}
              </div>

              <p className="pack-tagline">{pack.tagline}</p>

              <div className="divider" style={{ background: pack.color }} />

              <ul className="features">
                {pack.features.map((f) => (
                  <li key={f} className="feature-row">
                    <span className="f-check" style={{ color: pack.color }}>✓</span>
                    <span className="f-text">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                className="select-btn"
                style={{
                  background: isActive ? "transparent" : pack.color,
                  color: isActive ? pack.color : "#000",
                  border: isActive ? `2px solid ${pack.color}` : "none",
                }}
                disabled={isActive}
                onClick={() => !isActive && handleSelectPack(pack)}
              >
                {isActive ? "Selected" : `Add ${pack.name} — $${pack.price}/mo`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="footnote">
        Packs add funnels on top of your included allowance. Landing pages are always unlimited at no extra cost.
        Cancel your pack at any time before the next billing cycle.
      </p>

      <style jsx>{`
        .wrap { min-height: 100vh; background: #0c121a; color: #fff; padding: 28px; display: flex; flex-direction: column; align-items: center; }

        /* Banner */
        .banner { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #ef465d; padding: 24px; border-radius: 12px; margin-bottom: 28px; width: 100%; max-width: 1320px; }
        .banner-left { display: flex; align-items: center; gap: 16px; flex: 1; }
        .banner-icon { background: rgba(255,255,255,0.2); border-radius: 50%; padding: 10px; display: flex; align-items: center; flex-shrink: 0; }
        .banner-title { font-size: 48px; font-weight: 600; margin: 0; }
        .banner-subtitle { font-size: 18px; margin: 4px 0 0; opacity: 0.9; }
        .back-btn { background: #0c121a; border: 2px solid #fff; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; padding: 8px 18px; border-radius: 20px; text-decoration: none; white-space: nowrap; transition: all 0.2s; }
        .back-btn:hover { background: #fff; color: #0c121a; }

        /* Included box */
        .included-box { width: 100%; max-width: 1100px; background: #111827; border: 1px solid #1f2937; border-radius: 14px; padding: 20px 24px; margin-bottom: 32px; }
        .included-inner { display: flex; align-items: stretch; gap: 0; }
        .included-section { display: flex; align-items: center; gap: 14px; flex: 1; padding: 0 16px; }
        .included-section:first-child { padding-left: 0; }
        .included-section:last-child { padding-right: 0; }
        .included-icon { font-size: 26px; flex-shrink: 0; }
        .included-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; margin: 0 0 3px; }
        .included-value { font-size: 14px; font-weight: 600; color: #e5e7eb; margin: 0; }
        .included-divider { width: 1px; background: #1f2937; flex-shrink: 0; margin: 0 4px; }

        /* Section header */
        .section-header { width: 100%; max-width: 1100px; margin-bottom: 18px; }
        .section-title { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
        .section-sub { font-size: 14px; color: #9ca3af; margin: 0; }

        /* Packs grid */
        .packs-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; width: 100%; max-width: 1100px; align-items: start; }

        /* Pack card */
        .pack-card { position: relative; border: 2px solid; border-radius: 16px; padding: 28px 20px 22px; display: flex; flex-direction: column; background: #111827; transition: transform 0.2s, box-shadow 0.2s; }
        .pack-card:hover { transform: translateY(-3px); box-shadow: 0 8px 30px rgba(0,0,0,0.4); }
        .pack-card.recommended { box-shadow: 0 0 0 3px var(--pack-color); }
        .pack-card.active { box-shadow: 0 0 0 3px #22c55e; }

        .badge { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; padding: 4px 14px; border-radius: 20px; white-space: nowrap; color: #000; }
        .active-badge { background: #22c55e !important; }

        .pack-name { font-size: 22px; font-weight: 700; margin: 10px 0 6px; }
        .price-row { display: flex; align-items: baseline; gap: 3px; margin-bottom: 10px; }
        .price-amt { font-size: 38px; font-weight: 800; line-height: 1; }
        .price-period { font-size: 15px; color: #9ca3af; }

        .extra-tag { display: inline-block; font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-bottom: 10px; }

        .pack-tagline { font-size: 13px; color: #9ca3af; margin: 0 0 14px; line-height: 1.5; }

        .divider { height: 2px; opacity: 0.3; border-radius: 2px; margin-bottom: 14px; }

        .features { list-style: none; padding: 0; margin: 0 0 20px; display: flex; flex-direction: column; gap: 7px; }
        .feature-row { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; }
        .f-check { font-size: 13px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        .f-text { color: #d1d5db; }

        .select-btn { width: 100%; padding: 11px; border-radius: 10px; font-size: 14px; font-weight: 700; margin-top: auto; transition: opacity 0.2s; cursor: pointer; }
        .select-btn:hover:not(:disabled) { opacity: 0.85; }
        .select-btn:disabled { cursor: default; }

        .footnote { font-size: 13px; color: #6b7280; margin-top: 24px; text-align: center; max-width: 600px; line-height: 1.6; }

        @media (max-width: 900px) {
          .packs-grid { grid-template-columns: repeat(2, 1fr); }
          .included-inner { flex-direction: column; gap: 14px; }
          .included-divider { display: none; }
        }
        @media (max-width: 540px) {
          .packs-grid { grid-template-columns: 1fr; }
          .banner { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
