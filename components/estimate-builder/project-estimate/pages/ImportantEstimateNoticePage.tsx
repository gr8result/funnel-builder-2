// @ts-nocheck
import { importantEstimateNoticeDefaults } from "../defaults/importantEstimateNotice.defaults";
import { LuxuryMasterPageHeader, styles } from "../ProjectEstimateShared";
import type { EstimatePageProps, ProjectEstimatePageDefinition } from "../ProjectEstimateTypes";

const block = (id: string, type: string, order: number, content: Record<string, any> = {}, design: Record<string, any> = {}) => ({ id: `termsNotes-${id}`, type, order, content, design });

export const importantEstimateNoticePageDefinition: ProjectEstimatePageDefinition = {
  id: "termsNotes",
  navigationTitle: "Important Estimate Notice",
  version: 1,
  defaultContent: importantEstimateNoticeDefaults,
  defaultBlocks: [
    block("eyebrow", "text", 0, { text: importantEstimateNoticeDefaults.eyebrow, editorLabel: "Notice title" }),
    block("heading", "heading", 1, { text: importantEstimateNoticeDefaults.mainHeading, editorLabel: "Main notice" }),
    block("intro", "text", 2, { text: importantEstimateNoticeDefaults.introText, editorLabel: "Intro paragraph" }),
    block("quote-timing-heading", "heading", 3, { text: importantEstimateNoticeDefaults.quoteTimingHeading, editorLabel: "Quotation timing heading" }),
    block("quote-timing-list", "text", 4, { text: importantEstimateNoticeDefaults.quoteTimingList, editorLabel: "Quotation timing list" }),
    block("footer", "text", 5, { text: importantEstimateNoticeDefaults.footerNotice, editorLabel: "Footer notice" }),
  ],
  editorFields: [
    { blockId: "termsNotes-eyebrow", label: "Notice title", type: "text" },
    { blockId: "termsNotes-heading", label: "Main notice", type: "textarea" },
    { blockId: "termsNotes-intro", label: "Intro paragraph", type: "textarea" },
    { blockId: "termsNotes-quote-timing-heading", label: "Quotation timing heading", type: "text" },
    { blockId: "termsNotes-quote-timing-list", label: "Quotation timing list", type: "textarea" },
    { blockId: "termsNotes-footer", label: "Footer notice", type: "textarea" },
  ],
  validate: (content) => (!String(content?.mainHeading || "").trim() ? ["Main notice is required."] : []),
  Component: ImportantEstimateNoticePage,
};

export function ImportantEstimateNoticePage({ accent, logo, builderName, content = importantEstimateNoticeDefaults }: EstimatePageProps) {
  return (
    <section className="proposal-builder-page" style={styles.luxuryPage}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title="Important Estimate Notice" accent={accent} />
      <div style={{ ...styles.luxuryEyebrow, color: accent }}>{content.eyebrow}</div>
      <h2 style={styles.luxurySectionTitle}>{content.mainHeading}</h2>
      <div style={{ ...styles.luxuryFeatureBox, borderColor: accent }}>
        <p>{content.introText}</p>
      </div>
      <div style={{ ...styles.luxuryFeatureBox, borderColor: accent }}>
        <h2>{content.quoteTimingHeading}</h2>
        <p style={{ whiteSpace: "pre-line" }}>{content.quoteTimingList}</p>
      </div>
      <div style={{ ...styles.luxuryFeatureBox, borderColor: accent }}>
        <p>{content.footerNotice}</p>
      </div>
    </section>
  );
}

export default ImportantEstimateNoticePage;
