// Builder-template quotation target resolver: Product Library selection -> verified Quotation Builder row.
// "Recognised requirement" (taxonomy) is NOT "verified target": a selection only becomes a charge when
// exactly one existing row, a builder-confirmed mapping, or one deterministic new row inside an EXISTING
// trade section can carry it. Pure functions: no sync-module imports, no section creation, and
// quantities / prices are never inferred (see quantity ownership and GST rules below).

import { canonicalQuotationSectionName, quotationSubheadingRow, sectionSlug } from "../construction-estimation/quotationStructure.js";
import { estimateSectionForRequirement } from "./clientSelectionCategories.js";
import { requirementDefinition } from "./selectionRequirementTaxonomy.js";
import { applySelectionProduct } from "./selectionProductMath.js";
import { resolveTradeSection } from "./quotationTradeSections.js";
import { plumbingLocationKey } from "./plumbingFixtureAllocation.js";
import {
  ALLOCATED_SELECTION_SOURCE, ELECTRICAL_SCHEDULE_SOURCE, FLOORING_SELECTION_SOURCE, TILING_SELECTION_SOURCE,
  ENTRY_DOOR_FURNITURE_SOURCE, WINDOW_SYNC_ROW_SOURCE, RESOLVED_SELECTION_SOURCE, EXTERNAL_LIGHTING_SOURCE,
} from "./selectionSources.js";

export { RESOLVED_SELECTION_SOURCE };

export const TARGET_STATUS = Object.freeze({
  VERIFIED_MAPPED_ROW: "VERIFIED_MAPPED_ROW",
  VERIFIED_TAGGED_ROW: "VERIFIED_TAGGED_ROW",
  VERIFIED_EXISTING_ROW: "VERIFIED_EXISTING_ROW",
  VERIFIED_SCHEDULE_ROWS: "VERIFIED_SCHEDULE_ROWS",
  VERIFIED_SPECIFICATION_ROW: "VERIFIED_SPECIFICATION_ROW",
  VERIFIED_NEW_ROW: "VERIFIED_NEW_ROW",
  PROPOSED_MAPPING: "PROPOSED_MAPPING",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
});

export const REVIEW_REASON = Object.freeze({
  UNKNOWN_REQUIREMENT: "UNKNOWN_REQUIREMENT",
  STALE_MAPPING: "STALE_MAPPING",
  AMBIGUOUS_TARGETS: "AMBIGUOUS_TARGETS",
  TRADE_SECTION_MISSING: "TRADE_SECTION_MISSING",
  TRADE_SECTION_AMBIGUOUS: "TRADE_SECTION_AMBIGUOUS",
  NO_OPTION_ROW: "NO_OPTION_ROW",
  SIZE_REQUIRED: "SIZE_REQUIRED",
  QUANTITY_REQUIRED: "QUANTITY_REQUIRED",
  SCHEDULE_NOT_SYNCED: "SCHEDULE_NOT_SYNCED",
  NO_EXISTING_SYNC: "NO_EXISTING_SYNC",
  NO_PRODUCT: "NO_PRODUCT",
  CONFLICTING_PRODUCT_ON_ROW: "CONFLICTING_PRODUCT_ON_ROW",
});

// Quantity ownership: these are priced option rows in the builder's trade section whose quantity belongs to
// AI Takeoff / Job Setup / the estimator. A selection supplies the product only, never the quantity.
export const TEMPLATE_OPTION_REQUIREMENTS = Object.freeze(new Set(["cladding", "bricks", "roofing", "driveway", "garage-door", "internal-doors", "door-hardware", "skirting", "architraves", "robes"]));
// Schedule-model requirements: one selection stands for many quotation rows written by a dedicated schedule sync.
export const SCHEDULE_REQUIREMENTS = Object.freeze(new Set(["cabinetry", "electrical-schedule", "interior-lighting", "ceiling-fan", "interior-flooring", "tiling-rooms", "windows", "internal-doors", "door-hardware", "external-lighting", "exterior-paint", "interior-paint"]));
const NO_QUOTE_SYNC = new Set();

