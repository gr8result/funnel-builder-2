import JSZip from "jszip";

export const JOB_FILE_EXTENSION = ".gr8job";
export const JOB_FILE_MIME = "application/zip";
const LEGACY_JOB_FILE_MIME = "application/json";
const MASTER_JOB_FORMAT_NAME = "GR8 Master Job Package";
const MASTER_JOB_SCHEMA_VERSION = "gr8job.package.v1";
const MASTER_JOB_PACKAGE_VERSION = 3;
const BACKUP_VERSION_LIMIT = 5;
const MODULE_SECTION_KEYS = {
  jobSetup: "job-details",
  takeoff: "takeoff",
  estimate: "estimate",
  clientSelections: "client-selections",
  quotation: "quotation",
  boq: "boq",
  procurement: "procurement",
  gantt: "takeoff",
  jobBoard: "procurement",
  variations: "variations",
  documents: "project-documents",
} as const;

type FilePickerAcceptType = {
  description?: string;
  accept: Record<string, string[]>;
};

type FilePickerWindow = Window & typeof globalThis & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: FilePickerAcceptType[];
    excludeAcceptAllOption?: boolean;
  }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: FilePickerAcceptType[];
    excludeAcceptAllOption?: boolean;
  }) => Promise<FileSystemFileHandle>;
};

export type JobFileData = {
  type?: string;
  schemaVersion?: string;
  packageVersion?: number;
  masterRevision?: number;
  manifest?: Record<string, unknown>;
  jobId?: string;
  projectDetails?: Record<string, unknown>;
  moduleData?: Record<string, unknown>;
  moduleMetadata?: Record<string, unknown>;
  updatedAt?: string;
  jobName: string;
  clientName: string;
  jobNumber: string;
  address: string;
  notes: string;
  rooms: unknown[];
  products: unknown[];
  pricing: Record<string, unknown>;
  created: string;
  lastModified: string;
  projectEstimate?: unknown;
  selectionSchedule?: unknown;
  schedule?: unknown;
  packageAudit?: Record<string, unknown>;
  recovery?: Record<string, unknown>;
  "job-details"?: Record<string, unknown>;
  estimate?: Record<string, unknown>;
  takeoff?: Record<string, unknown>;
  "client-selections"?: Record<string, unknown>;
  quotation?: Record<string, unknown>;
  boq?: Record<string, unknown>;
  procurement?: Record<string, unknown>;
  variations?: Record<string, unknown>;
  "project-documents"?: Record<string, unknown>;
  assets?: Record<string, unknown>;
  workbook?: Record<string, unknown>;
};

export type JobFileHandle = FileSystemFileHandle | null;

export type JobFileResult = {
  ok: boolean;
  cancelled?: boolean;
  message?: string;
  handle?: JobFileHandle;
  fileName?: string;
  data?: JobFileData;
  storageLocation?: "computer-file" | "download";
};

const JOB_FILE_TYPES: FilePickerAcceptType[] = [
  {
    description: "GR8 Job Files",
    accept: {
      [JOB_FILE_MIME]: [JOB_FILE_EXTENSION],
      [LEGACY_JOB_FILE_MIME]: [JOB_FILE_EXTENSION],
      "application/octet-stream": [JOB_FILE_EXTENSION],
    },
  },
];

export function supportsFileSystemAccess(): boolean {
  if (typeof window === "undefined") return false;
  const fileWindow = window as FilePickerWindow;
  return typeof fileWindow.showOpenFilePicker === "function" && typeof fileWindow.showSaveFilePicker === "function";
}

function slugFileName(name: string): string {
  const cleaned = String(name || "Job")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ");
  return cleaned || "Job";
}

/**
 * JobFileData has no persistent unique id (see the JobFileData type above) — the
 * file itself, identified by name, is the closest stable identity a job has.
 * Slugified so it is safe to use as a storage key.
 */
export function deriveJobId(fileName: string): string | null {
  const trimmed = String(fileName || "").trim();
  if (!trimmed) return null;
  const withoutExtension = trimmed.replace(/\.gr8job$/i, "");
  const slug = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
}

