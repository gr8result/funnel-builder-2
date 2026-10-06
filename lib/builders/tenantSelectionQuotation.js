import { requireWorkspaceId, workspaceIdOf } from './tenantScope.js';
import { resolveSelectionSlot } from './selectionRegistry.js';
import { applyInclusionScheduleToQuote, applySelectionQuoteUpdates } from './selectionQuoteEngine.js';

// Adapt saved selection books to the targeted quote engine. No sections or rows are generated.
export function connectTenantSelectionMetadata(workbook, book, foundation, { productById = () => null } = {}) {
  const owner = requireWorkspaceId(foundation.workspace_id);
  if (workspaceIdOf(book) && workspaceIdOf(book) !== owner) throw Error('Selection book workspace mismatch.');
  const events = [];
  for (const room of book.rooms || []) for (const row of room.rows || []) {
    const selection = row.guidedSelection || row;
    if (workspaceIdOf(selection) && workspaceIdOf(selection) !== owner) throw Error('Selection workspace mismatch.');
    if (selection.tilingRooms?.length) {
      for (const tileRoom of selection.tilingRooms) for (const [surface, selectionSlotId] of [['floor', 'floor_tile'], ['wall', 'wall_tile']]) {
        const productId = tileRoom.products?.[surface];
        if (!productId) continue;
        const product = productById(productId);
        events.push({ workspace_id: owner, selectionSlotId, locationId: tileRoom.id, roomOverride: true,
          productId, product, productName: product?.productName, unitPrice: product?.clientPrice ?? product?.builderCost ?? null, source: 'CLIENT_SELECTION' });
      }
      continue;
    }
    const slot = resolveSelectionSlot(owner, selection.selectionSlotId || selection.requirementKey, foundation.aliases);
    const base = { workspace_id: owner, selectionSlotId: slot, source: 'CLIENT_SELECTION',
      status: selection.selectionStatus === 'UNMAPPED' ? undefined : selection.selectionStatus || undefined, product: selection.product,
      locationId: selection.locationId || room.locationId || room.id || null,
      applyToAll: selection.applyToAll === true, roomOverride: selection.roomOverride === true };
    if (selection.plumbingAllocation?.lines?.length) {
      for (const line of selection.plumbingAllocation.lines) {
        if (workspaceIdOf(line) && workspaceIdOf(line) !== owner) throw Error('Selection workspace mismatch.');
        const allocations = line.allocations || [];
        const locations = Array.isArray(allocations) ? allocations : Object.entries(allocations).map(([locationId, quantity]) => ({ locationId, quantity }));
        const product = { ...base, productId: line.productId, productName: line.productName, unitPrice: line.unitPrice };
        if (locations.length) for (const location of locations) {
          if (Number(location.quantity ?? location.qty) > 0) events.push({ ...product, locationId: location.locationId || location.roomId || location.id || location.locationKey || location.location, applyToAll: false });
        } else events.push(product);
      }
    } else if (selection.productId || ['CLIENT_SUPPLIED', 'NOT_REQUIRED', 'AWAITING_SELECTION'].includes(base.status)) {
      events.push({ ...base, productId: selection.productId, productName: selection.productName || selection.selectedProduct, unitPrice: selection.selectedPrice ?? selection.activeUnitPrice ?? null });
    }
  }
  const baseline = workbook.jobInclusionSnapshot?.jobInclusionSnapshot || workbook.jobInclusionSnapshot;
  const included = baseline?.items ? applyInclusionScheduleToQuote(workbook, baseline, foundation) : workbook;
  return applySelectionQuoteUpdates(included, events, foundation);
}
