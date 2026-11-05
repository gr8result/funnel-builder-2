export function withCommercialSnapshotAssociation(workbook, { workspaceId, jobId, projectId, snapshotId } = {}) {
  if (!workbook || typeof workbook !== 'object' || Array.isArray(workbook)) {
    throw new Error('The active Estimate Builder job is unavailable.');
  }
  if (!workspaceId || !jobId || !projectId || !snapshotId) {
    throw new Error('The workspace, job, commercial project and snapshot IDs are all required.');
  }
  if (String(workbook.jobId || '') !== String(jobId)) {
    throw new Error('The active job changed while its commercial snapshot was syncing. Reopen the intended job and sync again.');
  }
  const workbookWorkspaceId = String(workbook.workspaceId || workbook.workspace_id || '');
  if (workbookWorkspaceId && workbookWorkspaceId !== String(workspaceId)) {
    throw new Error('The active job belongs to a different builder workspace.');
  }

  return {
    ...workbook,
    workspaceId: String(workspaceId),
    commercialProjectId: String(projectId),
    commercialSnapshotId: String(snapshotId),
  };
}

export function assertCommercialProjectAssociation(project, { workspaceId, jobId, registeredJobId } = {}) {
  const workbookMatch = project?.source_workbook_job_id && project.source_workbook_job_id === jobId;
  const registeredMatch = !project?.source_workbook_job_id
    && registeredJobId
    && project?.source_registered_job_id === registeredJobId;
  if (project?.workspace_id !== workspaceId || (!workbookMatch && !registeredMatch)
    || (registeredJobId && project.source_registered_job_id && project.source_registered_job_id !== registeredJobId)) {
    throw new Error('The requested commercial project is already associated with a different builder job. No project or snapshot was changed.');
  }
  return project;
}