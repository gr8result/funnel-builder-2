// Region-based reading of doors and windows. A whole floor in one image leaves each opening a few
// pixels wide and the plan reading both misses openings and misplaces them. Here the building is
// cut into overlapping regions, each read on its own enlarged, and the readings are mapped back to
// sheet coordinates and merged. Pure functions except collectRegionOpenings, which only calls the
// request and crop functions it is given.
import { OPENINGS_REGION_SCOPE } from '../ai-integration/measurementScopes.js';

export const REGION_DEFAULTS = {
  regionMm: 8000,       // side of a region on the ground
  overlapMm: 1600,      // neighbouring regions share this much, so no opening sits only on an edge
  marginMm: 900,        // kept clear around the measured walls (window symbols, labels)
  duplicateMm: 700,     // the same opening read in two regions lands within this
  edgeMm: 350,          // a reading this close to its region's edge may be cut off
  maxRegions: 24,
};

const family = (item) => (item.type === 'window' || item.openingClass === 'Window' || item.openingClass === 'Large Glazed/Stacker/Sliding Door' ? 'glazed' : item.openingClass);
const code = (item) => String(item.sizeCode || '').toLowerCase().replace(/\s+/g, '');

/**
 * Overlapping regions covering the measured building.
 * @param bounds { x, y, x2, y2 } of the walls on the sheet, logical pixels
 * @param sheet  { logicalWidth, logicalHeight, pixelsPerMm }
 */
export function planRegions(bounds, sheet, overrides = {}) {
  const options = { ...REGION_DEFAULTS, ...overrides };
  const { logicalWidth, logicalHeight, pixelsPerMm } = sheet;
  if (!(pixelsPerMm > 0)) throw new Error('Regions need the sheet\'s confirmed calibration.');
  const px = (mm) => mm * pixelsPerMm;
  const x0 = Math.max(0, bounds.x - px(options.marginMm)), y0 = Math.max(0, bounds.y - px(options.marginMm));
  const x1 = Math.min(logicalWidth, bounds.x2 + px(options.marginMm)), y1 = Math.min(logicalHeight, bounds.y2 + px(options.marginMm));
  if (!(x1 > x0 && y1 > y0)) return [];
  const split = (start, end) => {
    const span = end - start, side = px(options.regionMm), overlap = px(options.overlapMm);
    const count = Math.max(1, Math.ceil((span - overlap) / (side - overlap)));
    // Equal regions that exactly span the building, each overlapping the next.
    const size = count === 1 ? span : (span + (count - 1) * overlap) / count;
    return Array.from({ length: count }, (_, index) => ({ start: start + index * (size - overlap), size }));
  };
  const columns = split(x0, x1), rows = split(y0, y1);
  if (columns.length * rows.length > options.maxRegions) throw new Error(`The building needs ${columns.length * rows.length} regions at this calibration; check the calibration before reading openings by region.`);
  return rows.flatMap((row, r) => columns.map((column, c) => ({ id: `r${r + 1}c${c + 1}`, x: column.start, y: row.start, width: column.size, height: row.size })));
}

// A point given as a fraction of a region's image -> the same point as a fraction of the sheet.
export function regionPointToSheet(region, point, sheet) {
  return { x: (region.x + point.x * region.width) / sheet.logicalWidth, y: (region.y + point.y * region.height) / sheet.logicalHeight };
}
export function sheetPointToRegion(region, point, sheet) {
  return { x: (point.x * sheet.logicalWidth - region.x) / region.width, y: (point.y * sheet.logicalHeight - region.y) / region.height };
}

/**
 * One list of openings for the sheet from the regions' readings.
 * @param readings [{ region, openings: [{ x, y (0..1 of the region image), openingClass, ... }] }]
 * @returns {{ openings, report }} openings in normalized SHEET coordinates, in the shape the analysis already uses
 */
