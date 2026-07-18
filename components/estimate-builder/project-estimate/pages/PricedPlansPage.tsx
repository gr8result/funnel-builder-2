// @ts-nocheck
import { pricedPlansDefaults } from "../defaults/pricedPlans.defaults";
import { LuxuryMasterPageHeader, styles } from "../ProjectEstimateShared";
import type { EstimatePageProps, ProjectEstimatePageDefinition } from "../ProjectEstimateTypes";

const block = (id: string, type: string, order: number, content: Record<string, any> = {}, design: Record<string, any> = {}) => ({ id: `pricedPlans-${id}`, type, order, content, design });

export const pricedPlansPageDefinition: ProjectEstimatePageDefinition = {
  id: "pricedPlans",
  navigationTitle: "Plans Used to Prepare This Estimate",
  version: 1,
  defaultContent: pricedPlansDefaults,
  defaultBlocks: [
    block("heading", "heading", 0, { text: pricedPlansDefaults.heading, editorLabel: "Page heading" }),
    block("empty-text", "text", 1, { text: pricedPlansDefaults.emptyText, editorLabel: "Empty state text" }),
  ],
  editorFields: [
    { blockId: "pricedPlans-heading", label: "Page heading", type: "text" },
    { blockId: "pricedPlans-empty-text", label: "Empty state text", type: "textarea" },
  ],
  validate: () => [],
  Component: PricedPlansPage,
};

export function PricedPlansPage({ accent, logo, builderName, content = pricedPlansDefaults }: EstimatePageProps) {
  return (
    <section className="proposal-builder-page" style={styles.luxuryPage}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title={content.heading} accent={accent} />
      <div style={{ ...styles.luxuryFeatureBox, borderColor: accent }}>
        <h2>{content.heading}</h2>
        <p>{content.emptyText}</p>
      </div>
    </section>
  );
}

export default PricedPlansPage;
