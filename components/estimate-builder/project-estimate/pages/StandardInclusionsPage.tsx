// @ts-nocheck
import { standardInclusionsDefaults } from "../defaults/standardInclusions.defaults";
import { LuxuryMasterPageHeader, styles } from "../ProjectEstimateShared";
import type { EstimatePageProps, ProjectEstimatePageDefinition } from "../ProjectEstimateTypes";

const block = (id: string, type: string, order: number, content: Record<string, any> = {}, design: Record<string, any> = {}) => ({ id: `standardInclusions-${id}`, type, order, content, design });

export const standardInclusionsPageDefinition: ProjectEstimatePageDefinition = {
  id: "standardInclusions",
  navigationTitle: "Standard Inclusions Schedule",
  version: 1,
  defaultContent: standardInclusionsDefaults,
  defaultBlocks: [
    block("heading", "text", 0, { text: standardInclusionsDefaults.heading, editorLabel: "Page heading" }),
    block("priced-using", "text", 1, { text: standardInclusionsDefaults.pricedUsingLabel, editorLabel: "Priced using label" }),
  ],
  editorFields: [
    { blockId: "standardInclusions-heading", label: "Page heading", type: "text" },
    { blockId: "standardInclusions-priced-using", label: "Priced using label", type: "text" },
  ],
  validate: () => [],
  Component: StandardInclusionsPage,
};

export function StandardInclusionsPage({ accent, logo, builderName, pricedUsing, inclusionPackage, Brochure, content = standardInclusionsDefaults }: EstimatePageProps) {
  return (
    <section className="proposal-builder-page" style={{ ...styles.luxuryPage, ...styles.luxuryStandardInclusionsPage, background: "#f5f1e8", overflow: "hidden" }}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title={content.heading} accent={accent} />
      <div style={{ ...styles.standardPricedUsing, borderColor: accent }}>{content.pricedUsingLabel}: {pricedUsing}</div>
      {Brochure ? <Brochure packageData={inclusionPackage} accent={accent} /> : null}
    </section>
  );
}

export default StandardInclusionsPage;
