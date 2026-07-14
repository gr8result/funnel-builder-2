import { luxuryBackground, LuxuryMasterPageHeader, styles } from "../ProjectEstimateShared";

export default function ThankYouPage({ resolvedTheme, accent, logo, builderName }) {
  return (
    <section className="proposal-builder-page" style={{ ...styles.luxuryPage, ...styles.luxuryCoverPage, backgroundImage: luxuryBackground(resolvedTheme.thankYouImageUrl || resolvedTheme.heroImageUrl, 0.58) }}>
      <div style={styles.luxuryCoverOverlay}>
        <LuxuryMasterPageHeader logo={logo} builderName={builderName} title="Thank You" accent={accent} light />
        <div style={styles.luxuryThankYouContent}>
          <div style={{ ...styles.luxuryEyebrow, color: accent }}>Thank you</div>
          <h1 style={styles.luxuryCoverTitle}>Let's build something worth coming home to.</h1>
          <div style={{ ...styles.luxuryAccentRule, background: accent }} />
          <p style={styles.luxuryCoverAddress}>{resolvedTheme.thankYouMessage}</p>
          <p style={styles.luxuryCoverClient}>{builderName}</p>
        </div>
      </div>
    </section>
  );
}
