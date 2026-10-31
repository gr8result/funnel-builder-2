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
import { FINAL_CABINETRY as source, cabinetryApplies, finalCabinetryProducts } from './finalCabinetryQuotation.js';
import { canonicalProjectRoomName, projectRoomModel } from '../builders/projectRoomModel.js';
import { updateQuoteQuantityField } from './quoteQuantityFormula.js';
import { applyIslandInheritance } from '../builders/benchtopInheritance.js';
import { cabinetryRequirementsFromTakeoff } from './takeoffCabinetryMeasurements.js';

export const CABINETRY_SELECTION_REQUIRED = 'CABINETRY SELECTION REQUIRED';
export const CABINETRY_MATCHED = 'MATCHED TO QUOTE ROW';
export const CABINETRY_UNMATCHED = 'UNMATCHED REQUIREMENT';
// Row marker. The "takeoff" prefix keeps it attached when reconcileCabinetryQuotation rebuilds rows.
const MARKER = 'takeoffCabinetryRequirement';
export const CABINETRY_MANUAL_OVERRIDE = 'MANUAL OVERRIDE';
// Every source requirement ends as exactly one of these (entry.outcome).
export const CABINETRY_ACTION_REQUIRED = 'ACTION REQUIRED';
export const CABINETRY_OUTCOME_MATCHED = 'MATCHED';
export const CABINETRY_LINK_FIELD = MARKER;
export const CABINETRY_MASTER_SHARKFIN_RATE = 30;

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
const IDENTITY = new Map();
const indexKey = (room, type, finishKey) => `${room}\u0000${type}\u0000${finishKey || ''}`;
for (const [groupKey, group] of Object.entries(GROUPS)) for (const area of [group.cabinetry, group.benchtops].filter(Boolean)) {
  for (const block of area.blocks) {
    const products = source.rows.filter(row => row.type === 'product' && row.room === area.room && row.range === block.range);
    if (products.length !== block.slots.length) throw Error(`Cabinetry requirement types do not fit ${area.room} / ${block.range}: ${products.length} rows, ${block.slots.length} types.`);
    block.slots.forEach((slot, position) => {
      const row = products[position];
      IDENTITY.set(row.key || `final-cabinetry:${row.sourceRow}`, { cabinetryGroup: groupKey, cabinetTypeId: slot.key, ...(block.finishKey ? { [area === group.benchtops ? 'benchtopRangeKey' : 'cabinetryFinishKey']: block.finishKey } : {}) });
      INDEX.set(indexKey(area.room, slot.key, block.finishKey), { importKey: row.key || `final-cabinetry:${row.sourceRow}`, description: row.description, price: row.price, unit: row.unit, range: row.range, room: row.room });
      // The label is the approved catalogue's own wording, so every module shows the same name.
      if (!TYPES.has(`${groupKey}\u0000${slot.key}`)) TYPES.set(`${groupKey}\u0000${slot.key}`, { ...slot, group: groupKey, area: area === group.benchtops ? 'benchtops' : 'cabinetry', finishDependent: Boolean(block.finishKey),
        label: /_end_panel$/.test(slot.key) ? row.description.split(' - ')[0] : row.description, unit: row.unit, category: typeCategory(slot.key) });
    });
  }
}

// An approved quote row's place in the taxonomy: { cabinetryGroup, cabinetTypeId, cabinetryFinishKey | benchtopRangeKey }.
export const cabinetryCatalogueIdentity = importKey => IDENTITY.get(importKey) || null;
// The approved cabinetry as tenant Product Library products. Each carries the same canonical
// identity the quotation resolves by, so the library is a view of the one catalogue, not a second one.
export const canonicalCabinetryProducts = finalCabinetryProducts.map(product => ({ ...product, attributes: { ...product.attributes, ...IDENTITY.get(product.productCode) } }));
export const cabinetryRequirementTypes = groupKey => [...TYPES.values()].filter(type => !groupKey || type.group === groupKey);
export const cabinetryRoomGroups = () => Object.entries(GROUPS).map(([key, group]) => ({ key, label: group.label }));
export const cabinetryCatalogueRow = (groupKey, type, finishKey) => {
  const meta = TYPES.get(`${groupKey}\u0000${type}`);
  return meta ? INDEX.get(indexKey(GROUPS[groupKey][meta.area].room, type, meta.finishDependent ? finishKey : null)) || null : null;
};

// The room Cabinet Schedule offered in Client Selections: exactly the cabinet items the quotation
// catalogue prices for that room, so an item can never be offered that has no quote row.
//   Kitchen / Butler's Pantry / Laundry - Base / Overhead / Tall / extras (/ end panels)
//   Bathroom / Ensuite / Powder Room    - floor-mounted vanity / wall-mounted vanity / additional
//   any other room (Bedroom 1, WIR ...) - wardrobe internal fitout / wardrobe doors
const SCHEDULE_GROUPS = [['base', 'Base cabinets'], ['overhead', 'Overhead cabinets'], ['tall', 'Tall cabinets'], ['extras', 'Bulkheads, shelving & extras'], ['panels', 'Visible end panels']];
const BATHROOM_SCHEDULE_GROUPS = [['vanity_floor', 'Floor-mounted vanity'], ['vanity_wallhung', 'Wall-mounted vanity'], ['bathroom_additional', 'Additional bathroom cabinetry']];
const WARDROBE_SCHEDULE_GROUPS = [['wardrobe_fitout', 'Wardrobe internal fitout'], ['wardrobe_doors', 'Wardrobe doors']];
// base | overhead | tall | extras | panels - what kind of cabinetry a stable cabinet item id is.
export const cabinetryTypeCategory = typeCategory;
// Which catalogue group a room schedules from. A room that is not a kitchen, pantry, laundry or
// wet area can only hold wardrobe joinery, which is quoted in WARDROBES against that room.
export const cabinetryScheduleGroup = room => (cabinetryRoomKey(room) ? cabinetryRoomGroup(room) || 'wardrobes' : '');
const scheduleSection = (group, type) => group === 'bathroom' ? (/^vanity_floor/.test(type.key) ? 'vanity_floor' : /^vanity_wallhung/.test(type.key) ? 'vanity_wallhung' : 'bathroom_additional')
  : group === 'wardrobes' ? (/^wardrobe_door/.test(type.key) ? 'wardrobe_doors' : 'wardrobe_fitout') : type.category;
