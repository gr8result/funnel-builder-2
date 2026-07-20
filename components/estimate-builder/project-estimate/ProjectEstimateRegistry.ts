import { acceptancePageDefinition } from "./pages/AcceptancePage";
import { aboutBuilderPageDefinition } from "./pages/AboutBuilderPage";
import { coverPageDefinition } from "./pages/CoverPage";
import { estimateSummaryPageDefinition } from "./pages/EstimateSummaryPage";
import { importantEstimateNoticePageDefinition } from "./pages/ImportantEstimateNoticePage";
import { pricedPlansPageDefinition } from "./pages/PricedPlansPage";
import { pricingSummaryPageDefinition } from "./pages/PricingSummaryPage";
import { standardInclusionsPageDefinition } from "./pages/StandardInclusionsPage";
import type { ProjectEstimatePageDefinition } from "./ProjectEstimateTypes";

export const APPROVED_PROJECT_ESTIMATE_TEMPLATE_ID = "approved-project-estimate";
export const APPROVED_PROJECT_ESTIMATE_SCHEMA_VERSION = 1;
export const APPROVED_PROJECT_ESTIMATE_TEMPLATE_VERSION = 1;

export const PROJECT_ESTIMATE_TEMPLATE_ID = APPROVED_PROJECT_ESTIMATE_TEMPLATE_ID;
export const PROJECT_ESTIMATE_TEMPLATE_VERSION = APPROVED_PROJECT_ESTIMATE_TEMPLATE_VERSION;

export const APPROVED_PROJECT_ESTIMATE_TEMPLATE_STATUS = {
  id: APPROVED_PROJECT_ESTIMATE_TEMPLATE_ID,
  version: APPROVED_PROJECT_ESTIMATE_TEMPLATE_VERSION,
  schemaVersion: APPROVED_PROJECT_ESTIMATE_SCHEMA_VERSION,
  status: "approved",
  protected: true,
} as const;

export const PROJECT_ESTIMATE_PAGES: ProjectEstimatePageDefinition[] = [
  coverPageDefinition,
  estimateSummaryPageDefinition,
  aboutBuilderPageDefinition,
  standardInclusionsPageDefinition,
  pricedPlansPageDefinition,
  pricingSummaryPageDefinition,
  importantEstimateNoticePageDefinition,
  acceptancePageDefinition,
];

export const PROJECT_ESTIMATE_PAGE_KEYS = PROJECT_ESTIMATE_PAGES.map((page) => page.id);

export const PROJECT_ESTIMATE_EXPORT_ORDER = [
  { type: "page", pageId: "cover" },
  { type: "page", pageId: "estimateSummary" },
  { type: "page", pageId: "about" },
  { type: "documentSlot", slotId: "inclusions", placeholderPageId: "standardInclusions" },
  { type: "documentSlot", slotId: "plans", placeholderPageId: "pricedPlans" },
  { type: "page", pageId: "pricing" },
  { type: "page", pageId: "termsNotes" },
  { type: "page", pageId: "acceptance" },
] as const;

export function projectEstimatePageDefinitionFor(pageId = "") {
  return PROJECT_ESTIMATE_PAGES.find((page) => page.id === pageId) || null;
}

export function projectEstimateNavigationPages() {
  return PROJECT_ESTIMATE_PAGES.map((page) => ({ key: page.id, label: page.navigationTitle }));
}

export function defaultProjectEstimateBlocks(pageId: string) {
  const definition = projectEstimatePageDefinitionFor(pageId);
  return (definition?.defaultBlocks || []).map((block) => ({
    ...block,
    content: { ...(block.content || {}) },
    design: { ...(block.design || {}) },
  }));
}

export function defaultProjectEstimateContent(pageId: string) {
  return { ...(projectEstimatePageDefinitionFor(pageId)?.defaultContent || {}) };
}

export function projectEstimateContentFromBlocks(page: any = {}) {
  const pageId = page?.page_type || page?.id || "";
  const definition = projectEstimatePageDefinitionFor(pageId);
  if (!definition) return {};
  const content = { ...(definition.defaultContent || {}) };
  const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
  definition.editorFields.forEach((field) => {
    const block = blocks.find((item) => item?.id === field.blockId);
    if (!block) return;
    const contentKey = field.contentKey || projectEstimateContentKeyForBlock(definition, block);
    if (!contentKey) return;
    const value = projectEstimateEditableValue(block);
    if (value !== undefined) content[contentKey] = value;
  });
  return content;
}

function projectEstimateEditableValue(block: any = {}) {
  if (Object.prototype.hasOwnProperty.call(block.content || {}, "text")) return block.content.text;
  if (Object.prototype.hasOwnProperty.call(block.content || {}, "heading")) return block.content.heading;
  if (Object.prototype.hasOwnProperty.call(block.content || {}, "label")) return block.content.label;
  return undefined;
}

function projectEstimateContentKeyForBlock(definition: ProjectEstimatePageDefinition, block: any = {}) {
  const editableValue = projectEstimateEditableValue(block);
  const defaultContent = definition.defaultContent || {};
  const matchingKey = Object.keys(defaultContent).find((key) => defaultContent[key] === editableValue);
  if (matchingKey) return matchingKey;
  const suffix = String(block.id || "").replace(`${definition.id}-`, "");
  const knownKeys: Record<string, string> = {
    "document-label": "documentLabel",
    title: "title",
    "client-site": "clientAndSite",
    intro: "introText",
    eyebrow: "eyebrow",
    heading: "mainHeading",
    "notice-heading": "noticeHeading",
    "notice-body": "noticeBody",
    "about-copy": "aboutText",
    "proof-points": "proofPoints",
    "quote-timing-heading": "quoteTimingHeading",
    "quote-timing-list": "quoteTimingList",
    footer: "footerNotice",
    acknowledgement: "acknowledgementText",
    "priced-using": "pricedUsingLabel",
    "pricing-summary": "pricingHeading",
    "total-line": "totalLine",
  };
  return knownKeys[suffix] || "";
}
