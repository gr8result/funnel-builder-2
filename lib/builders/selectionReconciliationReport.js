import { windowPriceListTakeoffQuantities } from "../construction-estimation/windowsQuotePriceList.js";
import { quoteLineTotal, quoteQuantity, quoteRate, shouldIncludeQuoteRowInFinalBoq } from "../construction-estimation/finalQuotationBoq.js";
import { resolveQuotationTarget, selectionIdentitiesFromBook } from "./quotationTargetResolver.js";

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const flatten = (quotation = {}) => Object.entries(quotation).flatMap(([section, group]) => (group.rows || []).map((row) => ({ section, row })));
const used = (row) => row.active !== false && (quoteQuantity(row) > 0 || quoteLineTotal(row) > 0);
export const RECONCILIATION_DIAGNOSTIC_LIMIT = 8;

export function auditWindowScheduleQuotation(workbook = {}, calculated = {}) {
  const takeoff = windowPriceListTakeoffQuantities(workbook);
  const rows = flatten(calculated.quotation || workbook.quotation);
  const savedIds = new Set(flatten(workbook.quotation).map(({ row }) => row.id));
  const groups = new Map();
  for (const opening of takeoff.outcomes || []) {
    if (opening.outcome === "elsewhere") continue;
    const customRow = takeoff.unpricedRows.find((row) => row.quantityKey.startsWith("windowPriceList:window|") && row.windowScheduleItemIds.includes(opening.itemId));
    const key = opening.quantityKey || customRow?.quantityKey;
    const group = groups.get(key) || { quantityKey: key, type: customRow?.windowType || key?.split("|")[1], heightMm: opening.heightMm, widthMm: opening.widthMm, scheduleQuantity: 0, openingIds: [], locations: [] };
    group.scheduleQuantity += opening.quantity;
    group.openingIds.push(opening.itemId);
    group.locations.push(opening.location);
    groups.set(key, group);
  }
  const lines = [...groups.values()].map((group) => {
    const matches = rows.filter(({ row }) => row.quantityKey === group.quantityKey);
    const charged = matches.filter(({ row }) => used(row));
    const hasDeterministicTarget = matches.some(({ row }) => savedIds.has(row.id) || row.windowScheduleUnpricedRow === true);
    const quotationQuantity = charged.reduce((sum, { row }) => sum + quoteQuantity(row), 0);
    return {
      ...group,
      matches: matches.map(({ section, row }) => ({ section, rowId: row.id, item: row.item, quantity: quoteQuantity(row), rate: quoteRate(row), cost: quoteLineTotal(row), saved: savedIds.has(row.id), manualQuantity: row.quantityManualOverride === true, manualRate: Boolean(String(row.manualRate || "").trim()) })),
      quotationQuantity,
      extendedCost: round(charged.reduce((sum, { row }) => sum + quoteLineTotal(row), 0)),
      boqQuantity: charged.filter(({ row }) => shouldIncludeQuoteRowInFinalBoq(row)).reduce((sum, { row }) => sum + quoteQuantity(row), 0),
      duplicateCount: Math.max(0, charged.length - 1),
      missingSavedTarget: !hasDeterministicTarget,
      generatedRateTarget: matches.some(({ row }) => row.windowScheduleUnpricedRow === true && !savedIds.has(row.id)),
      missingQuantity: quotationQuantity < group.scheduleQuantity,
      excessQuantity: Math.max(0, quotationQuantity - group.scheduleQuantity),
      missingPrice: !charged.length || charged.some(({ row }) => !(quoteRate(row) > 0)),
    };
  });
  const screenRows = rows.filter(({ row }) => String(row.quantityKey || "").startsWith("windowPriceList:flyscreen|") && used(row));
  const savedCatalogueRows = flatten(workbook.quotation).filter(({ row }) => row.windowPriceListRow && !row.windowPriceListHeading);
  return {
    source: "SAVED_SCHEDULE_AND_CALCULATED_SAVED_QUOTATION",
    scheduleAvailable: Boolean(takeoff.reconciliation && !takeoff.reconciliation.error),
    selectedItems: lines.reduce((sum, line) => sum + line.scheduleQuantity, 0),
    matchedItems: lines.filter((line) => !line.missingSavedTarget).reduce((sum, line) => sum + line.scheduleQuantity, 0),
    missingItems: lines.reduce((sum, line) => sum + (line.missingSavedTarget ? line.scheduleQuantity : Math.max(0, line.scheduleQuantity - line.quotationQuantity)), 0),
    generatedUnsavedItems: lines.filter((line) => line.generatedRateTarget).reduce((sum, line) => sum + line.scheduleQuantity, 0),
    missingPriceItems: lines.filter((line) => line.missingPrice).reduce((sum, line) => sum + line.scheduleQuantity, 0),
    duplicatedRows: lines.reduce((sum, line) => sum + line.duplicateCount, 0),
    excessQuantity: lines.reduce((sum, line) => sum + line.excessQuantity, 0),
    openingCost: round(lines.reduce((sum, line) => sum + line.extendedCost, 0)),
    pricedOpeningRows: lines.flatMap((line) => line.matches).filter((row) => row.quantity > 0 && row.cost > 0).length,
    catalogueRows: savedCatalogueRows.length,
    flyscreenQuantity: screenRows.reduce((sum, { row }) => sum + quoteQuantity(row), 0),
    flyscreenCost: round(screenRows.reduce((sum, { row }) => sum + quoteLineTotal(row), 0)),
    lines,
  };
}

