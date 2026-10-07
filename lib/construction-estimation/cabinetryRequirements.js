// Cabinetry Requirements Import Engine.
//
// Two sources, never mixed:
//   PLANS / AI TAKEOFF / JOB SETUP  -> WHAT cabinetry is required and HOW MANY (type, room, size, Qty)
//   CLIENT SELECTIONS / INCLUSIONS  -> WHICH finish / benchtop range is used
//
// The CABINETRY section holds every finish as catalogue rows (finalCabinetryQuotation.js). For a
// job, this engine gives Qty only to the rows of the finish selected for each room; every other
// finish alternative stays blank. A requirement is matched to its row by canonical type + room
// group + finish key - never by description text.
//
// The canonical types below are the ONE cabinet item taxonomy. They are laid over the approved
// quotation catalogue, so Client Selections (the room Cabinet Schedule), the Quotation Builder,
// BOQ and Procurement all name a cabinet by the same stable id and the same catalogue label.
//
// Quantity ownership: Takeoff / Job Setup state the starting quantity of a unit in a room. Once
// the room's Cabinet Schedule in Client Selections has a line for that unit, that line is the
// quantity (the takeoff figure is kept as the baseline). An estimator's own quantity typed on a
// linked quote row is kept and marked MANUAL OVERRIDE; it is never silently replaced.
import { FINAL_CABINETRY as source, cabinetryApplies } from './finalCabinetryQuotation.js';
import { updateQuoteQuantityField } from './quoteQuantityFormula.js';

export const CABINETRY_SELECTION_REQUIRED = 'CABINETRY SELECTION REQUIRED';
export const CABINETRY_MATCHED = 'MATCHED TO QUOTE ROW';
export const CABINETRY_UNMATCHED = 'UNMATCHED REQUIREMENT';
// Row marker. The "takeoff" prefix keeps it attached when reconcileCabinetryQuotation rebuilds rows.
const MARKER = 'takeoffCabinetryRequirement';
export const CABINETRY_MANUAL_OVERRIDE = 'MANUAL OVERRIDE';
export const CABINETRY_LINK_FIELD = MARKER;

export const CABINETRY_FINISHES = [
  { key: 'standard_colourboard', label: 'Standard Colourboard', range: 'STANDARD COLOURBOARD', aliases: ['Standard colour board', 'Flat standard colour board'] },
  { key: 'premium_laminate', label: 'Premium Laminate', range: 'PREMIUM LAMINATE', aliases: ['Premium decorative board'] },
  { key: 'two_pack', label: '2 Pack', range: '2 PACK', aliases: ['Two pack', '2 pac', '2pac', 'Two-pack painted', 'Two-pack painted doors'] },
  { key: 'shaker_style', label: 'Shaker Style', range: 'SHAKER STYLE', aliases: ['Shaker', 'Shaker/profile door', 'Shaker/profiled doors'] },
  { key: 'vinyl_wrap', label: 'Vinyl Wrap', range: 'VINYL WRAP', aliases: ['Thermolaminated/vinyl-wrap doors'] },
];
export const BENCHTOP_RANGES = [
  { key: 'standard_laminate', label: 'Standard Laminate', range: 'STANDARD LAMINATE' },
  { key: 'premium_laminate', label: 'Premium Laminate', range: 'PREMIUM LAMINATE' },
  { key: 'base_range_stone', label: 'Base Range Stone', range: 'BASE RANGE STONE - 20MM' },
  { key: 'mid_range_stone', label: 'Mid Range Stone', range: 'MID RANGE STONE - 20MM' },
  { key: 'high_end_stone', label: 'High End Stone', range: 'HIGH END STONE - 20MM' },
  { key: 'solid_surface_acrylic', label: 'Solid Surface / Acrylic', range: 'SOLID SURFACE / ACRYLIC', aliases: ['Solid surface', 'Acrylic'] },
  { key: 'porcelain_sintered', label: 'Porcelain / Sintered', range: 'PORCELAIN / SINTERED STONE', aliases: ['Porcelain', 'Sintered stone'] },
  { key: 'solid_timber_standard', label: 'Solid Timber - Standard Range', range: 'SOLID TIMBER - STANDARD RANGE' },
  { key: 'solid_timber_premium', label: 'Solid Timber - Premium Range', range: 'SOLID TIMBER - PREMIUM RANGE' },
  { key: 'natural_stone_standard', label: 'Natural Stone - Standard Range', range: 'NATURAL STONE - STANDARD RANGE' },
  { key: 'natural_stone_premium', label: 'Natural Stone - Premium Range', range: 'NATURAL STONE - PREMIUM RANGE' },
  { key: 'exotic_marble_quartzite', label: 'Exotic Marble / Quartzite', range: 'EXOTIC MARBLE / QUARTZITE', aliases: ['Exotic'] },
];

// Canonical requirement types, in the order the approved catalogue lists them inside each finish
// block. Position ties a type to its catalogue row; `at` carries the size a generic type
// (vanity_floor, tall_linen, wardrobe_hanging ...) is resolved by.
const t = (key, at = {}) => ({ key, ...at });
const BASES = [t('base_unit_600_1door'), t('base_unit_1200_2door'), t('sink_base')];
const UNITS = [t('corner_base'), t('dishwasher_opening'), t('microwave_cabinet'), t('pullout_bin'), t('drawer_base_2'), t('drawer_base_3'), t('drawer_base_4'), t('drawer_base_5'), t('hidden_internal_drawer')];
const OVERHEADS = [t('overhead_1door_standard'), t('overhead_2door_standard'), t('overhead_1door_extended'), t('overhead_2door_extended')];
const PANTRIES = [t('rangehood_cabinet'), t('tall_pantry_600', { widthMm: 600, doors: 1 }), t('tall_pantry_1200', { widthMm: 1200, doors: 2 })];
const BULKHEADS = [t('bulkhead_300'), t('bulkhead_450')];
const HANDLES = [t('handle_upgrade_sharkfin'), t('handle_upgrade_recessed_rail')];
const SHELVES = [t('cleated_shelf'), t('floating_shelf'), t('open_shelf')];
const LINEN = [t('tall_linen_600', { widthMm: 600, doors: 1 }), t('tall_linen_1200', { widthMm: 1200, doors: 2 })];
const CUTOUTS = [t('benchtop_sink_cutout'), t('benchtop_undermount_sink_cutout')];
const COOKTOP = [t('benchtop_cooktop_cutout'), t('benchtop_flush_cooktop_cutout')];
const EDGES = [t('benchtop_mitred_edge_40'), t('benchtop_mitred_edge_60'), t('benchtop_waterfall_standard'), t('benchtop_waterfall_premium'), t('benchtop_waterfall_porcelain'), t('benchtop_upstand'), t('benchtop_splashback_full_height')];
const benchtopBlocks = (widths, extras) => [
  ...BENCHTOP_RANGES.map(range => ({ range: range.range, finishKey: range.key, slots: widths.map(widthMm => t(`benchtop_${widthMm}`, { widthMm })) })),
  { range: 'BENCHTOP EXTRAS', finishKey: null, slots: extras },
];

