export const JOB_FILE_EXTENSION = ".gr8job";
export const JOB_FILE_MIME = "application/json";

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
};

const JOB_FILE_TYPES: FilePickerAcceptType[] = [
  {
    description: "GR8 Job Files",
    accept: {
      [JOB_FILE_MIME]: [JOB_FILE_EXTENSION],
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

function normalizeJobData(input: Partial<JobFileData> = {}): JobFileData {
  const now = new Date().toISOString();
  return {
    jobName: String(input.jobName || ""),
    clientName: String(input.clientName || ""),
    jobNumber: String(input.jobNumber || ""),
    address: String(input.address || ""),
    notes: String(input.notes || ""),
    rooms: Array.isArray(input.rooms) ? input.rooms : [],
    products: Array.isArray(input.products) ? input.products : [],
    pricing: input.pricing && typeof input.pricing === "object" ? input.pricing : {},
    created: String(input.created || now),
    lastModified: String(input.lastModified || now),
    workbook: input.workbook && typeof input.workbook === "object" ? input.workbook : undefined,
  };
}

function buildSuggestedName(jobName: string): string {
  return `${slugFileName(jobName || "Job")}${JOB_FILE_EXTENSION}`;
}

function triggerDownload(text: string, fileName: string): void {
  const blob = new Blob([text], { type: `${JOB_FILE_MIME};charset=utf-8` });
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
  if (typeof source === "string") {
    text = source;
  } else if (source && "getFile" in source) {
    const file = await source.getFile();
    text = await file.text();
  } else if (source instanceof File) {
    text = await source.text();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This job file could not be opened.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("This job file could not be opened.");
  }

  return normalizeJobData(parsed as Partial<JobFileData>);
}

export async function writeJob(handle: JobFileHandle, job: Partial<JobFileData>): Promise<JobFileResult> {
  const payload = normalizeJobData({ ...job, lastModified: new Date().toISOString() });
  const text = JSON.stringify(payload, null, 2);

  if (handle && "createWritable" in handle) {
    try {
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return {
        ok: true,
        handle,
        fileName: handle.name,
        data: payload,
      };
    } catch (error: unknown) {
      if ((error as { name?: string })?.name === "AbortError") {
        return { ok: true, cancelled: true, handle, data: payload };
      }
      throw error;
    }
  }

  const fallbackName = buildSuggestedName(payload.jobName || "Job");
  triggerDownload(text, fallbackName);
  return { ok: true, cancelled: false, handle: null, fileName: fallbackName, data: payload };
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
    if ((error as { name?: string })?.name === "AbortError") {
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
      if ((error as { name?: string })?.name === "AbortError") {
        return { ok: true, cancelled: true };
      }
      if ((error as Error)?.message === "This job file could not be opened.") {
        return { ok: false, message: "This job file could not be opened." };
      }
      throw error;
    }
  }

  const file = await openFileInput();
  if (!file) return { ok: true, cancelled: true };
  try {
    const data = await readJob(file);
    return { ok: true, handle: null, fileName: file.name, data };
  } catch {
    return { ok: false, message: "This job file could not be opened." };
  }
}

export async function saveJob(job: Partial<JobFileData>, currentHandle: JobFileHandle): Promise<JobFileResult> {
  if (!currentHandle) {
    return saveJobAs(job);
  }
  return writeJob(currentHandle, job);
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
    if ((error as { name?: string })?.name === "AbortError") {
      return { ok: true, cancelled: true, data: payload };
    }
    throw error;
  }
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
