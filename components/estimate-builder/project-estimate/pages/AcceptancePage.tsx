// @ts-nocheck
import { acceptanceDefaults } from "../defaults/acceptance.defaults";
import { LuxuryMasterPageHeader, styles } from "../ProjectEstimateShared";
import type { EstimatePageProps, ProjectEstimatePageDefinition } from "../ProjectEstimateTypes";

const block = (id: string, type: string, order: number, content: Record<string, any> = {}, design: Record<string, any> = {}) => ({ id: `acceptance-${id}`, type, order, content, design });

export const acceptancePageDefinition: ProjectEstimatePageDefinition = {
  id: "acceptance",
  navigationTitle: "Acceptance",
  version: 1,
  defaultContent: acceptanceDefaults,
  defaultBlocks: [
    block("eyebrow", "text", 0, { text: acceptanceDefaults.eyebrow, editorLabel: "Page label" }),
    block("heading", "heading", 1, { text: acceptanceDefaults.mainHeading, editorLabel: "Main heading" }),
    block("intro", "text", 2, { text: acceptanceDefaults.introText, editorLabel: "Intro paragraph" }),
    block("acknowledgement", "signature", 3, { heading: acceptanceDefaults.acknowledgementHeading, text: acceptanceDefaults.acknowledgementText, signatureLabel: acceptanceDefaults.signatureLabel, dateLabel: acceptanceDefaults.dateLabel, editorLabel: "Acknowledgement section" }),
  ],
  editorFields: [
    { blockId: "acceptance-eyebrow", label: "Page label", type: "text" },
    { blockId: "acceptance-heading", label: "Main heading", type: "textarea" },
    { blockId: "acceptance-intro", label: "Intro paragraph", type: "textarea" },
    { blockId: "acceptance-acknowledgement", label: "Acknowledgement text", type: "textarea" },
  ],
  validate: () => [],
  Component: AcceptancePage,
};

export function AcceptancePage({ resolvedTheme, accent, logo, builderName, content = acceptanceDefaults }: EstimatePageProps) {
  return (
    <section className="proposal-builder-page" style={styles.luxuryPage}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title="Acceptance" accent={accent} />
      <div style={{ ...styles.luxuryEyebrow, color: accent }}>{content.eyebrow}</div>
      <h2 style={styles.luxurySectionTitle}>{content.mainHeading}</h2>
      <p style={styles.luxuryBodyText}>{content.introText}</p>
      <div style={styles.luxurySignatureGrid}>
        <div style={styles.luxurySignatureLine}>{content.signatureLabel}</div>
        <div style={styles.luxurySignatureLine}>{content.dateLabel}</div>
      </div>
      <div style={{ ...styles.luxuryFeatureBox, borderColor: accent }}>
        <h2>{content.acknowledgementHeading}</h2>
        <p>{content.acknowledgementText || resolvedTheme?.acceptanceNote}</p>
      </div>
    </section>
  );
}

export default AcceptancePage;
