import { createPremierInclusionsWorkingCopy } from "./masterTemplate.js";

export const STANDARD_TIER_SETTINGS = Object.freeze({
  Classic: { priceLevel: "budget", label: "Entry-level", accent: "#27614a", cover: "/assets/builders/standard-inclusions-hero.jpg" },
  Premier: { priceLevel: "mid-range", label: "Mid-range", accent: "#a6782d", cover: "/assets/builders/standard-inclusions-premier-kitchen.webp" },
  Premium: { priceLevel: "high-end", label: "High-end", accent: "#754452", cover: "/assets/builders/standard-inclusions-premier-living.jpg" },
});

const COMMON_SOURCE_REQUIREMENTS = [
  ["Design & Services", "Approvals, certification and supervision", "p5-text-30", "general-construction"],
  ["Siteworks & Foundations", "Site preparation, slab and termite protection", "p5-text-16", "foundations"],
  ["Structural & External", "Framing, roof structure and insulation", "p5-text-18", "structural"],
  ["Driveway", "Driveway and paths", "p5-text-20", "driveway-specification"],
  ["Kitchen", "Cabinet construction and splashback requirements", "p6-text-2", "kitchen-specification"],
  ["Bathroom, Ensuite Laundry & WC", "Wet-area construction and fixtures", "p9-text-4", "wet-area-specification"],
  ["Electrical", "Power, communications and safety requirements", "p9-text-6", "electrical-specification"],
  ["Windows & Doors", "Openings, screens and door requirements", "p9-text-8", "openings-specification"],
  ["Robes & Linen Cupboards", "Storage and shelving", "p9-text-10", "storage-specification"],
  ["Internal Finishes", "Linings, trims and insulation", "p10-text-1", "internal-construction"],
  ["Plumbing & Drainage", "Service connections and pipework", "p10-text-3", "plumbing-specification"],
  ["Roofing", "Roofing and roofline requirements", "p10-text-5", "roofing-specification"],
  ["Painting", "Painting system", "p10-text-7", "painting-specification"],
  ["Flooring", "Floor finishes and nominated rooms", "p10-text-10", "flooring-specification"],
];

export function commonConstructionReviewItems() {
  const document = createPremierInclusionsWorkingCopy();
  const objects = new Map(document.pages.flatMap(page => page.objects.map(object => [object.id, object])));
  return COMMON_SOURCE_REQUIREMENTS.map(([category, requirementTitle, sourceId, requirementKey]) => {
    const referenceSpecification = objects.get(sourceId)?.data?.text || "";
    let specification = referenceSpecification;
    if (sourceId === "p6-text-2") specification = referenceSpecification.slice(referenceSpecification.indexOf("CUPBOARDS"));
    if (sourceId === "p9-text-4") specification = referenceSpecification.split("\n").filter(line => /recessed and tiled|shower niche/i.test(line)).join("\n");
    if (sourceId === "p9-text-8") specification = referenceSpecification.split("\n").filter(line => !/front door|entrance lock|internal doors|garage door/i.test(line)).join("\n");
    if (sourceId === "p10-text-1") specification = referenceSpecification.split("\n").filter(line => !/Gainsborough.*handles/i.test(line)).join("\n");
    return {
      id: `construction:${requirementKey}`, category, requirementTitle, requirementKey,
      description: requirementTitle, specification, referenceSpecification, product: null, productRequired: false,
      sourceReference: { templateId: document.metadata.masterTemplateId, objectId: sourceId },
      origin: "construction-requirement", reviewStatus: "needs_review", quantity: "", unit: "", allowanceOverride: "",
      reason: "Reference construction requirement. Confirm applicability to the builder and site before approval.",
    };
  });
}

export function inclusionCanBeApproved(item = {}) {
  if (!String(item.description || item.product?.description || "").trim()) return false;
  if (!String(item.specification || item.product?.specification || item.description || "").trim()) return false;
  if (item.productRequired === false || item.origin === "construction-requirement") return true;
  if (item.product?.productId) return true;
  return item.reviewResolution === "builder_specification" && String(item.specification || "").trim().length > 0;
}

