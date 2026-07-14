import { selectedEstimateInclusionsPackage } from "../../../lib/builders/estimateInclusions";
import { defaultLuxuryProposalTheme, hasProjectInfoValue } from "./theme";
import AboutGoodBuildPage from "./pages/AboutGoodBuildPage";
import AcceptancePage from "./pages/AcceptancePage";
import CoverPage from "./pages/CoverPage";
import EstimateSummaryPage from "./pages/EstimateSummaryPage";
import PricingPage from "./pages/PricingPage";
import StandardInclusionsPage from "./pages/StandardInclusionsPage";
import TermsNotesPage from "./pages/TermsNotesPage";
import ThankYouPage from "./pages/ThankYouPage";

export default function ProjectEstimatePackPage({ page, theme, linkedFields, Brochure, ProgressDiagnostic }) {
  const resolvedTheme = { ...defaultLuxuryProposalTheme({}), ...(theme || {}) };
  const accent = resolvedTheme.accentColor || "#c89d4a";
  const pageType = page.page_type || page.id;
  const field = (key) => linkedFields[key]?.value || "Not entered";
  const clientName = resolvedTheme.clientNameOverride || field("clientName");
  const projectAddress = resolvedTheme.siteAddressOverride || field("projectAddress");
  const projectName = field("projectName");
  const builderName = field("companyName");
  const estimator = field("estimatorName");
  const quoteNumber = field("quoteNumber");
  const quoteDate = field("quoteDate");
  const quoteTotal = field("quoteTotal");
  const logo = resolvedTheme.logoUrl || linkedFields.logoUrl?.value || "";
  const whyStats = [
    { value: "250+", label: "Homes Completed" },
    { value: "18+", label: "Years Experience" },
    { value: "98%", label: "Client Happiness" },
    { value: "96%", label: "On-Time Delivery" },
    { value: "24/7", label: "Client Portal Access" },
    { value: "4.9/5", label: "Average Rating" },
  ];
  const projectSummaryRows = [
    { icon: "TYPE", label: "Construction type", value: field("constructionType") },
    { icon: "LEVELS", label: "Storeys", value: field("storeys") },
    { icon: "FACADE", label: "Facade", value: field("facade") },
    { icon: "ROOF", label: "Roof type", value: field("roofType") },
    { icon: "ENG.", label: "Engineering", value: field("engineering") },
    { icon: "START", label: "Estimated start", value: field("estimatedStart") },
  ];
  const expectedBuildDurationRow = { icon: "TIME", label: "Expected Build Duration", value: field("estimatedDuration") };
  const detailRows = [
    { icon: "PROJECT", label: "Project", value: projectName },
    { icon: "CLIENT", label: "Client", value: clientName },
    { icon: "SITE", label: "Site address", value: projectAddress },
    { icon: "BUILDER", label: "Builder", value: builderName, detail: "Licence No: 123456" },
    { icon: "EST.", label: "Prepared by", value: estimator },
    { icon: "QUOTE", label: "Quote number", value: quoteNumber },
    { icon: "DATE", label: "Quote date", value: quoteDate },
    ...projectSummaryRows,
    pageType === "estimateSummary" ? expectedBuildDurationRow : { icon: "TIME", label: "Estimated duration", value: field("estimatedDuration") },
  ];
  const visibleProjectInfoRows = detailRows.filter((item) => hasProjectInfoValue(item.value));
  const pricingGroups = (linkedFields.pricingGroups?.value || []).slice(0, 7);
  const inclusionPackage = linkedFields.standardInclusionsPackage?.value || linkedFields.estimateInclusionsPackage?.value || selectedEstimateInclusionsPackage();
  const pricedUsing = inclusionPackage?.package?.name || "Mid Range Standard Inclusions";
  const showProgressDiagnostics = process.env.NODE_ENV !== "production";
  const common = { resolvedTheme, accent, logo, builderName };

  if (pageType === "cover") {
    return <CoverPage {...common} projectName={projectName} clientName={clientName} projectAddress={projectAddress} quoteNumber={quoteNumber} quoteDate={quoteDate} />;
  }

  if (pageType === "estimateSummary" || pageType === "projectInfo") {
    return <EstimateSummaryPage {...common} pageType={pageType} visibleProjectInfoRows={visibleProjectInfoRows} />;
  }

  if (pageType === "about") {
    return <AboutGoodBuildPage {...common} whyStats={whyStats} />;
  }

  if (pageType === "standardInclusions" || pageType === "inclusions") {
    return <StandardInclusionsPage {...common} pricedUsing={pricedUsing} inclusionPackage={inclusionPackage} Brochure={Brochure} />;
  }

  if (pageType === "pricing") {
    return <PricingPage {...common} quoteTotal={quoteTotal} pricingGroups={pricingGroups} showProgressDiagnostics={showProgressDiagnostics} ProgressDiagnostic={ProgressDiagnostic} />;
  }

  if (pageType === "termsNotes") {
    return <TermsNotesPage {...common} linkedFields={linkedFields} />;
  }

  if (pageType === "acceptance") {
    return <AcceptancePage {...common} />;
  }

  return <ThankYouPage {...common} />;
}
