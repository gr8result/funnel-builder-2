import { assertWorkspaceRecord, requireWorkspaceId, workspaceIdOf } from './tenantScope.js';
import { applySelectionProduct } from './selectionQuoteEngine.js';

// Functional identities only. No supplier, room, schedule or quote coordinates belong here.
export const SELECTION_SLOTS = Object.freeze([
  ['kitchen_sink', 'Kitchen Sink'], ['kitchen_mixer', 'Kitchen Mixer'],
  ['oven', 'Oven'], ['cooktop', 'Cooktop'], ['dishwasher', 'Dishwasher'],
  ['toilet_suite', 'Toilet Suite'], ['basin', 'Basin'], ['basin_mixer', 'Basin Mixer'],
  ['bath', 'Bath'], ['shower_mixer', 'Shower Mixer'], ['shower_screen', 'Shower Screen'],
  ['mirror', 'Mirror'], ['floor_tile', 'Floor Tile'], ['wall_tile', 'Wall Tile'],
  ['carpet', 'Carpet'], ['timber_flooring', 'Timber Flooring'],
  ['internal_door_handle', 'Internal Door Handle'], ['external_door_handle', 'External Door Handle'],
  ['robe_fitout', 'Robe Fitout'],
].map(([selectionSlotId, displayName]) => Object.freeze({ selectionSlotId, displayName })));
export const SELECTION_SLOT_IDS = Object.freeze(SELECTION_SLOTS.map(slot => slot.selectionSlotId));
export const SELECTION_SOURCES = Object.freeze(['INCLUSION_SCHEDULE', 'CLIENT_SELECTION', 'MANUAL_OVERRIDE', 'TAKEOFF', 'SYSTEM_FORMULA']);
export const QUANTITY_SOURCES = Object.freeze(['TAKEOFF', 'SYSTEM_FORMULA', 'MANUAL']);
export const UNMAPPED = 'UNMAPPED';

export function requireSelectionSlot(id) {
  if (!SELECTION_SLOT_IDS.includes(id)) throw new Error(`Unknown selection slot: ${id}`);
  return id;
}

export function createSelectionConfiguration(workspaceId, selectionSlotId, values = {}) {
  requireSelectionSlot(selectionSlotId);
  return {
    builderDisplayName: SELECTION_SLOTS.find(slot => slot.selectionSlotId === selectionSlotId).displayName,
    builderCategory: '', builderSubcategory: '', roomApplicability: [], enabled: false,
    allowMultiple: false, allowApplyToAll: true, allowRoomOverride: true,
    quantitySource: 'TAKEOFF', quoteTargetMapping: null, metadata: {}, ...values,
    // Identity cannot be changed by a patch.
    ...{ workspace_id: requireWorkspaceId(workspaceId), selectionSlotId: requireSelectionSlot(selectionSlotId) },
  };
}

export function resolveSelectionSlot(workspaceId, value, aliases = []) {
  if (SELECTION_SLOT_IDS.includes(value)) return value;
  const candidates = aliases.filter(alias => alias.workspace_id === workspaceId && alias.alias === value);
  return candidates.length === 1 && SELECTION_SLOT_IDS.includes(candidates[0].selection_slot_id)
    ? candidates[0].selection_slot_id : UNMAPPED;
}

export function resolveQuoteTarget(workspaceId, selectionSlotId, mappings = [], templateId = '') {
  requireWorkspaceId(workspaceId);
  const candidates = mappings.filter(mapping => mapping.workspace_id === workspaceId
    && mapping.selection_slot_id === selectionSlotId && mapping.template_id === templateId && mapping.status === 'MAPPED');
  if (candidates.length !== 1) return { status: UNMAPPED, selectionSlotId };
  const mapping = candidates[0];
  return { status: 'MAPPED', selectionSlotId, sectionId: mapping.quote_section_id, rowId: mapping.quote_row_id };
}

export function productEligibleForSlot(workspaceId, product, slot, configuration) {
  assertWorkspaceRecord(workspaceId, configuration);
  if (workspaceIdOf(product) && workspaceIdOf(product) !== workspaceId) return false;
  return configuration.enabled === true && (configuration.selection_slot_id || configuration.selectionSlotId) === slot
    && (product.selection_slot_ids || product.selectionSlotIds || []).includes(slot) && product.active !== false;
}

// Only product-owned fields can be changed. A caller cannot overwrite quantity/formula/order fields.
export function updateActiveSelection(record, { productId, unitPrice, source = 'CLIENT_SELECTION', status = 'SELECTED' }) {
  return applySelectionProduct(record, { productId, unitPrice, source, status });
}

// Locations are job data, with arbitrary stable IDs. Null location means the default for this slot.
export function resolveLocationSelection(workspaceId, selections, selectionSlotId, locationId) {
  const scoped = selections.filter(row => row.workspace_id === workspaceId && row.selectionSlotId === selectionSlotId);
  return scoped.find(row => row.locationId === locationId && locationId)
    || scoped.find(row => !row.locationId) || null;
}

export function createJobInclusionSnapshot(workspaceId, schedule, items, appliedAt = new Date().toISOString()) {
  assertWorkspaceRecord(workspaceId, schedule);
  items.forEach(item => {
    assertWorkspaceRecord(workspaceId, item);
    if (item.inclusion_schedule_id !== schedule.id) throw new Error('Schedule item belongs to another schedule.');
  });
  return {
    jobInclusionScheduleId: schedule.id, jobInclusionScheduleName: schedule.display_name || schedule.name,
    jobInclusionScheduleVersion: schedule.version,
    jobInclusionSnapshot: JSON.parse(JSON.stringify({ schedule, items })), appliedAt,
  };
}

export function withStableQuoteTargets(quotation = {}, newId = () => crypto.randomUUID()) {
  let changed = false;
  const result = Object.fromEntries(Object.entries(quotation).map(([name, section]) => {
    const rows = section.rows?.map(row => {
      if (row.id) return row;
      changed = true; return { ...row, id: newId() };
    });
    if (!section.id) changed = true;
    return [name, { ...section, id: section.id || newId(), ...(rows ? { rows } : {}) }];
  }));
  return changed ? result : quotation;
}

export function preserveQuoteQuantityOwnership(previous, updated) {
  const originals = new Map(Object.entries(previous.quotation || {}).flatMap(([name, section]) => (section.rows || []).map(row => [`${name}\u0000${row.id}`, row])));
  const fields = ['quantity', 'qty', 'importedQuantity', 'quantityKey', 'quantityFormula', 'formulaSelection', 'formula', 'formulas', 'quantitySource', 'baselineProductId', 'baselineUnitPrice'];
  return { ...updated, quotation: Object.fromEntries(Object.entries(updated.quotation || {}).map(([name, section]) => [name, {
    ...section, rows: (section.rows || []).map(row => {
      const original = originals.get(`${name}\u0000${row.id}`);
      if (!original) return row;
      const next = { ...row };
      for (const field of fields) {
        if (Object.hasOwn(original, field) && (!field.startsWith('baseline') || original[field] != null)) next[field] = original[field];
        else if (!field.startsWith('baseline')) delete next[field];
      }
      return next;
    }),
  }])) };
}
