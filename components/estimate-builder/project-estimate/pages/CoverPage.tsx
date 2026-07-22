// @ts-nocheck
import { coverPageDefaults } from "../defaults/coverPage.defaults";
import { luxuryBackground, LuxuryMasterPageHeader, nativeProjectEstimateImageProps, nativeProjectEstimateTextProps, projectEstimateRichTextProps, styles } from "../ProjectEstimateShared";
import type { EstimatePageProps, ProjectEstimatePageDefinition } from "../ProjectEstimateTypes";

const block = (id: string, type: string, order: number, content: Record<string, any> = {}, design: Record<string, any> = {}) => ({ id: `cover-${id}`, type, order, content, design });

export const coverPageDefinition: ProjectEstimatePageDefinition = {
  id: "cover",
  navigationTitle: "Cover Page",
  version: 1,
  defaultContent: coverPageDefaults,
  defaultBlocks: [
    block("hero-image", "image", -1, { imageUrl: "", defaultImageUrl: "", editorLabel: "Cover hero image", alt: "Project estimate cover image" }),
    block("document-label", "text", 0, { text: coverPageDefaults.documentLabel, editorLabel: "Document label" }),
    block("title", "heading", 1, { text: coverPageDefaults.title, editorLabel: "Estimate title" }),
    block("client-site", "text", 2, { text: coverPageDefaults.clientAndSite, editorLabel: "Client and site" }),
    block("intro", "text", 3, { text: coverPageDefaults.introText, editorLabel: "Intro text" }),
    block("estimate-number", "quote_field", 4, { fieldKey: "quoteNumber", label: coverPageDefaults.estimateNumberLabel, editorLabel: "Estimate number label" }),
    block("estimate-date", "quote_field", 5, { fieldKey: "quoteDate", label: coverPageDefaults.estimateDateLabel, editorLabel: "Estimate date label" }),
  ],
  editorFields: [
    { blockId: "cover-document-label", label: "Document label", type: "text" },
    { blockId: "cover-title", label: "Estimate title", type: "text" },
    { blockId: "cover-client-site", label: "Client and site", type: "textarea" },
    { blockId: "cover-intro", label: "Intro text", type: "textarea" },
  ],
  validate: (content) => (!String(content?.title || "").trim() ? ["Estimate title is required."] : []),
  Component: CoverPage,
};

export function CoverPage({ resolvedTheme, accent, logo, builderName, projectName, clientName, projectAddress, estimateNumber, estimateDate, quoteNumber, quoteDate, content = coverPageDefaults, hiddenBlockIds = [], editorBridge = null }: EstimatePageProps) {
  const title = content.title && content.title !== "{{quoteTitle}}" ? content.title : projectName;
  const clientSite = content.clientAndSite && content.clientAndSite !== "{{clientName}}\n{{projectAddress}}"
    ? splitCoverLines(content.clientAndSite)
    : [clientName, projectAddress];
  const estimateNumberLabel = content.estimateNumberLabel || "Estimate";
  const estimateDateLabel = content.estimateDateLabel || "";
  const hidden = new Set(hiddenBlockIds || []);
  const heroBlock = editorBridge?.blockById?.["cover-hero-image"] || {};
  const heroImageUrl = heroBlock.content?.imageUrl || resolvedTheme?.heroImageUrl;
  const heroProps = nativeProjectEstimateImageProps("cover-hero-image", editorBridge);
  const heroSelectionProps = { ...(heroProps as any) };
  delete heroSelectionProps.style;
  const documentLabelProps = projectEstimateRichTextProps("cover-document-label", "text", content.documentLabel, editorBridge);
  const titleProps = projectEstimateRichTextProps("cover-title", "text", title || content.title, editorBridge);
  const clientSiteProps = projectEstimateRichTextProps("cover-client-site", "text", clientSite.join("\n"), editorBridge);
  const estimateNumberProps = nativeProjectEstimateTextProps("cover-estimate-number", "label", editorBridge);
  const estimateDateProps = nativeProjectEstimateTextProps("cover-estimate-date", "label", editorBridge);
  return (
    <section
      className="proposal-builder-page"
      {...heroSelectionProps}
      style={{ ...styles.luxuryPage, ...styles.luxuryCoverPage, backgroundImage: hidden.has("cover-hero-image") ? "none" : luxuryBackground(heroImageUrl, 0.3) }}
    >
      <div style={{ ...styles.luxuryCoverOverlay, position: "relative", zIndex: 1 }}>
        <LuxuryMasterPageHeader logo={logo} builderName={builderName} accent={accent} light />
        <div style={styles.luxuryCoverContent}>
          <h1 style={styles.luxuryProjectEstimateCoverTitle}>
            <span {...documentLabelProps} style={{ ...styles.luxuryProjectEstimateCoverTitleLine, ...(documentLabelProps as any).style }} />
            <span {...titleProps} style={{ ...styles.luxuryProjectEstimateCoverTitleLine, ...(titleProps as any).style }} />
          </h1>
          <div style={{ ...styles.luxuryAccentRule, background: accent }} />
          <div {...clientSiteProps} style={{ ...styles.luxuryCoverClient, ...(clientSiteProps as any).style }} />
        </div>
        <div style={styles.luxuryCoverMeta}>
          <span {...estimateNumberProps} style={(estimateNumberProps as any).style || {}}>{estimateNumberLabel} {estimateNumber || quoteNumber}</span>
          <span {...estimateDateProps} style={(estimateDateProps as any).style || {}}>{estimateDateLabel ? `${estimateDateLabel} ` : ""}{estimateDate || quoteDate}</span>
        </div>
      </div>
    </section>
  );
}

export default CoverPage;

function splitCoverLines(value: any) {
  return String(value || "").replace(/<br\s*\/?>/gi, "\n").split("\n").filter(Boolean);
}
