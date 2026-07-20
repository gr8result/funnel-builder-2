import { selectedEstimateInclusionsPackage } from "../../../lib/builders/estimateInclusions";
import { defaultLuxuryProposalTheme, hasProjectInfoValue } from "./theme";
import AcceptancePage from "./pages/AcceptancePage.tsx";
import AboutBuilderPage from "./pages/AboutBuilderPage";
import CoverPage from "./pages/CoverPage.tsx";
import EstimateSummaryPage from "./pages/EstimateSummaryPage.tsx";
import PricedPlansPage from "./pages/PricedPlansPage";
import PricingSummaryPage from "./pages/PricingSummaryPage";
import StandardInclusionsPage from "./pages/StandardInclusionsPage.tsx";
import ImportantEstimateNoticePage from "./pages/ImportantEstimateNoticePage";
import { projectEstimateContentFromBlocks } from "./ProjectEstimateRegistry";
import { styles } from "./ProjectEstimateShared";

export default function ProjectEstimatePackPage({ page, theme, linkedFields, Brochure, editing = false, selectedBlockId = "", editingBlockId = "", onSelectBlock, onEditBlock, onTextCommit, onStartDrag, onReplaceImage, hiddenBlockIds = [] }) {
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
  const blockById = Object.fromEntries((Array.isArray(page?.blocks) ? page.blocks : []).map((block) => [block.id, block]));
  const editorBridge = { editMode: editing, selectedBlockId, editingBlockId, onSelectBlock, onEditBlock, onTextCommit, onStartDrag, onReplaceImage, blockById };
  const common = { resolvedTheme, accent, logo, builderName };
  const wrap = (node) => node;

  if (pageType === "cover") {
    return wrap(<CoverPage {...common} content={content} projectName={projectName} clientName={clientName} projectAddress={projectAddress} quoteNumber={quoteNumber} quoteDate={quoteDate} hiddenBlockIds={hiddenBlockIds} editorBridge={editorBridge} />);
  }

  if (pageType === "estimateSummary" || pageType === "projectInfo") {
    return wrap(<EstimateSummaryPage {...common} content={content} pageType={pageType} visibleProjectInfoRows={visibleProjectInfoRows} editorBridge={editorBridge} />);
  }

  if (pageType === "about") {
    return wrap(<AboutBuilderPage {...common} content={content} whyStats={whyStats} editorBridge={editorBridge} />);
  }

  if (pageType === "standardInclusions" || pageType === "inclusions") {
    return wrap(<StandardInclusionsPage {...common} content={content} pricedUsing={pricedUsing} inclusionPackage={inclusionPackage} Brochure={Brochure} />);
  }

  if (pageType === "pricing") {
    return wrap(<PricingSummaryPage {...common} content={content} quoteTotal={quoteTotal} pricingGroups={pricingGroups} editorBridge={editorBridge} />);
  }

  if (pageType === "pricedPlans") {
    return wrap(<PricedPlansPage {...common} content={content} />);
  }

  if (pageType === "termsNotes") {
    return wrap(<ImportantEstimateNoticePage {...common} content={content} linkedFields={linkedFields} editorBridge={editorBridge} />);
  }

  if (pageType === "acceptance") {
    return wrap(<AcceptancePage {...common} content={content} editorBridge={editorBridge} />);
  }

  if (page?.source === "builder-created") {
    return wrap(<section className="proposal-builder-page" style={{ ...styles.luxuryPage, background: page.design?.backgroundColor || "#ffffff" }} />);
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn("[Project Estimate] skipped unknown page type", { pageType, pageId: page?.id || "" });
  }
  return null;
}
