// The issued commercial snapshot needs the job details, data inputs, procurement list and quotation.
// These sections are presentation and drawing data (Project Estimate page artwork and the AI takeoff
// drawings) - on a real job ~108 MB of a ~119 MB workbook - and would push the request far past the
// API's 25 MB limit. They stay in the saved job; the snapshot records that they were left out.
// Field names match the Client Selections release (workbook_snapshot_omitted_sections).
export const SNAPSHOT_OMITTED_SECTIONS = Object.freeze(["projectEstimateBuilder", "aiPlanTakeoffJob", "takeoffEngine"]);

export function commercialSnapshotWorkbook(workbook = {}) {
  const trimmed = { ...workbook };
  const omitted = [];
  for (const key of SNAPSHOT_OMITTED_SECTIONS) {
    if (trimmed[key] !== undefined && trimmed[key] !== null) {
      omitted.push(key);
      delete trimmed[key];
    }
  }
  return { workbook: trimmed, omittedSections: omitted };
}