const text = (value) => String(value ?? "").trim();
const finite = (value) => (value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null);
const listOf = (value) => (Array.isArray(value) ? value : value == null || value === "" ? [] : [value]).map(String);
const normal = (value) => text(value).toLowerCase().replace(/[^a-z0-9]/g, "");
const tokens = (value) => text(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const isHeading = (row) => row?.lineType === "Heading" || /^quotation-subheading:/.test(row?.id || "");
const carries = (row, identity) => Boolean(identity.productId) && (row.activeProductId === identity.productId || row.selectedProductId === identity.productId || row.productId === identity.productId);

export function selectionIdentity(row = {}, room = "") {
  const guided = row.guidedSelection || row.selected_details || row.selectedDetails || {};
  const requirementKey = text(guided.requirementKey || row.guidedRequirementKey || row.category);
  const productId = text(guided.productId || guided.canonicalProductId || row.productId);
  return {
    key: [requirementKey, productId || text(row.selectedProduct), text(guided.locationId || room)].join("|"),
    rowId: row.id || "",
    requirementKey,
    productId,
    productCode: text(guided.productCode || guided.supplierCode || row.productCode),
    supplier: text(guided.supplier || row.supplier),
    model: text(guided.model || row.productModel),
    productName: text(guided.productName || row.selectedProduct),
    searchText: [row.item, guided.requirementLabel, guided.finish, guided.size, guided.configuration, guided.range, guided.profile].map(text).filter(Boolean).join(" "),
    location: text(guided.locationId || guided.location || room),
    quantity: finite(guided.quantity),
    unit: text(guided.unit),
    unitPrice: finite(guided.selectedPrice ?? guided.unitPrice),
    priceStatus: text(guided.priceStatus || guided.priceState),
    allowanceUnit: finite(guided.allowance),
    priceIncludesGst: typeof guided.priceIncludesGst === "boolean" ? guided.priceIncludesGst : /harvey norman/i.test(text(guided.supplier)) ? true : null,
    pricePending: /pending|quote/i.test(`${guided.priceStatus || ""} ${guided.priceState || ""}`),
    // An area typed into the selection by the builder (no measured source exists for it) is the quantity of a blank, unlinked option row.
    enteredArea: requirementKey === "driveway" && finite(guided.drivewayAreaM2 ?? guided.drivewaySelection?.areaM2) > 0
      ? { quantity: finite(guided.drivewayAreaM2 ?? guided.drivewaySelection?.areaM2), unit: "M2", source: text(guided.drivewaySelection?.areaSource) || "Saved selection" } : null,
    scheduleOwned: SCHEDULE_REQUIREMENTS.has(requirementKey) || !productId,
  };
}

function quotationRows(workbook) {
  return Object.entries(workbook?.quotation || {}).flatMap(([section, group]) =>
    (group?.rows || []).filter((row) => !isHeading(row)).map((row) => ({ section, row })));
}

// Job-level mappings are the job's own snapshot and win over the builder's reusable template mappings.
export function builderMappings(workbook = {}, extra = []) {
  const job = workbook.quoteTargetMappings || [];
  const keyOf = (mapping) => `${mapping.metadata?.requirementKey || mapping.requirement_key || mapping.selection_slot_id}|${mapping.product_id || mapping.metadata?.productId || ""}|${mapping.metadata?.locationId || mapping.location_id || ""}`;
  const owned = new Set(job.map(keyOf));
  return [...job, ...extra.filter((mapping) => !owned.has(keyOf(mapping)))];
}

function mappedTargets(workbook, identity, mappings, definition) {
  const slots = new Set(definition?.selectionSlotIds || []);
  return mappings.filter((mapping) => mapping.status === "MAPPED"
    && (mapping.template_id || "") === (workbook.templateKey || "")
    && (mapping.workspace_id || workbook.workspaceId) === workbook.workspaceId
    && (mapping.metadata?.requirementKey === identity.requirementKey || mapping.requirement_key === identity.requirementKey || (!mapping.metadata?.requirementKey && !mapping.requirement_key && slots.has(mapping.selection_slot_id)))
    && (!(mapping.product_id || mapping.metadata?.productId) || (mapping.product_id || mapping.metadata?.productId) === identity.productId)
    && (!(mapping.metadata?.locationId || mapping.location_id) || !identity.location || (mapping.metadata?.locationId || mapping.location_id) === identity.location));
}

// A supplier code only counts when it is distinctive (letters + digits) and equals a code field or a whole token of the row text.
const isSupplierCode = (code) => code.length >= 6 && /\d/.test(code) && /[a-z]/.test(code);

function rowsMatchingProduct(rows, identity) {
  const { productId, model, requirementKey } = identity;
  const code = normal(model);
  return rows.filter(({ row }) => {
    const id = text(row.id);
    if (id.startsWith("allocated-selection:") && !id.startsWith(`allocated-selection:${requirementKey}:`)) return false;
    if (productId && (row.productId === productId || row.activeProductId === productId || row.selectedProductId === productId || listOf(row.productIds).includes(productId) || row.productLibrarySnapshot?.productId === productId
      || id.includes(`:${productId}`) || id.includes(`-${productId}`))) return true;
    return isSupplierCode(code) && ([row.productCode, row.model, row.supplierCode].some((field) => normal(field) === code)
      || [row.item, row.description].some((field) => tokens(field).includes(code)));
  });
}

function scheduleEvidence(workbook, identity, rows) {
  const key = identity.requirementKey;
  const bySource = (...sources) => rows.filter(({ row }) => sources.includes(row.source));
  if (key === "electrical-schedule") return bySource(ELECTRICAL_SCHEDULE_SOURCE);
  if (["interior-lighting", "ceiling-fan"].includes(key)) return rows.filter(({ row }) => (row.selectedProducts || []).some((product) => product.requirementKey === key));
  if (key === "interior-flooring") return bySource(FLOORING_SELECTION_SOURCE);
  if (key === "tiling-rooms") return bySource(TILING_SELECTION_SOURCE);
  if (key === "windows") return rows.filter(({ row }) => row.source === WINDOW_SYNC_ROW_SOURCE
    || text(row.id).startsWith("quote-windows-list-")
    || row.windowScheduleUnpricedRow === true);
  if (key === "internal-doors") return rows.filter(({ row }) => text(row.id).startsWith("takeoff-door-quotation:internal-door:")
    && (row.productId === identity.productId || listOf(row.productIds).includes(identity.productId) || row.productLibrarySnapshot?.productId === identity.productId));
  if (key === "door-hardware") return rows.filter(({ row }) => text(row.id).startsWith("takeoff-door-quotation:door-furniture:")
    && (row.productId === identity.productId || listOf(row.productIds).includes(identity.productId) || row.productLibrarySnapshot?.productId === identity.productId));
  if (key === "interior-paint") return rows.filter(({ row }) => row.paintColourSpecification);
  if (key === "exterior-paint") return rows.filter(({ row }) => row.exteriorColourSpecification);
  if (key === "external-lighting") return bySource(EXTERNAL_LIGHTING_SOURCE);
  if (key === "entry-door-furniture") return bySource(ENTRY_DOOR_FURNITURE_SOURCE);
  return [];
}

const STOP = new Set(["the", "and", "with", "for", "mm", "series", "standard", "primed", "white", "item", "each", "unit", "fix", "out", "final", "internal", "external", "interior", "exterior", "general", "supply", "install"]);
const stem = (token) => (token === "colorbond" ? "colourbond" : token === "agg" ? "aggregate" : token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token);
const distinctive = (value) => tokens(value).filter((token) => !STOP.has(token) && (token.length > 2 || /\d/.test(token))).map(stem);
const numeric = (list) => list.filter((token) => /^\d+$/.test(token));

// Ranked option rows in a trade section. Similarity proposes; only a builder confirmation verifies.
// An all-in rate row ("M2 RATE (BATTENS, FASCIA, GUTTER, ...)") already includes its listed components, so a
// product covered by it is a specification on that row and never an extra charge on a component row.
export function optionCandidates(sectionRows, identity, { loose = false } = {}) {
  const wanted = new Set(distinctive(`${identity.productName} ${identity.model} ${identity.searchText}`));
  const wantedNumbers = new Set(numeric([...wanted]));
  const scored = sectionRows.filter(({ row }) => !/^(install|hang|labour|labor|supply and install)\b/i.test(text(row.item)) && !String(row.source || "").startsWith("client-selections-") && !/^final-cabinetry:/.test(text(row.id)))
    .map(({ section, row }) => {
      const item = text(row.item);
      const allIn = /\brate\b/i.test(item) && /\(([^)]+)\)/.test(item);
      const components = allIn ? new Set(distinctive(item.match(/\(([^)]+)\)/)[1])) : null;
      const rowTokens = distinctive(item);
      if (!rowTokens.length) return null;
      const hits = (allIn ? [...components] : rowTokens).filter((token) => wanted.has(token));
      const rowNumbers = numeric(rowTokens);
      const sizeMismatch = !allIn && rowNumbers.length > 0 && wantedNumbers.size > 0 && rowNumbers.some((token) => !wantedNumbers.has(token));
      const score = allIn ? (hits.length >= 2 ? 0.8 : 0) : (hits.length / rowTokens.length) * (sizeMismatch ? 0.5 : 1);
      return { section, rowId: row.id, item, unit: text(row.unit), quantity: finite(row.qty ?? row.quantity), rate: text(row.manualRate || row.excelRate), score: Math.round(score * 100) / 100, sizeMismatch, hits: hits.length, tokenCount: rowTokens.length, specificationOnly: allIn, components: components ? [...components] : null, _tokens: rowTokens };
    })
    .filter(Boolean);
  const allInRows = scored.filter((candidate) => candidate.specificationOnly && candidate.score > 0);
  const covered = (candidate) => !candidate.specificationOnly && allInRows.some((entry) => candidate._tokens.every((token) => entry.components.includes(token)));
  const ranked = scored.filter((candidate) => !covered(candidate) && (loose ? candidate.hits > 0 : candidate.score >= 0.5 && (candidate.hits >= 2 || candidate.hits === candidate.tokenCount)))
    .sort((a, b) => b.score - a.score || b.hits - a.hits)
    .map(({ _tokens, ...candidate }) => candidate);
  return ranked;
}

