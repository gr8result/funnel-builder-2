import { reconcileProductSelections } from './productSelectionIntegrity.js';
import { auditWindowScheduleQuotation } from './selectionReconciliationReport.js';
import { windowPriceListTakeoffQuantities } from '../construction-estimation/windowsQuotePriceList.js';

function hasWindowSupplierPrice(item = {}) {
  const value = Number(String(item.supplierQuote ?? item.quotedPrice ?? item.unitPrice ?? item.price ?? '').replace(/[$,]/g, ''));
  const source = String(item.priceSource || item.priceSourceUrl || item.quoteReference || '').trim();
  return Number.isFinite(value) && value > 0 && Boolean(source);
}

export function refreshSelectionProcurementRequirements(workbook, calculated, items = workbook.procurement?.items || []) {
  if (!workbook.jobId || !workbook.workspaceId) throw new Error('A job and builder workspace are required to refresh supplier requirements.');
  const nextItems = [...items];
  const auditWorkbook = calculated?.quotation ? { ...workbook, quotation: calculated.quotation } : workbook;
  const audit = reconcileProductSelections({ workbook: { ...auditWorkbook, procurement: { ...workbook.procurement, items: nextItems } } });
  for (const entry of audit.procurementMissing) {
    if (entry.requirementKey === 'windows' || entry.duplicateIdentity || entry.allocationDuplicate || entry.allocationMissing || entry.productReferenceInvalid) continue;
    const id = `procurement:selection:${encodeURIComponent(entry.key)}`;
    const identityDraft = nextItems.find((item) => item.id === id);
    if (identityDraft) {
      const orderState = String(identityDraft.orderStatus || identityDraft.status || '').trim().toLowerCase();
      const deliveryState = String(identityDraft.deliveryStatus || '').trim().toLowerCase();
      const locked = identityDraft.approvedForOrdering === true || ['approved', 'approved for ordering', 'ordered', 'issued', 'delivered', 'received', 'closed'].includes(orderState)
        || ['ordered', 'issued', 'delivered', 'received', 'closed'].includes(deliveryState);
      if (!locked && identityDraft.quantityManualOverride !== true && identityDraft.manualQuantity !== true && entry.quantityVerified) {
        const index = nextItems.indexOf(identityDraft);
        nextItems[index] = {
          ...identityDraft,
          productCode: entry.productCode || identityDraft.productCode || '',
          supplier: entry.supplier || identityDraft.supplier || '',
          qty: entry.quantity,
          unit: entry.unit || identityDraft.unit || '',
          approvedForOrdering: false,
          locationSchedule: entry.locationAllocations?.length
            ? entry.locationAllocations.map(({ location, quantity }) => ({ location, quantity }))
            : entry.location ? [{ location: entry.location, quantity: entry.quantity }] : identityDraft.locationSchedule || [],
          quantityPending: false,
        };
      }
      continue;
    }
    const allocatedPrefix = entry.configuredSelection && entry.lineId
      ? `allocated-selection:${entry.requirementKey}:${entry.lineId}`
      : `allocated-selection:${entry.requirementKey}:${entry.productId}`;
    const existing = nextItems.filter((item) => item.id?.startsWith(allocatedPrefix) && item.productId === entry.productId);
    if (existing.length) continue;
    nextItems.push({
      id, productId: entry.productId, selectionIdentityKey: entry.key,
      productCode: entry.productCode || "", supplier: entry.supplier || "", requirementKey: entry.requirementKey,
      workspaceId: workbook.workspaceId, jobId: workbook.jobId,
      itemDescription: entry.productName, procurementCategory: entry.requirementKey,
      sectionName: entry.section, qty: entry.quantity, unit: entry.unit,
      locationSchedule: entry.locationAllocations?.length ? entry.locationAllocations.map(({ location, quantity }) => ({ location, quantity }))
        : entry.location ? [{ location: entry.location, quantity: entry.quantity }] : [],
      orderStatus: 'Not Started', deliveryStatus: 'Not Required Yet',
      status: 'REQUIRED_BUT_UNPRICED', quoteRequired: true, costPending: true,
      estimatedRate: null, estimatedTotal: null, approvedForOrdering: false,
      quantityPending: !entry.quantityVerified, quantitySource: 'Saved selection; measured supply scope requires review',
      selectionOutcome: entry.outcome, removedFromQuote: false,
      notes: 'Unapproved selected-product requirement. Verify measured quantity, existing allowances/subcontracts, quotation target, supplier price and GST before ordering. Not an additional quotation charge.',
    });
  }
  const openings = windowPriceListTakeoffQuantities(workbook).outcomes.filter((opening) => opening.outcome !== 'elsewhere');
  const windowAudit = auditWindowScheduleQuotation(workbook, calculated);
  const book = workbook.clientSelectionsBook;
  const rooms = (book?.rooms || []).map((room) => ({
    ...room,
    rows: (room.rows || []).map((row) => {
      const field = row.guidedSelection ? 'guidedSelection' : row.selected_details ? 'selected_details' : 'selectedDetails';
      const selection = row[field];
      if (selection?.requirementKey !== 'windows') return row;
      const schedule = [...(selection.procurementSchedule || selection.windowWorkflow?.procurementSchedule || [])];
      const existingById = new Map(schedule.map((item, index) => [String(item.windowId), index]));
      const existingIds = new Set(existingById.keys());
      if (existingIds.size !== schedule.length) throw new Error('Duplicate physical opening IDs require review before refreshing the supplier RFQ.');
      for (const opening of openings) {
        const line = windowAudit.lines.find((group) => group.openingIds.includes(opening.itemId));
        const existingIndex = existingById.get(String(opening.itemId));
        if (existingIndex !== undefined) {
          const existing = schedule[existingIndex];
          const orderState = String(existing.status || '').trim().toLowerCase();
          const locked = existing.approvedForOrdering === true || ['approved', 'approved for ordering', 'ordered', 'issued', 'delivered', 'received', 'closed'].includes(orderState);
          const priceRequired = opening.outcome === 'unpriced' && !hasWindowSupplierPrice(existing);
          schedule[existingIndex] = {
            ...existing,
            type: existing.type || line?.type || '',
            size: existing.size || `${opening.heightMm}H x ${opening.widthMm}W`,
            height: existing.height ?? opening.heightMm,
            width: existing.width ?? opening.widthMm,
            quantity: locked || existing.quantityManualOverride === true ? existing.quantity : opening.quantity,
            room: existing.room || opening.location || '',
            ...(priceRequired ? {
              status: locked ? existing.status : 'Quote Required',
              priceRequired: true,
              orderApprovalBlocked: true,
              ...(!locked ? { approvedForOrdering: false } : {}),
            } : {}),
          };
          continue;
        }
        schedule.push({
          windowId: opening.itemId, type: line?.type || '',
          size: `${opening.heightMm}H x ${opening.widthMm}W`,
          height: opening.heightMm, width: opening.widthMm, quantity: opening.quantity,
          room: opening.location, supplier: selection.supplier || selection.windowWorkflow?.supplier || '',
          requiredDate: 'Builder to confirm', status: 'Quote Required', priceRequired: true,
          screenScopeApproved: false,
          notes: 'Added from the current physical opening schedule. Supplier price and screen specification require confirmation; no order or quotation charge is approved.',
        });
        existingIds.add(String(opening.itemId));
      }
      return { ...row, [field]: { ...selection, procurementSchedule: schedule,
        ...(selection.windowWorkflow ? { windowWorkflow: { ...selection.windowWorkflow, procurementSchedule: schedule } } : {}) } };
    }),
  }));
  return {
    ...workbook,
    ...(book ? { clientSelectionsBook: { ...book, rooms } } : {}),
    procurement: { ...workbook.procurement, items: nextItems },
  };
}