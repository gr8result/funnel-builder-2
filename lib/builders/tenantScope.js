// workspace_id is the existing tenant identity. Other spellings are adapters only.
export function workspaceIdOf(record = {}) {
  const ids = [record.workspace_id, record.workspaceId, record.tenantId, record.builderId, record.organisationId]
    .filter(Boolean).map(String);
  if (new Set(ids).size > 1) throw new Error('Conflicting workspace identities.');
  return ids[0] || '';
}

export function requireWorkspaceId(value) {
  const id = typeof value === 'object' ? workspaceIdOf(value) : String(value || '').trim();
  if (!id) throw new Error('A builder workspace is required.');
  return id;
}

export function assertWorkspaceRecord(workspaceId, record) {
  if (workspaceIdOf(record) !== requireWorkspaceId(workspaceId)) {
    const error = new Error('Record does not belong to this builder workspace.');
    error.statusCode = 403;
    throw error;
  }
  return record;
}

export function tenantStorageKey(base, workspaceId) {
  return `${base}:workspace:${encodeURIComponent(requireWorkspaceId(workspaceId))}`;
}

export function workbookWorkspaceId(workbook = {}) {
  return workspaceIdOf({ workspaceId: workspaceIdOf(workbook), workspace_id: workbook.registeredJob?.workspaceId || workbook.jobFileMeta?.workspaceId });
}

// Importing an unowned legacy file is explicit; never claim it during an automatic read.
export function adoptLegacyWorkbook(workbook, workspaceId) {
  const owner = workbookWorkspaceId(workbook);
  if (owner && owner !== requireWorkspaceId(workspaceId)) throw new Error('This job belongs to another builder workspace.');
  return { ...workbook, workspaceId: requireWorkspaceId(workspaceId) };
}