function normalizeJobData(input: Partial<JobFileData> = {}): JobFileData {
  const now = new Date().toISOString();
  const workbook = extractWorkbookFromJobPackage(input);
  const inputModuleData = asRecord(input.moduleData) || {};
  const inputModuleMetadata = asRecord(input.moduleMetadata) || {};
  const workbookMeta = workbook && typeof workbook.jobFileMeta === "object" ? workbook.jobFileMeta as Record<string, unknown> : {};
  const workbookClientPage = workbook && typeof workbook.clientPage === "object" ? workbook.clientPage as Record<string, unknown> : {};
  const jobDetailsSection = asRecord(input["job-details"]) || asRecord(input.projectDetails) || asRecord(inputModuleData.jobSetup) || {};
  const estimateSection = asRecord(input.estimate) || asRecord(inputModuleData.estimate) || {};
  const clientSelectionsSection = asRecord(input["client-selections"]) || asRecord(inputModuleData.clientSelections) || {};
  const takeoffSection = asRecord(input.takeoff) || asRecord(inputModuleData.takeoff) || {};
  const quotationSection = asRecord(input.quotation) || asRecord(inputModuleData.quotation) || {};
  const base = {
    ...input,
    jobName: String(input.jobName || jobDetailsSection.jobName || jobDetailsSection.projectName || workbookMeta.jobName || valueFromWorkbook(workbook, "projectName") || (workbook as Record<string, unknown> | undefined)?.projectName || ""),
    clientName: String(input.clientName || jobDetailsSection.clientName || workbookMeta.clientName || valueFromWorkbook(workbook, "clientName") || valueFromWorkbook(workbook, "customerName") || workbookClientPage.clientName || ""),
    jobNumber: String(input.jobNumber || jobDetailsSection.jobNumber || workbookMeta.jobNumber || valueFromWorkbook(workbook, "jobNumber") || valueFromWorkbook(workbook, "quoteNumber") || workbookClientPage.quoteNumber || ""),
    address: String(input.address || jobDetailsSection.address || jobDetailsSection.siteAddress || workbookMeta.address || valueFromWorkbook(workbook, "projectAddress") || valueFromWorkbook(workbook, "siteAddress") || valueFromWorkbook(workbook, "address") || workbookClientPage.projectAddress || ""),
    notes: String(input.notes || jobDetailsSection.notes || ""),
    rooms: Array.isArray(input.rooms) ? input.rooms : [],
    products: Array.isArray(input.products) ? input.products : [],
    pricing: input.pricing && typeof input.pricing === "object" ? input.pricing : {},
    created: String(input.created || now),
    lastModified: String(input.lastModified || input.updatedAt || now),
    type: "gr8-master-job-package",
    schemaVersion: MASTER_JOB_SCHEMA_VERSION,
    packageVersion: MASTER_JOB_PACKAGE_VERSION,
    masterRevision: Number(input.masterRevision || input.manifest?.revision || 0) || 0,
    projectEstimate: estimateSection.projectEstimate ?? estimateSection.projectEstimateBuilder ?? input.projectEstimate ?? (workbook as Record<string, unknown> | undefined)?.projectEstimateBuilder ?? ((workbook as Record<string, unknown> | undefined)?.clientPage as Record<string, unknown> | undefined)?.proposalBuilder,
    selectionSchedule: clientSelectionsSection.book ?? clientSelectionsSection.selectionSchedule ?? input.selectionSchedule ?? (workbook as Record<string, unknown> | undefined)?.clientSelectionsBook ?? (workbook as Record<string, unknown> | undefined)?.selectionSchedule,
    schedule: takeoffSection.schedule ?? input.schedule ?? (workbook as Record<string, unknown> | undefined)?.gantt ?? (workbook as Record<string, unknown> | undefined)?.projectSchedule ?? (workbook as Record<string, unknown> | undefined)?.ganttTasks,
    packageAudit: input.packageAudit && typeof input.packageAudit === "object" ? input.packageAudit : {},
    workbook,
  };
  const sections = buildMasterJobSections(base, {
    jobDetailsSection,
    estimateSection,
    takeoffSection,
    clientSelectionsSection,
    quotationSection,
    input,
  });
  const jobId = String(sections.jobDetails.projectId || canonicalProjectId({ ...base, "job-details": sections.jobDetails })).trim();
  const manifestBase = { ...base, jobId, projectDetails: sections.jobDetails };
  return {
    ...base,
    jobId,
    projectDetails: sections.jobDetails,
    moduleData: buildModuleData(sections, inputModuleData),
    moduleMetadata: buildModuleMetadata(sections, inputModuleMetadata, base.lastModified),
    updatedAt: base.lastModified,
    manifest: buildMasterJobManifest(manifestBase, sections),
    "job-details": sections.jobDetails,
    estimate: sections.estimate,
    takeoff: sections.takeoff,
    "client-selections": sections.clientSelections,
    quotation: sections.quotation,
    boq: sections.boq,
    procurement: sections.procurement,
    variations: sections.variations,
    "project-documents": sections.projectDocuments,
    assets: sections.assets,
  };
}