export function approveConstructionSection(draft, category) {
  const items = draft.items.map(item => item.category === category && item.reviewStatus !== "rejected" && inclusionCanBeApproved(item)
    ? { ...item, reviewStatus: "approved" } : item);
  return refreshInclusionReview({ ...draft, status: "Needs Review", items });
}

export function refreshInclusionReview(draft) {
  const unresolved = draft.items.filter(item => item.productRequired !== false && !item.product
    && item.origin !== "construction-requirement" && !["approved", "rejected"].includes(item.reviewStatus));
  return { ...draft, gaps: unresolved.map(item => `${item.category}: ${item.requirementTitle || item.id}`),
    gapDetails: unresolved.map(item => ({ category: item.category, requirementTitle: item.requirementTitle, reason: item.reason })) };
}

export function approvedPremierDefault(schedules = []) {
  const candidates = schedules.filter(schedule => schedule.status !== "archived"
    && /premier/i.test(`${schedule.tierKey || ""} ${schedule.name || ""}`)
    && schedule.metadata?.workflowStatus === "Published" && schedule.currentVersion
    && (schedule.metadata.publishedSnapshots || []).some(snapshot => {
      const required = snapshot.reviewRequirementIds || [];
      return snapshot.versionId === schedule.currentVersion.id && required.length > 0
        && required.every(id => snapshot.items?.some(item => item.id === id && item.reviewStatus === "approved" && inclusionCanBeApproved(item)))
        && commonConstructionReviewItems().every(requirement => snapshot.items?.some(item => item.requirementKey === requirement.requirementKey));
    }));
  const explicit = candidates.filter(schedule => schedule.metadata?.quotationDefault === true);
  if (explicit.length === 1) return explicit[0];
  if (!explicit.length && candidates.length === 1) return candidates[0];
  return null;
}

export function requiredChecklistApproved(draft, requirementIds = []) {
  return requirementIds.every(id => draft.items.some(item => item.id === id && item.reviewStatus === "approved" && inclusionCanBeApproved(item)));
}

export function scheduleGenerationBlockReason({ authenticated, workspaceId, schedule, tier, pending = false }) {
  if (pending) return "Generation is in progress. A timeout or error will restore this action.";
  if (!authenticated) return "Sign in to generate the schedule.";
  if (!workspaceId) return "Choose an authorised builder workspace, then retry loading.";
  if (!schedule) return "Load the saved schedule successfully before generating. Use Retry loading.";
  if (["Approved", "Published"].includes(schedule.metadata?.workflowStatus) || schedule.metadata?.publishedSnapshots?.length) return "This schedule has an approved or published version. It is protected from regeneration; create a new working draft from the library.";
  if (!STANDARD_TIER_SETTINGS[tier]) return "Choose Classic, Premier or Premium in Schedule details before generating.";
  return "";
}

export function scheduleApprovalIssues(draft, requirementIds = []) {
  const items = draft.items || [];
  if (!items.length) return ["Generate the complete draft first. There are no inclusion items to approve."];
  const issues = [];
  const missing = requirementIds.filter(id => !items.some(item => item.id === id));
  if (missing.length) issues.push(`${missing.length} required checklist items are missing. Restore them before final approval.`);
  const unresolved = items.filter(item => item.productRequired !== false && !item.product && !inclusionCanBeApproved(item));
  for (const item of unresolved) issues.push(`${item.category} / ${item.requirementTitle || item.id}: choose a compatible catalogue product, or enter a verified specification and explicitly confirm it without inventing a price.`);
  const pending = items.filter(item => item.reviewStatus !== "approved" && !unresolved.includes(item));
  if (pending.length) issues.push(`${pending.length} items still need approval or replacement. Use Approve section for suitable items; rejected required items must be changed and approved.`);
  return issues;
}

export function mergeScheduleBranding(saved = {}, canonical = {}) {
  return { ...saved, ...Object.fromEntries(Object.entries(canonical).filter(([, value]) => value !== null && value !== undefined && (typeof value !== "string" || value.trim() !== ""))) };
}