import { bulkheadFinishOption } from "../construction-estimation/cabinetryRequirements.js";

// Variation pricing for Client Selections V1.
//
// A client's choice and its price are tracked separately. Every change from the builder's standard
// inclusion is in one of three pricing states:
//   A  calculable      - quantity, price and GST basis are all known: an ESTIMATED difference,
//                        subject to builder approval.
//   B  builder_review  - something needed for the price is missing. Nothing is guessed and the cost
//                        is never shown as $0. A builder-review task names exactly what is missing.
//   C  confirmed       - the builder reviewed quantity and price and approved the variation for
//                        issue. Only now can the client accept or decline it.
//
// Builder reviews are stored by task id ({ quantity, unitPrice, priceIncludesGst, approvedAt,
// approvedBy, clientDecision, clientDecidedAt, selectionKey }). A review recorded for a different
// selection (the client changed their mind) is ignored, so a stale approval can never price a new
// choice. Nothing here writes to the quotation: approved variations reach Quotation Builder only
// through the existing reconciliation.

export const PRICING_STATES = Object.freeze({
  standard: "standard",
  calculable: "calculable",
  builderReview: "builder_review",
  // The price is known but no allowance is recorded for the item, so the difference cannot be worked
  // out: the estimated PRICE is shown (never added to the variation total) and the builder is asked
  // for the allowance.
  estimatedPrice: "estimated_price",
  confirmed: "confirmed",
});

export const BUILDER_REVIEW_HEADING = "Builder Review Required";
// A price taken automatically from the saved (unconfirmed) supplier price or the Product Library's
// reference price - never invented. The builder confirms or replaces it.
export const AUTO_ESTIMATE_LABEL = "Auto-Estimated — Subject to Builder Confirmation";
const AUTO_PRICE_SOURCES = new Set(["saved_unconfirmed", "supplier_reference", "indicative_rate"]);
export const BUILDER_REVIEW_MESSAGE = "Your builder will confirm the required measurements and pricing for this selection and provide a final variation amount for your approval.";

const GST = 0.1;
const text = (value) => String(value ?? "").trim();
const round = (value) => Math.round(value * 100) / 100;
const positive = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const slug = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "none";

// One stable id per job + room + selection + product, so recomputing never creates a second task.
export function builderReviewTaskId({ jobId = "", room = "", selectionKey = "", productId = "" } = {}) {
  return `pricing-review:${slug(jobId)}:${slug(room)}:${slug(selectionKey)}:${slug(productId)}`;
}

// What identifies the choice a review was made for; a review for another choice is stale.
export function variationSelectionKey(item = {}) {
  return [item.kind || "product", item.productId || item.selected || "", item.choice || ""].map(text).join("|");
}

function exGst(price, includesGst) {
  return includesGst === true ? price / (1 + GST) : price;
}

// ---- Client price of a cost (builder margin + GST) ----------------------------------------------
// Item prices and allowances are the builder's COST (ex GST, the quotation's basis). What the client
// pays for a cost is worked out with the job's own pricing settings, read from the quotation
// calculator's summary (calculateEstimateBuilderWorkbook) - preliminaries, overheads and margin on
// the line-item subtotal, profit on top, GST, then sales commission - the same chain the quotation
// uses, so a swap's difference matches what the quotation would add. The rules come from the
// quotation; nothing here edits it.
export function quotationPricingRules(summary = null) {
  if (!summary || typeof summary !== "object") return null;
  const pct = (key, fallback = 0) => { const value = Number(summary[key]); return Number.isFinite(value) ? value : fallback; };
  return {
    preliminaryCostsPercent: pct("preliminaryCostsPercent"), overheadsPercent: pct("overheadsPercent"), marginPercent: pct("marginPercent"),
    profitPercent: pct("profitPercent"), gstPercent: pct("gstPercent", 10), salesCommissionPercent: pct("salesCommissionPercent"),
  };
}

