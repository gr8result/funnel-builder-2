// The construction classes an exterior wall run can carry. These are real construction types, not
// display labels: each one drives different downstream quantities (brick, render, cladding, sills),
// so rendered brick veneer and rendered masonry must stay separate even though both are rendered.
export const EXTERIOR_WALL_CLASSES = ['Face Brick Veneer', 'Rendered Brick Veneer', 'Lightweight Cladding', 'Rendered Masonry', 'Other'];

export function normaliseLevel(value) {
  const text = String(value || '').trim().toLowerCase().replace(/[-_]/g, ' ');
  if (['ground', 'ground floor', 'ground level', 'lower', 'lower floor', 'lower level'].includes(text)) return 'Ground Floor';
  if (['second', 'second floor', 'second level', 'upper', 'upper floor', 'upper level', 'first floor'].includes(text)) return 'Second Level';
  if (['third', 'third floor', 'third level'].includes(text)) return 'Third Level';
  return 'Unassigned';
}

export function explicitLevel(item) {
  return [item.level, item.floor, item.storeyOrLevelName].map(normaliseLevel).find((level) => level !== 'Unassigned') || 'Unassigned';
}

// A sheet can contain drawings of multiple storeys. Preserve a selected run level;
// use the current sheet assignment for runs without an explicit level.
export function resolveTakeoffLevel(item, sheetLevels = {}) {
  const level = explicitLevel(item);
  return level !== 'Unassigned' ? level : normaliseLevel(sheetLevels[Number(item.page || item.pageId || item.sourcePage || 1)]);
}

export function importWallCategory(item) {
  const label = String(item.category || item.wallType || item.type || '').trim().toLowerCase();
  if (/\b(exterior|external)\b/.test(label)) return 'exterior';
  if (/\b(interior|internal)\b/.test(label)) return 'interior';
  return 'unclassified';
}

export function resolveExteriorClass(wall) {
  // An explicit Other selection must override any older construction aliases.
  const value = wall.exteriorType || wall.exteriorClass || wall.exteriorClassification || wall.wallSystem;
  const text = String(value || '').trim().toLowerCase();
  if (text.includes('lightweight') || text.includes('cladding')) return 'Lightweight Cladding';
  const rendered = text.includes('render');
  const brick = text.includes('brick');
  // Rendered brick veneer names both a render and a brick skin, so it has to be matched before
  // either single-material rule can claim it. Rendered masonry carries no brick skin and stays
  // masonry: it is a different wall system, never a silent upgrade to rendered brick veneer.
  if (rendered && brick) return 'Rendered Brick Veneer';
  if (rendered) return 'Rendered Masonry';
  // Saves written before the split stored a bare 'Brick Veneer', which has always meant face brick.
  if (brick) return 'Face Brick Veneer';
  // Never infer a construction from the fact that a wall is exterior, or from its thickness. An
  // unclassified wall stays Other until an estimator says otherwise.
  return 'Other';
}

// Canonical construction-system classification (Phase 2A). This is a second, more precise axis
// layered on top of the legacy five-class exteriorType above - it is never a replacement for it.
// resolveExteriorClass and EXTERIOR_WALL_CLASSES keep their exact existing values and behaviour
// (brick sills, canvas colours and the legacy Job Setup per-finish LM fields all still depend on
// them); resolveConstructionSystem below adds the separate system/frame/finish split the schedule
// and Job Setup framing totals need, deriving it from legacy data when a wall predates this field.
export const EXTERIOR_CONSTRUCTION_SYSTEMS = ['brick_veneer', 'core_filled_blockwork', 'double_brick', 'lightweight_cladding', 'custom', 'unclassified'];
export const INTERIOR_CONSTRUCTION_SYSTEMS = ['internal_timber_frame', 'custom', 'unclassified'];

export const CONSTRUCTION_SYSTEM_LABELS = {
  brick_veneer: 'Brick Veneer',
  core_filled_blockwork: 'Core-filled Blockwork',
  double_brick: 'Double Brick',
  lightweight_cladding: 'Lightweight Cladding',
  internal_timber_frame: 'Internal Timber Frame',
  custom: 'Custom',
  unclassified: 'Unclassified',
};

export const EXTERIOR_FINISH_LABELS = {
  face_brick: 'Face Brick',
  rendered_brick: 'Rendered Brick',
  rendered: 'Rendered',
};