function extractWorkbookFromJobPackage(input: Partial<JobFileData> = {}): Record<string, unknown> | undefined {
  if (input.workbook && typeof input.workbook === "object") return input.workbook as Record<string, unknown>;
  if (input.estimate?.workbook && typeof input.estimate.workbook === "object") return input.estimate.workbook as Record<string, unknown>;
  const estimatedWorkbook = input.estimate && typeof input.estimate === "object" ? input.estimate : null;
  if (estimatedWorkbook && (estimatedWorkbook.quotation || estimatedWorkbook.data || estimatedWorkbook.clientPage)) return estimatedWorkbook;
  return undefined;
}

function buildMasterJobSections(
  base: JobFileData,
  context: {
    jobDetailsSection: Record<string, unknown>;
    estimateSection: Record<string, unknown>;
    takeoffSection: Record<string, unknown>;
    clientSelectionsSection: Record<string, unknown>;
    quotationSection: Record<string, unknown>;
    input: Partial<JobFileData>;
  }
) {
  const workbook = base.workbook || {};
  const input = context.input;
  return {
    jobDetails: {
      ...context.jobDetailsSection,
      jobName: base.jobName,
      clientName: base.clientName,
      jobNumber: base.jobNumber,
      address: base.address,
      notes: base.notes,
      created: base.created,
      lastModified: base.lastModified,
      registeredJob: workbook.registeredJob || context.jobDetailsSection.registeredJob || null,
      projectId: workbook.projectId || workbook.commercialProjectId || context.jobDetailsSection.projectId || "",
      workspaceId: workbook.workspaceId || context.jobDetailsSection.workspaceId || "",
    },
    estimate: {
      ...context.estimateSection,
      workbook,
      data: workbook.data || context.estimateSection.data || null,
      quotation: workbook.quotation || context.estimateSection.quotation || null,
      projectEstimate: base.projectEstimate || null,
      summaryAdjustments: workbook.summaryAdjustments || base.pricing || {},
    },
    takeoff: {
      ...context.takeoffSection,
      aiPlanTakeoffJob: workbook.aiPlanTakeoffJob || context.takeoffSection.aiPlanTakeoffJob || null,
      takeoffEngine: workbook.takeoffEngine || context.takeoffSection.takeoffEngine || null,
      aiTakeoffProject: workbook.aiTakeoffProject || context.takeoffSection.aiTakeoffProject || null,
      plans: workbook.plans || base.rooms || [],
      schedule: base.schedule || null,
    },
    clientSelections: {
      ...context.clientSelectionsSection,
      book: base.selectionSchedule || null,
      clientSelectionsBook: workbook.clientSelectionsBook || context.clientSelectionsSection.clientSelectionsBook || null,
      selectionSchedule: workbook.selectionSchedule || base.selectionSchedule || null,
      selectionSchedules: workbook.selectionSchedules || context.clientSelectionsSection.selectionSchedules || null,
      productLibrarySelections: workbook.productLibrarySelections || context.clientSelectionsSection.productLibrarySelections || {},
    },
    quotation: {
      ...context.quotationSection,
      quotation: workbook.quotation || context.quotationSection.quotation || null,
      quoteSummary: workbook.quoteSummary || context.quotationSection.quoteSummary || null,
      summaryAdjustments: workbook.summaryAdjustments || base.pricing || {},
    },
    boq: asRecord(input.boq) || asRecord(asRecord(input.moduleData)?.boq) || { items: workbook.boq || workbook.commercialBoq || [] },
    procurement: asRecord(input.procurement) || asRecord(asRecord(input.moduleData)?.procurement) || { items: workbook.procurement || base.products || [] },
    variations: asRecord(input.variations) || asRecord(asRecord(input.moduleData)?.variations) || { items: workbook.variations || [] },
    projectDocuments: asRecord(input["project-documents"]) || asRecord(asRecord(input.moduleData)?.documents) || { documents: workbook.projectDocuments || [] },
    assets: asRecord(input.assets) || { plans: [], takeoff: [], selections: [], images: [] },
  };
}

function buildModuleData(sections: Record<string, unknown>, existing: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...existing,
    jobSetup: sections.jobDetails,
    takeoff: sections.takeoff,
    estimate: sections.estimate,
    clientSelections: sections.clientSelections,
    quotation: sections.quotation,
    boq: sections.boq,
    procurement: sections.procurement,
    variations: sections.variations,
    documents: sections.projectDocuments,
  };
}