// group -> catalogue room -> finish blocks. finishKey null = one row regardless of the selection.
const GROUPS = {
  kitchen: { label: 'Kitchen', cabinetry: { room: 'KITCHEN CABINETRY', slots: [...BASES, t('underbench_oven'), ...UNITS, ...OVERHEADS, ...PANTRIES, t('oven_tower_600'), ...BULKHEADS, ...HANDLES, t('wine_rack'), ...SHELVES, t('short_end_panel'), t('tall_end_panel')] },
    benchtops: { room: 'KITCHEN BENCHTOPS', blocks: benchtopBlocks([600, 900, 1200], [...CUTOUTS, ...COOKTOP, t('benchtop_tap_hole'), t('benchtop_drainer_grooves'), ...EDGES]) } },
  butlers_pantry: { label: "Butler's Pantry", cabinetry: { room: "BUTLER'S PANTRY CABINETRY", slots: [...BASES, ...UNITS, ...OVERHEADS, ...PANTRIES, ...BULKHEADS, ...HANDLES, t('wine_rack'), ...SHELVES] },
    benchtops: { room: "BUTLER'S PANTRY BENCHTOPS", blocks: benchtopBlocks([600, 900, 1200], [...CUTOUTS, ...COOKTOP, t('benchtop_tap_hole'), t('benchtop_drainer_grooves'), ...EDGES]) } },
  laundry: { label: 'Laundry', cabinetry: { room: 'LAUNDRY CABINETRY', slots: [...BASES, t('corner_base'), t('pullout_bin'), t('washer_dryer_opening'), ...OVERHEADS, ...LINEN, ...BULKHEADS, ...SHELVES] },
    benchtops: { room: 'LAUNDRY BENCHTOPS', blocks: benchtopBlocks([600, 900], [...CUTOUTS, t('benchtop_tap_hole'), t('benchtop_drainer_grooves'), ...EDGES]) } },
  bathroom: { label: 'Bathroom / Ensuite / Powder Room', cabinetry: { room: 'BATHROOM / ENSUITE / POWDER ROOM CABINETRY', slots: [
    t('vanity_floor_1door_600', { widthMm: 600, doors: 1 }), t('vanity_floor_2door_1200', { widthMm: 1200, doors: 2 }), t('vanity_floor_2drawer_600', { widthMm: 600, drawers: 2 }),
    t('vanity_floor_2drawer_750', { widthMm: 750, drawers: 2 }), t('vanity_floor_3drawer_900', { widthMm: 900, drawers: 3 }), t('vanity_floor_3drawer_1200', { widthMm: 1200, drawers: 3 }),
    t('vanity_wallhung_1door_600', { widthMm: 600, doors: 1 }), t('vanity_wallhung_2door_1200', { widthMm: 1200, doors: 2 }), t('vanity_wallhung_2drawer_750', { widthMm: 750, drawers: 2 }),
    t('vanity_wallhung_3drawer_900', { widthMm: 900, drawers: 3 }), t('vanity_wallhung_3drawer_1200', { widthMm: 1200, drawers: 3 }), t('vanity_wallhung_towel_shelf_1200', { widthMm: 1200, towelShelf: true }),
    t('shaving_cabinet_600', { widthMm: 600, doors: 1 }), t('shaving_cabinet_1200', { widthMm: 1200, doors: 2 }), ...LINEN, t('open_towel_shelf'), ...BULKHEADS] },
    benchtops: { room: 'BATHROOM BENCHTOPS', blocks: benchtopBlocks([600], [...CUTOUTS, t('benchtop_tap_hole'), ...EDGES]) } },
  wardrobes: { label: 'Wardrobes', cabinetry: { room: 'WARDROBES', blocks: [
    { range: 'WARDROBE INTERNAL FITOUT - STANDARD COLOURBOARD', finishKey: null, slots: [
      t('wardrobe_hanging_single_600_900', { widthRange: [600, 900] }), t('wardrobe_hanging_single_900_1200', { widthRange: [901, 1200] }), t('wardrobe_hanging_double_900_1200', { widthRange: [900, 1200], double: true }),
      t('wardrobe_shelving_tower_450_600', { widthRange: [450, 600] }), t('wardrobe_shelving_bay_900_1200', { widthRange: [900, 1200] }), t('wardrobe_drawer_shelf_tower_450_600'),
      t('wardrobe_drawers_4', { drawers: 4 }), t('wardrobe_drawers_5', { drawers: 5 }), t('wardrobe_overhead_900_1200'), t('wardrobe_shoe_bay_900_1200'),
      t('wardrobe_island_4drawer'), t('wardrobe_island_8drawer'), t('wardrobe_jewellery_drawer'), t('wardrobe_pullout_hamper'), t('wardrobe_tie_belt_rack'), t('wardrobe_valet_rail'), t('wardrobe_led_lighting')] },
    ...CABINETRY_FINISHES.map(finish => ({ range: `WARDROBE DOORS - ${finish.range}`, finishKey: finish.key, slots: [t('wardrobe_door_hinged'), t('wardrobe_door_sliding'), t('wardrobe_door_mirror_sliding')] })),
  ] } },
};
for (const group of Object.values(GROUPS)) if (group.cabinetry.slots) group.cabinetry.blocks = CABINETRY_FINISHES.map(finish => ({ range: finish.range, finishKey: finish.key, slots: group.cabinetry.slots }));

// (catalogue room, type, finish) -> approved catalogue row. Built by position and fails loudly if
// the approved catalogue no longer has the shape the type table describes.
const typeCategory = key => /_end_panel$/.test(key) ? 'panels' : /^(bulkhead|handle_upgrade|cleated_shelf|floating_shelf|open_shelf|open_towel_shelf|wine_rack)/.test(key) ? 'extras'
  : /^(overhead_|rangehood_cabinet)/.test(key) ? 'overhead' : /^(tall_|oven_tower)/.test(key) ? 'tall' : 'base';
