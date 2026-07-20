import { defaultProjectEstimateBlocks, projectEstimatePageDefinitionFor } from "../ProjectEstimateRegistry";

export type ProjectEstimateObjectType =
  | "text"
  | "richText"
  | "image"
  | "logo"
  | "shape"
  | "divider"
  | "linkedField"
  | "container"
  | "group";

export type ProjectEstimateObject = {
  id: string;
  pageId: string;
  type: ProjectEstimateObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  hidden: boolean;
  content?: string;
  richText?: unknown;
  style: Record<string, unknown>;
  assetReference?: string;
  linkedField?: string;
  sourceBlock?: any;
};

export const PROJECT_ESTIMATE_PAGE_WIDTH = 794;
export const PROJECT_ESTIMATE_PAGE_HEIGHT = 1123;

const APPROVED_FRAMES: Record<string, { x: number; y: number; width: number; height: number }> = {
  "cover-hero-image": { x: 0, y: 0, width: 794, height: 1123 },
  "cover-document-label": { x: 74, y: 294, width: 520, height: 56 },
  "cover-title": { x: 74, y: 350, width: 590, height: 112 },
  "cover-client-site": { x: 74, y: 500, width: 450, height: 92 },
  "cover-intro": { x: 74, y: 610, width: 500, height: 92 },
  "cover-estimate-number": { x: 74, y: 1028, width: 220, height: 44 },
  "cover-estimate-date": { x: 520, y: 1028, width: 210, height: 44 },
  "estimateSummary-eyebrow": { x: 74, y: 214, width: 360, height: 32 },
  "estimateSummary-heading": { x: 74, y: 256, width: 610, height: 92 },
  "estimateSummary-intro": { x: 74, y: 365, width: 560, height: 86 },
  "estimateSummary-notice-heading": { x: 94, y: 830, width: 520, height: 42 },
  "estimateSummary-notice-body": { x: 94, y: 880, width: 610, height: 150 },
  "about-heading": { x: 40, y: 128, width: 330, height: 78 },
  "about-about-copy": { x: 40, y: 218, width: 330, height: 130 },
  "about-hero-image": { x: 405, y: 128, width: 315, height: 252 },
  "about-detail-image": { x: 540, y: 260, width: 170, height: 118 },
  "about-eyebrow": { x: 40, y: 425, width: 300, height: 28 },
  "about-proof-points": { x: 40, y: 462, width: 455, height: 58 },
  "pricing-eyebrow": { x: 74, y: 184, width: 420, height: 32 },
  "pricing-intro": { x: 120, y: 365, width: 560, height: 72 },
  "pricing-pricing-summary": { x: 74, y: 475, width: 520, height: 48 },
};

export function approvedFrameForBlock(block: any = {}) {
  const known = APPROVED_FRAMES[String(block.id || "")];
  if (known) return { ...known };
  const order = Number(block.order || 0);
  if (block.type === "logo") return { x: 54, y: 48, width: 180, height: 90 };
  if (block.type === "image") return { x: 112, y: 238, width: 570, height: 320 };
  if (block.type === "divider") return { x: 74, y: 470 + order * 12, width: 210, height: 14 };
  if (block.type === "spacer") return { x: 74, y: 170 + order * 78, width: 300, height: Number(block.design?.height || 32) };
  return { x: 74, y: 150 + order * 118, width: block.type === "heading" ? 610 : 560, height: block.type === "heading" ? 92 : 86 };
}

export function objectFrame(block: any = {}) {
  const fallback = approvedFrameForBlock(block);
  const frame = block.design?.frame || {};
  return {
    x: clamp(Number(frame.x ?? fallback.x), 0, PROJECT_ESTIMATE_PAGE_WIDTH - 24),
    y: clamp(Number(frame.y ?? fallback.y), 0, PROJECT_ESTIMATE_PAGE_HEIGHT - 24),
    width: clamp(Number(frame.width ?? fallback.width), 24, PROJECT_ESTIMATE_PAGE_WIDTH),
    height: clamp(Number(frame.height ?? fallback.height), 18, PROJECT_ESTIMATE_PAGE_HEIGHT),
  };
}

