import { useEffect, useMemo, useState } from "react";
import DocumentPageBuilder from "../../components/document-engine/editor/DocumentPageBuilder";
import {
  createProjectInclusionsCopy,
  createStandardInclusionsMaster,
  loadStage2State,
  replaceFirstImage,
  replaceFirstText,
  resetProjectCopyFromCurrentMaster,
  restoreStandardInclusionsMasterVersion,
  saveProjectInclusionsCopy,
  saveStage2State,
  saveStandardInclusionsMasterVersion,
} from "../../lib/standard-inclusions/masterProjectStore";
import sourceDocument from "../../standard-inclusions/premier-inclusions-template.full.json";

const ORGANISATION_ID = "qa-builder";
const PHASE1_DB_NAME = "estimate-builder-template-db";
const PHASE1_JOB_STORE = "jobs";
const PHASE1_QA_JOB_KEY = "job:qa-standard-inclusions-phase1";

export default function StandardInclusionsStage2QaPage() {
  const [state, setState] = useState({ activeMaster: null, projects: [] });
  const [selected, setSelected] = useState({ type: "master", id: "" });
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  const activeProject = useMemo(() => state.projects.find((project) => project.projectId === selected.id) || null, [selected.id, state.projects]);
  const activeDocument = selected.type === "project" ? activeProject?.document : state.activeMaster?.document;

  useEffect(() => {
    loadStage2State()
      .then((saved) => {
        if (saved.activeMaster) {
          setState(saved);
          return;
        }
        return loadStage1ImportedSchedule().then((document) => seedMasterFromDocument(document || sourceDocument, false));
      })
      .catch((error) => setStatus(error?.message || "Could not load Standard Inclusions stage 2 state."));
  }, []);

  async function persist(next, message = "Saved.") {
    setState(next);
    await saveStage2State(next);
    setStatus(message);
  }

  async function seedMasterFromDocument(document, resetProjects = true) {
    const master = createStandardInclusionsMaster(document || sourceDocument, {
      organisationId: ORGANISATION_ID,
      templateId: "qa-standard-inclusions-active-master",
      templateName: document?.name || "Premier Inclusions Schedule",
      source: document?.metadata?.sourceFileName || "Premier Inclusions Schedule.pdf",
    });
    await persist({ activeMaster: master, projects: resetProjects ? [] : state.projects }, "Imported Premier schedule saved as active master.");
    setSelected({ type: "master", id: "" });
  }

  async function saveMasterDocument(document, change = "Master edited") {
    const activeMaster = saveStandardInclusionsMasterVersion(state.activeMaster, document, { source: "master-editor", change });
    await persist({ ...state, activeMaster }, `Master saved as version ${activeMaster.version}.`);
  }

  async function saveProjectDocument(project, document) {
    const saved = saveProjectInclusionsCopy(project, document);
    await persist({
      ...state,
      projects: state.projects.map((item) => item.projectId === project.projectId ? saved : item),
    }, `${project.projectName} saved.`);
  }

  async function createProject(projectId, projectName) {
    const copy = createProjectInclusionsCopy(state.activeMaster, { projectId, projectName, organisationId: ORGANISATION_ID });
    await persist({ ...state, projects: [...state.projects.filter((project) => project.projectId !== projectId), copy] }, `${projectName} created.`);
    setSelected({ type: "project", id: projectId });
  }

  async function applyProjectATestEdits() {
    const project = state.projects.find((item) => item.projectId === "project-a");
    if (!project) return;
    let document = replaceFirstText(project.document, "Premier Inclusions", "PROJECT A SMEG INCLUSIONS");
    document = replaceFirstText(document, "Premier range.", "Project A paragraph changed.");
    document = replaceFirstImage(document, "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='320' height='180' fill='%230f766e'/%3E%3Ctext x='28' y='96' fill='white' font-size='26' font-family='Arial'%3EProject A Image%3C/text%3E%3C/svg%3E");
    await saveProjectDocument(project, document);
    setSelected({ type: "project", id: "project-a" });
  }

  async function applyMasterTestEdit() {
    const document = replaceFirstText(state.activeMaster.document, "Premier Inclusions", "MASTER BOSCH INCLUSIONS");
    await saveMasterDocument(document, "Master changed after Project A");
    setSelected({ type: "master", id: "" });
  }

  async function restoreVersion(version) {
    const activeMaster = restoreStandardInclusionsMasterVersion(state.activeMaster, version);
    await persist({ ...state, activeMaster }, `Version ${version} restored as version ${activeMaster.version}.`);
    setSelected({ type: "master", id: "" });
  }

  async function resetProject(project) {
    if (!window.confirm("Reset From Current Master will replace project-specific inclusions edits. Continue?")) return;
    const reset = resetProjectCopyFromCurrentMaster(project, state.activeMaster, { confirmed: true });
    await persist({ ...state, projects: state.projects.map((item) => item.projectId === project.projectId ? reset : item) }, `${project.projectName} reset from current master.`);
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.eyebrow}>STANDARD INCLUSIONS</div>
          <h1 style={styles.title} data-testid="master-title">{state.activeMaster?.templateName || "Premier Inclusions Schedule"}</h1>
          <p style={styles.meta} data-testid="master-page-count">{state.activeMaster?.pageCount || 0} Pages</p>
        </div>
        <div style={styles.statusBox} data-testid="active-master-status">
          <strong>Status:</strong>
          <span>ACTIVE MASTER</span>
          <small>Last Updated: {formatDate(state.activeMaster?.updatedAt)}</small>
        </div>
      </section>

      <section style={styles.actions}>
        <button data-testid="edit-master" style={styles.primaryButton} onClick={() => { setSelected({ type: "master", id: "" }); setEditing(true); }}>Edit Master</button>
        <button data-testid="preview-master" style={styles.secondaryButton} onClick={() => { setSelected({ type: "master", id: "" }); setEditing(false); }}>Preview</button>
        <button data-testid="version-history" style={styles.secondaryButton} onClick={() => setSelected({ type: "history", id: "" })}>Version History</button>
        <button data-testid="replace-master" style={styles.secondaryButton} onClick={() => loadStage1ImportedSchedule().then((document) => seedMasterFromDocument(document || sourceDocument))}>Replace Master</button>
        <button data-testid="create-project-a" style={styles.secondaryButton} onClick={() => createProject("project-a", "TEST PROJECT A")}>Create Test Project A</button>
        <button data-testid="create-project-b" style={styles.secondaryButton} onClick={() => createProject("project-b", "TEST PROJECT B")}>Create Test Project B</button>
        <button data-testid="create-project-c" style={styles.secondaryButton} onClick={() => createProject("project-c", "TEST PROJECT C")}>Create Test Project C</button>
        <button data-testid="apply-master-edit" style={styles.secondaryButton} onClick={applyMasterTestEdit}>Apply Master Test Edit</button>
        <button data-testid="apply-project-a-edits" style={styles.secondaryButton} onClick={applyProjectATestEdits}>Apply Project A Test Edits</button>
        {status ? <span style={styles.notice} data-testid="stage2-status">{status}</span> : null}
      </section>

      <section style={styles.layout}>
        <aside style={styles.sidebar}>
          <button style={selected.type === "master" ? styles.navActive : styles.navButton} onClick={() => setSelected({ type: "master", id: "" })}>
            Master Version {state.activeMaster?.version || 0}
          </button>
          {state.projects.map((project) => (
            <button key={project.projectId} data-testid={`select-${project.projectId}`} style={selected.id === project.projectId ? styles.navActive : styles.navButton} onClick={() => setSelected({ type: "project", id: project.projectId })}>
              {project.projectName}
              <small>Based on Version {project.sourceMasterVersion}</small>
            </button>
          ))}
        </aside>

        <section style={styles.content}>
          {selected.type === "history" ? (
            <VersionHistory master={state.activeMaster} onRestore={restoreVersion} />
          ) : selected.type === "project" && activeProject ? (
            <ProjectPanel project={activeProject} editing={editing} onEdit={() => setEditing(true)} onPreview={() => setEditing(false)} onReset={() => resetProject(activeProject)}>
              <DocumentEditor document={activeDocument} editing={editing} onChange={(document) => saveProjectDocument(activeProject, document)} />
            </ProjectPanel>
          ) : state.activeMaster ? (
            <MasterPanel master={state.activeMaster} editing={editing}>
              <DocumentEditor document={activeDocument} editing={editing} onChange={(document) => saveMasterDocument(document)} />
            </MasterPanel>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function DocumentEditor({ document, editing, onChange }) {
  if (!document) return null;
  return editing ? <DocumentPageBuilder document={document} workbook={{ id: "standard-inclusions-stage2" }} onChange={onChange} onStatus={() => {}} /> : <DocumentPageBuilder document={document} workbook={{ id: "standard-inclusions-stage2" }} readonly onChange={() => {}} onStatus={() => {}} />;
}

function MasterPanel({ master, editing, children }) {
  return (
    <div style={styles.panel}>
      <h2>{editing ? "EDITING MASTER STANDARD INCLUSIONS" : "STANDARD INCLUSIONS"}</h2>
      {editing ? <p style={styles.warning}>Changes made here affect future project copies. They do not alter existing projects.</p> : null}
      <p>Premier Inclusions Schedule - Version {master.version}</p>
      {children}
    </div>
  );
}

function ProjectPanel({ project, editing, onEdit, onPreview, onReset, children }) {
  return (
    <div style={styles.panel}>
      <h2>PROJECT INCLUSIONS</h2>
      <p>Project: {project.projectName}</p>
      <p>Based on: {project.sourceMasterName} - Version {project.sourceMasterVersion}</p>
      <p>Status: Project Copy</p>
      <div style={styles.actionsCompact}>
        <button style={styles.primaryButton} onClick={onEdit}>Edit Project Inclusions</button>
        <button style={styles.secondaryButton} onClick={onPreview}>Preview</button>
        <button style={styles.dangerButton} onClick={onReset}>Reset From Current Master</button>
      </div>
      {editing ? null : <p style={styles.meta}>Project copy is independent from the master.</p>}
      {children}
    </div>
  );
}

function VersionHistory({ master, onRestore }) {
  return (
    <div style={styles.panel}>
      <h2>Version History</h2>
      {(master?.versions || []).map((version) => (
        <article key={`${version.version}-${version.savedAt}`} style={styles.versionRow}>
          <strong>Version {version.version}</strong>
          <span>{formatDate(version.savedAt)}</span>
          <span>Pages: {version.pageCount}</span>
          <span>Source: {version.source}</span>
          <button style={styles.secondaryButton}>View</button>
        <button data-testid={`restore-version-${version.version}`} style={styles.primaryButton} onClick={() => onRestore(version.version)}>Restore</button>
        </article>
      ))}
    </div>
  );
}

async function loadStage1ImportedSchedule() {
  if (typeof window === "undefined" || !window.indexedDB) return null;
  const db = await new Promise((resolve, reject) => {
    const request = window.indexedDB.open(PHASE1_DB_NAME, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("templates")) database.createObjectStore("templates");
      if (!database.objectStoreNames.contains(PHASE1_JOB_STORE)) database.createObjectStore(PHASE1_JOB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open Stage 1 import database."));
  });
  const record = await new Promise((resolve) => {
    const transaction = db.transaction(PHASE1_JOB_STORE, "readonly");
    const request = transaction.objectStore(PHASE1_JOB_STORE).get(PHASE1_QA_JOB_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  });
  const document = record?.workbook?.standardInclusions?.documentBuilder || null;
  return Array.isArray(document?.pages) && document.pages.length === 10 ? document : null;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

StandardInclusionsStage2QaPage.disableLayout = true;

const styles = {
  page: { minHeight: "100vh", background: "#f6f8fb", color: "#0f172a", padding: 22 },
  header: { display: "flex", justifyContent: "space-between", gap: 18, border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 12, padding: 18, marginBottom: 12 },
  eyebrow: { color: "#0f766e", fontSize: 13, fontWeight: 950, letterSpacing: 1.8 },
  title: { margin: "6px 0", fontSize: 34, lineHeight: 1.1 },
  meta: { margin: 0, color: "#475569", fontWeight: 800 },
  statusBox: { display: "grid", gap: 4, border: "1px solid #bae6fd", background: "#eff6ff", borderRadius: 10, padding: 12, minWidth: 220 },
  actions: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 12, padding: 12, marginBottom: 12 },
  actionsCompact: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  layout: { display: "grid", gridTemplateColumns: "240px minmax(0, 1fr)", gap: 12 },
  sidebar: { display: "grid", alignContent: "start", gap: 8, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 12, padding: 10 },
  navButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", borderRadius: 8, padding: 10, textAlign: "left", fontWeight: 900, cursor: "pointer", display: "grid", gap: 4 },
  navActive: { border: "1px solid #166534", background: "#166534", color: "#ffffff", borderRadius: 8, padding: 10, textAlign: "left", fontWeight: 900, cursor: "pointer", display: "grid", gap: 4 },
  content: { minWidth: 0 },
  panel: { display: "grid", gap: 10, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 12, padding: 14 },
  warning: { border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", borderRadius: 8, padding: 10, fontWeight: 900 },
  notice: { border: "1px solid #bae6fd", background: "#eff6ff", borderRadius: 8, padding: "8px 10px", fontWeight: 900 },
  primaryButton: { border: "1px solid #0f766e", background: "#0f766e", color: "#ffffff", borderRadius: 8, padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 8, padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  dangerButton: { border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 8, padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  versionRow: { display: "grid", gridTemplateColumns: "1fr 180px 90px 1fr auto auto", gap: 8, alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 },
};
