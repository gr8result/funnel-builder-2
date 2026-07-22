// @ts-nocheck
import { acceptanceDefaults } from "../defaults/acceptance.defaults";
import { LuxuryMasterPageHeader, nativeProjectEstimateGroupProps, projectEstimateRichTextProps, styles } from "../ProjectEstimateShared";
import type { EstimatePageProps, ProjectEstimatePageDefinition } from "../ProjectEstimateTypes";

const block = (id: string, type: string, order: number, content: Record<string, any> = {}, design: Record<string, any> = {}) => ({ id: `acceptance-${id}`, type, order, content, design });

export const acceptancePageDefinition: ProjectEstimatePageDefinition = {
  id: "acceptance",
  navigationTitle: "Acceptance",
  version: 1,
  defaultContent: acceptanceDefaults,
  defaultBlocks: [
    block("signature-section", "group", -1, { editorLabel: "Signature section" }, { autoFit: true }),
    block("acknowledgement-section", "group", 0, { editorLabel: "Acceptance section" }, { children: ["acceptance-acknowledgement"], autoFit: true }),
    block("eyebrow", "text", 1, { text: acceptanceDefaults.eyebrow, editorLabel: "Page label" }),
    block("heading", "heading", 2, { text: acceptanceDefaults.mainHeading, editorLabel: "Main heading" }),
    block("intro", "text", 3, { text: acceptanceDefaults.introText, editorLabel: "Intro paragraph" }),
    block("acknowledgement", "signature", 4, { heading: acceptanceDefaults.acknowledgementHeading, text: acceptanceDefaults.acknowledgementText, signatureLabel: acceptanceDefaults.signatureLabel, dateLabel: acceptanceDefaults.dateLabel, editorLabel: "Acknowledgement section" }, { parentGroupId: "acceptance-acknowledgement-section" }),
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

export function AcceptancePage({ resolvedTheme, accent, logo, builderName, content = acceptanceDefaults, editorBridge = null }: EstimatePageProps) {
  const eyebrowProps = projectEstimateRichTextProps("acceptance-eyebrow", "text", content.eyebrow, editorBridge);
  const headingProps = projectEstimateRichTextProps("acceptance-heading", "text", content.mainHeading, editorBridge);
  const introProps = projectEstimateRichTextProps("acceptance-intro", "text", content.introText, editorBridge);
  const acknowledgementProps = projectEstimateRichTextProps("acceptance-acknowledgement", "text", content.acknowledgementText || resolvedTheme?.acceptanceNote, editorBridge);
  const signatureGroupProps = nativeProjectEstimateGroupProps("acceptance-signature-section", editorBridge);
  const acknowledgementGroupProps = nativeProjectEstimateGroupProps("acceptance-acknowledgement-section", editorBridge);
  return (
    <section className="proposal-builder-page" style={styles.luxuryPage}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title="Acceptance" accent={accent} />
      <div {...eyebrowProps} style={{ ...styles.luxuryEyebrow, color: accent, ...(eyebrowProps as any).style }} />
      <h2 {...headingProps} style={{ ...styles.luxurySectionTitle, ...(headingProps as any).style }} />
      <div {...introProps} style={{ ...styles.luxuryBodyText, ...(introProps as any).style }} />
      <div {...signatureGroupProps} style={{ ...styles.luxurySignatureGrid, ...(signatureGroupProps as any).style }}>
        <div style={styles.luxurySignatureLine}>{content.signatureLabel}</div>
        <div style={styles.luxurySignatureLine}>{content.dateLabel}</div>
      </div>
      <div {...acknowledgementGroupProps} style={{ ...styles.luxuryFeatureBox, borderColor: accent, ...(acknowledgementGroupProps as any).style }}>
        <h2>{content.acknowledgementHeading}</h2>
        <div {...acknowledgementProps} style={(acknowledgementProps as any).style} />
      </div>
    </section>
  );
}

export default AcceptancePage;
