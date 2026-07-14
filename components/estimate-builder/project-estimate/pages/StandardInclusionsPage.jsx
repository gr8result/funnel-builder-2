import { LuxuryMasterPageHeader, styles } from "../ProjectEstimateShared";

export default function StandardInclusionsPage({ accent, logo, builderName, pricedUsing, inclusionPackage, Brochure }) {
  return (
    <section className="proposal-builder-page" style={{ ...styles.luxuryPage, ...styles.luxuryStandardInclusionsPage, background: "#f5f1e8", overflow: "hidden" }}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title="Standard Inclusions Schedule" accent={accent} />
      <div style={{ ...styles.standardPricedUsing, borderColor: accent }}>Priced using: {pricedUsing}</div>
      <Brochure packageData={inclusionPackage} accent={accent} />
    </section>
  );
}
