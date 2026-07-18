import { PROJECT_ESTIMATE_PAGE_KEYS, PROJECT_ESTIMATE_TEMPLATE_VERSION } from "../ProjectEstimateRegistry";

export function normaliseProjectEstimatePageOrder(savedPages: any[] = []) {
  return PROJECT_ESTIMATE_PAGE_KEYS.map((pageId) => savedPages.find((page) => page.page_type === pageId || page.id === pageId)).filter(Boolean);
}

export function projectEstimateTemplateVersion() {
  return PROJECT_ESTIMATE_TEMPLATE_VERSION;
}