// { exGst, gst, incGst } the client pays for a cost (ex GST). Without rules: no margin, 10% GST.
export function clientPriceOfCost(costExGst, rules = null) {
  const cost = Number(costExGst) || 0;
  const r = rules || { preliminaryCostsPercent: 0, overheadsPercent: 0, marginPercent: 0, profitPercent: 0, gstPercent: GST * 100, salesCommissionPercent: 0 };
  const sellExGst = cost * (1 + (r.preliminaryCostsPercent + r.overheadsPercent + r.marginPercent) / 100) * (1 + r.profitPercent / 100);
  const gst = sellExGst * r.gstPercent / 100;
  const commission = r.salesCommissionPercent > 0 && r.salesCommissionPercent < 100 ? (sellExGst + gst) * r.salesCommissionPercent / (100 - r.salesCommissionPercent) : 0;
  const incGst = round(sellExGst + gst + commission);
  return { exGst: round(incGst - round(gst)), gst: round(gst), incGst };
}

// item: { jobId, room, selectionKey, requirementLabel, kind, standard, selected, productId,
//   isChange, quantity, quantitySource, unit, unitPrice, allowance, priceIncludesGst, missing[] }
// unitPrice / allowance are per unit; allowance is ex GST (the quotation's basis).
export function variationPricingState(item = {}, review = null) {
  const id = builderReviewTaskId(item);
  if (!item.isChange) return { id, state: PRICING_STATES.standard, label: "Standard inclusion", amountExGst: 0, amountIncGst: 0, estimated: false, missing: [] };
  const valid = review && (!review.selectionKey || review.selectionKey === variationSelectionKey(item)) ? review : null;
  const quantity = positive(valid?.quantity) ?? positive(item.quantity);
  const unitPrice = finite(valid?.unitPrice) ?? (item.priceUnknown ? null : finite(item.unitPrice));
  const includesGst = valid && typeof valid.priceIncludesGst === "boolean" ? valid.priceIncludesGst : item.priceIncludesGst;
  const allowance = finite(valid?.allowance) ?? finite(item.allowance) ?? 0;
  const quantitySource = positive(valid?.quantity) ? "Builder confirmed" : item.quantitySource || (quantity ? "Selection quantity" : "");
  // A builder-supplied value resolves the matching item-level gap.
  const resolved = new Set([...(positive(valid?.quantity) ? ["quantity"] : []), ...(finite(valid?.unitPrice) !== null ? ["price"] : [])]);
  const missing = [];
  (item.missing || []).filter((entry) => !resolved.has(entry.key)).forEach((entry) => missing.push(entry));
  if (!quantity && !missing.some((entry) => entry.key === "quantity")) missing.push({ key: "quantity", label: "Quantity or measurement" });
  if (unitPrice === null && !missing.some((entry) => entry.key === "price" || entry.unitMismatch)) missing.push({ key: "price", label: "Builder or supplier price" });
  if (unitPrice !== null && unitPrice !== 0 && typeof includesGst !== "boolean" && !missing.some((entry) => entry.key === "gst")) missing.push({ key: "gst", label: "GST basis of the price" });
  const base = { id, quantity, unitPrice, allowance, priceIncludesGst: includesGst, quantitySource, review: valid };
  if (missing.length) {
    return { ...base, state: PRICING_STATES.builderReview, label: BUILDER_REVIEW_HEADING, message: BUILDER_REVIEW_MESSAGE, amountExGst: null, amountIncGst: null, estimated: false, missing };
  }
  // A removal is a credit of the builder's rate; a multi-product selection (plumbing allocation) is the
  // sum of its lines; anything else is the price over the allowance.
  const builderPriced = finite(valid?.unitPrice) !== null;
  // The builder's cost difference (ex GST); the client amount adds the job's margin and GST to it.
  const costDifferenceExGst = item.credit ? -round(Math.abs(exGst(unitPrice, includesGst)) * quantity)
    : Array.isArray(item.lines) && item.lines.length && !builderPriced ? round(item.lines.reduce((total, line) => total + (line.unitPriceExGst - line.allowanceExGst) * line.quantity, 0))
      : round((exGst(unitPrice, includesGst) - allowance) * quantity);
  const client = clientPriceOfCost(costDifferenceExGst, item.pricingRules);
  const amountExGst = client.exGst;
  const amountIncGst = client.incGst;
  const pricing = { costDifferenceExGst, gstAmount: client.gst, marginApplied: Boolean(item.pricingRules) };
  const source = builderPriced ? { priceSource: "builder_review", priceSourceLabel: "Builder price" } : { priceSource: item.priceSource || "selection", priceSourceLabel: item.priceSourceLabel || "" };
  // A client decision counts only for the amount it was made on; any change to the amount re-opens it.
  const decided = valid && ["accepted", "declined"].includes(valid.clientDecision)
    && (valid.clientAcceptedAmountIncGst === undefined || valid.clientAcceptedAmountIncGst === null ? Boolean(valid.approvedAt) : valid.clientAcceptedAmountIncGst === amountIncGst);
  const clientDecision = decided ? valid.clientDecision : "pending";
  if (valid?.approvedAt) {
    return { ...base, ...source, ...pricing, state: PRICING_STATES.confirmed, label: "Confirmed variation", amountExGst, amountIncGst, estimated: false, missing: [], clientDecision };
  }
  const autoEstimated = !builderPriced && AUTO_PRICE_SOURCES.has(item.priceSource);
  const allowanceKnown = item.credit || item.allowanceKnown !== false || finite(valid?.allowance) !== null;
  if (!allowanceKnown) {
    const priceExGst = Array.isArray(item.lines) && item.lines.length && !builderPriced ? item.lines.reduce((total, line) => total + line.unitPriceExGst * line.quantity, 0) : exGst(unitPrice, includesGst) * quantity;
    // priceIncGst is the full client price of the item: builder-only (the client sees differences only).
    return { ...base, ...source, state: PRICING_STATES.estimatedPrice, autoEstimated, label: autoEstimated ? AUTO_ESTIMATE_LABEL : "Estimated price — subject to builder confirmation",
      priceIncGst: clientPriceOfCost(priceExGst, item.pricingRules).incGst, marginApplied: Boolean(item.pricingRules), amountExGst: null, amountIncGst: null, estimated: true, clientDecision: "pending",
      missing: [{ key: "allowance", label: "Allowance for this item is not recorded - needed to work out the price difference" }] };
  }
  return { ...base, ...source, ...pricing, clientDecision, state: PRICING_STATES.calculable, autoEstimated, withinAllowance: costDifferenceExGst <= 0,
    label: autoEstimated ? AUTO_ESTIMATE_LABEL : "Estimated variation - subject to builder approval", amountExGst, amountIncGst, estimated: true, missing: [] };
}

