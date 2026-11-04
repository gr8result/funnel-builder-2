import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { PRODUCT_SELECTION_OUTCOME, reconcileProductSelections } from "../../lib/builders/productSelectionIntegrity.js";

const OUTCOME_LABELS = {
  PRICED_IN_QUOTE: "Priced in quotation",
  VERIFIED_INCLUDED_IN_PACKAGE: "Included in the job package",
  VERIFIED_REPLACEMENT: "Replacement verified",
  BLOCKED_MISSING_PRICE: "Price needs verification",
  BLOCKED_MISSING_QUANTITY: "Quantity needs verification",
  BLOCKED_MISSING_TARGET: "Quotation item not linked",
  BLOCKED_MISSING_ALLOCATION: "Room allocation missing",
  BLOCKED_DUPLICATE_ALLOCATION: "Room allocated more than once",
  BLOCKED_INVALID_PRODUCT_REFERENCE: "Product reference not found",
  BLOCKED_DUPLICATE_SELECTION: "Duplicate selection identity",
  BLOCKED_MISSING_PROCUREMENT: "Procurement requirement missing",
  BLOCKED_UNVERIFIED_BASELINE: "Inclusion baseline not verified",
  BLOCKED_AMBIGUOUS_MAPPING: "Quotation item needs review",
};
const warningStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", border: "1px solid #f3c46b", borderRadius: 8, padding: "10px 14px", margin: "12px 0", background: "#fffbeb", color: "#713f12" };
const reviewStyle = { display: "grid", gap: 10, border: "1px solid #d8dee8", borderRadius: 8, padding: 14, margin: "8px 0 12px", background: "#fff", color: "#1f2937" };
const issueStyle = { display: "grid", gap: 6, borderBottom: "1px solid #e5e7eb", padding: "10px 2px 14px", overflowWrap: "anywhere" };
const humanCategory = (value = "") => String(value).split("-").filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
const TARGET_REASON_TEXT = {
  NO_EXISTING_SYNC: "No quotation sync exists for this selection.",
  NO_OPTION_ROW: "The quotation has no matching option row.",
  SIZE_REQUIRED: "A measured size is needed to choose the correct quotation item.",
  TRADE_SECTION_MISSING: "The quotation has no approved item for this trade.",
  TRADE_SECTION_AMBIGUOUS: "More than one trade section could apply.",
  SCHEDULE_NOT_SYNCED: "The selection schedule has not been linked to quotation items.",
  CONFLICTING_PRODUCT_ON_ROW: "The quotation item already carries a different product.",
  QUANTITY_REQUIRED: "A measured or approved quantity is required.",
  AMBIGUOUS_TARGETS: "More than one quotation item could match.",
  STALE_MAPPING: "The saved quotation link no longer exists.",
};

