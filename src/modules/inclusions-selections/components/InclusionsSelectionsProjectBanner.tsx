import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useWorkspace } from "../../../../hooks/useWorkspace";
import type { ProjectSelectionContext } from "../repositories/projectAreaRegisterRepository";
import { INCLUSIONS_SELECTIONS_STAGES, PROJECT_REQUIRED_MESSAGE, type InclusionsSelectionsStageId } from "../routing/stageNavigation";
import {
  closeSelectionsProject,
  exportSelectionsProjectFile,
  importSelectionsProjectFile,
  preparePortableSelectionsFileForLocalSave,
  previewSelectionsProjectImport,
  projectDashboardHref,
  routeForProject,
  saveSelectionsProject,
  type PortableSelectionsFile,
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
  createWritable?: () => Promise<{
    write: (data: string) => Promise<void> | void;
    close: () => Promise<void> | void;
  }>;
};

type LocalSaveStatus = SelectionsSaveStatus | "downloaded_copy";

type NewProjectDraft = {
  projectName: string;
  jobNumber: string;
  clientName: string;
  siteAddress: string;
  builder: string;
  estimator: string;
};

const emptyNewProject: NewProjectDraft = {
  projectName: "",
  jobNumber: "",
  clientName: "",
  siteAddress: "",
  builder: "",
  estimator: "",
};

function statusLabel(status: LocalSaveStatus): string {
  if (status === "save_failed") return "Save Failed";
  if (status === "unsaved") return "Unsaved Changes";
  if (status === "saving") return "Saving...";
  if (status === "read_only") return "Read Only";
  if (status === "locked_version") return "Locked Version";
  if (status === "downloaded_copy") return "Updated Copy Downloaded";
  return "Saved";
}

function safeFileName(context: Partial<ProjectSelectionContext>, suffix = ""): string {
  const base = [context.projectName ?? context.projectId ?? "Selections Project", context.jobNumber].filter(Boolean).join("-");
  const cleaned = base.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Selections-Project";
  return `${cleaned}${suffix}.gr8selections.json`;
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
  link.click();
  URL.revokeObjectURL(url);
}

function filePickerOptions() {
  return {
    types: [
      {
        description: "Gr8 Result Selections Project",
        accept: {
          "application/json": [".gr8selections.json", ".json"],
        },
      },
    ],
  };
}