function resolveQuotationTargetDetail({ workbook = {}, identity = {}, mappings = [] } = {}) {
  const base = { identityKey: identity.key, requirementKey: identity.requirementKey, productId: identity.productId };
  const review = (reason, detail = "", extra = {}) => ({ ...base, status: TARGET_STATUS.REVIEW_REQUIRED, reason, detail, ...extra });
  const definition = requirementDefinition(identity.requirementKey);
  if (!definition) return review(REVIEW_REASON.UNKNOWN_REQUIREMENT, "Requirement is not in the shared taxonomy");
  const rows = quotationRows(workbook);
  const pricing = identity.unitPrice === null ? "PRICE_PENDING" : "APPROVED_PRICE";

  // 1. Builder template mapping (coordinates the builder configured or confirmed once).
  const mapped = mappedTargets(workbook, identity, builderMappings(workbook, mappings), definition);
  if (mapped.length) {
    const found = mapped.map((mapping) => rows.find(({ section, row }) => row.id === mapping.quote_row_id && (!mapping.quote_section_id || section === mapping.quote_section_id))).filter(Boolean);
    if (found.length !== mapped.length) return review(REVIEW_REASON.STALE_MAPPING, "Mapped quotation row no longer exists", { candidates: mapped.map((m) => m.quote_row_id) });
    if (found.length > 1) return review(REVIEW_REASON.AMBIGUOUS_TARGETS, "More than one mapped row", { candidates: found.map(({ row }) => row.id) });
    if (mapped[0].mode === "SPECIFICATION_ONLY") return { ...base, status: found[0].row.selectionSpecProductId === identity.productId ? TARGET_STATUS.VERIFIED_EXISTING_ROW : TARGET_STATUS.VERIFIED_SPECIFICATION_ROW, section: found[0].section, rowId: found[0].row.id, pricing, mode: "SPECIFICATION_ONLY", mapping: mapped[0] };
    return { ...base, status: carries(found[0].row, identity) ? TARGET_STATUS.VERIFIED_EXISTING_ROW : TARGET_STATUS.VERIFIED_MAPPED_ROW, section: found[0].section, rowId: found[0].row.id, pricing, mapping: mapped[0] };
  }

  // 2. Stable requirement id stamped on the row.
  const tagged = identity.scheduleOwned ? [] : rows.filter(({ row }) => (row.requirementKey === identity.requirementKey || listOf(row.requirementKeys).includes(identity.requirementKey))
    && (!row.locationId || !identity.location || row.locationId === identity.location));
  if (tagged.length === 1) {
    if (tagged[0].row.selectionSpecificationOnly === true && tagged[0].row.selectionSpecProductId === identity.productId) {
      return { ...base, status: TARGET_STATUS.VERIFIED_SPECIFICATION_ROW, section: tagged[0].section, rowId: tagged[0].row.id, pricing, mode: "SPECIFICATION_ONLY" };
    }
    return { ...base, status: carries(tagged[0].row, identity) ? TARGET_STATUS.VERIFIED_EXISTING_ROW : TARGET_STATUS.VERIFIED_TAGGED_ROW, section: tagged[0].section, rowId: tagged[0].row.id, pricing };
  }
  if (tagged.length > 1) {
    const exact = rowsMatchingProduct(tagged, identity);
    if (exact.length === 1) return { ...base, status: TARGET_STATUS.VERIFIED_TAGGED_ROW, section: exact[0].section, rowId: exact[0].row.id, pricing };
    return review(REVIEW_REASON.AMBIGUOUS_TARGETS, "Several rows carry this requirement id", { candidates: tagged.map(({ row }) => row.id) });
  }

  // 3. A row that already carries this exact Product Library product: never add a second charge.
  const matchingRows = rowsMatchingProduct(rows, identity);
  const deterministicDoorTarget = identity.scheduleOwned
    && ["internal-doors", "door-hardware"].includes(identity.requirementKey)
    && matchingRows.length === 1
    && matchingRows[0].row.source === "takeoff-door-quotation";
  const existing = identity.scheduleOwned && !deterministicDoorTarget ? [] : matchingRows;
  if (existing.length === 1) return { ...base, status: TARGET_STATUS.VERIFIED_EXISTING_ROW, section: existing[0].section, rowId: existing[0].row.id, pricing };
  const splitPrefix = `allocated-selection:${identity.requirementKey}:${identity.productId}`;
  if (existing.length > 1 && existing.every(({ row, section }) => row.source === ALLOCATED_SELECTION_SOURCE && text(row.id).startsWith(splitPrefix) && section === existing[0].section)) {
    return { ...base, status: TARGET_STATUS.VERIFIED_EXISTING_ROW, section: existing[0].section, rowIds: existing.map(({ row }) => row.id), pricing };
  }
  if (existing.length > 1) return review(REVIEW_REASON.AMBIGUOUS_TARGETS, "Product already appears on several rows", { candidates: existing.map(({ row }) => row.id) });

  // 4. Schedule-owned requirement: verified only when its existing sync has written rows.
  if (identity.scheduleOwned) {
    const owned = scheduleEvidence(workbook, identity, rows);
    if (owned.length) return { ...base, status: TARGET_STATUS.VERIFIED_SCHEDULE_ROWS, rowIds: owned.map(({ row }) => row.id), section: owned[0].section, pricing };
    if (identity.requirementKey === "cabinetry" && workbook.cabinetryReconciliation?.summary?.matched > 0) {
      const { matched, unmatched = 0 } = workbook.cabinetryReconciliation.summary;
      return { ...base, status: TARGET_STATUS.VERIFIED_SCHEDULE_ROWS, rowIds: [], section: "CABINETRY", pricing, scheduleSummary: { matched, unmatched } };
    }
    if (NO_QUOTE_SYNC.has(identity.requirementKey)) return review(REVIEW_REASON.NO_EXISTING_SYNC, "This schedule has no existing quotation sync; approve a connector or a target section", { trade: identity.requirementKey === "external-lighting" ? "Light fittings" : "Painter" });
    if (SCHEDULE_REQUIREMENTS.has(identity.requirementKey) || !identity.productId) return review(REVIEW_REASON.SCHEDULE_NOT_SYNCED, "Schedule selection has no quotation rows yet; run its schedule sync");
  }
  if (!identity.productId) return review(REVIEW_REASON.NO_PRODUCT, "Selection has no Product Library product");

  // A different product already charged for this requirement: adding a row would double-charge it.
  const conflicting = rows.filter(({ row }) => text(row.id).startsWith(`allocated-selection:${identity.requirementKey}:`) && row.productId !== identity.productId);
  if (conflicting.length) return review(REVIEW_REASON.CONFLICTING_PRODUCT_ON_ROW, "Quotation already charges a different product for this requirement; confirm replacement", { candidates: conflicting.map(({ row }) => row.id), section: conflicting[0].section });

  // 5. Existing trade section, found by canonical trade identity (never created here).
  const category = estimateSectionForRequirement(identity.requirementKey);
  const trade = resolveTradeSection({ workbook, identity, fallbackSectionNames: [canonicalQuotationSectionName(category), canonicalQuotationSectionName(`${category} - CLIENT SELECTIONS`)] });
  if (trade.status === "MISSING") return review(REVIEW_REASON.TRADE_SECTION_MISSING, trade.reason, { trade: trade.trade });
  if (trade.status === "AMBIGUOUS") return review(REVIEW_REASON.TRADE_SECTION_AMBIGUOUS, "More than one trade section fits; name the one to use", { trade: trade.trade, candidates: trade.candidates });

  // 6a. Option rows: propose the matching priced row; quantity stays with its owner.
  if (TEMPLATE_OPTION_REQUIREMENTS.has(identity.requirementKey)) {
    const candidates = optionCandidates(rows.filter(({ section }) => section === trade.section), identity);
    if (!candidates.length) {
      const nearest = optionCandidates(rows.filter(({ section }) => section === trade.section), identity, { loose: true }).slice(0, 3);
      return review(REVIEW_REASON.NO_OPTION_ROW, `No priced option row in ${trade.section} matches this product; approve a new row`, { section: trade.section, trade: trade.trade, candidates: nearest });
    }
    // Sized option rows cannot be chosen when the selection carries no size (measured opening / door schedule owns it).
    const sizedRows = candidates.filter((candidate) => /\d{3,}/.test(candidate.item));
    if (sizedRows.length && !/\d{3,}/.test(`${identity.searchText} ${identity.productName}`)) {
      return review(REVIEW_REASON.SIZE_REQUIRED, "The selection has no size; the measured size from Job Setup / Takeoff chooses the option row", { section: trade.section, trade: trade.trade, candidates: sizedRows.slice(0, 6) });
    }
    const specificationRows = candidates.filter((candidate) => candidate.specificationOnly && candidate.score >= 0.8);
    if (specificationRows.length === 1) {
      return {
        ...base,
        status: TARGET_STATUS.VERIFIED_SPECIFICATION_ROW,
        section: trade.section,
        trade: trade.trade,
        rowId: specificationRows[0].rowId,
        pricing,
        mode: "SPECIFICATION_ONLY",
      };
    }
    const recommended = candidates[0].score >= 0.75 && (candidates.length === 1 || candidates[0].score - candidates[1].score >= 0.15) ? candidates[0] : null;
    // Similar rows in OTHER trade sections: a second charge for the same product if both were ever quantified.
    const alsoPresent = optionCandidates(rows.filter(({ section }) => section !== trade.section), identity).filter((candidate) => candidate.score >= 0.6).slice(0, 4);
    return { ...base, status: TARGET_STATUS.PROPOSED_MAPPING, section: trade.section, trade: trade.trade, candidates, recommended, alsoPresent, pricing, quantityOwner: identity.enteredArea ? "BUILDER_ENTERED_SELECTION_AREA" : "TAKEOFF_JOB_SETUP_OR_ESTIMATOR" };
  }

  // 6b. Product-count lines: a deterministic managed row; the selection's count is the quantity by definition.
  if (!(identity.quantity > 0)) return review(REVIEW_REASON.QUANTITY_REQUIRED, "Selection carries no quantity; take-off or estimator must supply it", { section: trade.section });
  return { ...base, status: TARGET_STATUS.VERIFIED_NEW_ROW, section: trade.section, rowId: `allocated-selection:${identity.requirementKey}:${identity.productId}`, source: RESOLVED_SELECTION_SOURCE, pricing, quantitySource: "SELECTION_PRODUCT_COUNT", sectionSource: trade.source };
}

