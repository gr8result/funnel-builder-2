// @ts-nocheck
import { coverPageDefaults } from "../defaults/coverPage.defaults";
import { luxuryBackground, LuxuryMasterPageHeader, styles } from "../ProjectEstimateShared";
import type { EstimatePageProps, ProjectEstimatePageDefinition } from "../ProjectEstimateTypes";

const block = (id: string, type: string, order: number, content: Record<string, any> = {}, design: Record<string, any> = {}) => ({ id: `cover-${id}`, type, order, content, design });

export const coverPageDefinition: ProjectEstimatePageDefinition = {
  id: "cover",
  navigationTitle: "Cover Page",
  version: 1,
  defaultContent: coverPageDefaults,
  defaultBlocks: [
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

export function CoverPage({ resolvedTheme, accent, logo, builderName, projectName, clientName, projectAddress, estimateNumber, estimateDate, quoteNumber, quoteDate, content = coverPageDefaults }: EstimatePageProps) {
  return (
    <section className="proposal-builder-page" style={{ ...styles.luxuryPage, ...styles.luxuryCoverPage, backgroundImage: luxuryBackground(resolvedTheme?.heroImageUrl, 0.3) }}>
      <div style={styles.luxuryCoverOverlay}>
        <LuxuryMasterPageHeader logo={logo} builderName={builderName} accent={accent} light />
        <div style={styles.luxuryCoverContent}>
          <h1 style={styles.luxuryProjectEstimateCoverTitle}>
            <span style={styles.luxuryProjectEstimateCoverTitleLine}>{content.documentLabel}</span>
            <span style={styles.luxuryProjectEstimateCoverTitleLine}>{projectName || content.title}</span>
          </h1>
          <div style={{ ...styles.luxuryAccentRule, background: accent }} />
          <p style={styles.luxuryCoverClient}>{clientName}</p>
          <p style={styles.luxuryCoverAddress}>{projectAddress}</p>
        </div>
        <div style={styles.luxuryCoverMeta}>
          <span>Estimate {estimateNumber || quoteNumber}</span>
          <span>{estimateDate || quoteDate}</span>
        </div>
      </div>
    </section>
  );
}

export default CoverPage;
