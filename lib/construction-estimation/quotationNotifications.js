import { selectionPricePendingSummary } from "../builders/selectionPricePending.js";
// Signatures include structured source data, never message text alone. Sorting removes incidental
// object/collection order changes while retaining quantities, dimensions, codes and issue details.
const canonical = (value) => Array.isArray(value) ? value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
export const notificationSignature = (source) => `v1:${JSON.stringify(canonical(source))}`;
export function quotationNotifications(preview = {}, workbook = {}) {
  const unmatched = preview.windowScheduleUnmatched || [];
  const reconciliation = preview.windowScheduleReconciliation;
  const notifications = [];
  const add = (key, source, message, ok = false, requiresAcknowledgement = !ok) => notifications.push({ key, signature: notificationSignature(source), message, ok, requiresAcknowledgement });
  if (reconciliation?.error) {
    const job = workbook.aiPlanTakeoffJob || workbook.takeoffEngine?.aiPlanTakeoffJob || {};
    add('section53-schedule-error', { error: reconciliation.error, takeoffId: job.takeoffId, revision: job.revision, openings: job.placedOpenings, sheetLevels: job.sheetLevels }, `Section 53 WINDOWS: the saved takeoff could not be read (${reconciliation.error}).`);
  } else if (reconciliation?.section53Items > 0) {
    const r = reconciliation;
    const pending = unmatched.map((item) => {
      const opening = (preview.windowScheduleOutcomes || []).find((candidate) => candidate.outcome === 'unpriced'
        && Number(candidate.heightMm) === Number(item.heightMm)
        && Number(candidate.widthMm) === Number(item.widthMm));
      const location = item.room || item.location || opening?.location || opening?.room || '';
      return `${item.heightMm}H x ${item.widthMm}W${location ? ` (${location})` : ''}`;
    });
    const differences = r.differences?.length ? ` Differences: ${r.differences.map((d) => `${d.item || d.quantityKey} schedule ${d.scheduleQty} / quote ${d.quoteSheetQty} (${d.reason})`).join('; ')}.` : '';
    const message = pending.length
      ? `WINDOWS: ${r.section53Qty} openings mapped, ${r.matchedQty} priced, ${r.unpricedQty} pending supplier rates: ${pending.join(', ')}. Open the affected quotation rows to enter approved supplier rates.`
      : `WINDOWS: ${r.section53Qty} openings mapped and priced.${r.elsewhereItems ? ` ${r.elsewhereItems} external door(s) are quoted in the door sections.` : ''}`;
    add('section53-window-status', { reconciliation: r, unmatched, outcomes: preview.windowScheduleOutcomes }, `${message}${differences}`, pending.length === 0 && r.balanced && !r.differences?.length, false);
  } else if (unmatched.length) {
    add('section53-window-status', { unmatched, outcomes: preview.windowScheduleOutcomes?.filter((item) => item.outcome === 'unpriced') }, `WINDOWS: ${unmatched.length} opening${unmatched.length === 1 ? '' : 's'} require supplier rates: ${unmatched.map((item) => `${item.heightMm}H x ${item.widthMm}W${item.room || item.location ? ` (${item.room || item.location})` : ''}`).join(', ')}.`);
  }
  // Client selection lines applied while their supplier price is still pending: always shown, never
  // acknowledged away, until each price is confirmed in the quotation.
  const pendingPrices = selectionPricePendingSummary(preview.quotation && Object.keys(preview.quotation).length ? preview.quotation : workbook.quotation);
  if (pendingPrices.count) {
    const money = (value) => value.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
    add("selection-price-pending", pendingPrices.lines.map(({ rowId, total }) => [rowId, total]), `PROVISIONAL PRICES: ${pendingPrices.count} client selection line${pendingPrices.count === 1 ? "" : "s"} (${money(pendingPrices.total)} cost before markup${pendingPrices.unpriced ? `; ${pendingPrices.unpriced} with no price yet` : ""}) were applied with the supplier price still pending: ${pendingPrices.lines.slice(0, 8).map((line) => line.item).join("; ")}${pendingPrices.count > 8 ? "; ..." : ""}. Confirm these prices before the quotation is issued as a contract price.`, false, false);
  }
  return notifications;
}
export function isNotificationAcknowledged(workbook, notification) {
  return workbook.quotationNotificationAcknowledgements?.[notification.key]?.signature === notification.signature;
}
export function acknowledgeQuotationNotification(workbook, notification, now = new Date().toISOString()) {
  return { ...workbook, quotationNotificationAcknowledgements: { ...workbook.quotationNotificationAcknowledgements, [notification.key]: { signature: notification.signature, message: notification.message, acknowledgedAt: now } } };
}