const AMBIGUOUS_REASONS = new Set([REVIEW_REASON.AMBIGUOUS_TARGETS, REVIEW_REASON.TRADE_SECTION_AMBIGUOUS]);
const VERIFIED_TARGET_STATUSES = new Set([
  TARGET_STATUS.VERIFIED_MAPPED_ROW,
  TARGET_STATUS.VERIFIED_TAGGED_ROW,
  TARGET_STATUS.VERIFIED_EXISTING_ROW,
  TARGET_STATUS.VERIFIED_SCHEDULE_ROWS,
  TARGET_STATUS.VERIFIED_SPECIFICATION_ROW,
]);

// Keep the detailed legacy status for existing callers, but expose explicit recognition,
// destination, price and quantity states for import, selection, inclusion and quote workflows.
export function resolveQuotationTarget(options = {}) {
  const detail = resolveQuotationTargetDetail(options);
  const identity = options.identity || {};
  const recognised = Boolean(requirementDefinition(identity.requirementKey));
  const resolved = VERIFIED_TARGET_STATUSES.has(detail.status);
  const ambiguous = (detail.status === TARGET_STATUS.REVIEW_REQUIRED && AMBIGUOUS_REASONS.has(detail.reason))
    || (detail.status === TARGET_STATUS.PROPOSED_MAPPING && detail.candidates?.length > 1);
  const blockers = [];
  if (recognised) blockers.push("REQUIREMENT_RECOGNISED");
  if (resolved) blockers.push("TARGET_RESOLVED");
  else if (ambiguous) blockers.push("TARGET_AMBIGUOUS");
  else blockers.push("TARGET_MISSING");
  if (identity.unitPrice === null || identity.unitPrice === undefined || identity.pricePending || identity.priceIncludesGst === null) blockers.push("PRICE_REQUIRED");
  if (detail.reason === REVIEW_REASON.QUANTITY_REQUIRED) blockers.push("QUANTITY_REQUIRED");
  const resolutionStatus = !recognised ? "TARGET_MISSING"
    : detail.reason === REVIEW_REASON.QUANTITY_REQUIRED ? "QUANTITY_REQUIRED"
      : ambiguous ? "TARGET_AMBIGUOUS" : resolved ? "TARGET_RESOLVED" : "TARGET_MISSING";
  return { ...detail, detailStatus: detail.status, requirementStatus: recognised ? "REQUIREMENT_RECOGNISED" : "REQUIREMENT_UNRECOGNISED", resolutionStatus, resolutionStatuses: blockers };
}

