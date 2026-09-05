import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createNewJob,
  isAbortLikeFileSystemError,
  JOB_FILE_EXTENSION,
  JobFileData,
  JobFileHandle,
  downloadBackupCopy,
  openJob,
  readJob,
  saveJob,
  saveJobAs,
} from "../lib/jobFile";

type RecentJob = {
  id: string;
  jobName: string;
  projectName?: string;
  clientName: string;
  address?: string;
  projectId?: string;
  jobNumber?: string;
  type?: "job";
  fileName: string;
  lastModified: string;
  lastOpenedAt?: string;
  openedAt: string;
};

type UseJobFileOptions = {
  enabled?: boolean;
  jobData: JobFileData;
  onOpenJob?: (job: JobFileData, fileName?: string, options?: { preserveSaveMetadata?: boolean }) => Promise<void> | void;
  onError?: (message: string) => void;
  autoSaveDelayMs?: number;
};

type UseJobFileResult = {
  currentHandle: JobFileHandle;
  currentFileName: string;
  hasActiveJob: boolean;
  storageLocation: "computer-file" | "download" | "";
  dirty: boolean;
  recentJobs: RecentJob[];
  newJob: (job: Partial<JobFileData>) => Promise<{ ok: boolean; cancelled?: boolean; message?: string }>;
  open: () => Promise<{ ok: boolean; cancelled?: boolean; message?: string }>;
  openFile: (file: File) => Promise<{ ok: boolean; cancelled?: boolean; message?: string }>;
  openParsedJob: (data: JobFileData, fileName?: string, handle?: JobFileHandle) => Promise<{ ok: boolean; cancelled?: boolean; message?: string }>;
  openRecent: (recentId: string) => Promise<{ ok: boolean; cancelled?: boolean; message?: string }>;
  removeRecent: (recentId: string) => void;
  save: (overrideData?: JobFileData) => Promise<{ ok: boolean; cancelled?: boolean; message?: string; data?: JobFileData }>;
  saveAs: (overrideData?: JobFileData) => Promise<{ ok: boolean; cancelled?: boolean; message?: string; data?: JobFileData }>;
  downloadBackup: (overrideData?: JobFileData) => Promise<{ ok: boolean; cancelled?: boolean; message?: string; data?: JobFileData }>;
  close: () => void;
};

const RECENT_JOBS_STORAGE_KEY = "gr8-job-recent-files";
const HANDLE_DB_NAME = "gr8-job-file-handles";
const HANDLE_STORE_NAME = "handles";

function canUseBrowserApis(): boolean {
  return typeof window !== "undefined";
}

function safeRecentJobs(): RecentJob[] {
  if (!canUseBrowserApis()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_JOBS_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: String(item.id || ""),
        jobName: String(item.jobName || item.projectName || ""),
        projectName: String(item.projectName || item.jobName || ""),
        clientName: String(item.clientName || ""),
        address: String(item.address || item.siteAddress || ""),
        projectId: String(item.projectId || ""),
        jobNumber: String(item.jobNumber || ""),
        type: item.type === "job" ? "job" as const : undefined,
        fileName: String(item.fileName || ""),
        lastModified: String(item.lastModified || ""),
        lastOpenedAt: String(item.lastOpenedAt || item.openedAt || ""),
        openedAt: String(item.openedAt || ""),
      }))
      .filter(isGenuineRecentJob)
      .slice(0, 3);
  } catch {
    return [];
  }
}

function saveRecentJobs(recent: RecentJob[]): void {
  if (!canUseBrowserApis()) return;
  window.localStorage.setItem(RECENT_JOBS_STORAGE_KEY, JSON.stringify(recent.filter(isGenuineRecentJob).slice(0, 3)));
}

function buildRecentId(fileName: string, modified: string): string {
  const seed = `${fileName}|${modified}|${Date.now()}`;
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(encodeURIComponent(seed)).replace(/=+$/g, "");
  }
  return seed;
}

