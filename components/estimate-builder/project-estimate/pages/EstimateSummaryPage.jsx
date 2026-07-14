import { LuxuryInfoCard, LuxuryMasterPageHeader, styles } from "../ProjectEstimateShared";

export default function EstimateSummaryPage({ pageType, accent, logo, builderName, visibleProjectInfoRows }) {
  return (
    <section className="proposal-builder-page" style={{ ...styles.luxuryPage, ...styles.luxuryProjectInfoPage, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryPage : {}) }}>
      <LuxuryMasterPageHeader logo={logo} builderName={builderName} title={pageType === "projectInfo" ? "Project Information" : "Estimate Summary"} accent={accent} />
      <div style={{ ...styles.luxuryProjectIntro, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryIntro : {}) }}>
        <div style={{ ...styles.luxuryEyebrow, color: accent }}>Estimate snapshot</div>
        <h2 style={{ ...styles.luxurySectionTitle, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryTitle : {}) }}>A clear overview of the project and estimate context.</h2>
        <p style={{ ...styles.luxuryBodyText, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryBody : {}) }}>This summary captures the project identity, site details and build context that guide the estimate pack and next steps.</p>
      </div>
      <div style={{ ...styles.luxuryInfoGrid, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryInfoGrid : {}) }}>
        {visibleProjectInfoRows.map((item) => <LuxuryInfoCard key={item.label} item={item} accent={accent} compact={pageType === "estimateSummary"} />)}
      </div>
      <div style={{ ...styles.luxuryFeatureBox, ...styles.luxuryProjectInfoFeatureBox, ...(pageType === "estimateSummary" ? styles.luxuryEstimateSummaryNoticeBox : {}), borderColor: accent }}>
        <h2 style={styles.luxuryNoticeHeading}>IMPORTANT NOTICE</h2>
        <p style={styles.luxuryNoticeBody}>This quote is valid for 60 days. This Project Estimate has been prepared using our Premier Inclusions Schedule and the information available at the time of pricing. The final contract quotation may vary depending on your final product selections, engineering requirements, site conditions, statutory authority requirements, and any requested changes. All confirmed selections, inclusions and variations will be documented in the Formal Quotation before the Building Contract is prepared.</p>
      </div>
    </section>
  );
}
