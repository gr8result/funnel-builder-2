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

function editableProps(blockId: string, contentKey: string, editorBridge: any = {}) {
  if (!editorBridge?.editMode) return {};
  const selected = editorBridge.selectedBlockId === blockId;
  const editing = editorBridge.editingBlockId === blockId;
  const design = editorBridge.blockById?.[blockId]?.design || {};
  const designStyle = {
    ...(design.color ? { color: design.color } : {}),
    ...(design.fontFamily ? { fontFamily: design.fontFamily } : {}),
    ...(design.fontSize ? { fontSize: Number(design.fontSize) } : {}),
    ...(design.fontWeight ? { fontWeight: Number(design.fontWeight) } : {}),
    ...(design.fontStyle ? { fontStyle: design.fontStyle } : {}),
    ...(design.textDecoration ? { textDecoration: design.textDecoration } : {}),
    ...(design.textAlign ? { textAlign: design.textAlign } : {}),
    ...(design.lineHeight ? { lineHeight: design.lineHeight } : {}),
    ...(design.letterSpacing !== undefined ? { letterSpacing: Number(design.letterSpacing) } : {}),
    ...(design.opacity !== undefined ? { opacity: Number(design.opacity) } : {}),
  };
  return {
    "data-project-estimate-native-element": blockId,
    contentEditable: editing,
    suppressContentEditableWarning: true,
    tabIndex: 0,
    onMouseDown: (event: any) => {
      event.stopPropagation();
      editorBridge.onSelectBlock?.(blockId);
    },
    onDoubleClick: (event: any) => {
      event.stopPropagation();
      const target = event.currentTarget;
      editorBridge.onSelectBlock?.(blockId);
      editorBridge.onEditBlock?.(blockId);
      requestAnimationFrame(() => {
        const selection = window.getSelection?.();
        const range = document.createRange?.();
        if (!selection || !range) return;
        range.selectNodeContents(target);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      });
    },
    onBlur: (event: any) => {
      if (!editing) return;
      editorBridge.onTextCommit?.(blockId, contentKey, String(event.currentTarget.innerText || "").trim());
      editorBridge.onEditBlock?.("");
    },
    style: {
      ...designStyle,
      outline: "none",
      cursor: editing ? "text" : "pointer",
      borderRadius: 3,
    },
  };
}

export function PricingSummaryPage({ accent, logo, builderName, quoteTotal, pricingGroups = [], content = pricingSummaryDefaults, editorBridge = null }: EstimatePageProps & { editorBridge?: any }) {
  const eyebrowProps = editableProps("pricing-eyebrow", "text", editorBridge);
  const introProps = editableProps("pricing-intro", "text", editorBridge);
  const pricingSummaryProps = editableProps("pricing-pricing-summary", "heading", editorBridge);
  return (
    <section className="proposal-builder-page" style={{ ...styles.luxuryPage, background: "#07111f", color: "#fff" }}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title={content.mainHeading || "Pricing / Investment Summary"} accent={accent} light />
      <div style={styles.luxuryPriceHero}>
        <span {...eyebrowProps} style={{ color: accent, ...(eyebrowProps as any).style }}>{content.eyebrow}</span>
        <strong style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 28, lineHeight: 1.05, fontWeight: 950 }}>
          {quoteTotal}
          <span style={{ fontSize: 19, fontWeight: 500, lineHeight: 1 }}>inc GST</span>
        </strong>
        <p {...introProps} style={{ margin: 0, fontSize: 20, lineHeight: 1.35, ...(introProps as any).style }}>{content.introText}</p>
      </div>
      <h2 {...pricingSummaryProps} style={{ ...styles.luxuryProgressHeading, ...(pricingSummaryProps as any).style }}>{content.pricingHeading || "Progress Payment Stages"}</h2>
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
    </section>
  );
}

export default PricingSummaryPage;