function createJobDataSnapshot(value: unknown): string {
  const seen = new WeakSet<object>();
  const dataUrlPattern = /^data:(?:image|application\/pdf)\//i;
  const volatileMetadataKeys = new Set([
    "savedAt",
    "lastSavedAt",
    "lastModified",
    "updatedAt",
    "generatedAt",
    "lastSavedDate",
    "masterRevision",
    "revision",
    "sectionChecksums",
    "backupVersions",
    "migrationHistory",
  ]);

  try {
    return JSON.stringify(value || {}, (_key, entry) => {
      if (volatileMetadataKeys.has(_key)) return "[save-metadata]";
      if (typeof entry === "string") {
        if (dataUrlPattern.test(entry)) {
          return `[embedded:${entry.slice(0, 32)}:${entry.length}]`;
        }
        return entry.length > 2000 ? `[text:${entry.length}:${entry.slice(0, 128)}]` : entry;
      }
      if (entry && typeof entry === "object") {
        if (seen.has(entry)) return "[circular]";
        seen.add(entry);
      }
      return entry;
    });
  } catch {
    const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const workbook = candidate.workbook && typeof candidate.workbook === "object" ? candidate.workbook as Record<string, unknown> : {};
    const takeoffJob = (workbook.aiPlanTakeoffJob && typeof workbook.aiPlanTakeoffJob === "object" ? workbook.aiPlanTakeoffJob : null) as Record<string, unknown> | null;
    const plan = takeoffJob?.plan && typeof takeoffJob.plan === "object" ? takeoffJob.plan as Record<string, unknown> : {};
    const pages = Array.isArray(plan.pages) ? plan.pages : [];
    const completedAreas = Array.isArray(takeoffJob?.completedAreas) ? takeoffJob.completedAreas : [];
    return JSON.stringify({
      jobName: candidate.jobName || takeoffJob?.jobName || "",
      lastModified: candidate.lastModified || takeoffJob?.updatedAt || "",
      takeoffUpdatedAt: takeoffJob?.updatedAt || "",
      embeddedPlanPages: pages.length,
      completedAreas: completedAreas.length,
    });
  }
}

function jobIdentity(data: Partial<JobFileData> = {}) {
  const workbook = data.workbook && typeof data.workbook === "object" ? data.workbook as Record<string, unknown> : {};
  const meta = workbook.jobFileMeta && typeof workbook.jobFileMeta === "object" ? workbook.jobFileMeta as Record<string, unknown> : {};
  const registeredJob = workbook.registeredJob && typeof workbook.registeredJob === "object" ? workbook.registeredJob as Record<string, unknown> : {};
  const jobDetails = data["job-details"] && typeof data["job-details"] === "object" ? data["job-details"] as Record<string, unknown> : {};
  const manifestProject = data.manifest?.project && typeof data.manifest.project === "object" ? data.manifest.project as Record<string, unknown> : {};
  const projectId = String(jobDetails.projectId || manifestProject.id || data.manifest?.projectId || registeredJob.jobId || workbook.registeredJobId || workbook.commercialProjectId || workbook.projectId || meta.projectId || "").trim();
  return {
    projectId,
    projectName: String(data.jobName || jobDetails.projectName || manifestProject.projectName || manifestProject.name || meta.jobName || registeredJob.jobName || workbook.projectName || "").trim(),
    jobNumber: String(data.jobNumber || jobDetails.jobNumber || manifestProject.jobNumber || meta.jobNumber || registeredJob.jobNumber || "").trim(),
    clientName: String(data.clientName || jobDetails.clientName || manifestProject.clientName || meta.clientName || registeredJob.clientName || "").trim(),
    address: String(data.address || jobDetails.address || jobDetails.siteAddress || manifestProject.address || meta.address || registeredJob.siteAddress || "").trim(),
  };
}

function isTemplateLikeRecent(item: Partial<RecentJob> = {}): boolean {
  const text = [item.jobName, item.projectName, item.fileName, item.id].join(" ").toLowerCase();
  return text.includes("template") || text.includes("premier inclusions") || text.includes("master estimate") || text.includes("selection draft") || text.includes("estimate-file:");
}

