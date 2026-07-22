// @ts-nocheck
import { pricingSummaryDefaults } from "../defaults/pricingSummary.defaults";
import { LuxuryMasterPageHeader, nativeProjectEstimateGroupProps, projectEstimateRichTextProps, styles } from "../ProjectEstimateShared";
import { money } from "../theme";
import type { EstimatePageProps, ProjectEstimatePageDefinition } from "../ProjectEstimateTypes";

const block = (id: string, type: string, order: number, content: Record<string, any> = {}, design: Record<string, any> = {}) => ({ id: `pricing-${id}`, type, order, content, design });

export const pricingSummaryPageDefinition: ProjectEstimatePageDefinition = {
  id: "pricing",
  navigationTitle: "Pricing",
  version: 1,
  defaultContent: pricingSummaryDefaults,
  defaultBlocks: [
    block("hero-panel", "group", -1, { editorLabel: "Pricing hero panel" }, { children: ["pricing-eyebrow", "pricing-intro"], autoFit: true }),
    block("payment-grid", "group", 0, { editorLabel: "Pricing summary panel" }, { children: ["pricing-pricing-summary", "pricing-total-line"], autoFit: true }),
    block("eyebrow", "text", 1, { text: pricingSummaryDefaults.eyebrow, editorLabel: "Page label" }, { parentGroupId: "pricing-hero-panel" }),
    block("heading", "heading", 2, { text: pricingSummaryDefaults.mainHeading, editorLabel: "Main heading" }),
    block("intro", "text", 3, { text: pricingSummaryDefaults.introText, editorLabel: "Intro paragraph" }, { parentGroupId: "pricing-hero-panel" }),
    block("pricing-summary", "pricing_summary", 4, { heading: pricingSummaryDefaults.pricingHeading, totalLabel: pricingSummaryDefaults.pricingHeading, editorLabel: "Pricing summary" }, { parentGroupId: "pricing-payment-grid" }),
    block("total-line", "text", 5, { text: pricingSummaryDefaults.totalLine, editorLabel: "Total callout" }, { parentGroupId: "pricing-payment-grid" }),
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

export function PricingSummaryPage({ accent, logo, builderName, quoteTotal, pricingGroups = [], content = pricingSummaryDefaults, editorBridge = null }: EstimatePageProps & { editorBridge?: any }) {
  const eyebrowProps = projectEstimateRichTextProps("pricing-eyebrow", "text", content.eyebrow, editorBridge);
  const introProps = projectEstimateRichTextProps("pricing-intro", "text", content.introText, editorBridge);
  const pricingSummaryProps = projectEstimateRichTextProps("pricing-pricing-summary", "heading", content.pricingHeading || "Progress Payment Stages", editorBridge);
  const heroPanelProps = nativeProjectEstimateGroupProps("pricing-hero-panel", editorBridge);
  const paymentGridProps = nativeProjectEstimateGroupProps("pricing-payment-grid", editorBridge);
  return (
    <section className="proposal-builder-page" style={{ ...styles.luxuryPage, background: "#07111f", color: "#fff" }}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title={content.mainHeading || "Pricing / Investment Summary"} accent={accent} light />
      <div {...heroPanelProps} style={{ ...styles.luxuryPriceHero, ...(heroPanelProps as any).style }}>
        <span {...eyebrowProps} style={{ color: accent, ...(eyebrowProps as any).style }} />
        <strong style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 28, lineHeight: 1.05, fontWeight: 950 }}>
          {quoteTotal}
          <span style={{ fontSize: 19, fontWeight: 500, lineHeight: 1 }}>inc GST</span>
        </strong>
        <div {...introProps} style={{ margin: 0, fontSize: 20, lineHeight: 1.35, ...(introProps as any).style }} />
      </div>
      <div {...paymentGridProps} style={{ ...(paymentGridProps as any).style }}>
        <h2 {...pricingSummaryProps} style={{ ...styles.luxuryProgressHeading, ...(pricingSummaryProps as any).style }} />
        <div style={styles.luxuryPriceHeaderRow}><span>Stage</span><span>%</span><span>Amount</span></div>
        <div style={styles.luxuryPriceGrid}>
          {pricingGroups.map((group: any) => (
            <div
              key={group.stageNumber}
              data-project-estimate-native-element={`pricing-stage-${group.stageNumber}`}
              style={styles.luxuryPriceRow}
              onMouseDown={(event: any) => {
                if (!editorBridge?.editMode) return;
                event.stopPropagation();
                editorBridge.onSelectBlock?.(`pricing-stage-${group.stageNumber}`);
              }}
            >
              <span>{group.label}</span>
              <em>{group.percentDisplay}</em>
              <strong>{money(group.amount)}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default PricingSummaryPage;