export function cabinetryScheduleCatalogue(room) {
  const group = cabinetryScheduleGroup(room);
  if (!group) return [];
  const types = cabinetryRequirementTypes(group).filter(type => type.area === 'cabinetry');
  const sections = group === 'bathroom' ? BATHROOM_SCHEDULE_GROUPS : group === 'wardrobes' ? WARDROBE_SCHEDULE_GROUPS : SCHEDULE_GROUPS;
  return sections.map(([key, title]) => ({ key, title, items: types.filter(type => scheduleSection(group, type) === key).map(type => ({ id: type.key, label: type.label, unit: type.unit })) })).filter(item => item.items.length);
}
export const cabinetryTypeLabel = (room, typeId) => cabinetryRequirementTypes(String(typeId).startsWith('wardrobe') ? 'wardrobes' : cabinetryScheduleGroup(room)).find(type => type.key === typeId)?.label || '';
// Which part of a wet-area room a vanity item belongs to. The colour areas, handles and benchtop
// targets of a bathroom are keyed by these tags; the item's identity is always its canonical id.
export function cabinetryWetAreaTag(typeId = '') {
  const id = String(typeId);
  if (/^vanity_floor_\d?door/.test(id)) return /_2door_/.test(id) ? 'bath-floor-two-door' : 'bath-floor-one-door';
  if (/^vanity_floor/.test(id)) return 'bath-floor-four-drawers';
  if (/^vanity_wallhung_towel/.test(id)) return 'bath-wall-towel-display';
  if (/^vanity_wallhung_\d?door/.test(id)) return /_2door_/.test(id) ? 'bath-wall-two-door' : 'bath-wall-one-door';
  if (/^vanity_wallhung/.test(id)) return /_2drawer_/.test(id) ? 'bath-wall-two-drawer' : 'bath-wall-three-drawer';
  if (/^shaving_cabinet/.test(id)) return /_1200$/.test(id) ? 'bath-shaving-two-door' : 'bath-shaving-one-door';
  if (/^tall_linen/.test(id)) return 'bath-tall-linen';
  if (/^open_towel_shelf/.test(id)) return 'bath-floor-towel-rack';
  if (/^bulkhead/.test(id)) return 'bath-linen-bulkhead';
  return '';
}

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
  // A width typed in Client Selections may carry its unit ("900 mm").
  const width = item.widthMm ?? item.width;
  return { id: text(item.id) || `${origin}:${cabinetryRoomKey(room)}:${type}:${index}`, room, roomKey: cabinetryRoomKey(room), type,
    widthMm: number(typeof width === 'string' ? width.match(/\d+(\.\d+)?/)?.[0] : width), heightMm: number(item.heightMm ?? item.height), depthMm: number(item.depthMm ?? item.depth), lengthLm,
    doors: number(item.doors), drawers: number(item.drawers), double: item.double === true, towelShelf: item.towelShelf === true,
    quantity, source: text(item.source) || origin, planReference: text(item.planReference), legacyLabel: text(item.legacyLabel),
    // A requirement the source states but that cannot be placed on a quote row yet: what is missing
    // and the one thing the user does about it. It is reported, never dropped.
    ...(item.issue ? { issue: text(item.issue), issueFlag: text(item.issueFlag), action: item.action || null } : {}),
    ...(item.basis ? { basis: text(item.basis) } : {}),
    ...(item.areaId ? { areaId: text(item.areaId) } : {}),
    // A configured unit (an open shelving size) is named by its configuration, not the generic item.
    ...(item.displayLabel ? { displayLabel: text(item.displayLabel) } : {}),
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
  'bath-wall-towel-display': { type: 'vanity_wallhung', towelShelf: true }, 'bath-floor-towel-rack': { type: 'open_towel_shelf' },
  'bath-shaving-two-door': { type: 'shaving_cabinet', doors: 2 }, 'bath-shaving-one-door': { type: 'shaving_cabinet', doors: 1 },
  // Names that cover a family of items: the saved width / door count picks the member.
  'Standard base unit': { type: 'base_unit' }, 'Tall pantry': { type: 'tall_pantry' }, 'Overhead cabinets': { type: 'overhead' },
  'bath-floor-four-drawers': { type: 'vanity_floor', drawersOnly: true }, 'bath-linen-bulkhead': { type: 'bulkhead' },
}).map(([name, value]) => [norm(name), value]));
export const legacyCabinetryScheduleType = line => LEGACY_SCHEDULE_TYPES.get(norm(line?.type)) || LEGACY_SCHEDULE_TYPES.get(norm(line?.unitType)) || null;
const typeFacts = type => ({ width: type.widthMm ?? number(type.key.match(/_(\d{3,4})(?:_|$)/)?.[1]), doors: type.doors ?? number(type.key.match(/(\d)door/)?.[1]), drawers: type.drawers ?? number(type.key.match(/(\d)drawer/)?.[1]) });
export function cabinetryDoorPricingCategory({ widthMm, doors } = {}) {
  const width = number(widthMm), count = number(doors);
  if (count === 1 && width > 0 && width <= 600) return { id: 'single_door_up_to_600', pricingWidthMm: 600, doors: 1 };
  if (count === 2 && width > 0 && width <= 1200) return { id: 'double_door_up_to_1200', pricingWidthMm: 1200, doors: 2 };
  return null;
}
export function cabinetryVariantIdentity(room, cabinetTypeId, dimensions = {}) {
  const group = cabinetryScheduleGroup(room);
  const type = cabinetryRequirementTypes(group).find(item => item.key === cabinetTypeId && item.area === 'cabinetry');
  if (!type) return null;
  const facts = typeFacts(type);
  const widthMm = number(dimensions.widthMm) || facts.width || null;
  const doors = number(dimensions.doors) || facts.doors || null;
  const pricing = cabinetryDoorPricingCategory({ widthMm, doors });
  return {
    cabinetTypeId: type.key,
    selectedVariantId: type.key,
    cabinetProductId: `CABINETRY-UNIT-${type.key.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
    variantLabel: type.label,
    ...(widthMm ? { widthMm } : {}),
    ...(doors ? { doorCount: doors } : {}),
    ...(pricing ? { pricingCategoryId: pricing.id, pricingWidthMm: pricing.pricingWidthMm } : {}),
  };
}
// The current cabinet items an old schedule line can be, narrowed by whatever size it recorded.
// One result = the line IS that item. More than one = the builder is asked once which it is.
export function legacyCabinetCandidates(line = {}) {
  const group = cabinetryScheduleGroup(line.location);
  const old = legacyCabinetryScheduleType(line);
  if (!group || !old) return [];
  let fits = cabinetryRequirementTypes(group).filter(type => type.area === 'cabinetry' && (type.key === old.type || type.key.startsWith(`${old.type}_`)) && Boolean(type.towelShelf) === Boolean(old.towelShelf)
    && (old.doors == null || typeFacts(type).doors === old.doors) && (old.drawers == null || typeFacts(type).drawers === old.drawers) && (!old.drawersOnly || typeFacts(type).drawers != null));
  const narrow = (value, fact) => { const kept = value == null ? fits : fits.filter(type => typeFacts(type)[fact] === value); if (kept.length) fits = kept; };
  narrow(number(String(line.width ?? '').match(/\d+/)?.[0]), 'width');
  const count = number(line.doorDrawerCount);
  if (fits.length > 1 && count != null) { narrow(count, 'doors'); if (fits.length > 1) narrow(count, 'drawers'); }
  return fits;
}

// ---- Legacy schedule migration -------------------------------------------------------------------
// Brings Cabinet Schedule lines saved under the old display-name list onto the canonical cabinet
// items. It is the only place old lines are interpreted: Client Selections runs it whenever a
// cabinetry selection is loaded or saved, and the quote runs it on whatever is stored, so an old
// line can never appear in the schedule or count beside its canonical replacement.
//   - a name that means exactly one item priced for that room becomes that item (quantity, notes,
//     room, handle count and its own id carried over);
//   - if the room already has that canonical item, the canonical line stands and the old line is
//     retired, so one physical cabinet is never counted twice;
//   - a name that covers several items ("Standard base unit": 1 door or 2 door) becomes the one
//     its saved width / door count identifies. Where the line recorded neither, nothing is
//     guessed: it leaves the schedule and waits, whole, for a one-time classification
//     (classifyLegacyCabinetLine), after which it is an ordinary canonical line.
// Every room is covered - kitchens, laundries, wet areas and wardrobe rooms alike.
// Returns the same array (and empty lists) when there is nothing to migrate.
export function migrateCabinetSchedule(lines = []) {
  const isOld = line => line && !line.cabinetTypeId && cabinetryScheduleGroup(line.location);
  if (!lines.some(isOld)) return { schedule: lines, migrated: [], archived: [] };
  const byItem = new Map(lines.filter(line => line?.cabinetTypeId).map(line => [`${cabinetryRoomKey(line.location)}\u0000${line.cabinetTypeId}`, line]));
  const schedule = [], migrated = [], archived = [];
  for (const line of lines) {
    if (!isOld(line)) { schedule.push(line); continue; }
    const fits = legacyCabinetCandidates(line);
    const item = fits.length === 1 ? fits[0] : null;
    const record = { componentId: line.componentId, location: line.location, unitType: line.unitType || line.type || '', quantity: number(line.quantity) ?? 0, notes: line.notes || '' };
    if (!item) { archived.push({ ...line, candidates: fits.map(type => type.key), archiveReason: legacyCabinetryScheduleType(line) && !fits.length ? 'not a priced item in this room' : 'ambiguous: more than one current cabinet item fits' }); continue; }
    const key = `${cabinetryRoomKey(line.location)}\u0000${item.key}`;
    if (byItem.has(key)) { archived.push({ ...line, archiveReason: `superseded by the current "${item.label}" line` }); continue; }
    // migratedFrom records that this line came from the old list (see cabinetryScheduleScope).
    const next = { ...line, ...cabinetryVariantIdentity(line.location, item.key, { widthMm: number(String(line.width ?? '').match(/\d+/)?.[0]), doors: number(line.doorDrawerCount) }), unitType: item.label, migratedFrom: line.unitType || line.type || '' };
    byItem.set(key, next); schedule.push(next);
    migrated.push({ ...record, cabinetTypeId: item.key, label: item.label });
  }
  return { schedule, migrated, archived };
}

function cabinetrySelectionsOf(workbook) {
  const book = workbook.clientSelectionsBook || workbook.selectionsBook || {};
  const model = projectRoomModel(book, workbook);
  const rename = name => canonicalProjectRoomName(name, model);
  const line = item => ({ ...item, location: rename(item.location) });
  // Read projection only: keep the saved record, quantities, IDs and audit history intact.
  return (book.rooms || []).flatMap(room => room.rows || []).map(row => row.guidedSelection?.cabinetrySelection || row.guidedSelection?.selected_details?.cabinetrySelection || row.selected_details?.cabinetrySelection).filter(Boolean).map(selection => ({ ...selection,
    locations: (selection.locations || []).map(location => ({ ...location, location: rename(location.location || location.name), name: rename(location.name || location.location),
      ...(Array.isArray(location.cabinetSchedule) ? { cabinetSchedule: location.cabinetSchedule.map(line) } : {}) })),
    ...(Array.isArray(selection.schedule) ? { schedule: selection.schedule.map(line) } : {}),
    ...(Array.isArray(selection.legacyCabinetSchedule) ? { legacyCabinetSchedule: selection.legacyCabinetSchedule.map(line) } : {}),
  }));
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
// Applies one change to the cabinetry selection in every copy of the Selections Book the job
// holds, so the copies can never disagree. Same workbook back when nothing changes.
function mapWorkbookCabinetrySelections(workbook, change) {
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
          const direct = change(guided?.cabinetrySelection);
          const nested = change(guided?.selected_details?.cabinetrySelection);
          const rowNested = change(row.selected_details?.cabinetrySelection);
          if (direct === guided?.cabinetrySelection && nested === guided?.selected_details?.cabinetrySelection && rowNested === row.selected_details?.cabinetrySelection) return row;
          roomChanged = true;
          return { ...row,
            ...(guided ? { guidedSelection: { ...guided, ...(guided.cabinetrySelection ? { cabinetrySelection: direct } : {}),
              ...(guided.selected_details?.cabinetrySelection ? { selected_details: { ...guided.selected_details, cabinetrySelection: nested } } : {}) } } : {}),
            ...(row.selected_details?.cabinetrySelection ? { selected_details: { ...row.selected_details, cabinetrySelection: rowNested } } : {}) };
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
export const migrateWorkbookCabinetSchedules = workbook => mapWorkbookCabinetrySelections(workbook, migrateSelection);

// ---- One-time classification ---------------------------------------------------------------------
// The cabinet items an old line waiting for classification can be: the members of its family in
// that room, or (for a name with no current family) every cabinet item priced for the room.
export function cabinetryClassificationOptions(line = {}) {
  const group = cabinetryScheduleGroup(line.location);
  const all = cabinetryRequirementTypes(group).filter(type => type.area === 'cabinetry');
  const stored = (line.candidates || []).map(key => all.find(type => type.key === key)).filter(Boolean);
  const fits = stored.length ? stored : legacyCabinetCandidates(line);
  return (fits.length ? fits : all).map(type => ({ id: type.key, label: type.label }));
}
// Settles an old line for good. With a cabinet item it becomes that canonical schedule line
// (quantity, notes and its own id kept; added to the room's existing line for the same item).
// With no item it is removed as not required. Either way the old name is not carried any further.
export function classifyLegacyCabinetLine(workbook, componentId, cabinetTypeId = '') {
  return mapWorkbookCabinetrySelections(workbook, selection => {
    if (!selection || typeof selection !== 'object') return selection;
    const migrated = migrateSelection(selection);
    const line = (migrated.legacyCabinetSchedule || []).find(item => item.componentId === componentId);
    if (!line) return selection;
    const legacyCabinetSchedule = migrated.legacyCabinetSchedule.filter(item => item.componentId !== componentId);
    const type = cabinetTypeId && cabinetryRequirementTypes(cabinetryScheduleGroup(line.location)).find(item => item.key === cabinetTypeId && item.area === 'cabinetry');
    if (!type) return { ...migrated, legacyCabinetSchedule };
    const quantity = number(line.quantity) ?? 0;
    const same = item => item.cabinetTypeId === type.key && cabinetryRoomKey(item.location) === cabinetryRoomKey(line.location);
    const { archiveReason, candidates, ...kept } = line;
    const schedule = (migrated.schedule || []).some(same)
      ? migrated.schedule.map(item => same(item) ? { ...item, quantity: (number(item.quantity) ?? 0) + quantity, handleQuantity: (number(item.handleQuantity) ?? 0) + quantity } : item)
      : [...(migrated.schedule || []), { ...kept, ...cabinetryVariantIdentity(line.location, type.key), unitType: type.label, type: cabinetryWetAreaTag(type.key) || kept.type || '', classifiedFrom: line.unitType || line.type || '' }];
    return { ...migrated, schedule, legacyCabinetSchedule,
      cabinetScheduleMigration: [...(migrated.cabinetScheduleMigration || []), { componentId, location: line.location, unitType: line.unitType || line.type || '', quantity, cabinetTypeId: type.key, label: type.label, classified: true }] };
  });
}

export function updateCabinetrySelectionRequirement(workbook, requirementId, value) {
  const id = text(requirementId);
  if (id.startsWith('selection:')) {
    const componentId = id.slice('selection:'.length);
    const lengthLm = number(value);
    if (!(lengthLm > 0)) return workbook;
    return mapWorkbookCabinetrySelections(workbook, selection => {
      if (!selection || typeof selection !== 'object') return selection;
      const migrated = migrateSelection(selection);
      let changed = false;
      const schedule = (migrated.schedule || []).map(line => {
        if (line.componentId !== componentId || !/^bulkhead_/.test(text(line.cabinetTypeId))) return line;
        changed = true;
        return { ...line, runs: [{ id: `${componentId}-run-1`, location: line.location || '', lengthMm: Math.round(lengthLm * 1000) }] };
      });
      return changed ? { ...migrated, schedule } : selection;
    });
  }
  if (!id.startsWith('benchtop:')) return workbook;
  const [, roomKey, areaId] = id.split(':');
  return mapWorkbookCabinetrySelections(workbook, selection => {
    if (!selection || typeof selection !== 'object') return selection;
    let changed = false;
    const locations = (selection.locations || []).map(location => {
      if (cabinetryRoomKey(location.location || location.name) !== roomKey) return location;
      if (value?.kind === 'length') {
        const lengthLm = number(value.value);
        if (!(lengthLm > 0)) return location;
        const areas = Array.isArray(location.benchtopAreas) ? location.benchtopAreas : [];
        if (!areas.some(area => text(area.id) === areaId)) return location;
        changed = true;
        return { ...location, benchtopAreas: areas.map(area => text(area.id) === areaId ? { ...area, lengthMm: Math.round(lengthLm * 1000), source: area.source || 'builder-review' } : area) };
      }
      if (value?.kind === 'range' && BENCHTOP_RANGES.some(range => range.key === value.value)) {
        const rangeKey = value.value;
        const updateSurface = surface => surface && typeof surface === 'object'
          ? { ...surface, rangeKey, benchtopRangeKey: rangeKey, rangeOverrideKey: rangeKey, rangeSource: 'builder-override' }
          : surface;
        if (Array.isArray(location.benchtopAreas) && location.benchtopAreas.some(area => text(area.id) === areaId && area.surface)) {
          changed = true;
          return { ...location, benchtopAreas: location.benchtopAreas.map(area => text(area.id) === areaId ? { ...area, surface: updateSurface(area.surface) } : area) };
        }
        if (location.bathroomBenchtops?.[areaId]) {
          changed = true;
          return { ...location, bathroomBenchtops: { ...location.bathroomBenchtops, [areaId]: updateSurface(location.bathroomBenchtops[areaId]) } };
        }
      }
      return location;
    });
    return changed ? { ...selection, locations } : selection;
  });
}

// Old schedule lines that were retired without a canonical replacement, for internal review only.
export function cabinetryLegacyArchive(workbook = {}) {
  const seen = new Set();
  return cabinetrySelectionsOf(workbook).flatMap(selection => [...(selection.legacyCabinetSchedule || []), ...migrateCabinetSchedule(scheduleLinesOf(selection)).archived])
    .filter(line => !seen.has(line.componentId) && seen.add(line.componentId))
    .map(line => ({ room: line.location, label: line.unitType || line.type || '', quantity: number(line.quantity) ?? 0, notes: line.notes || '', reason: line.archiveReason || '' }));
}

// ---- MDF bulkheads, Sharkfin fronts, open shelving ------------------------------------------------
// Three items of the room Cabinet Schedule whose quantity is not a plain count. All three are read
// from the same schedule lines and land on the same quote rows as every other cabinet item.
export const CABINETRY_MEASUREMENT_REQUIRED = 'MEASUREMENT REQUIRED';
export const CABINETRY_RATE_REQUIRED = 'RATE REQUIRED';

// MDF bulkheads are a length. A bulkhead line carries its runs ({ id, location, lengthMm }) and is
// quoted on their total in LM. A line saved as a count has no length: nothing is converted, and the
// line is reported "Measurement required" until its runs are entered.
export function bulkheadRuns(line = {}) {
  const runs = (Array.isArray(line.runs) ? line.runs : []).map((run, index) => ({ id: text(run?.id) || `run-${index + 1}`, location: text(run?.location), lengthMm: Math.max(0, number(run?.lengthMm) || 0) }));
  const measured = runs.filter(run => run.lengthMm > 0);
  const lengthMm = measured.reduce((total, run) => total + run.lengthMm, 0);
  return { recorded: Array.isArray(line.runs), runs, measured, lengthMm, lm: Math.round(lengthMm / 10) / 100 };
}

// The fronts a Sharkfin profile is machined into: short doors (bench height or overhead) and
// external drawer fronts. zone = the handle choice that governs the unit. Tall doors, internal
// drawers and appliance openings are listed so the breakdown can say why they are not counted.
// assumed: the catalogue wording does not state the fronts; the count can be typed on the line.
const FRONTS = {
  base_unit_600_1door: { zone: 'base', doors: 1 }, base_unit_1200_2door: { zone: 'base', doors: 2 }, sink_base: { zone: 'base', doors: 2, assumed: true }, corner_base: { zone: 'base', doors: 1, assumed: true },
  underbench_oven: { zone: 'base', none: 'appliance opening' }, dishwasher_opening: { zone: 'base', none: 'appliance opening' }, microwave_cabinet: { zone: 'base', none: 'appliance opening' }, washer_dryer_opening: { zone: 'base', none: 'appliance opening' },
  pullout_bin: { zone: 'base', drawers: 1 }, drawer_base_2: { zone: 'base', drawers: 2 }, drawer_base_3: { zone: 'base', drawers: 3 }, drawer_base_4: { zone: 'base', drawers: 4 }, drawer_base_5: { zone: 'base', drawers: 5 },
  hidden_internal_drawer: { zone: 'base', none: 'internal drawer' },
  overhead_1door_standard: { zone: 'overhead', doors: 1 }, overhead_2door_standard: { zone: 'overhead', doors: 2 }, overhead_1door_extended: { zone: 'overhead', doors: 1 }, overhead_2door_extended: { zone: 'overhead', doors: 2 },
  rangehood_cabinet: { zone: 'overhead', doors: 1, assumed: true },
  tall_pantry_600: { zone: 'tall', doors: 1 }, tall_pantry_1200: { zone: 'tall', doors: 2 }, tall_linen_600: { zone: 'tall', doors: 1 }, tall_linen_1200: { zone: 'tall', doors: 2 }, oven_tower_600: { zone: 'tall', none: 'appliance tower' },
  shaving_cabinet_600: { zone: 'mirror', none: 'mirrored door' }, shaving_cabinet_1200: { zone: 'mirror', none: 'mirrored door' },
};
const frontsOf = typeId => {
  if (FRONTS[typeId]) return FRONTS[typeId];
  const vanity = typeId.match(/^vanity_(floor|wallhung)_(\d)(door|drawer)_/);
  return vanity ? { zone: `vanity_${vanity[1]}`, [vanity[3] === 'door' ? 'doors' : 'drawers']: Number(vanity[2]) } : null;
};
const isSharkfin = record => /shark\s*fin/i.test(`${record?.openingMethod || ''} ${record?.productName || ''}`);
const SHARKFIN_ZONE_LABELS = { base: 'base cabinets', overhead: 'overhead cabinets', tall: 'tall cabinets', vanity_floor: 'floor-mounted vanities', vanity_wallhung: 'wall-mounted vanities', mirror: 'mirrored cabinets' };

// The Sharkfin handle upgrade of one room, from its actual Cabinet Schedule.
//   location: the room's cabinetry record (its handle choices); lines: the room's schedule lines.
// Which fronts take the profile follows the handle chosen for each zone (Handles step): base,
// overhead, and each vanity. With no handle chosen but the upgrade ticked, the base cabinets take it.
// Tall doors are counted only when the upgrade line says includeTall. A number typed in a line's
// doorDrawerCount is that unit's front count. quantityOverride on the upgrade line is a manual total.
//   -> { applies, zones, calculated, quantity, manual, counted: [{ typeId, label, units, each, fronts, assumed }], excluded: [{ label, units, reason }], summary }
export function sharkfinUpgrade(location = {}, lines = []) {
  const upgrade = lines.find(line => line?.cabinetTypeId === 'handle_upgrade_sharkfin') || null;
  const override = upgrade?.quantityOverride === '' || upgrade?.quantityOverride == null ? null : number(upgrade.quantityOverride);
  const ticked = Boolean(upgrade) && ((number(upgrade.quantity) ?? 0) > 0 || override != null);
  const zones = new Set([['base', location.handles?.base], ['overhead', location.handles?.overhead], ['tall', location.handles?.tall],
    ['vanity_floor', location.bathroomHandles?.floorMountedVanity], ['vanity_wallhung', location.bathroomHandles?.wallMountedVanity]].filter(([, record]) => isSharkfin(record)).map(([zone]) => zone));
  if (!zones.size && ticked) zones.add('base');
  if (!zones.size || upgrade?.sharkfinExcluded === true) return { applies: false, zones: [], calculated: 0, quantity: 0, manual: false, counted: [], excluded: [], summary: '' };
  const includeTall = upgrade?.includeTall === true || zones.has('tall');
  const counted = [], excluded = [];
  for (const line of lines) {
    const typeId = text(line?.cabinetTypeId), units = number(line?.quantity) ?? 0;
    const fronts = frontsOf(typeId);
    if (!fronts || !(units > 0)) continue;
    const label = text(line.unitType) || typeId;
    const typed = number(String(line.doorDrawerCount ?? '').match(/\d+/)?.[0]);
    if (fronts.zone === 'tall' ? !includeTall : !zones.has(fronts.zone)) { excluded.push({ label, units, reason: fronts.zone === 'tall' ? 'tall door' : `${SHARKFIN_ZONE_LABELS[fronts.zone] || fronts.zone} do not have Sharkfin` }); continue; }
    if (fronts.none && typed == null) { excluded.push({ label, units, reason: fronts.none }); continue; }
    const each = typed ?? ((fronts.doors || 0) + (fronts.drawers || 0));
    if (!(each > 0)) { excluded.push({ label, units, reason: 'no door or drawer front' }); continue; }
    counted.push({ typeId, label, units, each, fronts: each * units, assumed: typed == null && fronts.assumed === true });
  }
  const calculated = counted.reduce((total, item) => total + item.fronts, 0);
  const manual = override != null;
  const quantity = manual ? Math.max(0, override) : calculated;
  const summary = [manual ? `Manual quantity ${quantity} (calculated ${calculated})` : '', counted.map(item => `${item.label} ${item.units} x ${item.each} = ${item.fronts}${item.assumed ? '*' : ''}`).join(' + '),
    counted.some(item => item.assumed) ? '* front count assumed; type the door / drawer count on the line to change it' : ''].filter(Boolean).join(' · ');
  return { applies: true, zones: [...zones], calculated, quantity, manual, counted, excluded, summary };
}

// Open shelving comes in standard unit sizes; a unit can also be custom. An open shelving line with
// a shelfUnit is one configuration ({ sizeKey, heightMm, widthMm, depthMm, shelves,
// boardThicknessMm, material, finish, position }) and its quantity is the number of those units.
export const OPEN_SHELVING_SIZES = [
  { key: 'tall_wide', label: 'Tall Wide', heightMm: 2100, widthMm: 1200, shelves: 5 },
  { key: 'tall_narrow', label: 'Tall Narrow', heightMm: 2100, widthMm: 600, shelves: 5 },
  { key: 'medium_wide', label: 'Medium Wide', heightMm: 1200, widthMm: 1200, shelves: null },
  { key: 'low_wide', label: 'Low Wide', heightMm: 900, widthMm: 1200, shelves: null },
];
export function openShelvingUnit(line = {}) {
  const unit = line?.shelfUnit;
  if (!unit || typeof unit !== 'object') return null;
  const size = OPEN_SHELVING_SIZES.find(item => item.key === unit.sizeKey) || null;
  const heightMm = number(unit.heightMm) || size?.heightMm || 0, widthMm = number(unit.widthMm) || size?.widthMm || 0;
  // A standard size whose dimensions were changed is a custom unit.
  const standard = Boolean(size) && heightMm === size.heightMm && widthMm === size.widthMm;
  const shelves = unit.shelves === '' || unit.shelves == null ? size?.shelves ?? null : number(unit.shelves);
  const depthMm = number(unit.depthMm) || 0, boardThicknessMm = number(unit.boardThicknessMm) || 0;
  const sizeLabel = standard ? size.label : 'Custom';
  const label = ['Open shelving', `${sizeLabel} ${heightMm || '?'} x ${widthMm || '?'}mm`, depthMm ? `${depthMm}mm deep` : '', shelves != null ? `${shelves} adjustable ${shelves === 1 ? 'shelf' : 'shelves'}` : 'shelf quantity to be set',
    boardThicknessMm ? `${boardThicknessMm}mm board` : '', text(unit.material), text(unit.finish)].filter(Boolean).join(' - ');
  return { sizeKey: standard ? size.key : 'custom', sizeLabel, standard, heightMm, widthMm, depthMm, shelves, boardThicknessMm, material: text(unit.material), finish: text(unit.finish), position: text(unit.position), label };
}

// What one schedule line amounts to for BOQ, the cabinetmaker's RFQ and procurement, so they carry
// the same quantity and unit as the quotation: { quantity, unit, name, note }.
export function cabinetScheduleMeasure(line = {}, location = {}, roomLines = []) {
  const typeId = text(line?.cabinetTypeId);
  if (/^bulkhead_/.test(typeId)) {
    const runs = bulkheadRuns(line);
    return runs.lm > 0 ? { quantity: runs.lm, unit: 'LM', name: '', note: runs.measured.map(run => `${run.location || 'Run'} ${run.lengthMm}mm`).join(', ') }
      : { quantity: 0, unit: 'LM', name: '', note: (number(line.quantity) ?? 0) > 0 || runs.recorded ? 'Length required' : '' };
  }
  if (typeId === 'handle_upgrade_sharkfin') { const upgrade = sharkfinUpgrade(location, roomLines); return { quantity: upgrade.quantity, unit: 'EACH', name: '', note: upgrade.summary }; }
  const shelf = typeId === 'open_shelf' ? openShelvingUnit(line) : null;
  if (shelf) return { quantity: number(line.quantity) ?? 0, unit: 'EA', name: shelf.label, note: shelf.position };
  return { quantity: number(line?.quantity) ?? 0, unit: 'ITEM', name: '', note: '' };
}

// One Sharkfin handle upgrade requirement per room, from the room's own schedule and handle choices.
// Rooms merged under one project room share their handle record.
function sharkfinRequirements(selection, schedule, excluded, seen) {
  const rooms = new Map();
  for (const location of selection.locations || []) {
    const name = location.location || location.name, key = cabinetryRoomKey(name);
    if (!key || location.included === false || excluded.has(key)) continue;
    const held = rooms.get(key) || { name, handles: {}, bathroomHandles: {} };
    rooms.set(key, { name: held.name, handles: { ...held.handles, ...(location.handles || {}) }, bathroomHandles: { ...held.bathroomHandles, ...(location.bathroomHandles || {}) } });
  }
  const out = [];
  for (const [key, room] of rooms) {
    const id = `sharkfin:${key}`;
    if (seen.has(id)) continue;
    const upgrade = sharkfinUpgrade(room, schedule.filter(line => line && cabinetryRoomKey(line.location) === key));
    if (!upgrade.applies || !(upgrade.quantity > 0)) continue;
    seen.add(id);
    const group = cabinetryRoomGroup(room.name);
    out.push(normaliseRequirement({ id, room: room.name, type: 'handle_upgrade_sharkfin', quantity: upgrade.quantity, source: 'CLIENT_SELECTION', legacyLabel: 'Sharkfin handle upgrade', basis: upgrade.summary,
      ...(group ? {} : { issue: `No cabinetry group is set for ${room.name}`, action: { kind: 'open-selections', label: `Confirm this cabinetry location in Client Selections > Cabinetry` } }) }, out.length, 'CLIENT_SELECTION'));
  }
  return out;
}

// The room Cabinet Schedules saved in Client Selections, as requirements. Every line is a
// canonical cabinet item; an old line still waiting for classification is reported with that action.
const selectionsPath = (room, step) => `Client Selections > Cabinetry > ${room} > ${step}`;
function selectionScheduleRequirements(workbook) {
  const seen = new Set();
  return cabinetrySelectionsOf(workbook).flatMap(selection => {
    const excluded = new Set((selection.locations || []).filter(location => location.included === false).map(location => cabinetryRoomKey(location.location || location.name)));
    const result = migrateCabinetSchedule(scheduleLinesOf(selection));
    const fresh = line => line && !excluded.has(cabinetryRoomKey(line.location)) && !seen.has(line.componentId) && seen.add(line.componentId);
    const current = result.schedule.filter(fresh).flatMap((line, index) => {
      const base = { id: `selection:${line.componentId || index}`, room: line.location, type: line.cabinetTypeId || '', quantity: number(line.quantity) ?? 0, source: 'CLIENT_SELECTION', legacyLabel: line.unitType || line.type };
      if (/^bulkhead_/.test(base.type)) {
        // Quoted in LM from the measured runs; a count is never read as a length.
        const runs = bulkheadRuns(line);
        if (runs.lm > 0) return [normaliseRequirement({ ...base, quantity: runs.lm, lengthLm: runs.lm, basis: `${runs.measured.length} run${runs.measured.length === 1 ? '' : 's'}: ${runs.measured.map(run => `${run.location || 'Run'} ${run.lengthMm}mm`).join(' + ')}` }, index, 'CLIENT_SELECTION')];
        if (base.quantity > 0 || runs.recorded) return [normaliseRequirement({ ...base, quantity: 0, issue: runs.recorded ? 'Bulkhead length required' : `Bulkhead length required - saved as a count of ${base.quantity}, not a length`, issueFlag: CABINETRY_MEASUREMENT_REQUIRED,
          action: { kind: 'enter-bulkhead-length', label: 'Enter total bulkhead length', unit: 'LM' } }, index, 'CLIENT_SELECTION')];
      }
      // The Sharkfin quantity is the room's eligible fronts (sharkfinRequirements), not this line's count.
      if (base.type === 'handle_upgrade_sharkfin') return [];
      const shelf = base.type === 'open_shelf' ? openShelvingUnit(line) : null;
      // A sized unit is priced on its own size; the single "module" rate is not applied to it.
      if (shelf && base.quantity > 0) return [normaliseRequirement({ ...base, legacyLabel: shelf.label, displayLabel: shelf.label, issue: `No rate is set for ${shelf.label}`, issueFlag: CABINETRY_RATE_REQUIRED,
        action: { kind: 'rate-required', label: `Add an EA rate for open shelving ${shelf.sizeLabel} (${shelf.heightMm} x ${shelf.widthMm}mm) to the cabinetry catalogue` } }, index, 'CLIENT_SELECTION')];
      return [normaliseRequirement(base, index, 'CLIENT_SELECTION')];
    }).concat(sharkfinRequirements(selection, result.schedule, excluded, seen));
    const pending = [...(selection.legacyCabinetSchedule || []), ...result.archived].filter(line => line && !/^superseded/.test(line.archiveReason || '')).filter(fresh).map((line, index) => {
      const name = line.unitType || line.type || 'Cabinet';
      return normaliseRequirement({ id: `selection-retired:${line.componentId || index}`, room: line.location, type: '', quantity: number(line.quantity) ?? 0, source: 'CLIENT_SELECTION', legacyLabel: name,
        issue: `Choose which cabinet "${name}" is`, action: { kind: 'classify', label: 'Choose the cabinet', ...(line.componentId ? { componentId: line.componentId } : {}), options: cabinetryClassificationOptions(line) } }, index, 'CLIENT_SELECTION');
    });
    return current.concat(pending);
  });
}

// ---- Benchtops ------------------------------------------------------------------------------------
// The benchtops chosen in Client Selections (benchtopSelection.js) feed this same engine: each
// benchtop area is a requirement of the canonical type benchtop_<width class> with its length in
// LM, on the row of ITS surface's quotation range. So a kitchen whose island differs from its main
// bench lands on two ranges, and a changed surface moves the quantity to the new range's row.
// Length, in order: the length saved on the area, else the run its cabinets add up to (every
// cabinet's width known), else unresolved - "Measurement required". A length is never invented.
// (A measured takeoff / Job Setup benchtop for the room replaces all of these: see collect.)
export const BENCH_HEIGHT_TYPES = /^(base_unit|sink_base|underbench_oven|corner_base|dishwasher_opening|pullout_bin|drawer_base|washer_dryer_opening)/;
const VANITY_TOPS = [['floorMountedVanity', 'Floor-mounted vanity benchtop', /^vanity_floor/], ['wallMountedVanity', 'Wall-mounted vanity benchtop', /^vanity_wallhung/]];
// { lengthMm, counted, unknown }: the run the scheduled cabinets of `types` add up to. A cabinet
// whose width is not known (neither in its item nor typed on the line) is counted as unknown.
export function cabinetRunMm(lines = [], types = BENCH_HEIGHT_TYPES) {
  let lengthMm = 0, counted = 0, unknown = 0;
  for (const line of lines) {
    const type = text(line?.cabinetTypeId);
    const quantity = number(line?.quantity) ?? 0;
    if (!(quantity > 0) || !types.test(type)) continue;
    const width = number(String(line.width ?? '').match(/\d+/)?.[0]) || number(type.match(/_(\d{3,4})(?:_|$)/)?.[1]);
    if (width) { lengthMm += width * quantity; counted += quantity; } else unknown += quantity;
  }
  return { lengthMm, counted, unknown };
}
const STONE_RANGE = /stone|porcelain|marble|solid_surface/;
function benchtopSelectionRequirements(workbook) {
  const out = [];
  const surfaceName = surface => [surface?.supplier, surface?.colourName || surface?.colour || surface?.productName || surface?.range || surface?.materialChoice].filter(Boolean).join(' ');
  const hasSurface = record => Boolean(record && typeof record === 'object' && surfaceName(record));
  for (const selection of cabinetrySelectionsOf(workbook)) {
    const schedule = migrateCabinetSchedule(scheduleLinesOf(selection)).schedule;
    for (const location of selection.locations || []) {
      if (location.included === false) continue;
      const room = location.location || location.name;
      const roomKey = cabinetryRoomKey(room);
      const group = cabinetryRoomGroup(room);
      const wet = group === 'bathroom';
      const lines = schedule.filter(line => line && cabinetryRoomKey(line.location) === roomKey);
      const where = selectionsPath(room, 'Benchtops');
      const open = label => ({ kind: 'open-selections', label: `${label} in ${where}` });
      // Stated but not placeable yet: kept with what is missing and what to do, never dropped.
      const report = (id, label, quantity, issue, action, flag = '', surfaceFacts = {}) => out.push({ id: `benchtop:${roomKey}:${id}`, room, type: 'benchtop', quantity, source: 'CLIENT_SELECTION', legacyLabel: label, benchtopArea: true, issue, action, issueFlag: flag, ...surfaceFacts });
      // The areas the room states: those saved by the Benchtops step, else the benchtop(s) chosen
      // before areas were recorded (one per vanity in a wet room, the main run elsewhere).
      const saved = applyIslandInheritance(Array.isArray(location.benchtopAreas) ? location.benchtopAreas
        : wet ? VANITY_TOPS.filter(([key]) => hasSurface(location.bathroomBenchtops?.[key])).map(([key, label]) => ({ id: key, label, depthMm: 600, lengthMm: '', surface: location.bathroomBenchtops[key] }))
        : hasSurface(location.benchtop || location.benchtops) ? [{ id: 'benchtop-main', label: 'Benchtop', depthMm: 600, lengthMm: '', surface: location.benchtop || location.benchtops }] : []);
      const wallRuns = saved.filter(area => !/island|breakfast/i.test(`${area.id} ${area.label}`));
      const derivedMm = area => {
        const types = wet ? VANITY_TOPS.find(([key]) => key === area.id)?.[2] : wallRuns.length === 1 && wallRuns[0] === area ? BENCH_HEIGHT_TYPES : null;
        const run = types ? cabinetRunMm(lines, types) : { lengthMm: 0, unknown: 1 };
        return run.lengthMm > 0 && !run.unknown ? run.lengthMm : 0;
      };
      const has = type => Boolean(GROUPS[group]?.benchtops) && TYPES.has(`${group}\u0000${type}`);
      const add = (id, type, quantity, extra = {}) => { if (has(type) && quantity > 0) out.push({ id: `benchtop:${roomKey}:${id}`, room, type, quantity, source: 'CLIENT_SELECTION', ...extra }); };
      const areas = [];
      for (const item of saved) {
        const savedMm = number(item.lengthMm) || 0;
        const mm = savedMm || derivedMm(item);
        const area = { ...item, lm: Math.round(mm / 10) / 100, depth: number(item.depthMm) || 600, rangeKey: text(item.surface?.rangeKey || item.surface?.benchtopRangeKey), basis: savedMm ? '' : mm ? 'Length from the scheduled cabinet widths' : '' };
        const label = text(area.label) || 'Benchtop';
        if (!area.surface && !(area.lm > 0)) continue;
        if (!has(`benchtop_${area.depth}`)) report(area.id, label, area.lm, `No ${area.depth}mm wide benchtop is priced for ${GROUPS[group]?.label || room}`, open('Change the benchtop width'));
        else if (!area.surface) report(area.id, label, area.lm, 'Benchtop surface not selected', open('Choose the benchtop surface'), CABINETRY_SELECTION_REQUIRED);
        else if (!(area.lm > 0)) report(area.id, label, 0, 'Measurement required', { kind: 'enter-benchtop-length', label: 'Enter benchtop length', unit: 'LM' }, 'MEASUREMENT REQUIRED', { benchtopRangeKey: area.rangeKey, benchtopSurface: surfaceName(area.surface) });
        else areas.push(area);
      }
      for (const area of areas) add(area.id, `benchtop_${area.depth}`, area.lm, { benchtopArea: true, benchtopRangeKey: area.rangeKey, benchtopSurface: surfaceName(area.surface), legacyLabel: text(area.label), basis: area.basis });
      const setup = location.benchtopSetup;
      if (!areas.length || !setup?.confirmedAt) continue;
      const cutouts = Array.isArray(setup.cutouts) ? setup.cutouts : [];
      // A bench has one sink; each vanity top has its own basin and tap.
      const each = wet ? areas.length : 1;
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
  const all = [
    ['EXPLICIT', list(workbook.cabinetryRequirements)],
    ['JOB_SETUP', list(workbook.data?.cabinetryRequirements)],
    ['AI_TAKEOFF', [...list(takeoff.cabinetryRequirements), ...list(takeoff.scheduleState?.cabinetryRequirements), ...list(analysis.cabinetry)]],
    // Calibrated, reviewed plan measurements tagged as benchtop / MDF bulkhead runs.
    ['TAKEOFF', cabinetryRequirementsFromTakeoff(takeoff)],
  ].flatMap(([origin, items]) => items.map((item, index) => {
    const record = normaliseRequirement(item || {}, index, origin);
    const room = canonicalProjectRoomName(record.room, projectRoomModel(workbook.clientSelectionsBook || workbook.selectionsBook, workbook));
    return { ...record, room, roomKey: cabinetryRoomKey(room) };
  }))
    .concat(selectionScheduleRequirements(workbook))
    .concat(benchtopSelectionRequirements(workbook))
    .filter(item => !seen.has(item.id) && seen.add(item.id));
  // Benchtop length priority: a measured takeoff / Job Setup benchtop for the room is the length;
  // the selection then only supplies the range those lengths are quoted on (selectionRooms).
  const measured = new Set(all.filter(item => item.source !== 'CLIENT_SELECTION' && item.source !== 'TAKEOFF' && /^benchtop(_\d+)?$/.test(item.type)).map(item => item.roomKey));
  const kept = all.filter(item => !(item.source === 'CLIENT_SELECTION' && item.benchtopArea && measured.has(item.roomKey)));
  return reconcileTakeoffMeasurements(kept);
}

const areaSlug = value => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// A measured run replaces the length of the SAME benchtop area / bulkhead in Client Selections and
// borrows its surface range. A run that cannot be tied to one area is reported, never guessed.
function reconcileTakeoffMeasurements(items) {
  const out = [];
  const replaced = new Set();
  const measuredBulkheads = new Set(items.filter(item => item.source === 'TAKEOFF' && !item.issue && /^bulkhead_/.test(item.type)).map(item => `${item.roomKey}\u0000${item.type}`));
  for (const item of items) {
    if (item.source !== 'TAKEOFF' || item.issue || !/^benchtop(_\d+)?$/.test(item.type)) continue;
    const areas = items.filter(other => other.source === 'CLIENT_SELECTION' && other.benchtopArea && other.roomKey === item.roomKey);
    const matched = areas.filter(area => areaSlug(area.id.split(':').slice(2).join(':')) === item.areaId || areaSlug(area.legacyLabel) === item.areaId);
    const chosen = matched.length === 1 ? matched[0] : !matched.length && areas.length === 1 ? areas[0] : null;
    if (chosen) { replaced.add(chosen.id); item.benchtopArea = true; item.benchtopRangeKey = chosen.benchtopRangeKey; item.benchtopSurface = chosen.benchtopSurface; item.legacyLabel = chosen.legacyLabel || item.legacyLabel; }
    else if (areas.length) { item.issue = `Measured area "${item.legacyLabel}" does not match one benchtop area in Client Selections for ${item.room}`; item.issueFlag = CABINETRY_MEASUREMENT_REQUIRED; item.quantity = 0;
      item.action = { kind: 'review-takeoff-measurement', label: `Match this run to a benchtop area (${areas.map(area => area.legacyLabel || area.id).join(', ')}) in AI Plan Takeoff` }; }
  }
  for (const item of items) {
    if (replaced.has(item.id)) continue;
    if (item.source === 'CLIENT_SELECTION' && item.issueFlag === CABINETRY_MEASUREMENT_REQUIRED && /^bulkhead_/.test(item.type) && measuredBulkheads.has(`${item.roomKey}\u0000${item.type}`)) continue;
    out.push(item);
  }
  return out;
}

function selectionRooms(workbook) {
  const book = workbook.clientSelectionsBook || workbook.selectionsBook || {};
  const rooms = {};
  const put = (room, field, value, name) => {
    const key = cabinetryRoomKey(canonicalProjectRoomName(room, projectRoomModel(book, workbook)));
    if (!key || !text(name ?? value)) return;
    const item = field === 'finish' ? cabinetryFinishFor(value) : benchtopRangeFor(value);
    const next = item ? { key: item.key, label: item.label } : { unmapped: text(name ?? value) };
    const existing = rooms[key]?.[field];
    if (existing && JSON.stringify(existing) !== JSON.stringify(next)) {
      rooms[key] = { ...rooms[key], [field]: { unmapped: `Conflicting saved ${field} choices for ${room}; review the room records` } };
      return;
    }
    rooms[key] = { ...rooms[key], [field]: next };
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
      const vanityTop = cabinetryRoomGroup(location.location || location.name) === 'bathroom' ? Object.values(location.bathroomBenchtops || {}).find(record => record && typeof record === 'object') : null;
      const top = vanityTop || location.benchtop || location.benchtops || (Array.isArray(location.benchtopAreas) ? location.benchtopAreas.find(area => area?.surface)?.surface : null);
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
    if (chosen?.unmapped) return { key: '', label: chosen.unmapped, source: 'CLIENT_SELECTION', reason: `"${chosen.unmapped}" is not one of the quoted ${field === 'finish' ? 'cabinet finishes' : 'benchtop ranges'}` };
  }
  for (const key of [...roomKeys, '*']) {
    const included = inclusions.rooms[key]?.[field];
    if (included) return { ...included, source: 'INCLUSION_SCHEDULE', sourceLabel: `From ${inclusions.name}` };
  }
  return { key: '', label: '', source: 'UNSELECTED', reason: `${field === 'finish' ? 'Cabinet finish' : 'Benchtop range'} not selected` };
}

function resolveType(requirement, groupKey) {
  if (requirement.type === 'handle_upgrade_sharkfin' && !TYPES.has(`${groupKey}\u0000${requirement.type}`)) return TYPES.get(`kitchen\u0000${requirement.type}`) || null;
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
    const entry = { requirementId: requirement.id, room: requirement.room, type: type?.key || requirement.type,
      // A benchtop run is named as the room names it ("Island benchtop"); its range is the Finish column.
      label: requirement.displayLabel || (type && /^benchtop_\d+$/.test(type.key) ? `${requirement.legacyLabel || 'Benchtop'} - ${type.widthMm}mm wide` : type?.label || requirement.legacyLabel), dimensions, quantity: requirement.quantity, requirementSource: requirement.source,
      selectedFinish: '', finishSource: '', matchedQuoteRow: '', matchedImportKey: '', status: CABINETRY_UNMATCHED, flag: '', reason: '', action: null, ...(requirement.basis ? { basis: requirement.basis } : {}) };
    // What the user does about a requirement that cannot be placed: in Client Selections for a
    // selection, on the requirement itself (takeoff / Job Setup) otherwise.
    const todo = (label, step = 'Cabinet Schedule') => fromSelection ? { kind: 'open-selections', label: `${label} in ${selectionsPath(requirement.room, step)}` } : { kind: 'edit-requirement', label: `${label} on the takeoff / Job Setup requirement` };
    const fail = (reason, flag = '', action = null) => ({ ...entry, reason, flag, action: action || todo('Correct this item') });
    if (requirement.issue) return fail(requirement.issue, requirement.issueFlag || '', requirement.action);
    if (!requirement.type) return fail('No cabinet item is set', '', todo('Choose the cabinet item'));
    if (!groupKey) return fail(`${requirement.room || 'This room'} has no cabinetry in the quotation catalogue`, '', todo('Change the room'));
    if (!type) return fail(`${requirement.legacyLabel || requirement.type}${dimensions ? ` (${dimensions})` : ''} is not one cabinet item priced for ${GROUPS[groupKey].label}`, '', todo('Give the exact size (width, doors or drawers)'));
    if (!(requirement.quantity > 0) && !fromSelection) return fail('No quantity is set', '', todo('Enter the quantity'));
    // Wardrobe internal fitout and benchtop extras have one approved row whatever the selection.
    let finish = { key: null, label: wardrobe ? 'Standard Colourboard' : 'Benchtop extra', source: 'CATALOGUE', sourceLabel: 'Fixed catalogue item' };
    if (type.finishDependent && requirement.benchtopArea) {
      // A benchtop area is priced on the range of its own surface, whatever the rest of the room has.
      const range = BENCHTOP_RANGES.find(item => item.key === requirement.benchtopRangeKey);
      finish = range ? { key: range.key, label: range.label, source: 'CLIENT_SELECTION', sourceLabel: `From Client Selections${requirement.benchtopSurface ? ` - ${requirement.benchtopSurface}` : ''}` }
        : { key: '', label: requirement.benchtopSurface, source: 'CLIENT_SELECTION', reason: 'Benchtop range not selected' };
      entry.selectedFinish = finish.label; entry.finishSource = finish.source;
      if (!finish.key) return fail(finish.reason, CABINETRY_SELECTION_REQUIRED, { kind: 'choose-benchtop-range', label: 'Choose the quotation range', options: BENCHTOP_RANGES.map(range => ({ id: range.key, label: range.label })) });
    } else if (type.finishDependent) {
      finish = resolveFinish(type.area === 'benchtops' ? 'benchtop' : 'finish', wardrobe ? [requirement.roomKey, 'wardrobes'] : [requirement.roomKey], selections, inclusions);
      entry.selectedFinish = finish.label; entry.finishSource = finish.source;
      const benchtop = type.area === 'benchtops';
      if (!finish.key) return fail(finish.reason, CABINETRY_SELECTION_REQUIRED, { kind: 'open-selections', label: `${benchtop ? 'Choose the benchtop range' : 'Choose the cabinet finish'} in ${selectionsPath(wardrobe && !cabinetryRoomGroup(requirement.room) ? requirement.room : requirement.room, benchtop ? 'Benchtops' : 'Doors & Panels')}` });
    }
    const rowGroupKey = requirement.type === 'handle_upgrade_sharkfin' && !TYPES.has(`${groupKey}\u0000${requirement.type}`) ? 'kitchen' : groupKey;
    const row = cabinetryCatalogueRow(rowGroupKey, type.key, finish.key);
    if (!row) return fail(`${type.label} is not priced in ${finish.label}`, '', { kind: 'open-selections', label: `Choose another finish in ${selectionsPath(requirement.room, 'Doors & Panels')}` });
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
  const configuredSharkfinRate = Number(workbook.cabinetryPricing?.sharkfin?.masterRate);
  const sharkfinRate = Number.isFinite(configuredSharkfinRate) && configuredSharkfinRate >= 0 ? configuredSharkfinRate : null;
  const rows = group.rows.map(row => {
    const target = plan.get(row.importKey);
    const previous = row[MARKER];
    const pricedRow = sharkfinRate !== null && row.cabinetryImportKey && /sharkfin handle upgrade/i.test(row.item || row.productName || '') && Number(row.excelRate) !== sharkfinRate ? { ...row, excelRate: sharkfinRate } : row;
    if (!target) {
      if (!previous) return pricedRow;
      // The finish or requirement moved on: hand the row back blank. An estimator's own
      // quantity is theirs and stays, as an ordinary manual row.
      const { [MARKER]: removed, ...rest } = row;
      changed = true;
      const selectionSpec = rest.selectionSpec === previous.selectionSpec ? '' : rest.selectionSpec;
      // Only a quantity this engine wrote is cleared. One typed since the last sync is manual too.
      const typed = !blank(row.quantity) && Number(row.quantity) !== previous.quantity;
      const returned = previous.manualOverride || typed ? { ...rest, selectionSpec } : { ...rest, quantity: '', qty: '', quantityManualOverride: false, selectionSpec };
      return pricedRow === row ? returned : { ...returned, excelRate: sharkfinRate };
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
      if (same(previous, marker) && row.selectionSpec === selectionSpec && pricedRow === row) return row;
      changed = true;
      return { ...pricedRow, selectionSpec, [MARKER]: marker };
    }
    if (same(previous, marker) && current === target.quantity && row.selectionSpec === selectionSpec && !row.quantityFormulaOverride && pricedRow === row) return row;
    changed = true;
    return { ...updateQuoteQuantityField(pricedRow, 'quantity', target.quantity), qty: target.quantity, selectionSpec, [MARKER]: marker };
  });
  const reconciled = entries.map(entry => entry.status !== CABINETRY_MATCHED ? { ...entry, outcome: CABINETRY_ACTION_REQUIRED }
    : !present.has(entry.matchedImportKey) ? { ...entry, status: CABINETRY_UNMATCHED, outcome: CABINETRY_ACTION_REQUIRED, reason: 'Its quote row is missing from this quotation', action: { kind: 'restore-row', label: 'Restore the cabinetry rows', importKey: entry.matchedImportKey } }
    : overridden.has(entry.matchedImportKey) ? { ...entry, flag: CABINETRY_MANUAL_OVERRIDE, outcome: CABINETRY_MANUAL_OVERRIDE, action: { kind: 'return-to-automatic', label: 'Return to automatic', importKey: entry.matchedImportKey } }
    : { ...entry, outcome: CABINETRY_OUTCOME_MATCHED });
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

// "Return to automatic": drops the estimator's own quantity on one linked row, so the row carries
// the quantity its requirements give it again.
export function returnCabinetryRowToAutomatic(workbook, importKey, workspaceId) {
  const group = workbook?.quotation?.CABINETRY;
  if (!group?.rows?.some(row => row.importKey === importKey && row[MARKER]?.manualOverride)) return workbook;
  const rows = group.rows.map(row => {
    if (row.importKey !== importKey || !row[MARKER]?.manualOverride) return row;
    const { manualOverride, manualQuantity, ...marker } = row[MARKER];
    return { ...updateQuoteQuantityField(row, 'quantity', marker.quantity), qty: marker.quantity, quantityManualOverride: false, [MARKER]: marker };
  });
  return applyCabinetryRequirementsToQuotation({ ...workbook, quotation: { ...workbook.quotation, CABINETRY: { ...group, rows } } }, workspaceId);
}
