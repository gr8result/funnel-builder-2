// Application layer for "Reconcile Selections": runs the existing schedule/product syncs, then the pure target
// resolver, and describes every change before anything is applied. The resolver stays free of these imports.

import { applyCabinetryRequirementsToQuotation } from "../construction-estimation/cabinetryRequirements.js";
import { normalizeQuotationStructure } from "../construction-estimation/quotationStructure.js";
import { connectAllocatedSelectionsToQuotation } from "./allocatedSelectionQuotation.js";
import { connectApplianceSelectionsToQuotation } from "./applianceClientSelectionFlow.js";
import { connectElectricalScheduleToQuotation } from "./electricalSchedule.js";
import { connectEntryDoorFurnitureSchedules } from "./entryDoorFurnitureSelection.js";
import { connectFlooringSelectionsToQuotation } from "./flooringSelection.js";
import { connectExternalLightingToQuotation } from "./externalLightingQuotation.js";
import { linkExteriorPaintToQuotation } from "./exteriorPaintQuotation.js";
import { linkInternalPaintColoursToQuotation } from "./internalPaintColours.js";
import { connectTilingSelectionsToQuotation } from "./tilingRooms.js";
import { bookWithConfirmedFixtureTargets, fixtureQuotationReconciliation } from "./fixtureQuotationReconciliation.js";
import { applyResolvedSelectionTargets, reconcileSelectionTargets, resolvedBaseRate, TARGET_STATUS } from "./quotationTargetResolver.js";
import { plumbingLocationKey } from "./plumbingFixtureAllocation.js";
import { ALLOCATED_SELECTION_SOURCE } from "./selectionSources.js";
import { PRODUCT_SELECTION_OUTCOME, reconcileProductSelections } from "./productSelectionIntegrity.js";

const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const number = (value) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));
const rowKey = (section, row) => String(row.id);

// Same order as the Client Selections save pipeline.
export function runSelectionConnectors(rawWorkbook, book, { productById = () => null, productByCode } = {}) {
  // The app normalises the quotation on load before any connector runs; the same order is required here.
  const workbook = { ...rawWorkbook, quotation: normalizeQuotationStructure(rawWorkbook.quotation, { migrateDerivedRows: false }) };
  const owner = workbook.workspaceId;
  const withCabinetry = applyCabinetryRequirementsToQuotation(workbook, owner);
  const withColours = linkInternalPaintColoursToQuotation(withCabinetry, book);
  const withElectrical = connectElectricalScheduleToQuotation(withColours, book);
  const withTiling = connectTilingSelectionsToQuotation(withElectrical, book, { productById });
  const withFlooring = connectFlooringSelectionsToQuotation(withTiling, book, { productById });
  const withAppliances = connectApplianceSelectionsToQuotation(withFlooring, book, { productById });
  const withDoors = connectEntryDoorFurnitureSchedules(withAppliances, book);
  const withAllocated = connectAllocatedSelectionsToQuotation(withDoors, book);
  const withLighting = connectExternalLightingToQuotation(withAllocated, book, { productByCode });
  const withExteriorPaint = linkExteriorPaintToQuotation(withLighting, book);
  return { ...withExteriorPaint, quotation: normalizeQuotationStructure(withExteriorPaint.quotation, { migrateDerivedRows: false }) };
}

function flatten(quotation = {}) {
  const map = new Map();
  for (const [section, group] of Object.entries(quotation)) for (const row of group?.rows || []) map.set(rowKey(section, row), { section, row });
  return map;
}

function withQuotationEvidence(workbook = {}, quotationEvidence = null) {
  if (!quotationEvidence || typeof quotationEvidence !== "object") return workbook;
  const quotation = { ...(workbook.quotation || {}) };
  for (const [section, evidenceSection] of Object.entries(quotationEvidence)) {
    const savedSection = quotation[section];
    if (!savedSection) {
      quotation[section] = evidenceSection;
      continue;
    }
    const savedIds = new Set((savedSection.rows || []).map((row) => row.id));
    const evidenceRows = (evidenceSection?.rows || []).filter((row) => row.id && !savedIds.has(row.id));
    if (evidenceRows.length) quotation[section] = { ...savedSection, rows: [...(savedSection.rows || []), ...evidenceRows] };
  }
  return { ...workbook, quotation };
}