// Canonical lightweight-cladding products (Phase 2A part 2). Reuses the naming already established
// by Job Setup's own lowerWallSystem/upperWallSystem/thirdWallSystem options ("150 Linea Board",
// "180 Linea Board", "405 Stria Cladding" - see lib/construction-estimation/inputDataSheetTemplate)
// rather than inventing a competing catalogue; no other canonical cladding-product list exists
// elsewhere in the repository to reuse. Stored directly in exteriorFinish for a lightweight_cladding
// wall, exactly as face_brick/rendered_brick are stored for a brick_veneer wall's finish - the
// product name is itself the canonical value here, so no further key/label translation is needed.
export const CLADDING_PRODUCTS = [
  'James Hardie Linea Weatherboard - 150mm',
  'James Hardie Linea Weatherboard - 180mm',
  'James Hardie Matrix',
  'James Hardie Axon',
  'James Hardie Stria',
  'James Hardie EasyLap',
  'James Hardie Fine Texture',
  'Other / Custom',
  'Unspecified',
];
export const CLADDING_PRODUCT_CUSTOM = 'Other / Custom';

// Canonical Room / Location list for openings (windows, doors). No existing module in this
// codebase carries a residential room list at this granularity: lib/builders/cabinetryRoomSelection.js's
// CABINETRY_ROOMS and lib/product-library/productLibraryTaxonomy.js's PRODUCT_LIBRARY_ROOMS both
// stop at wet-area/kitchen rooms or coarse groups ("Bedrooms", "Living Areas") with no per-bedroom
// or per-living-space distinction. The keys below reuse CABINETRY_ROOMS' exact key/label spelling
// for every room the two lists share (kitchen, butlers-pantry, pantry, laundry, bathroom, ensuite,
// powder-room) so a future cross-module room match (e.g. Client Selections) lines up without a
// second translation table; the remaining keys fill the granularity gap no existing list covers.
export const ROOM_LOCATION_OPTIONS = [
  ['entry', 'Entry / Foyer'],
  ['living', 'Living'], ['family', 'Family'], ['dining', 'Dining'],
  ['media-theatre', 'Media / Theatre'], ['rumpus', 'Rumpus'],
  ['kitchen', 'Kitchen'], ['butlers-pantry', "Butler's Pantry"], ['pantry', 'Pantry'],
  ['bed-1', 'Bed 1'], ['bed-2', 'Bed 2'], ['bed-3', 'Bed 3'], ['bed-4', 'Bed 4'], ['bed-5', 'Bed 5'], ['bed-6', 'Bed 6'],
  ['wir', 'WIR / Walk-in Robe'], ['robe', 'Robe'],
  ['bathroom', 'Bathroom'], ['ensuite', 'Ensuite'], ['powder-room', 'Powder Room'], ['wc', 'WC'],
  ['laundry', 'Laundry'],
  ['hallway', 'Hallway / Passage'], ['stairs', 'Stairs'],
  ['garage', 'Garage'], ['workshop', 'Workshop'],
  ['alfresco', 'Alfresco'], ['patio', 'Patio'], ['balcony', 'Balcony'], ['porch', 'Porch'], ['deck', 'Deck'],
  ['exterior', 'Exterior'],
  ['other', 'Other / Custom'],
].map(([key, label]) => ({ key, label }));
export const ROOM_LOCATION_CUSTOM_KEY = 'other';
export const ROOM_LOCATION_BY_KEY = new Map(ROOM_LOCATION_OPTIONS.map((room) => [room.key, room]));

// Only a small, unambiguous set of known legacy abbreviations/variants are normalised - an
// aggressive text match risks silently reassigning a room the estimator meant differently.
// Anything not recognised here is preserved as a custom label rather than guessed into a
// canonical room, per "Do NOT aggressively map ambiguous legacy text."
const LEGACY_ROOM_ALIASES = {
  ldry: 'laundry', laundryroom: 'laundry',
  wir: 'wir', walkinrobe: 'wir', walkinwardrobe: 'wir',
  ens: 'ensuite', bath: 'bathroom', pdr: 'powder-room', powderroom: 'powder-room',
  fam: 'family', din: 'dining', mediaroom: 'media-theatre', theatre: 'media-theatre', theater: 'media-theatre',
  gar: 'garage', ext: 'exterior', hall: 'hallway', passage: 'hallway',
  foyer: 'entry', bir: 'robe',
};
for (let i = 1; i <= 6; i++) { LEGACY_ROOM_ALIASES[`bedroom${i}`] = `bed-${i}`; LEGACY_ROOM_ALIASES[`bed${i}`] = `bed-${i}`; }
const roomTextKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

