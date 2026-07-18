// @ts-nocheck
import { pricingSummaryDefaults } from "../defaults/pricingSummary.defaults";
import { LuxuryMasterPageHeader, styles } from "../ProjectEstimateShared";
import { money } from "../theme";
import type { EstimatePageProps, ProjectEstimatePageDefinition } from "../ProjectEstimateTypes";

const block = (id: string, type: string, order: number, content: Record<string, any> = {}, design: Record<string, any> = {}) => ({ id: `pricing-${id}`, type, order, content, design });

export const pricingSummaryPageDefinition: ProjectEstimatePageDefinition = {
  id: "pricing",
  navigationTitle: "Pricing",
  version: 1,
  defaultContent: pricingSummaryDefaults,
  defaultBlocks: [
    block("eyebrow", "text", 0, { text: pricingSummaryDefaults.eyebrow, editorLabel: "Page label" }),
    block("heading", "heading", 1, { text: pricingSummaryDefaults.mainHeading, editorLabel: "Main heading" }),
    block("intro", "text", 2, { text: pricingSummaryDefaults.introText, editorLabel: "Intro paragraph" }),
    block("pricing-summary", "pricing_summary", 3, { heading: pricingSummaryDefaults.pricingHeading, totalLabel: pricingSummaryDefaults.pricingHeading, editorLabel: "Pricing summary" }),
    block("total-line", "text", 4, { text: pricingSummaryDefaults.totalLine, editorLabel: "Total callout" }),
  ],
  editorFields: [
    { blockId: "pricing-eyebrow", label: "Page label", type: "text" },
    { blockId: "pricing-heading", label: "Main heading", type: "textarea" },
    { blockId: "pricing-intro", label: "Intro paragraph", type: "textarea" },
    { blockId: "pricing-pricing-summary", label: "Pricing summary heading", type: "text" },
    { blockId: "pricing-total-line", label: "Total callout", type: "text" },
  ],
  validate: () => [],
  Component: PricingSummaryPage,
};

export function PricingSummaryPage({ accent, logo, builderName, quoteTotal, pricingGroups = [], showProgressDiagnostics, ProgressDiagnostic, content = pricingSummaryDefaults }: EstimatePageProps) {
  return (
    <section className="proposal-builder-page" style={{ ...styles.luxuryPage, background: "#07111f", color: "#fff" }}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title="Pricing / Investment Summary" accent={accent} light />
      <div style={styles.luxuryPriceHero}>
        <span style={{ color: accent }}>{content.eyebrow}</span>
        <strong style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 28, lineHeight: 1.05, fontWeight: 950 }}>
          {quoteTotal}
          <span style={{ fontSize: 19, fontWeight: 500, lineHeight: 1 }}>inc GST</span>
        </strong>
        <p style={{ margin: 0, fontSize: 20, lineHeight: 1.35 }}>{content.introText}</p>
      </div>
      <h2 style={styles.luxuryProgressHeading}>Progress Payment Stages</h2>
      <div style={styles.luxuryPriceHeaderRow}><span>Stage</span><span>%</span><span>Amount</span></div>
      <div style={styles.luxuryPriceGrid}>
        {pricingGroups.map((group: any) => (
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

export default PricingSummaryPage;
