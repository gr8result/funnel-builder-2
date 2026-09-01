import { JobFileData, JobFileHandle, JobFileResult, saveJob } from "./jobFile";

export type MasterJobSectionName =
  | "job-details"
  | "estimate"
  | "takeoff"
  | "client-selections"
  | "quotation"
  | "boq"
  | "procurement"
  | "variations"
  | "project-documents"
  | "assets";

export type MasterProjectStoreState = {
  masterJob: JobFileData;
  currentHandle: JobFileHandle;
  dirtySections: MasterJobSectionName[];
};

const SECTION_NAMES = new Set<MasterJobSectionName>([
  "job-details",
  "estimate",
  "takeoff",
  "client-selections",
  "quotation",
  "boq",
  "procurement",
  "variations",
  "project-documents",
  "assets",
]);

export function updateMasterJobSection(
  masterJob: JobFileData,
  sectionName: MasterJobSectionName,
  updatedSection: Record<string, unknown>
): JobFileData {
  if (!SECTION_NAMES.has(sectionName)) {
    throw new Error(`Unsupported master job section: ${sectionName}`);
  }
  return {
    ...masterJob,
    [sectionName]: {
      ...((masterJob[sectionName] && typeof masterJob[sectionName] === "object" ? masterJob[sectionName] : {}) as Record<string, unknown>),
      ...(updatedSection || {}),
    },
    lastModified: new Date().toISOString(),
  };
}

export function markMasterJobSectionDirty(
  dirtySections: MasterJobSectionName[],
  sectionName: MasterJobSectionName
): MasterJobSectionName[] {
  return dirtySections.includes(sectionName) ? dirtySections : [...dirtySections, sectionName];
}

export async function saveMasterJob(
  state: MasterProjectStoreState
): Promise<JobFileResult & { dirtySections: MasterJobSectionName[] }> {
  const result = await saveJob(state.masterJob, state.currentHandle);
  return {
    ...result,
    dirtySections: result.ok && !result.cancelled ? [] : state.dirtySections,
  };
}