function buildModuleMetadata(sections: Record<string, unknown>, existing: Record<string, unknown> = {}, updatedAt = new Date().toISOString()): Record<string, unknown> {
  const moduleData = buildModuleData(sections);
  return Object.fromEntries(Object.entries(moduleData).map(([key, value]) => {
    const existingMeta = asRecord(existing[key]) || {};
    return [key, {
      ...existingMeta,
      updatedAt: String(existingMeta.updatedAt || updatedAt),
      present: Boolean(value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length),
    }];
  }));
}

function buildMasterJobManifest(base: JobFileData, sections: ReturnType<typeof buildMasterJobSections>): Record<string, unknown> {
  const sectionNames = [
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
  ];
  return {
    formatName: MASTER_JOB_FORMAT_NAME,
    packageType: "gr8-master-job",
    schemaVersion: MASTER_JOB_SCHEMA_VERSION,
    packageVersion: MASTER_JOB_PACKAGE_VERSION,
    revision: base.masterRevision || 0,
    projectId: canonicalProjectId(base),
    generatedAt: base.lastModified,
    applicationVersion: "gr8-result-estimate-builder",
    project: {
      id: canonicalProjectId(base),
      jobName: base.jobName,
      projectName: base.jobName,
      clientName: base.clientName,
      jobNumber: base.jobNumber,
      address: base.address,
      created: base.created,
      lastSaved: base.lastModified,
    },
    includedModuleSections: sectionNames,
    assetIndex: { plans: [], takeoff: [], selections: [], images: [] },
    sectionChecksums: base.manifest?.sectionChecksums || {},
    migrationHistory: [
      { schemaVersion: MASTER_JOB_SCHEMA_VERSION, migratedAt: base.lastModified, note: "Created or normalised master job package." },
    ],
    sections: Object.fromEntries(sectionNames.map((name) => [name, {
      path: `${name}.json`,
      present: Boolean(sectionForManifest(name, sections)),
      independent: true,
    }])),
    safety: {
      writeMode: "single-master-file",
      compatibilityMirror: "workbook",
      moduleSectionsAreIndependent: true,
    },
  };
}

function canonicalProjectId(base: Partial<JobFileData>): string {
  const workbook = base.workbook && typeof base.workbook === "object" ? base.workbook : {};
  const meta = workbook.jobFileMeta && typeof workbook.jobFileMeta === "object" ? workbook.jobFileMeta as Record<string, unknown> : {};
  const jobDetails = asRecord(base["job-details"]) || asRecord(base.projectDetails) || {};
  const manifestProject = base.manifest?.project && typeof base.manifest.project === "object" ? base.manifest.project as Record<string, unknown> : {};
  const existing = base.jobId
    || jobDetails.projectId
    || manifestProject.id
    || base.manifest?.projectId
    || meta.projectId
    || workbook.projectId
    || workbook.id
    || workbook.jobId
    || base.jobNumber;
  if (existing) return String(existing);
  return `local-${slugFileName(`${base.jobName || "job"}-${base.address || ""}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "job"}`;
}

function sectionFileEntries(payload: JobFileData): Record<string, unknown> {
  return {
    "job-details": payload["job-details"] || {},
    estimate: payload.estimate || {},
    takeoff: payload.takeoff || {},
    "client-selections": payload["client-selections"] || {},
    quotation: payload.quotation || {},
    boq: payload.boq || {},
    procurement: payload.procurement || {},
    variations: payload.variations || {},
    "project-documents": payload["project-documents"] || {},
    assets: payload.assets || {},
  };
}

function checksumText(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function timestampForBackup(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function timestampForBackupFileName(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}${pad(date.getMinutes())}`;
}

async function existingZipBackups(existingBytes?: ArrayBuffer): Promise<Array<{ path: string; bytes: ArrayBuffer }>> {
  if (!existingBytes || !looksLikeZip(existingBytes)) return [];
  try {
    const existingZip = await JSZip.loadAsync(existingBytes);
    const backupPaths = Object.keys(existingZip.files)
      .filter((path) => /^backups\/.+\.gr8job$/i.test(path))
      .sort()
      .reverse()
      .slice(0, BACKUP_VERSION_LIMIT - 1);
    return Promise.all(backupPaths.map(async (path) => ({
      path,
      bytes: await existingZip.file(path)!.async("arraybuffer"),
    })));
  } catch {
    return [];
  }
}