function issueCopy(entry) {
  if (entry.duplicateCharge) return ["This quotation item is claimed by more than one selected product.", "Review the product-to-quotation links and keep only the intended charge."];
  if (entry.unpricedOpenings?.length) return [`No approved supplier price exists for ${entry.unpricedOpenings.map(opening => `${opening.size} (${opening.location || "room not set"})`).join(", ")}.`, "Request a current supplier quote for each opening before approving the order."];
  if (entry.duplicateIdentity) return ["The same product is selected more than once for this requirement and location.", "Keep one selection or correct its room/location before saving."];
  if (entry.allocationDuplicate) return ["Two allocation labels resolve to the same physical room.", "Keep one room allocation and confirm its quantity before ordering."];
  if (entry.productReferenceInvalid) return ["This product ID is not present in the active builder's Product Library.", "Choose a current product from this workspace or restore the valid Product Library record."];
  if (entry.allocationMissing) return ["This allocated product has no room/location quantity.", "Assign a real project room/location and quantity in Client Selections."];
  if (entry.procurementIssue === "MISSING") return ["No procurement requirement matches this selected product.", "Verify its product, supplier, quantity and room allocations before ordering."];
  if (entry.procurementIssue === "QUANTITY_OR_LOCATION_MISMATCH") return ["Procurement quantities or locations do not cover this selection exactly.", "Correct the procurement requirement to match the selected room quantities."];
  if (entry.outcome === PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_TARGET) return ["No approved quotation item is linked to this selection.", "Review the trade and map it to an existing item, or request approval for an insertion."];
  if (entry.outcome === PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_PRICE) return ["No verified price is available for this selected product.", "Confirm its builder price or supplier quote, including the GST basis."];
  if (entry.outcome === PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_QUANTITY) return ["The selected product has no verified quantity.", "Complete the room quantity in Client Selections or its measured source."];
  if (entry.outcome === PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_TARGET) return ["No approved quotation item is linked to this selection.", "Review the trade and map it to an existing item, or request approval for an insertion."];
  if (entry.outcome === PRODUCT_SELECTION_OUTCOME.BLOCKED_AMBIGUOUS_MAPPING) return ["More than one quotation item could match this selection.", "Choose the correct item; no target has been assigned automatically."];
  if (entry.outcome === PRODUCT_SELECTION_OUTCOME.BLOCKED_UNVERIFIED_BASELINE) return ["The original inclusion allowance has not been verified.", "Confirm the job's saved inclusion baseline before calculating a variation."];
  if (entry.procurementStatus === "DUPLICATE_REQUIREMENT") return ["This product appears more than once in procurement requirements.", "Review its room allocations and remove only a confirmed duplicate."];
  if (!entry.procurementRepresented) return ["This selection is not represented in procurement.", "Verify its quotation and BOQ links before ordering."];
  return ["This selection needs commercial review.", TARGET_REASON_TEXT[entry.targetReason] || "Verify the product, quantity, quotation target and price."];
}

