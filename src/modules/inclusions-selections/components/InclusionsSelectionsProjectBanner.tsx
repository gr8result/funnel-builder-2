import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useWorkspace } from "../../../../hooks/useWorkspace";
import type { ProjectSelectionContext } from "../repositories/projectAreaRegisterRepository";
import { INCLUSIONS_SELECTIONS_STAGES, type InclusionsSelectionsStageId } from "../routing/stageNavigation";
import {
  closeSelectionsProject,
  exportSelectionsProjectFile,
  importSelectionsProjectFile,
  mergeSelectionsIntoGr8Job,
  preparePortableSelectionsFileForLocalSave,
  previewSelectionsFileImport,
  projectDashboardHref,
  routeForProject,
  saveSelectionsProject,
  SELECTIONS_FILE_EXTENSION,
  GR8_JOB_FILE_EXTENSION,
  registerProjectOpen,
  type PortableSelectionsFile,
  type SelectionsFilePreview,
  type SelectionsSaveStatus,
} from "../services/projectFileManagementService";

type Props = {
  currentStage: InclusionsSelectionsStageId;
  context: Partial<ProjectSelectionContext>;
  saveStatus?: SelectionsSaveStatus;
  onSave?: () => Promise<void> | void;
  locked?: boolean;
};

type LocalFileHandle = {
  name: string;
  getFile: () => Promise<File>;
  requestPermission?: (options?: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  queryPermission?: (options?: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  createWritable?: () => Promise<{
    write: (data: string) => Promise<void> | void;
    close: () => Promise<void> | void;
  }>;
};

type LocalSaveStatus = SelectionsSaveStatus | "downloaded_copy" | "no_file" | "unsaved_file" | "saved_to_file";

type NewProjectDraft = {
  projectName: string;
  jobNumber: string;
  clientName: string;
  siteAddress: string;
  builder: string;
  estimator: string;
};

type NewProjectField = keyof NewProjectDraft;

type NewProjectValidationErrors = Partial<Record<NewProjectField, string>>;

type RecentSelectionsFile = {
  id: string;
  fileName: string;
  projectName: string;
  jobNumber: string;
  openedAt: string;
  hasHandle: boolean;
};

type ActiveSelectionsFile = {
  organisationId: string;
  projectId: string;
  fileName: string;
  fileKind?: "gr8select" | "gr8job";
  fileId?: string;
  createdAt?: string;
  builder?: string;
  estimator?: string;
  status: LocalSaveStatus;
  pendingSaveOffer?: boolean;
};

const emptyNewProject: NewProjectDraft = {
  projectName: "",
  jobNumber: "",
  clientName: "",
  siteAddress: "",
  builder: "",
  estimator: "",
};

const RECENT_FILES_KEY = "gr8:inclusions-selections:recent-local-files";
const ACTIVE_FILE_KEY = "gr8:inclusions-selections:active-local-file";
const RECENT_HANDLE_DB = "gr8-inclusions-selections-file-handles";
const RECENT_HANDLE_STORE = "fileHandles";
const ACTIVE_JOB_FILE_RAW_KEY = "gr8:inclusions-selections:active-gr8job-raw";
const NEW_FILE_EVENT = "inclusions-selections:new-file";
const OPEN_FILE_EVENT = "inclusions-selections:open-file";

function statusLabel(status: LocalSaveStatus): string {
  if (status === "no_file") return "No File Open";
  if (status === "unsaved_file") return "Unsaved File";
  if (status === "save_failed") return "Save Failed";
  if (status === "unsaved") return "Unsaved Changes";
  if (status === "saving") return "Saving...";
  if (status === "read_only") return "Read Only";
  if (status === "locked_version") return "Locked Version";
  if (status === "downloaded_copy") return "Updated Copy Downloaded";
  if (status === "saved_to_file") return "Saved to File";
  return "Saved to File";
}

function creationStatusLabel(status: "idle" | "creating" | "validation_required" | "save_dialog_opened" | "file_created" | "failed"): string {
  if (status === "creating") return "Creating...";
  if (status === "validation_required") return "Validation Required";
  if (status === "save_dialog_opened") return "Save Dialog Opened";
  if (status === "file_created") return "File Created";
  if (status === "failed") return "File Creation Failed";
  return "";
}

function safeFileName(context: Partial<ProjectSelectionContext>, suffix = ""): string {
  const base = [context.projectName ?? context.projectId ?? "Selections Project", context.jobNumber].filter(Boolean).join("-");
  const cleaned = base.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Selections-Project";
  return `${cleaned}${suffix}${SELECTIONS_FILE_EXTENSION}`;
}

function newProjectFileName(draft: Pick<NewProjectDraft, "projectName" | "jobNumber">): string {
  const cleaned = [draft.projectName, draft.jobNumber].filter(Boolean).join("-").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Selections-Project";
  return `${cleaned}${SELECTIONS_FILE_EXTENSION}`;
}

function makeProjectId(draft: NewProjectDraft): string {
  const source = [draft.projectName, draft.jobNumber].filter(Boolean).join("-");
  return `local_${source.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "selections"}_${Date.now()}`;
}

function filePickerWindow(): Window & {
  showOpenFilePicker?: (options: {
    types: { description: string; accept: Record<string, string[]> }[];
    multiple: false;
  }) => Promise<LocalFileHandle[]>;
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<LocalFileHandle>;
} {
  return window as Window & {
    showOpenFilePicker?: (options: {
      types: { description: string; accept: Record<string, string[]> }[];
      multiple: false;
    }) => Promise<LocalFileHandle[]>;
    showSaveFilePicker?: (options: {
      suggestedName: string;
      types: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<LocalFileHandle>;
  };
}

function downloadJson(fileName: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

function openPickerOptions() {
  return {
    types: [
      {
        description: "Gr8 Result Project Files",
        accept: {
          "application/json": [GR8_JOB_FILE_EXTENSION, SELECTIONS_FILE_EXTENSION, ".json"],
        },
      },
    ],
  };
}

function savePickerOptions(suggestedName: string, fileKind: "gr8select" | "gr8job" = "gr8select") {
  return {
    suggestedName,
    types: [
      {
        description: fileKind === "gr8job" ? "Gr8 Result Job File" : "Gr8 Result Selections Project",
        accept: {
          "application/json": [fileKind === "gr8job" ? GR8_JOB_FILE_EXTENSION : SELECTIONS_FILE_EXTENSION],
        },
      },
    ],
  };
}

function readRecentFiles(): RecentSelectionsFile[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_FILES_KEY) ?? "[]") as RecentSelectionsFile[];
  } catch {
    return [];
  }
}

function writeRecentFiles(files: RecentSelectionsFile[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(files.slice(0, 3)));
}

function readActiveFile(context: Partial<ProjectSelectionContext>): ActiveSelectionsFile | null {
  if (typeof window === "undefined" || !context.organisationId || !context.projectId) return null;
  try {
    const file = JSON.parse(window.localStorage.getItem(ACTIVE_FILE_KEY) ?? "null") as ActiveSelectionsFile | null;
    if (file?.organisationId === context.organisationId && file.projectId === context.projectId) return file;
  } catch {
    return null;
  }
  return null;
}

function writeActiveFile(file: ActiveSelectionsFile | null) {
  if (typeof window === "undefined") return;
  if (!file) {
    window.localStorage.removeItem(ACTIVE_FILE_KEY);
    return;
  }
  window.localStorage.setItem(ACTIVE_FILE_KEY, JSON.stringify(file));
}

function readActiveJobFileRaw(context: Partial<ProjectSelectionContext>): Record<string, unknown> | null {
  if (typeof window === "undefined" || !context.organisationId || !context.projectId) return null;
  try {
    const entry = JSON.parse(window.sessionStorage.getItem(ACTIVE_JOB_FILE_RAW_KEY) ?? "null") as { organisationId?: string; projectId?: string; raw?: Record<string, unknown> } | null;
    if (entry?.organisationId === context.organisationId && entry.projectId === context.projectId && entry.raw) return entry.raw;
  } catch {
    return null;
  }
  return null;
}

function writeActiveJobFileRaw(context: Partial<ProjectSelectionContext>, raw: Record<string, unknown> | null) {
  if (typeof window === "undefined") return;
  if (!raw || !context.organisationId || !context.projectId) {
    window.sessionStorage.removeItem(ACTIVE_JOB_FILE_RAW_KEY);
    return;
  }
  window.sessionStorage.setItem(ACTIVE_JOB_FILE_RAW_KEY, JSON.stringify({ organisationId: context.organisationId, projectId: context.projectId, raw }));
}

function openRecentHandleDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = window.indexedDB.open(RECENT_HANDLE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(RECENT_HANDLE_STORE);
    request.onerror = () => resolve(null);
    request.onsuccess = () => resolve(request.result);
  });
}

