import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createNewJob,
  isAbortLikeFileSystemError,
  JOB_FILE_EXTENSION,
  JobFileData,
  JobFileHandle,
  openJob,
  readJob,
  saveJob,
  saveJobAs,
} from "../lib/jobFile";

type RecentJob = {
  id: string;
  jobName: string;
  clientName: string;
  fileName: string;
  lastModified: string;
  openedAt: string;
};

type UseJobFileOptions = {
  enabled?: boolean;
  jobData: JobFileData;
  onOpenJob?: (job: JobFileData, fileName?: string) => Promise<void> | void;
  onError?: (message: string) => void;
  autoSaveDelayMs?: number;
};

type UseJobFileResult = {
  currentHandle: JobFileHandle;
  currentFileName: string;
  dirty: boolean;
  recentJobs: RecentJob[];
  newJob: (job: Partial<JobFileData>) => Promise<{ ok: boolean; cancelled?: boolean; message?: string }>;
  open: () => Promise<{ ok: boolean; cancelled?: boolean; message?: string }>;
  openRecent: (recentId: string) => Promise<{ ok: boolean; cancelled?: boolean; message?: string }>;
  save: () => Promise<{ ok: boolean; cancelled?: boolean; message?: string }>;
  saveAs: () => Promise<{ ok: boolean; cancelled?: boolean; message?: string }>;
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
        jobName: String(item.jobName || ""),
        clientName: String(item.clientName || ""),
        fileName: String(item.fileName || ""),
        lastModified: String(item.lastModified || ""),
        openedAt: String(item.openedAt || ""),
      }))
      .filter((item) => item.id);
  } catch {
    return [];
  }
}

function saveRecentJobs(recent: RecentJob[]): void {
  if (!canUseBrowserApis()) return;
  window.localStorage.setItem(RECENT_JOBS_STORAGE_KEY, JSON.stringify(recent.slice(0, 10)));
}

function buildRecentId(fileName: string, modified: string): string {
  const seed = `${fileName}|${modified}|${Date.now()}`;
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(encodeURIComponent(seed)).replace(/=+$/g, "");
  }
  return seed;
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
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>(() => safeRecentJobs());
  const [dirty, setDirty] = useState(false);
  const dataSnapshot = useMemo(() => JSON.stringify(jobData || {}), [jobData]);
  const lastSavedSnapshotRef = useRef(dataSnapshot);
  const initializedRef = useRef(false);

  const pushRecent = useCallback(async (params: { data: JobFileData; fileName?: string; handle?: JobFileHandle }) => {
    const fileName = String(params.fileName || (params.handle as FileSystemFileHandle | null)?.name || `${params.data.jobName || "Job"}${JOB_FILE_EXTENSION}`);
    const id = buildRecentId(fileName, params.data.lastModified || new Date().toISOString());
    const entry: RecentJob = {
      id,
      jobName: params.data.jobName || "Untitled Job",
      clientName: params.data.clientName || "",
      fileName,
      lastModified: params.data.lastModified || new Date().toISOString(),
      openedAt: new Date().toISOString(),
    };

    if (params.handle) {
      await storeHandle(id, params.handle);
    }

    setRecentJobs((current) => {
      const next = [entry, ...current.filter((item) => item.fileName !== entry.fileName)].slice(0, 10);
      saveRecentJobs(next);
      return next;
    });
  }, []);

  const runOpen = useCallback(async (data: JobFileData, fileName?: string, handle?: JobFileHandle) => {
    await Promise.resolve(onOpenJob?.(data, fileName));
    if (handle) setCurrentHandle(handle);
    setCurrentFileName(fileName || (handle as FileSystemFileHandle | null)?.name || "");
    lastSavedSnapshotRef.current = JSON.stringify(data || {});
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

  const save = useCallback(async () => {
    if (!enabled) return { ok: false, message: "Job files are disabled." };
    const result = await saveJob(jobData, currentHandle);
    if (!result.ok || result.cancelled || !result.data) {
      return { ok: Boolean(result.ok), cancelled: result.cancelled, message: result.message };
    }
    if (result.handle) setCurrentHandle(result.handle);
    if (result.fileName) setCurrentFileName(result.fileName);
    lastSavedSnapshotRef.current = JSON.stringify(result.data);
    setDirty(false);
    await pushRecent({ data: result.data, fileName: result.fileName, handle: result.handle || null });
    return { ok: true, cancelled: false };
  }, [enabled, jobData, currentHandle, pushRecent]);

  const saveAs = useCallback(async () => {
    if (!enabled) return { ok: false, message: "Job files are disabled." };
    const result = await saveJobAs(jobData);
    if (!result.ok || result.cancelled || !result.data) {
      return { ok: Boolean(result.ok), cancelled: result.cancelled, message: result.message };
    }
    if (result.handle) setCurrentHandle(result.handle);
    if (result.fileName) setCurrentFileName(result.fileName);
    lastSavedSnapshotRef.current = JSON.stringify(result.data);
    setDirty(false);
    await pushRecent({ data: result.data, fileName: result.fileName, handle: result.handle || null });
    return { ok: true, cancelled: false };
  }, [enabled, jobData, pushRecent]);

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

  useEffect(() => {
    if (!enabled) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastSavedSnapshotRef.current = dataSnapshot;
      return;
    }

    setDirty(dataSnapshot !== lastSavedSnapshotRef.current);
  }, [enabled, dataSnapshot]);

  return {
    currentHandle,
    currentFileName,
    dirty,
    recentJobs,
    newJob,
    open,
    openRecent,
    save,
    saveAs,
  };
}

export type { RecentJob };