export default function ProductSelectionIntegrityPanel({ sheet, title = "Selected product financial integrity" }) {
  const workbook = sheet.workbook;
  const workspaceId = workbook.workspaceId;
  const [, setMappingVersion] = useState(0);
  const router = useRouter();
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  useEffect(() => {
    let active = true;
    sheet.loadBuilderRequirementMappings?.().then(() => { if (active) setMappingVersion((value) => value + 1); });
    return () => { active = false; };
    // The hook returns fresh action closures per render; workspace identity is the reload boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);
  const audit = useMemo(() => sheet.productSelectionIntegrity?.()
    || reconcileProductSelections({ workbook, mappings: sheet.selectionRequirementMappings || [] }), [workbook, sheet.selectionRequirementMappings, sheet.productSelectionIntegrity]);
  const needsReview = audit.entries.filter((entry) => entry.outcome.startsWith("BLOCKED_") || !entry.procurementRepresented || entry.procurementStatus === "DUPLICATE_REQUIREMENT");
  const gateClear = needsReview.length === 0 && audit.duplicates.length === 0 && audit.procurementDuplicates.length === 0;
  const duplicateKeys = new Set(audit.duplicates.flatMap(item => item.selections || []));
  const reviewEntries = [...new Map([...needsReview, ...audit.entries.filter(entry => duplicateKeys.has(entry.key))].map(entry => [entry.key, { ...entry, duplicateCharge: duplicateKeys.has(entry.key) }])).values()];
  const issueSignature = reviewEntries.map(entry => `${entry.key}:${entry.outcome}:${entry.procurementStatus}:${entry.duplicateCharge}`).join("|");
  const quoteRows = useMemo(() => new Map(Object.entries(workbook.quotation || {}).flatMap(([section, group]) => (group.rows || []).map(row => [row.id, { section, item: row.item || row.description || "Quotation item" }]))), [workbook.quotation]);
  useEffect(() => { setWarningDismissed(false); setReviewOpen(false); }, [workspaceId, workbook.jobId, issueSignature]);
  const navigateTo = (page) => {
    sheet.setPage?.(page);
    if (router.isReady) void router.push({ pathname: router.pathname, query: { ...router.query, page } }, undefined, { shallow: true });
  };
  if (!audit.selected) return null;
  return (
    <section data-testid="product-selection-integrity" aria-label={title}>
      {gateClear ? <p role="status" style={{ ...warningStyle, borderColor: "#86c99a", background: "#f0fdf4", color: "#14532d", margin: "12px 0" }}><strong>Product selections reconciled</strong><span>{audit.selected} selected products have verified commercial outcomes.</span></p> : null}
      {!gateClear && !warningDismissed ? (
        <div data-testid="selection-integrity-warning" role="alert" style={warningStyle}>
          <strong>{reviewEntries.length} selection{reviewEntries.length === 1 ? "" : "s"} need attention before this quotation can be finalised.</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" data-testid="selection-integrity-review" aria-expanded={reviewOpen} onClick={() => setReviewOpen(value => !value)} style={{ border: 0, borderRadius: 6, padding: "8px 12px", background: "#92400e", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{reviewOpen ? "Hide Issues" : "Review Issues"}</button>
            <button type="button" data-testid="selection-integrity-dismiss" onClick={() => setWarningDismissed(true)} style={{ border: "1px solid #b45309", borderRadius: 6, padding: "8px 12px", background: "#fff", color: "#713f12", cursor: "pointer" }}>Dismiss</button>
          </div>
        </div>
      ) : null}
      {!gateClear && warningDismissed && !reviewOpen ? <button type="button" data-testid="selection-integrity-review-dismissed" onClick={() => setReviewOpen(true)} style={{ border: "1px solid #b45309", borderRadius: 6, padding: "8px 12px", margin: "8px 0", background: "#fff", color: "#713f12", cursor: "pointer" }}>Review {reviewEntries.length} selection issues</button> : null}
      {!gateClear && reviewOpen ? (
        <section role="region" aria-label="Selection issues requiring review" data-testid="selection-integrity-issues" style={reviewStyle}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><strong>Selection issues requiring review</strong><button type="button" data-testid="selection-integrity-close" onClick={() => setReviewOpen(false)}>Close</button></header>
          {reviewEntries.map((entry) => {
            const [explanation, action] = issueCopy(entry);
            const linkedRows = entry.quoteRowIds.map(id => quoteRows.get(id)).filter(Boolean);
            const visibleRows = linkedRows.slice(0, 2);
            const remainingRows = Math.max(0, linkedRows.length - visibleRows.length);
            const destination = entry.section ? `${entry.section}${visibleRows.length ? ` · ${visibleRows.map(row => row.item).join(", ")}` : ""}${remainingRows ? ` · ${remainingRows} more quotation items` : ""}` : "Quotation target not confirmed";
            const status = entry.duplicateCharge ? "Possible duplicate quotation charge" : entry.outcome.startsWith("BLOCKED_") ? OUTCOME_LABELS[entry.outcome] : !entry.procurementRepresented ? "Procurement link needs review" : OUTCOME_LABELS[entry.outcome] || "Commercial review required";
            return (
              <article key={entry.key} data-testid="selection-integrity-issue" style={issueStyle}>
                <strong>{entry.productName || `${humanCategory(entry.requirementKey)} selection`}</strong>
                <span><b>Category:</b> {humanCategory(entry.category)} · <b>Room/location:</b> {entry.location || "Project-wide"}</span>
                <span><b>Status:</b> {status}</span>
                <span>{explanation}</span>
                <span><b>Required action:</b> {action}</span>
                <span><b>Quotation:</b> {destination}</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" data-testid="selection-integrity-open-selections" onClick={() => navigateTo("clientSelections")}>Open Client Selections</button>
                  <button type="button" data-testid="selection-integrity-open-quotation" onClick={() => navigateTo("quotation")}>Open Quotation Builder</button>
                </div>
              </article>
            );
          })}
          {audit.duplicates.length || audit.procurementDuplicates.length || audit.duplicateSelectionIdentities?.length ? <p role="alert">Duplicate integrity issues still block finalisation: {audit.duplicates.length} quotation claims, {audit.procurementDuplicates.length} procurement items and {audit.duplicateSelectionIdentities?.length || 0} repeated selections.</p> : null}
        </section>
      ) : null}
    </section>
  );
}