function isGenuineRecentJob(item: Partial<RecentJob> = {}): item is RecentJob {
  return Boolean(
    item
    && item.type === "job"
    && String(item.id || "").trim()
    && String(item.projectId || "").trim()
    && (String(item.jobNumber || "").trim() || String(item.projectName || item.jobName || "").trim())
    && String(item.lastOpenedAt || item.openedAt || "").trim()
    && !isTemplateLikeRecent(item)
  );
}

async function openHandleDb(): Promise<IDBDatabase | null> {
  if (!canUseBrowserApis() || typeof window.indexedDB === "undefined") return null;
  return new Promise((resolve) => {
    const request = window.indexedDB.open(HANDLE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        db.createObjectStore(HANDLE_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function storeHandle(id: string, handle: JobFileHandle): Promise<void> {
  if (!id || !handle) return;
  const db = await openHandleDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(HANDLE_STORE_NAME, "readwrite");
    tx.objectStore(HANDLE_STORE_NAME).put({ id, handle });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

async function readHandle(id: string): Promise<JobFileHandle> {
  if (!id) return null;
  const db = await openHandleDb();
  if (!db) return null;
  const result = await new Promise<JobFileHandle>((resolve) => {
    const tx = db.transaction(HANDLE_STORE_NAME, "readonly");
    const request = tx.objectStore(HANDLE_STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result?.handle as JobFileHandle) || null);
    request.onerror = () => resolve(null);
  });
  db.close();
  return result;
}

async function ensurePermission(handle: FileSystemFileHandle): Promise<boolean> {
  const readWrite = { mode: "readwrite" } as const;
  const permissionHandle = handle as FileSystemFileHandle & {
    queryPermission?: (descriptor?: typeof readWrite) => Promise<PermissionState>;
    requestPermission?: (descriptor?: typeof readWrite) => Promise<PermissionState>;
  };
  if (!permissionHandle.queryPermission || !permissionHandle.requestPermission) return true;
  if ((await permissionHandle.queryPermission(readWrite)) === "granted") return true;
  return (await permissionHandle.requestPermission(readWrite)) === "granted";
}

export function useJobFile(options: UseJobFileOptions): UseJobFileResult {
  const { enabled = true, jobData, onOpenJob, onError } = options;
  const [currentHandle, setCurrentHandle] = useState<JobFileHandle>(null);
  const [currentFileName, setCurrentFileName] = useState("");
  const [hasActiveJob, setHasActiveJob] = useState(false);
  const [storageLocation, setStorageLocation] = useState<"computer-file" | "download" | "">("");
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>(() => safeRecentJobs());
  const [dirty, setDirty] = useState(false);
  const dataSnapshot = useMemo(() => createJobDataSnapshot(jobData), [jobData]);
  const lastSavedSnapshotRef = useRef(dataSnapshot);
  const initializedRef = useRef(false);
  const pendingVerifiedSaveSnapshotSyncRef = useRef(false);

  const pushRecent = useCallback(async (params: { data: JobFileData; fileName?: string; handle?: JobFileHandle }) => {
    const fileName = String(params.fileName || (params.handle as FileSystemFileHandle | null)?.name || `${params.data.jobName || "Job"}${JOB_FILE_EXTENSION}`);
    const identity = jobIdentity(params.data);
    if (!identity.projectId) return;
    const id = buildRecentId(fileName, params.data.lastModified || new Date().toISOString());
    const entry: RecentJob = {
      id,
      type: "job",
      projectId: identity.projectId,
      projectName: identity.projectName || identity.jobNumber || "Untitled Job",
      jobName: identity.projectName || identity.jobNumber || "Untitled Job",
      jobNumber: identity.jobNumber,
      clientName: identity.clientName,
      address: identity.address,
      fileName,
      lastModified: params.data.lastModified || new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
      openedAt: new Date().toISOString(),
    };

    if (params.handle) {
      await storeHandle(id, params.handle);
    }

    setRecentJobs((current) => {
      const next = [entry, ...current.filter((item) => item.projectId !== entry.projectId && item.fileName !== entry.fileName)].filter(isGenuineRecentJob).slice(0, 3);
      saveRecentJobs(next);
      return next;
    });
  }, []);

  const runOpen = useCallback(async (data: JobFileData, fileName?: string, handle?: JobFileHandle) => {
    await Promise.resolve(onOpenJob?.(data, fileName));
    if (handle) setCurrentHandle(handle);
    setCurrentFileName(fileName || (handle as FileSystemFileHandle | null)?.name || "");
    setHasActiveJob(true);
    setStorageLocation(handle ? "computer-file" : "download");
    lastSavedSnapshotRef.current = createJobDataSnapshot(data || {});
    setDirty(false);
    await pushRecent({ data, fileName, handle: handle || null });
  }, [onOpenJob, pushRecent]);

  const newJob = useCallback(async (job: Partial<JobFileData>) => {
    if (!enabled) return { ok: false, message: "Job files are disabled." };
    try {
      const result = await createNewJob(job);
      if (!result.ok || result.cancelled || !result.data) {
        return { ok: Boolean(result.ok), cancelled: result.cancelled, message: result.message };
      }
      await runOpen(result.data, result.fileName, result.handle || null);
      return { ok: true, cancelled: false };
    } catch (error) {
      if (isAbortLikeFileSystemError(error)) return { ok: true, cancelled: true };
      const message = "This job file could not be opened.";
      onError?.(message);
      return { ok: false, message };
    }
  }, [enabled, onError, runOpen]);

  const open = useCallback(async () => {
    if (!enabled) return { ok: false, message: "Job files are disabled." };
    try {
      const result = await openJob();
      if (!result.ok || result.cancelled || !result.data) {
        if (result.message) onError?.(result.message);
        return { ok: Boolean(result.ok), cancelled: result.cancelled, message: result.message };
      }
      await runOpen(result.data, result.fileName, result.handle || null);
      return { ok: true, cancelled: false };
    } catch (error) {
      if (isAbortLikeFileSystemError(error)) return { ok: true, cancelled: true };
      const message = "This job file could not be opened.";
      onError?.(message);
      return { ok: false, message };
    }
  }, [enabled, onError, runOpen]);

  const openFile = useCallback(async (file: File) => {
    if (!enabled) return { ok: false, message: "Job files are disabled." };
    try {
      const data = await readJob(file);
      await runOpen(data, file.name, null);
      return { ok: true, cancelled: false };
    } catch (error) {
      const message = `${file?.name || "Selected file"}: ${(error as Error)?.message || "This job file could not be opened."}`;
      onError?.(message);
      return { ok: false, message };
    }
  }, [enabled, onError, runOpen]);

  const openParsedJob = useCallback(async (data: JobFileData, fileName = "", handle: JobFileHandle = null) => {
    if (!enabled) return { ok: false, message: "Job files are disabled." };
    try {
      await runOpen(data, fileName, handle);
      return { ok: true, cancelled: false };
    } catch (error) {
      const message = `${fileName || "Selected file"}: ${(error as Error)?.message || "This job file could not be opened."}`;
      onError?.(message);
      return { ok: false, message };
    }
  }, [enabled, onError, runOpen]);

  const save = useCallback(async (overrideData?: JobFileData) => {
    if (!enabled) return { ok: false, message: "Job files are disabled." };
    const currentJobData = overrideData || jobData;
    const result = await saveJob(currentJobData, currentHandle, { fallbackToSaveAs: true });
    if (!result.ok || result.cancelled || !result.data) {
      return { ok: Boolean(result.ok), cancelled: result.cancelled, message: result.message || "Job was not saved." };
    }
    // A successful disk write must never rehydrate over edits made while saving.
    if (result.handle) setCurrentHandle(result.handle);
    if (result.fileName) setCurrentFileName(result.fileName);
    setHasActiveJob(true);
    setStorageLocation(result.storageLocation || (result.handle ? "computer-file" : "download"));
    lastSavedSnapshotRef.current = createJobDataSnapshot(currentJobData);
    pendingVerifiedSaveSnapshotSyncRef.current = false;
    setDirty(false);
    await pushRecent({ data: result.data, fileName: result.fileName, handle: result.handle || null });
    return { ok: true, cancelled: false, message: result.message, data: result.data };
  }, [enabled, jobData, currentHandle, pushRecent]);

  const saveAs = useCallback(async (overrideData?: JobFileData) => {
    if (!enabled) return { ok: false, message: "Job files are disabled." };
    const currentJobData = overrideData || jobData;
    const result = await saveJobAs(currentJobData);
    if (!result.ok || result.cancelled || !result.data) {
      return { ok: Boolean(result.ok), cancelled: result.cancelled, message: result.message };
    }
    // A successful disk write must never rehydrate over edits made while saving.
    if (result.handle) setCurrentHandle(result.handle);
    if (result.fileName) setCurrentFileName(result.fileName);
    setHasActiveJob(true);
    setStorageLocation(result.storageLocation || (result.handle ? "computer-file" : "download"));
    lastSavedSnapshotRef.current = createJobDataSnapshot(currentJobData);
    pendingVerifiedSaveSnapshotSyncRef.current = false;
    setDirty(false);
    await pushRecent({ data: result.data, fileName: result.fileName, handle: result.handle || null });
    return { ok: true, cancelled: false, message: result.message, data: result.data };
  }, [enabled, jobData, pushRecent]);

  const downloadBackup = useCallback(async (overrideData?: JobFileData) => {
    if (!enabled) return { ok: false, message: "Job files are disabled." };
    const result = await downloadBackupCopy(overrideData || jobData);
    return { ok: Boolean(result.ok), cancelled: result.cancelled, message: result.message, data: result.data };
  }, [enabled, jobData]);

  const openRecent = useCallback(async (recentId: string) => {
    if (!enabled) return { ok: false, message: "Job files are disabled." };
    const handle = await readHandle(recentId);
    if (!handle) {
      return { ok: false, message: "Recent job handle not available. Please open the file again." };
    }

    try {
      const hasPermission = await ensurePermission(handle);
      if (!hasPermission) {
        return { ok: false, message: "File permission was not granted." };
      }
      const data = await readJob(handle);
      await runOpen(data, handle.name, handle);
      return { ok: true, cancelled: false };
    } catch (error) {
      if (isAbortLikeFileSystemError(error)) return { ok: true, cancelled: true };
      const message = "This job file could not be opened.";
      onError?.(message);
      return { ok: false, message };
    }
  }, [enabled, onError, runOpen]);

  const removeRecent = useCallback((recentId: string) => {
    const next = safeRecentJobs().filter((item) => item.id !== recentId);
    saveRecentJobs(next);
    setRecentJobs(next);
  }, []);

  const close = useCallback(() => {
    setCurrentHandle(null);
    setCurrentFileName("");
    setHasActiveJob(false);
    setStorageLocation("");
    lastSavedSnapshotRef.current = createJobDataSnapshot(jobData);
    setDirty(false);
  }, [jobData]);

  useEffect(() => {
    if (!enabled) return;
    if (!hasActiveJob) {
      setDirty(false);
      lastSavedSnapshotRef.current = dataSnapshot;
      return;
    }
    if (pendingVerifiedSaveSnapshotSyncRef.current) {
      pendingVerifiedSaveSnapshotSyncRef.current = false;
      lastSavedSnapshotRef.current = dataSnapshot;
      setDirty(false);
      return;
    }
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastSavedSnapshotRef.current = dataSnapshot;
      return;
    }

    setDirty(dataSnapshot !== lastSavedSnapshotRef.current);
  }, [enabled, dataSnapshot, hasActiveJob]);

  return {
    currentHandle,
    currentFileName,
    hasActiveJob,
    storageLocation,
    dirty,
    recentJobs,
    newJob,
    open,
    openFile,
    openParsedJob,
    openRecent,
    removeRecent,
    save,
    saveAs,
    downloadBackup,
    close,
  };
}

export type { RecentJob };
