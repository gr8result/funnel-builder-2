// Each plan sheet has its own scale. A takeoff began with one calibration for every sheet
// (`pixelsPerMm`); sheets calibrated on their own are recorded in
// `sheetCalibrations: { [page]: { pixelsPerMm, calibratedAt } }`. Everything measured from a sheet's
// geometry - wall lengths, opening positions, floor areas - uses that sheet's scale.
//
// The scale of a sheet that was never calibrated on its own is the job scale. It is recorded as
// sheet 0 (`JOB_SCALE_KEY`) the first time any sheet is calibrated: the scale the takeoff already
// had, or that first calibration. Without that record it is the first sheet calibrated, or the
// takeoff's single `pixelsPerMm` where no sheet is recorded (every takeoff saved before sheets were).

const positive = (value) => (Number(value) > 0 ? Number(value) : null);
const own = (page, sheetCalibrations) => positive(sheetCalibrations?.[page]?.pixelsPerMm ?? sheetCalibrations?.[page]);

export const JOB_SCALE_KEY = 0;

export function jobPixelsPerMm(pixelsPerMm, sheetCalibrations = {}) {
  const stated = own(JOB_SCALE_KEY, sheetCalibrations);
  if (stated) return stated;
  const recorded = Object.values(sheetCalibrations || {}).map((entry) => ({ value: positive(entry?.pixelsPerMm ?? entry), at: String(entry?.calibratedAt || '') }))
    .filter((entry) => entry.value).sort((a, b) => a.at.localeCompare(b.at));
  return recorded[0]?.value || positive(pixelsPerMm);
}

export function sheetPixelsPerMm(page, pixelsPerMm, sheetCalibrations = {}) {
  return own(Number(page), sheetCalibrations) || jobPixelsPerMm(pixelsPerMm, sheetCalibrations);
}

export const sameSheetScale = (a, b) => positive(a) !== null && positive(b) !== null && Math.abs(a - b) <= Math.max(a, b) * 1e-6;

// True when at least one sheet's scale differs from the scale `pixelsPerMm` stands for.
export function hasMixedSheetScales(pixelsPerMm, sheetCalibrations = {}, pages = null) {
  const list = pages || Object.keys(sheetCalibrations || {}).filter((page) => Number(page) !== JOB_SCALE_KEY);
  return list.some((page) => { const scale = sheetPixelsPerMm(page, pixelsPerMm, sheetCalibrations); return scale && positive(pixelsPerMm) && !sameSheetScale(scale, pixelsPerMm); });
}

const POINT_LISTS = ['nodes', 'polygon'];
function scaleItem(item, factor) {
  const point = (value) => (value && Number.isFinite(value.x) && Number.isFinite(value.y) ? { ...value, x: value.x * factor, y: value.y * factor } : value);
  const next = { ...item };
  for (const key of POINT_LISTS) if (Array.isArray(item[key])) next[key] = item[key].map(point);
  if (Array.isArray(item.exclusions)) next.exclusions = item.exclusions.map((exclusion) => scaleItem(exclusion, factor));
  if (Number.isFinite(item.x) && Number.isFinite(item.y)) { next.x = item.x * factor; next.y = item.y * factor; }
  for (const key of ['start', 'end', 'p1', 'p2', 'position']) if (item[key] && typeof item[key] === 'object') next[key] = point(item[key]);
  return next;
}

/**
 * Geometry restated at one scale, for code that measures with a single `pixelsPerMm`. An item on a
 * sheet whose own scale differs has its coordinates multiplied so that dividing by `pixelsPerMm`
 * gives the true millimetres. Lengths already stored in millimetres are untouched. Items on sheets
 * at `pixelsPerMm` are returned as they are, so a takeoff with one scale is not changed at all.
 * Only for measuring: the result is never drawn or saved.
 */
export function toCommonScale(items = [], pixelsPerMm, sheetCalibrations = {}) {
  if (!Array.isArray(items) || !positive(pixelsPerMm)) return items;
  const recorded = Boolean(sheetCalibrations && Object.keys(sheetCalibrations).length);
  // Without the takeoff's calibration record, an item still knows its own sheet's scale (stampSheetScales).
  if (!recorded && !items.some((item) => positive(item?.sheetPixelsPerMm))) return items;
  let changed = false;
  const next = items.map((item) => {
    const page = Number(item?.page || item?.pageId || 1);
    const scale = recorded ? sheetPixelsPerMm(page, pixelsPerMm, sheetCalibrations) : positive(item?.sheetPixelsPerMm);
    if (!scale || sameSheetScale(scale, pixelsPerMm)) return item;
    changed = true;
    return { ...scaleItem(item, pixelsPerMm / scale), measuredAtSheetScale: scale };
  });
  return changed ? next : items;
}

/**
 * Each item on a sheet whose scale is not the one the takeoff is saved with (`pixelsPerMm`) marked
 * with its own sheet's scale, for whoever measures it without the takeoff's calibration record: a
 * module that is handed walls and openings and one `pixelsPerMm`. Done as the takeoff is saved.
 * Items at the saved scale carry no mark, so a takeoff whose sheets share one scale is saved
 * exactly as before.
 */
export function stampSheetScales(items = [], pixelsPerMm, sheetCalibrations = {}) {
  if (!Array.isArray(items) || !positive(pixelsPerMm) || !sheetCalibrations || !Object.keys(sheetCalibrations).length) return items;
  let changed = false;
  const next = items.map((item) => {
    const scale = sheetPixelsPerMm(Number(item?.page || item?.pageId || 1), pixelsPerMm, sheetCalibrations);
    const marked = positive(item?.sheetPixelsPerMm);
    if (!scale || sameSheetScale(scale, pixelsPerMm)) {
      if (!marked) return item;
      changed = true;
      const { sheetPixelsPerMm: stale, ...rest } = item;
      return rest;
    }
    if (marked && sameSheetScale(item.sheetPixelsPerMm, scale)) return item;
    changed = true;
    return { ...item, sheetPixelsPerMm: scale };
  });
  return changed ? next : items;
}

/**
 * Stored millimetre lengths of runs after a calibration changed. A run's length was worked out
 * from its points at its sheet's scale, so it follows that sheet's scale and no other:
 * `before` and `after` are (page) => pixelsPerMm.
 */
export function rescaleRunLengths(runs = [], before, after) {
  let changed = false;
  const next = runs.map((run) => {
    const page = Number(run?.page || 1), was = positive(before(page)), now = positive(after(page));
    if (!(Number(run?.lengthMm) > 0) || !was || !now || sameSheetScale(was, now)) return run;
    changed = true;
    return { ...run, lengthMm: run.lengthMm * was / now };
  });
  return changed ? next : runs;
}
