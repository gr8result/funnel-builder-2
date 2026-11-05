// Validate the calibration used by each source sheet and by the exported schedule.
// Mixed scales need export evidence; legacy single-scale payloads remain supported.
const MEASURED_ARRAYS = ['completedWallRuns', 'placedOpenings', 'completedFloorplans', 'completedAreas', 'completedEaves', 'completedMeasurements', 'completedPillars'];
const TOLERANCE = 0.005;
const positive = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const valueOf = entry => entry?.pixelsPerMm ?? entry;
const agrees = (a, b) => positive(a) && positive(b) && Math.abs(a - b) / b <= TOLERANCE;
const pageOf = item => Number(item.page ?? item.pageId ?? item.pageNumber ?? item.sourcePage ?? 1);

export function takeoffCalibrationCheck(job = {}, schedule = null) {
  const items = MEASURED_ARRAYS.flatMap(key => (Array.isArray(job[key]) ? job[key] : []).map(item => ({ ...item, collection: key })))
    .concat((job.scheduleState?.aiAnalysis?.rooms || []).filter(room => room.actions?.length && !room.reviewRequired));
  const measuredPages = [...new Set(items.map(pageOf))].sort((a, b) => a - b);
  const records = job.scheduleState?.sheetCalibrations || {};
  const global = positive(job.pixelsPerMm);
  const base = Object.hasOwn(records, 0) ? positive(valueOf(records[0])) : global;
  const scaleFor = page => Object.hasOwn(records, page) ? positive(valueOf(records[page])) : base;
  const problems = [];
  const add = (page, reason) => { if (!problems.some(p => p.page === page && p.reason === reason)) problems.push({ page, reason }); };
  const exported = schedule?.project?.calibratedScaleBySheet;
  for (const page of measuredPages) {
    const scale = scaleFor(page);
    if (!Number.isInteger(page) || page < 1) { add(page, 'measurement has no valid source sheet'); continue; }
    if (!scale) { add(page, 'no calibration or invalid calibration for this sheet'); continue; }
    if (!global) add(page, 'the export has no valid working calibration');
    const exportScale = exported?.find(entry => Number(entry.page) === page)?.pixelsPerMm ?? (exported ? null : global);
    if (!agrees(exportScale, scale)) add(page, 'exported calibration does not match the source sheet');
  }
  for (const item of items) {
    const page = pageOf(item), scale = scaleFor(page);
    if (!scale) continue;
    if (item.lengthMm != null && (!Number.isFinite(Number(item.lengthMm)) || Number(item.lengthMm) < 0)) {
      add(page, 'stored run length is invalid');
    }
    for (const key of ['sheetPixelsPerMm', 'pixelsPerMm']) {
      if (item[key] != null && !agrees(item[key], scale)) add(page, 'measurement calibration does not match its source sheet');
    }
    if (['completedWallRuns', 'completedEaves'].includes(item.collection) && item.nodes?.length >= 2 && positive(item.lengthMm)) {
      const lengthPx = item.nodes.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - item.nodes[i].x, point.y - item.nodes[i].y), 0);
      if (!agrees(item.lengthMm, lengthPx / scale)) add(page, 'stored run length is inconsistent with its calibrated geometry');
    }
  }
  for (const record of schedule?.measurementRecords || []) {
    const page = pageOf(record), scale = scaleFor(page);
    if (!scale) { add(page, 'exported measurement has no source-sheet calibration'); continue; }
    if (record.quantity != null && (!Number.isFinite(Number(record.quantity)) || Number(record.quantity) < 0)) {
      add(page, 'exported measurement quantity is invalid');
    }
    if (!agrees(scale, global) && !agrees(record.measuredAtSheetScale ?? record.pixelsPerMm, scale)) {
      add(page, 'exported measurement has no matching per-sheet calibration evidence');
    }
  }
  return { ok: problems.length === 0, measuredPages, problems,
    message: problems.length ? 'Takeoff quantities cannot be imported: ' + problems.map(p => 'sheet ' + p.page + ' (' + p.reason + ')').join('; ') + '. Check the affected sheet calibration and regenerate its quantities in AI Plan Takeoff.' : '' };
}
