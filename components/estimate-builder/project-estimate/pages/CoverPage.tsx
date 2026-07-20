// @ts-nocheck
import { coverPageDefaults } from "../defaults/coverPage.defaults";
import { luxuryBackground, LuxuryMasterPageHeader, nativeProjectEstimateImageProps, nativeProjectEstimateTextProps, styles } from "../ProjectEstimateShared";
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
  const heroFrame = heroBlock.design?.frameEdited ? heroBlock.design?.frame : null;
  const heroImageUrl = heroBlock.content?.imageUrl || resolvedTheme?.heroImageUrl;
  const heroProps = nativeProjectEstimateImageProps("cover-hero-image", editorBridge);
  const documentLabelProps = nativeProjectEstimateTextProps("cover-document-label", "text", editorBridge);
  const titleProps = nativeProjectEstimateTextProps("cover-title", "text", editorBridge);
  const clientSiteProps = nativeProjectEstimateTextProps("cover-client-site", "text", editorBridge);
  const estimateNumberProps = nativeProjectEstimateTextProps("cover-estimate-number", "label", editorBridge);
  const estimateDateProps = nativeProjectEstimateTextProps("cover-estimate-date", "label", editorBridge);
  return (
    <section
      className="proposal-builder-page"
      {...heroProps}
      style={{ ...styles.luxuryPage, ...styles.luxuryCoverPage, backgroundImage: hidden.has("cover-hero-image") || heroFrame ? "none" : luxuryBackground(heroImageUrl, 0.3), ...(heroProps as any).style }}
    >
      {!hidden.has("cover-hero-image") && heroFrame ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: Number(heroFrame.x || 0),
            top: Number(heroFrame.y || 0),
            width: Number(heroFrame.width || 794),
            height: Number(heroFrame.height || 1123),
            backgroundImage: luxuryBackground(heroImageUrl, 0),
            backgroundSize: heroBlock.design?.objectFit === "contain" ? "contain" : "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: `${Number(heroBlock.design?.objectPositionX ?? 50)}% ${Number(heroBlock.design?.objectPositionY ?? 50)}%`,
            opacity: Number(heroBlock.design?.opacity ?? 1),
            zIndex: 0,
            pointerEvents: "none",
          }}
        />
      ) : null}
      <div style={{ ...styles.luxuryCoverOverlay, position: "relative", zIndex: 1 }}>
        <LuxuryMasterPageHeader logo={logo} builderName={builderName} accent={accent} light />
        <div style={styles.luxuryCoverContent}>
          <h1 style={styles.luxuryProjectEstimateCoverTitle}>
            <span {...documentLabelProps} style={{ ...styles.luxuryProjectEstimateCoverTitleLine, ...(documentLabelProps as any).style }}>{content.documentLabel}</span>
            {splitCoverLines(title || content.title).map((line, index) => (
              <span key={`${line}-${index}`} {...titleProps} style={{ ...styles.luxuryProjectEstimateCoverTitleLine, ...(titleProps as any).style }}>{line}</span>
            ))}
          </h1>
          <div style={{ ...styles.luxuryAccentRule, background: accent }} />
          <p {...clientSiteProps} style={{ ...styles.luxuryCoverClient, ...(clientSiteProps as any).style }}>{clientSite[0] || clientName}</p>
          <p {...clientSiteProps} style={{ ...styles.luxuryCoverAddress, ...(clientSiteProps as any).style }}>{clientSite.slice(1).join("\n") || projectAddress}</p>
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
