import { PRODUCT_SELECTION_OUTCOME } from "./productSelectionIntegrity.js";
import { groupQuotationRateReviewRows } from "./quotationRateReview.js";
import { CABINETRY_ACTION_REQUIRED } from "../construction-estimation/cabinetryRequirements.js";
import { commercialIssueExcluded } from "./commercialIssueResolution.js";

function selectionCategory(entry) {
  if (entry.outcome === PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_PRICE || entry.unpricedOpenings?.length) return "supplierPricing";
  if ([PRODUCT_SELECTION_OUTCOME.BLOCKED_BUILDER_APPROVAL, PRODUCT_SELECTION_OUTCOME.BLOCKED_UNVERIFIED_BASELINE].includes(entry.outcome)
    || (entry.targetStatus === "VERIFIED_NEW_ROW" && entry.priceVerified)) return "builderApproval";
  if ([PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_TARGET, PRODUCT_SELECTION_OUTCOME.BLOCKED_AMBIGUOUS_MAPPING].includes(entry.outcome)) return "quotationMapping";
  if (entry.procurementIssue || !entry.procurementRepresented || entry.procurementStatus === "DUPLICATE_REQUIREMENT") return "procurementMapping";
  return "builderApproval";
}

function selectionSeverity(entry) {
  if (entry.duplicateCharge || entry.duplicateIdentity || entry.productReferenceInvalid) return "High";
  if ([PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_PRICE, PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_TARGET, PRODUCT_SELECTION_OUTCOME.BLOCKED_AMBIGUOUS_MAPPING, PRODUCT_SELECTION_OUTCOME.BLOCKED_UNVERIFIED_BASELINE, PRODUCT_SELECTION_OUTCOME.BLOCKED_BUILDER_APPROVAL].includes(entry.outcome)) return "High";
  return "Medium";
}

function cabinetryOutcome(entry = {}) {
  return entry.outcome || (entry.status === "MATCHED TO QUOTE ROW" ? "MATCHED" : CABINETRY_ACTION_REQUIRED);
}

export function cabinetryCommercialIssues(workbook = {}) {
  return (workbook.cabinetryReconciliation?.entries || [])
    .filter((entry) => cabinetryOutcome(entry) === CABINETRY_ACTION_REQUIRED)
    .map((entry) => ({
      id: `cabinetry:${entry.requirementId}`,
      kind: "cabinetry",
      category: "cabinetry",
      severity: "Medium",
      financiallyBlocking: true,
      entry,
    }));
}

export function commercialIssueReview({ audit = {}, rateReviewRows = [], workbook = {} } = {}) {
  const entries = audit.entries || [];
  const needsReview = entries.filter((entry) => entry.outcome?.startsWith("BLOCKED_") || !entry.procurementRepresented || entry.procurementStatus === "DUPLICATE_REQUIREMENT");
  const duplicateKeys = new Set((audit.duplicates || []).flatMap((item) => item.selections || []));
  const reviewEntries = [...new Map(
    [...needsReview, ...entries.filter((entry) => duplicateKeys.has(entry.key))]
      .map((entry) => [entry.key, { ...entry, duplicateCharge: duplicateKeys.has(entry.key) }]),
  ).values()];
  const selectionQuoteRowIds = new Set(reviewEntries.flatMap((entry) => [
    ...(entry.quoteRowIds || []),
    ...(entry.unpricedOpenings || []).map((opening) => opening.rowId),
  ]).filter(Boolean));
  const standaloneRateRows = rateReviewRows.filter((row) => !selectionQuoteRowIds.has(row.id));
  const selectionIssues = reviewEntries.map((entry) => ({
    id: `selection:${entry.key}`,
    kind: "selection",
    category: selectionCategory(entry),
    severity: selectionSeverity(entry),
    financiallyBlocking: true,
    entry,
  }));
  const rateIssues = groupQuotationRateReviewRows(standaloneRateRows).map((rateGroup) => ({
    id: `rate:${rateGroup.key}`,
    kind: "rate",
    category: "quotationRates",
    severity: "High",
    financiallyBlocking: true,
    rateGroup,
  }));
  const cabinetryIssues = cabinetryCommercialIssues(workbook);
  const issues = [...selectionIssues, ...rateIssues, ...cabinetryIssues]
    .filter((issue) => !commercialIssueExcluded(workbook, issue.id));
  return {
    issues,
    reviewEntries,
    standaloneRateRows,
    standaloneRateGroups: rateIssues.map((issue) => issue.rateGroup),
    selectionIssues,
    rateIssues,
    cabinetryIssues,
    total: issues.length,
    high: issues.filter((issue) => issue.severity === "High").length,
    medium: issues.filter((issue) => issue.severity === "Medium").length,
    financiallyBlocked: issues.some((issue) => issue.financiallyBlocking),
  };
}