async function serializeJobPackage(payload: JobFileData, existing?: { fileName: string; bytes: ArrayBuffer } | null): Promise<{ blob: Blob; data: JobFileData }> {
  const zip = new JSZip();
  const sections = sectionFileEntries(payload);
  const sectionChecksums: Record<string, string> = {};
  Object.entries(sections).forEach(([name, value]) => {
    const text = JSON.stringify(value || {}, null, 2);
    sectionChecksums[name] = checksumText(text);
    zip.file(`${name}.json`, text);
  });

  const backups = await existingZipBackups(existing?.bytes);
  if (existing?.bytes?.byteLength) {
    const backupName = slugFileName(existing.fileName.replace(/\.gr8job$/i, "") || payload.jobName || "Job");
    backups.unshift({
      path: `backups/${backupName} - ${timestampForBackup()}.gr8job`,
      bytes: existing.bytes,
    });
  }
  backups.slice(0, BACKUP_VERSION_LIMIT).forEach((backup) => {
    zip.file(backup.path, backup.bytes);
  });

  const data = {
    ...payload,
    manifest: {
      ...(payload.manifest || {}),
      revision: payload.masterRevision || 0,
      lastSavedDate: payload.lastModified,
      sectionChecksums,
      backupVersions: backups.slice(0, BACKUP_VERSION_LIMIT).map((backup) => ({
        path: backup.path,
        byteLength: backup.bytes.byteLength,
      })),
    },
  };
  zip.file("manifest.json", JSON.stringify(data.manifest || {}, null, 2));
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return { blob, data };
}

function nextSavePayload(job: Partial<JobFileData>): JobFileData {
  const now = new Date().toISOString();
  const currentRevision = Number(job.masterRevision || job.manifest?.revision || 0) || 0;
  return normalizeJobData({
    ...job,
    masterRevision: currentRevision + 1,
    updatedAt: now,
    lastModified: now,
  });
}

function expectedPackageSections(job: Partial<JobFileData> = {}): string[] {
  return [
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
  ].filter((section) => Boolean(job[section as keyof JobFileData]));
}

function validateSavedPackage(verified: JobFileData, expected: JobFileData, sections: string[] = []): void {
  if (verified.schemaVersion !== MASTER_JOB_SCHEMA_VERSION) {
    throw new Error("Saved job verification failed: read-back package schema did not match.");
  }
  if (canonicalProjectId(verified) !== canonicalProjectId(expected)) {
    throw new Error("Saved job verification failed: read-back project identity did not match.");
  }
  if ((Number(verified.masterRevision || verified.manifest?.revision || 0) || 0) !== (Number(expected.masterRevision || expected.manifest?.revision || 0) || 0)) {
    throw new Error("Saved job verification failed: read-back revision did not match.");
  }
  if (String(verified.updatedAt || verified.lastModified || "") !== String(expected.updatedAt || expected.lastModified || "")) {
    throw new Error("Saved job verification failed: read-back timestamp did not match.");
  }
  const missingSection = sections.find((section) => !verified[section as keyof JobFileData]);
  if (missingSection) {
    throw new Error(`Saved job verification failed: ${missingSection} section was missing after read-back.`);
  }
}

function formatSaveTime(date = new Date()): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

async function readMasterZipPackage(buffer: ArrayBuffer): Promise<JobFileData> {
  const zip = await JSZip.loadAsync(buffer);
  const readJson = async (path: string): Promise<Record<string, unknown>> => {
    const file = zip.file(path);
    if (!file) return {};
    const text = await file.async("text");
    return JSON.parse(text || "{}");
  };
  const manifest = await readJson("manifest.json");
  const sectionNames = ["job-details", "estimate", "takeoff", "client-selections", "quotation", "boq", "procurement", "variations", "project-documents", "assets"];
  const expectedChecksums = asRecord(manifest.sectionChecksums) || {};
  for (const [name, expected] of Object.entries(expectedChecksums)) {
    const file = zip.file(`${name}.json`);
    if (!file || checksumText(await file.async("text")) !== expected) {
      throw new Error(`Job file verification failed: ${name} is missing or its checksum does not match.`);
    }
  }
  const sectionEntries = await Promise.all(sectionNames.map(async (name) => [name, await readJson(`${name}.json`)] as const));
  const sections = Object.fromEntries(sectionEntries) as Record<string, Record<string, unknown>>;
  const payload: Partial<JobFileData> = {
    manifest,
    "job-details": sections["job-details"],
    estimate: sections.estimate,
    takeoff: sections.takeoff,
    "client-selections": sections["client-selections"],
    quotation: sections.quotation,
    boq: sections.boq,
    procurement: sections.procurement,
    variations: sections.variations,
    "project-documents": sections["project-documents"],
    assets: sections.assets,
    moduleData: buildModuleData({
      jobDetails: sections["job-details"],
      estimate: sections.estimate,
      takeoff: sections.takeoff,
      clientSelections: sections["client-selections"],
      quotation: sections.quotation,
      boq: sections.boq,
      procurement: sections.procurement,
      variations: sections.variations,
      projectDocuments: sections["project-documents"],
      assets: sections.assets,
    }),
    workbook: extractWorkbookFromJobPackage({ estimate: sections.estimate, "client-selections": sections["client-selections"] } as Partial<JobFileData>),
    lastModified: String(manifest.lastSavedDate || (manifest.project as Record<string, unknown> | undefined)?.lastSaved || new Date().toISOString()),
  };
  return normalizeJobData(payload);
}