// Resolves a saved opening's room data into { roomKey, roomLabel, custom }. Legacy openings only
// ever had a free-text `location`; canonical openings carry roomKey/roomLabel directly and always
// win. A legacy value that matches a canonical label or a known alias exactly (ignoring
// spelling/case/spacing) normalises to that canonical room; anything else is preserved verbatim as
// a custom room rather than forced into "Other" with the original text discarded.
export function resolveOpeningRoom(opening = {}) {
  if (opening.roomKey && ROOM_LOCATION_BY_KEY.has(opening.roomKey)) {
    const canonical = ROOM_LOCATION_BY_KEY.get(opening.roomKey);
    return { roomKey: opening.roomKey, roomLabel: opening.roomLabel || canonical.label, custom: opening.roomKey === ROOM_LOCATION_CUSTOM_KEY };
  }
  const legacy = String(opening.location || opening.room || '').trim();
  if (!legacy) return { roomKey: '', roomLabel: '', custom: false };
  const textKey = roomTextKey(legacy);
  const byLabel = ROOM_LOCATION_OPTIONS.find((room) => roomTextKey(room.label) === textKey);
  if (byLabel) return { roomKey: byLabel.key, roomLabel: byLabel.label, custom: false };
  const aliasKey = LEGACY_ROOM_ALIASES[textKey];
  if (aliasKey && ROOM_LOCATION_BY_KEY.has(aliasKey)) {
    const canonical = ROOM_LOCATION_BY_KEY.get(aliasKey);
    return { roomKey: canonical.key, roomLabel: canonical.label, custom: false };
  }
  return { roomKey: ROOM_LOCATION_CUSTOM_KEY, roomLabel: legacy, custom: true };
}

// Pillars, Posts & Columns - a discrete vertical structural/architectural object, never a wall.
// coreType is the structural core; surroundType is an optional, independent cladding/finish around
// it (a steel post can carry a brick surround, a timber post usually carries none) - the two are
// deliberately separate axes, never a single combined enum, so one physical column stays one
// canonical object with both a core and (optionally) a surround.
export const POST_CORE_TYPES = ['brick', 'timber', 'steel', 'unclassified', 'custom'];
export const POST_CORE_TYPE_LABELS = { brick: 'Brick / Masonry', timber: 'Timber', steel: 'Steel', unclassified: 'Unclassified / Review Required', custom: 'Other / Custom' };
export const TIMBER_POST_SIZE_OPTIONS = ['90 x 90', '150 x 150', '200 x 200', '300 x 300', 'Custom'];
// Not an exhaustive catalogue - no structural-steel section catalogue exists elsewhere in this
// codebase (checked the product library and Job Setup templates), so section TYPE is a controlled
// list, and its actual width/depth are free, explicit dimensions rather than a fixed size list,
// per "do not hard-code these examples as the only allowable sizes".
export const STEEL_SECTION_TYPES = ['SHS', 'RHS', 'CHS', 'UC', 'Other / Custom'];
export const POST_SURROUND_TYPES = ['none', 'brick', 'rendered_brick', 'timber', 'lightweight_cladding', 'custom'];
export const POST_SURROUND_TYPE_LABELS = { none: 'None', brick: 'Brick', rendered_brick: 'Rendered Brick', timber: 'Timber', lightweight_cladding: 'Lightweight Cladding', custom: 'Other / Custom' };
export const POST_BRICK_FINISH_OPTIONS = ['Face Brick', 'Rendered Brick', 'Other / Custom'];

// Resolves a pillar/post/column's canonical classification, mirroring resolveConstructionSystem's
// "review rather than guess" rule: no coreType evidence at all means unclassified, never a default
// structural assumption.
export function resolvePostColumnCore(pillar = {}) {
  const coreType = POST_CORE_TYPES.includes(pillar.coreType) ? pillar.coreType : 'unclassified';
  const displayLabel = coreType === 'custom' && pillar.coreCustomLabel ? `Custom: ${pillar.coreCustomLabel}` : POST_CORE_TYPE_LABELS[coreType];
  return { coreType, classificationStatus: coreType === 'unclassified' ? 'unclassified' : coreType === 'custom' ? 'custom' : 'classified', displayLabel };
}