const INDEX = new Map();
const TYPES = new Map();
const indexKey = (room, type, finishKey) => `${room}\u0000${type}\u0000${finishKey || ''}`;
for (const [groupKey, group] of Object.entries(GROUPS)) for (const area of [group.cabinetry, group.benchtops].filter(Boolean)) {
  for (const block of area.blocks) {
    const products = source.rows.filter(row => row.type === 'product' && row.room === area.room && row.range === block.range);
    if (products.length !== block.slots.length) throw Error(`Cabinetry requirement types do not fit ${area.room} / ${block.range}: ${products.length} rows, ${block.slots.length} types.`);
    block.slots.forEach((slot, position) => {
      const row = products[position];
      INDEX.set(indexKey(area.room, slot.key, block.finishKey), { importKey: row.key || `final-cabinetry:${row.sourceRow}`, description: row.description, price: row.price, unit: row.unit, range: row.range, room: row.room });
      // The label is the approved catalogue's own wording, so every module shows the same name.
      if (!TYPES.has(`${groupKey}\u0000${slot.key}`)) TYPES.set(`${groupKey}\u0000${slot.key}`, { ...slot, group: groupKey, area: area === group.benchtops ? 'benchtops' : 'cabinetry', finishDependent: Boolean(block.finishKey),
        label: /_end_panel$/.test(slot.key) ? row.description.split(' - ')[0] : row.description, unit: row.unit, category: typeCategory(slot.key) });
    });
  }
}

export const cabinetryRequirementTypes = groupKey => [...TYPES.values()].filter(type => !groupKey || type.group === groupKey);
export const cabinetryRoomGroups = () => Object.entries(GROUPS).map(([key, group]) => ({ key, label: group.label }));
export const cabinetryCatalogueRow = (groupKey, type, finishKey) => {
  const meta = TYPES.get(`${groupKey}\u0000${type}`);
  return meta ? INDEX.get(indexKey(GROUPS[groupKey][meta.area].room, type, meta.finishDependent ? finishKey : null)) || null : null;
};

// The room Cabinet Schedule offered in Client Selections: exactly the cabinet items the quotation
// catalogue prices for that room, grouped Base / Overhead / Tall / extras. Wet areas keep their own
// vanity schedule and wardrobes theirs, so they return no groups here.
const SCHEDULE_GROUPS = [['base', 'Base cabinets'], ['overhead', 'Overhead cabinets'], ['tall', 'Tall cabinets'], ['extras', 'Bulkheads, shelving & extras'], ['panels', 'Visible end panels']];
// base | overhead | tall | extras | panels - what kind of cabinetry a stable cabinet item id is.
export const cabinetryTypeCategory = typeCategory;
// Which cabinet list a room schedules from. Kitchen, Butler's Pantry and Laundry have their own
// priced list; any other dry room (a builder-added "Other" room) uses the Kitchen list so there is
// only ever one cabinet taxonomy. Wet areas and wardrobes have their own schedules (null).
function scheduleGroupForRoom(room) {
  const group = cabinetryRoomGroup(room);
  return ['kitchen', 'butlers_pantry', 'laundry'].includes(group) ? group : group ? null : 'kitchen';
}
export function cabinetryScheduleCatalogue(room) {
  const group = scheduleGroupForRoom(room);
  if (!group) return [];
  const types = cabinetryRequirementTypes(group).filter(type => type.area === 'cabinetry');
  return SCHEDULE_GROUPS.map(([key, title]) => ({ key, title, items: types.filter(type => type.category === key).map(type => ({ id: type.key, label: type.label, unit: type.unit })) })).filter(item => item.items.length);
}
export const cabinetryTypeLabel = (room, typeId) => cabinetryRequirementTypes(String(typeId).startsWith('wardrobe') ? 'wardrobes' : scheduleGroupForRoom(room) || cabinetryRoomGroup(room)).find(type => type.key === typeId)?.label || '';

const text = value => String(value ?? '').trim();
const norm = value => text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const number = value => value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value);
const aliasMap = list => new Map(list.flatMap(item => [item.key, item.label, item.range, ...(item.aliases || [])].map(alias => [norm(alias), item])));
const FINISH_ALIASES = aliasMap(CABINETRY_FINISHES);
const BENCHTOP_ALIASES = aliasMap(BENCHTOP_RANGES);
// Exact key / label / alias only: an unknown name is never mapped to the nearest finish.
export const cabinetryFinishFor = value => FINISH_ALIASES.get(norm(value)) || null;
export const benchtopRangeFor = value => BENCHTOP_ALIASES.get(norm(value)) || null;

export function cabinetryRoomKey(value) {
  const key = norm(value).replace(/ /g, '-');
  return key === 'butler-pantry' || key === 'butler-s-pantry' ? 'butlers-pantry' : key === 'powder' ? 'powder-room' : key;
}
// Physical room -> catalogue group. Each group has its own quote rows, so rooms never mix.
export function cabinetryRoomGroup(room) {
  const key = cabinetryRoomKey(room);
  if (/^(kitchen|kitchenette)$/.test(key)) return 'kitchen';
  if (/^(butlers-pantry|pantry|scullery)$/.test(key)) return 'butlers_pantry';
  if (/^laundry/.test(key)) return 'laundry';
  if (/bath|ensuite|powder|^wc$|toilet/.test(key)) return 'bathroom';
  if (/wardrobe|robe|^wir/.test(key)) return 'wardrobes';
  return '';
}

function normaliseRequirement(item, index, origin) {
  const room = text(item.room || item.location || item.roomLabel || item.roomKey);
  const type = text(item.type || item.requirementType || item.cabinetryType).toLowerCase();
  const lengthLm = number(item.lengthLm ?? item.lm ?? item.lengthLM);
  const quantity = number(item.quantity ?? item.qty) ?? lengthLm ?? 0;
  return { id: text(item.id) || `${origin}:${cabinetryRoomKey(room)}:${type}:${index}`, room, roomKey: cabinetryRoomKey(room), type,
    widthMm: number(item.widthMm ?? item.width), heightMm: number(item.heightMm ?? item.height), depthMm: number(item.depthMm ?? item.depth), lengthLm,
    doors: number(item.doors), drawers: number(item.drawers), double: item.double === true, towelShelf: item.towelShelf === true,
    quantity, source: text(item.source) || origin, planReference: text(item.planReference), legacyLabel: text(item.legacyLabel),
    ...(item.benchtopArea ? { benchtopArea: true, benchtopRangeKey: text(item.benchtopRangeKey), benchtopSurface: text(item.benchtopSurface) } : {}) };
}