export function selectionIdentitiesFromBook(book = {}) {
  const identities = [];
  for (const room of book?.rooms || []) {
    for (const row of room.rows || []) {
      const identity = selectionIdentity(row, room.name);
      if (!identity.requirementKey || !(row.guidedSelection || row.selected_details || row.selectedDetails || identity.productId)) continue;
      if (["none", ""].includes(text(row.selectedOptionId)) && !(row.guidedSelection || row.selected_details || row.selectedDetails)) continue;
      identities.push(identity);
    }
  }
  return identities;
}

// Verifies every selection and flags any quotation row that more than one selection claims (duplicate charge).
export function reconcileSelectionTargets({ workbook = {}, book = workbook.clientSelectionsBook, mappings = [] } = {}) {
  const identities = selectionIdentitiesFromBook(book);
  const results = identities.map((identity) => ({ identity, target: resolveQuotationTarget({ workbook, identity, mappings }) }));
  const claims = new Map();
  for (const { identity, target } of results) {
    if (target.status === TARGET_STATUS.VERIFIED_SCHEDULE_ROWS) continue;
    for (const rowId of target.rowIds || (target.rowId ? [target.rowId] : [])) {
      const key = `${target.section}\u0000${rowId}`;
      claims.set(key, [...(claims.get(key) || []), identity]);
    }
  }
  // A single allocated row may serve multiple room selections only when it carries each exact location.
  const duplicateCharges = [...claims].filter(([key, owners]) => {
    if (owners.length <= 1) return false;
    const [section, rowId] = key.split("\u0000");
    const row = (workbook.quotation?.[section]?.rows || []).find((item) => item.id === rowId);
    return !(row?.source === ALLOCATED_SELECTION_SOURCE
      && owners.every((identity) => row.productId === identity.productId
        && (row.locationSchedule || []).some((entry) => plumbingLocationKey(entry.location) === plumbingLocationKey(identity.location))));
  }).map(([key, owners]) => ({ section: key.split("\u0000")[0], rowId: key.split("\u0000")[1], identities: owners.map((o) => o.key) }));
  const summary = results.reduce((acc, { target }) => ({ ...acc, [target.status]: (acc[target.status] || 0) + 1 }), {});
  const verified = results.filter(({ target }) => target.status.startsWith("VERIFIED_")).length;
  return { results, duplicateCharges, summary, verified, proposed: summary.PROPOSED_MAPPING || 0, review: summary.REVIEW_REQUIRED || 0 };
}

