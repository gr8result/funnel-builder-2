import { createJobSetupWindowSchedule } from '../../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';

// The canonical building-level order Job Setup uses (see IMPORT_LEVELS in takeoffSchedule.js).
// Any level not in this list (a future storey, or an unassigned sheet label) sorts after these,
// in the order it is first encountered, rather than being silently dropped or reordered.
export const WINDOW_SCHEDULE_LEVEL_ORDER = ['Ground Floor', 'Second Level', 'Third Level'];

export function windowScheduleLevelSortIndex(level) {
  const index = WINDOW_SCHEDULE_LEVEL_ORDER.indexOf(level);
  return index === -1 ? WINDOW_SCHEDULE_LEVEL_ORDER.length : index;
}

// Canonical rows are already one-per-opening, so unlike a bucketing/grouping step this only
// orders them (Ground Floor, then Second Level, then any other canonical level in the order it
// appears) - it never merges rows, which would silently lose distinct physical openings.
export function sortWindowScheduleItemsByLevel(items = []) {
  return items.slice().sort((left, right) => {
    const levelDiff = windowScheduleLevelSortIndex(left.floor) - windowScheduleLevelSortIndex(right.floor);
    if (levelDiff) return levelDiff;
    return `${left.windowCode || ''}-${left.id}`.localeCompare(`${right.windowCode || ''}-${right.id}`);
  });
}

// Reshapes one createJobSetupWindowSchedule row into the item shape Client Selections' windows
// workflow (Supplier / Project Defaults / Individual Windows / Review) already expects (id, type,
// floor, widthMm/heightMm, quantity, ...). Nothing here recomputes a dimension, quantity, area,
// level or wall system - every value is copied straight from the canonical row.
export function canonicalJobSetupWindowItem(row = {}, index = 0) {
  const widthMm = Number(row.widthMm) || 0;
  const heightMm = Number(row.heightMm) || 0;
  const quantity = Number(row.quantity) || 0;
  const stableOpeningId = row.itemId || `window-${index + 1}`;
  return {
    id: stableOpeningId,
    stableOpeningId,
    sourceOpeningIds: [stableOpeningId],
    itemId: stableOpeningId,
    type: row.openingType || 'Window',
    windowCode: row.windowCode || '',
    // Room/Location comes straight from the opening's own "Location / room" field in AI Plan
    // Takeoff (threaded through createJobSetupWindowSchedule). '' means the estimator has not
    // filled it in for this specific opening yet - never rewritten to a fabricated "Unspecified".
    location: row.location || row.room || '',
    room: row.room || row.location || '',
    // The real "Window Type" style AI Plan Takeoff's editor assigns (opening.subType, e.g. Fixed/
    // Awning/Double Hung), and whether that style is Fixed Glass - never guessed from array
    // position or a Client Selections-invented classification.
    openingStyle: row.openingStyle || '',
    isFixed: Boolean(row.isFixed),
    floor: row.level || 'Unspecified',
    elevation: row.elevation || '',
    width: widthMm ? `${widthMm} mm` : 'As documented',
    height: heightMm ? `${heightMm} mm` : 'As documented',
    widthMm,
    heightMm,
    quantity,
    size: widthMm && heightMm ? `${widthMm} x ${heightMm}` : 'As documented',
    areaM2: Number(row.openingAreaM2) || 0,
    wallSystem: row.wallSystem || '',
    // The fuller wall-system reference (frame thickness + cladding/finish product) behind
    // wallSystem's short label - carried straight through from the takeoff's wall record so it
    // stays available even though Client Selections' own UI only surfaces wallSystem today.
    wallSystemDetail: row.wallSystemDetail || '',
    wallFrameThicknessMm: row.wallFrameThicknessMm ?? null,
    wallExteriorFinish: row.wallExteriorFinish || '',
    wallId: row.wallId || '',
    brickSillApplies: row.brickSillApplies || 'No',
    brickSillLm: Number(row.brickSillLm) || 0,
    glazing: '',
    glass: '',
    // The documented/canonical Glass Type from AI Plan Takeoff's own "Glass Type" field on the
    // opening. '' means the estimator has not documented one for this opening yet - never a
    // fabricated "Unspecified" or "Clear". Distinct from the client's selected supplier glass
    // PRODUCT (effectiveWindowRows' own glass/glassClass fields).
    glassType: row.glassType || '',
    obscureRequirement: 'Not specified',
    takeoffNotes: '',
    notes: '',
    planReference: row.windowCode || stableOpeningId,
  };
}

// The single canonical projection: rebuilds the exact same Job Setup Window Schedule
// (createJobSetupWindowSchedule) from a saved AI Plan Takeoff job's inputs, filters it to the
// window rows, and reshapes them into Client Selections' item shape - without bucketing multiple
// physical openings into one row and without inventing a synthetic id. Returns null when there is
// nothing to project (no placed openings, or no external windows measured yet) so a caller can
// fall back to a legacy source for jobs saved before a takeoff was attached.
export function canonicalWindowScheduleFromTakeoffJob({ completedWallRuns = [], placedOpenings = [], pixelsPerMm, sheetLevels = {}, jobSetupRows = {} } = {}) {
  if (!Array.isArray(placedOpenings) || !placedOpenings.length) return null;
  const schedule = createJobSetupWindowSchedule({ completedWallRuns, placedOpenings, pixelsPerMm, sheetLevels, jobSetupRows });
  const windowRows = (schedule.rows || []).filter((row) => row.openingType === 'Window');
  if (!windowRows.length) return null;
  const items = sortWindowScheduleItemsByLevel(
    windowRows.map((row, index) => canonicalJobSetupWindowItem(row, index)).filter((item) => item.quantity > 0)
  );
  return { rows: windowRows, items };
}