// Schedule lines saved before the shared taxonomy carried only a display name. A name that means
// exactly one catalogue item is linked; one that does not (the generic "Standard base unit" is a
// 1 door or a 2 door unit, "Tall pantry" is 600 or 1200) is kept and reported for classification.
const LEGACY_SCHEDULE_TYPES = new Map(Object.entries({
  'Corner unit': { type: 'corner_base' }, 'Sink cupboard': { type: 'sink_base' }, 'Laundry tub base unit': { type: 'sink_base' }, 'Pull-out bin': { type: 'pullout_bin' },
  'Underbench oven cabinet': { type: 'underbench_oven' }, 'Dishwasher cabinet': { type: 'dishwasher_opening' }, 'Microwave cabinet': { type: 'microwave_cabinet' }, 'Rangehood cabinet': { type: 'rangehood_cabinet' },
  'Four-bank drawers': { type: 'drawer_base_4' }, 'Five-bank drawers': { type: 'drawer_base_5' }, 'Two-bank pot drawers': { type: 'drawer_base_2' },
  'Three-bank pot drawers: one small and two large': { type: 'drawer_base_3' }, 'Hidden drawers': { type: 'hidden_internal_drawer' },
  'bath-floor-two-door': { type: 'vanity_floor', doors: 2 }, 'bath-floor-one-door': { type: 'vanity_floor', doors: 1 }, 'bath-wall-two-door': { type: 'vanity_wallhung', doors: 2 }, 'bath-wall-one-door': { type: 'vanity_wallhung', doors: 1 },
  'bath-wall-three-drawer': { type: 'vanity_wallhung', drawers: 3 }, 'bath-wall-two-drawer': { type: 'vanity_wallhung', drawers: 2 }, 'bath-tall-linen': { type: 'tall_linen' },
  'bath-shaving-two-door': { type: 'shaving_cabinet', doors: 2 }, 'bath-shaving-one-door': { type: 'shaving_cabinet', doors: 1 },
}).map(([name, value]) => [norm(name), value]));
export const legacyCabinetryScheduleType = line => LEGACY_SCHEDULE_TYPES.get(norm(line?.type)) || LEGACY_SCHEDULE_TYPES.get(norm(line?.unitType)) || null;

// ---- Legacy schedule migration -------------------------------------------------------------------
// Brings Cabinet Schedule lines saved under the old display-name list onto the canonical cabinet
// items. It is the only place old lines are interpreted: Client Selections runs it whenever a
// cabinetry selection is loaded or saved, and the quote runs it on whatever is stored, so an old
// line can never appear in the schedule or count beside its canonical replacement.
//   - a name that means exactly one item priced for that room becomes that item (quantity, notes,
//     room, handle count and its own id carried over);
//   - if the room already has that canonical item, the canonical line stands and the old line is
//     retired, so one physical cabinet is never counted twice;
//   - a name that could be more than one item ("Standard base unit": 1 door or 2 door) is NOT
//     guessed. It leaves the schedule and is kept, whole, in the archive for internal review.
// Returns the same array (and empty lists) when there is nothing to migrate.
export function migrateCabinetSchedule(lines = []) {
  const isOld = line => line && !line.cabinetTypeId && !/^bath-/.test(line.type || line.unitType || '') && scheduleGroupForRoom(line.location);
  if (!lines.some(isOld)) return { schedule: lines, migrated: [], archived: [] };
  const byItem = new Map(lines.filter(line => line?.cabinetTypeId).map(line => [`${cabinetryRoomKey(line.location)}\u0000${line.cabinetTypeId}`, line]));
  const schedule = [], migrated = [], archived = [];
  for (const line of lines) {
    if (!isOld(line)) { schedule.push(line); continue; }
    const group = scheduleGroupForRoom(line.location);
    const typeId = legacyCabinetryScheduleType(line)?.type;
    const item = typeId && cabinetryRequirementTypes(group).find(type => type.key === typeId && type.area === 'cabinetry');
    const record = { componentId: line.componentId, location: line.location, unitType: line.unitType || line.type || '', quantity: number(line.quantity) ?? 0, notes: line.notes || '' };
    if (!item) { archived.push({ ...line, archiveReason: typeId ? 'not a priced item in this room' : 'ambiguous: more than one current cabinet item fits' }); continue; }
    const key = `${cabinetryRoomKey(line.location)}\u0000${item.key}`;
    if (byItem.has(key)) { archived.push({ ...line, archiveReason: `superseded by the current "${item.label}" line` }); continue; }
    // migratedFrom records that this line came from the old list (see cabinetryScheduleScope).
    const next = { ...line, cabinetTypeId: item.key, unitType: item.label, migratedFrom: line.unitType || line.type || '' };
    byItem.set(key, next); schedule.push(next);
    migrated.push({ ...record, cabinetTypeId: item.key, label: item.label });
  }
  return { schedule, migrated, archived };
}

function cabinetrySelectionsOf(workbook) {
  const book = workbook.clientSelectionsBook || workbook.selectionsBook || {};
  return (book.rooms || []).flatMap(room => room.rows || []).map(row => row.guidedSelection?.cabinetrySelection || row.guidedSelection?.selected_details?.cabinetrySelection).filter(Boolean);
}
const scheduleLinesOf = selection => Array.isArray(selection.schedule) && selection.schedule.length ? selection.schedule
  : (selection.locations || []).flatMap(location => (location.cabinetSchedule || []).map(line => ({ ...line, location: line.location || location.location || location.name })));

// Job-level migration (job schema 3): rewrites every saved Cabinet Schedule in the job onto the
// canonical cabinet items when the job is loaded, so an existing job is cleaned without anyone
// opening Client Selections. Only the schedule lines change; rooms, finishes, benchtops, handles,
// features and every other selection are returned by reference. Same workbook back when clean.
const SELECTION_BOOK_KEYS = ['clientSelectionsBook', 'selectionsBook', 'selectionSchedule', 'selectionSchedules'];
function migrateSelection(selection) {
  if (!selection || typeof selection !== 'object') return selection;
  const fromRooms = !(Array.isArray(selection.schedule) && selection.schedule.length);
  const result = migrateCabinetSchedule(scheduleLinesOf(selection));
  if (!result.migrated.length && !result.archived.length) return selection;
  const known = new Set((selection.legacyCabinetSchedule || []).map(line => line.componentId));
  return { ...selection, schedule: result.schedule,
    ...(fromRooms ? { locations: (selection.locations || []).map(location => ({ ...location, cabinetSchedule: [] })) } : {}),
    legacyCabinetSchedule: [...(selection.legacyCabinetSchedule || []), ...result.archived.filter(line => !known.has(line.componentId))],
    cabinetScheduleMigration: [...(selection.cabinetScheduleMigration || []), ...result.migrated] };
}
export function migrateWorkbookCabinetSchedules(workbook) {
  if (!workbook || typeof workbook !== 'object') return workbook;
  let next = workbook;
  const done = new Map();
  for (const key of SELECTION_BOOK_KEYS) {
    const book = workbook[key];
    if (!book || !Array.isArray(book.rooms)) continue;
    if (!done.has(book)) {
      let changed = false;
      const rooms = book.rooms.map(room => {
        let roomChanged = false;
        const rows = (room.rows || []).map(row => {
          const guided = row.guidedSelection;
          if (!guided) return row;
          const direct = migrateSelection(guided.cabinetrySelection);
          const nested = migrateSelection(guided.selected_details?.cabinetrySelection);
          if (direct === guided.cabinetrySelection && nested === guided.selected_details?.cabinetrySelection) return row;
          roomChanged = true;
          return { ...row, guidedSelection: { ...guided, ...(guided.cabinetrySelection ? { cabinetrySelection: direct } : {}),
            ...(guided.selected_details?.cabinetrySelection ? { selected_details: { ...guided.selected_details, cabinetrySelection: nested } } : {}) } };
        });
        if (!roomChanged) return room;
        changed = true;
        return { ...room, rows };
      });
      done.set(book, changed ? { ...book, rooms } : book);
    }
    if (done.get(book) !== book) next = { ...next, [key]: done.get(book) };
  }
  return next;
}

