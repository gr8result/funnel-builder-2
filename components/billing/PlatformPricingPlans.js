import React from "react";
import {
  AI_PACKS,
  EMAIL_PACKS,
  PLATFORM_BASE_PLANS,
  PLATFORM_PRICING_PLANS,
  PROJECT_CREDIT_PACKS,
  SMS_PACKS,
  calcPlatformBundleValue,
} from "../../data/platformPricing";

function PlanCheckIcon({ color }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="8" cy="8" r="8" fill={color} fillOpacity="0.18" />
      <path d="M4.5 8.5l2.5 2.5 4.5-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const styles = {
  toggle: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, margin: "0 0 26px" },
  toggleLabel: (active) => ({ color: active ? "#f8fafc" : "#94a3b8", fontSize: 15, fontWeight: 700 }),
  saveBadge: { marginLeft: 6, padding: "2px 8px", borderRadius: 999, background: "rgba(34,197,94,0.16)", color: "#86efac", fontSize: 12 },
  toggleBtn: (on) => ({ width: 54, height: 30, borderRadius: 999, border: "1px solid rgba(148,163,184,0.32)", background: on ? "#22c55e" : "#334155", padding: 3, cursor: "pointer" }),
  knob: (on) => ({ display: "block", width: 22, height: 22, borderRadius: 999, background: "#fff", transform: on ? "translateX(24px)" : "translateX(0)", transition: "transform .18s ease" }),
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(255px, 1fr))", gap: 18, alignItems: "stretch" },
  card: (plan, selected, current) => ({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    minWidth: 0,
    minHeight: 760,
    height: "100%",
    padding: "26px 22px",
    borderRadius: 22,
    border: `1px solid ${plan.color}`,
    background: selected ? `${plan.color}15` : current ? `${plan.color}10` : "#111827",
    color: "#f8fafc",
    boxShadow: selected ? `0 0 0 3px ${plan.color}` : current ? `0 0 0 2px ${plan.color}88` : "0 18px 42px rgba(2,6,23,0.28)",
    overflow: "hidden",
  }),
  badge: (plan) => ({ alignSelf: "flex-start", padding: "6px 10px", borderRadius: 999, background: plan.color, color: plan.color === "#f59e0b" ? "#000" : "#fff", fontSize: 12, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase" }),
  name: { margin: 0, fontSize: 25, lineHeight: 1.15, fontWeight: 800 },
  price: { display: "flex", alignItems: "baseline", gap: 5, marginTop: 2 },
  amount: (color) => ({ color, fontSize: 42, lineHeight: 1, fontWeight: 900 }),
  period: { color: "#94a3b8", fontSize: 17, fontWeight: 700 },
  note: (color) => ({ color, fontSize: 13, fontWeight: 700, marginTop: -6 }),
  tagline: { margin: 0, color: "#cbd5e1", fontSize: 15, lineHeight: 1.55, minHeight: 46 },
  btn: (plan, active) => ({ width: "100%", minHeight: 44, borderRadius: 12, border: `2px solid ${plan.color}`, background: active ? plan.color : "transparent", color: active ? (plan.color === "#f59e0b" ? "#000" : "#fff") : plan.color, fontSize: 15, fontWeight: 800, cursor: "pointer" }),
  savings: { padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1", fontSize: 13, lineHeight: 1.45 },
  divider: (color) => ({ height: 2, width: "100%", borderRadius: 999, background: color, opacity: 0.75 }),
  list: { display: "grid", gap: 9, padding: 0, margin: 0, listStyle: "none" },
  row: { display: "flex", gap: 8, alignItems: "flex-start", minWidth: 0, color: "#e5e7eb", fontSize: 14, lineHeight: 1.4 },
  rowLabel: { flex: 1, minWidth: 0 },
  rowValue: (color) => ({ color, fontWeight: 800, whiteSpace: "nowrap" }),
  quotaHeader: (color) => ({ marginTop: 4, padding: "8px 10px", borderRadius: 10, border: `1px solid ${color}`, color, fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".08em" }),
  cardFooter: { marginTop: "auto", display: "grid", gap: 12 },
  extras: { marginTop: 22, padding: 18, borderRadius: 18, background: "#0f172a", border: "1px solid rgba(148,163,184,0.18)", color: "#f8fafc" },
  extrasGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 12 },
  pack: { padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,0.24)", background: "rgba(255,255,255,0.04)", color: "#e5e7eb", fontSize: 13, lineHeight: 1.4 },
};

export default function PlatformPricingPlans({
  selectedPlan = null,
  currentPlan = null,
  isAnnual = undefined,
  onAnnualChange,
  onSelectPlan,
  marketingMode = false,
  showAddOns = true,
  ctaLabel = "",
}) {
  const canSelect = typeof onSelectPlan === "function";
  const [internalAnnual, setInternalAnnual] = React.useState(false);
  const annual = typeof isAnnual === "boolean" ? isAnnual : internalAnnual;
  const setAnnual = (nextValue) => {
    if (typeof onAnnualChange === "function") onAnnualChange(nextValue);
    else setInternalAnnual(nextValue);
  };

  return (
    <div>
      <div style={styles.toggle}>
        <span style={styles.toggleLabel(!annual)}>Monthly</span>
        <button type="button" style={styles.toggleBtn(annual)} onClick={() => setAnnual(!annual)} aria-label="Toggle annual billing">
          <span style={styles.knob(annual)} />
        </button>
        <span style={styles.toggleLabel(annual)}>Annual <span style={styles.saveBadge}>Save 5%</span></span>
      </div>
      <div style={styles.grid}>
        {PLATFORM_PRICING_PLANS.map((plan) => {
          const basePlan = PLATFORM_BASE_PLANS.find((entry) => entry.id === plan.id);
          const planPrice = basePlan?.price || Number(String(plan.price).replace(/[^0-9.]/g, "")) || 0;
          const selected = !marketingMode && selectedPlan === plan.id;
          const current = !marketingMode && currentPlan === plan.id;
          const bundleValue = calcPlatformBundleValue(plan.id);
          const savings = bundleValue - planPrice;
          const buttonText = marketingMode
            ? (ctaLabel || (plan.id === "starter" ? "Start Free Trial" : "Select This Plan"))
            : selected
              ? "Selected"
              : "Select This Plan";

          return (
            <article key={plan.id} style={styles.card(plan, selected, current)}>
              {current ? <div style={styles.badge(plan)}>Your Current Plan</div> : plan.badge ? <div style={styles.badge(plan)}>{plan.badge}</div> : null}
              <h3 style={styles.name}>{plan.name}</h3>
              <div style={styles.price}>
                {annual ? (
                  <>
                    <span style={styles.amount(plan.color)}>${Math.round(planPrice * 12 * 0.95).toLocaleString()}</span>
                    <span style={styles.period}>/yr</span>
                  </>
                ) : (
                  <>
                    <span style={styles.amount(plan.color)}>{plan.price}</span>
                    <span style={styles.period}>{plan.period}</span>
                  </>
                )}
              </div>
              {annual ? <div style={styles.note(plan.color)}>equiv. ${Math.round(planPrice * 0.95)}/mo billed annually</div> : null}
              <p style={styles.tagline}>{plan.tagline}</p>
              <div style={styles.savings}>
                <div>Buy modules separately: <strong>${bundleValue}/mo</strong></div>
                {savings > 0 ? <div style={{ color: plan.color }}>You save <strong>${savings}/mo</strong> - ${(savings * 12).toLocaleString()}/yr</div> : null}
              </div>
              <div style={styles.divider(plan.color)} />
              <ul style={styles.list}>
                {plan.features.map((feature, index) => (
                  <li key={`${plan.id}-feature-${index}`} style={styles.row}>
                    <PlanCheckIcon color={plan.color} />
                    <span style={styles.rowLabel}>{feature.label}</span>
                    {feature.value !== true ? <span style={styles.rowValue(plan.color)}>{feature.value}</span> : null}
                  </li>
                ))}
              </ul>
              <div style={styles.quotaHeader(plan.color)}>Base Quotas Included</div>
              <ul style={styles.list}>
                {plan.quotas.map((quota, index) => (
                  <li key={`${plan.id}-quota-${index}`} style={styles.row}>
                    <span style={styles.rowLabel}>{quota.label}</span>
                    <span style={styles.rowValue(plan.color)}>{quota.value}</span>
                  </li>
                ))}
              </ul>
              <div style={styles.cardFooter}>
                <button
                  type="button"
                  style={styles.btn(plan, selected)}
                  onClick={() => {
                    if (canSelect) onSelectPlan(selected ? null : plan.id);
                    else if (typeof window !== "undefined") window.location.href = "/billing";
                  }}
                >
                  {selected && !marketingMode ? "Selected" : buttonText}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {showAddOns ? (
        <div style={styles.extras}>
          <strong>Optional add-ons</strong>
          <div style={styles.extrasGrid}>
            {[...PROJECT_CREDIT_PACKS, ...EMAIL_PACKS, ...SMS_PACKS, ...AI_PACKS].map((pack) => (
              <div key={`${pack.id || pack.label}`} style={styles.pack}>
                <div>{pack.label}</div>
                <strong>${pack.price}/mo</strong>
                {pack.badge ? <div style={{ color: "#86efac", fontSize: 12 }}>{pack.badge}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { PlanCheckIcon };