// Builder work queue: one task per unresolved price, never duplicated (keyed by builderReviewTaskId).
export function builderReviewTasks(items = [], reviews = {}) {
  const tasks = new Map();
  items.forEach((item) => {
    const pricing = variationPricingState(item, reviews[builderReviewTaskId(item)]);
    if (![PRICING_STATES.builderReview, PRICING_STATES.estimatedPrice].includes(pricing.state) || tasks.has(pricing.id)) return;
    tasks.set(pricing.id, { id: pricing.id, jobId: item.jobId, room: item.room, selectionKey: item.selectionKey, productId: item.productId || "",
      title: `${item.requirementLabel || item.selectionKey} — ${item.room || "Whole home"}`, selected: item.selected, standard: item.standard,
      missing: pricing.missing, status: "open" });
  });
  return [...tasks.values()];
}

// The end-of-selections variation summary. Estimated and confirmed amounts are totalled
// separately, and a summary with any unresolved price can never be issued as final.
export function variationSummary(items = [], reviews = {}) {
  const rows = items.filter((item) => item.isChange).map((item) => {
    const pricing = variationPricingState(item, reviews[builderReviewTaskId(item)]);
    return {
      id: pricing.id, room: item.room || "Whole home", requirementLabel: item.requirementLabel || item.selectionKey,
      standard: item.standard || "No standard product recorded", selected: item.selected, kind: item.kind || "product",
      quantity: pricing.quantity, unit: item.unit || "", quantitySource: pricing.quantitySource,
      state: pricing.state, priceLabel: pricing.state === PRICING_STATES.builderReview ? BUILDER_REVIEW_HEADING : pricing.label,
      amountExGst: pricing.amountExGst, amountIncGst: pricing.amountIncGst, priceIncGst: pricing.priceIncGst ?? null, missing: pricing.missing,
      autoEstimated: Boolean(pricing.autoEstimated), priceSourceLabel: pricing.priceSourceLabel || "", marginApplied: Boolean(pricing.marginApplied),
      builderApproval: pricing.state === PRICING_STATES.confirmed ? "approved" : "pending",
      // The client can approve as soon as the amount is known; the builder signs off afterwards.
      clientAcceptance: [PRICING_STATES.calculable, PRICING_STATES.confirmed].includes(pricing.state) ? pricing.clientDecision : "not_issued",
    };
  });
  const sum = (state, decision) => round(rows.filter((row) => row.state === state && (!decision || row.clientAcceptance === decision)).reduce((total, row) => total + (row.amountIncGst || 0), 0));
  const reviewCount = rows.filter((row) => row.state === PRICING_STATES.builderReview).length;
  return {
    rows,
    estimatedTotalIncGst: sum(PRICING_STATES.calculable),
    confirmedTotalIncGst: sum(PRICING_STATES.confirmed),
    acceptedTotalIncGst: round(rows.filter((row) => row.clientAcceptance === "accepted").reduce((total, row) => total + (row.amountIncGst || 0), 0)),
    acceptedCount: rows.filter((row) => row.clientAcceptance === "accepted").length,
    reviewCount,
    estimatedCount: rows.filter((row) => row.state === PRICING_STATES.calculable).length,
    // Items priced but with no recorded allowance: their PRICE, kept out of every variation total.
    estimatedPriceCount: rows.filter((row) => row.state === PRICING_STATES.estimatedPrice).length,
    estimatedPriceTotalIncGst: round(rows.filter((row) => row.state === PRICING_STATES.estimatedPrice).reduce((total, row) => total + (row.priceIncGst || 0), 0)),
    confirmedCount: rows.filter((row) => row.state === PRICING_STATES.confirmed).length,
    canIssueFinal: reviewCount === 0 && rows.every((row) => row.state === PRICING_STATES.confirmed),
  };
}