// Old schedule lines that were retired without a canonical replacement, for internal review only.
export function cabinetryLegacyArchive(workbook = {}) {
  const seen = new Set();
  return cabinetrySelectionsOf(workbook).flatMap(selection => [...(selection.legacyCabinetSchedule || []), ...migrateCabinetSchedule(scheduleLinesOf(selection)).archived])
    .filter(line => !seen.has(line.componentId) && seen.add(line.componentId))
    .map(line => ({ room: line.location, label: line.unitType || line.type || '', quantity: number(line.quantity) ?? 0, notes: line.notes || '', reason: line.archiveReason || '' }));
}

// The room Cabinet Schedules saved in Client Selections, as requirements. Only canonical cabinet
// items (and bathroom vanity lines) reach the quote; retired old lines never do.
function selectionScheduleRequirements(workbook) {
  const seen = new Set();
  return cabinetrySelectionsOf(workbook).flatMap(selection => {
    const excluded = new Set((selection.locations || []).filter(location => location.included === false).map(location => cabinetryRoomKey(location.location || location.name)));
    const lines = migrateCabinetSchedule(scheduleLinesOf(selection)).schedule;
    return lines.filter(line => line && !excluded.has(cabinetryRoomKey(line.location)) && !seen.has(line.componentId) && seen.add(line.componentId)).map((line, index) => {
      const vanity = line.cabinetTypeId ? null : legacyCabinetryScheduleType(line);
      return normaliseRequirement({ ...vanity, id: `selection:${line.componentId || index}`, room: line.location, type: line.cabinetTypeId || vanity?.type || '',
        width: line.width, quantity: number(line.quantity) ?? 0, source: 'CLIENT_SELECTION', legacyLabel: line.unitType || line.type }, index, 'CLIENT_SELECTION');
    });
  });
}

// The benchtops chosen in Client Selections (benchtopSelection.js), as requirements: each benchtop
// area is its length in LM on the row of ITS surface's quotation range, so a kitchen whose island
// differs from its main bench lands on two ranges, and a changed surface moves the quantity to the
// new range's row. Cut-outs, waterfall ends and the upstand follow the room's benchtop setup.
const STONE_RANGE = /stone|porcelain|marble|solid_surface/;
function benchtopSelectionRequirements(workbook) {
  const out = [];
  for (const selection of cabinetrySelectionsOf(workbook)) for (const location of selection.locations || []) {
    if (location.included === false || !Array.isArray(location.benchtopAreas)) continue;
    const room = location.location || location.name;
    const roomKey = cabinetryRoomKey(room);
    const group = cabinetryRoomGroup(room);
    if (!group || !GROUPS[group].benchtops) continue;
    const has = type => TYPES.has(`${group}\u0000${type}`);
    const add = (id, type, quantity, extra = {}) => { if (has(type) && quantity > 0) out.push({ id: `benchtop:${roomKey}:${id}`, room, type, quantity, source: 'CLIENT_SELECTION', ...extra }); };
    const areas = location.benchtopAreas.map(area => ({ ...area, lm: Math.round((number(area.lengthMm) || 0) / 10) / 100, rangeKey: text(area.surface?.rangeKey || area.surface?.benchtopRangeKey) })).filter(area => area.surface && area.lm > 0);
    for (const area of areas) add(area.id, `benchtop_${number(area.depthMm) || 600}`, area.lm, { benchtopArea: true, benchtopRangeKey: area.rangeKey, benchtopSurface: [area.surface.supplier, area.surface.colourName || area.surface.colour || area.surface.range].filter(Boolean).join(' ') });
    const setup = location.benchtopSetup;
    if (!areas.length || !setup?.confirmedAt) continue;
    const cutouts = Array.isArray(setup.cutouts) ? setup.cutouts : [];
    // A bench has one sink; each vanity top has its own basin and tap.
    const each = group === 'bathroom' ? areas.length : 1;
    if (cutouts.includes('Sink')) add('sink-cutout', 'benchtop_sink_cutout', each);
    if (cutouts.includes('Cooktop')) add('cooktop-cutout', 'benchtop_cooktop_cutout', 1);
    if (cutouts.includes('Tap')) add('tap-hole', 'benchtop_tap_hole', each);
    // Waterfall ends and the upstand are stone items in the catalogue; a laminate top has neither row.
    const range = areas[0].rangeKey;
    if (!STONE_RANGE.test(range)) continue;
    const ends = setup.waterfallEnds === 'Both' ? 2 : /^(left|right)$/i.test(text(setup.waterfallEnds)) ? 1 : 0;
    add('waterfall', range === 'porcelain_sintered' ? 'benchtop_waterfall_porcelain' : /high_end|premium|exotic/.test(range) ? 'benchtop_waterfall_premium' : 'benchtop_waterfall_standard', ends);
    // The upstand runs along the wall benches, not an island.
    if (setup.upstand && setup.upstand !== 'None') add('upstand', 'benchtop_upstand', Math.round(areas.filter(area => !/island|breakfast/i.test(text(area.label))).reduce((total, area) => total + area.lm, 0) * 100) / 100);
  }
  return out.map((item, index) => normaliseRequirement(item, index, 'CLIENT_SELECTION'));
}

