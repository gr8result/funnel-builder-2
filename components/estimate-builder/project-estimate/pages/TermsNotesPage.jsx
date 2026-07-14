import { LuxuryMasterPageHeader, styles } from "../ProjectEstimateShared";

export default function TermsNotesPage({ resolvedTheme, linkedFields, accent, logo, builderName }) {
  return (
    <section className="proposal-builder-page" style={styles.luxuryPage}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title="Terms / Notes" accent={accent} />
      <div style={{ ...styles.luxuryEyebrow, color: accent }}>Estimate notes</div>
      <h2 style={styles.luxurySectionTitle}>Clear boundaries before moving forward.</h2>
      <div style={{ ...styles.luxuryFeatureBox, borderColor: accent }}>
        <h2>Scope notes</h2>
        <p>{linkedFields.scopeOfWorks?.value || "This estimate is based on the available plans, inclusions, allowances and project information at the time of preparation."}</p>
      </div>
      <div style={{ ...styles.luxuryFeatureBox, borderColor: accent }}>
        <h2>Exclusions</h2>
        <p>{linkedFields.exclusions?.value || "Items not expressly included in the estimate or inclusions schedule are excluded unless confirmed in writing."}</p>
      </div>
      <div style={{ ...styles.luxuryFeatureBox, borderColor: accent }}>
        <h2>Terms</h2>
        <p>{resolvedTheme.acceptanceNote}</p>
      </div>
    </section>
  );
}
