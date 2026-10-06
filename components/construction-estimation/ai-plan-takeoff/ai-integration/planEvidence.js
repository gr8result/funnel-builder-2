// Plan-set evidence: facts read once from EVERY sheet (elevations, sections, schedules, legends,
// notes) and then used to resolve what a single floor-plan sheet cannot show on its own. Pure
// functions only - shared by the server prompt builder, the analysis contract and the tests.

export const EVIDENCE_LEVELS = ['Ground Floor', 'Second Level', 'Third Level'];
const LEVEL_PREFIX = { 'Ground Floor': 'lower', 'Second Level': 'upper', 'Third Level': 'third' };
const positive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const reliable = (item, minimum = 0.7) => item && item.basis !== 'ASSUMED' && Number(item.confidence) >= minimum;
const cell = (row) => (row && typeof row === 'object' ? row.value : row);
const text = (value) => String(value ?? '').trim();

/** Job Setup stores ceiling heights in metres ("2.74") or millimetres ("2740"). */
export function heightToMm(value) {
  const number = Number(text(value).replace(/[^0-9.]/g, ''));
  if (!(number > 0)) return null;
  const mm = number < 20 ? number * 1000 : number;
  return mm >= 1800 && mm <= 6000 ? Math.round(mm) : null;
}

// "Ground Level external wall type" options -> canonical construction system + finish.
export function wallSystemFromJobSetup(value) {
  const label = text(value).toLowerCase();
  if (!label || label === 'mixed') return null;
  if (/rendered brick veneer/.test(label)) return { constructionSystem: 'brick_veneer', exteriorFinish: 'rendered_brick' };
  if (/brick veneer/.test(label)) return { constructionSystem: 'brick_veneer', exteriorFinish: 'face_brick' };
  if (/blockwork/.test(label)) return { constructionSystem: 'core_filled_blockwork', exteriorFinish: 'rendered' };
  if (/180 linea/.test(label)) return { constructionSystem: 'lightweight_cladding', exteriorFinish: 'James Hardie Linea Weatherboard - 180mm' };
  if (/150 linea/.test(label)) return { constructionSystem: 'lightweight_cladding', exteriorFinish: 'James Hardie Linea Weatherboard - 150mm' };
  if (/stria/.test(label)) return { constructionSystem: 'lightweight_cladding', exteriorFinish: 'James Hardie Stria' };
  if (/cladding|framed/.test(label)) return { constructionSystem: 'lightweight_cladding', exteriorFinish: 'Unspecified' };
  return null;
}

/** Construction defaults the estimator already entered in Job Setup, per building level. */
export function projectDefaultsFromJobSetup(rows = {}) {
  const frame = (value) => ([70, 90].includes(Number(cell(value))) ? Number(cell(value)) : null);
  const levels = {};
  for (const level of EVIDENCE_LEVELS) {
    const prefix = LEVEL_PREFIX[level];
    const system = wallSystemFromJobSetup(cell(rows[`${prefix}WallSystem`]));
    const internal = text(cell(rows[`${prefix}InternalWallSystem`])).toLowerCase();
    const entry = {
      ceilingHeightMm: heightToMm(cell(rows[`${prefix}CeilingHeight`])),
      externalSystem: system?.constructionSystem || null,
      externalFinish: system?.exteriorFinish || null,
      externalFrameMm: frame(rows[`${prefix}WallThicknessMm`]),
      internalFrameMm: frame(rows[`${prefix}InternalWallThicknessMm`]),
      internalFramed: /framed/.test(internal) ? true : /blockwork/.test(internal) ? false : null,
    };
    if (Object.values(entry).some((value) => value !== null)) levels[level] = entry;
  }
  const eave = Number(cell(rows.eavesWidthM));
  const pitch = Number(cell(rows.roofPitchDegrees));
  return { levels, eaveWidthMm: eave > 0 ? Math.round(eave * 1000) : null, roofPitchDegrees: pitch > 0 ? pitch : null };
}

/**
 * The rotation that makes a supporting sheet readable. Sheets of one plan set that share a page
 * size are bound the same way round, and the floor plans' orientation is the best established
 * (it is read from room names). A supporting sheet whose own reading is exactly upside-down from
 * that is the classic misread and takes the floor plans' rotation instead.
 */
export function evidenceRotation(inspection, inspections = [], pages = []) {
  const own = inspection?.rotationToUpright || 0;
  const size = (pageNumber) => { const page = pages.find((item) => item.pageNumber === pageNumber); return page ? `${page.logicalWidth}x${page.logicalHeight}` : ''; };
  const peers = inspections.filter((item) => item.relevant && item.drawingType === 'floor_plan' && size(item.page) === size(inspection.page));
  if (!peers.length) return own;
  const counts = new Map();
  peers.forEach((item) => counts.set(item.rotationToUpright || 0, (counts.get(item.rotationToUpright || 0) || 0) + 1));
  const consensus = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  return Math.abs(own - consensus) === 180 ? consensus : own;
}

