import { requireWorkspaceId, workbookWorkspaceId, workspaceIdOf } from './tenantScope.js';
import { SELECTION_STATUSES, selectionVariation, applySelectionProduct } from './selectionProductMath.js';
export { SELECTION_STATUSES, selectionVariation, applySelectionProduct };

function clientSelectionRate(event) {
  if (event.source !== 'CLIENT_SELECTION') return event;
  if (event.priceIncludesGst !== true && event.priceIncludesGst !== false) return { ...event, unitPrice: null };
  if (event.priceIncludesGst !== true || event.unitPrice === null || event.unitPrice === undefined || event.unitPrice === '') return event;
  const inclusive = Number(event.unitPrice);
  if (!Number.isFinite(inclusive)) return event;
  return { ...event, unitPrice: Math.round((inclusive / 1.1 + Number.EPSILON) * 10000) / 10000, priceIncludesGst: false };
}

function scoped(owner, value) {
  const id = workspaceIdOf(value);
  if (id && id !== owner) throw Error('Selection workspace mismatch.');
}

export function applySelectionQuoteUpdates(workbook, events, foundation) {
  const owner = requireWorkspaceId(foundation.workspace_id);
  if (workbookWorkspaceId(workbook) !== owner) throw Error('Job workspace mismatch.');
  const quotation = workbook.quotation || {};
  const targets = [];
  for (const [sectionKey, section] of Object.entries(quotation)) for (const row of section.rows || []) targets.push({ sectionKey, section, row });
  const planned = new Map(), report = [];
  for (const event of events) {
    scoped(owner, event);
    if (event.product) scoped(owner, event.product);
    const configs = (foundation.configurations || []).filter(config => config.workspace_id === owner && config.selection_slot_id === event.selectionSlotId);
    const config = configs.length === 1 ? configs[0] : null;
    const mappings = (foundation.mappings || []).filter(mapping => mapping.workspace_id === owner && mapping.selection_slot_id === event.selectionSlotId && mapping.template_id === (workbook.templateKey || '') && mapping.status === 'MAPPED');
    const location = event.locationId || null;
    const details = { selectionSlotId: event.selectionSlotId, locationId: location };
    if (!config?.enabled || (event.source !== 'INCLUSION_SCHEDULE' && ((event.applyToAll && config.allow_apply_to_all === false) || ((event.roomOverride || (location && !event.applyToAll)) && config.allow_room_override === false)))) { report.push({ ...details, status: 'UNMAPPED' }); continue; }
    let matches = [];
    // Room targets are explicit coordinates in existing mapping metadata, or already tagged quote rows.
    const coordinates = mappings.flatMap(mapping => mapping.metadata?.locationTargets?.length ? mapping.metadata.locationTargets : [{ sectionId: mapping.quote_section_id, rowId: mapping.quote_row_id, locationId: mapping.metadata?.locationId || null }]);
    for (const target of targets) {
      if (target.row.selectionSlotId && target.row.selectionSlotId !== event.selectionSlotId) continue;
      const tagged = target.row.selectionSlotId === event.selectionSlotId;
      const refs = coordinates.filter(ref => ref.sectionId === target.section.id && ref.rowId === target.row.id);
      if (!tagged && refs.length !== 1) continue;
      const targetLocation = target.row.locationId || refs[0]?.locationId || null;
      if (event.applyToAll || !location || targetLocation === location || (!targetLocation && coordinates.length === 1)) matches.push({ ...target, locationId: targetLocation || location });
    }
    if ((!event.applyToAll && matches.length !== 1) || !matches.length) { report.push({ ...details, status: 'UNMAPPED' }); continue; }
    for (const target of matches) {
      scoped(owner, target.row);
      const key = `${target.sectionKey}\u0000${target.row.id}`;
      const list = planned.get(key) || [];
      list.push({ event: clientSelectionRate(event), target }); planned.set(key, list);
    }
  }
  const changes = new Map();
  for (const [key, list] of planned) {
    // A room override wins over a default scheme regardless of event order. Conflicting peers never guess.
    const specificity = entry => entry.event.applyToAll ? 0 : 1;
    const best = Math.max(...list.map(specificity));
    const chosen = list.filter(entry => specificity(entry) === best);
    const identities = new Set(chosen.map(({ event, target }) => JSON.stringify([event.selectionSlotId, event.productId, event.unitPrice, event.source, event.status, target.locationId])));
    if (identities.size !== 1) { report.push({ selectionSlotId: chosen[0].event.selectionSlotId, locationId: chosen[0].target.locationId, status: 'CONFLICT' }); continue; }
    const { event, target } = chosen[0];
    // A later apply-to-all preserves previously saved individual overrides.
    if (event.applyToAll && target.row.selectionRoomOverride) continue;
    const before = target.row;
    const updated = applySelectionProduct(before, event);
    const accepted = updated.selectionSource === (event.source || 'CLIENT_SELECTION') && updated.activeProductId === (['CLIENT_SUPPLIED', 'NOT_REQUIRED'].includes(event.status) ? null : event.productId);
    changes.set(key, { ...updated, selectionSlotId: event.selectionSlotId, locationId: target.locationId, ...(accepted ? { selectionRoomOverride: event.source !== 'INCLUSION_SCHEDULE' && !event.applyToAll && Boolean(target.locationId) } : {}) });
    report.push({ selectionSlotId: event.selectionSlotId, locationId: target.locationId, status: accepted ? 'MAPPED' : 'PRESERVED' });
  }
  if (!changes.size) return { ...workbook, selectionQuoteEngineVersion: 1, selectionMappingReport: report };
  const next = { ...quotation };
  for (const [key, section] of Object.entries(quotation)) {
    if (!(section.rows || []).some(row => changes.has(`${key}\u0000${row.id}`))) continue;
    next[key] = { ...section, rows: section.rows.map(row => changes.get(`${key}\u0000${row.id}`) || row) };
  }
  return { ...workbook, quotation: next, selectionQuoteEngineVersion: 1, selectionMappingReport: report };
}

export function applyInclusionScheduleToQuote(workbook, snapshot, foundation) {
  const owner = requireWorkspaceId(foundation.workspace_id);
  scoped(owner, snapshot.schedule || {});
  const events = (snapshot.items || []).map(item => {
    scoped(owner, item);
    return { workspace_id: owner, selectionSlotId: item.selection_slot_id || item.selectionSlotId,
      locationId: item.location_id || item.locationId || null, applyToAll: !(item.location_id || item.locationId),
      productId: item.baselineProductId || item.default_product_id || item.default_catalogue_product_id || null,
      productName: item.baselineProductName || item.metadata?.productName,
      unitPrice: item.baselineUnitPrice ?? item.allowance?.unitPrice ?? item.allowance?.amount ?? (typeof item.allowance === 'number' ? item.allowance : null), source: 'INCLUSION_SCHEDULE' };
  });
  const next = applySelectionQuoteUpdates(workbook, events, foundation);
  return { ...next, jobInclusionScheduleId: workbook.jobInclusionScheduleId || snapshot.schedule?.id,
    jobInclusionScheduleName: workbook.jobInclusionScheduleName || snapshot.schedule?.display_name || snapshot.schedule?.name,
    jobInclusionScheduleVersion: workbook.jobInclusionScheduleVersion ?? snapshot.schedule?.version,
    jobInclusionSnapshot: workbook.jobInclusionSnapshot || JSON.parse(JSON.stringify(snapshot)) };
}