// A wall system's frame thickness (70/90mm timber) is a different measurement to its overall,
// nominal system thickness (e.g. a 230mm brick veneer wall around a 70mm frame). Only brick veneer
// and lightweight cladding carry a timber frame at all; core-filled blockwork and double brick do
// not, regardless of what the wall was drawn or measured at.
const FRAMED_EXTERIOR_SYSTEMS = ['brick_veneer', 'lightweight_cladding'];
const NOMINAL_OVERALL_THICKNESS_MM = {
  brick_veneer: { 70: 230, 90: 250 },
  core_filled_blockwork: 200,
  double_brick: 230,
};

function normaliseFrameThicknessMm(value) {
  const mm = Number(value);
  return mm === 70 || mm === 90 ? mm : null;
}

// Legacy walls (and this session's own synthetic fixtures) have only ever stored one thickness
// field on an exterior wall: its overall/nominal system thickness, defaulted to 230mm regardless of
// system. A value that already reads as a valid frame thickness is trusted as-is - a wall this thin
// cannot be a full brick veneer or blockwork skin, so it is already describing its frame. A
// recognised brick veneer nominal maps to its documented frame (230->70, 250->90); anything else
// (the common 230mm default, or an unrecognised value) defaults to the common 70mm frame, exactly
// like a brand new wall of this category gets today.
function legacyFrameThicknessMm(wall) {
  const direct = normaliseFrameThicknessMm(wall.thicknessMm);
  if (direct) return direct;
  return Number(wall.thicknessMm) === 250 ? 90 : 70;
}

/**
 * Canonical wall-system classification: construction system, frame (if any), exterior finish and
 * review status, for both AI and manual walls. Reuses resolveExteriorClass as the legacy fallback
 * so every already-classified exterior wall keeps the same real construction it was given; only an
 * actual legacy "Other" (no evidence) becomes "unclassified" here, never a guessed system.
 */
export function resolveConstructionSystem(wall = {}) {
  const category = importWallCategory(wall);
  if (category !== 'exterior') {
    const explicit = INTERIOR_CONSTRUCTION_SYSTEMS.includes(wall.constructionSystem) ? wall.constructionSystem : null;
    const hasThickness = wall.thicknessMm !== undefined && wall.thicknessMm !== null && wall.thicknessMm !== '' && Number(wall.thicknessMm) > 0;
    const system = explicit || (hasThickness ? 'internal_timber_frame' : 'unclassified');
    const frameThicknessMm = system === 'internal_timber_frame'
      ? (normaliseFrameThicknessMm(wall.frameThicknessMm) ?? normaliseFrameThicknessMm(wall.thicknessMm) ?? 70)
      : normaliseFrameThicknessMm(wall.frameThicknessMm);
    return {
      category, system, frameThicknessMm, overallNominalThicknessMm: null,
      frameMaterial: system === 'internal_timber_frame' ? 'timber' : system === 'custom' ? 'custom' : null,
      exteriorFinish: '', exteriorFinishCustomLabel: '', exteriorFinishLabel: '',
      classificationStatus: system === 'unclassified' ? 'unclassified' : system === 'custom' ? 'custom' : 'classified',
      displayLabel: CONSTRUCTION_SYSTEM_LABELS[system],
    };
  }
const explicit = EXTERIOR_CONSTRUCTION_SYSTEMS.includes(wall.constructionSystem) ? wall.constructionSystem : null;
   const legacyClass = resolveExteriorClass(wall);
   // If explicit is 'unclassified' but we have a recognized legacy class, ignore the explicit and use the legacy class.
   if (explicit === 'unclassified' && legacyClass !== 'Other') {
     explicit = null;
   }
   const system = explicit || (
     legacyClass === 'Other' ? 'unclassified'
       : legacyClass === 'Lightweight Cladding' ? 'lightweight_cladding'
         : legacyClass === 'Rendered Masonry' ? 'core_filled_blockwork'
           : 'brick_veneer'
   );
  const frameThicknessMm = FRAMED_EXTERIOR_SYSTEMS.includes(system)
    ? (normaliseFrameThicknessMm(wall.frameThicknessMm) ?? legacyFrameThicknessMm(wall))
    : null;
  const exteriorFinish = typeof wall.exteriorFinish === 'string' && wall.exteriorFinish ? wall.exteriorFinish : (
    legacyClass === 'Face Brick Veneer' ? 'face_brick'
      : legacyClass === 'Rendered Brick Veneer' ? 'rendered_brick'
        : legacyClass === 'Rendered Masonry' ? 'rendered'
          : ''
  );
  const overallNominalThicknessMm = system === 'brick_veneer' ? NOMINAL_OVERALL_THICKNESS_MM.brick_veneer[frameThicknessMm] || null
    : system === 'core_filled_blockwork' ? NOMINAL_OVERALL_THICKNESS_MM.core_filled_blockwork
      : system === 'double_brick' ? NOMINAL_OVERALL_THICKNESS_MM.double_brick
        : null;
  const displayLabel = system === 'unclassified' ? 'Unclassified'
    : system === 'custom' ? (wall.customSystemLabel ? `Custom: ${wall.customSystemLabel}` : 'Custom')
      : overallNominalThicknessMm ? `${overallNominalThicknessMm}mm ${CONSTRUCTION_SYSTEM_LABELS[system]}`
        : CONSTRUCTION_SYSTEM_LABELS[system];
  const exteriorFinishCustomLabel = typeof wall.exteriorFinishCustomLabel === 'string' ? wall.exteriorFinishCustomLabel : '';
  const exteriorFinishLabel = exteriorFinish === CLADDING_PRODUCT_CUSTOM && exteriorFinishCustomLabel
    ? exteriorFinishCustomLabel
    : EXTERIOR_FINISH_LABELS[exteriorFinish] || exteriorFinish;
  return {
    category, system, frameThicknessMm, overallNominalThicknessMm,
    frameMaterial: FRAMED_EXTERIOR_SYSTEMS.includes(system) ? 'timber' : system === 'custom' ? 'custom' : null,
    exteriorFinish, exteriorFinishCustomLabel, exteriorFinishLabel,
    classificationStatus: system === 'unclassified' ? 'unclassified' : system === 'custom' ? 'custom' : 'classified',
    displayLabel,
  };
}

