import { useMemo, useState } from "react";
import { selectionReconciliationReports } from "../../lib/builders/selectionReconciliationReport.js";

const money = (value) => (value === "" || value === null || value === undefined ? "—" : Number.isFinite(Number(String(value).replace(/[$,]/g, ""))) ? `$${Number(String(value).replace(/[$,]/g, "")).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(value));
const REASON_TEXT = {
  NO_EXISTING_SYNC: "No quotation sync exists for this schedule. Approve a connector or a target trade section.",
  NO_OPTION_ROW: "The trade section has no matching priced row. Approve a new row or choose a mapping.",
  SIZE_REQUIRED: "The selection has no size. The measured size from Job Setup / Takeoff chooses the option row.",
  TRADE_SECTION_MISSING: "The template has no matching trade section. Approval is needed before one is added.",
  TRADE_SECTION_AMBIGUOUS: "More than one trade section fits. Name the section to use.",
  SCHEDULE_NOT_SYNCED: "The schedule has not written quotation rows yet.",
  CONFLICTING_PRODUCT_ON_ROW: "The quotation already charges a different product for this requirement.",
  QUANTITY_REQUIRED: "No quantity is supplied. AI Takeoff, Job Setup or the estimator must provide it.",
  AMBIGUOUS_TARGETS: "More than one existing row could carry this product.",
  STALE_MAPPING: "A saved mapping points at a row that no longer exists.",
};

const cell = { padding: "4px 8px", borderBottom: "1px solid #e2e8f0", textAlign: "left", verticalAlign: "top", fontSize: 12 };
const box = { border: "1px solid #cbd5e1", borderRadius: 8, padding: 12, background: "#fff", marginBottom: 12 };

function Table({ head, rows, testId }) {
  return (
    <table data-testid={testId} style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr>{head.map((label) => <th key={label} style={{ ...cell, background: "#f1f5f9", fontWeight: 600 }}>{label}</th>)}</tr></thead>
      <tbody>{rows.map((cells, index) => <tr key={index}>{cells.map((value, column) => <td key={column} style={cell}>{value}</td>)}</tr>)}</tbody>
    </table>
  );
}

// Explicit "Reconcile Selections": preview first, nothing is written until the estimator confirms.
export default function SelectionReconcilePanel({ sheet, readonly }) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState({});
  const [confirmedFixtureTargets, setConfirmedFixtureTargets] = useState({});
  const [approved, setApproved] = useState({});
  const [approvedQty, setApprovedQty] = useState({});
  const [pending, setPending] = useState({});
  const [approvedFinancialChange, setApprovedFinancialChange] = useState(null);
  const [mappingsReady, setMappingsReady] = useState(false);
  const [saveForBuilder, setSaveForBuilder] = useState(true);
  const [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const hasSelections = Boolean(sheet.workbook?.clientSelectionsBook?.rooms?.length);
  const savedReports = useMemo(() => open ? selectionReconciliationReports(sheet.workbook, sheet.preview) : [], [open, sheet.workbook, sheet.preview]);

  const plan = useMemo(() => {
    if (!open || !mappingsReady) return null;
    try { setError(""); return sheet.previewSelectionReconciliation({ confirmed, confirmedFixtureTargets, approvedBaselines: approved, approvedQuantities: approvedQty }); }
    catch (cause) { setError(cause?.message || "The preview could not be built."); return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mappingsReady, confirmed, confirmedFixtureTargets, approved, approvedQty, sheet.workbook, sheet.selectionRequirementMappings]);

  if (readonly || !hasSelections) return null;
  const changeCount = plan ? plan.changes.filter((change) => change.kind !== "UPDATED" || change.baseline !== "NOT_APPLICABLE").length : 0;
  const financialImpact = plan?.financialImpact;
  const financialApprovalMatches = Boolean(approvedFinancialChange && financialImpact
    && approvedFinancialChange.before === financialImpact.before
    && approvedFinancialChange.after === financialImpact.after
    && approvedFinancialChange.delta === financialImpact.delta
    && approvedFinancialChange.signature === financialImpact.signature);
  const hasDecision = (key) => pending[key] === true;
  const proposalDecisionsComplete = plan ? plan.proposals.every((proposal) => Object.prototype.hasOwnProperty.call(confirmed, proposal.identityKey)) : false;
  const heldDecisionsComplete = plan ? plan.held.every((item) => hasDecision(`target:${item.identityKey}`)) : false;
  const priceDecisionsComplete = plan ? plan.priceProblems.every((item) => hasDecision(`price:${item.identityKey}`)) : false;
  const replacementDecisionsComplete = plan ? plan.replacements.every((item) => approved[item.rowId] === true || hasDecision(`baseline:${item.rowId}`)) : false;
  const fixtureDecisionsComplete = plan ? plan.fixtures.every((item) => item.target?.rowId || hasDecision(`fixture:${item.key}`)) : false;
  const commercialDecisionsComplete = proposalDecisionsComplete && heldDecisionsComplete && priceDecisionsComplete && replacementDecisionsComplete && fixtureDecisionsComplete;
  const choose = (identityKey, rowId) => { setConfirmed((current) => ({ ...current, [identityKey]: rowId })); setApprovedFinancialChange(false); setReviewed(false); };
  const chooseFixtureTarget = (fixture, target) => { setConfirmedFixtureTargets((current) => ({ ...current, [fixture.key]: target || null })); setApprovedFinancialChange(false); setReviewed(false); };
  const approve = (rowId, value) => { setApproved((current) => ({ ...current, [rowId]: value })); if (value) setPending((current) => ({ ...current, [`baseline:${rowId}`]: false })); setApprovedFinancialChange(false); setReviewed(false); };
  const leavePending = (key, value) => { setPending((current) => ({ ...current, [key]: value })); setApprovedFinancialChange(false); setReviewed(false); };
  const apply = async () => {
    try {
      const hasReusableTarget = plan.proposals.some((proposal) => proposal.proposalKind !== "NEW_QUOTE_ROW" && confirmed[proposal.identityKey])
        || Object.keys(confirmedFixtureTargets).some((key) => confirmedFixtureTargets[key]?.rowId);
      const result = await sheet.applySelectionReconciliation({ confirmed, confirmedFixtureTargets, approvedBaselines: approved, approvedQuantities: approvedQty, acknowledgedPending: Object.keys(pending).filter((key) => pending[key] === true), approvedFinancialImpact: financialApprovalMatches ? approvedFinancialChange : null, saveForBuilder: saveForBuilder && hasReusableTarget });
      setMessage(`Applied: ${result.added} added, ${result.replaced} replaced, ${result.confirmedMappings} mappings confirmed${result.savedForBuilder ? ` (${result.savedForBuilder} saved for this builder's other jobs)` : ""}. ${result.held} held for approval.${result.saveErrors?.length ? ` Mapping not saved for reuse: ${result.saveErrors.join("; ")}` : ""}`);
      setOpen(false); setConfirmed({}); setConfirmedFixtureTargets({}); setApproved({}); setApprovedQty({}); setPending({}); setApprovedFinancialChange(false); setReviewed(false);
    } catch (cause) { setError(cause?.message || "Apply failed."); }
  };

  return (
    <div data-testid="reconcile-selections">
      <button type="button" data-testid="reconcile-selections-open" style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #0f766e", background: "#0f766e", color: "#fff", cursor: "pointer" }} onClick={async () => { setMessage(""); setMappingsReady(false); setApprovedFinancialChange(false); setOpen(true); await sheet.loadBuilderRequirementMappings(); setMappingsReady(true); }}>Reconcile Selections</button>
      {message ? <span data-testid="reconcile-selections-message" style={{ marginLeft: 12, color: "#0f766e" }}>{message}</span> : null}
      {open ? (
        <section role="dialog" aria-label="Reconcile Selections preview" data-testid="reconcile-selections-preview" style={{ ...box, marginTop: 12, background: "#f8fafc" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong>Reconcile Selections — preview (nothing is saved until you confirm)</strong>
            <button type="button" onClick={() => setOpen(false)}>Close</button>
          </header>
          {error ? <p role="alert" style={{ color: "#b91c1c" }}>{error}</p> : null}
          {!plan && !error ? <p>Building preview…</p> : null}
          {plan ? (
            <>
              <p data-testid="reconcile-summary" style={{ fontSize: 13 }}>
                {plan.mutationSummary.selectionRecords} selection records resolved to {plan.mutationSummary.concreteProductDecisions} product/location decisions · rows {plan.totals.rowsBefore} → {plan.totals.rowsAfter} · sections {plan.totals.sectionsBefore} → {plan.totals.sectionsAfter} ·
                {" "}{plan.mutationSummary.addedRows} quote rows to add across {plan.mutationSummary.addedSelectionDecisions} selection decision{plan.mutationSummary.addedSelectionDecisions === 1 ? "" : "s"} ·
                {" "}{plan.mutationSummary.replacementRows} replacement rows across {plan.mutationSummary.replacementSelectionDecisions} selection decision{plan.mutationSummary.replacementSelectionDecisions === 1 ? "" : "s"} ·
                {" "}{plan.proposals.length} target decisions to confirm · {plan.held.length} held for approval ·
                {" "}<span data-testid="reconcile-duplicates" style={{ fontWeight: 600, color: plan.duplicates.length ? "#b91c1c" : "#15803d" }}>{plan.duplicates.length ? `${plan.duplicates.length} possible duplicate charges` : "no duplicate charges"}</span>
              </p>

              <div style={box} data-testid="reconcile-target-statuses">
                <strong>Actual saved selection and quotation evidence</strong>
                <p data-testid="reconcile-target-summary" style={{ fontSize: 12 }}>
                  Requirements recognised: {plan.targetSummary.requirementRecognised} · targets resolved: {plan.targetSummary.targetResolved} · missing: {plan.targetSummary.targetMissing} · ambiguous: {plan.targetSummary.targetAmbiguous} · price required: {plan.targetSummary.priceRequired} · quantity required: {plan.targetSummary.quantityRequired}
                </p>
                <Table testId="reconcile-saved-requirements" head={["Product or schedule", "Selected items", "Matched quantity", "Missing quantity", "Duplicate rows", "Financial status", "Review"]} rows={savedReports.map((result) => [
                  <span key="name" data-testid={`reconcile-saved-${result.requirementKey}`}>{result.productName}<br />{result.section || "Destination requires review"}</span>,
                  result.selectedItems ?? "Not verified",
                  result.matchedItems,
                  result.missingItems ?? "Not verified",
                  result.duplicatedItems ?? "Not verified",
                  result.financialStatus,
                  <details key="review" data-testid={`reconcile-diagnostics-${result.requirementKey}`}>
                    <summary style={{ cursor: "pointer" }}>Review evidence</summary>
                    {result.windowAudit ? <p style={{ fontSize: 12 }}>{result.windowAudit.flyscreenQuantity} calculated flyscreens: {money(result.windowAudit.flyscreenCost)}. Screen scope requires approval review; these are not additional windows. BOQ quantities below are quotation projections, not confirmed saved commercial requirements.</p> : null}
                    {result.windowAudit ? <Table head={["Type / dimensions (H x W)", "Schedule qty", "Quote qty", "Rate", "Extended cost", "BOQ projection qty", "Duplicates", "Missing"]} rows={result.windowAudit.lines.map((line) => [
                      `${line.type} ${line.heightMm} x ${line.widthMm}`,
                      line.scheduleQuantity,
                      line.quotationQuantity,
                      line.missingPrice ? "Rate required" : line.matches.length === 1 ? money(line.matches[0].rate) : "Review matches",
                      money(line.extendedCost),
                      line.boqQuantity,
                      line.duplicateCount,
                      [line.missingSavedTarget ? "Saved target" : "", line.missingQuantity ? "Quantity" : "", line.missingPrice ? "Quotation blocked: price required" : ""].filter(Boolean).join(", ") || "None",
                    ])} /> : null}
                    <details><summary style={{ cursor: "pointer" }}>Technical matches ({Math.min(result.diagnosticTotal, 8)} of {result.diagnosticTotal})</summary>
                      <ul>{result.diagnostics.map((entry, index) => <li key={`${entry.rowId}:${index}`} style={{ overflowWrap: "anywhere" }}>{entry.candidate ? "Candidate, not an approved match: " : entry.saved === false ? "Calculated, not saved: " : "Actual match: "}{entry.item || entry.label || "Quotation row"} · {entry.section || result.section} · {entry.rowId}</li>)}</ul>
                    </details>
                  </details>,
                ])} />
              </div>

              {plan.replacements.length ? (
                <div style={box} data-testid="reconcile-replacements">
                  <strong>Product replacements (original inclusion baseline retained)</strong>
                  <Table head={["Row", "Current in quote", "Selected", "Baseline retained", "Proposed variation", "Approve baseline"]} rows={plan.replacements.map((r) => [
                    `${r.section} › ${r.rowId.split(":").slice(0, 2).join(":")}`,
                    `${r.from.productName} (${money(r.from.rateExGst)} ex GST)`,
                    `${r.to.productName} (${money(r.to.unitIncGst)} inc GST)`,
                    `${money(r.retainedBaseline.allowancePerUnit)} per unit (${r.retainedBaseline.source})`,
                    r.proposedVariation === null ? "Not calculable" : money(r.proposedVariation),
                    <span key="a">
                      <label><input type="checkbox" data-testid={`approve-baseline-${r.rowId}`} checked={approved[r.rowId] === true} onChange={(event) => approve(r.rowId, event.target.checked)} /> Verified baseline</label>
                      <br />
                      <label><input type="checkbox" data-testid={`pending-baseline-${r.rowId}`} checked={hasDecision(`baseline:${r.rowId}`)} onChange={(event) => { leavePending(`baseline:${r.rowId}`, event.target.checked); if (event.target.checked) setApproved((current) => ({ ...current, [r.rowId]: false })); }} /> Leave pending builder approval</label>
                    </span>,
                  ])} />
                  <p style={{ fontSize: 12 }}>No variation is stored until the baseline is approved. This job has no inclusion schedule snapshot, so the allowance on the original row is the only baseline available.</p>
                </div>
              ) : null}

              {plan.proposals.length ? (
                <div style={box} data-testid="reconcile-proposals">
                  <strong>Target and new-charge decisions to confirm</strong>
                  {plan.proposals.map((p) => (
                    <fieldset key={p.identityKey} style={{ border: "1px solid #e2e8f0", margin: "8px 0" }}>
                      <legend style={{ fontSize: 12 }}>{p.proposalKind === "NEW_QUOTE_ROW" ? "New quote row" : "Existing quotation target"} · {p.requirementKey} · {p.productName} → {p.section}{p.trade ? ` (${p.trade})` : ""}</legend>
                      <div style={{ fontSize: 12 }}>{p.proposalKind === "NEW_QUOTE_ROW" ? `Selected quantity ${p.selection.quantity ?? "—"} ${p.selection.unit} will be added only when this row is selected` : p.enteredArea ? `Builder-entered area ${p.enteredArea.quantity} ${p.enteredArea.unit} (${p.enteredArea.source}) becomes the quantity of a blank row` : `Selection quantity ${p.selection.quantity ?? "—"} ${p.selection.unit} is NOT applied`} · price {money(p.selection.unitPrice)} ({p.selection.gst}){p.selection.unitPrice === null ? " · PRICE REQUIRED: supplier pricing remains blocked" : ""}</div>
                      {p.alsoPresent?.length ? <div data-testid={`also-present-${p.requirementKey}`} style={{ fontSize: 12, color: "#b45309" }}>Similar rows elsewhere (check for a second charge): {p.alsoPresent.map((c) => `${c.section} › ${c.item}`).join("; ")}</div> : null}
                      {p.candidates.map((c) => (
                        <label key={c.rowId} style={{ display: "block", fontSize: 12 }}>
                          <input type="radio" name={`map-${p.identityKey}`} data-testid={`map-${p.requirementKey}-${c.rowId}`} checked={confirmed[p.identityKey] === c.rowId} onChange={() => choose(p.identityKey, c.rowId)} />
                          {" "}{c.item} · row {c.rowId} · qty {c.quantity ?? "blank"} {c.unit} · rate {c.rate || "—"} · match {Math.round(c.score * 100)}%{c.sizeMismatch ? " · size differs" : ""}{p.recommendedRowId === c.rowId ? " · recommended" : ""}
                        </label>
                      ))}
                      <label style={{ fontSize: 12 }}><input type="radio" name={`map-${p.identityKey}`} checked={Object.prototype.hasOwnProperty.call(confirmed, p.identityKey) && !confirmed[p.identityKey]} onChange={() => choose(p.identityKey, "")} /> Leave unmapped / pending builder decision</label>
                    </fieldset>
                  ))}
                </div>
              ) : null}

              {plan.fixtures?.length ? (
                <div style={box} data-testid="reconcile-lighting-fans">
                  <strong>Lighting and ceiling fan reconciliation</strong>
                  <p style={{ fontSize: 12 }}>Selected products stay separate by Product Library identity and saved room allocations. Existing quotation quantities are never changed here; map each fixture to its installation row, then approve any quantity adjustment separately.</p>
                  <Table head={["Requirement / selected fixture", "Selected quantity", "Existing quote target", "Quote quantity", "Difference", "Unmatched locations / action"]} rows={plan.fixtures.map((fixture) => [
                    `${fixture.requirementKey} · ${fixture.productName} (${fixture.model || fixture.productId})`,
                    `${fixture.selectedQuantity} ${fixture.unit} · ${fixture.allocations.map((allocation) => `${allocation.location} ×${allocation.quantity}`).join(", ")}`,
                    <select key="target" aria-label={`Quotation target for ${fixture.productName}`} data-testid={`fixture-target-${fixture.productId}`} value={fixture.target?.rowId || ""} onChange={(event) => {
                      const candidate = fixture.candidates.find((item) => item.rowId === event.target.value);
                      chooseFixtureTarget(fixture, candidate ? { rowId: candidate.rowId, section: candidate.section } : null);
                    }}>
                      <option value="">Choose a quotation row</option>
                      {fixture.candidates.map((candidate) => <option key={`${candidate.section}:${candidate.rowId}`} value={candidate.rowId}>{candidate.section} · {candidate.label} · qty {candidate.quantity ?? "—"}</option>)}
                    </select>,
                    fixture.target?.quantity ?? "—",
                    fixture.difference === null ? "—" : `${fixture.difference > 0 ? "+" : ""}${fixture.difference}`,
                    <span key="action">
                      {`${fixture.unmatchedLocations.length ? fixture.unmatchedLocations.join(", ") : "All listed locations mapped"} · ${fixture.action}`}
                      {!fixture.target?.rowId ? <><br /><label><input type="checkbox" data-testid={`pending-fixture-${fixture.key}`} checked={hasDecision(`fixture:${fixture.key}`)} onChange={(event) => leavePending(`fixture:${fixture.key}`, event.target.checked)} /> Leave pending allocation</label></> : null}
                    </span>,
                  ])} />
                  <p style={{ fontSize: 12 }}>A blank target remains for review or confirmation as a genuine additional item. No fixture is discarded and no quotation line or manual rate is overwritten.</p>
                </div>
              ) : null}

              <div style={box} data-testid="reconcile-changes">
                <strong>Changes to the quotation</strong>
                <Table head={["Change", "Destination section › row", "Product", "Quantity (source)", "Rate (source / GST)", "Variation baseline"]} rows={plan.changes.filter((c) => c.baseline !== "NOT_APPLICABLE" || c.kind !== "UPDATED").slice(0, 200).map((c) => [
                  c.kind,
                  `${c.section} › ${c.item || c.rowId}`,
                  c.product.before && c.product.before !== c.product.after ? `${c.product.before} → ${c.product.after}` : c.product.after,
                  `${c.quantity.before !== "" && c.quantity.before !== c.quantity.after ? `${c.quantity.before} → ` : ""}${c.quantity.after === "" ? "blank" : c.quantity.after} (${c.quantity.source}${c.quantity.pending ? `; selection suggests ${c.quantity.hint?.quantity} ${c.quantity.hint?.unit || ""}, not applied` : ""})`,
                  `${money(c.rate.after)} (${c.rate.source}; ${c.rate.gstBasis})${c.priceMissing ? " — PRICE MISSING" : ""}`,
                  c.baseline,
                ])} />
                {changeCount === 0 ? <p>No quotation changes are needed.</p> : null}
              </div>

              {plan.quantityChecks.length ? (
                <div style={{ ...box, borderColor: plan.blocking.length ? "#b91c1c" : "#cbd5e1" }} data-testid="reconcile-quantity-checks">
                  <strong>Quantity changes to verify (from selected locations, not a room count)</strong>
                  <Table head={["Row", "Quote", "Selection", "Locations", "Status"]} rows={plan.quantityChecks.map((q) => [
                    q.rowId, q.from, q.to, q.locations.join(", "),
                    q.status === "DUPLICATE_LOCATION_ALIAS"
                      ? `Blocked: ${q.duplicates.map((pair) => pair.join(" = ")).join("; ")} look like the same room. Merge the rooms in Client Selections; ${q.distinctLocations} distinct locations.`
                      : <label key="q"><input type="checkbox" data-testid={`approve-quantity-${q.rowId}`} checked={approvedQty[q.rowId] === true} onChange={(event) => { setApprovedQty((current) => ({ ...current, [q.rowId]: event.target.checked })); setApprovedFinancialChange(false); setReviewed(false); }} /> Locations verified</label>,
                  ])} />
                </div>
              ) : null}

              {plan.priceProblems.length ? (
                <div style={box} data-testid="reconcile-price-problems">
                  <strong>Prices / GST basis not confirmed (left blank, never guessed)</strong>
                  <ul style={{ fontSize: 12 }}>{plan.priceProblems.map((p) => <li key={p.identityKey}>{p.requirementKey}: {p.productName} — {p.issue === "PRICE_PENDING" ? "price pending" : "GST basis unconfirmed"}{" "}
                    <label><input type="checkbox" data-testid={`pending-price-${p.identityKey}`} checked={hasDecision(`price:${p.identityKey}`)} onChange={(event) => leavePending(`price:${p.identityKey}`, event.target.checked)} /> Keep pending</label>
                  </li>)}</ul>
                </div>
              ) : null}

              {plan.financialImpact ? (
                <div style={{ ...box, borderColor: plan.financialImpact.delta === 0 ? "#86c99a" : "#f3c46b" }} data-testid="reconcile-financial-impact">
                  <strong>Quotation total impact</strong>
                  <p style={{ fontSize: 12, marginBottom: 0 }}>Current {money(plan.financialImpact.before)} · proposed {money(plan.financialImpact.after)} · change {money(plan.financialImpact.delta)}</p>
                  {plan.financialImpact.rowChanges.length ? <Table head={["Quotation line", "Before qty × rate", "Proposed qty × rate", "Delta"]} rows={plan.financialImpact.rowChanges.slice(0, 20).map((change) => [
                    `${change.section} › ${change.item}`,
                    `${change.before.quantity} × ${money(change.before.rate)}`,
                    `${change.after.quantity} × ${money(change.after.rate)}`,
                    money(change.delta),
                  ])} /> : null}
                  {plan.financialImpact.rowChanges.length > 20 ? <p style={{ fontSize: 12 }}>Showing 20 of {plan.financialImpact.rowChanges.length} changed quote lines.</p> : null}
                  {plan.financialImpact.requiresApproval ? <label style={{ display: "block", marginTop: 8 }}><input type="checkbox" data-testid="approve-financial-change" checked={financialApprovalMatches} onChange={(event) => { setApprovedFinancialChange(event.target.checked ? plan.financialImpact : null); setReviewed(false); }} /> Approve these exact quotation line changes and total change</label> : <p style={{ fontSize: 12, marginBottom: 0 }}>No quotation line or total change.</p>}
                </div>
              ) : null}

              {plan.held.length ? (
                <div style={box} data-testid="reconcile-held">
                  <strong>Held for approval (nothing is created for these)</strong>
                  <Table head={["Requirement", "Product", "Trade / section", "Reason / decision"]} rows={plan.held.map((h) => [h.requirementKey, h.productName, [h.trade, h.section].filter(Boolean).join(" · ") || "—", <span key="decision">{REASON_TEXT[h.reason] || h.detail || h.reason}<br /><label><input type="checkbox" data-testid={`pending-target-${h.identityKey}`} checked={hasDecision(`target:${h.identityKey}`)} onChange={(event) => leavePending(`target:${h.identityKey}`, event.target.checked)} /> Leave pending builder decision</label></span>])} />
                </div>
              ) : null}

              {plan.duplicates.length ? (
                <div style={{ ...box, borderColor: "#b91c1c" }} data-testid="reconcile-duplicate-list">
                  <strong>Possible duplicate charges</strong>
                  <ul>{plan.duplicates.map((d) => <li key={`${d.section}${d.rowId}`}>{d.section} › {d.rowId} is claimed by {d.identities.join(", ")}</li>)}</ul>
                </div>
              ) : null}

              <label style={{ display: "block", margin: "8px 0" }}>
                <input type="checkbox" data-testid="reconcile-save-for-builder" checked={saveForBuilder} onChange={(event) => setSaveForBuilder(event.target.checked)} /> Reuse confirmed mappings on this builder's other jobs (owner/admin only; this job keeps its own copy)
              </label>
              {plan.syncReports.exteriorPaint?.unlinked?.length ? <p data-testid="reconcile-paint-unlinked" style={{ fontSize: 12 }}>Exterior colour areas without a painter row (not given an invented row): {plan.syncReports.exteriorPaint.unlinked.map((entry) => `${entry.label} (${entry.reason === "FACTORY_FINISH_NOT_PAINTED" ? "factory finish" : "no painter row"})`).join(", ")}</p> : null}
              <label style={{ display: "block", margin: "8px 0" }}>
                <input type="checkbox" data-testid="reconcile-reviewed" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> I have reviewed these changes
              </label>
              {!commercialDecisionsComplete ? <p data-testid="reconcile-decisions-required" style={{ color: "#b45309", fontSize: 12 }}>Choose a target or explicitly leave every unresolved commercial item pending before applying.</p> : null}
              <button type="button" data-testid="reconcile-apply" disabled={!reviewed || !commercialDecisionsComplete || plan.duplicates.length > 0 || plan.blocking.length > 0 || (plan.financialImpact?.requiresApproval && !financialApprovalMatches)} onClick={apply} style={{ padding: "6px 14px" }}>Confirm and apply</button>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
