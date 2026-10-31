// Quotation-side guard for AI Takeoff imports.
// createTakeoffSchedule converts every sheet with the job's single pixelsPerMm. When a measured
// sheet has its own, different calibration (or no calibration exists at all), the exported
// quantities are wrong for that sheet. Those quantities must not silently become Job Setup /
// quotation quantities, so the import is blocked until the takeoff is recalibrated.
// Upstream defect owner: AI Takeoff - createTakeoffSchedule ignores scheduleState.sheetCalibrations.

const MEASURED_ARRAYS = ["completedWallRuns", "placedOpenings", "completedFloorplans", "completedAreas", "completedEaves", "completedMeasurements", "completedPillars"];
const TOLERANCE = 0.005; // 0.5%

const pageOf = (item = {}) => Number(item.page ?? item.pageId ?? item.pageNumber) || 1;
const ownScale = (job, page) => {
  const own = job?.scheduleState?.sheetCalibrations?.[page];
  const value = Number(own?.pixelsPerMm ?? own);
  return value > 0 ? value : null;
};

export function takeoffCalibrationCheck(job = {}) {
  const measuredPages = [...new Set(MEASURED_ARRAYS.flatMap((key) => (Array.isArray(job?.[key]) ? job[key] : []).map(pageOf)))].sort((a, b) => a - b);
  if (!measuredPages.length) return { ok: true, measuredPages, problems: [] };
  const global = Number(job?.pixelsPerMm) > 0 ? Number(job.pixelsPerMm) : null;
  const problems = [];
  for (const page of measuredPages) {
    const own = ownScale(job, page);
    if (!global && !own) problems.push({ page, reason: "no calibration" });
    else if (own && global && Math.abs(own - global) / own > TOLERANCE) problems.push({ page, reason: `sheet calibrated at ${own} px/mm but exported at ${global} px/mm` });
    else if (own && !global) problems.push({ page, reason: `sheet calibrated at ${own} px/mm but the export has no job calibration` });
  }
  return {
    ok: problems.length === 0,
    measuredPages,
    problems,
    message: problems.length
      ? `Takeoff quantities cannot be imported: calibration does not match on ${problems.map((p) => `sheet ${p.page} (${p.reason})`).join("; ")}. Recalibrate in AI Plan Takeoff so every measured sheet uses one verified scale, then import again.`
      : "",
  };
}