// "Auto-Approve All Baseline & Within-Allowance Items": the prices that are safe to confirm in bulk.
// Only fully priced changes that cannot add cost (within the allowance) or that use a verified
// supplier price. Builder Review items, prices with no recorded allowance and unconfirmed prices
// above the allowance are never included.
export function bulkApprovablePriceItems(items = [], reviews = {}) {
  return items.filter((item) => {
    if (!item.isChange) return false;
    const state = variationPricingState(item, reviews[builderReviewTaskId(item)]);
    return state.state === PRICING_STATES.calculable && (state.withinAllowance || item.priceSource === "supplier_reference");
  });
}

export function approvePriceItemsInBulk(reviews = {}, items = [], { by = "builder (bulk)", at } = {}) {
  return bulkApprovablePriceItems(items, reviews).reduce((working, item) => recordBuilderPricingReview(working, item, { approve: true, by, ...(at ? { at } : {}) }), reviews);
}

// Records the builder's missing information (and, optionally, approval for issue). Pure.
export function recordBuilderPricingReview(reviews = {}, item = {}, { quantity, unitPrice, priceIncludesGst, allowance, approve = false, by = "", at = new Date().toISOString() } = {}) {
  const id = builderReviewTaskId(item);
  const previous = reviews[id] && reviews[id].selectionKey === variationSelectionKey(item) ? reviews[id] : {};
  const next = { ...previous, selectionKey: variationSelectionKey(item), updatedAt: at,
    ...(quantity !== undefined ? { quantity: positive(quantity) } : {}),
    ...(unitPrice !== undefined ? { unitPrice: finite(unitPrice) } : {}),
    ...(allowance !== undefined ? { allowance: finite(allowance) } : {}),
    ...(typeof priceIncludesGst === "boolean" ? { priceIncludesGst } : {}) };
  if (approve) {
    const state = variationPricingState(item, { ...next, approvedAt: null });
    if (state.state !== PRICING_STATES.calculable) throw new Error(`Cannot approve: ${state.missing.map((entry) => entry.label).join(", ") || "price incomplete"}.`);
    // A client approval made on this exact amount stands; any other amount needs the client again.
    const clientKept = ["accepted", "declined"].includes(next.clientDecision) && next.clientAcceptedAmountIncGst === state.amountIncGst;
    Object.assign(next, { approvedAt: at, approvedBy: by, approvedAmountIncGst: state.amountIncGst, ...(clientKept ? {} : { clientDecision: "pending", clientDecidedAt: null, clientAcceptedAmountIncGst: null }) });
  } else if (previous.approvedAt) {
    // Changing a reviewed figure withdraws the approval. A client decision only ever counts for the
    // amount it was made on (variationPricingState), so the client is never held to an old amount.
    Object.assign(next, { approvedAt: null, approvedBy: "", approvedAmountIncGst: null });
  }
  return { ...reviews, [id]: next };
}

