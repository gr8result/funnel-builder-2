import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Copy, Download, Eye, FileClock, FilePlus2, Pencil, RotateCcw, Settings2, Sparkles, Upload, X } from "lucide-react";
import { supabase } from "../../../utils/supabase-client";
import { useWorkspace } from "../../../hooks/useWorkspace";

function libraryRequestError(response, payload, fallback) {
  if (response.status === 401) return "Your session could not be verified. Sign in again, then retry.";
  if (response.status === 403) return "You do not have access to this builder workspace. Choose an authorised workspace, then retry.";
  return payload?.error || fallback;
}

function libraryTransportError(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "The schedule library is taking too long to respond. Check the connection and retry.";
  if (error instanceof TypeError) return "The schedule library could not be reached. Check the connection and retry.";
  return error?.message || "Standard Inclusions request failed.";
}

function PdfCover({ schedule, token, workspaceId }) {
  const scheduleId = schedule?.currentVersion ? schedule.id : "";
  const title = schedule?.name || "Inclusions brochure";
  const [error, setError] = useState("");
  const [canvasNode, setCanvasNode] = useState(null);

  useEffect(() => { setError(""); }, [scheduleId, token, workspaceId]);

  useEffect(() => {
    if (!scheduleId || !token || !workspaceId || !canvasNode || error) return undefined;
    let disposed = false;
    let loadingTask;
    const controller = new AbortController();

    async function renderCover() {
      try {
        const response = await fetch(`/api/standard-inclusions/pdf-library?download=${encodeURIComponent(scheduleId)}`, {
          headers: { Authorization: `Bearer ${token}`, "x-workspace-id": workspaceId },
          signal: controller.signal,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(libraryRequestError(response, payload, "Cover PDF could not be loaded."));
        }
        const data = new Uint8Array(await response.arrayBuffer());
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        loadingTask = pdfjs.getDocument({ data });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        if (disposed) return;
        const frame = canvasNode.parentElement.getBoundingClientRect();
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(frame.width / baseViewport.width, frame.height / baseViewport.height) * (window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });
        canvasNode.width = viewport.width;
        canvasNode.height = viewport.height;
        await page.render({ canvas: canvasNode, viewport }).promise;
      } catch (error) {
        if (!disposed && error?.name !== "AbortError") setError(error.message || "Cover preview could not be loaded.");
      }
    }

    renderCover();
    return () => {
      disposed = true;
      controller.abort();
      loadingTask?.destroy?.();
    };
  }, [scheduleId, token, workspaceId, canvasNode, error]);

  return (
    <div className="coverFrame" aria-label={`${title} brochure cover`}>
      {scheduleId && !error ? <canvas ref={setCanvasNode} /> : (
        <div className={`generatedCover cover-${String(schedule?.metadata?.brochureBuilder?.designStyle || "Modern").toLowerCase()}`}>
          <div className="generatedCoverImage" />
          <div className="generatedCoverCopy">
            <small>{schedule?.metadata?.brochureBuilder?.packageChoice || schedule?.tierKey || "Custom"} collection</small>
            <strong>{title}</strong>
            <span>{schedule?.metadata?.brochureBranding?.snapshot?.businessName || "Builder inclusions"}</span>
          </div>
          {error ? <span className="coverError" role="alert">{error}</span> : null}
          {error ? <button type="button" className="secondaryButton" onClick={() => setError("")}><RotateCcw size={15} /> Retry cover</button> : null}
        </div>
      )}
    </div>
  );
}

function PdfPreview({ schedule, versionId, token, workspaceId }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let objectUrl = "";
    const controller = new AbortController();
    setUrl("");
    setError("");
    fetch(`/api/standard-inclusions/pdf-library?download=${encodeURIComponent(schedule.id)}${versionId ? `&version=${encodeURIComponent(versionId)}` : ""}`, {
      headers: { Authorization: `Bearer ${token}`, "x-workspace-id": workspaceId },
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(libraryRequestError(response, payload, "Brochure preview could not be loaded."));
      }
      return response.blob();
    }).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch((nextError) => {
      if (nextError?.name !== "AbortError") setError(nextError.message || "Brochure preview could not be loaded.");
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [schedule.id, versionId, token, workspaceId]);

  if (error) return <div className="statePanel" role="alert">{error}</div>;
  return url ? <iframe title={`${schedule.name} PDF preview`} src={`${url}#toolbar=0&navpanes=0`} /> : <div className="statePanel">Loading brochure preview…</div>;
}

function getWorkspaceId() {
  return typeof window === "undefined" ? "" : localStorage.getItem("active_workspace_id") || "";
}

function formatDate(value) {
  if (!value) return "Not updated";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Not updated";
}