function looksLikeZip(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function sectionForManifest(name: string, sections: ReturnType<typeof buildMasterJobSections>): unknown {
  const map: Record<string, unknown> = {
    "job-details": sections.jobDetails,
    estimate: sections.estimate,
    takeoff: sections.takeoff,
    "client-selections": sections.clientSelections,
    quotation: sections.quotation,
    boq: sections.boq,
    procurement: sections.procurement,
    variations: sections.variations,
    "project-documents": sections.projectDocuments,
    assets: sections.assets,
  };
  return map[name];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function valueFromWorkbook(workbook: Record<string, unknown> | undefined, key: string): string {
  if (!workbook || typeof workbook !== "object") return "";
  const data = workbook.data;
  if (!data || typeof data !== "object") return "";
  for (const section of Object.values(data as Record<string, unknown>)) {
    if (!section || typeof section !== "object") continue;
    const rows = (section as Record<string, unknown>).rows;
    if (!rows || typeof rows !== "object") continue;
    const row = (rows as Record<string, unknown>)[key];
    if (row && typeof row === "object" && "value" in row) {
      const value = (row as Record<string, unknown>).value;
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
  }
  return "";
}

function buildSuggestedName(jobName: string): string {
  return `${slugFileName(jobName || "Job")}${JOB_FILE_EXTENSION}`;
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function openFileInput(accept = `${JOB_FILE_EXTENSION},application/json`): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.onchange = () => {
      const file = input.files?.[0] || null;
      input.remove();
      resolve(file);
    };
    input.oncancel = () => {
      input.remove();
      resolve(null);
    };
    document.body.appendChild(input);
    input.click();
  });
}

export async function readJob(source: File | FileSystemFileHandle | string): Promise<JobFileData> {
  let text = "";
  let buffer: ArrayBuffer | null = null;
  if (typeof source === "string") {
    text = source;
  } else if (source && "getFile" in source) {
    const file = await source.getFile();
    buffer = await file.arrayBuffer();
  } else if (source instanceof File) {
    buffer = await source.arrayBuffer();
  }

  if (buffer) {
    if (buffer.byteLength === 0) {
      throw new Error("Selected job file is empty.");
    }
    if (looksLikeZip(buffer)) return readMasterZipPackage(buffer);
    text = new TextDecoder().decode(buffer);
  }
  if (!String(text || "").trim()) {
    throw new Error("Selected job file is empty.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid or corrupt GR8 job file.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid or unsupported GR8 job file.");
  }

  const payload = parsed as Partial<JobFileData> & { type?: string; version?: unknown; savedAt?: string };
  const workbookFromPayload = extractWorkbookFromJobPackage(payload);
  const workbookFromRoot = isWorkbookLikePayload(parsed) ? parsed as Record<string, unknown> : null;
  const workbook = workbookFromPayload || workbookFromRoot;
  if (!workbook) {
    throw new Error("Invalid or unsupported GR8 job file.");
  }
  return normalizeJobData({
    ...payload,
    workbook,
    lastModified: payload.lastModified || payload.savedAt || new Date().toISOString(),
  });
}

export function normaliseMasterJobFile(job: Partial<JobFileData> = {}): JobFileData {
  return normalizeJobData(job);
}

export function mergeMasterJobModuleSection(
  currentJob: Partial<JobFileData> = {},
  moduleKey: keyof typeof MODULE_SECTION_KEYS,
  nextSection: Record<string, unknown> = {},
  options: { expectedJobId?: string; updatedAt?: string } = {}
): JobFileData {
  const current = normalizeJobData(currentJob);
  const currentJobId = canonicalProjectId(current);
  const expectedJobId = String(options.expectedJobId || currentJobId || "").trim();
  if (expectedJobId && currentJobId && expectedJobId !== currentJobId) {
    throw new Error("Cannot merge module data from a different job ID.");
  }
  const sectionKey = MODULE_SECTION_KEYS[moduleKey];
  if (!sectionKey) throw new Error(`Unsupported job module section: ${String(moduleKey)}`);
  const updatedAt = options.updatedAt || new Date().toISOString();
  const next = {
    ...current,
    [sectionKey]: {
      ...(asRecord(current[sectionKey as keyof JobFileData]) || {}),
      ...(nextSection || {}),
    },
    moduleData: {
      ...(current.moduleData || {}),
      [moduleKey]: {
        ...(asRecord(current.moduleData?.[moduleKey]) || {}),
        ...(nextSection || {}),
      },
    },
    moduleMetadata: {
      ...(current.moduleMetadata || {}),
      [moduleKey]: {
        ...(asRecord(current.moduleMetadata?.[moduleKey]) || {}),
        updatedAt,
        present: true,
      },
    },
    lastModified: updatedAt,
    updatedAt,
  } as Partial<JobFileData>;
  return normalizeJobData(next);
}

function isWorkbookLikePayload(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Boolean(
    record.workbook
    || record.manifest
    || record["job-details"]
    || record.estimate
    || record.quotation
    || record.data
    || record.clientPage
    || record.aiTakeoffProject
    || record.clientSelectionsBook
    || record.projectEstimate
    || record.summaryAdjustments
  );
}

export async function writeJob(handle: JobFileHandle, job: Partial<JobFileData>): Promise<JobFileResult> {
  let payload = nextSavePayload(job);
  const sections = expectedPackageSections(payload);

  if (handle && "createWritable" in handle) {
    try {
      let existing: { fileName: string; bytes: ArrayBuffer } | null = null;
      try {
        const currentFile = await handle.getFile();
        existing = { fileName: handle.name, bytes: await currentFile.arrayBuffer() };
        if (existing.bytes.byteLength) {
          const previous = await readJob(currentFile);
          if (previous.jobId !== payload.jobId) throw new Error("This computer file belongs to a different job. Choose a different file.");
          payload = nextSavePayload({ ...job, masterRevision: Math.max(Number(job.masterRevision || 0), Number(previous.masterRevision || 0)) });
        }
      } catch (error) {
        const missing = (error as { code?: string; name?: string }).code === "ENOENT" || (error as Error).name === "NotFoundError";
        if (!missing) throw new Error(`Cannot preserve the previous computer file: ${(error as Error).message}`);
      }
      const packaged = await serializeJobPackage(payload, existing);
      payload = packaged.data;
      const writable = await handle.createWritable();
      await writable.write(packaged.blob);
      await writable.close();
      const verificationFile = await handle.getFile();
      const verified = await readJob(verificationFile);
      validateSavedPackage(verified, packaged.data, sections);
      return {
        ok: true,
        handle,
        fileName: handle.name,
        data: payload,
        storageLocation: "computer-file",
        message: `Saved to ${handle.name} at ${formatSaveTime()}`,
      };
    } catch (error: unknown) {
      if (isAbortLikeFileSystemError(error)) {
        return { ok: true, cancelled: true, handle, data: payload };
      }
      throw error;
    }
  }

  const packaged = await serializeJobPackage(payload, null);
  const fallbackName = buildSuggestedName(payload.jobName || "Job");
  triggerDownload(packaged.blob, fallbackName);
  return {
    ok: true,
    cancelled: false,
    handle: null,
    fileName: fallbackName,
    data: packaged.data,
    storageLocation: "download",
    message: `Downloaded new complete job file: ${fallbackName}. The original computer file was not overwritten.`,
  };
}

export async function createNewJob(job: Partial<JobFileData>): Promise<JobFileResult> {
  const payload = normalizeJobData(job);

  if (!supportsFileSystemAccess()) {
    return writeJob(null, payload);
  }

  try {
    const handle = await (window as FilePickerWindow).showSaveFilePicker?.({
      suggestedName: buildSuggestedName(payload.jobName),
      types: JOB_FILE_TYPES,
      excludeAcceptAllOption: false,
    });
    if (!handle) return { ok: true, cancelled: true, data: payload };
    return writeJob(handle, payload);
  } catch (error: unknown) {
    if (isAbortLikeFileSystemError(error)) {
      return { ok: true, cancelled: true, data: payload };
    }
    throw error;
  }
}

export async function openJob(): Promise<JobFileResult> {
  if (supportsFileSystemAccess()) {
    try {
      const [handle] = await ((window as FilePickerWindow).showOpenFilePicker?.({
        multiple: false,
        types: JOB_FILE_TYPES,
        excludeAcceptAllOption: false,
      }) || Promise.resolve([]));
      if (!handle) return { ok: true, cancelled: true };
      const data = await readJob(handle);
      return {
        ok: true,
        handle,
        fileName: handle.name,
        data,
      };
    } catch (error: unknown) {
      if (isAbortLikeFileSystemError(error)) {
        return { ok: true, cancelled: true };
      }
      return { ok: false, message: (error as Error)?.message || "This job file could not be opened." };
    }
  }

  const file = await openFileInput();
  if (!file) return { ok: true, cancelled: true };
  try {
    const data = await readJob(file);
    return { ok: true, handle: null, fileName: file.name, data };
  } catch (error: unknown) {
    return { ok: false, message: `${file.name}: ${(error as Error)?.message || "This job file could not be opened."}` };
  }
}

export async function saveJob(job: Partial<JobFileData>, currentHandle: JobFileHandle, options: { fallbackToSaveAs?: boolean } = {}): Promise<JobFileResult> {
  const fallbackToSaveAs = options.fallbackToSaveAs !== false;
  if (!currentHandle) {
    return fallbackToSaveAs ? saveJobAs(job) : { ok: false, message: "No active job file handle." };
  }
  try {
    return await writeJob(currentHandle, job);
  } catch (error: unknown) {
    const message = String((error as Error)?.message || "");
    if (isAbortLikeFileSystemError(error)) {
      return { ok: true, cancelled: true };
    }
    if (fallbackToSaveAs && isStaleFileHandleError(message)) {
      return saveJobAs(job);
    }
    throw error;
  }
}

export async function downloadBackupCopy(job: Partial<JobFileData>): Promise<JobFileResult> {
  const payload = normalizeJobData({ ...job, lastModified: new Date().toISOString() });
  const packaged = await serializeJobPackage(payload, null);
  const workbook = payload.workbook && typeof payload.workbook === "object" ? payload.workbook as Record<string, unknown> : {};
  const sourceFileName = String(workbook.openedFileName || workbook.sourceFileName || "").replace(/\.gr8job$/i, "");
  const baseName = slugFileName(sourceFileName || payload.jobName || payload.jobNumber || "Job");
  const fileName = `${baseName} - Backup ${timestampForBackupFileName()}.gr8job`;
  triggerDownload(packaged.blob, fileName);
  return { ok: true, cancelled: false, handle: null, fileName, data: packaged.data, storageLocation: "download", message: `Backup copy downloaded: ${fileName}` };
}

function isStaleFileHandleError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("state cached in an interface object is obsolete")
    || lower.includes("depends on state cached in an interface object")
    || lower.includes("changed since it was read from disk")
    || lower.includes("file has changed")
    || lower.includes("notreadableerror");
}