export function InclusionsSelectionsProjectBanner({ currentStage, context, saveStatus, onSave, locked = false }: Props) {
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [openPreview, setOpenPreview] = useState<ReturnType<typeof previewSelectionsProjectImport> | null>(null);
  const [openPreviewVisible, setOpenPreviewVisible] = useState(false);
  const [openFileMeta, setOpenFileMeta] = useState<{ fileName: string; fileSize: number; detectedFormat: string } | null>(null);
  const [pendingFileHandle, setPendingFileHandle] = useState<LocalFileHandle | null>(null);
  const [localFileHandle, setLocalFileHandle] = useState<LocalFileHandle | null>(null);
  const [activeFileMetadata, setActiveFileMetadata] = useState<{ fileId: string; createdAt: string } | null>(null);
  const [localFileName, setLocalFileName] = useState("Unsaved File");
  const [status, setStatus] = useState<LocalSaveStatus>(locked ? "locked_version" : saveStatus ?? (context.projectId ? "saved" : "unsaved"));
  const [message, setMessage] = useState("");
  const [newDraft, setNewDraft] = useState<NewProjectDraft>({
    ...emptyNewProject,
    projectName: context.projectName ?? "",
    jobNumber: context.jobNumber ?? "",
    clientName: context.clientName ?? "",
    siteAddress: context.siteAddress ?? "",
  });
  const [saveAsName, setSaveAsName] = useState(safeFileName(context));
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  const organisationId = context.organisationId || workspaceId || "";
  const bannerContext = { ...context, organisationId };
  const hasProject = Boolean(organisationId && context.projectId);
  const effectiveStatus = locked ? "locked_version" : saveStatus ?? status;
  const currentStageLabel = INCLUSIONS_SELECTIONS_STAGES.find((stage) => stage.id === currentStage)?.label ?? currentStage;
  const dashboardHref = projectDashboardHref(bannerContext);

  useEffect(() => {
    if (saveStatus) setStatus(saveStatus);
  }, [saveStatus]);

  useEffect(() => {
    if (!hasProject) {
      setLocalFileName("Unsaved File");
      setStatus((current) => current === "saving" ? current : "unsaved");
      return;
    }
    setLocalFileName((current) => current === "Unsaved File" ? safeFileName(bannerContext) : current);
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
    return () => window.removeEventListener("keydown", handler);
  });

  async function confirmUnsaved(): Promise<"continue" | "cancel"> {
    if (effectiveStatus !== "unsaved") return "continue";
    const shouldContinue = window.confirm("You have unsaved changes. Continue without saving?");
    return shouldContinue ? "continue" : "cancel";
  }

  async function serialiseCurrentProject(mode: "save" | "save_as" = "save"): Promise<{ fileName: string; text: string; file: PortableSelectionsFile }> {
    const exported = await exportSelectionsProjectFile(bannerContext);
    const baseFile: PortableSelectionsFile = activeFileMetadata
      ? { ...exported.file, fileId: activeFileMetadata.fileId, createdAt: activeFileMetadata.createdAt }
      : exported.file;
    const file = preparePortableSelectionsFileForLocalSave(baseFile, mode);
    const text = JSON.stringify(file, null, 2);
    return { fileName: exported.fileName, text, file };
  }

  async function handleNew() {
    if (!newDraft.projectName.trim() || !newDraft.jobNumber.trim() || !newDraft.clientName.trim() || !newDraft.siteAddress.trim() || !newDraft.builder.trim() || !newDraft.estimator.trim()) {
      setMessage("Project Name, Job Number, Client, Site Address, Builder and Estimator are required.");
      return;
    }
    const target: ProjectSelectionContext = {
      organisationId: organisationId || "local_builder",
      projectId: makeProjectId(newDraft),
      projectName: newDraft.projectName.trim(),
      jobNumber: newDraft.jobNumber.trim(),
      clientName: newDraft.clientName.trim(),
      siteAddress: newDraft.siteAddress.trim(),
    };
    setLocalFileHandle(null);
    setActiveFileMetadata(null);
    setLocalFileName("Unsaved File");
    setStatus("unsaved");
    setMessage("Unsaved File");
    setNewOpen(false);
    await router.push(routeForProject(target, "areas"));
  }

  async function processPickedFile(file: File, handle: LocalFileHandle | null) {
    setOpenFileMeta({
      fileName: file.name,
      fileSize: file.size,
      detectedFormat: file.name.toLowerCase().endsWith(".gr8selections.json") ? ".gr8selections.json" : file.name.toLowerCase().endsWith(".json") ? ".json" : "unsupported",
    });
    setPendingFileHandle(handle);
    setOpenPreviewVisible(true);
    if (file.size > 10 * 1024 * 1024 || !file.name.toLowerCase().match(/\.(gr8selections\.json|json)$/)) {
      setOpenPreview({ ok: false, error: "This file could not be opened." });
      return;
    }
    const text = await file.text();
    if (text.match(/<script|<\/script>|javascript:|data:text\/html/i)) {
      setOpenPreview({ ok: false, error: "This file could not be opened." });
      return;
    }
    try {
      setOpenPreview(previewSelectionsProjectImport(JSON.parse(text), organisationId));
    } catch {
      setOpenPreview({ ok: false, error: "This file could not be opened." });
    }
  }

  async function handleOpenFile() {
    if ((await confirmUnsaved()) === "cancel") return;
    setMessage("");
    const picker = filePickerWindow();
    if (picker.showOpenFilePicker) {
      try {
        const [handle] = await picker.showOpenFilePicker({ ...filePickerOptions(), multiple: false });
        const file = await handle.getFile();
        await processPickedFile(file, handle);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "Open File failed.");
        return;
      }
    }
    fileInputRef.current?.click();
  }

  async function handleFallbackOpenFile(file: File) {
    if ((await confirmUnsaved()) === "cancel") return;
    await processPickedFile(file, null);
  }

  async function handleOpenProject() {
    if (!openPreview?.ok || !openFileMeta) return;
    const opened = await importSelectionsProjectFile(openPreview.file, openPreview.file.projectSummary);
    setLocalFileHandle(pendingFileHandle);
    setActiveFileMetadata({ fileId: openPreview.file.fileId, createdAt: openPreview.file.createdAt });
    setLocalFileName(openFileMeta.fileName);
    setStatus("saved");
    setMessage("Saved to file.");
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
        setLocalFileName(localFileHandle.name);
        setActiveFileMetadata({ fileId: serialised.file.fileId, createdAt: serialised.file.createdAt });
        setStatus("saved");
        setMessage("Saved to file.");
        return;
      }
      const downloadName = localFileName === "Unsaved File" ? serialised.fileName : localFileName;
      downloadJson(downloadName, serialised.text);
      setLocalFileName(downloadName);
      setActiveFileMetadata({ fileId: serialised.file.fileId, createdAt: serialised.file.createdAt });
      setStatus("downloaded_copy");
      setMessage(`Updated copy downloaded as ${downloadName}. The original file was not overwritten.`);
    } catch (error) {
      setStatus("save_failed");
      setMessage(error instanceof Error ? error.message : "Your changes could not be saved. Nothing was discarded.");
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
      const suggestedName = saveAsName.trim() || safeFileName(bannerContext);
      const picker = filePickerWindow();
      if (picker.showSaveFilePicker) {
        const handle = await picker.showSaveFilePicker({ ...filePickerOptions(), suggestedName });
        await writeFile(handle, serialised.text);
        setLocalFileHandle(handle);
        setLocalFileName(handle.name);
        setActiveFileMetadata({ fileId: serialised.file.fileId, createdAt: serialised.file.createdAt });
        setStatus("saved");
        setMessage("Saved to file.");
      } else {
        downloadJson(suggestedName, serialised.text);
        setLocalFileHandle(null);
        setLocalFileName(suggestedName);
        setActiveFileMetadata({ fileId: serialised.file.fileId, createdAt: serialised.file.createdAt });
        setStatus("downloaded_copy");
        setMessage(`Updated copy downloaded as ${suggestedName}.`);
      }
      setSaveAsOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("save_failed");
      setMessage(error instanceof Error ? error.message : "Save As failed.");
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
      setMessage(error instanceof Error ? error.message : "Export Backup failed.");
    }
  }

  async function handleBack() {
    if ((await confirmUnsaved()) === "cancel") return;
    await router.push(dashboardHref);
  }

  async function handleDiscardClose() {
    setCloseConfirmOpen(false);
    setLocalFileHandle(null);
    setActiveFileMetadata(null);
    setLocalFileName("Unsaved File");
    setStatus("unsaved");
    await router.push(closeSelectionsProject(bannerContext));
  }

  return (
    <section className="projectBanner" aria-label="Inclusions and Selections project banner">
      <input
        ref={fileInputRef}
        className="hiddenFileInput"
        type="file"
        accept=".gr8selections.json,.json,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFallbackOpenFile(file);
          event.currentTarget.value = "";
        }}
      />
      <div className="bannerLeft">
        <button type="button" className="backButton" onClick={() => void handleBack()}>Back to Project Dashboard</button>
      </div>
      <div className="bannerProject">
        {hasProject ? (
          <>
            <strong>{context.projectName || "Selections Project"}</strong>
            <span>{context.jobNumber ? `Job ${context.jobNumber}` : "Job number not recorded"}</span>
            <span>{context.clientName || "Client not recorded"}</span>
            <span>{context.siteAddress || "Site address not recorded"}</span>
            <em>Selections - {currentStageLabel}</em>
          </>
        ) : (
          <>
            <strong>Project required</strong>
            <span>{PROJECT_REQUIRED_MESSAGE}</span>
          </>
        )}
      </div>
      <div className="bannerActions">
        <span className="fileName">{localFileName}</span>
        <span className={`saveStatus ${effectiveStatus}`}>{statusLabel(effectiveStatus)}</span>
        <button type="button" onClick={() => setNewOpen(true)}>New</button>
        <button type="button" onClick={() => void handleOpenFile()}>Open File</button>
        <button type="button" className="saveButton" disabled={locked || !hasProject || effectiveStatus === "saving"} onClick={() => void handleSave()}>Save</button>
        <button type="button" disabled={!hasProject} onClick={() => setSaveAsOpen(true)}>Save As</button>
        <button type="button" className="fileButton" onClick={() => setMenuOpen((open) => !open)}>File</button>
        {menuOpen ? (
          <div className="fileMenu">
            <button type="button" onClick={() => setNewOpen(true)}>New</button>
            <button type="button" onClick={() => void handleOpenFile()}>Open File</button>
            <button type="button" disabled={locked || !hasProject} onClick={() => void handleSave()}>Save</button>
            <button type="button" disabled={!hasProject} onClick={() => setSaveAsOpen(true)}>Save As</button>
            <button type="button" disabled={!hasProject} onClick={() => void handleExportBackup()}>Export Backup</button>
            <button type="button" disabled={!hasProject} onClick={() => setCloseConfirmOpen(true)}>Close File</button>
          </div>
        ) : null}
      </div>
      {!hasProject ? (
        <div className="requiredActions">
          <button type="button" onClick={() => setNewOpen(true)}>New</button>
          <button type="button" onClick={() => void handleOpenFile()}>Open File</button>
          <button type="button" onClick={() => void router.push(dashboardHref)}>Back to Project Dashboard</button>
        </div>
      ) : null}
      {message ? <p className="bannerMessage">{message}</p> : null}
      {newOpen ? (
        <div className="bannerModal" role="dialog" aria-modal="true">
          <div className="modalPanel narrow">
            <header><h2>New Selections File</h2><button type="button" onClick={() => setNewOpen(false)}>Close</button></header>
            <input value={newDraft.projectName} onChange={(event) => setNewDraft({ ...newDraft, projectName: event.target.value })} placeholder="Project Name" />
            <input value={newDraft.jobNumber} onChange={(event) => setNewDraft({ ...newDraft, jobNumber: event.target.value })} placeholder="Job Number" />
            <input value={newDraft.clientName} onChange={(event) => setNewDraft({ ...newDraft, clientName: event.target.value })} placeholder="Client" />
            <input value={newDraft.siteAddress} onChange={(event) => setNewDraft({ ...newDraft, siteAddress: event.target.value })} placeholder="Site Address" />
            <input value={newDraft.builder} onChange={(event) => setNewDraft({ ...newDraft, builder: event.target.value })} placeholder="Builder" />
            <input value={newDraft.estimator} onChange={(event) => setNewDraft({ ...newDraft, estimator: event.target.value })} placeholder="Estimator" />
            <button type="button" onClick={() => void handleNew()}>Create Unsaved File</button>
          </div>
        </div>
      ) : null}
      {openPreviewVisible ? (
        <div className="bannerModal" role="dialog" aria-modal="true">
          <div className="modalPanel narrow">
            <header><h2>Open File</h2><button type="button" onClick={() => setOpenPreviewVisible(false)}>Close</button></header>
            {openFileMeta ? (
              <dl className="previewGrid">
                <div><dt>Selected File</dt><dd>{openFileMeta.fileName}</dd></div>
                <div><dt>File Size</dt><dd>{Math.round(openFileMeta.fileSize / 1024)} KB</dd></div>
                <div><dt>Detected Format</dt><dd>{openFileMeta.detectedFormat}</dd></div>
              </dl>
            ) : null}
            {openPreview ? (
              openPreview.ok ? (
                <>
                  <dl className="previewGrid">
                    <div><dt>File Version</dt><dd>{openPreview.file.schemaVersion}</dd></div>
                    <div><dt>Project Name</dt><dd>{openPreview.file.projectSummary.projectName || "Not recorded"}</dd></div>
                    <div><dt>Job Number</dt><dd>{openPreview.file.projectSummary.jobNumber || "Not recorded"}</dd></div>
                    <div><dt>Client</dt><dd>{openPreview.file.projectSummary.clientName || "Not recorded"}</dd></div>
                    <div><dt>Site Address</dt><dd>{openPreview.file.projectSummary.siteAddress || "Not recorded"}</dd></div>
                    <div><dt>Warnings</dt><dd>{openPreview.warnings.length ? openPreview.warnings.join(" ") : "None"}</dd></div>
                  </dl>
                  <button type="button" onClick={() => void handleOpenProject()}>Open Project</button>
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
            <header><h2>Save As</h2><button type="button" onClick={() => setSaveAsOpen(false)}>Close</button></header>
            <input value={saveAsName} onChange={(event) => setSaveAsName(event.target.value)} placeholder="Filename.gr8selections.json" />
            <p>Save As creates a separate local selections file and leaves the original file unchanged.</p>
            <button type="button" onClick={() => void handleSaveAs()}>Save As</button>
          </div>
        </div>
      ) : null}
      {closeConfirmOpen ? (
        <div className="bannerModal" role="dialog" aria-modal="true">
          <div className="modalPanel narrow">
            <header><h2>Close File</h2><button type="button" onClick={() => setCloseConfirmOpen(false)}>Cancel</button></header>
            <p>{effectiveStatus === "unsaved" ? "This selections file has unsaved changes." : "Close the current selections file?"}</p>
            <div className="dialogActions">
              <button type="button" disabled={locked || !hasProject} onClick={() => void handleSave().then(() => handleDiscardClose())}>Save</button>
              <button type="button" onClick={() => void handleDiscardClose()}>Discard</button>
              <button type="button" onClick={() => setCloseConfirmOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
      <style jsx>{`
        .projectBanner {
          max-width: 1320px;
          margin: 0 auto 12px;
          border: 1px solid #d9e2ee;
          border-radius: 8px;
          background: #ffffff;
          color: #172033;
          box-shadow: 0 1px 2px rgba(20, 31, 51, 0.05);
          padding: 12px;
          display: grid;
          grid-template-columns: minmax(180px, 240px) minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          position: relative;
        }
        .hiddenFileInput {
          display: none;
        }
        .bannerProject {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px 12px;
          min-width: 0;
        }
        .bannerProject strong {
          flex-basis: 100%;
          font-size: 18px;
          overflow-wrap: anywhere;
        }
        .bannerProject span, .bannerProject em, .bannerMessage {
          color: #607086;
          font-size: 12px;
        }
        .bannerProject em {
          font-style: normal;
          font-weight: 750;
          color: #155e75;
        }
        .bannerActions, .requiredActions, .dialogActions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .fileName {
          max-width: 260px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #f8fafc;
          color: #334155;
          font-size: 12px;
          font-weight: 800;
          padding: 7px 9px;
          overflow-wrap: anywhere;
        }
        button {
          min-height: 36px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          color: #172033;
          font: inherit;
          font-size: 13px;
          font-weight: 750;
          padding: 7px 10px;
          cursor: pointer;
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .backButton, .saveButton {
          background: #155e75;
          border-color: #155e75;
          color: #fff;
        }
        .saveStatus {
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 12px;
          font-weight: 800;
          background: #ecfdf5;
          color: #166534;
        }
        .saveStatus.unsaved { background: #fff7ed; color: #9a3412; }
        .saveStatus.saving { background: #eff6ff; color: #1d4ed8; }
        .saveStatus.save_failed { background: #fef2f2; color: #991b1b; }
        .saveStatus.locked_version, .saveStatus.read_only { background: #f1f5f9; color: #475569; }
        .saveStatus.downloaded_copy { background: #fefce8; color: #854d0e; }
        .fileMenu {
          position: absolute;
          right: 12px;
          top: 54px;
          z-index: 40;
          width: 220px;
          padding: 8px;
          border: 1px solid #d9e2ee;
          border-radius: 8px;
          background: #fff;
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.16);
          display: grid;
          gap: 6px;
        }
        .fileMenu button {
          justify-content: flex-start;
          text-align: left;
        }
        .requiredActions, .bannerMessage {
          grid-column: 1 / -1;
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
          width: min(560px, 96vw);
          max-height: 86vh;
          overflow: auto;
          border-radius: 8px;
          border: 1px solid #d9e2ee;
          background: #fff;
          padding: 16px;
          display: grid;
          gap: 12px;
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
          min-height: 36px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          padding: 7px 9px;
          font: inherit;
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
          padding: 8px;
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
        @media (max-width: 900px) {
          .projectBanner {
            grid-template-columns: 1fr;
          }
          .bannerActions, .requiredActions {
            justify-content: flex-start;
          }
          .fileMenu {
            left: 12px;
            right: auto;
          }
        }
        @media (max-width: 560px) {
          .projectBanner {
            padding: 10px;
          }
          .bannerProject span:nth-of-type(n + 3) {
            display: none;
          }
          .bannerActions button, .fileName {
            flex: 1 1 auto;
          }
          .saveButton, .fileName {
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