// Every place a job can state what cabinetry is required: Job Setup / explicit entry, the AI
// takeoff, and the room Cabinet Schedules in Client Selections.
export function collectCabinetryRequirements(workbook = {}) {
  const takeoff = workbook.aiPlanTakeoffJob || workbook.takeoffEngine?.aiPlanTakeoffJob || {};
  const analysis = takeoff.aiAnalysis || takeoff.scheduleState?.aiAnalysis || {};
  const list = value => Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
  const seen = new Set();
  return [
    ['EXPLICIT', list(workbook.cabinetryRequirements)],
    ['JOB_SETUP', list(workbook.data?.cabinetryRequirements)],
    ['AI_TAKEOFF', [...list(takeoff.cabinetryRequirements), ...list(takeoff.scheduleState?.cabinetryRequirements), ...list(analysis.cabinetry)]],
  ].flatMap(([origin, items]) => items.map((item, index) => normaliseRequirement(item || {}, index, origin)))
    .concat(selectionScheduleRequirements(workbook))
    .concat(benchtopSelectionRequirements(workbook))
    .filter(item => !seen.has(item.id) && seen.add(item.id));
}

function selectionRooms(workbook) {
  const book = workbook.clientSelectionsBook || workbook.selectionsBook || {};
  const rooms = {};
  const put = (room, field, value, name) => {
    const key = cabinetryRoomKey(room);
    if (!key || !text(name ?? value) || rooms[key]?.[field]) return;
    const item = field === 'finish' ? cabinetryFinishFor(value) : benchtopRangeFor(value);
    rooms[key] = { ...rooms[key], [field]: item ? { key: item.key, label: item.label } : { unmapped: text(name ?? value) } };
  };
  for (const row of (book.rooms || []).flatMap(room => room.rows || [])) {
    const guided = row.guidedSelection || {};
    const legacy = guided.cabinetrySelection || guided.selected_details?.cabinetrySelection;
    for (const location of legacy?.locations || []) {
      if (location.included === false) continue;
      // The finish shown as selected for the room in Doors & Panels IS the room's finish, whether
      // or not the room has been confirmed yet. A room that has never opened that step is on the
      // same default the screen shows. (Waiting for confirmation left every scheduled quantity
      // without a finish, so no quote row could be chosen and the quote stayed blank.)
      const material = location.cabinetryFinishKey || location.doorMaterialGroup || location.doorAndPanelSelections?.material || 'Standard colourboard';
      put(location.location || location.name, 'finish', material);
      const top = location.benchtop || location.benchtops;
      if (top) put(location.location || location.name, 'benchtop', top.rangeKey || top.benchtopRangeKey || top.priceRange || top.range, top.rangeKey || top.priceRange || top.range || top.productName || top.category);
    }
    const room = guided.cabinetryRoom || guided.selected_details?.cabinetryRoom;
    if (room?.roomKey) {
      const finish = room.finish || {};
      put(room.roomKey, 'finish', room.cabinetryFinishKey || finish.cabinetryFinishKey || finish.finishRange || finish.materialGroup, room.cabinetryFinishKey || finish.cabinetryFinishKey || finish.finishRange || finish.materialGroup);
      const top = room.benchtop || {};
      const range = top.rangeKey || top.benchtopRangeKey || top.product?.benchtopRangeKey || top.product?.priceRange;
      if (range || (top.material && top.material !== 'none' && top.product)) put(room.roomKey, 'benchtop', range, range || top.product?.productName || top.material);
    }
  }
  return rooms;
}

function inclusionRooms(workbook) {
  const snapshot = workbook.jobInclusionSnapshot?.jobInclusionSnapshot || workbook.jobInclusionSnapshot || {};
  const name = text(snapshot.schedule?.display_name || snapshot.schedule?.name || workbook.jobInclusionScheduleName) || 'Inclusion Schedule';
  const rooms = {};
  for (const item of snapshot.items || []) {
    const slot = norm(item.selection_slot_id || item.selectionSlotId || item.requirementKey).replace(/ /g, '_');
    const meta = item.metadata || {};
    const value = meta.cabinetryFinishKey || meta.benchtopRangeKey || item.baselineProductName || meta.productName;
    const field = meta.benchtopRangeKey || slot === 'benchtop_range' ? 'benchtop' : meta.cabinetryFinishKey || /^(cabinetry|wardrobe)_finish$/.test(slot) ? 'finish' : '';
    const found = field === 'finish' ? cabinetryFinishFor(value) : field ? benchtopRangeFor(value) : null;
    if (!found) continue;
    const room = cabinetryRoomKey(meta.roomKey || meta.room || item.location_id || item.locationId || (slot === 'wardrobe_finish' ? 'wardrobes' : '')) || '*';
    rooms[room] = { ...rooms[room], [field]: rooms[room]?.[field] || { key: found.key, label: found.label } };
  }
  return { name, rooms };
}

// What Client Selections already knows about each major area of the CABINETRY section, keyed by
// the area's heading in the quotation: whether its cabinetry room(s) are confirmed, and which
// finish / benchtop range is chosen. Read-only; used to decide which groups start collapsed.
export function cabinetryQuoteGroupStatus(workbook = {}) {
  const chosen = selectionRooms(workbook);
  const areas = {};
  for (const selection of cabinetrySelectionsOf(workbook)) for (const location of selection.locations || []) {
    const name = location.location || location.name;
    const group = GROUPS[cabinetryRoomGroup(name)];
    if (location.included === false || !group) continue;
    const confirmed = Boolean(location.confirmedAt || location.status === 'complete');
    for (const [area, field, list] of [['cabinetry', 'finish', CABINETRY_FINISHES], ['benchtops', 'benchtop', BENCHTOP_RANGES]]) {
      if (!group[area]) continue;
      const entry = areas[group[area].room] ||= { rooms: 0, confirmedRooms: 0, selected: [] };
      entry.rooms += 1; if (confirmed) entry.confirmedRooms += 1;
      const range = list.find(item => item.key === chosen[cabinetryRoomKey(name)]?.[field]?.key)?.range;
      if (range && !entry.selected.includes(range)) entry.selected.push(range);
    }
  }
  // Rooms that share one heading (Bathroom / Ensuite / Powder Room) are confirmed when all of them are.
  return Object.fromEntries(Object.entries(areas).map(([heading, entry]) => [heading, { confirmed: entry.confirmedRooms === entry.rooms, selected: entry.selected }]));
}