export function mergeRegionOpenings(readings, sheet, overrides = {}) {
  const options = { ...REGION_DEFAULTS, ...overrides };
  const { logicalWidth, logicalHeight, pixelsPerMm } = sheet;
  const mm = (a, b) => Math.hypot((a.x - b.x) * logicalWidth, (a.y - b.y) * logicalHeight) / pixelsPerMm;
  const report = { regions: readings.length, read: 0, outsideRegion: 0, duplicatesMerged: 0, uncertain: 0, kept: 0 };
  const all = [];
  for (const { region, openings = [] } of readings) {
    for (const raw of openings) {
      report.read += 1;
      if (!(raw.x >= 0 && raw.x <= 1 && raw.y >= 0 && raw.y <= 1)) { report.outsideRegion += 1; continue; }
      const at = regionPointToSheet(region, raw, sheet);
      // Distance from the reading to the nearest edge of its region, on the ground.
      const edgeMm = Math.min(raw.x * region.width, (1 - raw.x) * region.width, raw.y * region.height, (1 - raw.y) * region.height) / pixelsPerMm;
      all.push({ item: { ...raw, ...at, detectionId: `${region.id}:${raw.detectionId}`, hostDetectionId: null, region: region.id }, at, edgeMm, region });
    }
  }
  // A reading well inside its region is trusted over the same opening read at another region's edge.
  all.sort((a, b) => (b.edgeMm >= options.edgeMm) - (a.edgeMm >= options.edgeMm) || (Number(b.item.confidence) || 0) - (Number(a.item.confidence) || 0) || b.edgeMm - a.edgeMm);
  const kept = [];
  for (const entry of all) {
    const twin = kept.find((other) => other.region.id !== entry.region.id && family(other.item) === family(entry.item)
      && mm(other.at, entry.at) <= (code(other.item) && code(other.item) === code(entry.item) ? options.duplicateMm * 1.5 : options.duplicateMm));
    if (twin) {
      report.duplicatesMerged += 1;
      twin.seenIn.add(entry.region.id);
      // Keep what the other reading knew that this one did not; the original codes are never rewritten.
      for (const key of ['sizeCode', 'tag', 'explicitWidthMm', 'explicitHeightMm', 'widthMm', 'heightMm', 'glassType', 'scheduleGlassType']) {
        if ((twin.item[key] === null || twin.item[key] === undefined || twin.item[key] === '') && entry.item[key] !== null && entry.item[key] !== undefined && entry.item[key] !== '') twin.item[key] = entry.item[key];
      }
      if (twin.item.openingClass !== entry.item.openingClass) twin.classDisagreement = entry.item.openingClass;
      continue;
    }
    kept.push({ ...entry, seenIn: new Set([entry.region.id]) });
  }
  const inside = (region, at) => { const p = sheetPointToRegion(region, at, sheet); const margin = options.edgeMm * pixelsPerMm; return p.x * region.width >= margin && (1 - p.x) * region.width >= margin && p.y * region.height >= margin && (1 - p.y) * region.height >= margin; };
  const openings = kept.map((entry) => {
    const reasons = [];
    // Regions that clearly contain this point but did not report it.
    const silent = readings.filter(({ region }) => !entry.seenIn.has(region.id) && inside(region, entry.at)).map(({ region }) => region.id);
    if (silent.length) reasons.push(`read in ${[...entry.seenIn].join(', ')} but not in ${silent.join(', ')}, which also shows this part of the plan`);
    if (entry.edgeMm < options.edgeMm && entry.seenIn.size === 1) reasons.push('read only at the edge of a region, where it may be cut off');
    if (entry.classDisagreement) reasons.push(`one reading calls it ${entry.item.openingClass}, another ${entry.classDisagreement}`);
    if (entry.item.openingClass === 'Other Opening') reasons.push('could be a window or a door');
    if (!reasons.length) return entry.item;
    report.uncertain += 1;
    return { ...entry.item, confidence: Math.min(Number(entry.item.confidence) || 0, 0.6), uncertain: true, evidence: `${entry.item.evidence || ''} Uncertain: ${reasons.join('; ')}.`.trim() };
  });
  report.kept = openings.length;
  return { openings, report };
}

/**
 * Reads the openings of one floor-plan sheet region by region.
 * @param crop    async (region) => { imageDataUrl, imageWidth, imageHeight }  the region, enlarged
 * @param request async (payload) => { analysis: { openings } }                 one provider request
 * @param base    the fields every request carries (identity, page metadata, calibration, plan evidence)
 * A region whose request fails is reported, never silently skipped; the rest are still read.
 */
export async function collectRegionOpenings({ regions, sheet, crop, request, base }) {
  const readings = [], failures = [];
  for (const region of regions) {
    try {
      const image = await crop(region);
      const result = await request({ ...base, action: 'measure', measurementScope: OPENINGS_REGION_SCOPE, region: { x: region.x, y: region.y, width: region.width, height: region.height },
        page: { ...base.page, ...image, textItems: [] } });
      readings.push({ region, openings: result.analysis?.openings || [] });
    } catch (error) {
      if (error?.hard) throw error;
      failures.push({ region: region.id, message: error?.message || 'The region could not be read.' });
    }
  }
  return { ...mergeRegionOpenings(readings, sheet), failures, requests: regions.length };
}
