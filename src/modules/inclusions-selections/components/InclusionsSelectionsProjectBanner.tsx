import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useWorkspace } from "../../../../hooks/useWorkspace";
import type { ProjectSelectionContext } from "../repositories/projectAreaRegisterRepository";
import { INCLUSIONS_SELECTIONS_STAGES, PROJECT_REQUIRED_MESSAGE, type InclusionsSelectionsStageId } from "../routing/stageNavigation";
import {
  closeSelectionsProject,
  exportSelectionsProjectFile,
  importSelectionsProjectFile,
  loadProjectFileMenu,
  openSelectionsProject,
  previewSelectionsProjectImport,
  projectDashboardHref,
  registerProjectOpen,
  routeForProject,
  saveSelectionsBuilderTemplate,
  saveSelectionsProject,
  saveSelectionsProjectAs,
  type ProjectFileSummary,
  type SelectionsSaveStatus,
} from "../services/projectFileManagementService";

type Props = {
  currentStage: InclusionsSelectionsStageId;
  context: Partial<ProjectSelectionContext>;
  saveStatus?: SelectionsSaveStatus;
  onSave?: () => Promise<void> | void;
  locked?: boolean;
};

const defaultCopyOptions = {
  projectAreas: true,
  templatesAndTiers: true,
  productSelections: true,
  pricingAndAllowances: true,
  notesAndAttachments: true,
  reviewState: true,
};

function statusLabel(status: SelectionsSaveStatus): string {
  return status === "save_failed" ? "Save Failed" : status === "unsaved" ? "Unsaved Changes" : status === "saving" ? "Saving..." : status === "read_only" ? "Read Only" : status === "locked_version" ? "Locked Version" : "Saved";
}

function fileNameFromContext(context: Partial<ProjectSelectionContext>): string {
  return String(context.projectName ?? context.projectId ?? "Selections Project").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
}

function makeProjectId(name: string): string {
  return `project_${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}_${Date.now()}`;
}