export function pageObjectsFromBlocks(page: any = {}) {
  const pageId = page.page_type || page.id || "";
  const definition = projectEstimatePageDefinitionFor(pageId);
  const approvedIds = new Set((definition?.defaultBlocks || []).map((block: any) => block.id));
  if (pageId === "cover") approvedIds.add("cover-hero-image");
  return (page.blocks || [])
    .filter((block: any) => isRenderableProjectEstimateBlock(block, pageId, approvedIds))
    .map((block: any): ProjectEstimateObject => {
      const frame = objectFrame(block);
      return {
        id: block.id,
        pageId,
        type: mapBlockType(block.type),
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        rotation: Number(block.design?.rotation || 0),
        zIndex: Number(block.design?.zIndex || block.order || 0),
        locked: block.design?.locked === true,
        hidden: block.design?.hidden === true,
        content: block.content?.text || block.content?.heading || block.content?.label || "",
        richText: block.content?.richText || null,
        style: { ...(block.design || {}) },
        assetReference: block.content?.imageUrl || block.content?.logoUrl || "",
        linkedField: block.content?.fieldKey || "",
        sourceBlock: block,
      };
    });
}

export function ensurePageHasApprovedObjects(page: any = {}) {
  const pageId = page.page_type || page.id || "";
  const definition = projectEstimatePageDefinitionFor(pageId);
  if (!definition) return page;
  const current = Array.isArray(page.blocks) ? page.blocks : [];
  const byId = new Map(current.map((block: any) => [block.id, block]));
  const approved = defaultProjectEstimateBlocks(pageId).map((block: any) => byId.get(block.id) || block);
  const custom = current.filter((block: any) => !definition.defaultBlocks.some((item: any) => item.id === block.id) && isSubscriberCreatedBlock(block, pageId));
  return { ...page, blocks: [...approved, ...custom] };
}

export function isSubscriberCreatedBlock(block: any = {}, pageId = "") {
  if (!block?.id) return false;
  if (block.source === "builder-created" || block.source === "subscriber") return true;
  if (block.pageType && block.pageType !== pageId) return false;
  if (block.pageId && block.pageId !== pageId) return false;
  return String(block.id).startsWith("proposal-") || String(block.id).startsWith("block-");
}

export function isRenderableProjectEstimateBlock(block: any = {}, pageId = "", approvedIds = new Set<string>()) {
  if (!block?.id || block.design?.hidden === true) return false;
  if (block.design?.opacity === 0 || block.design?.opacity === "0") return false;
  const frame = objectFrame(block);
  if (frame.width <= 0 || frame.height <= 0) return false;
  if (isDiagnosticBlock(block)) return false;
  if (approvedIds.has(block.id)) return true;
  return isSubscriberCreatedBlock(block, pageId);
}

export function isDiagnosticBlock(block: any = {}) {
  const haystack = [
    block.id,
    block.type,
    block.content?.text,
    block.content?.heading,
    block.content?.editorLabel,
    block.content?.label,
  ].map((value) => String(value || "").toLowerCase()).join(" ");
  return haystack.includes("progress payment source diagnostics")
    || haystack.includes("diagnostic")
    || haystack.includes("legacy quote")
    || haystack.includes("phantom");
}

function mapBlockType(type = ""): ProjectEstimateObjectType {
  if (type === "heading") return "richText";
  if (type === "quote_field") return "linkedField";
  if (type === "pricing_summary") return "richText";
  if (type === "logo") return "logo";
  if (type === "image") return "image";
  if (type === "divider") return "divider";
  if (type === "shape" || type === "spacer") return "shape";
  if (type === "container") return "container";
  return "text";
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
