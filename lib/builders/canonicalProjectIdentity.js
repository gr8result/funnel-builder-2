// Job identity has two separate concepts, and conflating them is what broke saving.
//
//   Display identity   "New Job 03-09", "recovered-03-09-123", the job filename.
//                      Human-readable, may change, never goes near the database.
//
//   Canonical identity One uuid per job, stored in the job file's own metadata.
//                      This is the only value allowed in builder_commercial_projects.id,
//                      builder_client_selections.project_id, builder_selection_books.project_id
//                      and every other project-scoped uuid column.
//
// A recovered job previously had its display id pushed straight into those uuid columns,
// which Postgres rejected with 22P02 on every write. The canonical uuid below is minted
// once, written back into the job file, and reused for the life of the job.

export const CANONICAL_PROJECT_UUID_FIELD = "canonicalProjectUuid";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return UUID_RE.test(String(value || "").trim());
}

export function newProjectUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  // Deterministic-shape v4 fallback for environments without webcrypto.
  const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${["8", "9", "a", "b"][Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`;
}

// Reads the canonical uuid from wherever a job file may legitimately carry it. Order
// matters: the explicit metadata field wins, then a display id that already is a uuid
// (a normal cloud-backed job), then legacy fields written by earlier versions.
export function canonicalProjectUuid(workbook = {}) {
  const meta = workbook?.jobFileMeta || {};
  const candidates = [
    meta[CANONICAL_PROJECT_UUID_FIELD],
    workbook?.[CANONICAL_PROJECT_UUID_FIELD],
    meta.commercialProjectUuid,
    workbook?.commercialProjectId,
    workbook?.projectId,
    meta.projectId,
    workbook?.registeredJob?.jobId,
  ];
  for (const candidate of candidates) if (isUuid(candidate)) return String(candidate).trim();
  return null;
}

// Writes the uuid into the job file metadata without disturbing display identity.
// The display id (name, recovered-… string, filename) is deliberately left alone.
export function withCanonicalProjectUuid(workbook = {}, uuid = "") {
  if (!isUuid(uuid)) throw new Error("A canonical project id must be a uuid.");
  return {
    ...workbook,
    [CANONICAL_PROJECT_UUID_FIELD]: uuid,
    jobFileMeta: {
      ...(workbook.jobFileMeta || {}),
      [CANONICAL_PROJECT_UUID_FIELD]: uuid,
      canonicalProjectLinkedAt: (workbook.jobFileMeta || {}).canonicalProjectLinkedAt || new Date().toISOString(),
    },
  };
}

// Stable facts used to recognise a job that already has a project row, so a re-link
// cannot create a duplicate. Normalised so casing and spacing never cause a miss.
export function jobMatchKeys(workbook = {}) {
  const meta = workbook?.jobFileMeta || {};
  const registered = workbook?.registeredJob || {};
  const text = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  return {
    jobNumber: text(registered.jobNumber || meta.jobNumber),
    jobName: text(registered.jobName || meta.jobName || workbook?.projectName),
    address: text(registered.siteAddress || meta.siteAddress || meta.address),
    displayProjectId: text(meta.projectId || workbook?.projectId),
    sourceProjectId: text(meta.sourceProjectId),
  };
}

function rowMatchKeys(row = {}) {
  const text = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  return {
    jobNumber: text(row.job_number || row.jobNumber),
    jobName: text(row.project_name || row.projectName),
    address: text(row.site_address || row.siteAddress || row.address),
    displayProjectId: text(row.source_project_id || row.metadata?.sourceProjectId || row.external_reference),
  };
}

// Ranked match. Job number within a workspace is the strongest signal a builder has;
// a name-only match is reported but never auto-linked, because two jobs can share a name.
export function findExistingProjectRow(workbook = {}, rows = []) {
  const keys = jobMatchKeys(workbook);
  const candidates = (Array.isArray(rows) ? rows : []).filter((row) => isUuid(row?.id));

  for (const row of candidates) {
    const rowKeys = rowMatchKeys(row);
    if (keys.displayProjectId && rowKeys.displayProjectId && keys.displayProjectId === rowKeys.displayProjectId) {
      return { row, basis: "stored source project id", confidence: "exact" };
    }
  }
  for (const row of candidates) {
    const rowKeys = rowMatchKeys(row);
    if (keys.jobNumber && rowKeys.jobNumber && keys.jobNumber === rowKeys.jobNumber) {
      return { row, basis: "job number within workspace", confidence: "exact" };
    }
  }
  for (const row of candidates) {
    const rowKeys = rowMatchKeys(row);
    if (keys.jobName && rowKeys.jobName && keys.jobName === rowKeys.jobName
      && keys.address && rowKeys.address && keys.address === rowKeys.address) {
      return { row, basis: "job name and site address", confidence: "exact" };
    }
  }
  for (const row of candidates) {
    const rowKeys = rowMatchKeys(row);
    if (keys.jobName && rowKeys.jobName && keys.jobName === rowKeys.jobName) {
      return { row, basis: "job name only", confidence: "weak" };
    }
  }
  return null;
}

// The whole decision, with no side effects. Callers render this for approval and only
// then execute it. Nothing here touches the network or the job file.
export function projectIdentityPlan(workbook = {}, { workspaceId = "", existingProjects = [] } = {}) {
  const existingUuid = canonicalProjectUuid(workbook);
  if (existingUuid) {
    return { action: "use-existing", uuid: existingUuid, reason: "job already carries a canonical project uuid", writeRequired: false };
  }

  const match = findExistingProjectRow(workbook, existingProjects);
  if (match && match.confidence === "exact") {
    return {
      action: "link",
      uuid: match.row.id,
      matchedRow: match.row,
      matchBasis: match.basis,
      reason: `an existing project row matches on ${match.basis}`,
      writeRequired: false,
      jobFileUpdateRequired: true,
    };
  }

  const keys = jobMatchKeys(workbook);
  return {
    action: "create",
    uuid: null,
    weakMatch: match || null,
    reason: match ? `only a weak match was found (${match.basis}); creating would be safer than linking` : "no existing project row matches this job",
    writeRequired: true,
    jobFileUpdateRequired: true,
    proposedRow: {
      id: "<minted at execution time>",
      workspace_id: workspaceId,
      project_name: keys.jobName || "Untitled job",
      job_number: keys.jobNumber || null,
      site_address: keys.address || null,
      source_project_id: keys.displayProjectId || null,
    },
  };
}
