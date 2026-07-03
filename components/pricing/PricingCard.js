import Link from "next/link";

export default function PricingCard({
  plan,
  mode = "marketing",
  isCurrent = false,
  deltaLabel = "",
  buttonLabel = "",
  onSelect,
}) {
  const cardStyle = {
    ...S.card,
    ...(isCurrent ? S.cardActive : {}),
    ...(plan.recommended && !isCurrent ? S.cardRec : {}),
  };
  const buttonText = mode === "billing"
    ? buttonLabel
    : plan.marketingCta || "Get Started";
  const buttonHref = plan.marketingHref || "/create-account";
  const buttonBg = isCurrent ? "transparent" : plan.color;
  const buttonBorder = `2px solid ${plan.color}`;
  const buttonColor = isCurrent ? plan.color : (plan.color === "#f59e0b" ? "#000" : "#fff");
  const buttonStyle = {
    ...S.btnEl,
    background: buttonBg,
    border: buttonBorder,
    color: buttonColor,
    opacity: isCurrent ? 0.8 : 1,
  };

  const button = mode === "billing" ? (
    <button
      type="button"
      onClick={() => !isCurrent && onSelect?.(plan.id)}
      disabled={isCurrent}
      style={buttonStyle}
    >
      {buttonText}
    </button>
  ) : (
    <Link href={buttonHref} style={S.link}>
      <span style={buttonStyle}>{buttonText}</span>
    </Link>
  );

  return (
    <div style={cardStyle}>
      {plan.recommended && !isCurrent && <div style={S.recBadge}>Best Value</div>}
      {mode === "billing" && isCurrent && <div style={S.activeBadge}>Current Plan</div>}
      <div style={{ ...S.planName, color: plan.color }}>{plan.name}</div>
      <div style={S.planPrice}>{plan.priceLabel}</div>
      <div style={{ ...S.planDelta, color: isCurrent ? plan.color : "rgba(255,255,255,0.55)" }}>
        {mode === "billing" ? deltaLabel : "Website builder plan"}
      </div>
      <ul style={S.featureList}>
        {(plan.features || []).map((feature) => (
          <li key={feature} style={S.featureItem}>✓ {feature}</li>
        ))}
      </ul>
      <div style={S.btn}>{button}</div>
    </div>
  );
}

export const pricingCardStyles = {
  grid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginBottom: 40 },
  btnEl: { width: "100%", padding: "10px 0", borderRadius: 8, border: "none", fontWeight: 600, fontSize: 16, cursor: "pointer", display: "block", textAlign: "center", boxSizing: "border-box" },
};

const S = {
  card: { background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "28px 22px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", position: "relative" },
  cardActive: { border: "2px solid #86efac" },
  cardRec: { border: "2px solid #f59e0b" },
  recBadge: { position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#f59e0b", color: "#000", fontSize: 16, fontWeight: 600, padding: "3px 14px", borderRadius: 20, whiteSpace: "nowrap" },
  activeBadge: { position: "absolute", top: -12, right: 14, background: "rgba(34,197,94,0.85)", color: "#000", fontSize: 16, fontWeight: 600, padding: "3px 14px", borderRadius: 20 },
  planName: { fontSize: 22, fontWeight: 600, marginBottom: 4 },
  planPrice: { fontSize: 28, fontWeight: 600 },
  planDelta: { fontSize: 16, marginTop: 4, minHeight: 18 },
  featureList: { listStyle: "none", padding: 0, margin: "16px 0 0", textAlign: "left", width: "100%", fontSize: 16, lineHeight: 2 },
  featureItem: { color: "rgba(255,255,255,0.8)" },
  btn: { marginTop: "auto", paddingTop: 20, width: "100%" },
  btnEl: pricingCardStyles.btnEl,
  link: { textDecoration: "none", display: "block", width: "100%" },
};