async function saveRecentHandle(id: string, handle: LocalFileHandle | null) {
  if (!handle) return;
  const db = await openRecentHandleDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(RECENT_HANDLE_STORE, "readwrite");
    transaction.objectStore(RECENT_HANDLE_STORE).put(handle, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
  db.close();
}

async function loadRecentHandle(id: string): Promise<LocalFileHandle | null> {
  const db = await openRecentHandleDb();
  if (!db) return null;
  const handle = await new Promise<LocalFileHandle | null>((resolve) => {
    const transaction = db.transaction(RECENT_HANDLE_STORE, "readonly");
    const request = transaction.objectStore(RECENT_HANDLE_STORE).get(id);
    request.onsuccess = () => resolve((request.result as LocalFileHandle | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
  db.close();
  return handle;
}

async function ensureReadPermission(handle: LocalFileHandle): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return false;
  const existing = await handle.queryPermission({ mode: "read" });
  if (existing === "granted") return true;
  return await handle.requestPermission({ mode: "read" }) === "granted";
}

function recentId(fileName: string, fileId?: string): string {
  return `${fileId || fileName}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
}

export function InclusionsSelectionsPageBanner({ currentStage, context, saveStatus, onSave, locked = false }: Props) {
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newFieldRefs = useRef<Record<NewProjectField, HTMLInputElement | null>>({
    projectName: null,
    jobNumber: null,
    clientName: null,
    siteAddress: null,
    builder: null,
    estimator: null,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [openPreview, setOpenPreview] = useState<SelectionsFilePreview | null>(null);
  const [openPreviewVisible, setOpenPreviewVisible] = useState(false);
  const [openFileMeta, setOpenFileMeta] = useState<{ fileName: string; fileSize: number; detectedFormat: string; updatedAt?: string } | null>(null);
  const [pendingFileHandle, setPendingFileHandle] = useState<LocalFileHandle | null>(null);
  const [pendingJobFileRaw, setPendingJobFileRaw] = useState<Record<string, unknown> | null>(null);
  const [localFileHandle, setLocalFileHandle] = useState<LocalFileHandle | null>(null);
  const [activeFileKind, setActiveFileKind] = useState<"gr8select" | "gr8job">("gr8select");
  const [activeJobFileRaw, setActiveJobFileRaw] = useState<Record<string, unknown> | null>(null);
  const [activeFileMetadata, setActiveFileMetadata] = useState<{ fileId: string; createdAt: string } | null>(null);
  const [localFileName, setLocalFileName] = useState("No selections file open");
  const [status, setStatus] = useState<LocalSaveStatus>(locked ? "locked_version" : saveStatus ?? (context.projectId ? "unsaved_file" : "no_file"));
  const [message, setMessage] = useState("");
  const [diagnostics, setDiagnostics] = useState("");
  const [creationDiagnostics, setCreationDiagnostics] = useState("");
  const [creationStatus, setCreationStatus] = useState<"idle" | "creating" | "validation_required" | "save_dialog_opened" | "file_created" | "failed">("idle");
  const [recentFiles, setRecentFiles] = useState<RecentSelectionsFile[]>([]);
  const [newErrors, setNewErrors] = useState<NewProjectValidationErrors>({});
  const [newDraft, setNewDraft] = useState<NewProjectDraft>({
    ...emptyNewProject,
    projectName: context.projectName ?? "",
    jobNumber: context.jobNumber ?? "",
    clientName: context.clientName ?? "",
    siteAddress: context.siteAddress ?? "",
  });
  const [pendingCreatedProject, setPendingCreatedProject] = useState<ProjectSelectionContext | null>(null);
  const [saveAsName, setSaveAsName] = useState(safeFileName(context));
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  const organisationId = context.organisationId || workspaceId || "";
  const bannerContext = useMemo(() => ({ ...context, organisationId }), [context, organisationId]);
  const hasProject = Boolean(organisationId && context.projectId);
  const effectiveStatus = locked ? "locked_version" : status;
  const currentStageLabel = INCLUSIONS_SELECTIONS_STAGES.find((stage) => stage.id === currentStage)?.label ?? currentStage;
  const dashboardHref = projectDashboardHref(bannerContext);

  useEffect(() => {
    setRecentFiles(readRecentFiles());
  }, []);

  useEffect(() => {
    if (!saveStatus || saveStatus === "saved") return;
    setStatus(saveStatus);
  }, [saveStatus]);

  useEffect(() => {
    if (!hasProject) {
      setLocalFileName("No selections file open");
      setStatus((current) => current === "saving" ? current : "no_file");
      return;
    }
    const activeFile = readActiveFile(bannerContext);
    if (activeFile) {
      setLocalFileName(activeFile.fileName);
      setActiveFileKind(activeFile.fileKind ?? (activeFile.fileName.toLowerCase().endsWith(GR8_JOB_FILE_EXTENSION) ? "gr8job" : "gr8select"));
      if ((activeFile.fileKind ?? (activeFile.fileName.toLowerCase().endsWith(GR8_JOB_FILE_EXTENSION) ? "gr8job" : "gr8select")) === "gr8job") {
        setActiveJobFileRaw(readActiveJobFileRaw(activeFile));
      }
      setActiveFileMetadata(activeFile.fileId && activeFile.createdAt ? { fileId: activeFile.fileId, createdAt: activeFile.createdAt } : null);
      setStatus((current) => current === "saving" ? current : activeFile.status);
      setSaveAsName(activeFile.fileName);
      if (activeFile.pendingSaveOffer && bannerContext.organisationId && bannerContext.projectId) {
        setPendingCreatedProject({
          ...(bannerContext as ProjectSelectionContext),
          builder: activeFile.builder,
          estimator: activeFile.estimator,
        });
        setSavePromptOpen(true);
      }
      return;
    }
    setLocalFileName((current) => current === "No selections file open" ? safeFileName(bannerContext) : current);
    setSaveAsName(safeFileName(bannerContext));
  }, [hasProject, bannerContext.projectId, bannerContext.projectName, bannerContext.jobNumber]);

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }
    }
    window.addEventListener("keydown", handler);
    window.addEventListener(NEW_FILE_EVENT, openNewDialog);
    window.addEventListener(OPEN_FILE_EVENT, openFileFromEvent);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener(NEW_FILE_EVENT, openNewDialog);
      window.removeEventListener(OPEN_FILE_EVENT, openFileFromEvent);
    };
  });

  function openNewDialog() {
    setNewOpen(true);
  }

  function openFileFromEvent() {
    void handleOpenFile();
  }

  async function confirmUnsaved(): Promise<"continue" | "cancel"> {
    if (effectiveStatus !== "unsaved" && effectiveStatus !== "unsaved_file") return "continue";
    const shouldContinue = window.confirm("This selections file has unsaved changes. Continue without saving?");
    return shouldContinue ? "continue" : "cancel";
  }

  function validateNewDraft(): NewProjectValidationErrors {
    const labels: Record<NewProjectField, string> = {
      projectName: "Project Name",
      jobNumber: "Job Number",
      clientName: "Client",
      siteAddress: "Site Address",
      builder: "Builder",
      estimator: "Estimator",
    };
    const errors: NewProjectValidationErrors = {};
    (Object.keys(labels) as NewProjectField[]).forEach((field) => {
      if (!newDraft[field].trim()) errors[field] = `${labels[field]} is required.`;
    });
    return errors;
  }

  function focusFirstInvalid(errors: NewProjectValidationErrors) {
    const first = (Object.keys(errors) as NewProjectField[])[0];
    if (first) newFieldRefs.current[first]?.focus();
  }

  function activeFilePayload(
  project: ProjectSelectionContext,
  fileName: string,
  file: Partial<Pick<PortableSelectionsFile, "fileId" | "createdAt">> = {},
  nextStatus: LocalSaveStatus,
  pendingSaveOffer = false,
  fileKind: "gr8select" | "gr8job" = activeFileKind,
): ActiveSelectionsFile {
    return {
      organisationId: project.organisationId,
      projectId: project.projectId,
      fileName,
      fileKind,
      fileId: file.fileId,
      createdAt: file.createdAt,
      builder: project.builder,
      estimator: project.estimator,
      status: nextStatus,
      pendingSaveOffer,
    };
  }

  function applyActiveFileState(project: ProjectSelectionContext, fileName: string, file: Partial<Pick<PortableSelectionsFile, "fileId" | "createdAt">>, nextStatus: LocalSaveStatus, pendingSaveOffer = false, fileKind: "gr8select" | "gr8job" = activeFileKind) {
    setLocalFileName(fileName);
    setActiveFileKind(fileKind);
    setStatus(nextStatus);
    setActiveFileMetadata(file.fileId && file.createdAt ? { fileId: file.fileId, createdAt: file.createdAt } : null);
    writeActiveFile(activeFilePayload(project, fileName, file, nextStatus, pendingSaveOffer, fileKind));
  }

  async function readActiveJobSource(): Promise<Record<string, unknown> | null> {
    if (activeFileKind !== "gr8job") return null;
    if (localFileHandle?.getFile) {
      try {
        const file = await localFileHandle.getFile();
        return JSON.parse(await file.text()) as Record<string, unknown>;
      } catch {
        return activeJobFileRaw;
      }
    }
    return activeJobFileRaw ?? readActiveJobFileRaw(bannerContext);
  }

  async function serialiseCurrentProject(mode: "save" | "save_as" = "save"): Promise<{ fileName: string; text: string; file: PortableSelectionsFile; fileKind: "gr8select" | "gr8job" }> {
    const serialised = await serialiseProject(bannerContext as ProjectSelectionContext, mode);
    if (activeFileKind !== "gr8job") return { ...serialised, fileKind: "gr8select" };
    const rawJob = await readActiveJobSource();
    if (!rawJob) return { ...serialised, fileKind: "gr8select" };
    const merged = mergeSelectionsIntoGr8Job(rawJob, serialised.file);
    return {
      fileName: localFileName.toLowerCase().endsWith(GR8_JOB_FILE_EXTENSION) ? localFileName : `${localFileName.replace(/\.(gr8select|json)$/i, "")}${GR8_JOB_FILE_EXTENSION}`,
      text: JSON.stringify(merged, null, 2),
      file: serialised.file,
      fileKind: "gr8job",
    };
  }

  async function serialiseProject(project: ProjectSelectionContext, mode: "save" | "save_as" = "save", suggestedFileId?: { fileId?: string; createdAt?: string }): Promise<{ fileName: string; text: string; file: PortableSelectionsFile }> {
    const activeFile = readActiveFile(project);
    const projectForFile: ProjectSelectionContext = {
      ...project,
      builder: project.builder ?? activeFile?.builder,
      estimator: project.estimator ?? activeFile?.estimator,
    };
    const exported = await exportSelectionsProjectFile(projectForFile);
    const baseFile: PortableSelectionsFile = activeFileMetadata || suggestedFileId?.fileId || suggestedFileId?.createdAt
      ? {
          ...exported.file,
          fileId: suggestedFileId?.fileId ?? activeFileMetadata?.fileId ?? exported.file.fileId,
          createdAt: suggestedFileId?.createdAt ?? activeFileMetadata?.createdAt ?? exported.file.createdAt,
        }
      : exported.file;
    const file = preparePortableSelectionsFileForLocalSave({
      ...baseFile,
      projectSummary: projectForFile,
      projectDetails: {
        ...baseFile.projectDetails,
        ...projectForFile,
        client: projectForFile.clientName ?? baseFile.projectDetails.client,
        builder: projectForFile.builder ?? baseFile.projectDetails.builder,
        estimator: projectForFile.estimator ?? baseFile.projectDetails.estimator,
      },
    }, mode);
    const text = JSON.stringify(file, null, 2);
    return { fileName: exported.fileName, text, file };
  }

  async function handleNew() {
    setCreationDiagnostics("");
    setMessage("");
    setCreationStatus("creating");
    const errors = validateNewDraft();
    if (Object.keys(errors).length > 0) {
      setNewErrors(errors);
      setCreationStatus("validation_required");
      setMessage("Complete the required project details before creating the file.");
      requestAnimationFrame(() => focusFirstInvalid(errors));
      return;
    }
    setNewErrors({});
    try {
      const target: ProjectSelectionContext = {
        organisationId: organisationId || "local_builder",
        projectId: makeProjectId(newDraft),
        projectName: newDraft.projectName.trim(),
        jobNumber: newDraft.jobNumber.trim(),
        clientName: newDraft.clientName.trim(),
        siteAddress: newDraft.siteAddress.trim(),
        builder: newDraft.builder.trim(),
        estimator: newDraft.estimator.trim(),
      };
      const suggestedName = newProjectFileName(newDraft);
      registerProjectOpen(target, "areas");
      setLocalFileHandle(null);
      setActiveJobFileRaw(null);
      writeActiveJobFileRaw(target, null);
      setActiveFileKind("gr8select");
      setPendingCreatedProject(target);
      setSaveAsName(suggestedName);
      applyActiveFileState(target, suggestedName, {}, "unsaved_file", true, "gr8select");
      setMessage("Unsaved File");
      setCreationStatus("file_created");
      setNewOpen(false);
      setSavePromptOpen(true);
      await router.push(routeForProject(target, "areas"));
    } catch (error) {
      console.error("The selections file could not be created.", error);
      setCreationStatus("failed");
      setMessage("The selections file could not be created.");
      setCreationDiagnostics(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleCreateSaveNow() {
    const project = pendingCreatedProject;
    if (!project) return;
    setCreationStatus("save_dialog_opened");
    setStatus("saving");
    setDiagnostics("");
    const suggestedName = newProjectFileName({
      projectName: project.projectName ?? "Selections Project",
      jobNumber: project.jobNumber ?? "",
    });
    try {
      const serialised = await serialiseProject(project);
      const picker = filePickerWindow();
      if (picker.showSaveFilePicker) {
        try {
          const handle = await picker.showSaveFilePicker(savePickerOptions(suggestedName));
          await writeFile(handle, serialised.text);
          setLocalFileHandle(handle);
          applyActiveFileState(project, handle.name, serialised.file, "saved_to_file", false, "gr8select");
          setMessage("Saved to File");
          setCreationStatus("file_created");
          setSavePromptOpen(false);
          await rememberRecentFile(serialised.file, handle.name, handle);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            applyActiveFileState(project, suggestedName, {}, "unsaved_file", false, "gr8select");
            setMessage("Unsaved File");
            setCreationStatus("file_created");
            return;
          }
          setCreationDiagnostics(error instanceof Error ? error.message : String(error));
        }
      }
      downloadJson(suggestedName, serialised.text);
      setLocalFileHandle(null);
      applyActiveFileState(project, suggestedName, serialised.file, "downloaded_copy", false, "gr8select");
      setMessage(`Updated copy downloaded as ${suggestedName}. The browser did not provide a writable file handle, so the original file is not linked for overwrite.`);
      setCreationStatus("file_created");
      setSavePromptOpen(false);
      await rememberRecentFile(serialised.file, suggestedName, null);
    } catch (error) {
      console.error("The selections file could not be created.", error);
      setStatus("save_failed");
      setCreationStatus("failed");
      setMessage("The selections file could not be created.");
      setCreationDiagnostics(error instanceof Error ? error.message : String(error));
    }
  }

  function handleContinueWithoutSaving() {
    if (!pendingCreatedProject) return;
    applyActiveFileState(pendingCreatedProject, localFileName === "No selections file open" ? newProjectFileName({
      projectName: pendingCreatedProject.projectName ?? "Selections Project",
      jobNumber: pendingCreatedProject.jobNumber ?? "",
    }) : localFileName, {}, "unsaved_file", false, "gr8select");
    setMessage("Unsaved File");
    setSavePromptOpen(false);
  }

  async function processPickedFile(file: File, handle: LocalFileHandle | null) {
    const lowerName = file.name.toLowerCase();
    const detectedFormat = lowerName.endsWith(GR8_JOB_FILE_EXTENSION) ? GR8_JOB_FILE_EXTENSION : lowerName.endsWith(SELECTIONS_FILE_EXTENSION) ? SELECTIONS_FILE_EXTENSION : lowerName.endsWith(".json") ? ".json" : "unsupported";
    setOpenFileMeta({ fileName: file.name, fileSize: file.size, detectedFormat });
    setPendingFileHandle(handle);
    setPendingJobFileRaw(null);
    setOpenPreviewVisible(true);
    if (file.size > 10 * 1024 * 1024 || !lowerName.match(/\.(gr8job|gr8select|json)$/)) {
      setOpenPreview({ ok: false, error: "This file could not be opened." });
      return;
    }
    const text = await file.text();
    if (text.match(/<script|<\/script>|javascript:|data:text\/html/i)) {
      setOpenPreview({ ok: false, error: "This file could not be opened." });
      return;
    }
    try {
      const parsed = JSON.parse(text);
      const preview = previewSelectionsFileImport(parsed, organisationId);
      setOpenPreview(preview);
      if (preview.ok && preview.format === "gr8job") setPendingJobFileRaw(preview.rawJobFile);
      if (preview.ok) setOpenFileMeta((meta) => meta ? { ...meta, updatedAt: preview.format === "gr8job" ? preview.file?.updatedAt : preview.file.updatedAt } : meta);
    } catch (error) {
      setOpenPreview({ ok: false, error: "Invalid JSON was rejected." });
      setDiagnostics(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleOpenFile() {
    if ((await confirmUnsaved()) === "cancel") return;
    setMessage("");
    setDiagnostics("");
    const picker = filePickerWindow();
    if (picker.showOpenFilePicker) {
      try {
        const [handle] = await picker.showOpenFilePicker({ ...openPickerOptions(), multiple: false });
        const file = await handle.getFile();
        await processPickedFile(file, handle);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage("The file picker could not be opened.");
        setDiagnostics(error instanceof Error ? error.message : String(error));
        return;
      }
    }
    fileInputRef.current?.click();
  }

  async function handleFallbackOpenFile(file: File) {
    if ((await confirmUnsaved()) === "cancel") return;
    await processPickedFile(file, null);
  }

  async function rememberRecentFile(file: PortableSelectionsFile, fileName: string, handle: LocalFileHandle | null) {
    const id = recentId(fileName, file.fileId);
    const next: RecentSelectionsFile = {
      id,
      fileName,
      projectName: file.projectSummary.projectName || "Selections Project",
      jobNumber: file.projectSummary.jobNumber || "",
      openedAt: new Date().toISOString(),
      hasHandle: Boolean(handle),
    };
    const merged = [next, ...recentFiles.filter((item) => item.id !== id)].slice(0, 3);
    setRecentFiles(merged);
    writeRecentFiles(merged);
    await saveRecentHandle(id, handle);
  }

  async function handleOpenProject() {
    if (!openPreview?.ok || !openFileMeta) return;
    const isJobFile = openPreview.format === "gr8job";
    const target = isJobFile ? openPreview.project : openPreview.file.projectSummary;
    const opened = isJobFile && !openPreview.file
      ? registerProjectOpen(target, "areas")
      : await importSelectionsProjectFile(openPreview.file, target);
    setLocalFileHandle(pendingFileHandle);
    setActiveFileKind(isJobFile ? "gr8job" : "gr8select");
    setActiveJobFileRaw(isJobFile ? pendingJobFileRaw ?? openPreview.rawJobFile : null);
    writeActiveJobFileRaw(target, isJobFile ? pendingJobFileRaw ?? openPreview.rawJobFile : null);
    setActiveFileMetadata(openPreview.file ? { fileId: openPreview.file.fileId, createdAt: openPreview.file.createdAt } : null);
    setLocalFileName(openFileMeta.fileName);
    setStatus("saved_to_file");
    setMessage("Saved to File");
    writeActiveFile({
      organisationId: opened.organisationId,
      projectId: opened.projectId,
      fileName: openFileMeta.fileName,
      fileKind: isJobFile ? "gr8job" : "gr8select",
      fileId: openPreview.file?.fileId,
      createdAt: openPreview.file?.createdAt,
      builder: opened.builder,
      estimator: opened.estimator,
      status: "saved_to_file",
    });
    if (openPreview.file) await rememberRecentFile(openPreview.file, openFileMeta.fileName, pendingFileHandle);
    setOpenPreviewVisible(false);
    setOpenPreview(null);
    setOpenFileMeta(null);
    await router.push(routeForProject(opened, "areas"));
  }

  async function writeFile(handle: LocalFileHandle, text: string) {
    if (!handle.createWritable) throw new Error("This browser cannot write directly to the selected file.");
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
  }

  async function handleSave() {
    if (locked) return;
    if (!hasProject) {
      setMessage("Create or open a selections file before saving.");
      return;
    }
    setStatus("saving");
    try {
      if (onSave) await onSave();
      else await saveSelectionsProject(bannerContext, currentStage);
      const serialised = await serialiseCurrentProject();
      if (localFileHandle?.createWritable) {
        await writeFile(localFileHandle, serialised.text);
        if (serialised.fileKind === "gr8job") {
          const raw = JSON.parse(serialised.text) as Record<string, unknown>;
          setActiveJobFileRaw(raw);
          writeActiveJobFileRaw(bannerContext, raw);
        }
        setLocalFileName(localFileHandle.name);
        setActiveFileMetadata({ fileId: serialised.file.fileId, createdAt: serialised.file.createdAt });
        setStatus("saved_to_file");
        setMessage("Saved to File");
        writeActiveFile({ organisationId, projectId: bannerContext.projectId ?? "", fileName: localFileHandle.name, fileKind: serialised.fileKind, fileId: serialised.file.fileId, createdAt: serialised.file.createdAt, status: "saved_to_file" });
        await rememberRecentFile(serialised.file, localFileHandle.name, localFileHandle);
        return;
      }
      const downloadName = localFileName === "No selections file open" || localFileName === "Unsaved File" ? serialised.fileName : localFileName;
      downloadJson(downloadName, serialised.text);
      if (serialised.fileKind === "gr8job") {
        const raw = JSON.parse(serialised.text) as Record<string, unknown>;
        setActiveJobFileRaw(raw);
        writeActiveJobFileRaw(bannerContext, raw);
      }
      setLocalFileName(downloadName);
      setActiveFileMetadata({ fileId: serialised.file.fileId, createdAt: serialised.file.createdAt });
      setStatus("downloaded_copy");
      setMessage(`Updated copy downloaded as ${downloadName}. The original file was not overwritten.`);
      writeActiveFile({ organisationId, projectId: bannerContext.projectId ?? "", fileName: downloadName, fileKind: serialised.fileKind, fileId: serialised.file.fileId, createdAt: serialised.file.createdAt, status: "downloaded_copy" });
      await rememberRecentFile(serialised.file, downloadName, null);
    } catch (error) {
      setStatus("save_failed");
      setMessage("Your changes could not be saved. Nothing was discarded.");
      setDiagnostics(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSaveAs() {
    if (!hasProject) {
      setMessage("Create or open a selections file before using Save As.");
      return;
    }
    try {
      if (onSave) await onSave();
      else await saveSelectionsProject(bannerContext, currentStage);
      const serialised = await serialiseCurrentProject("save_as");
      const fallbackName = serialised.fileKind === "gr8job" ? localFileName || `${safeFileName(bannerContext).replace(SELECTIONS_FILE_EXTENSION, "")}${GR8_JOB_FILE_EXTENSION}` : safeFileName(bannerContext);
      const suggestedName = (saveAsName.trim() || fallbackName).replace(/\.gr8selections\.json$/i, SELECTIONS_FILE_EXTENSION);
      const picker = filePickerWindow();
      if (picker.showSaveFilePicker) {
        const handle = await picker.showSaveFilePicker(savePickerOptions(suggestedName, serialised.fileKind));
        await writeFile(handle, serialised.text);
        setLocalFileHandle(handle);
        if (serialised.fileKind === "gr8job") {
          const raw = JSON.parse(serialised.text) as Record<string, unknown>;
          setActiveJobFileRaw(raw);
          writeActiveJobFileRaw(bannerContext, raw);
        }
        setLocalFileName(handle.name);
        setActiveFileKind(serialised.fileKind);
        setActiveFileMetadata({ fileId: serialised.file.fileId, createdAt: serialised.file.createdAt });
        setStatus("saved_to_file");
        setMessage("Saved to File");
        writeActiveFile({ organisationId, projectId: bannerContext.projectId ?? "", fileName: handle.name, fileKind: serialised.fileKind, fileId: serialised.file.fileId, createdAt: serialised.file.createdAt, status: "saved_to_file" });
        await rememberRecentFile(serialised.file, handle.name, handle);
      } else {
        downloadJson(suggestedName, serialised.text);
        setLocalFileHandle(null);
        if (serialised.fileKind === "gr8job") {
          const raw = JSON.parse(serialised.text) as Record<string, unknown>;
          setActiveJobFileRaw(raw);
          writeActiveJobFileRaw(bannerContext, raw);
        }
        setLocalFileName(suggestedName);
        setActiveFileKind(serialised.fileKind);
        setActiveFileMetadata({ fileId: serialised.file.fileId, createdAt: serialised.file.createdAt });
        setStatus("downloaded_copy");
        setMessage(`Updated copy downloaded as ${suggestedName}.`);
        writeActiveFile({ organisationId, projectId: bannerContext.projectId ?? "", fileName: suggestedName, fileKind: serialised.fileKind, fileId: serialised.file.fileId, createdAt: serialised.file.createdAt, status: "downloaded_copy" });
        await rememberRecentFile(serialised.file, suggestedName, null);
      }
      setSaveAsOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("save_failed");
      setMessage("Save As failed.");
      setDiagnostics(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleExportBackup() {
    if (!hasProject) return;
    try {
      const serialised = await serialiseCurrentProject();
      const date = new Date().toISOString().slice(0, 10);
      const backupName = safeFileName(bannerContext, `-backup-${date}`);
      downloadJson(backupName, serialised.text);
      setMessage(`Exported backup ${backupName}.`);
    } catch (error) {
      setMessage("Export Backup failed.");
      setDiagnostics(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleRecentFile(file: RecentSelectionsFile) {
    setRecentOpen(false);
    if (file.hasHandle) {
      const handle = await loadRecentHandle(file.id);
      if (handle && await ensureReadPermission(handle)) {
        await processPickedFile(await handle.getFile(), handle);
        return;
      }
    }
    setMessage("Choose this file again from your computer.");
    await handleOpenFile();
  }

  async function handleBack() {
    if ((await confirmUnsaved()) === "cancel") return;
    await router.push(dashboardHref);
  }

  async function handleDiscardClose() {
    setCloseConfirmOpen(false);
    setLocalFileHandle(null);
    setActiveFileKind("gr8select");
    setActiveJobFileRaw(null);
    writeActiveJobFileRaw(bannerContext, null);
    setActiveFileMetadata(null);
    setLocalFileName("No selections file open");
    setStatus("no_file");
    writeActiveFile(null);
    await router.push(closeSelectionsProject(bannerContext));
  }

  const projectDetailText = hasProject
    ? [
        context.projectName || "Selections Project",
        context.jobNumber ? `Job ${context.jobNumber}` : "",
        context.clientName || "",
        context.siteAddress || "",
        `Current Section: ${currentStageLabel}`,
        localFileName,
      ].filter(Boolean)
    : ["No selections file open"];

  return (
    <section className="standardPageBanner" aria-label="Inclusions and Selections project banner">
      <input
        ref={fileInputRef}
        className="hiddenFileInput"
        type="file"
        accept=".gr8job,.gr8select,.json,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFallbackOpenFile(file);
          event.currentTarget.value = "";
        }}
      />
      <div className="bannerIdentity">
        <div className="moduleIcon" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <h1>Inclusions & Selections</h1>
          <p>Choose project areas, select products and finishes, and prepare the completed selections schedule.</p>
        </div>
      </div>
      <div className="projectDetails" aria-label="Current selections file details">
        {projectDetailText.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
      </div>
      <div className="bannerActions">
        <span className={`saveStatus ${effectiveStatus}`}>{statusLabel(effectiveStatus)}</span>
        <button type="button" className="backButton" onClick={() => void handleBack()}>Back to Project Dashboard</button>
        <button type="button" onClick={() => setNewOpen(true)}>New</button>
        <button type="button" className="openButton" onClick={() => void handleOpenFile()}>Open File</button>
        <button type="button" className="saveButton" disabled={locked || !hasProject || effectiveStatus === "saving"} onClick={() => void handleSave()}>Save</button>
        <button type="button" disabled={!hasProject} onClick={() => setSaveAsOpen(true)}>Save As</button>
        <button type="button" className="fileButton" onClick={() => setMenuOpen((open) => !open)}>File</button>
        {menuOpen ? (
          <div className="fileMenu">
            <button type="button" onClick={() => setNewOpen(true)}>New File</button>
            <button type="button" onClick={() => void handleOpenFile()}>Open File</button>
            <hr />
            <button type="button" disabled={locked || !hasProject} onClick={() => void handleSave()}>Save</button>
            <button type="button" disabled={!hasProject} onClick={() => setSaveAsOpen(true)}>Save As</button>
            <button type="button" disabled={!hasProject} onClick={() => void handleExportBackup()}>Export Backup</button>
            <hr />
            <button type="button" onClick={() => setRecentOpen((open) => !open)}>Recent Files</button>
            <button type="button" disabled={!hasProject} onClick={() => setCloseConfirmOpen(true)}>Close File</button>
          </div>
        ) : null}
        {recentOpen ? (
          <div className="recentMenu">
            <strong>Recent Files</strong>
            {recentFiles.length ? recentFiles.map((file) => (
              <button key={file.id} type="button" onClick={() => void handleRecentFile(file)}>
                <span>{file.fileName}</span>
                <small>{file.projectName}{file.jobNumber ? ` - Job ${file.jobNumber}` : ""}</small>
                <time>{new Date(file.openedAt).toLocaleString()}</time>
              </button>
            )) : <p>No recent files yet.</p>}
          </div>
        ) : null}
      </div>
      {message ? <p className="bannerMessage">{message}</p> : null}
      {diagnostics ? <details className="diagnostics"><summary>Diagnostics</summary><pre>{diagnostics}</pre></details> : null}
      {newOpen ? (
        <div className="bannerModal" role="dialog" aria-modal="true">
          <div className="modalPanel narrow">
            <header><h2>New File</h2><button type="button" onClick={() => setNewOpen(false)}>Cancel</button></header>
            {creationStatus === "validation_required" ? <p className="validationSummary">Complete the required project details before creating the file.</p> : null}
            {(["projectName", "jobNumber", "clientName", "siteAddress", "builder", "estimator"] as NewProjectField[]).map((field) => {
              const labels: Record<NewProjectField, string> = {
                projectName: "Project Name",
                jobNumber: "Job Number",
                clientName: "Client",
                siteAddress: "Site Address",
                builder: "Builder",
                estimator: "Estimator",
              };
              return (
                <label key={field} className="fieldGroup">
                  <span>{labels[field]}</span>
                  <input
                    ref={(input) => { newFieldRefs.current[field] = input; }}
                    value={newDraft[field]}
                    aria-invalid={Boolean(newErrors[field])}
                    aria-describedby={newErrors[field] ? `new-${field}-error` : undefined}
                    onChange={(event) => {
                      setNewDraft({ ...newDraft, [field]: event.target.value });
                      if (newErrors[field]) setNewErrors({ ...newErrors, [field]: undefined });
                    }}
                  />
                  {newErrors[field] ? <small id={`new-${field}-error`} className="fieldError">{newErrors[field]}</small> : null}
                </label>
              );
            })}
            {creationStatus !== "idle" ? <p className={`creationState ${creationStatus}`}>{creationStatusLabel(creationStatus)}</p> : null}
            {creationDiagnostics ? <details className="diagnostics"><summary>Technical details</summary><pre>{creationDiagnostics}</pre></details> : null}
            <div className="dialogActions">
              <button type="button" className="saveButton" onClick={() => void handleNew()}>{creationStatus === "creating" ? "Creating..." : "Create File"}</button>
              <button type="button" onClick={() => setNewOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
      {savePromptOpen && pendingCreatedProject ? (
        <div className="bannerModal" role="dialog" aria-modal="true">
          <div className="modalPanel narrow">
            <header><h2>File Created</h2><button type="button" onClick={handleContinueWithoutSaving}>Continue Without Saving</button></header>
            <p><strong>{pendingCreatedProject.projectName}</strong> has been created in memory. Save a local `.gr8select` file now, or continue and save later.</p>
            <p className={`creationState ${creationStatus}`}>{creationStatusLabel(creationStatus) || "File Created"}</p>
            {creationDiagnostics ? <details className="diagnostics"><summary>Technical details</summary><pre>{creationDiagnostics}</pre></details> : null}
            <div className="dialogActions">
              <button type="button" className="saveButton" onClick={() => void handleCreateSaveNow()}>Save File Now</button>
              <button type="button" onClick={handleContinueWithoutSaving}>Continue Without Saving</button>
            </div>
          </div>
        </div>
      ) : null}
      {openPreviewVisible ? (
        <div className="bannerModal" role="dialog" aria-modal="true">
          <div className="modalPanel">
            <header><h2>Open File Preview</h2><button type="button" onClick={() => setOpenPreviewVisible(false)}>Cancel</button></header>
            {openFileMeta ? (
              <dl className="previewGrid">
                <div><dt>Filename</dt><dd>{openFileMeta.fileName}</dd></div>
                <div><dt>File Size</dt><dd>{Math.round(openFileMeta.fileSize / 1024)} KB</dd></div>
                <div><dt>Detected Format</dt><dd>{openFileMeta.detectedFormat}</dd></div>
                <div><dt>Last Updated</dt><dd>{openFileMeta.updatedAt || "Not recorded"}</dd></div>
              </dl>
            ) : null}
            {openPreview ? (
              openPreview.ok ? (
                <>
                  <dl className="previewGrid">
                    <div><dt>Schema Version</dt><dd>{openPreview.file?.schemaVersion ?? "Gr8 Job"}</dd></div>
                    <div><dt>Project Name</dt><dd>{(openPreview.format === "gr8job" ? openPreview.project.projectName : openPreview.file.projectSummary.projectName) || "Not recorded"}</dd></div>
                    <div><dt>Job Number</dt><dd>{(openPreview.format === "gr8job" ? openPreview.project.jobNumber : openPreview.file.projectSummary.jobNumber) || "Not recorded"}</dd></div>
                    <div><dt>Client</dt><dd>{(openPreview.format === "gr8job" ? openPreview.project.clientName : openPreview.file.projectSummary.clientName) || "Not recorded"}</dd></div>
                    <div><dt>Site Address</dt><dd>{(openPreview.format === "gr8job" ? openPreview.project.siteAddress : openPreview.file.projectSummary.siteAddress) || "Not recorded"}</dd></div>
                    <div><dt>Project Areas</dt><dd>{openPreview.file?.areasAndLevels.areas.length ?? 0}</dd></div>
                    <div><dt>Selections</dt><dd>{openPreview.file?.workspace.selections.length ?? 0}</dd></div>
                    <div><dt>Warnings</dt><dd>{openPreview.warnings.length ? openPreview.warnings.join(" ") : "None"}</dd></div>
                  </dl>
                  <button type="button" className="saveButton" onClick={() => void handleOpenProject()}>
                    {openPreview.format === "gr8job" && !openPreview.hasSelections ? "Start Inclusions & Selections for this job" : "Open This File"}
                  </button>
                </>
              ) : (
                <p className="errorMessage">This file could not be opened.<br /><small>{"error" in openPreview ? openPreview.error : ""}</small></p>
              )
            ) : null}
          </div>
        </div>
      ) : null}
      {saveAsOpen ? (
        <div className="bannerModal" role="dialog" aria-modal="true">
          <div className="modalPanel narrow">
            <header><h2>Save As</h2><button type="button" onClick={() => setSaveAsOpen(false)}>Cancel</button></header>
            <input value={saveAsName} onChange={(event) => setSaveAsName(event.target.value)} placeholder={`Filename${SELECTIONS_FILE_EXTENSION}`} />
            <p>Save As creates a separate local selections file and leaves the original file unchanged.</p>
            <div className="dialogActions">
              <button type="button" className="saveButton" onClick={() => void handleSaveAs()}>Save As</button>
              <button type="button" onClick={() => setSaveAsOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
      {closeConfirmOpen ? (
        <div className="bannerModal" role="dialog" aria-modal="true">
          <div className="modalPanel narrow">
            <header><h2>Close File</h2><button type="button" onClick={() => setCloseConfirmOpen(false)}>Cancel</button></header>
            <p>{effectiveStatus === "unsaved" || effectiveStatus === "unsaved_file" ? "This selections file has unsaved changes." : "Close the current selections file?"}</p>
            <div className="dialogActions">
              <button type="button" disabled={locked || !hasProject} onClick={() => void handleSave().then(() => handleDiscardClose())}>Save</button>
              <button type="button" onClick={() => void handleDiscardClose()}>Close Without Saving</button>
              <button type="button" onClick={() => setCloseConfirmOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
      <style jsx>{`
        .standardPageBanner {
          max-width: 1320px;
          margin: 0 auto 16px;
          border: 1px solid #d9e2ee;
          border-radius: 12px;
          background: #ffffff;
          color: #172033;
          box-shadow: 0 10px 28px rgba(20, 31, 51, 0.08);
          padding: 24px;
          display: grid;
          grid-template-columns: minmax(420px, 1fr) minmax(280px, 420px) minmax(320px, auto);
          gap: 20px;
          align-items: center;
          position: relative;
        }
        .hiddenFileInput {
          display: none;
        }
        .bannerIdentity {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr);
          gap: 16px;
          align-items: center;
          min-width: 0;
        }
        .moduleIcon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #155e75;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.22), 0 8px 18px rgba(21,94,117,.22);
          display: grid;
          place-content: center;
          gap: 4px;
        }
        .moduleIcon span {
          display: block;
          width: 24px;
          height: 4px;
          border-radius: 999px;
          background: #ffffff;
        }
        .bannerIdentity h1 {
          margin: 0;
          font-size: 48px;
          font-weight: 600;
          line-height: 1.08;
          letter-spacing: 0;
        }
        .bannerIdentity p {
          margin: 8px 0 0;
          color: #526173;
          font-size: 18px;
          font-weight: 400;
          line-height: 1.45;
        }
        .projectDetails {
          display: flex;
          flex-wrap: wrap;
          gap: 6px 10px;
          color: #526173;
          font-size: 13px;
          line-height: 1.35;
          min-width: 0;
        }
        .projectDetails span {
          overflow-wrap: anywhere;
        }
        .projectDetails span:not(:last-child)::after {
          content: "/";
          margin-left: 10px;
          color: #94a3b8;
        }
        .bannerActions, .dialogActions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        button {
          min-height: 40px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          color: #172033;
          font: inherit;
          font-size: 14px;
          font-weight: 750;
          padding: 8px 12px;
          cursor: pointer;
        }
        button:disabled {
          opacity: 0.48;
          cursor: not-allowed;
        }
        .backButton, .saveButton {
          background: #155e75;
          border-color: #155e75;
          color: #fff;
        }
        .saveStatus {
          border-radius: 999px;
          padding: 8px 11px;
          font-size: 12px;
          font-weight: 850;
          background: #ecfdf5;
          color: #166534;
          white-space: nowrap;
        }
        .saveStatus.no_file { background: #f1f5f9; color: #475569; }
        .saveStatus.unsaved_file, .saveStatus.unsaved { background: #fff7ed; color: #9a3412; }
        .saveStatus.saving { background: #eff6ff; color: #1d4ed8; }
        .saveStatus.save_failed { background: #fef2f2; color: #991b1b; }
        .saveStatus.locked_version, .saveStatus.read_only { background: #f1f5f9; color: #475569; }
        .saveStatus.downloaded_copy { background: #fefce8; color: #854d0e; }
        .fileMenu, .recentMenu {
          position: absolute;
          right: 24px;
          top: calc(100% - 16px);
          z-index: 40;
          width: 260px;
          padding: 8px;
          border: 1px solid #d9e2ee;
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
          display: grid;
          gap: 6px;
        }
        .recentMenu {
          top: calc(100% + 236px);
          width: 320px;
        }
        .fileMenu button, .recentMenu button {
          justify-content: flex-start;
          text-align: left;
        }
        .fileMenu hr {
          width: 100%;
          border: 0;
          border-top: 1px solid #e2e8f0;
          margin: 4px 0;
        }
        .recentMenu strong {
          padding: 6px 8px;
        }
        .recentMenu button {
          display: grid;
          gap: 2px;
        }
        .recentMenu small, .recentMenu time {
          color: #64748b;
          font-size: 12px;
        }
        .bannerMessage, .diagnostics {
          grid-column: 1 / -1;
          margin: 0;
          color: #526173;
          font-size: 13px;
        }
        .diagnostics pre {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        .bannerModal {
          position: fixed;
          inset: 0;
          z-index: 80;
          background: rgba(15, 23, 42, 0.42);
          display: grid;
          place-items: center;
          padding: 16px;
        }
        .modalPanel {
          width: min(760px, 96vw);
          max-height: 86vh;
          overflow: auto;
          border-radius: 12px;
          border: 1px solid #d9e2ee;
          background: #fff;
          padding: 18px;
          display: grid;
          gap: 12px;
        }
        .modalPanel.narrow {
          width: min(560px, 96vw);
        }
        .modalPanel header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .modalPanel h2 {
          margin: 0;
        }
        .modalPanel input {
          min-height: 40px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          padding: 8px 10px;
          font: inherit;
        }
        .fieldGroup {
          display: grid;
          gap: 6px;
          color: #172033;
          font-weight: 750;
        }
        .fieldGroup input[aria-invalid="true"] {
          border-color: #dc2626;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12);
        }
        .fieldError, .validationSummary {
          color: #991b1b;
        }
        .validationSummary {
          margin: 0;
          border: 1px solid #fecaca;
          border-radius: 8px;
          background: #fff7f7;
          padding: 10px 12px;
          font-weight: 750;
        }
        .creationState {
          margin: 0;
          border-radius: 999px;
          justify-self: start;
          padding: 7px 10px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 13px;
          font-weight: 850;
        }
        .creationState.validation_required,
        .creationState.failed {
          background: #fef2f2;
          color: #991b1b;
        }
        .creationState.file_created {
          background: #ecfdf5;
          color: #166534;
        }
        .creationState.save_dialog_opened {
          background: #fff7ed;
          color: #9a3412;
        }
        .previewGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin: 0;
        }
        .previewGrid div {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 9px;
        }
        .previewGrid dt {
          color: #64748b;
          font-size: 11px;
          font-weight: 850;
          text-transform: uppercase;
        }
        .previewGrid dd {
          margin: 2px 0 0;
          overflow-wrap: anywhere;
        }
        .errorMessage {
          color: #991b1b;
        }
        @media (max-width: 1120px) {
          .standardPageBanner {
            grid-template-columns: 1fr;
          }
          .bannerActions {
            justify-content: flex-start;
          }
          .fileMenu, .recentMenu {
            left: 24px;
            right: auto;
          }
        }
        @media (max-width: 640px) {
          .standardPageBanner {
            padding: 16px;
          }
          .bannerIdentity {
            grid-template-columns: 48px minmax(0, 1fr);
            align-items: start;
          }
          .bannerIdentity h1 {
            font-size: 34px;
          }
          .bannerIdentity p {
            font-size: 16px;
          }
          .projectDetails {
            font-size: 12px;
          }
          .bannerActions button {
            flex: 1 1 auto;
          }
          .openButton, .saveButton {
            flex-basis: 45%;
          }
          .backButton {
            flex-basis: 100%;
          }
          .previewGrid, .modalPanel header {
            grid-template-columns: 1fr;
            display: grid;
          }
        }
      `}</style>
    </section>
  );
}

export const InclusionsSelectionsProjectBanner = InclusionsSelectionsPageBanner;
