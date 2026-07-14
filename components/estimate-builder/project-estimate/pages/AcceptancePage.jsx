import { LuxuryMasterPageHeader, styles } from "../ProjectEstimateShared";

export default function AcceptancePage({ resolvedTheme, accent, logo, builderName }) {
  return (
    <section className="proposal-builder-page" style={styles.luxuryPage}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title="Acceptance" accent={accent} />
      <h2 style={styles.luxurySectionTitle}>Ready to move from proposal to project.</h2>
      <p style={styles.luxuryBodyText}>Approval confirms the intention to proceed subject to final contract documentation, selections, site conditions, authority requirements and any agreed variations.</p>
      <div style={styles.luxurySignatureGrid}>
        <div style={styles.luxurySignatureLine}>Client signature</div>
        <div style={styles.luxurySignatureLine}>Date</div>
      </div>
      <div style={{ ...styles.luxuryFeatureBox, borderColor: accent }}>
        <h2>Terms acknowledgement</h2>
        <p>{resolvedTheme.acceptanceNote}</p>
      </div>
    </section>
  );
}