// CLIENT_SELECTION > INCLUSION_SCHEDULE > unselected. No finish is ever guessed.
function resolveFinish(field, roomKeys, selections, inclusions) {
  for (const key of roomKeys) {
    const chosen = selections[key]?.[field];
    if (chosen?.key) return { ...chosen, source: 'CLIENT_SELECTION', sourceLabel: 'From Client Selections' };
    if (chosen?.unmapped) return { key: '', label: chosen.unmapped, source: 'CLIENT_SELECTION', reason: `Client selection "${chosen.unmapped}" is not an approved ${field === 'finish' ? 'cabinetry finish' : 'benchtop range'}` };
  }
  for (const key of [...roomKeys, '*']) {
    const included = inclusions.rooms[key]?.[field];
    if (included) return { ...included, source: 'INCLUSION_SCHEDULE', sourceLabel: `From ${inclusions.name}` };
  }
  return { key: '', label: '', source: 'UNSELECTED', reason: `No ${field === 'finish' ? 'cabinetry finish' : 'benchtop range'} in Client Selections or the Inclusion Schedule` };
}

function resolveType(requirement, groupKey) {
  if (TYPES.has(`${groupKey}\u0000${requirement.type}`)) return TYPES.get(`${groupKey}\u0000${requirement.type}`);
  // Generic type (vanity_floor, tall_linen, benchtop, wardrobe_hanging ...): exactly one sized variant must fit.
  const width = requirement.widthMm;
  const checks = [
    [width, type => type.widthMm != null || type.widthRange, type => type.widthMm === width || Boolean(type.widthRange && width >= type.widthRange[0] && width <= type.widthRange[1])],
    // A door count rules out a drawer variant and vice versa.
    ...['doors', 'drawers'].map(key => [requirement[key], type => type.doors != null || type.drawers != null, type => type[key] === requirement[key]]),
  ].filter(([given]) => given != null);
  // A stated size the variant carries must agree, and a sized request never lands on an unsized item.
  const fits = cabinetryRequirementTypes(groupKey).filter(type => type.key.startsWith(`${requirement.type}_`)
    && Boolean(type.double) === requirement.double && Boolean(type.towelShelf) === requirement.towelShelf
    && checks.every(([, carries, agrees]) => !carries(type) || agrees(type))
    && (!checks.length || checks.some(([, carries]) => carries(type))));
  return fits.length === 1 ? fits[0] : null;
}