const SCHEDULE_KEY = (value) => text(value).toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Combine the evidence responses from every sheet batch, keeping only reliable facts. */
export function mergePlanEvidence(responses = []) {
  const merged = { levels: {}, openingSchedule: [], windowCodeOrder: null, standardDoorHeightMm: null, eaveWidthMm: null, roofPitchDegrees: null, notes: [], review: [], conflicts: [] };
  const setOnce = (target, key, value, label) => {
    if (value === null || value === undefined || value === '') return;
    if (target[key] === null || target[key] === undefined) target[key] = value;
    else if (target[key] !== value) merged.conflicts.push(`${label}: the sheets state both ${target[key]} and ${value}.`);
  };
  for (const response of responses) {
    if (!response || typeof response !== 'object') continue;
    for (const item of response.levels || []) {
      if (!EVIDENCE_LEVELS.includes(item.level) || !reliable(item)) continue;
      const entry = merged.levels[item.level] ||= { ceilingHeightMm: null, externalSystem: null, externalFinish: null, externalFrameMm: null, externalThicknessMm: null, internalFrameMm: null, mixedExternal: false, evidence: [] };
      if (item.externalWallSystem === 'mixed') entry.mixedExternal = true;
      else if (item.externalWallSystem && item.externalWallSystem !== 'unclassified') setOnce(entry, 'externalSystem', item.externalWallSystem, `${item.level} external wall type`);
      setOnce(entry, 'externalFinish', item.externalFinish || null, `${item.level} external finish`);
      setOnce(entry, 'ceilingHeightMm', positive(item.ceilingHeightMm) ? Math.round(item.ceilingHeightMm) : null, `${item.level} ceiling height`);
      setOnce(entry, 'externalFrameMm', [70, 90].includes(item.externalFrameMm) ? item.externalFrameMm : null, `${item.level} external frame`);
      setOnce(entry, 'internalFrameMm', [70, 90].includes(item.internalFrameMm) ? item.internalFrameMm : null, `${item.level} internal frame`);
      setOnce(entry, 'externalThicknessMm', positive(item.externalWallThicknessMm) ? Math.round(item.externalWallThicknessMm) : null, `${item.level} external wall thickness`);
      if (item.evidence) entry.evidence.push(`Sheet ${item.page}: ${item.evidence}`);
    }
    for (const item of response.openingSchedule || []) {
      if (!reliable(item) || (!positive(item.widthMm) && !positive(item.heightMm))) continue;
      merged.openingSchedule.push({
        tag: text(item.tag), sizeCode: text(item.sizeCode), type: item.type || null, style: text(item.style),
        widthMm: positive(item.widthMm) ? Math.round(item.widthMm) : null, heightMm: positive(item.heightMm) ? Math.round(item.heightMm) : null,
        glassType: item.glassType || null, page: item.page, evidence: item.evidence || '',
      });
    }
    if (reliable(response.windowCodeConvention) && ['height-width', 'width-height'].includes(response.windowCodeConvention.order)) setOnce(merged, 'windowCodeOrder', response.windowCodeConvention.order, 'Window code order');
    if (reliable(response.standardDoorHeight) && positive(response.standardDoorHeight.valueMm)) setOnce(merged, 'standardDoorHeightMm', Math.round(response.standardDoorHeight.valueMm), 'Door height');
    if (reliable(response.eaveWidth) && positive(response.eaveWidth.valueMm)) setOnce(merged, 'eaveWidthMm', Math.round(response.eaveWidth.valueMm), 'Eave width');
    if (reliable(response.roofPitch) && positive(response.roofPitch.degrees)) setOnce(merged, 'roofPitchDegrees', response.roofPitch.degrees, 'Roof pitch');
    for (const note of response.notes || []) if (typeof note === 'string' && note.trim() && merged.notes.length < 40) merged.notes.push(note.trim().slice(0, 300));
    for (const note of response.review || []) if (typeof note === 'string' && note.trim()) merged.review.push(note.trim());
  }
  // A value two sheets disagree about is not established; it goes back to being unknown.
  for (const conflict of merged.conflicts) {
    const match = conflict.match(/^(Ground Floor|Second Level|Third Level) (external wall type|ceiling height|external frame|internal frame)/);
    if (!match) continue;
    const key = { 'external wall type': 'externalSystem', 'ceiling height': 'ceilingHeightMm', 'external frame': 'externalFrameMm', 'internal frame': 'internalFrameMm' }[match[2]];
    merged.levels[match[1]][key] = null;
  }
  return merged;
}

