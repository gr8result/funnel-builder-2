// @ts-nocheck
import { estimateSummaryDefaults } from "../defaults/estimateSummary.defaults";
import { LuxuryInfoCard, LuxuryMasterPageHeader, styles } from "../ProjectEstimateShared";
import type { EstimatePageProps, ProjectEstimatePageDefinition } from "../ProjectEstimateTypes";

const block = (id: string, type: string, order: number, content: Record<string, any> = {}, design: Record<string, any> = {}) => ({ id: `estimateSummary-${id}`, type, order, content, design });

export const estimateSummaryPageDefinition: ProjectEstimatePageDefinition = {
  id: "estimateSummary",
  navigationTitle: "Estimate Summary",
  version: 1,
  defaultContent: estimateSummaryDefaults,
  defaultBlocks: [
    block("eyebrow", "text", 0, { text: estimateSummaryDefaults.eyebrow, editorLabel: "Page label" }),
    block("heading", "heading", 1, { text: estimateSummaryDefaults.mainHeading, editorLabel: "Main heading" }),
    block("intro", "text", 2, { text: estimateSummaryDefaults.introText, editorLabel: "Intro paragraph" }),
    block("notice-heading", "text", 3, { text: estimateSummaryDefaults.noticeHeading, editorLabel: "Notice heading" }),
    block("notice-body", "text", 4, { text: estimateSummaryDefaults.noticeBody, editorLabel: "Notice text" }),
  ],
  editorFields: [
    { blockId: "estimateSummary-eyebrow", label: "Page label", type: "text" },
    { blockId: "estimateSummary-heading", label: "Main heading", type: "textarea" },
    { blockId: "estimateSummary-intro", label: "Intro paragraph", type: "textarea" },
    { blockId: "estimateSummary-notice-heading", label: "Notice heading", type: "text" },
    { blockId: "estimateSummary-notice-body", label: "Notice text", type: "textarea" },
  ],
  validate: (content) => (!String(content?.noticeBody || "").trim() ? ["Important notice text is required."] : []),
  Component: EstimateSummaryPage,
};

export function EstimateSummaryPage({ pageType = "estimateSummary", accent, logo, builderName, visibleProjectInfoRows = [], content = estimateSummaryDefaults }: EstimatePageProps) {
  return (
    <section className="proposal-builder-page" style={{ ...styles.luxuryPage, ...styles.luxuryProjectInfoPage, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryPage : {}) }}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title={pageType === "projectInfo" ? "Project Information" : "Estimate Summary"} accent={accent} />
      <div style={{ ...styles.luxuryProjectIntro, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryIntro : {}) }}>
        <div style={{ ...styles.luxuryEyebrow, color: accent }}>{content.eyebrow}</div>
        <h2 style={{ ...styles.luxurySectionTitle, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryTitle : {}) }}>{content.mainHeading}</h2>
        <p style={{ ...styles.luxuryBodyText, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryBody : {}) }}>{content.introText}</p>
      </div>
      <div style={{ ...styles.luxuryInfoGrid, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryInfoGrid : {}) }}>
        {visibleProjectInfoRows.map((item: any) => <LuxuryInfoCard key={item.label} item={item} accent={accent} compact={pageType === "estimateSummary"} />)}
      </div>
      <div style={{ ...styles.luxuryFeatureBox, ...styles.luxuryProjectInfoFeatureBox, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryNoticeBox : {}), borderColor: accent }}>
        <h2 style={styles.luxuryNoticeHeading}>{content.noticeHeading}</h2>
        <p style={styles.luxuryNoticeBody}>{content.noticeBody}</p>
      </div>
    </section>
  );
}

export default EstimateSummaryPage;
