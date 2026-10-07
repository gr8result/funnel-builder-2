import { snapToStandardThickness } from '../../components/construction-estimation/ai-plan-takeoff/wallUtils.js';
import { resolveExteriorClass } from '../../components/construction-estimation/ai-plan-takeoff/takeoffRunData.js';

export const TAKEOFF_LEVELS = { 'Ground Floor': 'lower', 'Second Level': 'upper', 'Third Level': 'third' };
export const materialRound = (value) => Math.round((Number(value) || 0) * 10000) / 10000;
export function takeoffThickness(value) {
  const mm = parseFloat(String(value ?? '').replace(/,/g, ''));
  return mm > 0 ? snapToStandardThickness(mm) : null;
}
export function openingQuantity(item) {
  const value = Number(item.quantity ?? item.qty ?? 1);
  return Number.isFinite(value) && value >= 0 ? value : 1;
}
export function openingDimensions(item) {
  return {
    widthMm: Number(item.widthMm) || Number(item.widthM) * 1000 || 0,
    heightMm: Number(item.heightMm) || Number(item.heightM) * 1000 || 0,
  };
}
// Standard window codes are two digits of height, then two of width, in 100 mm units.
// Non-standard or missing dimensions keep their measured sizes without inventing a code.
export function windowCodeForOpening(item) {
  if (item.openingClass !== 'Window') return '';
  const { heightMm, widthMm } = openingDimensions(item);
  const dimensions = [heightMm / 100, widthMm / 100];
  if (!dimensions.every((value) => Number.isInteger(value) && value > 0 && value <= 99)) return '';
  return dimensions.map((value) => String(value).padStart(2, '0')).join('');
}
// The exact codes AIPlanTakeoffStandalone.jsx's "Window Type" dropdown writes onto opening.subType
// (see its <select> options) - this is the real, live field distinguishing a fixed pane from an
// opening window, not a value Client Selections invents. 'FG' (Fixed Glass) is the one style that
// has no opening sash, so it takes no screen and no opening hardware.
export const WINDOW_SUBTYPE_LABELS = {
  standard: 'Sliding Window',
  AW: 'Awning Window',
  DH: 'Double Hung Window',
  LVR: 'Louvre Window',
  FG: 'Fixed Window',
  CA: 'Casement Window',
  BI: 'Bifold Window',
  GSD: 'Glass Sliding Door',
  CO: 'Centre Opening Window',
  Stacker: 'Stacker Door',
};
export function windowStyleLabel(subType) {
  const key = String(subType || '');
  return WINDOW_SUBTYPE_LABELS[key] || (key ? key : '');
}
// The exact codes AIPlanTakeoffStandalone.jsx's "Door Type" dropdown writes onto opening.subType.
// Door Type refines an Opening Class (e.g. Internal Door -> Hinged vs Cavity Sliding vs Barn); it
// never replaces openingClass. 'Cavity' and 'Robe' are the values isCavitySlider/isRobeSlider below
// match on - keep them if this list ever changes, or those framing calculations stop firing.
export const DOOR_SUBTYPE_LABELS = {
  Entry: 'Entry Door', Internal: 'Hinged Internal Door', DoubleInternal: 'Double Hinged Internal Door (pair)', Cavity: 'Cavity Sliding Door',
  Barn: 'Barn / Surface Sliding Door', Robe: 'Robe Slider', SlidingGlass: 'Sliding Glass Door',
  Stacker: 'Stacker Door', PanelLift: 'Garage Panel Lift Door', Roller: 'Roller Door', Other: 'Other / Custom',
};
export function doorStyleLabel(subType) {
  const key = String(subType || '');
  return DOOR_SUBTYPE_LABELS[key] || (key ? key : '');
}
export function isFixedWindowOpening(item = {}) {
  return String(item.subType || '').toUpperCase() === 'FG';
}
export const openingHostId = (item) => String(item.hostWallId || item.wallId || item.associatedWallId || '');
const doorDescription = (item) => `${item.subType || ''} ${item.doorType || ''} ${item.type || ''} ${item.label || ''}`.toLowerCase();
export const isCavitySlider = (item) => /cavity/.test(doorDescription(item));
export const isRobeSlider = (item) => /robe|wardrobe/.test(doorDescription(item));
// Structured Door Type codes first (subType 'DoubleInternal' / 'Barn'); the description match keeps
// openings saved with free-text door types working, like isCavitySlider/isRobeSlider above.
export const isDoubleInternalDoor = (item) => item?.subType === 'DoubleInternal' || /double/.test(doorDescription(item));
export const isBarnDoor = (item) => item?.subType === 'Barn' || /barn|surface sliding/.test(doorDescription(item));
// One classification per internal-door opening, for purchasing and labour: which product stream
// the opening's leaf belongs to. Cavity/robe precedence matches the existing schedules exactly.
export function internalDoorPurchaseType(item) {
  if (isCavitySlider(item)) return 'cavity';
  if (isRobeSlider(item)) return 'robe';
  if (isBarnDoor(item)) return 'barn';
  if (isDoubleInternalDoor(item)) return 'double';
  return 'single';
}

