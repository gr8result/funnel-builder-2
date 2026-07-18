import {
  APPROVED_PROJECT_ESTIMATE_SCHEMA_VERSION,
  APPROVED_PROJECT_ESTIMATE_TEMPLATE_ID,
  APPROVED_PROJECT_ESTIMATE_TEMPLATE_STATUS,
  APPROVED_PROJECT_ESTIMATE_TEMPLATE_VERSION,
  PROJECT_ESTIMATE_EXPORT_ORDER,
  PROJECT_ESTIMATE_PAGES,
} from "./ProjectEstimateRegistry";

export const approvedProjectEstimateTemplateSnapshot = {
  template: APPROVED_PROJECT_ESTIMATE_TEMPLATE_STATUS,
  schemaVersion: APPROVED_PROJECT_ESTIMATE_SCHEMA_VERSION,
  templateVersion: APPROVED_PROJECT_ESTIMATE_TEMPLATE_VERSION,
  pageRegistry: PROJECT_ESTIMATE_PAGES.map((page) => ({
    id: page.id,
    navigationTitle: page.navigationTitle,
    version: page.version,
    defaultContent: page.defaultContent,
    defaultBlocks: page.defaultBlocks,
    editorFields: page.editorFields,
  })),
  pageOrder: PROJECT_ESTIMATE_PAGES.map((page) => page.id),
  pdfAssemblyOrder: PROJECT_ESTIMATE_EXPORT_ORDER,
  importedDocumentSlots: [
    { slotId: "inclusions", placeholderPageId: "standardInclusions", replacesPlaceholderWhenAttached: true },
    { slotId: "plans", placeholderPageId: "pricedPlans", replacesPlaceholderWhenAttached: true },
  ],
  placeholderReplacementRules: {
    inclusions: "Use the uploaded inclusions PDF in the Standard Inclusions Schedule slot; render the placeholder only when no active PDF exists.",
    plans: "Use the uploaded plans PDF in the Plans slot; render the placeholder only when no active PDF exists.",
  },
  protection: {
    id: APPROVED_PROJECT_ESTIMATE_TEMPLATE_ID,
    protected: true,
    jobsMayStoreOverridesOnly: true,
    oldJobsMustNotReplaceMasterDefinitions: true,
  },
} as const;

export default approvedProjectEstimateTemplateSnapshot;