/**
 * The exact inverse of the legacyClass -> system/exteriorFinish mapping above, for a wall whose
 * canonical construction system came from an explicit wall.constructionSystem rather than being
 * derived from resolveExteriorClass. Job Setup's LM/M2 totals (takeoffMaterialFields) and the
 * legacy per-class fields still key off the five-class exteriorClassification string, not the
 * newer system/exteriorFinish pair - a wall classified only through the canonical Phase 2A field
 * (e.g. a "Lightweight Cladding" selection that never touched the legacy exteriorType field) would
 * otherwise read back as exteriorClassification "Other" and get silently miscounted as an
 * unclassified/Other exterior wall even though resolveConstructionSystem correctly knows what it
 * is. Round-trips exactly for every wall this same file's system/exteriorFinish derivation could
 * have produced from a legacy class, so no existing wall's legacy classification changes.
 */
export function legacyExteriorClassFromSystem(wallSystem) {
  const { system, exteriorFinish } = wallSystem || {};
  if (system === 'brick_veneer') return exteriorFinish === 'rendered_brick' ? 'Rendered Brick Veneer' : 'Face Brick Veneer';
  if (system === 'lightweight_cladding') return 'Lightweight Cladding';
  if (system === 'core_filled_blockwork') return 'Rendered Masonry';
  // double_brick and custom are canonical-only systems with no legacy equivalent (Phase 2A) -
  // they fall back to Other exactly as an unrecognised legacy value already would.
  return 'Other';
}

export function runLengthM(run, pixelsPerMm) {
  if (run.lengthMm) return run.lengthMm / 1000;
  if (!run.nodes || run.nodes.length < 2 || !pixelsPerMm) return 0;
  let lengthPx = 0;
  for (let i = 1; i < run.nodes.length; i += 1) {
    lengthPx += Math.hypot(run.nodes[i].x - run.nodes[i - 1].x, run.nodes[i].y - run.nodes[i - 1].y);
  }
  return lengthPx / pixelsPerMm / 1000;
}

export function createExteriorClassificationTotals(walls, pixelsPerMm, sheetLevels = {}) {
  const emptyTotals = () => Object.fromEntries(EXTERIOR_WALL_CLASSES.map((name) => [name, 0]));
  const result = { all: emptyTotals(), byFloor: {} };
  walls.forEach((wall) => {
    if (importWallCategory(wall) !== 'exterior') return;
    const level = resolveTakeoffLevel(wall, sheetLevels);
    const floor = level !== 'Unassigned' ? level : `Sheet ${Number(wall.page || wall.pageId || wall.sourcePage || 1)} (no level assigned)`;
    const className = resolveExteriorClass(wall);
    const lengthM = runLengthM(wall, pixelsPerMm);
    if (!result.byFloor[floor]) result.byFloor[floor] = emptyTotals();
    result.byFloor[floor][className] += lengthM;
    result.all[className] += lengthM;
  });
  return result;
}