// The client approves (or declines) a variation as soon as its amount is known - an estimated
// amount or one the builder has confirmed. The decision is tied to that amount; the builder then
// signs it off in the Variations module.
export function recordClientVariationDecision(reviews = {}, item = {}, decision, at = new Date().toISOString()) {
  if (!["accepted", "declined", "pending"].includes(decision)) throw new Error("Decision must be accepted, declined or pending.");
  const id = builderReviewTaskId(item);
  const previous = reviews[id] && reviews[id].selectionKey === variationSelectionKey(item) ? reviews[id] : {};
  // Unticking: the client withdraws an approval the builder has not signed off yet.
  if (decision === "pending") {
    if (previous.approvedAt && previous.clientDecision === "accepted") throw new Error("Your builder has already signed off this variation.");
    return { ...reviews, [id]: { ...previous, selectionKey: variationSelectionKey(item), clientDecision: "pending", clientDecidedAt: at, clientAcceptedAmountIncGst: null } };
  }
  const state = variationPricingState(item, previous);
  if (![PRICING_STATES.calculable, PRICING_STATES.confirmed].includes(state.state)) throw new Error("This variation does not have an amount yet; your builder will confirm it first.");
  return { ...reviews, [id]: { ...previous, selectionKey: variationSelectionKey(item), clientDecision: decision, clientDecidedAt: at, clientAcceptedAmountIncGst: state.amountIncGst } };
}

// The three figures shown with the client's approval checkbox: everything already approved on this
// job, this variation, and the new running total. otherApprovedTotalIncGst is any approved
// variation recorded elsewhere (the Variations module) that is not one of these selection rows.
export function variationApprovalFigures(summary = {}, rowId = "", { otherApprovedTotalIncGst = 0 } = {}) {
  const rows = summary.rows || [];
  const row = rows.find((entry) => entry.id === rowId);
  const previousTotalIncGst = round((Number(otherApprovedTotalIncGst) || 0) + rows.filter((entry) => entry.id !== rowId && entry.clientAcceptance === "accepted").reduce((total, entry) => total + (entry.amountIncGst || 0), 0));
  const currentIncGst = row && Number.isFinite(row.amountIncGst) ? row.amountIncGst : null;
  return { previousTotalIncGst, currentIncGst, newTotalIncGst: currentIncGst === null ? null : round(previousTotalIncGst + currentIncGst) };
}

// ---- Items from the Client Selections book ------------------------------------------------------

