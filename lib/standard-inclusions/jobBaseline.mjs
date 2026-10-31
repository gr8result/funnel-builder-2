// Turns ONE published Standard Inclusions version into the job's inclusion baseline.
//
// The reusable schedule (builder library) and a job's applied baseline are different things:
// this module only reads the published, immutable version snapshot and produces the existing
// `jobInclusionSnapshot` shape ({ schedule, items }) that both the Quotation
// (applyInclusionScheduleToQuote) and Client Selections (tenantSelectionQuotation,
// cabinetry inclusionRooms) already consume. It never edits the master schedule, never sets
// quantities (rows keep their Job Setup / takeoff quantities) and never marks a baseline product
// as a client selection (the engine records it as INCLUDED).
import { applyInclusionScheduleToQuote } from "../builders/selectionQuoteEngine.js";
import { classifyProductRequirements } from "../builders/selectionRequirementTaxonomy.js";
import { SELECTION_SLOTS, SELECTION_SLOT_IDS } from "../builders/selectionRegistry.js";

export const STANDARD_INCLUSIONS_BASELINE_SOURCE = "standard-inclusions";
export const JOB_APPLICATION_STATUS = Object.freeze({ NEW: "NEW", ALREADY_APPLIED: "ALREADY_APPLIED", CONFLICT: "CONFLICT" });
export { SELECTION_SLOTS };

const amount = (value) => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const exGst = (value, gstIncluded) => value === null ? null : gstIncluded === true ? Math.round((value / 1.1 + Number.EPSILON) * 100) / 100 : value;

// A product only gets a quotation slot when its own catalogue facts point at exactly one.
// Anything ambiguous stays unassigned for the builder to choose in review.
export function suggestSelectionSlot(product) {
  if (!product) return "";
  const explicit = (product.selectionSlotIds || []).filter((slot) => SELECTION_SLOT_IDS.includes(slot));
  if (explicit.length === 1) return explicit[0];
  const classified = classifyProductRequirements({
    productName: product.name || product.productName,
    category: product.category,
    productType: product.productType,
    selectionSlotIds: product.selectionSlotIds,
  });
  const slots = classified.selectionSlotIds.filter((slot) => SELECTION_SLOT_IDS.includes(slot));
  return slots.length === 1 ? slots[0] : "";
}

export function publishedVersionSnapshot(schedule, versionId = "") {
  const version = versionId ? (schedule?.versions || []).find((item) => item.id === versionId) : schedule?.currentVersion;
  if (!version) return { version: null, snapshot: null };
  // Exact match only: a snapshot from another version must never stand in for this PDF.
  const snapshot = [...(schedule?.metadata?.publishedSnapshots || [])].reverse().find((item) => item.versionId === version.id) || null;
  return { version, snapshot };
}

export function buildJobInclusionSnapshot({ workspaceId, schedule, versionId = "" }) {
  if (!workspaceId) throw new Error("A builder workspace is required.");
  const { version, snapshot } = publishedVersionSnapshot(schedule, versionId);
  if (!version) throw Object.assign(new Error("This schedule has no published version."), { code: "NO_PUBLISHED_VERSION" });
  if (!snapshot) throw Object.assign(new Error(`Version ${version.versionNumber} has no approved inclusion snapshot. Publish it from the brochure editor before applying it to a job.`), { code: "SNAPSHOT_MISSING" });
  const scheduleRecord = {
    id: schedule.id,
    workspace_id: workspaceId,
    name: schedule.name,
    display_name: `${schedule.name} v${version.versionNumber}`,
    version: version.versionNumber,
    scheduleVersionId: version.id,
    tierKey: schedule.tierKey || "",
    source: STANDARD_INCLUSIONS_BASELINE_SOURCE,
    publishedAt: snapshot.publishedAt || "",
  };
  const items = [];
  const descriptiveItems = [];
  for (const item of snapshot.items || []) {
    if (item.reviewStatus && item.reviewStatus !== "approved") continue;
    const product = item.product || null;
    const reviewedUnitPrice = item.includedPriceBasis === "catalogue_unit_price" && typeof product?.gstIncluded === "boolean" ? amount(item.includedUnitPrice) : null;
    const allowance = amount(item.allowanceOverride) ?? amount(item.allowance) ?? amount(product?.allowance) ?? reviewedUnitPrice;
    const gstIncluded = typeof product?.gstIncluded === "boolean" ? product.gstIncluded : null;
    const slot = SELECTION_SLOT_IDS.includes(item.selectionSlotId) ? item.selectionSlotId : suggestSelectionSlot(product);
    const base = {
      id: `${schedule.id}:${version.id}:${item.id}`,
      workspace_id: workspaceId,
      inclusion_schedule_id: schedule.id,
      location_id: null,
      metadata: {
        standardInclusionsItemId: item.id,
        category: item.category || "",
        description: item.description || product?.description || "",
        specification: item.specification || product?.specification || "",
        requirementKey: item.requirementKey || "",
        productName: product?.name || null,
        productSnapshot: product,
        quantity: amount(item.quantity),
        unit: String(item.unit || product?.unit || ""),
        allowanceBasis: item.allowanceOverride !== "" && item.allowanceOverride != null ? "builder_schedule_override" : allowance === null ? "unpriced" : reviewedUnitPrice !== null && product?.allowance == null ? "reviewed_catalogue_unit_price" : "product_library_base_allowance",
        origin: item.origin || "",
      },
    };
    if (!product || !slot) {
      // Descriptive inclusions, services and unslotted products are part of the baseline record
      // but have no quotation row to price, so they are kept apart from `items`.
      descriptiveItems.push({ ...base, selection_slot_id: slot || null, reason: !product ? "DESCRIPTIVE" : "NO_SELECTION_SLOT" });
      continue;
    }
    items.push({
      ...base,
      selection_slot_id: slot,
      default_product_id: product.productId,
      baselineProductId: product.productId,
      baselineProductName: product.name || product.productId,
      baselineUnitPrice: exGst(allowance, gstIncluded),
      baselinePriceIncludesGst: allowance === null ? null : gstIncluded === true ? false : gstIncluded,
      baselineProductSource: allowance === null ? "PRODUCT_LIBRARY" : "INCLUSION_ALLOWANCE",
      allowance: allowance === null ? null : { amount: allowance, gstIncluded },
    });
  }
  return { schedule: scheduleRecord, items, descriptiveItems };
}