export function InclusionsSelectionsProjectBanner({ currentStage, context, saveStatus, onSave, locked = false }: Props) {
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [autoImportPicker, setAutoImportPicker] = useState(false);
  const [projects, setProjects] = useState<ProjectFileSummary[]>([]);
  const [status, setStatus] = useState<SelectionsSaveStatus>(locked ? "locked_version" : saveStatus ?? "saved");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<"active" | "archived" | "recent">("active");
  const [projectSort, setProjectSort] = useState<"modified" | "name" | "jobNumber">("modified");
  const [draft, setDraft] = useState({ projectName: `${context.projectName ?? "Selections Project"} Copy`, jobNumber: "", clientName: context.clientName ?? "", siteAddress: context.siteAddress ?? "" });
  const [copyOptions, setCopyOptions] = useState(defaultCopyOptions);
  const [importPreview, setImportPreview] = useState<ReturnType<typeof previewSelectionsProjectImport> | null>(null);
  const [importFileMeta, setImportFileMeta] = useState<{ fileName: string; fileSize: number; detectedFormat: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const organisationId = context.organisationId || workspaceId || "";
  const bannerContext = { ...context, organisationId };
  const hasProject = Boolean(organisationId && context.projectId);
  const effectiveStatus = locked ? "locked_version" : saveStatus ?? status;
  const currentStageLabel = INCLUSIONS_SELECTIONS_STAGES.find((stage) => stage.id === currentStage)?.label ?? currentStage;
  const dashboardHref = projectDashboardHref(bannerContext);

  useEffect(() => {
    if (!organisationId) return;
    if (context.projectId) registerProjectOpen({ ...(context as ProjectSelectionContext), organisationId }, currentStage);
    setProjects(loadProjectFileMenu(organisationId));
  }, [organisationId, context.projectId, currentStage]);

  useEffect(() => {
    if (saveStatus) setStatus(saveStatus);
  }, [saveStatus]);

  useEffect(() => {
    if (!importOpen || !autoImportPicker) return;
    const timer = window.setTimeout(() => {
      fileInputRef.current?.click();
      setAutoImportPicker(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [importOpen, autoImportPicker]);

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

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects
      .filter((project) => {
        if (projectFilter === "archived") return project.status === "archived";
        if (projectFilter === "recent") return Boolean(project.recentlyOpenedAt);
        return project.status !== "archived";
      })
      .filter((project) => !term || [project.projectName, project.jobNumber, project.clientName, project.siteAddress].filter(Boolean).join(" ").toLowerCase().includes(term))
      .sort((a, b) => {
        if (projectSort === "name") return String(a.projectName ?? "").localeCompare(String(b.projectName ?? ""));
        if (projectSort === "jobNumber") return String(a.jobNumber ?? "").localeCompare(String(b.jobNumber ?? ""));
        return String(b.lastModified ?? b.recentlyOpenedAt ?? "").localeCompare(String(a.lastModified ?? a.recentlyOpenedAt ?? ""));
      });
  }, [projects, search, projectFilter, projectSort]);

  const pickerEmptyMessage = projects.length === 0
    ? "No saved projects were found for this organisation."
    : search.trim()
      ? "No projects match your search."
      : "No saved projects were found for this organisation.";

  async function confirmUnsaved(): Promise<"continue" | "cancel"> {
    if (effectiveStatus !== "unsaved") return "continue";
    const shouldSave = window.confirm("You have unsaved changes.\n\nChoose OK to Save and Continue, or Cancel to stay on this page.");
    if (!shouldSave) return "cancel";
    await handleSave();
    return "continue";
  }

  async function handleSave() {
    if (locked) return;
    if (!hasProject) {
      setMessage("Open a project before saving.");
      return;
    }
    setStatus("saving");
    try {
      if (onSave) await onSave();
      else await saveSelectionsProject(bannerContext, currentStage);
      setStatus("saved");
      setMessage("Saved.");
    } catch (error) {
      setStatus("save_failed");
      setMessage("Your changes could not be saved. Nothing was discarded.");
    }
  }

  async function handleOpen(project: ProjectFileSummary) {
    if ((await confirmUnsaved()) === "cancel") return;
    const opened = await openSelectionsProject(project);
    setProjectPickerOpen(false);
    await router.push(routeForProject(opened, project.currentStage ?? "areas"));
  }

  async function handleSaveAs() {
    if (!organisationId || !draft.projectName.trim()) return;
    const target: ProjectSelectionContext = {
      organisationId,
      projectId: makeProjectId(draft.projectName),
      projectName: draft.projectName.trim(),
      jobNumber: draft.jobNumber.trim(),
      clientName: draft.clientName.trim(),
      siteAddress: draft.siteAddress.trim(),
    };
    try {
      const created = context.projectId
        ? await saveSelectionsProjectAs(bannerContext, target, copyOptions)
        : registerProjectOpen(target, "areas");
      setSaveAsOpen(false);
      await router.push(routeForProject(created, "areas"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save As failed.");
    }
  }

  async function handleExport() {
    try {
      const exported = await exportSelectionsProjectFile(bannerContext);
      const blob = new Blob([JSON.stringify(exported.file, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exported.fileName;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`Exported ${exported.fileName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed.");
    }
  }

  async function handleImportFile(file: File) {
    setImportFileMeta({
      fileName: file.name,
      fileSize: file.size,
      detectedFormat: file.name.toLowerCase().endsWith(".gr8selections.json") ? ".gr8selections.json" : file.name.toLowerCase().endsWith(".json") ? ".json" : "unsupported",
    });
    if (file.size > 10 * 1024 * 1024 || !file.name.toLowerCase().match(/\.(gr8selections\.json|json)$/)) {
      setImportPreview({ ok: false, error: "This file could not be imported." });
      return;
    }
    const text = await file.text();
    if (text.match(/<script|<\/script>|javascript:|data:text\/html/i)) {
      setImportPreview({ ok: false, error: "This file could not be imported." });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setImportPreview({ ok: false, error: "This file could not be imported." });
      return;
    }
    setImportPreview(previewSelectionsProjectImport(parsed, organisationId));
  }

  async function handleImportAsNew() {
    if (!importPreview?.ok || !organisationId) return;
    const target: ProjectSelectionContext = {
      ...importPreview.file.projectSummary,
      organisationId,
      projectId: makeProjectId(importPreview.file.projectSummary.projectName ?? "imported"),
      projectName: `${importPreview.file.projectSummary.projectName ?? "Imported Project"} Imported`,
    };
    const imported = await importSelectionsProjectFile(importPreview.file, target);
    setImportOpen(false);
    await router.push(routeForProject(imported, "areas"));
  }

  async function handleBack() {
    if ((await confirmUnsaved()) === "cancel") return;
    await router.push(dashboardHref);
  }

  return (
    <section className="projectBanner" aria-label="Inclusions and Selections project banner">
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
        <span className={`saveStatus ${effectiveStatus}`}>{statusLabel(effectiveStatus)}</span>
        <button type="button" onClick={() => { setImportOpen(true); setAutoImportPicker(true); }}>Import Project File</button>
        <button type="button" className="fileButton" onClick={() => setMenuOpen((open) => !open)}>File</button>
        <button type="button" className="saveButton" disabled={locked || !hasProject || effectiveStatus === "saving"} onClick={() => void handleSave()}>Save</button>
        <button type="button" disabled={!hasProject} onClick={() => setSaveAsOpen(true)}>Save As</button>
        {menuOpen ? (
          <div className="fileMenu">
            <button type="button" onClick={() => setSaveAsOpen(true)}>New Selections Project</button>
            <button type="button" onClick={() => setProjectPickerOpen(true)}>Open Existing Job</button>
            <button type="button" onClick={() => { setImportOpen(true); setAutoImportPicker(true); }}>Import Project File</button>
            <button type="button" disabled={!hasProject} onClick={() => void handleExport()}>Export Project File</button>
            <button type="button" disabled={locked || !hasProject} onClick={() => void handleSave()}>Save</button>
            <button type="button" disabled={!hasProject} onClick={() => setSaveAsOpen(true)}>Save As</button>
            <button type="button" disabled={!hasProject} onClick={() => void saveSelectionsBuilderTemplate(bannerContext).then(() => setMessage("Builder template saved."))}>Save as Builder Template</button>
            <button type="button" onClick={() => void router.push(closeSelectionsProject(bannerContext))}>Close Project</button>
          </div>
        ) : null}
      </div>
      {!hasProject ? (
        <div className="requiredActions">
          <button type="button" onClick={() => setProjectPickerOpen(true)}>Open Existing Job</button>
          <button type="button" onClick={() => { setImportOpen(true); setAutoImportPicker(true); }}>Import Project File</button>
          <button type="button" onClick={() => setSaveAsOpen(true)}>Create New Project</button>
          <button type="button" onClick={() => void router.push(dashboardHref)}>Back to Project Dashboard</button>
        </div>
      ) : null}
      {message ? <p className="bannerMessage">{message}</p> : null}
      {projectPickerOpen ? (
        <div className="bannerModal" role="dialog" aria-modal="true">
          <div className="modalPanel">
            <header><h2>Open Existing Job</h2><button type="button" onClick={() => setProjectPickerOpen(false)}>Close</button></header>
            <div className="pickerTools">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search project, job number, client or site" />
              <label>
                Status
                <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value as "active" | "archived" | "recent")}>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="recent">Recently Opened</option>
                </select>
              </label>
              <label>
                Sort
                <select value={projectSort} onChange={(event) => setProjectSort(event.target.value as "modified" | "name" | "jobNumber")}>
                  <option value="modified">Most Recently Modified</option>
                  <option value="name">Project Name</option>
                  <option value="jobNumber">Job Number</option>
                </select>
              </label>
            </div>
            <div className="projectRows">
              {filteredProjects.length ? (
                <div className="projectRow projectHeader">
                  <strong>Project Name</strong>
                  <span>Job Number</span>
                  <span>Client</span>
                  <span>Site Address</span>
                  <span>Current Selections Stage</span>
                  <span>Last Modified</span>
                  <span>Status</span>
                  <span>Open</span>
                </div>
              ) : null}
              {filteredProjects.map((project) => (
                <div key={project.projectId} className="projectRow">
                  <strong>{project.projectName || project.projectId}</strong>
                  <span>{project.jobNumber || "No job number"}</span>
                  <span>{project.clientName || "No client"}</span>
                  <span>{project.siteAddress || "No site address"}</span>
                  <span>{INCLUSIONS_SELECTIONS_STAGES.find((stage) => stage.id === project.currentStage)?.label ?? project.currentStage}</span>
                  <span>{project.lastModified || "Not saved"}</span>
                  <span>{project.status}</span>
                  <button type="button" onClick={() => void handleOpen(project)}>Open</button>
                </div>
              ))}
              {!filteredProjects.length ? <p>{pickerEmptyMessage}</p> : null}
              <div className="dialogActions">
                <button type="button" onClick={() => setSaveAsOpen(true)}>Create New Project</button>
                <button type="button" onClick={() => { setImportOpen(true); setAutoImportPicker(true); }}>Import Project File</button>
                <button type="button" onClick={() => setProjectPickerOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {saveAsOpen ? (
        <div className="bannerModal" role="dialog" aria-modal="true">
          <div className="modalPanel narrow">
            <header><h2>Save As</h2><button type="button" onClick={() => setSaveAsOpen(false)}>Close</button></header>
            <input value={draft.projectName} onChange={(event) => setDraft({ ...draft, projectName: event.target.value })} placeholder="New Project Name" />
            <input value={draft.jobNumber} onChange={(event) => setDraft({ ...draft, jobNumber: event.target.value })} placeholder="New Job Number" />
            <input value={draft.clientName} onChange={(event) => setDraft({ ...draft, clientName: event.target.value })} placeholder="Client" />
            <input value={draft.siteAddress} onChange={(event) => setDraft({ ...draft, siteAddress: event.target.value })} placeholder="Site Address" />
            <div className="copyGrid">
              {Object.entries(copyOptions).map(([key, checked]) => (
                <label key={key}><input type="checkbox" checked={checked} onChange={(event) => setCopyOptions({ ...copyOptions, [key]: event.target.checked })} /> {key.replace(/[A-Z]/g, " $&")}</label>
              ))}
            </div>
            <p>Client approvals, builder approvals, locked snapshots and export history are excluded from ordinary Save As.</p>
            <button type="button" onClick={() => void handleSaveAs()}>Create Separate Project</button>
          </div>
        </div>
      ) : null}
      {importOpen ? (
        <div className="bannerModal" role="dialog" aria-modal="true">
          <div className="modalPanel narrow">
            <header><h2>Import Project File</h2><button type="button" onClick={() => setImportOpen(false)}>Close</button></header>
            <p>Browse your computer and select a supported selections project file. Nothing is imported until you review the preview and confirm.</p>
            <input ref={fileInputRef} type="file" accept=".gr8selections.json,.json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImportFile(file); }} />
            {importFileMeta ? (
              <dl className="previewGrid">
                <div><dt>Selected File</dt><dd>{importFileMeta.fileName}</dd></div>
                <div><dt>File Size</dt><dd>{Math.round(importFileMeta.fileSize / 1024)} KB</dd></div>
                <div><dt>Detected Format</dt><dd>{importFileMeta.detectedFormat}</dd></div>
              </dl>
            ) : null}
            {importPreview ? (
              importPreview.ok ? (
                <>
                  <dl className="previewGrid">
                    <div><dt>Schema Version</dt><dd>{importPreview.file.schemaVersion}</dd></div>
                    <div><dt>Project Name</dt><dd>{importPreview.file.projectSummary.projectName ?? fileNameFromContext(importPreview.file.projectSummary)}</dd></div>
                    <div><dt>Job Number</dt><dd>{importPreview.file.projectSummary.jobNumber || "Not recorded"}</dd></div>
                    <div><dt>Client</dt><dd>{importPreview.file.projectSummary.clientName || "Not recorded"}</dd></div>
                    <div><dt>Site Address</dt><dd>{importPreview.file.projectSummary.siteAddress || "Not recorded"}</dd></div>
                    <div><dt>Areas</dt><dd>{importPreview.file.areasAndLevels.areas.length}</dd></div>
                    <div><dt>Selections</dt><dd>{importPreview.file.workspace.selections.length}</dd></div>
                    <div><dt>Warnings</dt><dd>{importPreview.warnings.length ? importPreview.warnings.join(" ") : "None"}</dd></div>
                  </dl>
                  {importPreview.warnings.length ? <p className="warningMessage">A project with this job number already exists.</p> : null}
                </>
              ) : (
                <p className="errorMessage">This file could not be imported.<br /><small>{"error" in importPreview ? importPreview.error : ""}</small></p>
              )
            ) : null}
            <div className="dialogActions">
              <button type="button" disabled={!importPreview?.ok} onClick={() => void handleImportAsNew()}>Import as New Project</button>
              <button type="button" disabled={!importPreview?.ok} onClick={() => setMessage("Update Existing Project will show a reconciliation preview before any records are changed. No data was changed.")}>Update Existing Project</button>
              <button type="button" onClick={() => setImportOpen(false)}>Cancel</button>
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
        .bannerActions, .requiredActions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
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
        .fileMenu {
          position: absolute;
          right: 12px;
          top: 54px;
          z-index: 40;
          width: 240px;
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
          width: min(980px, 96vw);
          max-height: 86vh;
          overflow: auto;
          border-radius: 8px;
          border: 1px solid #d9e2ee;
          background: #fff;
          padding: 16px;
          display: grid;
          gap: 12px;
        }
        .modalPanel.narrow {
          width: min(560px, 96vw);
        }
        .modalPanel header, .pickerTools {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .modalPanel h2 {
          margin: 0;
        }
        .modalPanel input, .modalPanel select {
          min-height: 36px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          padding: 7px 9px;
          font: inherit;
        }
        .pickerTools input {
          flex: 1;
        }
        .projectRows {
          display: grid;
          gap: 8px;
        }
        .projectRow {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr)) auto;
          gap: 8px;
          align-items: center;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px;
          font-size: 13px;
        }
        .projectHeader {
          background: #f8fafc;
          font-weight: 850;
        }
        .projectRow * {
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .dialogActions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
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
        .copyGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .okMessage, .warningMessage { color: #166534; }
        .warningMessage { color: #9a3412; }
        .errorMessage { color: #991b1b; }
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
          .projectRow {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 560px) {
          .projectBanner {
            padding: 10px;
          }
          .bannerProject span:nth-of-type(n + 3) {
            display: none;
          }
          .bannerActions button {
            flex: 1 1 auto;
          }
          .saveButton {
            flex-basis: 100%;
          }
          .copyGrid, .modalPanel header, .pickerTools {
            grid-template-columns: 1fr;
            display: grid;
          }
        }
      `}</style>
    </section>
  );
}
