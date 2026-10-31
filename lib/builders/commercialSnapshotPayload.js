const MAX_REQUEST_BYTES = 22 * 1024 * 1024;
const LARGE_NON_QUOTATION_FIELDS = ['projectEstimateBuilder', 'aiPlanTakeoffJob', 'takeoffEngine'];

export function commercialSnapshotHasCompleteWorkbook(snapshot = null) {
  return snapshot?.workbook_metadata?.source_workbook_snapshot_complete !== false;
}

function byteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function commercialSnapshotPayload({ workspaceId, projectId = null, project, workbook, calculated } = {}) {
  if (!workbook || !calculated) throw new Error('A workbook and calculated quotation are required to sync a commercial snapshot.');
  const full = { workspace_id: workspaceId, commercial_project_id: projectId, project, workbook, calculated };
  if (byteLength(full) <= MAX_REQUEST_BYTES) return { body: full, omittedSections: [], completeWorkbookSnapshot: true };

  const compactWorkbook = { ...workbook };
  const omittedSections = [];
  for (const key of LARGE_NON_QUOTATION_FIELDS) {
    if (compactWorkbook[key] === undefined) continue;
    delete compactWorkbook[key];
    omittedSections.push(key);
  }
  const compactCalculated = {
    quotation: calculated.quotation || {},
    summary: calculated.summary || {},
    quantities: calculated.quantities || {},
  };
  const body = {
    workspace_id: workspaceId,
    commercial_project_id: projectId,
    project,
    workbook: compactWorkbook,
    calculated: compactCalculated,
    workbook_snapshot_omitted_sections: omittedSections,
  };
  if (byteLength(body) > MAX_REQUEST_BYTES) {
    throw new Error('This job contains more than 22 MB of quotation and selection data. Save remains local; use job storage settings to publish a shared copy before commercial sync.');
  }
  return { body, omittedSections, completeWorkbookSnapshot: false };
}