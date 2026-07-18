import { selectedEstimateInclusionsPackage } from "../../../lib/builders/estimateInclusions";
import { defaultLuxuryProposalTheme, hasProjectInfoValue } from "./theme";
import AcceptancePage from "./pages/AcceptancePage";
import AboutBuilderPage from "./pages/AboutBuilderPage";
import CoverPage from "./pages/CoverPage";
import EstimateSummaryPage from "./pages/EstimateSummaryPage";
import PricedPlansPage from "./pages/PricedPlansPage";
import PricingSummaryPage from "./pages/PricingSummaryPage";
import StandardInclusionsPage from "./pages/StandardInclusionsPage";
import ImportantEstimateNoticePage from "./pages/ImportantEstimateNoticePage";
import { projectEstimateContentFromBlocks } from "./ProjectEstimateRegistry";

export default function ProjectEstimatePackPage({ page, theme, linkedFields, Brochure, ProgressDiagnostic, editing = false, selectedBlockId = "", onSelectBlock }) {
  const resolvedTheme = { ...defaultLuxuryProposalTheme({}), ...(theme || {}) };
  const accent = resolvedTheme.accentColor || "#c89d4a";
  const pageType = page.page_type || page.id;
  const content = projectEstimateContentFromBlocks(page);
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
  const wrap = (node) => {
    if (!editing || !onSelectBlock || !Array.isArray(page?.blocks)) return node;
    return (
      <div style={{ position: "relative" }}>
        {node}
        <div style={{
          position: "absolute",
          top: 14,
          left: 14,
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          maxWidth: "calc(100% - 28px)",
          pointerEvents: "auto",
          zIndex: 20,
        }}>
          {page.blocks.map((block) => (
            <button
              key={block.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectBlock(block.id);
              }}
              style={{
                border: selectedBlockId === block.id ? "2px solid #0ea5e9" : "1px solid rgba(15, 23, 42, 0.18)",
                background: selectedBlockId === block.id ? "#e0f2fe" : "rgba(255,255,255,0.92)",
                color: "#0f172a",
                borderRadius: 6,
                padding: "5px 8px",
                fontSize: 11,
                fontWeight: 800,
                boxShadow: "0 8px 20px rgba(15,23,42,0.12)",
              }}
              title={`Select ${block.content?.editorLabel || block.type}`}
            >
              {block.content?.editorLabel || block.type}
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (pageType === "cover") {
    return wrap(<CoverPage {...common} content={content} projectName={projectName} clientName={clientName} projectAddress={projectAddress} quoteNumber={quoteNumber} quoteDate={quoteDate} />);
  }

  if (pageType === "estimateSummary" || pageType === "projectInfo") {
    return wrap(<EstimateSummaryPage {...common} content={content} pageType={pageType} visibleProjectInfoRows={visibleProjectInfoRows} />);
  }

  if (pageType === "about") {
    return wrap(<AboutBuilderPage {...common} content={content} whyStats={whyStats} />);
  }

  if (pageType === "standardInclusions" || pageType === "inclusions") {
    return wrap(<StandardInclusionsPage {...common} content={content} pricedUsing={pricedUsing} inclusionPackage={inclusionPackage} Brochure={Brochure} />);
  }

  if (pageType === "pricing") {
    return wrap(<PricingSummaryPage {...common} content={content} quoteTotal={quoteTotal} pricingGroups={pricingGroups} showProgressDiagnostics={showProgressDiagnostics} ProgressDiagnostic={ProgressDiagnostic} />);
  }

  if (pageType === "pricedPlans") {
    return wrap(<PricedPlansPage {...common} content={content} />);
  }

  if (pageType === "termsNotes") {
    return wrap(<ImportantEstimateNoticePage {...common} content={content} linkedFields={linkedFields} />);
  }

  if (pageType === "acceptance") {
    return wrap(<AcceptancePage {...common} content={content} />);
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn("[Project Estimate] skipped unknown page type", { pageType, pageId: page?.id || "" });
  }
  return null;
}
