// A module workspace belongs to a saved master job. Display names and filenames
// never establish ownership; legacy project IDs are aliases only when explicitly
// recorded on that master job.
export function masterJobId(workbook = {}) {
  return String(workbook.jobId || workbook.registeredJob?.jobId || "").trim();
}

export function masterJobAliases(workbook = {}) {
  return [...new Set([
    masterJobId(workbook), workbook.projectId, workbook.commercialProjectId,
    workbook.registeredJob?.jobId, workbook.registeredJob?.projectId,
    workbook.registeredJobId, workbook.jobFileMeta?.projectId,
  ].map(value => String(value || "").trim()).filter(Boolean))];
}

export function takeoffMasterJobId(takeoff = {}) {
  return String(takeoff.masterJobId || takeoff.jobId || "").trim();
}

export function linkTakeoffToMasterJob(workbook, takeoff = {}, { storedInMaster = false, importLegacy = false } = {}) {
  const jobId = masterJobId(workbook);
  if (!jobId) throw new Error("Create or open a master job before using AI Plan Takeoff.");
  const owner = takeoffMasterJobId(takeoff);
  if (owner && owner !== jobId && (takeoff.masterJobId || (!storedInMaster && !importLegacy))) {
    throw new Error("This takeoff belongs to a different master job.");
  }
  const legacyOwner = String(takeoff.associatedProjectId || takeoff.platformProject?.projectId || "").trim();
  if (!owner && legacyOwner && !storedInMaster && !importLegacy && !masterJobAliases(workbook).includes(legacyOwner)) {
    throw new Error("This legacy takeoff is not linked to the open master job. Import its backup explicitly to link it.");
  }
  const rows = workbook.data?.inputDataSheet?.rows || {};
  const name = rows.projectName?.value || workbook.registeredJob?.jobName || workbook.jobFileMeta?.jobName || "Untitled job";
  return {
    ...takeoff,
    jobId,
    masterJobId: jobId,
    takeoffId: takeoff.takeoffId || `takeoff:${jobId}`,
    jobName: name,
    takeoffName: takeoff.takeoffName || name,
    associatedProjectId: jobId,
    associatedProjectName: name,
    openedWithoutAttaching: false,
    platformProject: { ...(takeoff.platformProject || {}), projectId: jobId, projectName: name },
    projectInfo: {
      ...(takeoff.projectInfo || {}),
      projectName: name,
      clientName: rows.clientName?.value || workbook.registeredJob?.clientName || takeoff.projectInfo?.clientName || "",
      siteAddress: rows.siteAddress?.value || rows.projectAddress?.value || workbook.registeredJob?.siteAddress || takeoff.projectInfo?.siteAddress || "",
    },
  };
}

export function mergeMasterJobSummaries(localJobs = [], platformJobs = []) {
  const localKeys = new Set(localJobs.map(job => job.key));
  const localIds = new Set(localJobs.map(job => job.jobId).filter(Boolean));
  const jobs = [...localJobs, ...platformJobs.filter(job => !localKeys.has(job.localJobKey) && !localIds.has(job.jobId))];
  return jobs.sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
}

export function findMasterJobForProject(project = {}, localJobs = []) {
  return localJobs.find(job => project.source_workbook_job_id && job.jobId === project.source_workbook_job_id)
    || localJobs.find(job => (project.id && job.projectId === project.id)
      || (project.source_registered_job_id && job.jobId === project.source_registered_job_id))
    || null;
}