export async function saveJobAs(job: Partial<JobFileData>): Promise<JobFileResult> {
  const payload = normalizeJobData(job);

  if (!supportsFileSystemAccess()) {
    return writeJob(null, payload);
  }

  try {
    const handle = await (window as FilePickerWindow).showSaveFilePicker?.({
      suggestedName: buildSuggestedName(payload.jobName),
      types: JOB_FILE_TYPES,
      excludeAcceptAllOption: false,
    });
    if (!handle) return { ok: true, cancelled: true, data: payload };
    return writeJob(handle, payload);
  } catch (error: unknown) {
    if (isAbortLikeFileSystemError(error)) {
      return { ok: true, cancelled: true, data: payload };
    }
    throw error;
  }
}

export function isAbortLikeFileSystemError(error: unknown): boolean {
  const name = String((error as { name?: string })?.name || "");
  const message = String((error as { message?: string })?.message || error || "");
  const combined = `${name} ${message}`.toLowerCase();
  return name === "AbortError"
    || combined.includes("aborterror")
    || combined.includes("lock broken by another request")
    || (combined.includes("lock") && combined.includes("steal"));
}

export function autoSave(params: {
  timerRef: { current: ReturnType<typeof setTimeout> | null };
  onSave: () => Promise<void> | void;
  delayMs?: number;
}): void {
  const { timerRef, onSave, delayMs = 3000 } = params;
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(() => {
    void Promise.resolve(onSave());
  }, delayMs);
}