// Source IDs identify measurements. Schedule subtotals and repeated references cannot be deducted twice.
export function uniqueTakeoffItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item.id) return true;
    const key = `${item.kind || ''}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function associateTakeoffMeasurements(records, pixelsPerMm) {
   const measurements = uniqueTakeoffItems(records).map((item) => ({ ...item }));
   const walls = new Map(measurements.filter((item) => item.kind === 'wall').map((item) => [String(item.id), item]));

   // Helper functions for geometric linking
   function pointInPolygon(point, vertices) {
     // Ray casting algorithm
     let inside = false;
     for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
       const xi = vertices[i].x, yi = vertices[i].y;
       const xj = vertices[j].x, yj = vertices[j].y;
       const intersect = ((yi > point.y) !== (yj > point.y)) &&
                         (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
       if (intersect) inside = !inside;
     }
     return inside;
   }

   function distancePointToPolygon(point, vertices) {
     let minDist = Infinity;
     for (let i = 0; i < vertices.length; i++) {
       const j = (i + 1) % vertices.length;
       const dist = distancePointToSegment(point, vertices[i], vertices[j]);
       if (dist < minDist) minDist = dist;
     }
     return minDist;
   }

   function distancePointToSegment(point, v1, v2) {
     const dx = v2.x - v1.x;
     const dy = v2.y - v1.y;
     const len2 = dx*dx + dy*dy;
     if (len2 === 0) return distance(point, v1);
     let t = ((point.x - v1.x) * dx + (point.y - v1.y) * dy) / len2;
     t = Math.max(0, Math.min(1, t));
     const projX = v1.x + t * dx;
     const projY = v1.y + t * dy;
     return distance(point, {x: projX, y: projY});
   }

   function distance(p1, p2) {
     const dx = p1.x - p2.x;
     const dy = p1.y - p2.y;
     return Math.sqrt(dx*dx + dy*dy);
   }

   measurements.filter((item) => item.kind === 'opening').forEach((opening) => {
     // First, try the existing hostWallId link (if any) and check if it's valid by level.
     const existingWall = walls.get(String(opening.hostWallId || ''));
     let linked = existingWall && (opening.level === existingWall.level || opening.level === 'Unassigned' || existingWall.level === 'Unassigned');

     let wallToUse = null;
     if (!linked) {
       // Try to find a wall by geometry. Restricted to the opening's own page/sheet: a different
       // level is drawn on a different sheet with its own coordinate space, so raw pixel
       // coordinates from one page can spuriously fall inside a wall polygon drawn on another page
       // (e.g. two floors sharing the same footprint) - matching across pages would silently
       // misattribute an opening to the wrong level's wall.
       const candidateWalls = Array.from(walls.values()).filter(wall => {
         return wall.category === 'exterior' &&
                Number(wall.page || 1) === Number(opening.page || 1) &&
                (opening.level === wall.level || opening.level === 'Unassigned' || wall.level === 'Unassigned');
       });

       // If we have no candidate walls, we cannot link by geometry.
       if (candidateWalls.length > 0) {
         // pixelsPerMm is pixels-PER-millimetre (the same convention runLengthM/polygonAreaM2 use
         // elsewhere in this file), so dividing a raw pixel coordinate by it yields millimetres, not
         // metres - openingPoint/realWorldNodes below are real-world mm, matching the mm tolerance
         // compared against below.
         const openingPoint = {
           x: (opening.x || 0) / pixelsPerMm,
           y: (opening.y || 0) / pixelsPerMm
         };

         let bestWall = null;
         let minDistance = Infinity;

         for (const wall of candidateWalls) {
           // Convert wall nodes to real-world mm, same conversion as the opening point above.
           const realWorldNodes = wall.nodes.map(node => ({
             x: node.x / pixelsPerMm,
             y: node.y / pixelsPerMm
           }));

           // Check if the point is inside the wall polygon
           if (pointInPolygon(openingPoint, realWorldNodes)) {
             linked = true;
             bestWall = wall;
             wallToUse = wall;
             break;
           }

           // Otherwise, compute distance to the wall's segments
           const dist = distancePointToPolygon(openingPoint, realWorldNodes);
           if (dist < minDistance) {
             minDistance = dist;
             bestWall = wall;
           }
         }

         // 50mm tolerance - both openingPoint and realWorldNodes above are already real-world mm
         // (see comment above), so the threshold must be 50, not 0.05: comparing this same mm
         // distance against 0.05 (a metres-scale value) made the real tolerance 0.05mm, tight enough
         // that no real drawn opening could ever match its own wall by geometry.
         if (bestWall && minDistance <= 50) {
           linked = true;
           wallToUse = bestWall;
         }
       }
     }

     if (linked) {
       const wall = wallToUse || existingWall;
       opening.linkedWallId = wall.id;
       if (opening.level === 'Unassigned') opening.level = wall.level;
       opening.wallCategory = wall.category;
       opening.wallThicknessMm = takeoffThickness(wall.thicknessMm);
       opening.exteriorClassification = wall.exteriorClassification;
       opening.hostConstructionSystem = wall.constructionSystem;
       // The complete wall-system reference (frame thickness + cladding/finish product, e.g.
       // "Lightweight Cladding" / 70mm / "James Hardie Linea Weatherboard - 180mm"), not just the
       // flattened display label above - kept on the opening so downstream estimating/product logic
       // can read the full reference even where the schedule only shows a short label.
       opening.wallFrameThicknessMm = wall.frameThicknessMm ?? null;
       opening.wallExteriorFinish = wall.exteriorFinish || '';
       opening.wallSystemLabel = wall.wallSystemLabel || '';
       opening.elevation = opening.elevation || opening.facade || wall.elevation || wall.facade || '';
       if (wall.category === 'interior' && opening.openingClass !== 'Window') opening.openingClass = 'Internal Door';
     } else {
       opening.linkedWallId = '';
     }
   });

   // Then, for each wall, compute linkedOpeningAreaM2 and cavitySlider as before
   for (const wall of walls.values()) {
     const openings = measurements.filter((item) => item.kind === 'opening' && item.linkedWallId === wall.id
       && (wall.category === 'interior' || item.openingClass !== 'Internal Door'));
     wall.linkedOpeningAreaM2 = materialRound(openings.reduce((sum, item) => sum + (item.openingAreaM2 || 0), 0));
     wall.cavitySlider = wall.category === 'interior' && openings.some(isCavitySlider);
     // A cavity pocket needs 90mm framing even on older runs saved without that requirement.
     if (wall.cavitySlider && (!wall.thicknessMm || takeoffThickness(wall.thicknessMm) === 70)) {
       wall.thicknessMm = 90;
       if (wall.frameThicknessMm !== undefined) wall.frameThicknessMm = 90;
     }
     openings.forEach((item) => { item.wallThicknessMm = takeoffThickness(wall.thicknessMm); });
   }
   return measurements;
 }

// Exterior construction class -> the field-key stem its measured quantities are reported under.
// Face Brick Veneer keeps the historic BrickVeneer stem because that is exactly what those fields
// have always held, so no existing job's numbers move. Rendered Brick Veneer gets its own stem: it
// is a brick wall with a render coat, not blockwork, so folding it into RenderedMasonry would
// misstate both brick counts and render areas.
export const EXTERIOR_WALL_SYSTEM_FIELD_KEYS = {
  BrickVeneer: 'Face Brick Veneer',
  RenderedBrickVeneer: 'Rendered Brick Veneer',
  RenderedMasonry: 'Rendered Masonry',
  LightweightCladding: 'Lightweight Cladding',
  Other: 'Other',
};

const BRICK_VENEER_WALL_SYSTEMS = ['Face Brick Veneer', 'Rendered Brick Veneer'];
const BRICK_SILL_WALL_SYSTEMS = [...BRICK_VENEER_WALL_SYSTEMS, 'Rendered Masonry'];
// Canonical equivalents (Phase 2A): a window hosted by Lightweight Cladding must never contribute
// a brick sill merely for being an external window - it carries no brick skin at all. Core-filled
// blockwork keeps the same sill eligibility Rendered Masonry (its closest legacy alias) already had.
const BRICK_VENEER_CONSTRUCTION_SYSTEMS = ['brick_veneer'];
const BRICK_SILL_CONSTRUCTION_SYSTEMS = ['brick_veneer', 'core_filled_blockwork'];

export function brickSillLength(item) {
  // Garage openings never carry a sill, even when historical flags say brickwork is below them.
  if (item.openingClass === 'Garage Door') return 0;
  if (!item.linkedWallId || item.wallCategory !== 'exterior') return 0;
  // Prefer the canonical construction system the host wall record supplies (Phase 2A): it is
  // correct even for a wall classified only under the new system, with no legacy exteriorType
  // alias to read. Fall back to the legacy alias for older measurement records that predate this
  // field, so no existing saved takeoff's sill quantities can change.
  const hostSystem = typeof item.hostConstructionSystem === 'string' && item.hostConstructionSystem ? item.hostConstructionSystem : null;
  const legacyWallSystem = resolveExteriorClass({ exteriorClassification: item.exteriorClassification });
  const isBrickVeneer = hostSystem ? BRICK_VENEER_CONSTRUCTION_SYSTEMS.includes(hostSystem) : BRICK_VENEER_WALL_SYSTEMS.includes(legacyWallSystem);
  const eligibleSystem = hostSystem ? BRICK_SILL_CONSTRUCTION_SYSTEMS.includes(hostSystem) : BRICK_SILL_WALL_SYSTEMS.includes(legacyWallSystem);
  if (!eligibleSystem) return 0;
  const { widthMm, heightMm } = openingDimensions(item);
  const length = widthMm > 0 && Number.isFinite(widthMm) ? widthMm / 1000 * openingQuantity(item) : 0;
  const window = item.openingClass === 'Window';
  // Every external opening in a brick-veneer wall requires its width of sill, on every elevation
  // and level, except a garage door (already excluded above) - windows and external/entry doors
  // are not treated differently here. Old saved false flags and full-height rules must not
  // suppress this construction requirement.
  if (isBrickVeneer && item.openingClass !== 'Internal Door') return length;
  // Preserve the existing explicit brickwork-below rule for exterior doors and rendered masonry.
  if (item.brickworkBelow === false || item.hasBrickworkBelow === false || item.brickSillRequired === false) return 0;
  const below = item.brickworkBelow === true || item.hasBrickworkBelow === true || item.brickSillRequired === true || Number(item.sillHeightMm) > 0;
  if (window && heightMm >= 2100 && !below) return 0;
  if (item.level === 'Ground Floor' && window) return length;
  if (['Second Level', 'Third Level'].includes(item.level) && /front/i.test(item.elevation || '')
    && (window || (/Door/.test(item.openingClass) && item.openingClass !== 'Internal Door' && below))) return length;
  return 0;
}

// Default wall height (M) for a level's walls with no explicit wallHeightM of their own.
// Ground Floor walls rise straight from the slab/foundation to their own ceiling. Second and
// Third Level walls must also travel through that level's own floor build-up before reaching
// its ceiling - the same physical wall-height rule Items 78/79 use for gross wall area
// (estimateBuilderWorkbookCalculations.js), applied here for the per-wall-system Gross/Net area
// takeoffMaterialFields derives, not a second, independent height convention. Floor depth is saved as a
// descriptive floor-system option (e.g. "319mm Timber Floor System...") rather than a bare
// number - parseFloat reads its leading digits the same way takeoffThickness already does for
// wall thickness options, rather than a stricter parse that would see the whole string as NaN.
export function takeoffLevelWallHeightM(prefix, jobSetupRows = {}) {
  const savedHeight = jobSetupRows[`${prefix}CeilingHeight`]?.value ?? jobSetupRows[`${prefix}CeilingHeight`];
  const ceilingHeightM = Number(savedHeight) > 20 ? Number(savedHeight) / 1000 : Number(savedHeight);
  const savedFloorDepth = jobSetupRows[`${prefix}FloorDepthMm`]?.value ?? jobSetupRows[`${prefix}FloorDepthMm`];
  const floorDepthMm = parseFloat(String(savedFloorDepth ?? '').replace(/,/g, ''));
  const floorDepthM = prefix === 'lower' || !(floorDepthMm > 0) ? 0 : floorDepthMm / 1000;
  return ceilingHeightM ? ceilingHeightM + floorDepthM : ceilingHeightM;
}

export function takeoffMaterialFields(records, jobSetupRows = {}) {
  const fields = {};
  const sum = (items, key) => materialRound(items.reduce((n, item) => n + (Number(item[key]) || 0), 0));
  const walls = records.filter((item) => item.kind === 'wall' && item.quantity !== null);
  const openings = records.filter((item) => item.kind === 'opening');
  const systems = EXTERIOR_WALL_SYSTEM_FIELD_KEYS;
  for (const [level, prefix] of Object.entries(TAKEOFF_LEVELS)) {
    const levelWalls = walls.filter((item) => item.level === level);
    for (const [type, category] of [['Internal', 'interior'], ['External', 'exterior']]) {
      const items = levelWalls.filter((item) => item.category === category);
      if (!items.length) continue;
      // Internal wall thickness IS its frame thickness. An external wall's overall/nominal system
      // thickness (e.g. 230mm brick veneer) is a different measurement to its frame - a brick
      // veneer or lightweight cladding wall can share the same 70mm/90mm timber frame a matching
      // internal wall uses, so this must read frameThicknessMm, never the overall thicknessMm, or
      // an external wall's framing never reaches these totals at all.
      const frameOf = (item) => category === 'interior' ? item.thicknessMm : item.frameThicknessMm;
      for (const thickness of [70, 90]) fields[`${prefix}${type}${thickness}mmWallsLm`] = sum(items.filter((item) => takeoffThickness(frameOf(item)) === thickness), 'quantity');
      if (type === 'Internal') {
        const cavity = items.filter((item) => item.cavitySlider && takeoffThickness(item.thicknessMm) === 90);
        fields[`${prefix}CavitySlider90mmWallsLm`] = sum(cavity, 'quantity');
        // The cage supplies pocket studs. Count the run at 450mm centres without ordinary-wall extras.
        fields[`${prefix}CavitySlider90mmStudsEach`] = cavity.reduce((n, item) => n + Math.ceil(item.quantity / 0.45), 0);
      }
    }
    const exterior = levelWalls.filter((item) => item.category === 'exterior');
    // Job Setup's simplified wall-length breakdown needs LEVEL + WALL SYSTEM + FRAME THICKNESS
    // together - a 70mm frame alone does not say whether it is behind 230mm brick veneer or
    // lightweight cladding, and those are different construction systems with different
    // downstream material calculations. Face Brick Veneer and Rendered Brick Veneer are grouped
    // here only for this framing-LM breakdown; their own separate fields above keep the
    // distinction the brick/render quantity calculations still need.
    const brickVeneerExterior = exterior.filter((item) => ['Face Brick Veneer', 'Rendered Brick Veneer'].includes(item.exteriorClassification));
    const claddingExterior = exterior.filter((item) => item.exteriorClassification === 'Lightweight Cladding');
    for (const thickness of [70, 90]) {
      fields[`${prefix}BrickVeneer${thickness}mmWallsLm`] = sum(brickVeneerExterior.filter((item) => takeoffThickness(item.frameThicknessMm) === thickness), 'quantity');
    }
    fields[`${prefix}LightweightCladding70mmWallsLm`] = sum(claddingExterior.filter((item) => takeoffThickness(item.frameThicknessMm) === 70), 'quantity');
    const height = takeoffLevelWallHeightM(prefix, jobSetupRows);
    if (exterior.length) {
      const knownHeights = exterior.every((item) => item.wallHeightM || height);
      for (const [key, category] of Object.entries(systems)) {
        const items = exterior.filter((item) => item.exteriorClassification === category);
        fields[`${prefix}${key}ExternalWallsLm`] = sum(items, 'quantity');
        if (!knownHeights) continue;
        const gross = sum(items.map((item) => ({ area: item.quantity * (item.wallHeightM || height) })), 'area');
        const deductions = sum(items, 'linkedOpeningAreaM2');
        const net = sum(items.map((item) => ({ area: Math.max(0, item.quantity * (item.wallHeightM || height) - item.linkedOpeningAreaM2) })), 'area');
        fields[`${prefix}${key}GrossWallM2`] = gross;
        fields[`${prefix}${key}OpeningM2`] = deductions;
        fields[`${prefix}${key}NetWallM2`] = net;
      }
    }
    const levelOpenings = openings.filter((item) => item.level === level);
    if (levelOpenings.length) {
      fields[`${prefix}WindowOpeningsAreaM2`] = sum(levelOpenings.filter((item) => item.openingClass === 'Window'), 'openingAreaM2');
      fields[`${prefix}DoorOpeningsAreaM2`] = sum(levelOpenings.filter((item) => /Door/.test(item.openingClass)), 'openingAreaM2');
      fields[`${prefix}ExternalOpeningAreaM2`] = sum(levelOpenings.filter((item) => item.linkedWallId && item.wallCategory === 'exterior' && item.openingClass !== 'Internal Door'), 'openingAreaM2');
    }
  }
  if (openings.length) {
    fields.brickVeneerSillsLm = materialRound(openings.reduce((n, item) => n + brickSillLength(item), 0));
    fields.jamb90x19StockLengthsEach = 0;
    fields.jamb110x19StockLengthsEach = 0;
    for (const opening of openings.filter((item) => item.openingClass === 'Internal Door')) {
      // A cavity slider's jamb is supplied with, and already priced into, its cavity-slider cage
      // (a separate material line - see totalCavitySliderCagesEach) - it never draws from ordinary
      // jamb stock, on any wall thickness. Counting it here too would double the jamb material for
      // the same opening, and a 90mm internal wall existing at all is never itself a reason to add
      // a jamb-stock requirement - only an actual non-cavity-slider door hosted on it is.
      if (isCavitySlider(opening)) continue;
      const thickness = opening.wallThicknessMm || takeoffThickness(opening.thicknessMm);
      if (![70, 90].includes(thickness)) continue;
      const robe = isRobeSlider(opening);
      // Passage (hinged) door: 3 sides get jamb - the head and the two verticals - width + 2x
      // height. Robe sliding door: 4 sides - a full frame, with no floor threshold to omit -
      // 2x(width + height). Wall thickness alone decides 90x19 vs 110x19 stock; the door's own
      // opening type decides how much of that stock one door needs.
      const perimeterM = robe ? 2 * (opening.widthMm + opening.heightMm) / 1000 : (opening.widthMm + 2 * opening.heightMm) / 1000;
      const required = Number(opening.requiredJambLM ?? opening.requiredJambLm ?? opening.jambLengthLm) || perimeterM;
      const lengths = robe ? Math.ceil(required / 5.4) : 1;
      fields[thickness === 90 ? 'jamb110x19StockLengthsEach' : 'jamb90x19StockLengthsEach'] += lengths * opening.quantity;
    }
  }
  return fields;
}

// Per-opening diagnostic for the 90x19 / 110x19 jamb stock totals above: takeoffMaterialFields only
// returns the two aggregate counts, which is enough to build the material list but not enough to
// answer "why is jamb110x19StockLengthsEach 3?" for a specific project. This walks the exact same
// filter/branch the aggregate loop uses (isCavitySlider exclusion, wall-thickness bucket, robe vs
// passage perimeter/lengths rule) and returns one entry per contributing internal-door opening
// instead of a running total, so the aggregate and this trace can never disagree about which rule
// produced which number - there is still exactly one implementation of the jamb rule; this only
// adds visibility into it.
export function internalDoorJambTrace(records) {
  const openings = records.filter((item) => item.kind === 'opening' && item.openingClass === 'Internal Door');
  return openings.map((opening) => {
    const cavitySlider = isCavitySlider(opening);
    const thickness = opening.wallThicknessMm || takeoffThickness(opening.thicknessMm);
    const robe = isRobeSlider(opening);
    const perimeterM = robe ? 2 * (opening.widthMm + opening.heightMm) / 1000 : (opening.widthMm + 2 * opening.heightMm) / 1000;
    const required = Number(opening.requiredJambLM ?? opening.requiredJambLm ?? opening.jambLengthLm) || perimeterM;
    const lengths = robe ? Math.ceil(required / 5.4) : 1;
    const eligible = !cavitySlider && [70, 90].includes(thickness);
    return {
      id: String(opening.id),
      level: opening.level,
      widthMm: opening.widthMm,
      heightMm: opening.heightMm,
      description: opening.description || '',
      quantity: openingQuantity(opening),
      hostWallId: opening.linkedWallId || opening.hostWallId || null,
      wallThicknessMm: thickness,
      isCavitySlider: cavitySlider,
      isRobeSlider: robe,
      perimeterM: materialRound(perimeterM),
      lengthsPerOpening: eligible ? lengths : 0,
      jambBucket: !eligible ? (cavitySlider ? 'none (cavity slider cage supplies jamb)' : 'none (wall thickness not 70/90mm)')
        : thickness === 90 ? 'jamb110x19StockLengthsEach' : 'jamb90x19StockLengthsEach',
      contributedLengths: eligible ? lengths * openingQuantity(opening) : 0,
    };
  });
}

// Full per-opening reconciliation for every internal-door-class opening: exactly which product
// category (standard hinged door / robe-sliding door / cavity-slider cage) each one lands in and
// why, in one place. This is the diagnostic view - "why is the standard schedule missing an
// opening" or "why did this one land in the wrong category" - as opposed to
// createInternalDoorSizeSchedule/createRobeSlidingDoorSchedule/internalDoorJambTrace, which each
// apply the same underlying isCavitySlider/isRobeSlider rule but only report their own slice of the
// outcome. Every field here is read straight off the associated opening record - nothing is
// recomputed with different logic, so this trace and the schedules it explains can never disagree.
export function internalDoorReconciliationTrace(records) {
  const openings = records.filter((item) => item.kind === 'opening' && item.openingClass === 'Internal Door');
  return openings.map((opening) => {
    const cavitySlider = isCavitySlider(opening);
    const robe = isRobeSlider(opening);
    const { widthMm, heightMm } = openingDimensions(opening);
    const hostFrameThicknessMm = opening.wallThicknessMm ?? null;
    let category = 'standard';
    let reason = '';
    if (cavitySlider) { category = 'cavity_slider'; reason = 'Cavity sliding door - reported only in the cavity-slider-cage schedule, not as a standard door.'; }
    else if (robe) { category = 'robe_sliding'; reason = 'Robe/sliding door - reported only in the robe/sliding-door schedule, not as a standard door.'; }
    return {
      id: String(opening.id),
      level: opening.level,
      widthMm,
      heightMm,
      openingClass: opening.openingClass,
      doorType: opening.subType || '',
      isCavitySlider: cavitySlider,
      isRobeSlider: robe,
      hostWallId: opening.linkedWallId || opening.hostWallId || null,
      hostFrameThicknessMm,
      includedInStandardDoorSchedule: category === 'standard',
      category,
      reason,
    };
  });
}

export function brickOrderQuantities(faceNetM2, renderedNetM2) {
  const faceBrickBaseEach = faceNetM2 * 52;
  const renderedTwinAreaM2 = renderedNetM2 * 0.9;
  const renderedSingleAreaM2 = renderedNetM2 * 0.1;
  const renderedTwinBaseEach = renderedTwinAreaM2 * 26;
  const renderedSingleBaseEach = renderedSingleAreaM2 * 52;
  // Remove only floating-point noise; a real fractional brick must round up.
  const order = (base) => {
    const quantity = base * 1.1;
    return Math.ceil(quantity - Number.EPSILON * Math.max(1, Math.abs(quantity)) * 4);
  };
  return { faceBrickBaseEach, faceBrickOrderEach: order(faceBrickBaseEach),
    renderedTwinAreaM2, renderedSingleAreaM2, renderedTwinBaseEach, renderedSingleBaseEach,
    renderedTwinOrderEach: order(renderedTwinBaseEach),
    renderedSingleOrderEach: order(renderedSingleBaseEach) };
}
