import { luxuryBackground, LuxuryMasterPageHeader, nativeProjectEstimateImageProps, nativeProjectEstimateTextProps, projectEstimateRichTextProps, styles } from "../ProjectEstimateShared";

export default function CoverPage({ resolvedTheme, accent, logo, builderName, projectName, clientName, projectAddress, quoteNumber, quoteDate, content = {}, hiddenBlockIds = [], editorBridge = null }) {
  const title = content.title && content.title !== "{{quoteTitle}}" ? content.title : projectName;
  const clientSite = content.clientAndSite && content.clientAndSite !== "{{clientName}}\n{{projectAddress}}"
    ? splitCoverLines(content.clientAndSite)
    : [clientName, projectAddress];
  const estimateNumberLabel = content.estimateNumberLabel || "Estimate";
  const estimateDateLabel = content.estimateDateLabel || "";
  const hidden = new Set(hiddenBlockIds || []);
  const heroBlock = editorBridge?.blockById?.["cover-hero-image"] || {};
  const heroImageUrl = heroBlock.content?.imageUrl || resolvedTheme.heroImageUrl;
  const heroProps = nativeProjectEstimateImageProps("cover-hero-image", editorBridge);
  const heroSelectionProps = { ...(heroProps || {}) };
  delete heroSelectionProps.style;
  const documentLabelProps = projectEstimateRichTextProps("cover-document-label", "text", content.documentLabel || "PROJECT ESTIMATE", editorBridge);
  const titleProps = projectEstimateRichTextProps("cover-title", "text", title, editorBridge);
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
            <span
              {...documentLabelProps}
              style={{ ...styles.luxuryProjectEstimateCoverTitleLine, ...(hidden.has("cover-document-label") ? hiddenStyle : {}), ...(documentLabelProps.style || {}) }}
            />
            <span
              {...titleProps}
              style={{ ...styles.luxuryProjectEstimateCoverTitleLine, ...(hidden.has("cover-title") ? hiddenStyle : {}), ...(titleProps.style || {}) }}
            />
          </h1>
          <div style={{ ...styles.luxuryAccentRule, background: accent }} />
          <div {...clientSiteProps} style={{ ...styles.luxuryCoverClient, ...(clientSiteProps.style || {}) }} />
        </div>
        <div style={styles.luxuryCoverMeta}>
          <span {...estimateNumberProps} style={estimateNumberProps.style || {}}>{estimateNumberLabel} {quoteNumber}</span>
          <span {...estimateDateProps} style={estimateDateProps.style || {}}>{estimateDateLabel ? `${estimateDateLabel} ` : ""}{quoteDate}</span>
        </div>
      </div>
    </section>
  );
}

const hiddenStyle = { visibility: "hidden" };

function splitCoverLines(value) {
  return String(value || "").replace(/<br\s*\/?>/gi, "\n").split("\n").filter(Boolean);
}