/** The small text block both measurement halves receive, so a floor plan is never read in isolation. */
export function compactPlanEvidence(evidence, defaults) {
  const levels = {};
  for (const level of EVIDENCE_LEVELS) {
    const drawn = evidence?.levels?.[level];
    const setup = defaults?.levels?.[level];
    if (!drawn && !setup) continue;
    levels[level] = {
      ...(drawn ? { fromPlanSet: Object.fromEntries(Object.entries(drawn).filter(([key, value]) => key !== 'evidence' && value !== null && value !== false)) } : {}),
      ...(setup ? { jobSetupDefault: Object.fromEntries(Object.entries(setup).filter(([, value]) => value !== null)) } : {}),
    };
  }
  return {
    levels,
    openingSchedule: (evidence?.openingSchedule || []).slice(0, 80).map(({ tag, sizeCode, type, style, widthMm, heightMm, glassType }) => ({ tag, sizeCode, type, style, widthMm, heightMm, glassType })),
    windowCodeOrder: evidence?.windowCodeOrder || null,
    standardDoorHeightMm: evidence?.standardDoorHeightMm || null,
    eaveWidthMm: evidence?.eaveWidthMm || defaults?.eaveWidthMm || null,
    notes: (evidence?.notes || []).slice(0, 25),
  };
}

/**
 * Resolve a wall's undocumented properties: the plan set first, then the Job Setup default.
 * Returns only what could be established, each with where it came from.
 */
export function resolveWallFromEvidence({ category, level }, evidence, defaults) {
  const drawn = evidence?.levels?.[level] || {};
  const setup = defaults?.levels?.[level] || {};
  const pick = (drawnValue, setupValue, what) => (drawnValue
    ? { value: drawnValue, basis: 'DERIVED', source: 'plan-set', evidence: `${what} read from the other sheets of this plan set.${drawn.evidence?.[0] ? ` ${drawn.evidence[0]}` : ''}` }
    : setupValue ? { value: setupValue, basis: 'ASSUMED', source: 'job-setup', evidence: `${what} taken from the Job Setup default for ${level}.` } : null);
  const result = {};
  const height = pick(drawn.ceilingHeightMm, setup.ceilingHeightMm, 'Ceiling height');
  if (height) result.wallHeightM = { ...height, value: height.value / 1000 };
  if (category === 'exterior') {
    const system = pick(drawn.mixedExternal ? null : drawn.externalSystem, setup.externalSystem, 'External wall type');
    if (system) {
      result.constructionSystem = system;
      const finish = system.source === 'plan-set' ? drawn.externalFinish : setup.externalFinish;
      if (finish) result.exteriorFinish = { ...system, value: finish };
    }
    const frame = pick(drawn.externalFrameMm, setup.externalFrameMm, 'External frame size');
    if (frame) result.frameThicknessMm = frame;
    if (drawn.externalThicknessMm) result.thicknessMm = { value: drawn.externalThicknessMm, basis: 'DERIVED', source: 'plan-set', evidence: 'External wall thickness read from the other sheets of this plan set.' };
  } else {
    const frame = pick(drawn.internalFrameMm, setup.internalFrameMm, 'Internal frame size');
    if (frame) result.frameThicknessMm = frame;
    if (drawn.internalFrameMm || setup.internalFramed || setup.internalFrameMm) {
      result.constructionSystem = { value: 'internal_timber_frame', basis: drawn.internalFrameMm ? 'DERIVED' : 'ASSUMED', source: drawn.internalFrameMm ? 'plan-set' : 'job-setup',
        evidence: drawn.internalFrameMm ? 'Internal framing read from the other sheets of this plan set.' : `Internal walls are framed in the Job Setup default for ${level}.` };
    }
  }
  return result;
}

/**
 * Australian opening shorthand: HEIGHT then WIDTH in 100 mm units, optionally followed by a style
 * suffix ("1806dh", "1506w", "2136 SGD"). A bare four-digit tag is only a size code when the
 * caller says the token is one - this never guesses that an arbitrary number is a size.
 */
export function parseOpeningSizeCode(value, order = 'height-width') {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^([0-9]{2})([0-9]{2})\s*([a-z/ ]{0,24})$/i);
  if (!match) return null;
  const first = Number(match[1]) * 100, second = Number(match[2]) * 100;
  if (!(first > 0) || !(second > 0)) return null;
  const [heightMm, widthMm] = order === 'width-height' ? [second, first] : [first, second];
  return { heightMm, widthMm, rawSizeCode: value.trim(), suffix: match[3].trim().toLowerCase() };
}

