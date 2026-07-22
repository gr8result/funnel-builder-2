// @ts-nocheck
import { estimateSummaryDefaults } from "../defaults/estimateSummary.defaults";
import { LuxuryInfoCard, LuxuryMasterPageHeader, nativeProjectEstimateGroupProps, projectEstimateRichTextProps, styles } from "../ProjectEstimateShared";
import type { EstimatePageProps, ProjectEstimatePageDefinition } from "../ProjectEstimateTypes";

const block = (id: string, type: string, order: number, content: Record<string, any> = {}, design: Record<string, any> = {}) => ({ id: `estimateSummary-${id}`, type, order, content, design });

export const estimateSummaryPageDefinition: ProjectEstimatePageDefinition = {
  id: "estimateSummary",
  navigationTitle: "Estimate Summary",
  version: 1,
  defaultContent: estimateSummaryDefaults,
  defaultBlocks: [
    block("intro-section", "group", -1, { editorLabel: "Estimate snapshot section" }, { children: ["estimateSummary-eyebrow", "estimateSummary-heading", "estimateSummary-intro"] }),
    block("eyebrow", "text", 0, { text: estimateSummaryDefaults.eyebrow, editorLabel: "Page label" }, { parentGroupId: "estimateSummary-intro-section" }),
    block("heading", "heading", 1, { text: estimateSummaryDefaults.mainHeading, editorLabel: "Main heading" }, { parentGroupId: "estimateSummary-intro-section" }),
    block("intro", "text", 2, { text: estimateSummaryDefaults.introText, editorLabel: "Intro paragraph" }, { parentGroupId: "estimateSummary-intro-section" }),
    block("project-info-grid", "group", 3, { editorLabel: "Project information grid" }, { children: ["project-info-cards"] }),
    block("notice-card", "group", 4, { editorLabel: "Important Notice block" }, { children: ["estimateSummary-notice-heading", "estimateSummary-notice-body"], autoFit: true }),
    block("notice-heading", "text", 5, { text: estimateSummaryDefaults.noticeHeading, editorLabel: "Notice heading" }, { parentGroupId: "estimateSummary-notice-card" }),
    block("notice-body", "text", 6, { text: estimateSummaryDefaults.noticeBody, editorLabel: "Notice text" }, { parentGroupId: "estimateSummary-notice-card" }),
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

export function EstimateSummaryPage({ pageType = "estimateSummary", accent, logo, builderName, visibleProjectInfoRows = [], content = estimateSummaryDefaults, editorBridge = null }: EstimatePageProps) {
  const eyebrowProps = projectEstimateRichTextProps("estimateSummary-eyebrow", "text", content.eyebrow, editorBridge);
  const headingProps = projectEstimateRichTextProps("estimateSummary-heading", "text", content.mainHeading, editorBridge);
  const introProps = projectEstimateRichTextProps("estimateSummary-intro", "text", content.introText, editorBridge);
  const noticeHeadingProps = projectEstimateRichTextProps("estimateSummary-notice-heading", "text", content.noticeHeading, editorBridge);
  const noticeBodyProps = projectEstimateRichTextProps("estimateSummary-notice-body", "text", content.noticeBody, editorBridge);
  const introGroupProps = nativeProjectEstimateGroupProps("estimateSummary-intro-section", editorBridge);
  const infoGridGroupProps = nativeProjectEstimateGroupProps("estimateSummary-project-info-grid", editorBridge);
  const noticeCardProps = nativeProjectEstimateGroupProps("estimateSummary-notice-card", editorBridge);
  return (
    <section className="proposal-builder-page" style={{ ...styles.luxuryPage, ...styles.luxuryProjectInfoPage, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryPage : {}) }}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title={pageType === "projectInfo" ? "Project Information" : "Estimate Summary"} accent={accent} />
      <div {...introGroupProps} style={{ ...styles.luxuryProjectIntro, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryIntro : {}), ...(introGroupProps as any).style }}>
        <div {...eyebrowProps} style={{ ...styles.luxuryEyebrow, color: accent, ...(eyebrowProps as any).style }} />
        <h2 {...headingProps} style={{ ...styles.luxurySectionTitle, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryTitle : {}), ...(headingProps as any).style }} />
        <div {...introProps} style={{ ...styles.luxuryBodyText, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryBody : {}), ...(introProps as any).style }} />
      </div>
      <div {...infoGridGroupProps} style={{ ...styles.luxuryInfoGrid, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryInfoGrid : {}), ...(infoGridGroupProps as any).style }}>
        {visibleProjectInfoRows.map((item: any) => <LuxuryInfoCard key={item.label} item={item} accent={accent} compact={pageType === "estimateSummary"} />)}
      </div>
      <div {...noticeCardProps} style={{ ...styles.luxuryFeatureBox, ...styles.luxuryProjectInfoFeatureBox, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryNoticeBox : {}), borderColor: accent, ...(noticeCardProps as any).style }}>
        <h2 {...noticeHeadingProps} style={{ ...styles.luxuryNoticeHeading, ...(noticeHeadingProps as any).style }} />
        <div {...noticeBodyProps} style={{ ...styles.luxuryNoticeBody, ...(noticeBodyProps as any).style }} />
      </div>
    </section>
  );
}

export default EstimateSummaryPage;