export function selectionReconciliationReports(workbook = {}, calculated = {}) {
  const rows = flatten(calculated.quotation || workbook.quotation);
  const savedIds = new Set(flatten(workbook.quotation).map(({ row }) => row.id));
  const selections = new Map();
  for (const identity of selectionIdentitiesFromBook(workbook.clientSelectionsBook || workbook.selectionsBook)) {
    const key = `${identity.requirementKey}|${identity.productId || identity.productName}`;
    const existing = selections.get(key);
    if (existing) existing.quantity = existing.quantity !== null && identity.quantity !== null ? existing.quantity + identity.quantity : null;
    else selections.set(key, { ...identity, reportKey: key });
  }
  return [...selections.values()].flatMap((identity) => {
    const key = identity.reportKey;
    const target = resolveQuotationTarget({ workbook, identity });
    const ids = new Set(target.rowIds || (target.rowId ? [target.rowId] : []));
    const matches = rows.filter(({ row }) => ids.has(row.id) && used(row));
    if (identity.requirementKey === "windows") {
      const audit = auditWindowScheduleQuotation(workbook, calculated);
      const relevant = audit.lines.flatMap((line) => line.matches);
      return [{ key, requirementKey: identity.requirementKey, productName: identity.productName || "Window project schedule", selectedItems: audit.scheduleAvailable ? audit.selectedItems : null, matchedItems: audit.matchedItems, missingItems: audit.missingItems, duplicatedItems: audit.duplicatedRows, section: [...new Set(relevant.map((row) => row.section))].join(", "), financialStatus: !audit.scheduleAvailable ? "Schedule not verified" : audit.missingPriceItems || audit.missingItems || audit.duplicatedRows || audit.excessQuantity ? `Review required: ${audit.missingPriceItems} unpriced; ${audit.excessQuantity} excess quantity` : "Opening quantities and rates represented; screen scope needs review", diagnostics: relevant.slice(0, RECONCILIATION_DIAGNOSTIC_LIMIT), diagnosticTotal: relevant.length, windowAudit: audit }];
    }
    const actual = matches.map(({ section, row }) => ({ section, rowId: row.id, item: row.item, quantity: quoteQuantity(row), rate: quoteRate(row), cost: quoteLineTotal(row) }));
    const candidateIds = new Set((target.candidates || []).map((candidate) => typeof candidate === "string" ? candidate : candidate.rowId));
    const related = !actual.length ? rows.filter(({ section, row }) => used(row) && (candidateIds.has(row.id) || (identity.productId && [row.productId, row.activeProductId, row.selectedProductId].includes(identity.productId)) || (identity.requirementKey === "stairs" && section === target.section && /stair/i.test(row.item || "")))).map(({ section, row }) => ({ section, rowId: row.id, item: row.item, quantity: quoteQuantity(row), rate: quoteRate(row), cost: quoteLineTotal(row), saved: savedIds.has(row.id), candidate: true })) : [];
    const candidates = (target.candidates || []).slice(0, RECONCILIATION_DIAGNOSTIC_LIMIT).map((candidate) => typeof candidate === "string" ? { rowId: candidate, candidate: true } : { ...candidate, candidate: true });
    const diagnostics = [...actual, ...related, ...candidates.filter((candidate) => !related.some((row) => row.rowId === candidate.rowId))];
    return [{ key, requirementKey: identity.requirementKey, productName: identity.productName || identity.requirementKey, selectedItems: identity.quantity > 0 ? identity.quantity : null, matchedItems: actual.length ? actual.reduce((sum, row) => sum + row.quantity, 0) : 0, missingItems: related.length ? null : identity.quantity > 0 ? Math.max(0, identity.quantity - actual.reduce((sum, row) => sum + row.quantity, 0)) : null, duplicatedItems: actual.length ? actual.length > 1 && !target.rowIds ? actual.length - 1 : 0 : null, section: target.section || "", financialStatus: actual.length ? actual.some((row) => !(row.rate > 0)) ? "Represented; price requires review" : "Represented in saved quote; scope requires review" : related.length ? `${related.length} related charged rows; verify scope before adding or replacing` : "Existing alternatives require review; no new row approved", diagnostics: diagnostics.slice(0, RECONCILIATION_DIAGNOSTIC_LIMIT), diagnosticTotal: diagnostics.length }];
  });
}