export default function StandardInclusionsLibrary() {
  const router = useRouter();
  const { workspaceId, loading: workspaceLoading } = useWorkspace();
  const [token, setToken] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [archivedVisible, setArchivedVisible] = useState(false);
  const [historyId, setHistoryId] = useState("");
  const [dialog, setDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", tierKey: "" });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [projectAssignmentSchedule, setProjectAssignmentSchedule] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [applyingToProject, setApplyingToProject] = useState(false);
  const loadSequence = useRef(0);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => { setToken(data?.session?.access_token || ""); setAuthReady(true); })
      .catch(() => { setToken(""); setAuthReady(true); });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => { setToken(session?.access_token || ""); setAuthReady(true); });
    return () => {
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  async function request(path, options = {}) {
    if (!token) throw new Error("Sign in to manage Standard Inclusions schedules.");
    if (!workspaceId) throw new Error("Choose an active builder workspace first.");
    const { timeoutMs, ...fetchOptions } = options;
    const method = String(fetchOptions.method || "GET").toUpperCase();
    const response = await fetch(path, {
      ...fetchOptions,
      signal: fetchOptions.signal || AbortSignal.timeout(timeoutMs || (method === "GET" ? 15000 : 60000)),
      headers: {
        Authorization: `Bearer ${token}`,
        "x-workspace-id": workspaceId,
        ...(fetchOptions.headers || {}),
      },
    });
    const payload = fetchOptions.body instanceof FormData ? await response.json().catch(() => ({})) : await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) throw new Error(libraryRequestError(response, payload, "Standard Inclusions request failed."));
    return payload;
  }

  async function loadSchedules() {
    const sequence = ++loadSequence.current;
    const requestedWorkspace = workspaceId;
    setLoading(true);
    setError("");
    try {
      const payload = await request(`/api/standard-inclusions/pdf-library${archivedVisible ? "?includeArchived=true" : ""}`);
      if (sequence !== loadSequence.current || requestedWorkspace !== getWorkspaceId()) return;
      setSchedules(Array.isArray(payload.schedules) ? payload.schedules : []);
    } catch (loadError) {
      if (sequence !== loadSequence.current || requestedWorkspace !== getWorkspaceId()) return;
      setSchedules([]);
      setError(libraryTransportError(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (workspaceLoading) return;
    if (token && workspaceId) loadSchedules();
    else if (authReady) {
      setLoading(false);
      setSchedules([]);
      setError(token ? "Choose an active builder workspace to view schedules." : "Sign in to view Standard Inclusions schedules.");
    }
  }, [token, workspaceId, workspaceLoading, archivedVisible, authReady]);

  const activeCount = useMemo(() => schedules.filter((schedule) => schedule.status !== "archived").length, [schedules]);
  const publishedCount = useMemo(() => schedules.filter((schedule) => schedule.metadata?.workflowStatus === "Published").length, [schedules]);
  const reviewCount = useMemo(() => schedules.filter((schedule) => ["Needs Review", "Approved"].includes(schedule.metadata?.workflowStatus)).length, [schedules]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", packageChoice: "Mid-range", tierKey: "Premier", priceLevel: "mid-range" });
    setFile(null);
    setDialog("create");
  }

  function openImport() {
    setEditing(null);
    setForm({ name: "", description: "Imported reference brochure", tierKey: "" });
    setFile(null);
    setDialog("import");
  }

  function openEdit(schedule) {
    setEditing(schedule);
    setForm({ name: schedule.name || "", description: schedule.description || "", tierKey: schedule.tierKey || "" });
    setFile(null);
    setDialog("edit");
  }

  async function submitSchedule(event) {
    event.preventDefault();
    if (!file && dialog === "import") {
      setError("Choose a reference brochure PDF to import.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (dialog === "create") {
        const packageMap = {
          Budget: { tierKey: "Classic", priceLevel: "budget" },
          "Mid-range": { tierKey: "Premier", priceLevel: "mid-range" },
          "High-end": { tierKey: "Premium", priceLevel: "high-end" },
          Custom: { tierKey: "Premier", priceLevel: "mid-range" },
        };
        const selectedPackage = packageMap[form.packageChoice] || packageMap["Mid-range"];
        const payload = await request("/api/standard-inclusions/pdf-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            description: "",
            tierKey: selectedPackage.tierKey,
            metadata: {
              schemaVersion: 2,
              workflowStatus: "Draft",
              brochureBuilder: {
                currentStep: 1,
                packageChoice: form.packageChoice,
                priceLevel: selectedPackage.priceLevel,
                designStyle: "Modern",
                selectedImages: [],
                sectionAssignments: {},
              },
            },
          }),
        });
        setDialog(null);
        window.location.assign(`/modules/builders/standard-inclusions/${encodeURIComponent(payload.schedule.id)}`);
        return;
      } else if (dialog === "edit" && editing) {
        await request("/api/standard-inclusions/pdf-library", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update", scheduleId: editing.id, ...form }),
        });
        if (file) {
          const upload = new FormData();
          upload.append("action", "replace");
          upload.append("scheduleId", editing.id);
          upload.append("file", file);
          await request("/api/standard-inclusions/pdf-library", { method: "POST", body: upload });
        }
        setNotice("Schedule saved. Previous PDF versions remain in history.");
      } else if (dialog === "import") {
        const upload = new FormData();
        upload.append("name", form.name);
        upload.append("description", form.description);
        upload.append("tierKey", form.tierKey);
        upload.append("file", file);
        await request("/api/standard-inclusions/pdf-library", { method: "POST", body: upload });
        setNotice("Reference brochure added to your library.");
      }
      setDialog(null);
      await loadSchedules();
    } catch (saveError) {
      setError(saveError.message || "Could not save the schedule.");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action, schedule) {
    setError("");
    setNotice("");
    try {
      if (action === "archive" && !window.confirm(`Archive “${schedule.name}”? The schedule and its versions will remain available in the archive.`)) return;
      const payload = await request("/api/standard-inclusions/pdf-library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, scheduleId: schedule.id, ...(schedule.versionId ? { versionId: schedule.versionId } : {}) }),
      });
      if (action === "duplicate") setNotice(`Created “${payload.schedule.name}” as a separate schedule.`);
      if (action === "archive") setNotice(`“${schedule.name}” was archived.`);
      if (action === "restore") setNotice("A new version was created from the selected version; the prior version remains available.");
      await loadSchedules();
    } catch (actionError) {
      setError(actionError.message || "Schedule action failed.");
    }
  }

  async function openProjectAssignment(schedule) {
    setProjectAssignmentSchedule(schedule);
    setSelectedProjectId("");
    setProjects([]);
    setError("");
    setLoadingProjects(true);
    try {
      const result = await request("/api/standard-inclusions/projects");
      setProjects(result.projects || []);
    } catch (projectError) {
      setError(projectError.message || "Could not load workspace projects.");
    } finally {
      setLoadingProjects(false);
    }
  }

  async function applyScheduleToProject(event) {
    event.preventDefault();
    if (!projectAssignmentSchedule || !selectedProjectId) return;
    setApplyingToProject(true);
    setError("");
    setNotice("");
    try {
      const result = await request("/api/standard-inclusions/apply-to-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: projectAssignmentSchedule.id, projectId: selectedProjectId }),
      });
      setProjectAssignmentSchedule(null);
      setNotice(`Applied ${result.document.title} to ${result.project.project_name}. Existing quotation values were not changed.`);
    } catch (applyError) {
      setError(applyError.message || "Could not apply the schedule.");
    } finally {
      setApplyingToProject(false);
    }
  }

  async function downloadPdf(schedule, versionId = "") {
    setError("");
    try {
      const response = await fetch(`/api/standard-inclusions/pdf-library?download=${encodeURIComponent(schedule.id)}${versionId ? `&version=${encodeURIComponent(versionId)}` : ""}`, {
        headers: { Authorization: `Bearer ${token}`, "x-workspace-id": workspaceId },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Could not download this brochure.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = (schedule.versions || []).find((version) => version.id === versionId)?.originalFilename
        || schedule.currentVersion?.originalFilename
        || `${schedule.name}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.message || "Could not download this brochure.");
    }
  }

  const styles = {
    page: { minHeight: "100vh", background: "#f3f6f3", color: "#17231f", padding: "32px clamp(16px, 4vw, 56px) 64px", fontFamily: "Georgia, 'Times New Roman', serif" },
    shell: { maxWidth: 1440, margin: "0 auto" },
    eyebrow: { color: "#9a6b2f", fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase" },
    title: { margin: "10px 0 8px", fontSize: 42, lineHeight: 1.05, fontWeight: 500 },
    subtitle: { margin: 0, maxWidth: 680, color: "#57635e", fontFamily: "Arial, sans-serif", fontSize: 15, lineHeight: 1.6 },
    toolbar: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 24 },
    primary: { display: "inline-flex", alignItems: "center", gap: 8, border: 0, borderRadius: 6, padding: "11px 15px", background: "#174a3a", color: "white", fontFamily: "Arial, sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" },
    secondary: { display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #cbd5ce", borderRadius: 6, padding: "9px 11px", background: "#fff", color: "#244237", fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" },
    count: { marginLeft: "auto", color: "#617068", fontFamily: "Arial, sans-serif", fontSize: 13 },
  };

  return (
    <>
      <Head><title>Standard Inclusions Library | GR8 RESULT</title><meta name="description" content="Manage builder inclusions brochures and schedule versions." /></Head>
      <main style={styles.page}>
        <div style={styles.shell}>
          <section className="dashboardHero">
            <div className="heroCopy">
              <div style={styles.eyebrow}>AI inclusions brochure studio</div>
              <h1>Create a professional inclusions brochure in minutes.</h1>
              <p>Choose your package, preferred brands, builder images and brochure design. AI combines verified Product Library selections with your Business Profile branding and approved residential construction structure.</p>
              <div className="heroActions">
                <button type="button" className="aiCreateButton" onClick={openCreate}><Sparkles size={20} /> CREATE INCLUSIONS BROCHURE WITH AI</button>
                <button type="button" style={styles.secondary} onClick={openImport}><Upload size={16} /> Import Existing PDF</button>
              </div>
              <div className="journey">
                {["Package", "Inclusions & brands", "Images", "Design style", "Generate"].map((label, index) => <span key={label}><b>{index + 1}</b>{label}</span>)}
              </div>
            </div>
            <div className="heroArtwork" aria-label="Professional inclusions brochure examples">
              <div className="brochureMock brochureMockBack"><span>COASTAL</span><strong>Home<br />Inclusions</strong></div>
              <div className="brochureMock brochureMockFront"><span>LUXURY COLLECTION</span><strong>Premier<br />Inclusions</strong><small>Designed for the way you live.</small></div>
            </div>
          </section>

          <section className="dashboardSummary">
            <div><strong>{loading ? "—" : activeCount}</strong><span>Active brochures</span></div>
            <div><strong>{loading ? "—" : publishedCount}</strong><span>Published</span></div>
            <div><strong>{loading ? "—" : reviewCount}</strong><span>In review</span></div>
            <button type="button" onClick={() => setArchivedVisible((visible) => !visible)}>{archivedVisible ? "Hide archived" : "Manage archived"}</button>
          </section>

          {error && <div role="alert" className="stateError">{error} <button type="button" style={styles.secondary} onClick={loadSchedules} disabled={loading}><RotateCcw size={15} /> Retry library</button></div>}
          {notice && <div role="status" className="stateNotice">{notice}</div>}
          {loading ? <div className="statePanel">Loading your brochure dashboard…</div> : null}
          {!loading && !error && schedules.length === 0 ? (
            <section className="emptyState">
              <div className="emptyImage" role="img" aria-label="Contemporary residential home" />
              <div><span style={styles.eyebrow}>Start from scratch with AI</span><h2>Create your first inclusions brochure</h2><p>No existing brochure is required. Choose a package and AI will guide you through inclusions, verified products, builder images and a professional design.</p><button type="button" className="aiCreateButton" onClick={openCreate}><Sparkles size={18} /> CREATE INCLUSIONS BROCHURE WITH AI</button><button type="button" className="emptyImport" onClick={openImport}>Already have a schedule? Import Existing PDF</button></div>
            </section>
          ) : null}
          {!loading && schedules.length > 0 ? (
            <>
            <div className="libraryHeading"><div><span style={styles.eyebrow}>Your brochure library</span><h2>Saved brochures and schedules</h2></div><span>{activeCount} active</span></div>
            <section className="libraryGrid" aria-label="Saved Standard Inclusions schedules">
              {schedules.map((schedule) => {
                const currentVersion = schedule.currentVersion;
                const workflowStatus = schedule.metadata?.workflowStatus || (schedule.status === "archived" ? "Archived" : "Draft");
                return (
                  <article className="scheduleCard" key={schedule.id}>
                    <PdfCover schedule={schedule} token={token} workspaceId={workspaceId} />
                    <div className="cardBody">
                      <div className="cardEyebrow">{schedule.tierKey || "Builder schedule"}<span className={`status status-${workflowStatus.toLowerCase()}`}>{workflowStatus}</span></div>
                      <h2>{schedule.name}</h2>
                      {schedule.description ? <p className="description">{schedule.description}</p> : <p className="description muted">Reference brochure and versioned schedule document.</p>}
                      <div className="meta"><span>Updated {formatDate(schedule.updatedAt)}</span><span>Version {currentVersion?.versionNumber || 0}</span></div>
                      <div className="primaryActions">
                        <button type="button" title="Edit brochure" aria-label={`Edit ${schedule.name}`} onClick={() => router.push(`/modules/builders/standard-inclusions/${encodeURIComponent(schedule.id)}`)}><Pencil size={16} /> Edit</button>
                        <button type="button" title="Preview brochure" aria-label={`Preview ${schedule.name}`} onClick={() => currentVersion ? setPreview({ schedule, version: currentVersion }) : router.push(`/modules/builders/standard-inclusions/${encodeURIComponent(schedule.id)}`)}><Eye size={16} /> Preview</button>
                        <button type="button" title="Manage brochure" aria-label={`Manage ${schedule.name}`} onClick={() => setHistoryId((id) => id === schedule.id ? "" : schedule.id)}><Settings2 size={16} /> Manage</button>
                      </div>
                      {historyId === schedule.id ? <div className="manageActions">
                        {schedule.status !== "archived" ? <button type="button" onClick={() => openEdit(schedule)}><Pencil size={15} /> Details</button> : null}
                        <button type="button" title="Duplicate schedule" aria-label={`Duplicate ${schedule.name}`} onClick={() => runAction("duplicate", schedule)}><Copy size={16} /> Duplicate</button>
                        <button type="button" title="Download current PDF" aria-label={`Download ${schedule.name} PDF`} onClick={() => downloadPdf(schedule)} disabled={!currentVersion}><Download size={16} /> PDF</button>
                        <button type="button" title="Version history" aria-label={`Version history for ${schedule.name}`}><FileClock size={16} /> Versions ({schedule.versions?.length || 0})</button>
                        {currentVersion && ["Approved", "Published"].includes(workflowStatus) ? <button type="button" title="Apply approved schedule to a project" aria-label={`Apply ${schedule.name} to a project`} onClick={() => openProjectAssignment(schedule)}><FilePlus2 size={16} /> Apply to job</button> : null}
                        {schedule.status !== "archived" ? <button type="button" title="Archive schedule" aria-label={`Archive ${schedule.name}`} onClick={() => runAction("archive", schedule)}><Archive size={16} /> Archive</button> : null}
                      </div> : null}
                      {historyId === schedule.id && schedule.versions?.length ? (
                        <div className="historyPanel">
                          <h3>Version history</h3>
                          {(schedule.versions || []).map((version) => (
                            <div className="versionRow" key={version.id}>
                              <div><strong>Version {version.versionNumber}</strong><span>{version.originalFilename} · {formatDate(version.createdAt)}</span>{version.current ? <small>Current</small> : null}</div>
                              <div className="versionActions">
                                <button type="button" onClick={() => setPreview({ schedule, version })} title={`Preview version ${version.versionNumber}`}><Eye size={15} /></button>
                                <button type="button" onClick={() => downloadPdf(schedule, version.id)} title={`Download version ${version.versionNumber}`}><Download size={15} /></button>
                                {!version.current && schedule.status !== "archived" ? <button type="button" onClick={() => runAction("restore", { ...schedule, versionId: version.id })} title={`Restore version ${version.versionNumber}`}><RotateCcw size={15} /></button> : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
            </>
          ) : null}
        </div>
      </main>

      {dialog ? (
        <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="schedule-form-title">
            <div className="modalHead"><div><span style={styles.eyebrow}>{dialog === "create" ? "New schedule" : dialog === "import" ? "Reference PDF" : "Schedule details"}</span><h2 id="schedule-form-title">{dialog === "create" ? "Create a schedule" : dialog === "import" ? "Import existing brochure" : "Edit schedule"}</h2></div><button type="button" className="iconButton" onClick={() => setDialog(null)} aria-label="Close"><X size={19} /></button></div>
            <form onSubmit={submitSchedule}>
              {dialog === "create" ? <>
                <label>Schedule name<input autoFocus maxLength={200} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="For example: Signature Home Inclusions" required /></label>
                <label>Package<select value={form.packageChoice} onChange={(event) => setForm((current) => ({ ...current, packageChoice: event.target.value }))}>{["Budget", "Mid-range", "High-end", "Custom"].map((tier) => <option key={tier}>{tier}</option>)}</select></label>
                <p className="modalHint">Next you will choose inclusions, brands, images and a brochure design before AI creates anything.</p>
              </> : <>
                <label>Schedule name<input autoFocus maxLength={200} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
                <label>Quality tier or label<input maxLength={100} placeholder="For example: Classic, Premier, Signature" value={form.tierKey} onChange={(event) => setForm((current) => ({ ...current, tierKey: event.target.value }))} /></label>
                <label>Description<textarea rows={3} maxLength={1000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
                <label className="uploadField">{dialog === "import" ? "Reference PDF" : "Replace PDF (optional; creates a new version)"}<input type="file" accept="application/pdf,.pdf" required={dialog === "import"} onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
                <p className="modalHint">{dialog === "edit" ? "Replacing the PDF adds a new version. Existing versions remain unchanged." : "The original uploaded PDF is preserved as a reference version."}</p>
              </>}
              <div className="modalActions"><button type="button" className="secondaryButton" onClick={() => setDialog(null)}>Close</button><button type="submit" className="saveButton" disabled={saving}>{saving ? "Saving…" : dialog === "create" ? "Continue" : dialog === "import" ? "Import PDF" : "Save changes"}</button></div>
            </form>
          </section>
        </div>
      ) : null}

      {preview ? (
        <div className="previewBackdrop" role="presentation">
          <section className="previewModal" role="dialog" aria-modal="true" aria-label={`${preview.name} preview`}>
            <header><div><span style={styles.eyebrow}>Brochure preview · Version {preview.version?.versionNumber || 0}</span><h2>{preview.schedule.name}</h2></div><button type="button" className="iconButton" onClick={() => setPreview(null)} aria-label="Close preview"><X size={19} /></button></header>
            {preview.version ? <PdfPreview schedule={preview.schedule} versionId={preview.version.id} token={token} workspaceId={workspaceId} /> : <div className="statePanel">This schedule has no PDF version to preview.</div>}
          </section>
        </div>
      ) : null}

      {projectAssignmentSchedule ? (
        <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProjectAssignmentSchedule(null); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="apply-schedule-title">
            <div className="modalHead"><div><span style={styles.eyebrow}>Quotation Builder / Client Selections</span><h2 id="apply-schedule-title">Apply approved schedule</h2></div><button type="button" className="iconButton" onClick={() => setProjectAssignmentSchedule(null)} aria-label="Close"><X size={19} /></button></div>
            <p className="modalHint">This adds the published PDF and immutable structured schedule snapshot to the project. It does not overwrite quotation values.</p>
            {loadingProjects ? <div className="statePanel">Loading workspace projects…</div> : projects.length ? (
              <form onSubmit={applyScheduleToProject}>
                <label>Project<select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} required><option value="">Choose a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.project_name}{project.client_name ? ` · ${project.client_name}` : ""}{project.site_address ? ` · ${project.site_address}` : ""}</option>)}</select></label>
                <div className="modalActions"><button type="button" className="secondaryButton" onClick={() => setProjectAssignmentSchedule(null)}>Cancel</button><button type="submit" className="saveButton" disabled={applyingToProject || !selectedProjectId}>{applyingToProject ? "Applying…" : "Apply to project"}</button></div>
              </form>
            ) : <div className="statePanel">No active workspace projects are available.</div>}
          </section>
        </div>
      ) : null}

      <style jsx global>{`
        .dashboardHero { position:relative; display:grid; grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr); min-height:430px; overflow:hidden; border-radius:18px; background:linear-gradient(125deg,#102f25 0%,#174a3a 58%,#c18c48 145%); box-shadow:0 20px 60px rgba(17,49,38,.2); color:#fff; }
        .heroCopy { position:relative; z-index:2; padding:clamp(32px,5vw,72px); }.heroCopy h1 { max-width:800px; margin:12px 0 18px; font:500 clamp(38px,5vw,66px)/1.02 Georgia,'Times New Roman',serif; }.heroCopy>p { max-width:760px; margin:0; color:#dbe8e1; font:15px/1.65 Arial,sans-serif; }
        .heroActions { display:flex; flex-wrap:wrap; gap:11px; margin-top:28px; }.aiCreateButton { display:inline-flex; align-items:center; justify-content:center; gap:9px; border:0; border-radius:7px; padding:13px 17px; background:#d09a50; color:#14271f; box-shadow:0 8px 22px rgba(0,0,0,.16); font:900 13px Arial,sans-serif; letter-spacing:.35px; cursor:pointer; }.heroActions>button:last-child { border-color:rgba(255,255,255,.36)!important; background:rgba(255,255,255,.1)!important; color:#fff!important; }
        .journey { display:flex; flex-wrap:wrap; gap:9px; margin-top:32px; }.journey span { display:flex; align-items:center; gap:7px; color:#dbe8e1; font:700 11px Arial,sans-serif; }.journey b { display:grid; place-items:center; width:23px; height:23px; border:1px solid rgba(255,255,255,.45); border-radius:50%; color:#fff; }
        .heroArtwork { position:relative; min-height:430px; background:radial-gradient(circle at 50% 40%,rgba(255,255,255,.18),transparent 58%); }.brochureMock { position:absolute; width:210px; height:300px; box-sizing:border-box; padding:28px 24px; border:7px solid rgba(255,255,255,.85); box-shadow:0 22px 50px rgba(0,0,0,.32); background:linear-gradient(180deg,transparent 0 42%,rgba(8,30,23,.88) 42%),url('/assets/builders/standard-inclusions-premier-kitchen.webp') center/cover; }.brochureMock span,.brochureMock strong,.brochureMock small { display:block; }.brochureMock span { margin-top:126px; color:#e2bc82; font:800 9px Arial,sans-serif; letter-spacing:1px; }.brochureMock strong { margin-top:7px; color:#fff; font:500 31px/1 Georgia,serif; }.brochureMock small { margin-top:14px; color:#dce8e2; font:10px Arial,sans-serif; }.brochureMockFront { left:27%; top:58px; transform:rotate(4deg); }.brochureMockBack { left:2%; top:95px; transform:rotate(-8deg); opacity:.8; background:linear-gradient(180deg,transparent 0 42%,rgba(25,75,84,.9) 42%),url('/assets/builders/standard-inclusions-family-kitchen.jpg') center/cover; }
        .dashboardSummary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)) auto; align-items:center; gap:1px; margin:18px 0 34px; overflow:hidden; border:1px solid #dce4dd; border-radius:10px; background:#dce4dd; }.dashboardSummary div,.dashboardSummary button { min-height:72px; padding:13px 22px; border:0; background:#fff; text-align:left; }.dashboardSummary strong,.dashboardSummary span { display:block; }.dashboardSummary strong { color:#193d2f; font:500 27px Georgia,serif; }.dashboardSummary span { color:#68766e; font:700 11px Arial,sans-serif; text-transform:uppercase; }.dashboardSummary button { color:#2d5141; font:800 12px Arial,sans-serif; cursor:pointer; }
        .libraryHeading { display:flex; align-items:end; justify-content:space-between; gap:16px; }.libraryHeading h2 { margin:7px 0 0; color:#1d3027; font:500 32px Georgia,serif; }.libraryHeading>span { color:#66766d; font:700 12px Arial,sans-serif; }
        .libraryGrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr)); gap:22px; margin-top:28px; align-items:start; }
        .scheduleCard { overflow:hidden; background:#fff; border:1px solid #dce4dd; border-radius:8px; box-shadow:0 8px 24px rgba(23,43,34,.08); }
        .coverFrame { width:100%; aspect-ratio:4/5; display:flex; align-items:center; justify-content:center; overflow:hidden; background:#e8eeea; }
        .coverFrame canvas { display:block; max-width:100%; max-height:100%; object-fit:contain; }
        .generatedCover { position:relative; display:flex; height:100%; width:100%; flex-direction:column; overflow:hidden; background:#173e31; color:#fff; }.generatedCoverImage { height:57%; background:linear-gradient(180deg,transparent,rgba(12,35,27,.12)),url('/assets/builders/standard-inclusions-premier-kitchen.webp') center/cover; }.generatedCoverCopy { flex:1; padding:25px; }.generatedCoverCopy small,.generatedCoverCopy strong,.generatedCoverCopy span { display:block; }.generatedCoverCopy small { color:#d9ad6c; font:800 10px Arial,sans-serif; letter-spacing:1px; text-transform:uppercase; }.generatedCoverCopy strong { margin-top:10px; font:500 30px/1.08 Georgia,serif; }.generatedCoverCopy span { margin-top:20px; color:#d9e5df; font:12px Arial,sans-serif; }.cover-luxury { background:#211d24; }.cover-luxury .generatedCoverImage { background-image:linear-gradient(180deg,transparent,rgba(24,18,25,.14)),url('/assets/builders/standard-inclusions-premier-living.jpg'); }.cover-coastal { background:#245b68; }.cover-coastal .generatedCoverImage { background-image:linear-gradient(180deg,transparent,rgba(26,73,82,.12)),url('/assets/builders/standard-inclusions-family-kitchen.jpg'); }.coverError { position:absolute; left:10px; right:10px; bottom:10px; padding:7px; border-radius:5px; background:rgba(120,36,24,.9); font:10px Arial,sans-serif; }
        .cardBody { padding:18px; }
        .cardEyebrow { display:flex; align-items:center; justify-content:space-between; gap:10px; color:#9a6b2f; font:700 11px Arial,sans-serif; letter-spacing:1px; text-transform:uppercase; }
        .status { border-radius:999px; padding:5px 8px; background:#edf2ee; color:#426253; letter-spacing:.2px; }
        .status-published { color:#14532d; background:#dcfce7; }.status-approved { color:#1d4ed8; background:#dbeafe; }.status-archived { color:#5b6470; background:#edf0f2; }
        .cardBody h2 { margin:12px 0 7px; color:#1c2a23; font:500 26px Georgia,'Times New Roman',serif; line-height:1.1; }
        .description { min-height:42px; margin:0; color:#506057; font:14px/1.5 Arial,sans-serif; }.description.muted { color:#7b8880; }
        .meta { display:flex; justify-content:space-between; gap:8px; margin:15px 0; color:#748078; font:12px Arial,sans-serif; }
        .primaryActions { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; border-top:1px solid #e5ebe6; padding-top:13px; }.primaryActions button,.manageActions button { display:flex; min-height:38px; align-items:center; justify-content:center; gap:6px; border:1px solid #d7e0d9; border-radius:6px; padding:7px 6px; color:#244237; background:#fbfcfb; font:700 12px Arial,sans-serif; cursor:pointer; }.primaryActions button:first-child { border-color:#275d46; background:#275d46; color:#fff; }.primaryActions button:hover,.manageActions button:hover { background:#edf4ef; border-color:#92ae9b; color:#244237; }.manageActions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; margin-top:9px; padding:10px; border-radius:7px; background:#f2f6f3; }.manageActions button:disabled { opacity:.45; cursor:not-allowed; }
        .historyPanel { margin-top:14px; border-top:1px solid #e5ebe6; padding-top:13px; }.historyPanel h3 { margin:0 0 8px; color:#293a31; font:700 13px Arial,sans-serif; }
        .versionRow { display:flex; justify-content:space-between; gap:12px; padding:9px 0; border-top:1px solid #edf1ed; font-family:Arial,sans-serif; }.versionRow div:first-child { display:grid; gap:3px; }.versionRow strong { font-size:12px; color:#263b30; }.versionRow span { color:#68766e; font-size:11px; }.versionRow small { color:#3b7754; font-size:10px; text-transform:uppercase; }.versionActions { display:flex; align-items:center; gap:7px; }.versionActions a,.versionActions button { display:grid; place-items:center; width:30px; height:30px; border:1px solid #d7e0d9; border-radius:5px; color:#244237; background:white; cursor:pointer; }
        .stateError,.stateNotice,.statePanel { margin-top:18px; border:1px solid #e3b9ad; border-radius:6px; background:#fff8f5; color:#8a3526; padding:12px 14px; font:14px/1.45 Arial,sans-serif; }.stateNotice { border-color:#b7d1bd; background:#edf7ef; color:#28563b; }.statePanel { border-color:#dce4dd; background:white; color:#65736a; }
        .emptyState { display:grid; grid-template-columns:minmax(220px,.9fr) 1.1fr; gap:34px; align-items:center; margin-top:32px; padding:24px; border:1px solid #dce4dd; border-radius:8px; background:white; }.emptyImage { min-height:250px; border-radius:6px; background: url('/assets/builders/standard-inclusions-hero.jpg') center/cover; }.emptyState h2 { margin:9px 0; color:#1c2a23; font:500 30px Georgia,'Times New Roman',serif; }.emptyState p { max-width:520px; margin:0 0 18px; color:#53635a; font:14px/1.6 Arial,sans-serif; }.emptyImport { display:block; margin-top:13px; border:0; background:transparent; color:#476658; font:700 12px Arial,sans-serif; text-decoration:underline; cursor:pointer; }
        .modalBackdrop,.previewBackdrop { position:fixed; inset:0; z-index:300; display:grid; place-items:center; padding:18px; background:rgba(12,24,18,.64); }.modal { width:min(100%,560px); max-height:90vh; overflow:auto; padding:24px; border-radius:8px; background:#fbfcfa; box-shadow:0 24px 80px rgba(0,0,0,.28); }.modalHead,.previewModal header { display:flex; align-items:flex-start; justify-content:space-between; gap:15px; margin-bottom:18px; }.modalHead h2,.previewModal h2 { margin:6px 0 0; color:#1c2a23; font:500 28px Georgia,'Times New Roman',serif; }.iconButton { display:grid; place-items:center; width:34px; height:34px; border:1px solid #d3ddd5; border-radius:5px; background:white; color:#2c4738; cursor:pointer; }.modal form { display:grid; gap:14px; }.modal label { display:grid; gap:6px; color:#3b4d42; font:700 13px Arial,sans-serif; }.modal input:not([type=file]),.modal textarea { width:100%; box-sizing:border-box; border:1px solid #cad5cc; border-radius:5px; background:white; color:#1d2d23; padding:10px 11px; font:14px Arial,sans-serif; }.modal textarea { resize:vertical; }.uploadField input { padding:10px; border:1px dashed #aebdb1; border-radius:5px; background:#f3f7f3; color:#43554a; font:13px Arial,sans-serif; }.modalHint { margin:0; color:#68776d; font:12px/1.5 Arial,sans-serif; }.modalActions { display:flex; justify-content:flex-end; gap:8px; margin-top:5px; }.secondaryButton,.saveButton { border:1px solid #cad5cc; border-radius:5px; padding:10px 13px; background:#fff; color:#294436; font:700 13px Arial,sans-serif; cursor:pointer; }.saveButton { border-color:#174a3a; background:#174a3a; color:white; }.saveButton:disabled { opacity:.65; cursor:wait; }
        .previewModal { display:grid; grid-template-rows:auto minmax(0,1fr); width:min(100%,1100px); height:min(92vh,900px); padding:18px; border-radius:8px; background:white; }.previewModal header { margin:0 0 12px; }.previewModal iframe { width:100%; height:100%; min-height:0; border:1px solid #d9e0da; border-radius:4px; }
        @media(max-width:900px) { .dashboardHero { grid-template-columns:1fr; }.heroArtwork { display:none; }.dashboardSummary { grid-template-columns:repeat(2,1fr); } }
        @media(max-width:700px) { .heroCopy { padding:28px 22px; }.heroCopy h1 { font-size:38px; }.dashboardSummary { grid-template-columns:1fr 1fr; }.emptyState { grid-template-columns:1fr; padding:16px; }.emptyImage { min-height:190px; }.primaryActions { grid-template-columns:1fr; } }
      `}</style>
    </>
  );
}
