// VARIATION SUMMARY: every change from the standard inclusions, with its pricing state
// (lib/builders/selectionVariationPricing.js). Estimated and confirmed amounts are shown apart; an
// unresolved price reads "Builder Review Required", never $0. In builder view the builder supplies
// the missing quantity / price and approves a variation for issue; the client then accepts or
// declines it. Readable text is never below 16px.
import { useState } from "react";
import { AUTO_ESTIMATE_LABEL, BUILDER_REVIEW_HEADING, BUILDER_REVIEW_MESSAGE, PRICING_STATES } from "../../lib/builders/selectionVariationPricing.js";

const money = (value) => `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (value) => (value > 0 ? `+${money(value)}` : money(value));

const ESTIMATOR_VIEW_KEY = "gr8.clientSelections.estimatorView";
export function readEstimatorView() {
  try { return typeof window !== "undefined" && window.localStorage.getItem(ESTIMATOR_VIEW_KEY) === "1"; } catch { return false; }
}
export function writeEstimatorView(on) {
  try { window.localStorage.setItem(ESTIMATOR_VIEW_KEY, on ? "1" : "0"); } catch { /* per-browser convenience only */ }
}

function ReviewEditor({ row, item, onReview }) {
  const [quantity, setQuantity] = useState(row.quantity ?? "");
  const [unitPrice, setUnitPrice] = useState(row.unitPrice ?? "");
  const [includesGst, setIncludesGst] = useState(row.priceIncludesGst === true ? "inc" : "ex");
  const [allowance, setAllowance] = useState(item.reviewAllowance ?? "");
  const values = () => ({ quantity: quantity === "" ? undefined : quantity, unitPrice: unitPrice === "" ? undefined : unitPrice, priceIncludesGst: includesGst === "inc", ...(allowance === "" ? {} : { allowance }) });
  return (
    <div className="vsp-editor" data-testid="variation-review-editor">
      <label><span>Quantity{item.unit ? ` (${item.unit})` : ""}</span><input type="number" min="0" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} data-testid="variation-review-quantity" /></label>
      <label><span>{item.credit ? "Credit rate" : "Unit price"}</span><input type="number" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} data-testid="variation-review-price" /></label>
      {row.state === PRICING_STATES.estimatedPrice || item.allowanceKnown === false ? <label><span>Allowance per unit (ex GST)</span><input type="number" min="0" step="0.01" value={allowance} onChange={(event) => setAllowance(event.target.value)} data-testid="variation-review-allowance" /></label> : null}
      <label><span>GST</span><select value={includesGst} onChange={(event) => setIncludesGst(event.target.value)} data-testid="variation-review-gst"><option value="ex">Price ex GST</option><option value="inc">Price inc GST</option></select></label>
      <button type="button" onClick={() => onReview(item, values())} data-testid="variation-review-save">Save pricing</button>
      {row.state === PRICING_STATES.calculable ? <button type="button" className="primary" onClick={() => onReview(item, { ...values(), approve: true })} data-testid="variation-review-approve">Approve variation for issue</button> : null}
    </div>
  );
}

export default function VariationSummaryPanel({ summary, tasks = [], items = [], estimatorView = false, onReview, onClientDecision, onToggleEstimatorView }) {
  if (!summary) return null;
  const itemById = new Map(items.map((item) => [item.__id, item]));
  // One click from a row to its pricing fields: switches to builder view and scrolls to that row.
  const resolveRow = (rowId) => {
    if (!estimatorView && onToggleEstimatorView) onToggleEstimatorView();
    setTimeout(() => document.querySelector(`[data-variation-id="${CSS.escape(rowId)}"] [data-testid="variation-review-editor"] input`)?.focus?.(), 50);
    setTimeout(() => document.querySelector(`[data-variation-id="${CSS.escape(rowId)}"]`)?.scrollIntoView?.({ behavior: "smooth", block: "center" }), 60);
  };
  return (
    <section className="vsp-panel" aria-label="Variation summary" data-testid="variation-summary" data-review-count={summary.reviewCount} data-can-issue={summary.canIssueFinal ? "true" : "false"}>
      <style>{VSP_CSS}</style>
      <header>
        <div>
          <h3>VARIATION SUMMARY</h3>
          <p>Changes from your standard inclusions. Estimated amounts are subject to builder approval; only confirmed amounts are issued for your acceptance.</p>
        </div>
        {onToggleEstimatorView ? <button type="button" className="vsp-toggle" onClick={onToggleEstimatorView} data-testid="variation-estimator-toggle">{estimatorView ? "Switch to client view" : "Builder pricing review"}</button> : null}
      </header>
      <div className="vsp-totals">
        <span data-testid="variation-estimated-total"><b>Estimated</b>{summary.estimatedCount ? signed(summary.estimatedTotalIncGst) : "—"}<small>{summary.estimatedCount} item{summary.estimatedCount === 1 ? "" : "s"} · inc GST · subject to builder approval</small></span>
        <span data-testid="variation-confirmed-total"><b>Confirmed</b>{summary.confirmedCount ? signed(summary.confirmedTotalIncGst) : "—"}<small>{summary.confirmedCount} item{summary.confirmedCount === 1 ? "" : "s"} · inc GST</small></span>
        {summary.estimatedPriceCount ? <span className="info" data-testid="variation-estimated-price-total"><b>Auto-estimated prices</b>{money(summary.estimatedPriceTotalIncGst)}<small>{summary.estimatedPriceCount} item{summary.estimatedPriceCount === 1 ? "" : "s"} · inc GST · allowance to be confirmed by your builder · not in the variation total</small></span> : null}
        <span className={summary.reviewCount ? "warn" : ""} data-testid="variation-review-total"><b>{BUILDER_REVIEW_HEADING}</b>{summary.reviewCount}<small>{summary.reviewCount ? "your builder needs to supply what is listed" : "nothing waiting on your builder"}</small></span>
      </div>
      {!summary.rows.length ? <p className="vsp-empty" data-testid="variation-none">No changes from the standard inclusions.</p> : (
        <ul className="vsp-rows">
          {summary.rows.map((row) => {
            const item = itemById.get(row.id);
            return (
              <li key={row.id} data-testid="variation-row" data-variation-id={row.id} data-state={row.state} data-room={row.room} data-kind={row.kind} data-auto-estimated={row.autoEstimated ? "true" : "false"}>
                <div className="vsp-what">
                  <strong>{row.requirementLabel} — {row.room}</strong>
                  <span>Standard: {row.standard}</span>
                  <span>Selected: {row.selected}</span>
                  {row.quantity ? <span>Quantity: {row.quantity}{row.unit ? ` ${row.unit}` : ""}{row.quantitySource ? ` (${row.quantitySource})` : ""}</span> : null}
                </div>
                <div className="vsp-price">
                  {row.state === PRICING_STATES.builderReview ? (
                    <div className="vsp-review" data-testid="variation-builder-review">
                      <b>{BUILDER_REVIEW_HEADING}</b>
                      <span>{BUILDER_REVIEW_MESSAGE}</span>
                      <span className="vsp-missing" data-testid="variation-missing">Needed: {row.missing.map((entry) => entry.label).join("; ")}</span>
                      {onReview && item && !estimatorView ? <button type="button" className="vsp-link" onClick={() => resolveRow(row.id)} data-testid="variation-resolve">Builder: add the missing figures →</button> : null}
                    </div>
                  ) : row.state === PRICING_STATES.estimatedPrice ? (
                    <div className="vsp-amount estimated_price" data-testid="variation-estimated-price">
                      <b data-testid="variation-price">{money(row.priceIncGst)} inc GST</b>
                      <span>{row.autoEstimated ? AUTO_ESTIMATE_LABEL : "Estimated price — subject to builder confirmation"}</span>
                      <span className="vsp-source">{row.priceSourceLabel ? `${row.priceSourceLabel}. ` : ""}Your allowance for this item has not been recorded, so your builder will confirm the difference.</span>
                      {onReview && item && !estimatorView ? <button type="button" className="vsp-link" onClick={() => resolveRow(row.id)} data-testid="variation-resolve">Builder: enter the allowance →</button> : null}
                    </div>
                  ) : (
                    <div className={`vsp-amount ${row.state}`}>
                      <b data-testid="variation-amount">{signed(row.amountIncGst)} inc GST</b>
                      <span>{row.state === PRICING_STATES.confirmed ? "Confirmed by your builder" : row.autoEstimated ? AUTO_ESTIMATE_LABEL : "Estimated — subject to builder approval"}</span>
                      {row.state !== PRICING_STATES.confirmed && row.priceSourceLabel ? <span className="vsp-source">{row.priceSourceLabel}</span> : null}
                      {row.state === PRICING_STATES.calculable && row.amountIncGst <= 0 ? <span className="vsp-source">Within your allowance.</span> : null}
                    </div>
                  )}
                  <span className="vsp-status" data-testid="variation-approval">Builder approval: {row.builderApproval === "approved" ? "Approved" : "Pending"}</span>
                  <span className="vsp-status" data-testid="variation-acceptance">Client acceptance: {row.clientAcceptance === "accepted" ? "Accepted" : row.clientAcceptance === "declined" ? "Declined" : row.clientAcceptance === "pending" ? "Awaiting your decision" : "Not yet issued"}</span>
                  {row.state === PRICING_STATES.confirmed && item && onClientDecision ? (
                    <div className="vsp-decide">
                      <button type="button" className={row.clientAcceptance === "accepted" ? "primary" : ""} onClick={() => onClientDecision(item, "accepted")} data-testid="variation-accept">Record client acceptance</button>
                      <button type="button" className={row.clientAcceptance === "declined" ? "primary" : ""} onClick={() => onClientDecision(item, "declined")} data-testid="variation-decline">Record client decline</button>
                    </div>
                  ) : null}
                </div>
                {estimatorView && item && onReview && row.state !== PRICING_STATES.confirmed ? <ReviewEditor key={`${row.id}:${row.state}`} row={{ ...row, unitPrice: item.reviewUnitPrice, priceIncludesGst: item.reviewIncludesGst }} item={item} onReview={onReview} /> : null}
                {estimatorView && item && onReview && row.state === PRICING_STATES.confirmed ? <div className="vsp-editor"><button type="button" onClick={() => onReview(item, { withdraw: true })} data-testid="variation-review-withdraw">Withdraw approval and edit</button></div> : null}
              </li>
            );
          })}
        </ul>
      )}
      {estimatorView ? (
        <div className="vsp-queue" data-testid="builder-review-queue" data-count={tasks.length}>
          <h4>Builder review queue ({tasks.length})</h4>
          {tasks.length ? <ul>{tasks.map((task) => <li key={task.id} data-testid="builder-review-task" data-task-id={task.id}><strong>{task.title}</strong><span>{task.selected}</span><span>Missing: {task.missing.map((entry) => entry.label).join("; ")}</span></li>)}</ul> : <p>No selections are waiting on builder pricing.</p>}
        </div>
      ) : null}
      {!summary.canIssueFinal && summary.rows.length ? <p className="vsp-note" data-testid="variation-not-final">This summary cannot be issued as a final variation until every price is confirmed by the builder.</p> : null}
    </section>
  );
}

const VSP_CSS = `
.vsp-panel { border: 1px solid #cbd5e1; border-radius: 14px; background: #fff; padding: 20px; margin: 18px 0; font-size: 16px; color: #0f172a; }
.vsp-panel header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: flex-start; }
.vsp-panel h3 { margin: 0 0 4px; font-size: 20px; letter-spacing: .02em; }
.vsp-panel p { margin: 0; font-size: 16px; color: #334155; }
.vsp-toggle, .vsp-panel button { font-size: 16px; padding: 8px 14px; border-radius: 10px; border: 1px solid #94a3b8; background: #f8fafc; cursor: pointer; }
.vsp-panel button.primary { background: #0f766e; color: #fff; border-color: #0f766e; }
.vsp-totals { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; }
.vsp-totals span { flex: 1 1 200px; display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border-radius: 12px; background: #f1f5f9; font-size: 22px; font-weight: 700; }
.vsp-totals span.warn { background: #fef3c7; }
.vsp-totals span.info { background: #e0f2fe; }
.vsp-source { color: #475569; }
.vsp-amount.estimated_price b { color: #075985; }
.vsp-panel button.vsp-link { align-self: flex-start; margin-top: 6px; background: #0f766e; color: #fff; border-color: #0f766e; }
.vsp-totals b { font-size: 16px; font-weight: 700; color: #334155; }
.vsp-totals small { font-size: 16px; font-weight: 400; color: #475569; }
.vsp-rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.vsp-rows > li { display: flex; flex-wrap: wrap; gap: 12px 24px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
.vsp-what, .vsp-price { display: flex; flex-direction: column; gap: 4px; flex: 1 1 280px; min-width: 0; }
.vsp-what strong { font-size: 18px; }
.vsp-review { display: flex; flex-direction: column; gap: 4px; background: #fffbeb; border: 1px solid #f59e0b; border-radius: 10px; padding: 10px 12px; }
.vsp-review b { font-size: 18px; color: #92400e; }
.vsp-missing { color: #92400e; }
.vsp-amount b { font-size: 20px; }
.vsp-amount.confirmed b { color: #065f46; }
.vsp-status { color: #475569; }
.vsp-decide, .vsp-editor { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; flex-basis: 100%; }
.vsp-editor label { display: flex; flex-direction: column; gap: 4px; font-size: 16px; }
.vsp-editor input, .vsp-editor select { font-size: 16px; padding: 6px 8px; border: 1px solid #94a3b8; border-radius: 8px; width: 150px; }
.vsp-queue { margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
.vsp-queue h4 { margin: 0 0 8px; font-size: 18px; }
.vsp-queue ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }
.vsp-queue li { display: flex; flex-direction: column; }
.vsp-note { margin-top: 12px !important; color: #92400e !important; }
.vsp-empty { margin-top: 8px !important; }
`;
