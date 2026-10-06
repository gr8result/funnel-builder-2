import { assertWorkspaceRecord, requireWorkspaceId, workspaceIdOf } from './tenantScope.js';
import { requireSelectionSlot } from './selectionRegistry.js';

export const SELECTION_RESOURCES = Object.freeze({
  products: 'builder_products',
  configurations: 'builder_selection_configurations',
  aliases: 'builder_selection_aliases',
  schedules: 'builder_inclusion_schedules',
  items: 'builder_inclusion_schedule_items',
  mappings: 'builder_selection_quote_mappings',
  prices: 'builder_product_configurations',
});
const WRITE_FIELDS = {
  configurations: ['selection_slot_id', 'builder_display_name', 'builder_category', 'builder_subcategory', 'room_applicability', 'enabled', 'allow_multiple', 'allow_apply_to_all', 'allow_room_override', 'quantity_source', 'metadata'],
  aliases: ['selection_slot_id', 'alias', 'metadata'],
  schedules: ['name', 'display_name', 'active', 'metadata'],
  items: ['inclusion_schedule_id', 'selection_slot_id', 'default_product_id', 'default_catalogue_product_id', 'location_id', 'quantity_rules', 'allowance', 'notes', 'metadata'],
  mappings: ['selection_slot_id', 'template_id', 'quote_section_id', 'quote_row_id', 'status', 'metadata'],
  prices: ['product_id', 'catalogue_product_id', 'purchase_price', 'allowance_price', 'active', 'metadata'],
};

// Even service-role callers must supply an authenticated, membership-checked workspace.
// All queries include ownership; RLS + composite foreign keys provide a second boundary.
export function createSelectionRepository(db, workspaceId) {
  const owner = requireWorkspaceId(workspaceId);
  function table(resource) {
    if (!SELECTION_RESOURCES[resource]) throw new Error('Unknown selection resource.');
    return SELECTION_RESOURCES[resource];
  }
  async function list(resource) {
    const { data, error } = await db.from(table(resource)).select('*').eq('workspace_id', owner);
    if (error) throw error;
    return (data || []).map(record => assertWorkspaceRecord(owner, record));
  }
  async function get(resource, id) {
    const { data, error } = await db.from(table(resource)).select('*').eq('workspace_id', owner).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? assertWorkspaceRecord(owner, data) : null;
  }
  async function save(resource, input) {
    if (!WRITE_FIELDS[resource]) throw new Error('Use the Product Library to edit products.');
    if (workspaceIdOf(input) && workspaceIdOf(input) !== owner) assertWorkspaceRecord(owner, input);
    const payload = Object.fromEntries(WRITE_FIELDS[resource].filter(key => Object.hasOwn(input, key)).map(key => [key, input[key]]));
    payload.workspace_id = owner;
    if (payload.selection_slot_id) requireSelectionSlot(payload.selection_slot_id);
    for (const [field, target] of [['default_product_id', 'products'], ['product_id', 'products'], ['inclusion_schedule_id', 'schedules']]) {
      if (payload[field] && !(await get(target, payload[field]))) throw new Error(`Invalid workspace reference: ${field}`);
    }
    if (input.id && !(await get(resource, input.id))) {
      const error = new Error('Record not found in this workspace.'); error.statusCode = 404; throw error;
    }
    const query = input.id
      ? db.from(table(resource)).update(payload).eq('workspace_id', owner).eq('id', input.id)
      : db.from(table(resource)).insert(payload);
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return assertWorkspaceRecord(owner, data);
  }
  return Object.freeze({ list, get, save });
}