function existingBaseline(workbook = {}) {
  const value = workbook.jobInclusionSnapshot?.jobInclusionSnapshot || workbook.jobInclusionSnapshot;
  return value && (value.items?.length || value.schedule) ? value : null;
}

// Preview shown before anything is written: same version (no-op), a different baseline
// (conflict listing each slot that would change), or a new baseline.
export function planJobInclusionApplication(workbook = {}, snapshot) {
  const existing = existingBaseline(workbook);
  const slotted = snapshot.items.map((item) => ({ selectionSlotId: item.selection_slot_id, productName: item.baselineProductName, unitPrice: item.baselineUnitPrice, category: item.metadata.category }));
  const summary = { items: slotted, descriptiveCount: snapshot.descriptiveItems?.length || 0, unslotted: (snapshot.descriptiveItems || []).filter((item) => item.reason === "NO_SELECTION_SLOT").map((item) => item.metadata.productName) };
  if (!existing) return { status: JOB_APPLICATION_STATUS.NEW, ...summary, changes: [] };
  const same = existing.schedule?.source === STANDARD_INCLUSIONS_BASELINE_SOURCE
    && existing.schedule?.id === snapshot.schedule.id
    && existing.schedule?.scheduleVersionId === snapshot.schedule.scheduleVersionId;
  if (same) return { status: JOB_APPLICATION_STATUS.ALREADY_APPLIED, existing: existing.schedule, ...summary, changes: [] };
  const before = new Map((existing.items || []).map((item) => [item.selection_slot_id || item.selectionSlotId, item]));
  const changes = snapshot.items.flatMap((item) => {
    const prior = before.get(item.selection_slot_id);
    const priorName = prior?.baselineProductName || prior?.metadata?.productName || null;
    return !prior || priorName !== item.baselineProductName || amount(prior.baselineUnitPrice) !== item.baselineUnitPrice
      ? [{ selectionSlotId: item.selection_slot_id, from: priorName, to: item.baselineProductName, fromPrice: amount(prior?.baselineUnitPrice), toPrice: item.baselineUnitPrice }]
      : [];
  });
  return { status: JOB_APPLICATION_STATUS.CONFLICT, existing: existing.schedule || null, ...summary, changes };
}

// Applies through the existing engine. Re-applying the same version returns the workbook
// unchanged; a different existing baseline is never replaced here (the caller shows the plan).
export function applyStandardInclusionsToWorkbook(workbook, snapshot, foundation) {
  const plan = planJobInclusionApplication(workbook, snapshot);
  if (plan.status === JOB_APPLICATION_STATUS.ALREADY_APPLIED) return { workbook, plan, applied: false };
  if (plan.status === JOB_APPLICATION_STATUS.CONFLICT) {
    throw Object.assign(new Error("This job already has a different inclusion baseline. Nothing was changed."), { code: "BASELINE_CONFLICT", plan });
  }
  const next = applyConstructionBaselineSpecifications(applyInclusionScheduleToQuote(workbook, snapshot, foundation), snapshot);
  return { workbook: next, plan, applied: true };
}

export function applyConstructionBaselineSpecifications(workbook, snapshot) {
  const quotation = { ...(workbook.quotation || {}) };
  const report = [];
  for (const inclusion of snapshot.descriptiveItems || []) {
    const requirementKey = inclusion.metadata?.requirementKey;
    if (!requirementKey) continue;
    const matches = Object.entries(quotation).flatMap(([section, group]) => (group.rows || [])
      .filter(row => row.requirementKey === requirementKey || row.standardInclusionRequirementKey === requirementKey)
      .map(row => ({ section, row })));
    if (matches.length !== 1) {
      report.push({ requirementKey, status: matches.length ? "CONFLICT" : "UNMAPPED", reason: "Construction specification requires one stable quotation requirement target." });
      continue;
    }
    const { section, row } = matches[0];
    const protectedValue = row.manualOverride || row.manualRate || row.priceLocked || row.approved === true
      || ["MANUAL_OVERRIDE", "CLIENT_SELECTION"].includes(row.selectionSource);
    if (protectedValue) { report.push({ requirementKey, status: "PRESERVED" }); continue; }
    quotation[section] = { ...quotation[section], rows: quotation[section].rows.map(candidate => candidate.id === row.id ? {
      ...candidate, inclusionSpecification: inclusion.metadata.specification || inclusion.metadata.description,
      standardInclusionRequirementKey: requirementKey, standardInclusionItemId: inclusion.id,
    } : candidate) };
    report.push({ requirementKey, status: "MAPPED" });
  }
  return { ...workbook, quotation, constructionInclusionMappingReport: report };
}
