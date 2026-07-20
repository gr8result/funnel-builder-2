import { luxuryBackground, LuxuryMasterPageHeader, nativeProjectEstimateImageProps, nativeProjectEstimateTextProps, styles } from "../ProjectEstimateShared";

export default function CoverPage({ resolvedTheme, accent, logo, builderName, projectName, clientName, projectAddress, quoteNumber, quoteDate, content = {}, hiddenBlockIds = [], editorBridge = null }) {
  const title = content.title && content.title !== "{{quoteTitle}}" ? content.title : projectName;
  const clientSite = content.clientAndSite && content.clientAndSite !== "{{clientName}}\n{{projectAddress}}"
    ? splitCoverLines(content.clientAndSite)
    : [clientName, projectAddress];
  const estimateNumberLabel = content.estimateNumberLabel || "Estimate";
  const estimateDateLabel = content.estimateDateLabel || "";
  const hidden = new Set(hiddenBlockIds || []);
  const heroBlock = editorBridge?.blockById?.["cover-hero-image"] || {};
  const heroFrame = heroBlock.design?.frameEdited ? heroBlock.design?.frame : null;
  const heroImageUrl = heroBlock.content?.imageUrl || resolvedTheme.heroImageUrl;
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
      style={{ ...styles.luxuryPage, ...styles.luxuryCoverPage, backgroundImage: hidden.has("cover-hero-image") || heroFrame ? "none" : luxuryBackground(heroImageUrl, 0.3), ...(heroProps.style || {}) }}
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
            <span
              {...documentLabelProps}
              style={{ ...styles.luxuryProjectEstimateCoverTitleLine, ...(hidden.has("cover-document-label") ? hiddenStyle : {}), ...(documentLabelProps.style || {}) }}
            >
              {content.documentLabel || "PROJECT ESTIMATE"}
            </span>
            {splitCoverLines(title).map((line, index) => (
              <span
                key={`${line}-${index}`}
                {...titleProps}
                style={{ ...styles.luxuryProjectEstimateCoverTitleLine, ...(hidden.has("cover-title") ? hiddenStyle : {}), ...(titleProps.style || {}) }}
              >
                {line}
              </span>
            ))}
          </h1>
          <div style={{ ...styles.luxuryAccentRule, background: accent }} />
          <p {...clientSiteProps} style={{ ...styles.luxuryCoverClient, ...(clientSiteProps.style || {}) }}>{clientSite[0] || clientName}</p>
          <p {...clientSiteProps} style={{ ...styles.luxuryCoverAddress, ...(clientSiteProps.style || {}) }}>{clientSite.slice(1).join("\n") || projectAddress}</p>
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
