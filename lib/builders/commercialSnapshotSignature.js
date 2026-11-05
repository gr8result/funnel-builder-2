import { createHash } from 'node:crypto';

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

export function commercialSnapshotSignature({ workspaceId, projectId, jobId, workbook, calculated } = {}) {
  if (!workspaceId || !projectId || !jobId) {
    throw new Error('A workspace, commercial project and Estimate Builder job are required to identify a snapshot.');
  }

  const identity = {
    workspaceId: String(workspaceId),
    projectId: String(projectId),
    jobId: String(jobId),
    registeredJobId: String(workbook?.registeredJobId || workbook?.registeredJob?.jobId || ''),
    workbook: {
      quotation: workbook?.quotation || {},
      quotationSectionOrder: workbook?.quotationSectionOrder || [],
      clientSelectionsBook: workbook?.clientSelectionsBook || null,
      procurement: workbook?.procurement || null,
      jobInclusionSnapshot: workbook?.jobInclusionSnapshot || null,
      summaryAdjustments: workbook?.summaryAdjustments || null,
    },
    calculated: {
      quotation: calculated?.quotation || {},
      summary: calculated?.summary || {},
    },
  };
  return createHash('sha256').update(JSON.stringify(stableValue(identity))).digest('hex');
}