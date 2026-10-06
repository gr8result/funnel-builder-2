// Signatures include structured source data, never message text alone. Sorting removes incidental
// object/collection order changes while retaining quantities, dimensions, codes and issue details.
const canonical = (value) => Array.isArray(value) ? value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
export const notificationSignature = (source) => `v1:${JSON.stringify(canonical(source))}`;
export function quotationNotifications(preview = {}, workbook = {}) {
  const unmatched = preview.windowScheduleUnmatched || [];
  const reconciliation = preview.windowScheduleReconciliation;
  const notifications = [];
  const add = (key, source, message, ok = false) => notifications.push({ key, signature: notificationSignature(source), message, ok });
  if (unmatched.length) add('section53-unmatched-windows', { unmatched, outcomes: preview.windowScheduleOutcomes?.filter((item) => item.outcome === 'unpriced') }, `Section 53 WINDOWS: ${unmatched.length} Window Schedule line(s) require a rate: ${unmatched.map((u) => `${u.code ? `${u.code} ` : ''}${u.style} ${u.heightMm}H x ${u.widthMm}W (qty ${u.quantity})`).join(', ')}.`);
  if (reconciliation?.error) {
    const job = workbook.aiPlanTakeoffJob || workbook.takeoffEngine?.aiPlanTakeoffJob || {};
    add('section53-schedule-error', { error: reconciliation.error, takeoffId: job.takeoffId, revision: job.revision, openings: job.placedOpenings, sheetLevels: job.sheetLevels }, `Section 53 WINDOWS: the saved takeoff could not be read (${reconciliation.error}).`);
  } else if (reconciliation?.section53Items > 0) {
    const r = reconciliation;
    add('section53-reconciliation', { reconciliation: r, unmatched, outcomes: preview.windowScheduleOutcomes }, `Section 53 WINDOWS reconciliation: Window Schedule ${r.section53Items} item(s), qty ${r.section53Qty} = matched qty ${r.matchedQty} + requiring a rate qty ${r.unpricedQty}; Quote Sheet qty ${r.quoteSheetQty}.${r.elsewhereItems ? ` ${r.elsewhereItems} external door(s) are quoted in the door sections.` : ''}${r.differences?.length ? ` Differences: ${r.differences.map((d) => `${d.item || d.quantityKey} schedule ${d.scheduleQty} / quote ${d.quoteSheetQty} (${d.reason})`).join('; ')}.` : ''}`, r.balanced && !r.differences?.length);
  }
  return notifications;
}
export function isNotificationAcknowledged(workbook, notification) {
  return workbook.quotationNotificationAcknowledgements?.[notification.key]?.signature === notification.signature;
}
export function acknowledgeQuotationNotification(workbook, notification, now = new Date().toISOString()) {
  return { ...workbook, quotationNotificationAcknowledgements: { ...workbook.quotationNotificationAcknowledgements, [notification.key]: { signature: notification.signature, message: notification.message, acknowledgedAt: now } } };
}
