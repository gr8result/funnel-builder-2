// Construction quantities a quotation needs beyond walls, openings and floor areas: insulation,
// waterproofing, skirting, cornice, stairs and roof plan area.
//
// Every figure comes from approved measured geometry (rooms, walls, openings, floor areas) or from an
// explicit builder answer. Where the drawing cannot settle it, the row carries no quantity and says what is
// needed (a review question, or an entry in the quotation). Nothing is assumed.
//
// Builder answers live on the analysis as constructionInputs:
//   { stairFlights: number, ceilingUnderRoofM2: { [level]: number } }
import { normaliseLevel } from './takeoffRunData.js';

const WET = /\b(bath(room)?|ensuite|ens|wc|toilet|powder|pwd|laundry|l'?dry|shower)\b/i;
const OUTDOOR = /alfresco|patio|balcony|porch|portico|deck|terrace|verandah|veranda|outdoor|courtyard/i;
const GARAGE = /garage|carport|workshop/i;
const STAIR = /\bstair/i;
const LEVEL_ORDER = ['Ground Floor', 'Second Level', 'Third Level'];
// A room's storey in the app's own level names. A room may carry the drawing's name ("Upper Floor",
// "Lower Floor") or none (then its sheet's assignment); both must land on one name, or one storey is
// counted as two levels and stacked in the wrong order.
const roomLevelOf = (levelOf) => (room) => {
  const own = normaliseLevel(room?.level);
  if (own !== 'Unassigned') return own;
  const sheet = levelOf(room?.page);
  return normaliseLevel(sheet) !== 'Unassigned' ? normaliseLevel(sheet) : (sheet || 'Unassigned');
};

const round = (value, places = 2) => (Number.isFinite(value) ? Math.round(value * 10 ** places) / 10 ** places : null);
// Storey order from the level's name: the app's own names, and the names drawings use (Lower/Upper, First...).
const levelRank = (level) => {
  const i = LEVEL_ORDER.indexOf(level);
  if (i >= 0) return i;
  const name = String(level || '').toLowerCase();
  if (/basement|undercroft|sub-?floor/.test(name)) return -1;
  if (/ground|lower|level 0|\bg\b/.test(name)) return 0;
  if (/third|level 3|3rd|attic|loft/.test(name)) return 2;
  if (/first|second|upper|level [12]|1st|2nd/.test(name)) return 1;
  return 0;
};
const usableRoom = (room) => room && !room.excluded && Array.isArray(room.polygon) && room.polygon.length >= 3;
const approvedRoom = (room) => usableRoom(room) && room.confirmed === true && room.reviewRequired !== true && Number(room.areaM2) > 0;
export const isWetRoom = (room) => room?.wetArea === true || WET.test(String(room?.name || ''));
const isOutdoor = (room) => OUTDOOR.test(String(room?.name || ''));
const isGarage = (room) => GARAGE.test(String(room?.name || ''));

function polygonArea(nodes = []) {
  return Math.abs(nodes.reduce((sum, p, i) => { const q = nodes[(i + 1) % nodes.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2;
}
function polygonPerimeter(nodes = []) {
  return nodes.reduce((sum, p, i) => { const q = nodes[(i + 1) % nodes.length]; return sum + Math.hypot(q.x - p.x, q.y - p.y); }, 0);
}
function distanceToPolygonEdge(point, nodes) {
  let best = Infinity;
  nodes.forEach((a, i) => {
    const b = nodes[(i + 1) % nodes.length];
    const dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy)));
  });
  return best;
}
const isDoor = (opening) => /door/i.test(`${opening?.type || ''} ${opening?.openingClass || ''}`) && !/window/i.test(String(opening?.type || ''));
const openingPoint = (opening) => (Number.isFinite(opening?.x) && Number.isFinite(opening?.y) ? { x: opening.x, y: opening.y }
  : Number.isFinite(opening?.position?.x) ? opening.position : null);

/**
 * The rooms decide which levels exist. Inputs are already on the schedule's common scale:
 * rooms are measured (areaM2, perimeterM) on their own sheet; walls/openings/floorplans in plan pixels at pixelsPerMm.
 */
export function createConstructionQuantityRows({
  rooms = [], completedWallRuns = [], placedOpenings = [], completedFloorplans = [], completedEaves = [],
  pixelsPerMm, sheetPixelsPerMm = () => pixelsPerMm, levelOf = () => 'Unassigned', jobSetupRows = {}, inputs = {},
} = {}) {
  const rows = [];
  const row = (level, key, category, quantity, unit, notes, extra = {}) => rows.push({
    section: 'Construction Quantities', itemId: `construction-${key}-${String(level).replace(/\W+/g, '-').toLowerCase()}`,
    category, quantity: quantity === null ? null : round(quantity), unit, level, floor: level, notes, source: 'takeoff',
    ...(quantity === null ? { reviewRequired: true, commercialStatus: 'Review required' } : {}), ...extra,
  });
  const indoor = rooms.filter((room) => usableRoom(room) && !isOutdoor(room));
  const levelOfRoom = roomLevelOf(levelOf);
  const levels = [...new Set(indoor.map(levelOfRoom))].filter((level) => level && level !== 'Unassigned')
    .sort((a, b) => levelRank(a) - levelRank(b));
  const topLevel = levels.at(-1);
  const cell = (key) => { const raw = jobSetupRows?.[key]; const value = raw && typeof raw === 'object' ? raw.value : raw; const n = Number(String(value ?? '').replace(/[^0-9.]/g, '')); return n > 0 ? n : null; };

  for (const level of levels) {
    const onLevel = indoor.filter((room) => levelOfRoom(room) === level);
    const approved = onLevel.filter(approvedRoom);
    const pendingRooms = onLevel.length - approved.length;
    const pendingNote = pendingRooms ? ` ${pendingRooms} room(s) on this level are not approved yet and are not included.` : '';
    const doorsOn = (room) => {
      const ppm = sheetPixelsPerMm(room.page) || pixelsPerMm;
      return placedOpenings.filter((opening) => Number(opening.page) === Number(room.page) && isDoor(opening) && Number(opening.widthMm) > 0)
        .filter((opening) => { const point = openingPoint(opening); return point && distanceToPolygonEdge(point, room.polygon) <= 300 * ppm; });
    };

    // Insulation: external walls (net of openings) and ceilings under the roof.
    const exteriorWalls = completedWallRuns.filter((wall) => wall.category === 'exterior' && levelOf(wall.page) === level);
    if (exteriorWalls.length) {
      const noHeight = exteriorWalls.filter((wall) => !(Number(wall.wallHeightM) > 0));
      const wallIds = new Set(exteriorWalls.map((wall) => String(wall.id)));
      const hosted = placedOpenings.filter((opening) => wallIds.has(String(opening.linkedWallId ?? opening.hostWallId)));
      const noSize = hosted.filter((opening) => !(Number(opening.widthMm) > 0 && Number(opening.heightMm) > 0));
      if (noHeight.length || noSize.length) {
        row(level, 'wall-insulation', 'Insulation — external walls (net)', null, 'm2',
          `Needs ${noHeight.length ? `the wall height for ${noHeight.length} external wall(s)` : ''}${noHeight.length && noSize.length ? ' and ' : ''}${noSize.length ? `the size of ${noSize.length} opening(s) in external walls` : ''}.`);
      } else {
        const lengthM = (wall) => (Number(wall.lengthMm) > 0 ? Number(wall.lengthMm) : polygonPerimeter(wall.nodes || []) / 2 / (sheetPixelsPerMm(wall.page) || pixelsPerMm)) / 1000;
        const gross = exteriorWalls.reduce((sum, wall) => sum + lengthM(wall) * Number(wall.wallHeightM), 0);
        const openingArea = hosted.reduce((sum, opening) => sum + (Number(opening.widthMm) * Number(opening.heightMm) / 1e6) * (Number(opening.quantity) || 1), 0);
        row(level, 'wall-insulation', 'Insulation — external walls (net)', gross - openingArea, 'm2',
          `External wall length × wall height, less ${hosted.length} opening(s) (${round(openingArea)} m2).`);
      }
    }
    const ceilings = approved.reduce((sum, room) => sum + Number(room.areaM2), 0);
    if (level === topLevel) {
      row(level, 'ceiling-insulation', 'Insulation — ceilings under roof', approved.length ? ceilings : null, 'm2',
        approved.length ? `Ceiling area of the approved rooms on the top level.${pendingNote}` : 'Approve the rooms on this level first.');
    } else {
      const answered = Number(inputs?.ceilingUnderRoofM2?.[level]);
      row(level, 'ceiling-insulation', 'Insulation — ceilings under roof', answered > 0 || inputs?.ceilingUnderRoofM2?.[level] === 0 ? answered : null, 'm2',
        answered >= 0 && inputs?.ceilingUnderRoofM2?.[level] !== undefined ? 'Ceiling area under the roof on this level, as entered by the builder.'
          : 'Only the parts of this level not under an upper floor have roof above. Answer the review question.');
    }

    // Waterproofing: wet-area floors and their floor/wall junction; shower walls need shower sizes.
    const wet = approved.filter(isWetRoom);
    if (onLevel.some(isWetRoom)) {
      row(level, 'waterproof-floor', 'Waterproofing — wet area floors', wet.length ? wet.reduce((s, r) => s + Number(r.areaM2), 0) : null, 'm2',
        wet.length ? `${wet.map((r) => r.name).join(', ')}.${onLevel.filter(isWetRoom).length > wet.length ? ' Wet rooms not yet approved are not included.' : ''}` : 'Approve the wet rooms first.');
      row(level, 'waterproof-junction', 'Waterproofing — floor/wall junction', wet.length ? wet.reduce((s, r) => s + Number(r.perimeterM || 0), 0) : null, 'lm',
        wet.length ? 'Perimeter of the approved wet rooms.' : 'Approve the wet rooms first.');
      row(level, 'waterproof-shower', 'Waterproofing — shower walls', null, 'm2',
        'Shower sizes and screen positions are not measurable from the floor plan. Enter the shower wall area in the quotation.', { reviewRequired: false, commercialStatus: 'Builder entry' });
    }

    // Skirting (rooms less doorways; wet rooms are tiled, outdoor and garage excluded) and cornice.
    const skirtingRooms = approved.filter((room) => !isWetRoom(room) && !isGarage(room));
    if (skirtingRooms.length) {
      let doorways = 0;
      const total = skirtingRooms.reduce((sum, room) => { const doors = doorsOn(room).reduce((s, d) => s + Number(d.widthMm) / 1000, 0); doorways += doors; return sum + Math.max(0, Number(room.perimeterM || 0) - doors); }, 0);
      row(level, 'skirting', 'Skirting (room perimeters less doorways)', total, 'lm',
        `${skirtingRooms.length} approved room(s); ${round(doorways)} m of doorways deducted. Wet areas (tiled skirting) and garage excluded.${pendingNote}`);
    }
    const corniceRooms = approved.filter((room) => !isGarage(room));
    if (corniceRooms.length) {
      row(level, 'cornice', 'Cornice (room perimeters)', corniceRooms.reduce((s, r) => s + Number(r.perimeterM || 0), 0), 'lm',
        `${corniceRooms.length} approved room(s); garage excluded.${pendingNote}`);
    }
  }

  // Stairs: counted only when the builder says how many flights (a stair on the plan asks the question).
  if (rooms.some((room) => usableRoom(room) && STAIR.test(String(room.name || '')))) {
    const flights = Number(inputs?.stairFlights);
    row(levels[0] || 'Unassigned', 'stairs', 'Stairs — flights', flights > 0 ? flights : null, 'each',
      flights > 0 ? 'Number of stair flights, as entered by the builder.' : 'A stair is on the plan. Answer the review question with the number of flights.');
  }

  // Roof plan area over the top level: the approved footprint grown by the eaves width (exact for a
  // rectilinear outline: A + P·w + 4·w²). Pitched roof area only when the roof pitch is entered.
  if (topLevel) {
    const footprints = completedFloorplans.filter((fp) => fp.type === 'Footprint' && levelOf(fp.page) === topLevel && Array.isArray(fp.nodes) && fp.nodes.length >= 3);
    const approvedFootprints = footprints.filter((fp) => fp.confirmed === true || fp.source !== 'ai');
    const eaveWidths = completedEaves.map((eave) => Number(eave.widthMm)).filter((w) => w > 0).sort((a, b) => a - b);
    const eaveM = cell('eavesWidthM') ?? (eaveWidths.length ? eaveWidths[Math.floor(eaveWidths.length / 2)] / 1000 : null);
    if (footprints.length) {
      if (!approvedFootprints.length || eaveM === null) {
        row(topLevel, 'roof-plan', 'Roof plan area (footprint + eaves)', null, 'm2',
          !approvedFootprints.length ? 'Approve the top-level floor area first.' : 'Enter the eaves width in Job Setup (or measure the eaves).');
      } else {
        const plan = approvedFootprints.reduce((sum, fp) => {
          const ppm = sheetPixelsPerMm(fp.page) || pixelsPerMm;
          const areaM2 = polygonArea(fp.nodes) / (ppm * ppm) / 1e6, perimeterM = polygonPerimeter(fp.nodes) / ppm / 1000;
          return sum + areaM2 + perimeterM * eaveM + 4 * eaveM * eaveM;
        }, 0);
        row(topLevel, 'roof-plan', 'Roof plan area (footprint + eaves)', plan, 'm2',
          `Top-level footprint grown by ${eaveM} m eaves. Lower roofs (single-storey parts) are not included.`);
        const pitch = cell('roofPitchDegrees');
        row(topLevel, 'roof-pitched', 'Roof area (pitched)', pitch ? plan / Math.cos(pitch * Math.PI / 180) : null, 'm2',
          pitch ? `Roof plan area ÷ cos(${pitch}°).` : 'Enter the roof pitch in Job Setup.', pitch ? {} : { reviewRequired: false, commercialStatus: 'Builder entry' });
      }
    }
  }
  return rows;
}

// Questions only the builder can answer, as review decisions (see reviewSummary.js).
export function constructionDecisions(analysis = {}, levelOf = () => 'Unassigned') {
  const rooms = (analysis?.rooms || []).filter(usableRoom);
  const inputs = analysis?.constructionInputs || {};
  const decisions = [];
  if (rooms.some((room) => STAIR.test(String(room.name || ''))) && !(Number(inputs.stairFlights) > 0)) {
    decisions.push({ id: 'construction:stair-flights', topic: 'construction-input', field: 'stairFlights', pages: [...new Set(rooms.filter((r) => STAIR.test(r.name)).map((r) => r.page))],
      title: 'How many stair flights are there?', detail: 'A stair is on the plan. Stair flights are quoted per flight and cannot be counted from the floor plan alone.',
      action: { type: 'number', unit: 'flights', suggested: 1 } });
  }
  const indoor = rooms.filter((room) => !isOutdoor(room));
  const levelOfRoom = roomLevelOf(levelOf);
  const levels = [...new Set(indoor.map(levelOfRoom))].filter((l) => l && l !== 'Unassigned').sort((a, b) => levelRank(a) - levelRank(b));
  for (const level of levels.slice(0, -1)) {
    if (inputs.ceilingUnderRoofM2?.[level] !== undefined) continue;
    const below = indoor.filter((r) => levelOfRoom(r) === level && approvedRoom(r)).reduce((s, r) => s + Number(r.areaM2), 0);
    const above = indoor.filter((r) => levelOfRoom(r) === levels[levels.indexOf(level) + 1] && approvedRoom(r)).reduce((s, r) => s + Number(r.areaM2), 0);
    if (!(below > 0)) continue;
    decisions.push({ id: `construction:ceiling-under-roof:${level}`, topic: 'construction-input', field: 'ceilingUnderRoofM2', level, pages: [],
      title: `${level}: how much ceiling has roof directly above it?`,
      detail: `Approved ceilings on this level total ${round(below)} m2; the level above has ${round(above)} m2 of approved rooms. Only ceilings not under an upper floor take roof insulation. Enter 0 if none.`,
      action: { type: 'number', unit: 'm²', suggested: round(Math.max(0, below - above)), allowZero: true } });
  }
  return decisions;
}

// The builder's answer stored on the analysis.
export function applyConstructionInput(analysis, decision, value) {
  const number = Number(value);
  if (!analysis || !(number >= 0)) return analysis;
  const inputs = { ...(analysis.constructionInputs || {}) };
  if (decision.field === 'stairFlights' && number > 0) inputs.stairFlights = Math.round(number);
  else if (decision.field === 'ceilingUnderRoofM2' && decision.level) inputs.ceilingUnderRoofM2 = { ...(inputs.ceilingUnderRoofM2 || {}), [decision.level]: round(number) };
  else return analysis;
  return { ...analysis, constructionInputs: inputs };
}
