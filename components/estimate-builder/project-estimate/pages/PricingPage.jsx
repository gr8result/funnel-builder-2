import { LuxuryMasterPageHeader, styles } from "../ProjectEstimateShared";
import { money } from "../theme";

export default function PricingPage({ accent, logo, builderName, quoteTotal, pricingGroups, showProgressDiagnostics, ProgressDiagnostic }) {
  return (
    <section className="proposal-builder-page" style={{ ...styles.luxuryPage, background: "#07111f", color: "#fff" }}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title="Pricing / Investment Summary" accent={accent} light />
      <div style={styles.luxuryPriceHero}>
        <span style={{ color: accent }}>Pricing / Investment Summary</span>
        <strong style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 28, lineHeight: 1.05, fontWeight: 950 }}>
          {quoteTotal}
          <span style={{ fontSize: 19, fontWeight: 500, lineHeight: 1 }}>inc GST</span>
        </strong>
        <p style={{ margin: 0, fontSize: 20, lineHeight: 1.35 }}>The following progress payments outline how your project estimate is staged throughout construction.</p>
      </div>
      <h2 style={styles.luxuryProgressHeading}>Progress Payment Stages</h2>
      <div style={styles.luxuryPriceHeaderRow}>
        <span>Stage</span>
        <span>%</span>
        <span>Amount</span>
      </div>
      <div style={styles.luxuryPriceGrid}>
        {pricingGroups.map((group) => (
          <div key={group.stageNumber} style={styles.luxuryPriceRow}>
            <span>{group.label}</span>
            <em>{group.percentDisplay}</em>
            <strong>{money(group.amount)}</strong>
          </div>
        ))}
      </div>
      {showProgressDiagnostics && ProgressDiagnostic ? <ProgressDiagnostic rows={pricingGroups} compact dark /> : null}
    </section>
  );
}