const isManaged = (row) => /^allocated-selection:/.test(row.id || "") && row.productId;

// A replaced product keeps the ORIGINAL row's allowance as its inclusion baseline. The difference is proposed,
// never stored as a variation, until the baseline is approved.
function retainReplacementBaselines(before, after, approved = {}) {
  const prior = flatten(before.quotation);
  const replacements = [];
  const quotation = { ...after.quotation };
  for (const [section, group] of Object.entries(after.quotation)) {
    let changed = false;
    const rows = (group.rows || []).map((row) => {
      const old = prior.get(rowKey(section, row))?.row;
      if (!old || !isManaged(old) || !isManaged(row) || old.productId === row.productId) return row;
      const baseline = old.retainedBaseline || {
        productId: old.productId, productName: old.productName, rateExGst: number(old.excelRate), allowancePerUnit: number(old.allowancePerUnit), allowanceTotal: number(old.allowanceTotal), source: "ORIGINAL_ROW_ALLOWANCE",
      };
      const selectedInc = number(row.productLibrarySnapshot?.unitPrice);
      const selectedPrice = resolvedBaseRate({
        unitPrice: selectedInc,
        priceIncludesGst: row.productLibrarySnapshot?.priceIncludesGst ?? null,
        pricePending: row.quoteRequired === true || /pending|quote required|unconfirmed/i.test(String(row.priceStatus || "")),
      });
      const quantity = number(row.qty ?? row.quantity);
      const proposed = selectedPrice.rate !== null && quantity !== null && baseline.allowancePerUnit !== null ? money((selectedPrice.rate - baseline.allowancePerUnit) * quantity) : null;
      const verified = approved[row.id] === true || old.variationBasis?.status === "BASELINE_VERIFIED";
      const manualRate = String(row.manualRate ?? "").trim();
      const preservedQuoteRate = [old.activeUnitPrice, old.finalRateUsed, old.manualRate, old.excelRate].map(number).find((value) => value !== null);
      const holdExistingRate = (!verified || selectedPrice.rate === null) && !manualRate && preservedQuoteRate !== undefined;
      replacements.push({ section, rowId: row.id, requirementKey: row.id.split(":")[1], from: { productId: old.productId, productName: old.productName, rateExGst: number(old.excelRate) }, to: { productId: row.productId, productName: row.productName, rateExGst: selectedPrice.rate, unitIncGst: selectedInc, priceIncludesGst: row.productLibrarySnapshot?.priceIncludesGst ?? null }, retainedBaseline: baseline, proposedVariation: proposed, baselineStatus: verified ? "BASELINE_VERIFIED" : "BASELINE_UNVERIFIED" });
      changed = true;
      return { ...row, retainedBaseline: baseline, allowancePerUnit: baseline.allowancePerUnit, allowanceTotal: baseline.allowanceTotal,
        ...(holdExistingRate ? { activeUnitPrice: preservedQuoteRate, selectionPricePending: false } : {}),
        ...(verified && selectedPrice.rate !== null && !manualRate ? { excelRate: selectedPrice.rate, priceStatus: "Current Price", quoteRequired: false } : {}),
        variation: verified ? proposed : null, variationBasis: { status: verified ? "BASELINE_VERIFIED" : "BASELINE_UNVERIFIED", proposedVariation: proposed } };
    });
    if (changed) quotation[section] = { ...group, rows };
  }
  return { workbook: replacements.length ? { ...after, quotation } : after, replacements };
}

function quantitySource(row) {
  if (row.quantitySource) return row.quantitySource;
  if (row.quantityManualOverride === true) return "MANUAL_OVERRIDE";
  if (row.quantityKey || /^takeoff-/.test(row.id || "")) return "TAKEOFF_OR_FORMULA";
  if (row.source === "client-selections-allocated-product") return "SELECTION_ALLOCATION";
  if (row.source === "client-selections-appliance-product") return "SELECTION_PRODUCT_COUNT";
  return row.qty === "" || row.qty == null ? "NONE" : "EXISTING_ROW";
}

function rateSource(row) {
  if (String(row.manualRate ?? "").trim()) return "MANUAL_OVERRIDE";
  if (row.excelRate === "" || row.excelRate == null) return "NONE";
  return row.productLibrarySnapshot ? "PRODUCT_LIBRARY_APPROVED_PRICE" : "ESTIMATE_RATE";
}