// Ex-GST base rate only when the basis is stated; an unstated basis is never guessed.
export function resolvedBaseRate(identity = {}) {
  if (identity.unitPrice === null || identity.pricePending) return { rate: null, status: "Price pending", gst: "n/a" };
  if (identity.priceIncludesGst === true) return { rate: Math.round((identity.unitPrice / 1.1) * 10000) / 10000, status: "Current Price", gst: "inc GST price converted to ex GST" };
  if (identity.priceIncludesGst === false) return { rate: identity.unitPrice, status: "Current Price", gst: "ex GST" };
  return { rate: null, status: "Price basis to confirm", gst: "UNCONFIRMED" };
}

const definitionLabel = (requirementKey) => requirementDefinition(requirementKey)?.label || requirementKey;

export function withClientSelectionsHeading(section, sectionName) {
  const headingId = `quotation-subheading:${sectionSlug(sectionName)}:client-selections`;
  const rows = section.rows || [];
  if (rows.some((row) => row.id === headingId || (row.lineType === "Heading" && /client selections/i.test(text(row.item))))) return rows;
  return [...rows, quotationSubheadingRow(sectionName, headingId, "CLIENT SELECTIONS", `${sectionName} - CLIENT SELECTIONS`)];
}

// Applies verified plans plus builder-confirmed mappings (`confirmed`: identity key -> chosen row id).
// Option rows take product fields only (quantity untouched); new rows are idempotent; existing rows are never rewritten.
export function applyResolvedSelectionTargets(workbook = {}, reconciliation = reconcileSelectionTargets({ workbook }), { confirmed = {}, automatic = {} } = {}) {
  const quotation = { ...(workbook.quotation || {}) };
  const mappings = [...(workbook.quoteTargetMappings || [])];
  const applied = [];
  // A builder-level mapping used by this job is copied into the job, so later template edits never rewrite it.
  const snapshotMapping = (target) => {
    const mapping = target.mapping;
    if (!mapping || mappings.some((entry) => entry.quote_row_id === mapping.quote_row_id && (entry.requirement_key || entry.metadata?.requirementKey) === (mapping.requirement_key || mapping.metadata?.requirementKey))) return;
    mappings.push({ ...mapping, metadata: { ...(mapping.metadata || {}), snapshotOf: "builder-template-mapping", builderMappingId: mapping.id ?? null, builderMappingVersion: mapping.version ?? null } });
  };
  const updateRow = (target, identity, mappingSource, { specificationOnly = false } = {}) => {
    const section = quotation[target.section];
    const { rate } = resolvedBaseRate(identity);
    quotation[target.section] = { ...section, rows: section.rows.map((row) => {
      if (row.id !== target.rowId) return row;
      // The selection documents what the row's all-in rate already covers; the rate, quantity and product stay as they are.
      if (specificationOnly) return { ...row, requirementKey: row.requirementKey || identity.requirementKey, selectionSpecProductId: identity.productId, selectionSpec: `${identity.productName}`, selectionMappingSource: mappingSource, selectionSpecificationOnly: true };
      const existingQuoteRate = [row.finalRateUsed, row.manualRate, row.excelRate].map((value) => {
        const parsed = Number(String(value ?? "").replace(/[$,\s]/g, ""));
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      }).find((value) => value !== null);
      const quantityPending = !(finite(row.qty ?? row.quantity) > 0) && identity.quantity > 0;
      const enteredQuantity = mappingSource === "BUILDER_CONFIRMED" && Boolean(identity.enteredArea) && quantityPending && !text(row.quantityKey) && !row.quantityManualOverride && !text(row.formulas?.B);
      const areaFields = enteredQuantity ? { qty: identity.enteredArea.quantity, quantity: String(identity.enteredArea.quantity), unit: identity.enteredArea.unit, quantityManualOverride: false, autoQuantity: false, quantitySource: "CLIENT_SELECTION_BUILDER_ENTERED_AREA", quantityEvidence: { source: identity.enteredArea.source, selectionKey: identity.key } } : {};
      const priceNote = identity.pricePending && rate === null ? {
        priceStatus: "PRICE REQUIRED",
        quoteRequired: true,
        lineType: "Quote required",
        templateRateReference: text(row.manualRate || row.excelRate),
        ...(enteredQuantity && !text(row.manualRate) ? { excelRate: "" } : {}),
      } : {};
      if (rate === null && existingQuoteRate !== undefined) return {
        ...row,
        ...areaFields,
        ...priceNote,
        requirementKey: row.requirementKey || identity.requirementKey,
        selectedProductId: identity.productId,
        selectedProductName: identity.productName,
        selectionMappingSource: mappingSource,
        selectionPricePending: true,
        ...(quantityPending && !enteredQuantity ? { selectionQuantityPending: true, selectionQuantityHint: { quantity: identity.quantity, unit: identity.unit, owner: "TAKEOFF_JOB_SETUP_OR_ESTIMATOR" } } : {}),
      };
      // A baseline that did not come from an inclusion-schedule snapshot is kept for reference but is not a variation baseline.
      const unverified = row.baselineUnitPrice != null && !row.selectionBaselineApplied;
      const source = unverified ? { ...row, baselineUnitPrice: null, unverifiedBaseline: { unitPrice: row.baselineUnitPrice, productId: row.baselineProductId ?? null, source: "EXISTING_QUOTE_VALUE" } } : row;
      const updated = applySelectionProduct(source, { source: "CLIENT_SELECTION", productId: identity.productId, productName: identity.productName, unitPrice: rate });
      // Blank, unlinked option row + builder-entered area: the area becomes the quantity, with its source recorded. Never over a formula, link, takeoff or manual quantity.
      // The engine never reuses an old rate for an unpriced selection: the line is PRICE REQUIRED, with the template rate kept only as a reference.
      return { ...updated, ...areaFields, ...priceNote, requirementKey: identity.requirementKey, selectionMappingSource: mappingSource,
        variationBasis: { status: row.selectionBaselineApplied ? "BASELINE_VERIFIED" : "BASELINE_UNVERIFIED" },
        selectedProductId: identity.productId, selectedProductName: identity.productName,
        ...(updated.activeProductId !== identity.productId ? { selectionManualOverrideRetained: true } : {}),
        ...(quantityPending && !enteredQuantity ? { selectionQuantityPending: true, selectionQuantityHint: { quantity: identity.quantity, unit: identity.unit, owner: "TAKEOFF_JOB_SETUP_OR_ESTIMATOR" } } : {}) };
    }) };
  };
  for (const { identity, target } of reconciliation.results) {
    if (target.status === TARGET_STATUS.REVIEW_REQUIRED || !target.section || !quotation[target.section]) continue;
    if (target.status === TARGET_STATUS.VERIFIED_SPECIFICATION_ROW) {
      snapshotMapping(target);
      updateRow(target, identity, "VERIFIED_SPECIFICATION_ROW", { specificationOnly: true });
      applied.push({ identity: identity.key, action: "LINKED_SPECIFICATION", section: target.section, rowId: target.rowId });
    } else if (target.status === TARGET_STATUS.VERIFIED_MAPPED_ROW || target.status === TARGET_STATUS.VERIFIED_TAGGED_ROW) {
      snapshotMapping(target);
      updateRow(target, identity, target.status);
      applied.push({ identity: identity.key, action: "UPDATED_OPTION_ROW", section: target.section, rowId: target.rowId });
    } else if (target.status === TARGET_STATUS.PROPOSED_MAPPING) {
      const chosenRowId = confirmed[identity.key];
      const candidate = chosenRowId && target.candidates.find((entry) => entry.rowId === chosenRowId);
      if (!candidate) continue;
      const automaticMatch = automatic[identity.key] === candidate.rowId;
      const mapping = { status: "MAPPED", mode: candidate.specificationOnly ? "SPECIFICATION_ONLY" : "PRODUCT_ROW", template_id: workbook.templateKey || "", workspace_id: workbook.workspaceId, requirement_key: identity.requirementKey, product_id: identity.productId || "", location_id: identity.location || "", quote_section_id: candidate.section, quote_row_id: candidate.rowId, metadata: { requirementKey: identity.requirementKey, productId: identity.productId || "", locationId: identity.location || "", confirmedBy: automaticMatch ? "deterministic-resolver" : "builder", itemLabel: candidate.item } };
      mappings.push(mapping);
      updateRow({ section: candidate.section, rowId: candidate.rowId }, identity, automaticMatch ? "DETERMINISTIC_MATCH" : "BUILDER_CONFIRMED", { specificationOnly: candidate.specificationOnly === true });
      applied.push({ identity: identity.key, action: automaticMatch ? "AUTO_LINKED_EXISTING_ROW" : "CONFIRMED_MAPPING", section: candidate.section, rowId: candidate.rowId, mapping });
    } else if (target.status === TARGET_STATUS.VERIFIED_NEW_ROW && confirmed[identity.key] === target.rowId && !quotation[target.section].rows.some((row) => row.id === target.rowId)) {
      const { rate, status } = resolvedBaseRate(identity);
      const section = quotation[target.section];
      const row = {
        id: target.rowId, source: RESOLVED_SELECTION_SOURCE, section: target.section, requirementKey: identity.requirementKey,
        item: [definitionLabel(identity.requirementKey), identity.productName].filter(Boolean).join(" / "),
        productId: identity.productId, productName: identity.productName, productCode: identity.model || "",
        unit: identity.unit || "EACH", qty: identity.quantity, quantity: identity.quantity, quantitySource: target.quantitySource,
        excelRate: rate ?? "", manualRate: "", cost: "", priceStatus: status, quoteRequired: rate === null, included: true, active: true,
        lineType: rate === null ? "Quote required" : "Standard rate item",
        // A new standalone item has no inclusion baseline: an addition, not an upgrade, until a baseline or additional-item treatment is approved.
        variationBasis: { status: "NEW_STANDALONE_ITEM", variation: null },
        productLibrarySnapshot: { productId: identity.productId, productName: identity.productName, selectedUnitPrice: identity.unitPrice, priceIncludesGst: identity.priceIncludesGst, locations: identity.location, catalogueOwner: "product-library" },
      };
      quotation[target.section] = { ...section, rows: [...withClientSelectionsHeading(section, target.section), row] };
      applied.push({ identity: identity.key, action: "ADDED_ROW", section: target.section, rowId: target.rowId });
    }
  }
  if (!applied.length) return { workbook, applied };
  return { workbook: { ...workbook, quotation, ...(mappings.length !== (workbook.quoteTargetMappings || []).length ? { quoteTargetMappings: mappings } : {}) }, applied };
}