// Pure plan: every requirement gets exactly one outcome; nothing is dropped.
export function planCabinetryQuotation(workbook = {}) {
  const selections = selectionRooms(workbook), inclusions = inclusionRooms(workbook);
  const rows = new Map();
  const resolved = collectCabinetryRequirements(workbook).map(requirement => {
    const wardrobe = requirement.type.startsWith('wardrobe');
    const groupKey = requirement.type ? (wardrobe ? 'wardrobes' : cabinetryRoomGroup(requirement.room)) : '';
    return { requirement, wardrobe, groupKey, type: groupKey ? resolveType(requirement, groupKey) : null };
  });
  // A unit the room's Cabinet Schedule states is owned by Client Selections; the takeoff / Job
  // Setup figure for the same unit in the same room becomes its baseline, not a second quantity.
  const scheduleKey = item => `${item.requirement.roomKey}\u0000${item.type?.key}`;
  const scheduled = new Map(resolved.filter(item => item.type && item.requirement.source === 'CLIENT_SELECTION').map(item => [scheduleKey(item), item.requirement.quantity]));
  const entries = resolved.map(({ requirement, wardrobe, groupKey, type }) => {
    const dimensions = [requirement.widthMm && `${requirement.widthMm}mm wide`, requirement.doors && `${requirement.doors} door`, requirement.drawers && `${requirement.drawers} drawer`, requirement.heightMm && `${requirement.heightMm}mm high`, requirement.depthMm && `${requirement.depthMm}mm deep`, requirement.lengthLm && `${requirement.lengthLm} LM`].filter(Boolean).join(' x ');
    const fromSelection = requirement.source === 'CLIENT_SELECTION';
    const baseline = !fromSelection && Boolean(type) && scheduled.has(scheduleKey({ requirement, type }));
    const entry = { requirementId: requirement.id, room: requirement.room, type: type?.key || requirement.type, label: type?.label || requirement.legacyLabel, dimensions, quantity: requirement.quantity, requirementSource: requirement.source,
      selectedFinish: '', finishSource: '', matchedQuoteRow: '', matchedImportKey: '', status: CABINETRY_UNMATCHED, flag: '', reason: '' };
    const fail = (reason, flag = '') => ({ ...entry, reason, flag });
    if (!requirement.type) return fail(requirement.legacyLabel ? `"${requirement.legacyLabel}" has no priced cabinet item` : 'Requirement has no cabinetry type');
    if (!groupKey) return fail(`Room "${requirement.room}" has no cabinetry catalogue group`);
    if (!type) return fail(`No approved ${GROUPS[groupKey].label} catalogue item for ${requirement.legacyLabel ? `"${requirement.legacyLabel}"` : `type "${requirement.type}"`}${dimensions ? ` (${dimensions})` : requirement.legacyLabel ? ' - a width is needed to choose the size' : ''}`);
    if (!(requirement.quantity > 0) && !fromSelection) return fail('Requirement has no quantity');
    // Wardrobe internal fitout and benchtop extras have one approved row whatever the selection.
    let finish = { key: null, label: wardrobe ? 'Standard Colourboard' : 'Benchtop extra', source: 'CATALOGUE', sourceLabel: 'Fixed catalogue item' };
    if (type.finishDependent && requirement.benchtopArea) {
      // A benchtop area is priced on the range of its own surface, whatever the rest of the room has.
      const range = BENCHTOP_RANGES.find(item => item.key === requirement.benchtopRangeKey);
      finish = range ? { key: range.key, label: range.label, source: 'CLIENT_SELECTION', sourceLabel: `From Client Selections${requirement.benchtopSurface ? ` - ${requirement.benchtopSurface}` : ''}` }
        : { key: '', label: requirement.benchtopSurface, source: 'CLIENT_SELECTION', reason: `${requirement.benchtopSurface || 'The selected surface'} has no quotation range set` };
      entry.selectedFinish = finish.label; entry.finishSource = finish.source;
      if (!finish.key) return fail(finish.reason, CABINETRY_SELECTION_REQUIRED);
    } else if (type.finishDependent) {
      finish = resolveFinish(type.area === 'benchtops' ? 'benchtop' : 'finish', wardrobe ? [requirement.roomKey, 'wardrobes'] : [requirement.roomKey], selections, inclusions);
      entry.selectedFinish = finish.label; entry.finishSource = finish.source;
      if (!finish.key) return fail(finish.reason, CABINETRY_SELECTION_REQUIRED);
    }
    const row = cabinetryCatalogueRow(groupKey, type.key, finish.key);
    if (!row) return fail(`No approved catalogue row for ${type.key} in ${finish.label}`);
    const target = rows.get(row.importKey) || { importKey: row.importKey, quantity: 0, baselineQuantity: 0, rooms: [], roomQuantities: {}, requirementIds: [], cabinetTypeId: type.key, finishKey: finish.key || '', finishLabel: finish.label, source: finish.source, sourceLabel: finish.sourceLabel, quantitySource: '' };
    const add = (total, value) => Math.round((total + value) * 1000) / 1000;
    if (baseline) target.baselineQuantity = add(target.baselineQuantity, requirement.quantity);
    else {
      target.quantity = add(target.quantity, requirement.quantity);
      // The room breakdown is kept even where rooms share one catalogue row.
      target.roomQuantities[requirement.room] = add(target.roomQuantities[requirement.room] || 0, requirement.quantity);
      if (!target.rooms.includes(requirement.room)) target.rooms.push(requirement.room);
      target.requirementIds.push(requirement.id);
      if (fromSelection || !target.quantitySource) target.quantitySource = requirement.source;
    }
    rows.set(row.importKey, target);
    return { ...entry, selectedFinish: finish.label, finishSource: finish.source, matchedQuoteRow: `${row.range} - ${row.description}`, matchedImportKey: row.importKey, status: CABINETRY_MATCHED,
      reason: baseline ? `Baseline: Client Selections sets this unit to ${scheduled.get(scheduleKey({ requirement, type }))}` : fromSelection && !(requirement.quantity > 0) ? 'Set to 0 in Client Selections' : '' };
  });
  // A unit scheduled at 0 has no quantity to carry on a quote row.
  for (const [key, target] of rows) if (!(target.quantity > 0)) rows.delete(key);
  return { entries, rows };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const blank = value => value === '' || value == null;

// Writes the plan onto the existing CABINETRY catalogue rows. Rows are only ever updated in place:
// none are added, removed or reordered, and rows this engine does not own are returned untouched.
export function applyCabinetryRequirementsToQuotation(workbook, workspaceId) {
  const group = workbook?.quotation?.CABINETRY;
  if (!group?.rows || !cabinetryApplies(workspaceId) || (workbook.workspaceId && workbook.workspaceId !== workspaceId)) return workbook;
  const { entries, rows: plan } = planCabinetryQuotation(workbook);
  const legacyArchive = cabinetryLegacyArchive(workbook);
  if (!entries.length && !legacyArchive.length && !workbook.cabinetryReconciliation && !group.rows.some(row => row[MARKER])) return workbook;
  const present = new Set(group.rows.map(row => row.importKey));
  const overridden = new Set();
  let changed = false;
  const rows = group.rows.map(row => {
    const target = plan.get(row.importKey);
    const previous = row[MARKER];
    if (!target) {
      if (!previous) return row;
      // The finish or requirement moved on: hand the row back blank. An estimator's own
      // quantity is theirs and stays, as an ordinary manual row.
      const { [MARKER]: removed, ...rest } = row;
      changed = true;
      const selectionSpec = rest.selectionSpec === previous.selectionSpec ? '' : rest.selectionSpec;
      return previous.manualOverride ? { ...rest, selectionSpec } : { ...rest, quantity: '', qty: '', quantityManualOverride: false, selectionSpec };
    }
    const current = blank(row.quantity) ? null : Number(row.quantity);
    // Any quantity on the row that this engine did not write itself belongs to the estimator.
    const engineWrote = previous && !previous.manualOverride && current === previous.quantity;
    const manual = current != null && current !== target.quantity && !engineWrote;
    const breakdown = target.rooms.length > 1 ? target.rooms.map(room => `${room} ${target.roomQuantities[room]}`).join(', ') : target.rooms.join(', ');
    const linked = [breakdown, target.finishLabel, target.sourceLabel,
      target.quantitySource === 'CLIENT_SELECTION' ? `Qty from Client Selections${target.baselineQuantity ? ` (baseline ${target.baselineQuantity})` : ''}` : ''].filter(Boolean).join(' · ');
    const selectionSpec = manual ? `${CABINETRY_MANUAL_OVERRIDE} ${current} (linked qty ${target.quantity}) · ${linked}` : linked;
    const marker = { quantity: target.quantity, baselineQuantity: target.baselineQuantity, rooms: target.rooms, roomQuantities: target.roomQuantities, cabinetTypeId: target.cabinetTypeId, finishKey: target.finishKey,
      source: target.source, quantitySource: target.quantitySource, selectionSpec, requirementIds: target.requirementIds, ...(manual ? { manualOverride: true, manualQuantity: current } : {}) };
    if (manual) {
      overridden.add(row.importKey);
      if (same(previous, marker) && row.selectionSpec === selectionSpec) return row;
      changed = true;
      return { ...row, selectionSpec, [MARKER]: marker };
    }
    if (same(previous, marker) && current === target.quantity && row.selectionSpec === selectionSpec && !row.quantityFormulaOverride) return row;
    changed = true;
    return { ...updateQuoteQuantityField(row, 'quantity', target.quantity), qty: target.quantity, selectionSpec, [MARKER]: marker };
  });
  const reconciled = entries.map(entry => entry.status !== CABINETRY_MATCHED ? entry
    : !present.has(entry.matchedImportKey) ? { ...entry, status: CABINETRY_UNMATCHED, reason: 'Approved catalogue row is missing from this quotation' }
    : overridden.has(entry.matchedImportKey) ? { ...entry, flag: CABINETRY_MANUAL_OVERRIDE } : entry);
  const count = test => reconciled.filter(test).length;
  const cabinetryReconciliation = { entries: reconciled, summary: { total: reconciled.length, matched: count(entry => entry.status === CABINETRY_MATCHED), unmatched: count(entry => entry.status === CABINETRY_UNMATCHED),
    selectionRequired: count(entry => entry.flag === CABINETRY_SELECTION_REQUIRED), legacyArchived: legacyArchive.length, manualOverrides: overridden.size },
    // Internal migration record: old schedule lines retired without a current cabinet item. Never shown in Client Selections.
    ...(legacyArchive.length ? { legacyArchive } : {}) };
  if (!changed && same(workbook.cabinetryReconciliation, cabinetryReconciliation)) return workbook;
  return { ...workbook, quotation: changed ? { ...workbook.quotation, CABINETRY: { ...group, rows } } : workbook.quotation, cabinetryReconciliation };
}

// Explicit requirement data (Job Setup / plan measurement entry). Quantities live here, never in selections.
export function setCabinetryRequirements(workbook, items) {
  return { ...workbook, cabinetryRequirements: { items: items.map((item, index) => ({ ...item, id: text(item.id) || `explicit:${Date.now()}:${index}`, source: text(item.source) || 'JOB_SETUP' })) } };
}