// A guided product row. With a standard-inclusion baseline the row is a change only when the
// product differs from it; without one, only when it carries a price difference or an unknown price.
// ---- Automatic price resolution -----------------------------------------------------------------
// When the builder has not priced a selection, a price is taken - in this order - from:
//   1. the price saved with the selection that is still awaiting confirmation ("saved_unconfirmed");
//   2. the Product Library's reference price for that product: a verified supplier price
//      ("supplier_reference") or a GR8 Result indicative rate ("indicative_rate").
// A reference price is used only when its unit matches what the selection counts (each / m² / LM /
// board ...): a price per board is never multiplied by a quantity of "1 cladding". With no usable
// price the item stays Builder Review Required and says exactly what is missing. Nothing is invented.
const UNIT_FAMILIES = [
  ["m2", /\b(m2|m²|sqm|square met|per m2)\b|m2\b/i],
  ["lm", /\b(lm|lineal|linear met)\b/i],
  ["board", /\bboards?\b|\bsheets?\b/i],
  ["each", /\b(each|ea|item|unit|door|set|suite|system|stair|installed [a-z ]*door|fixture|pair)\b/i],
];
export function unitFamily(value = "") {
  const found = UNIT_FAMILIES.find(([, pattern]) => pattern.test(String(value || "")));
  return found ? found[0] : "";
}
const isIncl = (basis) => (/incl|inclusive/i.test(text(basis)) ? true : /excl|exclusive/i.test(text(basis)) ? false : null);
const money2 = (value) => `$${Number(value).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// One product line: { unitPrice, includesGst, source, sourceLabel } or { missing }.
function resolveLinePrice({ name, productId, productCode, savedPrice, savedIncludesGst, savedConfirmed, quantityUnit, productLookup }) {
  if (savedPrice !== null && savedPrice > 0) {
    return { unitPrice: savedPrice, includesGst: typeof savedIncludesGst === "boolean" ? savedIncludesGst : false,
      source: savedConfirmed ? "selection" : "saved_unconfirmed", sourceLabel: savedConfirmed ? "" : `Saved supplier price ${money2(savedPrice)} awaiting builder confirmation` };
  }
  const product = typeof productLookup === "function" ? productLookup(productId, productCode) : null;
  const reference = finite(product?.retailReferencePrice);
  if (reference !== null && reference > 0) {
    const referenceUnit = text(product.retailReferenceUnit || product.priceUnit);
    const wanted = unitFamily(quantityUnit) || "each";
    const offered = unitFamily(referenceUnit) || "each";
    const kind = product.retailReferenceType === "verified_supplier" ? "supplier_reference" : "indicative_rate";
    const label = `${kind === "supplier_reference" ? "Product Library supplier price" : "GR8 Result indicative rate"} ${money2(reference)}${referenceUnit ? ` per ${referenceUnit}` : ""}`;
    if (wanted !== offered) return { reference: { price: reference, unit: referenceUnit || offered, includesGst: isIncl(product.retailReferenceGstBasis), label }, missing: { key: "quantity", unitMismatch: true, label: `${name}: quantity in ${referenceUnit || offered} (the ${label} cannot be applied to a quantity counted as ${quantityUnit || "items"})` } };
    return { unitPrice: reference, includesGst: isIncl(product.retailReferenceGstBasis), source: kind, sourceLabel: label };
  }
  return { missing: { key: "price", label: `${name}: no builder, supplier or Product Library price` } };
}

export function guidedRowVariationItem(row = {}, { jobId = "", room = "", productLookup = null, requirementUnit = "" } = {}) {
  const guided = row.guidedSelection || {};
  if (guided.cabinetrySelection) return null;
  const productId = text(guided.productId || guided.selectedProductId || row.selectedOptionId);
  const lines = Array.isArray(guided.plumbingAllocation?.lines) ? guided.plumbingAllocation.lines.filter((line) => line?.productId || line?.productName) : [];
  if (!productId && !lines.length) return null;
  const baseline = guided.standardInclusionBaseline || null;
  const allowance = finite(guided.allowance ?? row.allowanceAmount) ?? 0;
  const selectedPrice = finite(guided.selectedPrice ?? row.selectedCost);
  const priceUnknown = guided.variationPending === true || /quote required|price required|pending|rate required/i.test(text(guided.priceState || guided.priceStatus));
  // The baseline product is never a variation, whatever its price state.
  const isChange = baseline ? text(baseline.productId) !== productId : priceUnknown || (selectedPrice !== null && Math.abs(selectedPrice - allowance) > 0.004);
  const savedIncludesGst = typeof guided.selectedPriceIncludesGst === "boolean" ? guided.selectedPriceIncludesGst : typeof guided.priceIncludesGst === "boolean" ? guided.priceIncludesGst : guided.selectedPriceIncludesGst === null ? null : false;
  const quantityUnit = guided.drivewayAreaM2 ? "m2" : text(guided.unit || requirementUnit);
  const name = text(guided.productName || guided.selectedProduct || row.selectedProduct);
  const item = {
    jobId, room: room || text(guided.room || row.room), selectionKey: text(guided.requirementKey || row.guidedRequirementKey || row.id), requirementLabel: text(guided.requirementLabel || row.item),
    kind: "product", standard: baseline ? text(baseline.productName) : allowance ? `Allowance ${money2(allowance)}` : "", selected: name,
    productId: productId || text(lines[0]?.productId), isChange, quantity: finite(guided.drivewayAreaM2) ?? finite(guided.quantity) ?? 1, quantitySource: guided.drivewayAreaM2 ? "Driveway area" : "Selection quantity", unit: guided.drivewayAreaM2 ? "m²" : text(guided.unit),
    unitPrice: selectedPrice, priceUnknown, allowance, priceIncludesGst: savedIncludesGst,
    // 0 with no baseline and no "set" status means no allowance was configured, not a $0 allowance.
    allowanceKnown: Boolean(baseline) || allowance > 0 || guided.allowanceStatus === "set" || row.allowanceStatus === "set",
  };
  if (!isChange) return item;
  if (lines.length > 1) {
    // Several products under one selection: each line is priced on its own and the difference summed.
    const resolved = lines.map((line) => ({ line, price: resolveLinePrice({ name: text(line.productName) || name, productId: line.productId, productCode: line.productCode, savedPrice: finite(line.unitPrice ?? line.selectedPrice), savedIncludesGst: typeof line.priceIncludesGst === "boolean" ? line.priceIncludesGst : savedIncludesGst, savedConfirmed: !priceUnknown, quantityUnit, productLookup }) }));
    const missing = resolved.filter((entry) => entry.price.missing).map((entry) => entry.price.missing);
    if (resolved.some((entry) => !entry.price.missing && typeof entry.price.includesGst !== "boolean")) missing.push({ key: "gst", label: "GST basis of a product price" });
    if (missing.length) return { ...item, priceUnknown: true, unitPrice: null, missing };
    const quantityOf = (line) => finite(line.quantity) ?? (Array.isArray(line.allocations) ? line.allocations.reduce((total, allocation) => total + (finite(allocation.quantity) ?? 0), 0) : 1);
    const auto = resolved.find((entry) => AUTO_PRICE_SOURCES.has(entry.price.source));
    return { ...item, priceUnknown: false, unitPrice: 0, priceIncludesGst: false, quantity: resolved.reduce((total, entry) => total + quantityOf(entry.line), 0),
      lines: resolved.map(({ line, price }) => ({ quantity: quantityOf(line), unitPriceExGst: exGst(price.unitPrice, price.includesGst === true), allowanceExGst: allowance })),
      priceSource: auto ? auto.price.source : "selection", priceSourceLabel: resolved.map((entry) => entry.price.sourceLabel).filter(Boolean).join("; ") };
  }
  const line = lines[0] || {};
  const price = resolveLinePrice({ name, productId: productId || line.productId, productCode: guided.productCode || line.productCode, savedPrice: selectedPrice ?? finite(line.unitPrice), savedIncludesGst, savedConfirmed: !priceUnknown, quantityUnit, productLookup });
  if (price.missing) return { ...item, priceUnknown: true, unitPrice: null, missing: [price.missing], ...(price.reference ? { reference: price.reference } : {}) };
  return { ...item, priceUnknown: false, unitPrice: price.unitPrice, priceIncludesGst: price.includesGst, priceSource: price.source, priceSourceLabel: price.sourceLabel };
}

// Cabinetry bulkhead decisions. The quantity is the estimator's measured length (runs / takeoff);
// the client never enters it. The rate is the builder's, supplied through the review.
export function cabinetryBulkheadVariationItems(selection = {}, { jobId = "" } = {}) {
  const schedule = Array.isArray(selection.schedule) ? selection.schedule : [];
  return (selection.locations || []).filter((location) => ["add", "remove"].includes(location.bulkheadChoice?.choice)).map((location) => {
    const choice = location.bulkheadChoice.choice;
    const lines = schedule.filter((line) => line.location === location.location && /^bulkhead_/.test(text(line.cabinetTypeId)));
    const lengthMm = lines.flatMap((line) => (Array.isArray(line.runs) ? line.runs : [])).reduce((total, run) => total + (Number(run?.lengthMm) > 0 ? Number(run.lengthMm) : 0), 0);
    const lm = Math.round(lengthMm / 10) / 100;
    const missing = [];
    if (!lm) missing.push({ key: "quantity", label: "Bulkhead length above the overhead cabinets (LM) - measured by the builder or AI Takeoff" });
    missing.push({ key: "price", label: `Bulkhead ${choice === "add" ? "supply and install rate" : "credit rate"} per LM` });
    return {
      jobId, room: location.location, selectionKey: "cabinetry-bulkheads", requirementLabel: "Cabinetry bulkheads", kind: "cabinetry-bulkhead", choice,
      standard: location.bulkheadChoice.standardIncluded ? "Bulkheads included" : "No bulkheads", selected: choice === "add" ? "Add bulkheads above overhead cabinets" : "Remove bulkheads",
      productId: `bulkheads-${choice}`, isChange: true, quantity: lm || null, quantitySource: lm ? "Estimator measured runs" : "", unit: "LM",
      // The builder enters the rate per LM; a removal is credited at that rate.
      credit: choice === "remove", unitPrice: null, allowance: 0, priceIncludesGst: false, missing,
    };
  });
}

// A bulkhead finish with no quotation rate (Raw MDF custom paint, Laminex Decorative Board 300/450): the
// standard is the room's Raw MDF site-painted rows, so the builder enters the finish's rate per LM and
// the MDF rate as the allowance. The length is the estimator's measured runs.
export function cabinetryBulkheadFinishItems(selection = {}, { jobId = "" } = {}) {
  const schedule = Array.isArray(selection.schedule) ? selection.schedule : [];
  return (selection.locations || []).flatMap((location) => {
    const mode = location.bulkheadFinishMode || location.coloursAndFinishes?.bulkheadFinishMode || location.areaSelections?.bulkheads?.finishMode || "";
    const option = bulkheadFinishOption(mode);
    if (!option || option.priced || location.bulkheadChoice?.choice === "remove") return [];
    const lines = schedule.filter((line) => line.location === location.location && /^bulkhead_/.test(text(line.cabinetTypeId)));
    if (!lines.length) return [];
    const lengthMm = lines.flatMap((line) => (Array.isArray(line.runs) ? line.runs : [])).reduce((total, run) => total + (Number(run?.lengthMm) > 0 ? Number(run.lengthMm) : 0), 0);
    const lm = Math.round(lengthMm / 10) / 100;
    return [{
      jobId, room: location.location, selectionKey: "cabinetry-bulkhead-finish", requirementLabel: "Bulkhead finish", kind: "cabinetry-bulkhead-finish", choice: option.key,
      standard: "Raw MDF 300/450 (site-painted)", selected: option.label, productId: `bulkhead-finish-${option.key}`, isChange: true,
      quantity: lm || null, quantitySource: lm ? "Estimator measured runs" : "", unit: "LM", unitPrice: null, allowance: 0, allowanceKnown: false, priceIncludesGst: false,
      missing: [...(lm ? [] : [{ key: "quantity", label: "Bulkhead length (LM) - measured by the builder or AI Takeoff" }]), { key: "price", label: `Rate per LM for ${option.label} bulkheads (no quotation row yet)` }],
    }];
  });
}

// pricingRules: quotationPricingRules(calculateEstimateBuilderWorkbook(workbook).summary) - the job's
// margin and GST settings; every item carries them so its client amount includes the margin.
export function selectionVariationItems(book = {}, { jobId = "", productLookup = null, requirementUnit = () => "", pricingRules = null } = {}) {
  const items = [];
  (book.rooms || []).forEach((room) => (room.rows || []).forEach((row) => {
    const guided = row.guidedSelection;
    if (!guided) return;
    if (guided.cabinetrySelection) items.push(...cabinetryBulkheadVariationItems(guided.cabinetrySelection, { jobId }), ...cabinetryBulkheadFinishItems(guided.cabinetrySelection, { jobId }));
    else {
      const key = text(guided.requirementKey || row.guidedRequirementKey);
      const item = guidedRowVariationItem(row, { jobId, room: room.name || room.room || "", productLookup, requirementUnit: requirementUnit(key) });
      if (item) items.push(item);
    }
  }));
  return pricingRules ? items.map((item) => ({ ...item, pricingRules })) : items;
}

// All builder pricing reviews on the book. They are kept in book.metadata.selectionPricingReviews,
// apart from the rows, so re-saving a selection or the cabinetry draft can never drop them; reviews
// found on a row or a cabinetry selection are read as well (book metadata wins).
export function selectionPricingReviews(book = {}) {
  const reviews = {};
  (book.rooms || []).forEach((room) => (room.rows || []).forEach((row) => {
    const guided = row.guidedSelection || {};
    Object.assign(reviews, guided.pricingReviews || {}, guided.cabinetrySelection?.pricingReviews || {});
  }));
  return { ...reviews, ...(book.metadata?.selectionPricingReviews || {}) };
}

export function bookWithPricingReviews(book = {}, reviews = {}) {
  return { ...book, metadata: { ...(book.metadata || {}), selectionPricingReviews: reviews }, updatedAt: new Date().toISOString() };
}
