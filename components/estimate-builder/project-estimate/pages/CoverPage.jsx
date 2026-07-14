import { luxuryBackground, LuxuryMasterPageHeader, styles } from "../ProjectEstimateShared";

export default function CoverPage({ resolvedTheme, accent, logo, builderName, projectName, clientName, projectAddress, quoteNumber, quoteDate }) {
  return (
    <section className="proposal-builder-page" style={{ ...styles.luxuryPage, ...styles.luxuryCoverPage, backgroundImage: luxuryBackground(resolvedTheme.heroImageUrl, 0.3) }}>
      <div style={styles.luxuryCoverOverlay}>
        <LuxuryMasterPageHeader logo={logo} builderName={builderName} accent={accent} light />
        <div style={styles.luxuryCoverContent}>
          <h1 style={styles.luxuryProjectEstimateCoverTitle}>
            <span style={styles.luxuryProjectEstimateCoverTitleLine}>PROJECT ESTIMATE</span>
            <span style={styles.luxuryProjectEstimateCoverTitleLine}>{projectName}</span>
          </h1>
          <div style={{ ...styles.luxuryAccentRule, background: accent }} />
          <p style={styles.luxuryCoverClient}>{clientName}</p>
          <p style={styles.luxuryCoverAddress}>{projectAddress}</p>
        </div>
        <div style={styles.luxuryCoverMeta}>
          <span>Quote {quoteNumber}</span>
          <span>{quoteDate}</span>
        </div>
      </div>
    </section>
  );
}