function baselineStatus(row) {
  if (row.variationBasis?.status) return row.variationBasis.status;
  if (row.selectionBaselineApplied && row.baselineUnitPrice != null) return "BASELINE_VERIFIED";
  if (row.retainedBaseline) return "BASELINE_UNVERIFIED";
  return row.productId || row.activeProductId ? "NO_BASELINE" : "NOT_APPLICABLE";
}

function describe(kind, section, row, previous) {
  const rate = row.manualRate || row.excelRate;
  return {
    kind, section, rowId: row.id, item: String(row.item || "").trim(),
    product: { before: previous ? previous.productName || previous.activeProductName || "" : "", after: row.productName || row.activeProductName || "" },
    quantity: { before: previous ? previous.qty ?? previous.quantity ?? "" : "", after: row.qty ?? row.quantity ?? "", source: quantitySource(row), pending: row.selectionQuantityPending === true, hint: row.selectionQuantityHint || null },
    rate: { before: previous ? previous.manualRate || previous.excelRate || "" : "", after: rate ?? "", source: rateSource(row), status: row.priceStatus || "", gstBasis: row.productLibrarySnapshot?.priceIncludesGst === true ? "inc GST price converted to ex GST" : row.productLibrarySnapshot?.priceIncludesGst === false ? "ex GST" : row.productLibrarySnapshot ? "UNCONFIRMED" : "n/a" },
    baseline: baselineStatus(row),
    priceMissing: Boolean(row.productId || row.activeProductId) && (rate === "" || rate == null || Number(String(rate).replace(/[$,]/g, "")) === 0),
  };
}

function diffQuotations(before, after) {
  const prior = flatten(before), next = flatten(after);
  const changes = [];
  for (const [key, { section, row }] of next) {
    if (row.lineType === "Heading") continue;
    const old = prior.get(key)?.row;
    if (!old) { changes.push(describe("ADDED", section, row, null)); continue; }
    const tracked = ["productId", "activeProductId", "qty", "quantity", "excelRate", "manualRate", "priceStatus", "allowancePerUnit", "variation", "variationTotal", "retainedBaseline", "paintColourSpecification", "selectionMappingSource", "selectedProducts", "selectedMaterialValue", "materialVariation", "serviceSelectionStatus"];
    if (tracked.some((field) => JSON.stringify(old[field]) !== JSON.stringify(row[field]))) changes.push(describe(isManaged(old) && isManaged(row) && old.productId !== row.productId ? "REPLACED" : "UPDATED", section, row, old));
  }
  for (const [key, { section, row }] of prior) if (!next.has(key) && row.lineType !== "Heading") changes.push({ ...describe("REMOVED", section, row, row), product: { before: row.productName || "", after: "" } });
  return changes;
}

// Two location names that normalise to the same words are one room entered twice ("2nd BEDROOM ENSUITE" / "B2 Ensuite").
export function locationFingerprint(name) {
  return plumbingLocationKey(name);
}

// A managed row whose quantity rises must come from distinct selected locations and be approved; duplicate room aliases block it.
function verifyQuantityChanges(before, after, approved = {}) {
  const prior = flatten(before);
  const checks = [];
  for (const { row, section } of flatten(after).values()) {
    const old = prior.get(rowKey(section, row))?.row;
    if (!old || !isManaged(row)) continue;
    const from = number(old.qty ?? old.quantity), to = number(row.qty ?? row.quantity);
    if (from === null || to === null || to <= from) continue;
    const locations = (row.locationSchedule || []).map((entry) => entry.location);
    const seen = new Map();
    const duplicates = [];
    for (const location of locations) {
      const key = locationFingerprint(location);
      if (seen.has(key)) duplicates.push([seen.get(key), location]); else seen.set(key, location);
    }
    const status = duplicates.length ? "DUPLICATE_LOCATION_ALIAS" : "INCREASE_NEEDS_APPROVAL";
    checks.push({ rowId: row.id, section, from, to, locations, duplicates, distinctLocations: seen.size, status, approved: approved[row.id] === true, blocking: Boolean(duplicates.length) || approved[row.id] !== true });
  }
  return checks;
}

const countRows = (quotation = {}) => Object.values(quotation).reduce((sum, group) => sum + (group?.rows?.length || 0), 0);

