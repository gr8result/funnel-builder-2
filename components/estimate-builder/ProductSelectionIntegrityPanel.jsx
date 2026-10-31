import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { PRODUCT_SELECTION_OUTCOME, reconcileProductSelections } from "../../lib/builders/productSelectionIntegrity.js";
import { quotationRateReviewRows } from "../../lib/builders/quotationRateReview.js";
import { commercialPriceProposalFor } from "../../lib/builders/commercialPriceProposals.js";
import { commercialIssueReview } from "../../lib/builders/commercialIssueReview.js";
import { getEffectiveProductCatalogue } from "../../lib/product-library/catalogueService.js";
import { guidedRequirementByKey, productsForRequirement } from "../../lib/builders/clientSelectionWorkflow.js";

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
  BLOCKED_BUILDER_APPROVAL: "Quotation addition requires builder approval",
};
const warningStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", border: "1px solid #f3c46b", borderRadius: 8, padding: "10px 14px", margin: "12px 0", background: "#fffbeb", color: "#713f12" };
const dialogBackdrop = { position: "fixed", inset: 0, zIndex: 1200, display: "grid", placeItems: "center", padding: 24, background: "rgba(15, 23, 42, 0.55)" };
const reviewStyle = { display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", width: "min(1040px, 100%)", maxHeight: "calc(100vh - 48px)", borderRadius: 12, background: "#fff", boxShadow: "0 24px 60px rgba(15, 23, 42, 0.3)", color: "#1f2937", overflow: "hidden" };
const issueStyle = { display: "grid", gap: 6, border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, background: "#fff", overflowWrap: "anywhere" };
const actionStyle = { display: "grid", gap: 8, padding: 10, borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc" };
const inputStyle = { minWidth: 150, padding: "6px 8px", border: "1px solid #94a3b8", borderRadius: 5 };
const humanCategory = (value = "") => String(value).split("-").filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
const GROUPS = [
  { key: "quotationMapping", label: "Missing quotation mapping" },
  { key: "procurementMapping", label: "Missing procurement mapping" },
  { key: "supplierPricing", label: "Missing supplier pricing" },
  { key: "quotationRates", label: "Missing quotation rates" },
  { key: "cabinetry", label: "Cabinetry setup decisions" },
  { key: "builderApproval", label: "Builder approval required" },
];
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
  if (entry.unpricedOpenings?.length) return [
    `${entry.quantity - entry.unpricedOpenings.length} of ${entry.quantity} openings have verified saved price-list rates. Supplier evidence is still required for ${entry.unpricedOpenings.map(opening => `${opening.size} (${opening.location || "room not set"})`).join(", ")}.`,
    "Create the opening-level RFQ. Keep both custom fixed-glass openings pending until a matching supplier quotation is approved.",
  ];
  if (entry.duplicateIdentity) return ["The same product is selected more than once for this requirement and location.", "Keep one selection or correct its room/location before saving."];
  if (entry.allocationDuplicate) return ["Two allocation labels resolve to the same physical room.", "Keep one room allocation and confirm its quantity before ordering."];
  if (entry.productReferenceInvalid) return ["This product ID is not present in the active builder's Product Library.", "Choose a current product from this workspace or restore the valid Product Library record."];
  if (entry.allocationMissing) return ["This allocated product has no room/location quantity.", "Assign a real project room/location and quantity in Client Selections."];
  if (entry.procurementIssue === "MISSING") return ["No procurement requirement matches this selected product.", "Verify its product, supplier, quantity and room allocations before ordering."];
  if (entry.procurementIssue === "QUANTITY_OR_LOCATION_MISMATCH") return ["Procurement quantities or locations do not cover this selection exactly.", "Correct the procurement requirement to match the selected room quantities."];
  if (entry.targetStatus === "VERIFIED_NEW_ROW" && entry.priceVerified) return ["The Product Library identity, quantity and price are verified, but adding its quotation line changes the approved total.", "Review the exact financial impact and authorise the proposed quotation line."];
  if (entry.outcome === PRODUCT_SELECTION_OUTCOME.BLOCKED_BUILDER_APPROVAL) return [
    `${entry.proposedQuotationMutations?.length || 1} quotation row${entry.proposedQuotationMutations?.length === 1 ? "" : "s"} are required to represent this selected product or schedule.`,
    "Review the item-level rows and explicitly approve the financial impact. No quotation change has been applied.",
  ];
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

function rowDomId(...parts) {
  return parts.join("-").replace(/[^A-Za-z0-9_-]/g, "-");
}

export default function ProductSelectionIntegrityPanel({ sheet, title = "Selected product financial integrity" }) {
  const workbook = sheet.workbook;
  const workspaceId = workbook.workspaceId;
  const [, setMappingVersion] = useState(0);
  const router = useRouter();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [priceApprovals, setPriceApprovals] = useState({});
  const [resolutionDrafts, setResolutionDrafts] = useState({});
  useEffect(() => {
    let active = true;
    sheet.loadBuilderRequirementMappings?.().then(() => { if (active) setMappingVersion((value) => value + 1); });
    return () => { active = false; };
    // The hook returns fresh action closures per render; workspace identity is the reload boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);
  const audit = useMemo(() => sheet.productSelectionIntegrity?.()
    || reconcileProductSelections({ workbook, mappings: sheet.selectionRequirementMappings || [] }), [workbook, sheet.selectionRequirementMappings, sheet.productSelectionIntegrity]);
  const rateReviewRows = useMemo(() => quotationRateReviewRows(sheet.preview?.quotation || {}), [sheet.preview?.quotation]);
  const review = useMemo(() => commercialIssueReview({ audit, rateReviewRows, workbook }), [audit, rateReviewRows, workbook]);
  const gateClear = review.total === 0 && (audit.procurementDuplicates || []).length === 0;
  const quoteRows = useMemo(() => new Map(Object.entries(sheet.preview?.quotation || {}).flatMap(([section, group]) => (group.rows || []).map(row => [row.id, {
    section,
    item: row.item || row.description || "Quotation item",
    quantity: row.qty ?? row.quantity ?? "",
    unit: row.unit || "",
    rate: row.finalRateUsed ?? row.manualRate ?? row.excelRate ?? "",
  }]))), [sheet.preview?.quotation]);
  const catalogueProducts = useMemo(() => getEffectiveProductCatalogue({ organisationId: workspaceId, includeDisabled: false }).products || [], [workspaceId]);
  const groupedIssues = Object.fromEntries(GROUPS.map(group => [group.key, []]));
  review.issues.forEach((issue) => groupedIssues[issue.category].push(issue));
  const totalIssues = review.total;
  const highCount = review.high;
  const mediumCount = review.medium;
  useEffect(() => { setReviewOpen(false); }, [workspaceId, workbook.jobId]);
  const navigateTo = (page, afterNavigate) => {
    sheet.setPage?.(page);
    if (router.isReady) void router.push({ pathname: router.pathname, query: { ...router.query, page } }, undefined, { shallow: true });
    if (afterNavigate && typeof window !== "undefined") {
      [80, 300, 700].forEach(delay => window.setTimeout(afterNavigate, delay));
    }
  };
  const focusQuotationRow = (rowId) => navigateTo("quotation", () => {
    window.dispatchEvent(new CustomEvent("estimate-builder:reveal-quote-row", { detail: { rowId } }));
    const target = document.getElementById(rowDomId("quote-edit", rowId));
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.focus?.();
    target.style.outline = "3px solid #f59e0b";
    window.setTimeout(() => { target.style.outline = ""; }, 2400);
  });
  const openReconciliation = () => navigateTo("quotation", () => document.querySelector('[data-testid="reconcile-selections-open"]')?.click());
  const setPriceApproval = (key, patch) => setPriceApprovals((current) => ({
    ...current,
    [key]: { ...(current[key] || {}), ...patch },
  }));
  const setResolutionDraft = (issueId, patch) => setResolutionDrafts((current) => ({
    ...current,
    [issueId]: { ...(current[issueId] || {}), ...patch },
  }));
  const perform = async (action, success) => {
    try {
      const result = await action();
      setActionMessage(success);
      return result;
    } catch (error) {
      setActionMessage(error?.message || "The commercial resolution could not be saved.");
      return null;
    }
  };
  const previewQuoteChange = (issue, options) => {
    const draft = resolutionDrafts[issue.id] || {};
    try {
      const impact = sheet.previewCommercialIssueQuoteChange({ issueId: issue.id, ...options });
      setResolutionDraft(issue.id, { ...draft, impact, authorised: false, error: "" });
    } catch (error) {
      setResolutionDraft(issue.id, { ...draft, impact: null, authorised: false, error: error?.message || "The financial preview failed." });
    }
  };
  const applyQuoteChange = (issue, options) => {
    const draft = resolutionDrafts[issue.id] || {};
    perform(() => sheet.applyCommercialIssueQuoteChange({ issueId: issue.id, ...options, approvedFinancialImpact: draft.impact }), "Commercial resolution saved.");
  };
  const markNotRequired = (issue) => {
    const reason = resolutionDrafts[issue.id]?.reason;
    perform(() => sheet.markCommercialIssueNotRequired({ issueId: issue.id, reason }), "Issue marked not required with an auditable reason.");
  };
  const createIssueRfq = (issue) => perform(
    () => sheet.createCommercialIssueRfq({ issueId: issue.id, entry: issue.entry, rateGroup: issue.rateGroup }),
    "Linked RFQ created. Supplier price and GST evidence remain pending.",
  );
  const previewPriceProposal = (entry, proposal, linkedRow, basis) => {
    if (!linkedRow || !basis) {
      setPriceApproval(entry.key, { basis, impact: null, authorised: false, error: "" });
      return;
    }
    try {
      const impact = sheet.previewCommercialPriceProposal({
        proposalId: proposal.id,
        section: linkedRow.section,
        rowId: linkedRow.id,
        gstIncluded: basis === "included",
      });
      setPriceApproval(entry.key, { basis, impact, authorised: false, error: "" });
    } catch (error) {
      setPriceApproval(entry.key, { basis, impact: null, authorised: false, error: error?.message || "The financial preview failed." });
    }
  };
  const approvePriceProposal = async (entry, proposal, linkedRow) => {
    const approval = priceApprovals[entry.key];
    try {
      sheet.applyCommercialPriceProposal({
        proposalId: proposal.id,
        section: linkedRow.section,
        rowId: linkedRow.id,
        gstIncluded: approval.basis === "included",
        approvedFinancialImpact: approval.impact,
      });
      const saved = await sheet.saveDraft?.();
      if (saved && !saved.ok) throw new Error(saved.message || "The approved proposal could not be saved.");
      setPriceApproval(entry.key, { ...approval, authorised: false, applied: true, error: "" });
    } catch (error) {
      setPriceApproval(entry.key, { ...approval, authorised: false, error: error?.message || "The proposal could not be applied." });
    }
  };
  if (!audit.selected && !rateReviewRows.length) return null;
  return (
    <section data-testid="product-selection-integrity" aria-label={title}>
      {gateClear ? <p role="status" style={{ ...warningStyle, borderColor: "#86c99a", background: "#f0fdf4", color: "#14532d", margin: "12px 0" }}><strong>Product selections reconciled</strong><span>{audit.selected} selected products have verified commercial outcomes.</span></p> : null}
      {!gateClear ? (
        <div data-testid="selection-integrity-warning" role="alert" style={warningStyle}>
          <div>
            <strong>{totalIssues} commercial issue{totalIssues === 1 ? "" : "s"} require review</strong>
            <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 12 }}>
              {highCount ? <span style={{ borderRadius: 999, padding: "2px 8px", background: "#fee2e2", color: "#991b1b", fontWeight: 700 }}>{highCount} high</span> : null}
              {mediumCount ? <span style={{ borderRadius: 999, padding: "2px 8px", background: "#fef3c7", color: "#92400e", fontWeight: 700 }}>{mediumCount} medium</span> : null}
              <span>Financial approval remains blocked.</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" data-testid="selection-integrity-review" aria-expanded={reviewOpen} onClick={() => setReviewOpen(true)} style={{ border: 0, borderRadius: 6, padding: "8px 12px", background: "#92400e", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Review Issues</button>
          </div>
        </div>
      ) : null}
      {!gateClear && reviewOpen ? (
        <div style={dialogBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-label="Commercial issues requiring review" data-testid="selection-integrity-issues" style={reviewStyle}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
              <div><strong style={{ fontSize: 18 }}>Commercial issue review</strong><div style={{ marginTop: 3, color: "#64748b", fontSize: 13 }}>{totalIssues} unresolved issues grouped by required action</div></div>
              <button type="button" data-testid="selection-integrity-close" onClick={() => setReviewOpen(false)} style={{ padding: "7px 12px" }}>Close</button>
            </header>
            <div style={{ overflowY: "auto", padding: 18, background: "#f8fafc" }}>
              {actionMessage ? <p role="status" style={{ marginTop: 0, padding: 10, borderRadius: 6, background: "#ecfdf5", color: "#065f46" }}>{actionMessage}</p> : null}
              {GROUPS.map((group, groupIndex) => {
                const issues = groupedIssues[group.key];
                if (!issues.length) return null;
                return (
                  <details key={group.key} open={groupIndex === GROUPS.findIndex(item => groupedIssues[item.key].length)} style={{ marginBottom: 12 }} data-testid={`selection-integrity-group-${group.key}`}>
                    <summary style={{ cursor: "pointer", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", fontWeight: 700 }}>{group.label} <span style={{ color: "#64748b" }}>({issues.length})</span></summary>
                    <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                      {issues.map((issue) => {
                        if (issue.kind === "cabinetry") {
                          const entry = issue.entry;
                          const draft = resolutionDrafts[issue.id] || {};
                          const actionKind = entry.action?.kind;
                          return (
                            <article key={issue.id} data-testid="selection-integrity-cabinetry-issue" data-commercial-issue-id={issue.id} style={issueStyle}>
                              <strong>{entry.label || entry.type || "Cabinetry requirement"}</strong>
                              <span><b>Room/location:</b> {entry.room || "Not assigned"} · <b>Quotation section:</b> CABINETRY</span>
                              <span><b>Status:</b> {entry.reason || "Cabinetry setup decision required"}</span>
                              <span><b>Required action:</b> {entry.action?.label || "Complete the exact measurement, classification or selected range before pricing."}</span>
                              <span>No dimension, cabinet type, finish or rate has been inferred.</span>
                              <div style={actionStyle}>
                                {actionKind === "classify" ? (
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                    <label>Cabinet variant{" "}
                                      <select style={inputStyle} value={draft.classification || ""} onChange={(event) => setResolutionDraft(issue.id, { classification: event.target.value })}>
                                        <option value="">Choose exact variant</option>
                                        {(entry.action.options || []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                                      </select>
                                    </label>
                                    <button type="button" disabled={!draft.classification} onClick={() => perform(async () => { sheet.classifyCabinetryLine(entry.action.componentId, draft.classification); return sheet.saveDraft?.(); }, "Cabinet variant saved to Client Selections and quotation reconciliation.")}>Save cabinet variant</button>
                                  </div>
                                ) : null}
                                {["enter-bulkhead-length", "enter-benchtop-length"].includes(actionKind) ? (
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                    <label>Measured length{" "}<input style={inputStyle} type="number" min="0" step="0.01" value={draft.measurement || ""} onChange={(event) => setResolutionDraft(issue.id, { measurement: event.target.value })} /></label>
                                    <span>LM</span>
                                    <button type="button" disabled={!(Number(draft.measurement) > 0)} onClick={() => perform(
                                      async () => { sheet.updateCabinetrySelectionRequirement(entry.requirementId, actionKind === "enter-benchtop-length" ? { kind: "length", value: Number(draft.measurement) } : Number(draft.measurement)); return sheet.saveDraft?.(); },
                                      "Cabinetry measurement saved and synchronized.",
                                    )}>Save measurement</button>
                                  </div>
                                ) : null}
                                {actionKind === "choose-benchtop-range" ? (
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                    <label>Quotation range{" "}
                                      <select style={inputStyle} value={draft.range || ""} onChange={(event) => setResolutionDraft(issue.id, { range: event.target.value })}>
                                        <option value="">Choose range</option>
                                        {(entry.action.options || []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                                      </select>
                                    </label>
                                    <button type="button" disabled={!draft.range} onClick={() => perform(async () => { sheet.updateCabinetrySelectionRequirement(entry.requirementId, { kind: "range", value: draft.range }); return sheet.saveDraft?.(); }, "Benchtop range saved and synchronized.")}>Save range</button>
                                  </div>
                                ) : null}
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {entry.matchedImportKey ? <button type="button" onClick={() => focusQuotationRow(entry.matchedImportKey)}>Open quotation row</button> : null}
                                  <button type="button" onClick={() => navigateTo("clientSelections")}>Open Client Selections</button>
                                </div>
                              </div>
                            </article>
                          );
                        }
                        if (issue.kind === "rate") {
                          const rateGroup = issue.rateGroup;
                          const row = rateGroup.rows[0];
                          const draft = resolutionDrafts[issue.id] || {};
                          const quoteRow = quoteRows.get(row.id);
                          const rateOptions = { section: quoteRow?.section || rateGroup.section, rowId: row.id, supplierRate: draft.rate, gstTreatment: draft.gst, source: draft.source };
                          return (
                            <article key={`rate:${rateGroup.key}`} data-testid="selection-integrity-rate-issue" data-commercial-issue-id={issue.id} style={issueStyle}>
                              <strong>{rateGroup.label}</strong>
                              <span><b>Quotation section:</b> {rateGroup.section} · <b>Affected quantity:</b> {rateGroup.quantity || "Needs confirmation"} {rateGroup.unit}</span>
                              <span><b>Traceable lines:</b> {rateGroup.rows.map(item => item.item || item.id).join("; ")}</span>
                              <span><b>Status:</b> {rateGroup.requiresSupplierQuote ? "Supplier quotation required" : "Builder rate approval required"}</span>
                              <span><b>Required action:</b> {rateGroup.requiresSupplierQuote ? "Record a matching supplier quotation and GST basis." : "Approve the applicable installed builder/trade rate."} No value has been inferred from unrelated rows.</span>
                              <div style={actionStyle}>
                                <strong>{rateGroup.requiresSupplierQuote ? "Enter approved supplier rate" : "Enter approved builder/trade rate"}</strong>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                  <input aria-label={`Rate for ${rateGroup.label}`} style={inputStyle} type="number" min="0" step="0.01" placeholder="Rate" value={draft.rate || ""} onChange={(event) => setResolutionDraft(issue.id, { rate: event.target.value, impact: null, authorised: false })} />
                                  <select aria-label={`GST treatment for ${rateGroup.label}`} style={inputStyle} value={draft.gst || ""} onChange={(event) => setResolutionDraft(issue.id, { gst: event.target.value, impact: null, authorised: false })}>
                                    <option value="">GST treatment</option><option value="included">Includes GST</option><option value="excluded">Excludes GST</option>
                                  </select>
                                  <input aria-label={`Price source for ${rateGroup.label}`} style={{ ...inputStyle, minWidth: 260 }} placeholder="Supplier / quote reference / source" value={draft.source || ""} onChange={(event) => setResolutionDraft(issue.id, { source: event.target.value, impact: null, authorised: false })} />
                                  <button type="button" onClick={() => previewQuoteChange(issue, rateOptions)}>Preview financial change</button>
                                </div>
                                {draft.impact ? <span><b>Exact impact:</b> ${draft.impact.before.toFixed(2)} → ${draft.impact.after.toFixed(2)} ({draft.impact.delta >= 0 ? "+" : ""}${draft.impact.delta.toFixed(2)})</span> : null}
                                {draft.impact ? <label><input type="checkbox" checked={draft.authorised === true} onChange={(event) => setResolutionDraft(issue.id, { authorised: event.target.checked })} /> I approve this exact row and total change.</label> : null}
                                {draft.error ? <span role="alert" style={{ color: "#991b1b" }}>{draft.error}</span> : null}
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button type="button" disabled={!draft.impact || draft.authorised !== true} onClick={() => applyQuoteChange(issue, rateOptions)}>Save approved rate</button>
                                  <button type="button" onClick={() => focusQuotationRow(row.id)}>Open quotation row</button>
                                  {rateGroup.requiresSupplierQuote ? <button type="button" onClick={() => createIssueRfq(issue)}>Create linked RFQ</button> : null}
                                </div>
                              </div>
                            </article>
                          );
                        }
                        const entry = issue.entry;
                        const [explanation, action] = issueCopy(entry);
                        const linkedRows = (entry.quoteRowIds || []).map(id => ({ id, ...quoteRows.get(id) })).filter(row => row.item);
                        const priceProposal = commercialPriceProposalFor(entry);
                        const priceApproval = priceApprovals[entry.key] || {};
                        const draft = resolutionDrafts[issue.id] || {};
                        const targetCandidates = (entry.targetCandidates || []).map((candidate) => ({
                          ...candidate,
                          ...(quoteRows.get(candidate.rowId) || {}),
                          section: candidate.section || quoteRows.get(candidate.rowId)?.section || "",
                        }));
                        const requirement = guidedRequirementByKey(entry.requirementKey) || { requirementKey: entry.requirementKey, familyKey: entry.requirementKey };
                        const selectableProducts = entry.productReferenceInvalid
                          ? productsForRequirement(catalogueProducts, requirement).slice(0, 250)
                          : [];
                        const selectedProduct = selectableProducts.find((product) => product.productId === draft.productId);
                        const pricedRow = linkedRows[0] || (entry.unpricedOpenings?.[0]?.rowId ? { id: entry.unpricedOpenings[0].rowId, ...quoteRows.get(entry.unpricedOpenings[0].rowId) } : null);
                        const manualPriceOptions = pricedRow ? {
                          section: pricedRow.section,
                          rowId: pricedRow.id,
                          supplierRate: draft.rate,
                          gstTreatment: draft.gst,
                          source: draft.source,
                        } : null;
                        const status = entry.duplicateCharge ? "Possible duplicate quotation charge" : entry.outcome?.startsWith("BLOCKED_") ? OUTCOME_LABELS[entry.outcome] : !entry.procurementRepresented ? "Procurement link needs review" : OUTCOME_LABELS[entry.outcome] || "Commercial review required";
                        return (
                          <article key={entry.key} data-testid="selection-integrity-issue" data-commercial-issue-id={issue.id} style={issueStyle}>
                            <strong>{entry.productName || `${humanCategory(entry.requirementKey)} selection`}</strong>
                            <span><b>Room/location:</b> {entry.location || "Project-wide"} · <b>Quotation section:</b> {entry.section || linkedRows[0]?.section || "Target not confirmed"}</span>
                            <span><b>Status:</b> {status}</span>
                            <span>{explanation}</span>
                            <span><b>Required action:</b> {action}</span>
                            {priceProposal ? (
                              <div style={{ display: "grid", gap: 7, padding: 10, borderRadius: 6, border: "1px solid #93c5fd", background: "#eff6ff" }}>
                                <strong>Verified retail reference proposal</strong>
                                <span>{priceProposal.supplier} · {priceProposal.productCode} · {priceProposal.dimensions} · {priceProposal.finish}</span>
                                <span><b>Retail reference:</b> ${priceProposal.price.toFixed(2)} AUD · <b>GST basis:</b> not stated · verified {priceProposal.verifiedAt}</span>
                                <a href={priceProposal.sourceUrl} target="_blank" rel="noreferrer">Open supplier evidence</a>
                                {linkedRows[0] ? (
                                  <>
                                    <label>Builder-confirmed GST treatment{" "}
                                      <select value={priceApproval.basis || ""} onChange={(event) => previewPriceProposal(entry, priceProposal, linkedRows[0], event.target.value)}>
                                        <option value="">Select before approval</option>
                                        <option value="included">Retail reference includes GST</option>
                                        <option value="excluded">Retail reference excludes GST</option>
                                      </select>
                                    </label>
                                    {priceApproval.impact ? <span><b>Financial impact:</b> ${priceApproval.impact.before.toFixed(2)} to ${priceApproval.impact.after.toFixed(2)} ({priceApproval.impact.delta >= 0 ? "+" : ""}${priceApproval.impact.delta.toFixed(2)})</span> : null}
                                    {priceApproval.impact ? <label><input type="checkbox" checked={priceApproval.authorised === true} onChange={(event) => setPriceApproval(entry.key, { authorised: event.target.checked })} /> I authorise this exact retail-reference rate and financial impact.</label> : null}
                                    <button type="button" disabled={!priceApproval.impact || priceApproval.authorised !== true} onClick={() => approvePriceProposal(entry, priceProposal, linkedRows[0])}>Apply approved proposal</button>
                                  </>
                                ) : <span>Confirm the quotation target first; the proposal cannot change a total without a target and explicit approval.</span>}
                                {priceApproval.applied ? <span role="status">Approved proposal applied to the isolated quotation row.</span> : null}
                                {priceApproval.error ? <span role="alert" style={{ color: "#991b1b" }}>{priceApproval.error}</span> : null}
                              </div>
                            ) : null}
                            {group.key === "quotationMapping" && targetCandidates.length ? (
                              <div style={actionStyle}>
                                <strong>Link existing quotation row</strong>
                                <input style={inputStyle} placeholder="Search matching rows" value={draft.rowSearch || ""} onChange={(event) => setResolutionDraft(issue.id, { rowSearch: event.target.value })} />
                                <select aria-label={`Quotation row for ${entry.productName}`} style={inputStyle} value={draft.rowId || ""} onChange={(event) => setResolutionDraft(issue.id, { rowId: event.target.value })}>
                                  <option value="">Choose verified quotation row</option>
                                  {targetCandidates.filter((candidate) => `${candidate.section} ${candidate.item}`.toLowerCase().includes(String(draft.rowSearch || "").toLowerCase())).map((candidate) => (
                                    <option key={`${candidate.section}:${candidate.rowId}`} value={candidate.rowId}>
                                      {candidate.section} · {candidate.item} · {candidate.quantity || "qty not set"} {candidate.unit || ""} · {candidate.rate || "rate not set"}
                                    </option>
                                  ))}
                                </select>
                                <button type="button" disabled={!draft.rowId} onClick={() => perform(
                                  () => sheet.linkCommercialIssueToQuotationRow({ issueId: issue.id, identityKey: entry.identityKey || entry.key, rowId: draft.rowId }),
                                  "Quotation row linked to the saved job-scoped product identity.",
                                )}>Save quotation link</button>
                              </div>
                            ) : null}
                            {entry.productReferenceInvalid ? (
                              <div style={actionStyle}>
                                <strong>Select exact Product Library product</strong>
                                <input style={inputStyle} placeholder="Search Product Library" value={draft.productSearch || ""} onChange={(event) => setResolutionDraft(issue.id, { productSearch: event.target.value })} />
                                <select aria-label={`Product for ${entry.productName}`} style={inputStyle} value={draft.productId || ""} onChange={(event) => setResolutionDraft(issue.id, { productId: event.target.value })}>
                                  <option value="">Choose product</option>
                                  {selectableProducts.filter((product) => `${product.productName} ${product.productCode || ""}`.toLowerCase().includes(String(draft.productSearch || "").toLowerCase())).map((product) => <option key={product.productId} value={product.productId}>{product.productName} · {product.productCode || "no code"}</option>)}
                                </select>
                                <button type="button" disabled={!selectedProduct} onClick={() => perform(
                                  () => sheet.selectCommercialIssueProduct({ issueId: issue.id, selectionRowId: entry.rowId, product: selectedProduct }),
                                  "Product Library identity saved to Client Selections.",
                                )}>Save selected product</button>
                              </div>
                            ) : null}
                            {group.key === "supplierPricing" && manualPriceOptions ? (
                              <div style={actionStyle}>
                                <strong>Enter supplier price</strong>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <input aria-label={`Supplier rate for ${entry.productName}`} style={inputStyle} type="number" min="0" step="0.01" placeholder="Supplier rate" value={draft.rate || ""} onChange={(event) => setResolutionDraft(issue.id, { rate: event.target.value, impact: null, authorised: false })} />
                                  <select aria-label={`GST treatment for ${entry.productName}`} style={inputStyle} value={draft.gst || ""} onChange={(event) => setResolutionDraft(issue.id, { gst: event.target.value, impact: null, authorised: false })}>
                                    <option value="">GST treatment</option><option value="included">Includes GST</option><option value="excluded">Excludes GST</option>
                                  </select>
                                  <input aria-label={`Price source for ${entry.productName}`} style={{ ...inputStyle, minWidth: 260 }} placeholder="Supplier / quote reference / source" value={draft.source || ""} onChange={(event) => setResolutionDraft(issue.id, { source: event.target.value, impact: null, authorised: false })} />
                                  <button type="button" onClick={() => previewQuoteChange(issue, manualPriceOptions)}>Preview financial change</button>
                                </div>
                                {draft.impact ? <span><b>Exact impact:</b> ${draft.impact.before.toFixed(2)} → ${draft.impact.after.toFixed(2)} ({draft.impact.delta >= 0 ? "+" : ""}${draft.impact.delta.toFixed(2)})</span> : null}
                                {draft.impact ? <label><input type="checkbox" checked={draft.authorised === true} onChange={(event) => setResolutionDraft(issue.id, { authorised: event.target.checked })} /> I approve this supplier rate and exact total change.</label> : null}
                                {draft.error ? <span role="alert" style={{ color: "#991b1b" }}>{draft.error}</span> : null}
                                <button type="button" disabled={!draft.impact || draft.authorised !== true} onClick={() => applyQuoteChange(issue, manualPriceOptions)}>Save approved supplier price</button>
                              </div>
                            ) : null}
                            {entry.outcome === PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_QUANTITY && linkedRows[0] ? (
                              <div style={actionStyle}>
                                <strong>Enter measured quantity</strong>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <input aria-label={`Quantity for ${entry.productName}`} style={inputStyle} type="number" min="0" step="0.01" value={draft.quantity || ""} onChange={(event) => setResolutionDraft(issue.id, { quantity: event.target.value, impact: null, authorised: false })} />
                                  <input aria-label={`Unit for ${entry.productName}`} style={inputStyle} value={draft.unit || entry.unit || ""} onChange={(event) => setResolutionDraft(issue.id, { unit: event.target.value, impact: null, authorised: false })} />
                                  <button type="button" onClick={() => previewQuoteChange(issue, { section: linkedRows[0].section, rowId: linkedRows[0].id, quantity: draft.quantity, unit: draft.unit || entry.unit })}>Preview financial change</button>
                                </div>
                                {draft.impact ? <label><input type="checkbox" checked={draft.authorised === true} onChange={(event) => setResolutionDraft(issue.id, { authorised: event.target.checked })} /> I approve the exact measured quantity and total change of {draft.impact.delta >= 0 ? "+" : ""}${draft.impact.delta.toFixed(2)}.</label> : null}
                                <button type="button" disabled={!draft.impact || draft.authorised !== true} onClick={() => applyQuoteChange(issue, { section: linkedRows[0].section, rowId: linkedRows[0].id, quantity: draft.quantity, unit: draft.unit || entry.unit })}>Save measurement</button>
                              </div>
                            ) : null}
                            {["procurementMapping", "supplierPricing"].includes(group.key) ? (
                              <div style={actionStyle}>
                                <strong>Supplier request</strong>
                                <span>Create one issue-linked RFQ. Repeating this action reuses the same canonical RFQ identity.</span>
                                <button type="button" onClick={() => createIssueRfq(issue)}>Create linked RFQ</button>
                              </div>
                            ) : null}
                            {["quotationMapping", "procurementMapping"].includes(group.key) ? (
                              <div style={actionStyle}>
                                <strong>Not required</strong>
                                <input aria-label={`Not required reason for ${entry.productName}`} style={{ ...inputStyle, minWidth: 320 }} placeholder="Auditable reason (required)" value={draft.reason || ""} onChange={(event) => setResolutionDraft(issue.id, { reason: event.target.value })} />
                                <button type="button" disabled={String(draft.reason || "").trim().length < 10} onClick={() => markNotRequired(issue)}>Save justified exclusion</button>
                              </div>
                            ) : null}
                            {(entry.proposedQuotationMutations || []).some((mutation) => ["ADDED", "REPLACED"].includes(mutation.kind)) ? (
                              <div style={actionStyle}>
                                <strong>{entry.proposedQuotationMutations.some((mutation) => mutation.kind === "REPLACED") ? "Approve replacement" : "Create quotation row"}</strong>
                                {(entry.proposedQuotationMutations || []).filter((mutation) => ["ADDED", "REPLACED"].includes(mutation.kind)).map((mutation) => (
                                  <span key={`${mutation.kind}:${mutation.rowId}`}>
                                    <b>{mutation.kind === "REPLACED" ? "Replace" : "Add"}:</b> {mutation.section} · {mutation.item || mutation.rowId}
                                    {mutation.product?.before ? ` · ${mutation.product.before} → ${mutation.product.after}` : ""}
                                    {` · qty ${mutation.quantity?.before || 0} → ${mutation.quantity?.after || 0} · rate ${mutation.rate?.before || 0} → ${mutation.rate?.after || 0}`}
                                  </span>
                                ))}
                                <button type="button" onClick={() => {
                                  try {
                                    const impact = sheet.previewCommercialIssueMutation({
                                      identityKey: entry.identityKey || entry.key,
                                      approveBaseline: entry.proposedQuotationMutations.some((mutation) => mutation.kind === "REPLACED"),
                                    });
                                    setResolutionDraft(issue.id, { mutationImpact: impact, mutationAuthorised: false, error: "" });
                                  } catch (error) {
                                    setResolutionDraft(issue.id, { mutationImpact: null, mutationAuthorised: false, error: error?.message || "The isolated financial preview failed." });
                                  }
                                }}>Preview isolated financial change</button>
                                {draft.mutationImpact ? <span><b>Exact impact:</b> ${draft.mutationImpact.before.toFixed(2)} → ${draft.mutationImpact.after.toFixed(2)} ({draft.mutationImpact.delta >= 0 ? "+" : ""}${draft.mutationImpact.delta.toFixed(2)}) across {draft.mutationImpact.mutations.length} row(s).</span> : null}
                                {draft.mutationImpact ? <label><input type="checkbox" checked={draft.mutationAuthorised === true} onChange={(event) => setResolutionDraft(issue.id, { mutationAuthorised: event.target.checked })} /> I approve only these listed rows and this exact total change.</label> : null}
                                <button type="button" disabled={!draft.mutationImpact || draft.mutationAuthorised !== true} onClick={() => perform(
                                  () => sheet.applyCommercialIssueMutation({
                                    issueId: issue.id,
                                    identityKey: entry.identityKey || entry.key,
                                    approveBaseline: entry.proposedQuotationMutations.some((mutation) => mutation.kind === "REPLACED"),
                                    approvedFinancialImpact: draft.mutationImpact,
                                  }),
                                  "Isolated quotation addition/replacement approved and saved.",
                                )}>Apply approved change</button>
                              </div>
                            ) : null}
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {linkedRows[0] ? <button type="button" onClick={() => focusQuotationRow(linkedRows[0].id)}>Open quotation row</button> : null}
                              {!(entry.proposedQuotationMutations || []).some((mutation) => ["ADDED", "REPLACED"].includes(mutation.kind)) ? <button type="button" onClick={openReconciliation}>Review exact addition/replacement</button> : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
