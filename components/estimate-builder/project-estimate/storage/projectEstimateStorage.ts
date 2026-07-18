import {
  PROJECT_ESTIMATE_TEMPLATE_ID,
  PROJECT_ESTIMATE_TEMPLATE_VERSION,
  PROJECT_ESTIMATE_PAGES,
  defaultProjectEstimateContent,
} from "../ProjectEstimateRegistry";

export function createProjectEstimateDocumentOverrides(saved: any = {}) {
  return {
    templateId: saved.templateId || PROJECT_ESTIMATE_TEMPLATE_ID,
    templateVersion: PROJECT_ESTIMATE_TEMPLATE_VERSION,
    pageOverrides: saved.pageOverrides && typeof saved.pageOverrides === "object" ? saved.pageOverrides : {},
  };
}

export function migrateProjectEstimateSavedPagesToOverrides(savedBuilder: any = {}) {
  const overrides: Record<string, any> = {};
  for (const page of savedBuilder.pages || []) {
    const pageId = page.page_type || page.id;
    if (!PROJECT_ESTIMATE_PAGES.some((definition) => definition.id === pageId)) continue;
    const defaults = defaultProjectEstimateContent(pageId);
    const pageOverrides: Record<string, any> = {};
    for (const block of page.blocks || []) {
      const content = block.content || {};
      if (typeof content.text === "string") pageOverrides[block.id] = content.text;
      if (typeof content.heading === "string") pageOverrides[block.id] = content.heading;
    }
    overrides[pageId] = { ...defaults, ...pageOverrides };
  }
  return createProjectEstimateDocumentOverrides({ pageOverrides: overrides });
}