function assertUniqueManagedIds(records = [], resource = "quotation") {
  const seen = new Set();
  for (const record of records) {
    const id = String(record?.id || "");
    if (!id || (record.source !== ALLOCATED_SELECTION_SOURCE && !id.startsWith("allocated-selection:"))) continue;
    if (seen.has(id)) {
      const error = new Error(`Duplicate managed selection ID ${id} in ${resource}; save is blocked.`);
      error.code = "DUPLICATE_MANAGED_SELECTION_ID";
      throw error;
    }
    seen.add(id);
  }
}

function assertUniqueManagedSelectionIds(workbook = {}) {
  assertUniqueManagedIds(Object.values(workbook.quotation || {}).flatMap((section) => section?.rows || []));
  assertUniqueManagedIds(workbook.procurement?.items || [], "procurement");
}

// Pure: returns the full preview and the resulting workbook. Nothing is written anywhere.
export function planSelectionReconciliation({ workbook, book = workbook?.clientSelectionsBook, productById, productByCode, mappings = [], confirmed = {}, confirmedFixtureTargets = {}, approvedBaselines = {}, approvedQuantities = {}, quotationEvidence = null } = {}) {
  const normalizedSource = { ...workbook, quotation: normalizeQuotationStructure(workbook.quotation, { migrateDerivedRows: false }) };
  const fixtureBook = bookWithConfirmedFixtureTargets(book, confirmedFixtureTargets, mappings, workbook);
  const synced = runSelectionConnectors(normalizedSource, fixtureBook, { productById, productByCode });
  assertUniqueManagedSelectionIds(synced);
  const retained = retainReplacementBaselines(normalizedSource, synced, approvedBaselines);
  const targetWorkbook = withQuotationEvidence(retained.workbook, quotationEvidence);
  const reconciliation = reconcileSelectionTargets({ workbook: targetWorkbook, book: fixtureBook });
  const automaticTargets = Object.fromEntries(reconciliation.results.flatMap(({ identity, target }) => {
    const recommended = target.recommended;
    const exactMatch = recommended?.score === 1 && recommended.sizeMismatch !== true;
    const uniqueStrongMatch = target.candidates?.length === 1 && recommended?.score >= 0.75 && recommended.sizeMismatch !== true;
    const chargedAlternative = (target.alsoPresent || []).some((candidate) => Number(candidate.quantity) > 0);
    return target.status === TARGET_STATUS.PROPOSED_MAPPING && recommended && (exactMatch || uniqueStrongMatch) && !chargedAlternative
      ? [[identity.key, recommended.rowId]] : [];
  }));
  const confirmedTargets = { ...automaticTargets, ...confirmed };
  const applied = applyResolvedSelectionTargets(retained.workbook, reconciliation, { confirmed: confirmedTargets, automatic: automaticTargets });
  assertUniqueManagedSelectionIds(applied.workbook);
  const changes = diffQuotations(normalizedSource.quotation, applied.workbook.quotation);
  const entries = reconciliation.results;
  const held = entries.filter(({ target }) => target.status === TARGET_STATUS.REVIEW_REQUIRED).map(({ identity, target }) => ({ identityKey: identity.key, requirementKey: identity.requirementKey, productName: identity.productName, reason: target.reason, detail: target.detail, trade: target.trade || "", section: target.section || "", candidates: target.candidates || [] }));
  const targetProposals = entries.filter(({ identity, target }) => target.status === TARGET_STATUS.PROPOSED_MAPPING
    && (!automaticTargets[identity.key] || Object.prototype.hasOwnProperty.call(confirmed, identity.key))).map(({ identity, target }) => ({
    identityKey: identity.key, requirementKey: identity.requirementKey, productName: identity.productName, section: target.section, trade: target.trade, candidates: target.candidates, recommendedRowId: target.recommended?.rowId || "",
    selection: { quantity: identity.quantity, unit: identity.unit, unitPrice: identity.unitPrice, gst: resolvedBaseRate(identity).gst }, quantityOwner: target.quantityOwner, alsoPresent: target.alsoPresent || [], enteredArea: identity.enteredArea || null, confirmed: confirmed[identity.key] || "",
  }));
  const newRowProposals = entries.filter(({ target }) => target.status === TARGET_STATUS.VERIFIED_NEW_ROW).map(({ identity, target }) => {
    const price = resolvedBaseRate(identity);
    return {
      identityKey: identity.key,
      requirementKey: identity.requirementKey,
      productName: identity.productName,
      section: target.section,
      trade: target.trade,
      proposalKind: "NEW_QUOTE_ROW",
      candidates: [{ section: target.section, rowId: target.rowId, item: [identity.requirementKey, identity.productName].filter(Boolean).join(" / "), unit: identity.unit || "EACH", quantity: identity.quantity, rate: price.rate ?? "", score: 1, specificationOnly: false }],
      recommendedRowId: target.rowId,
      selection: { quantity: identity.quantity, unit: identity.unit, unitPrice: identity.unitPrice, gst: price.gst },
      quantityOwner: target.quantitySource,
      alsoPresent: [],
      enteredArea: null,
      confirmed: confirmed[identity.key] || "",
    };
  });
  const proposals = [...targetProposals, ...newRowProposals];
  let priceProblems = entries.filter(({ identity }) => identity.unitPrice === null || identity.pricePending || identity.priceIncludesGst === null)
    .map(({ identity }) => ({ identityKey: identity.key, requirementKey: identity.requirementKey, productName: identity.productName, issue: identity.unitPrice === null || identity.pricePending ? "PRICE_PENDING" : "GST_BASIS_UNCONFIRMED" }));
  const mappedRows = entries.filter(({ target }) => target.status.startsWith("VERIFIED_")).map(({ identity, target }) => ({ identityKey: identity.key, requirementKey: identity.requirementKey, status: target.status, section: target.section, rowIds: target.rowIds || (target.rowId ? [target.rowId] : []) }));
  const quantityChecks = verifyQuantityChanges(normalizedSource.quotation, applied.workbook.quotation, approvedQuantities);
  const blocking = quantityChecks.filter((check) => check.blocking);
  const fixtures = fixtureQuotationReconciliation(workbook, book, { confirmedTargets: confirmedFixtureTargets, mappings });
  const fixtureMappings = fixtures.filter((fixture) => confirmedFixtureTargets[fixture.key]?.rowId && fixture.target).map((fixture) => ({
    status: "MAPPED", template_id: workbook.templateKey || "", workspace_id: workbook.workspaceId || "", requirement_key: fixture.requirementKey,
    product_id: fixture.productId, quote_section_id: fixture.target.section, quote_row_id: fixture.target.rowId,
    metadata: { requirementKey: fixture.requirementKey, productId: fixture.productId, confirmedBy: "builder", source: "lighting-fan-reconciliation" },
  }));
  const quoteTargetMappings = [...(applied.workbook.quoteTargetMappings || [])];
  for (const mapping of fixtureMappings) {
    const index = quoteTargetMappings.findIndex((entry) => (entry.requirement_key || entry.metadata?.requirementKey) === mapping.requirement_key && (entry.product_id || entry.metadata?.productId) === mapping.product_id);
    if (index >= 0) quoteTargetMappings[index] = mapping; else quoteTargetMappings.push(mapping);
  }
  const reconciledWorkbook = Object.keys(confirmedFixtureTargets).length || fixtureMappings.length
    ? { ...applied.workbook, clientSelectionsBook: fixtureBook, quoteTargetMappings }
    : applied.workbook;
  const finalTargets = reconcileSelectionTargets({ workbook: withQuotationEvidence(reconciledWorkbook, quotationEvidence), book: fixtureBook, mappings });
  const targetResults = finalTargets.results.map(({ identity, target }) => ({
    identityKey: identity.key, requirementKey: identity.requirementKey, productId: identity.productId,
    productName: identity.productName, location: identity.location, status: target.resolutionStatus,
    requirementStatus: target.requirementStatus, detailStatus: target.detailStatus,
    section: target.section || "", rowIds: target.rowIds || (target.rowId ? [target.rowId] : []),
    blockers: target.resolutionStatuses.filter((status) => status === "PRICE_REQUIRED" || status === "QUANTITY_REQUIRED"),
    reason: target.reason || target.detail || "",
  }));
  const targetSummary = targetResults.reduce((summary, result) => {
    if (result.requirementStatus === "REQUIREMENT_RECOGNISED") summary.requirementRecognised += 1;
    if (result.status === "TARGET_RESOLVED") summary.targetResolved += 1;
    if (result.status === "TARGET_MISSING") summary.targetMissing += 1;
    if (result.status === "TARGET_AMBIGUOUS") summary.targetAmbiguous += 1;
    if (result.blockers.includes("PRICE_REQUIRED")) summary.priceRequired += 1;
    if (result.blockers.includes("QUANTITY_REQUIRED") || result.status === "QUANTITY_REQUIRED") summary.quantityRequired += 1;
    return summary;
  }, { requirementRecognised: 0, targetResolved: 0, targetMissing: 0, targetAmbiguous: 0, priceRequired: 0, quantityRequired: 0 });
  const resolvedAudit = reconcileProductSelections({
    workbook: withQuotationEvidence(reconciledWorkbook, quotationEvidence),
    book: fixtureBook,
    mappings,
    productById,
  });
  const financialMutations = changes.filter((change) => ["ADDED", "REPLACED"].includes(change.kind));
  const decisionByRowId = new Map();
  for (const entry of resolvedAudit.entries) {
    for (const rowId of entry.quoteRowIds || []) {
      const owners = decisionByRowId.get(rowId) || [];
      owners.push(entry.identityKey);
      decisionByRowId.set(rowId, owners);
    }
  }
  const mutationRequirement = (change) => {
    const rowId = String(change.rowId || "");
    if (rowId.startsWith("flooring:")) return "interior-flooring";
    if (rowId.startsWith("external-lighting:")) return "external-lighting";
    if (rowId.startsWith("appliance-selection:")) return rowId.split(":")[1] || "";
    if (rowId.startsWith("allocated-selection:")) return rowId.split(":")[1] || "";
    return "";
  };
  const mutationAccounting = financialMutations.map((change) => {
    let selectionIdentityKeys = [...new Set(decisionByRowId.get(change.rowId) || [])];
    if (!selectionIdentityKeys.length) {
      const requirementKey = mutationRequirement(change);
      const requirementOwners = resolvedAudit.entries.filter((entry) => entry.requirementKey === requirementKey);
      if (requirementOwners.length === 1) selectionIdentityKeys = [requirementOwners[0].identityKey];
      else {
        const targetOwners = targetResults.filter((entry) => entry.requirementKey === requirementKey);
        if (targetOwners.length === 1) selectionIdentityKeys = [targetOwners[0].identityKey];
      }
    }
    return { ...change, selectionIdentityKeys };
  });
  const pendingAdditionIdentities = new Set(mutationAccounting
    .filter((change) => change.kind === "ADDED")
    .flatMap((change) => change.selectionIdentityKeys));
  const resolvedRows = flatten(withQuotationEvidence(reconciledWorkbook, quotationEvidence).quotation);
  let canonicalEntries = resolvedAudit.entries.map((entry) => {
    const rowMutations = mutationAccounting.filter((change) => change.selectionIdentityKeys.includes(entry.identityKey));
    const pendingAddition = pendingAdditionIdentities.has(entry.identityKey);
    const linkedRows = (entry.quoteRowIds || []).map((rowId) => resolvedRows.get(rowId)?.row).filter(Boolean);
    const supplierPricePending = entry.outcome === PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_PRICE
      || rowMutations.some((change) => change.priceMissing || /pending|quote required|rate required|unconfirmed/i.test(String(change.rate?.status || "")))
      || linkedRows.some((row) => row.quoteRequired === true || /pending|quote required|rate required|unconfirmed/i.test(String(row.priceStatus || row.rateStatus || "")));
    return {
      ...entry,
      ...(supplierPricePending
        ? { outcome: PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_PRICE }
        : pendingAddition
          ? { outcome: PRODUCT_SELECTION_OUTCOME.BLOCKED_BUILDER_APPROVAL }
          : {}),
      reconciliationDecision: supplierPricePending
        ? "SUPPLIER_PRICE_PENDING"
        : pendingAddition
        ? "QUOTATION_ADDITION_REQUIRES_APPROVAL"
        : entry.outcome === PRODUCT_SELECTION_OUTCOME.BLOCKED_UNVERIFIED_BASELINE
          ? "REPLACEMENT_REQUIRES_BASELINE_APPROVAL"
          : entry.outcome === PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_PRICE
            ? "SUPPLIER_PRICE_PENDING"
            : entry.outcome === PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_QUANTITY
              ? "BUILDER_INPUT_REQUIRED"
              : entry.outcome === PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_PROCUREMENT
                ? "PROCUREMENT_REQUIREMENT_MISSING"
                : String(entry.outcome || "").startsWith("BLOCKED_")
                  ? "RECONCILIATION_REQUIRED"
                  : entry.packageVerified
                    ? "INCLUSION_COVERED"
                    : "ALREADY_REPRESENTED",
      proposedQuotationMutations: rowMutations,
    };
  });
  const canonicalRequirements = new Set(canonicalEntries.map((entry) => entry.requirementKey));
  const schedulePriceDecisions = finalTargets.results.flatMap(({ identity, target }) => {
    if (canonicalRequirements.has(identity.requirementKey)) return [];
    const rowIds = target.rowIds || (target.rowId ? [target.rowId] : []);
    const pendingRows = rowIds.map((rowId) => resolvedRows.get(rowId)?.row).filter((row) => row
      && (row.quoteRequired === true || /pending|quote required|rate required|unconfirmed/i.test(String(row.priceStatus || row.rateStatus || ""))));
    if (!pendingRows.length) return [];
    return [{
      key: identity.key,
      identityKey: identity.key,
      rowId: identity.rowId || "",
      productId: identity.productId || "",
      productName: identity.productName || `${identity.requirementKey} schedule`,
      requirementKey: identity.requirementKey,
      category: identity.requirementKey,
      location: identity.location || "",
      outcome: PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_PRICE,
      targetStatus: target.status,
      targetReason: target.reason || "",
      section: target.section || "",
      quoteRowIds: pendingRows.map((row) => row.id),
      quantity: identity.quantity,
      unit: identity.unit || "",
      selectedUnitPrice: null,
      priceIncludesGst: null,
      priceVerified: false,
      quantityVerified: identity.quantity > 0,
      productRepresented: true,
      packageVerified: false,
      baselineVerified: false,
      procurementStatus: "REQUIRED_BUT_UNPRICED",
      procurementRepresented: true,
      procurementIssue: "",
      procurementIds: [],
      reconciliationDecision: "SUPPLIER_PRICE_PENDING",
      proposedQuotationMutations: mutationAccounting.filter((change) => change.selectionIdentityKeys.includes(identity.key)),
    }];
  });
  canonicalEntries = [...canonicalEntries, ...schedulePriceDecisions];
  const canonicalBlocked = canonicalEntries.filter((entry) => String(entry.outcome || "").startsWith("BLOCKED_"));
  priceProblems = canonicalEntries
    .filter((entry) => entry.outcome === PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_PRICE)
    .map((entry) => ({
      identityKey: entry.identityKey,
      requirementKey: entry.requirementKey,
      productName: entry.productName,
      issue: "PRICE_PENDING",
    }));
  const canonicalCategories = [...new Set(canonicalEntries.map((entry) => entry.category))].sort().map((category) => ({
    category,
    selected: canonicalEntries.filter((entry) => entry.category === category).length,
    outcomes: Object.fromEntries(Object.values(PRODUCT_SELECTION_OUTCOME).map((status) => [
      status,
      canonicalEntries.filter((entry) => entry.category === category && entry.outcome === status).length,
    ])),
  }));
  const canonicalAudit = {
    ...resolvedAudit,
    selected: canonicalEntries.length,
    entries: canonicalEntries,
    blocked: canonicalBlocked,
    unresolvedCount: canonicalBlocked.length,
    procurementMissing: canonicalEntries.filter((entry) => !entry.procurementRepresented),
    counts: Object.fromEntries(Object.values(PRODUCT_SELECTION_OUTCOME).map((status) => [
      status,
      canonicalEntries.filter((entry) => entry.outcome === status).length,
    ])),
    categories: canonicalCategories,
  };
  const mutationSummary = {
    selectionRecords: entries.length,
    concreteProductDecisions: resolvedAudit.entries.length,
    addedRows: mutationAccounting.filter((change) => change.kind === "ADDED").length,
    addedSelectionDecisions: new Set(mutationAccounting.filter((change) => change.kind === "ADDED").flatMap((change) => change.selectionIdentityKeys)).size,
    replacementRows: mutationAccounting.filter((change) => change.kind === "REPLACED").length,
    replacementSelectionDecisions: new Set(mutationAccounting.filter((change) => change.kind === "REPLACED").flatMap((change) => change.selectionIdentityKeys)).size,
    unownedMutations: mutationAccounting.filter((change) => change.selectionIdentityKeys.length === 0),
  };
  const targetRequirementCounts = new Map();
  for (const result of targetResults) targetRequirementCounts.set(result.requirementKey, (targetRequirementCounts.get(result.requirementKey) || 0) + 1);
  const selectionDecisions = targetResults.map((result) => {
    const components = canonicalEntries.filter((entry) => entry.identityKey === result.identityKey
      || (targetRequirementCounts.get(result.requirementKey) === 1 && entry.requirementKey === result.requirementKey));
    const proposedQuotationMutations = mutationAccounting.filter((change) => change.selectionIdentityKeys.includes(result.identityKey)
      || (!change.selectionIdentityKeys.length && mutationRequirement(change) === result.requirementKey));
    const componentDecisions = [...new Set(components.map((entry) => entry.reconciliationDecision))];
    const reconciliationDecision = proposedQuotationMutations.some((change) => change.kind === "ADDED")
      ? "QUOTATION_ADDITION_REQUIRES_APPROVAL"
      : proposedQuotationMutations.some((change) => change.kind === "REPLACED")
        ? "REPLACEMENT_REQUIRES_BASELINE_APPROVAL"
        : componentDecisions.includes("SUPPLIER_PRICE_PENDING")
          ? "SUPPLIER_PRICE_PENDING"
          : componentDecisions.includes("BUILDER_INPUT_REQUIRED")
            ? "BUILDER_INPUT_REQUIRED"
            : componentDecisions.includes("PROCUREMENT_REQUIREMENT_MISSING")
              ? "PROCUREMENT_REQUIREMENT_MISSING"
              : componentDecisions.some((decision) => !["ALREADY_REPRESENTED", "INCLUSION_COVERED"].includes(decision))
                ? "RECONCILIATION_REQUIRED"
                : componentDecisions.includes("INCLUSION_COVERED")
                  ? "INCLUSION_COVERED"
                  : result.status === "TARGET_RESOLVED"
                    ? "ALREADY_REPRESENTED"
                    : "RECONCILIATION_REQUIRED";
    return {
      ...result,
      reconciliationDecision,
      componentDecisionIds: components.map((entry) => entry.identityKey),
      proposedQuotationMutations,
      procurementStatus: !components.length
        ? "NOT_APPLICABLE"
        : components.every((entry) => entry.procurementRepresented)
          ? "REPRESENTED"
          : components.some((entry) => entry.procurementRepresented)
            ? "PARTIALLY_REPRESENTED"
            : "MISSING",
    };
  });
  return {
    workbook: reconciledWorkbook, applied: applied.applied, changes, proposals, held, replacements: retained.replacements, mappedRows, priceProblems, quantityChecks, blocking, fixtures, fixtureMappings, targetResults, targetSummary,
    canonicalAudit, selectionDecisions, mutationAccounting, mutationSummary,
    syncReports: { externalLighting: applied.workbook.externalLightingSyncReport || null, exteriorPaint: applied.workbook.exteriorPaintSyncReport || null },
    automaticMappings: applied.applied.filter((entry) => entry.action === "AUTO_LINKED_EXISTING_ROW"),
    duplicates: reconciliation.duplicateCharges, summary: reconciliation.summary,
    totals: { sectionsBefore: Object.keys(workbook.quotation || {}).length, sectionsAfter: Object.keys(applied.workbook.quotation || {}).length, rowsBefore: countRows(workbook.quotation), rowsAfter: countRows(applied.workbook.quotation), identities: entries.length },
  };
}

export function deferUnapprovedQuotationChanges(currentWorkbook = {}, reconciledWorkbook = {}, financialImpact = {}) {
  if (!financialImpact.requiresApproval) return {
    ...reconciledWorkbook,
    selectionReconciliationPending: currentWorkbook.selectionReconciliationPending || null,
  };
  return {
    ...reconciledWorkbook,
    quotation: currentWorkbook.quotation || {},
    quotationSectionOrder: currentWorkbook.quotationSectionOrder,
    selectionReconciliationPending: {
      status: "FINANCIAL_APPROVAL_REQUIRED",
      beforeTotal: financialImpact.before,
      proposedTotal: financialImpact.after,
      delta: financialImpact.delta,
      changedLineCount: financialImpact.rowChanges?.length || 0,
      approvalSignature: financialImpact.signature || "",
    },
  };
}