/** A schedule row for this opening: matched by its tag first, then by its size code. */
export function findScheduleEntry(raw, evidence) {
  const schedule = evidence?.openingSchedule || [];
  if (!schedule.length) return null;
  const tag = SCHEDULE_KEY(raw.tag), code = SCHEDULE_KEY(raw.sizeCode);
  const sameType = (item) => !item.type || !raw.type || item.type === raw.type;
  const byTag = tag ? schedule.filter((item) => SCHEDULE_KEY(item.tag) === tag && sameType(item)) : [];
  if (byTag.length === 1) return byTag[0];
  const byCode = code ? schedule.filter((item) => SCHEDULE_KEY(item.sizeCode) === code && sameType(item)) : [];
  // Several rows sharing one code are only usable when they agree on the size.
  if (byCode.length && new Set(byCode.map((item) => `${item.widthMm}x${item.heightMm}`)).size === 1) return byCode[0];
  return null;
}

const STYLE_BY_SUFFIX = [
  [/\bcsd\b|cavity/, 'Cavity'], [/\bdh\b|double hung/, 'DH'], [/\baw\b|awning|^w$/, 'AW'], [/\bfg\b|fixed/, 'FG'],
  [/stacker/, 'Stacker'], [/\bsgd\b|\bgsd\b|sliding glass|glass sliding/, 'GSD'], [/\blvr\b|louvre/, 'LVR'],
  [/\bca\b|casement/, 'CA'], [/\bbi\b|bi-?fold/, 'BI'],
];

/**
 * The existing canvas vocabulary for an opening's style, so an AI opening lands in the same
 * schedules as a hand-placed one (a cavity slider must read as "Cavity", never "Internal Door").
 */
export function resolveOpeningSubType(raw) {
  const described = `${text(raw.subType)} ${text(raw.tag)} ${text(raw.sizeCode).replace(/^[0-9]{4}\s*/, '')}`.toLowerCase().trim();
  if (raw.openingClass === 'Garage Door') return /roller/.test(described) ? 'Roller' : 'PanelLift';
  if (raw.openingClass === 'External Door') return /entry|front/.test(described) || !described ? 'Entry' : (text(raw.subType) || 'Entry');
  if (raw.openingClass === 'Internal Door') {
    if (/csd|cavity/.test(described)) return 'Cavity';
    if (/robe|wardrobe/.test(described)) return 'Robe';
    if (/barn/.test(described)) return 'Barn';
    if (/double/.test(described)) return 'DoubleInternal';
    // A sliding internal door whose construction is not shown stays unspecified for confirmation.
    if (/unspecified|sliding|pocket/.test(described)) return 'Unspecified';
    return 'Internal';
  }
  for (const [pattern, style] of STYLE_BY_SUFFIX) if (pattern.test(described)) return style;
  if (raw.openingClass === 'Large Glazed/Stacker/Sliding Door') return 'GSD';
  return raw.type === 'window' ? 'standard' : (text(raw.subType) || raw.openingClass);
}

/**
 * The most common height already used by this takeoff's doors of the same class - an established
 * project convention, used only when one height clearly dominates.
 */
export function establishedDoorHeight(existingOpenings = [], openingClass) {
  const heights = existingOpenings.filter((item) => item.type === 'door' && (item.openingClass || '') === openingClass && Number(item.heightMm) > 0).map((item) => Number(item.heightMm));
  if (heights.length < 3) return null;
  const counts = new Map();
  heights.forEach((height) => counts.set(height, (counts.get(height) || 0) + 1));
  const [height, count] = [...counts].sort((a, b) => b[1] - a[1])[0];
  return count / heights.length >= 0.8 ? height : null;
}

const AREA_LEVEL_WORDS = [
  [/\b(gnd|ground|grd|lower|g\.?f)\b/, 'Ground Floor'],
  [/\b(1st|first|upper|second level|level 1|l1|f\.?f)\b/, 'Second Level'],
  [/\b(2nd|third level|level 2|l2)\b/, 'Third Level'],
];

/** "GND FL LIVING AREA" names its own storey; the sheet it happens to be printed on does not. */
export function levelFromAreaLabel(label) {
  const normalized = text(label).toLowerCase().replace(/[^a-z0-9. ]+/g, ' ');
  for (const [pattern, level] of AREA_LEVEL_WORDS) if (pattern.test(normalized)) return level;
  return null;
}

export const isAreaUnit = (unit) => ['m2', 'sqm', 'sq m', 'sq.m', 'm²', 'sqm.', 'square metres', 'square meters'].includes(text(unit).toLowerCase().replace('²', '2').replace(/\s+/g, ' '));
