import { useEffect, useMemo, useState } from "react";
import { createJobSetupPayload, createTakeoffSchedule } from "../construction-estimation/ai-plan-takeoff/takeoffSchedule.js";
import { loadRecentTakeoffJobs, resolveRecentTakeoffIndexedDbRecord, findMostRecentTakeoffSnapshotWithData } from "../construction-estimation/ai-plan-takeoff/jobPersistence.js";
import { createJobSetupImportPreview } from "../../lib/construction-estimation/jobSetupTakeoffImport.js";
import { masterJobId, masterJobAliases } from "../../lib/construction-estimation/masterJob.js";

const buttonStyle = { padding: "8px 12px", border: "1px solid #99d8d2", borderRadius: 6, background: "#fff", color: "#115e59", cursor: "pointer", fontWeight: 600 };
const cellStyle = { padding: "8px 10px", borderBottom: "1px solid #dbe5eb", textAlign: "left" };
const levelOptions = ["Ground Floor", "Second Level", "Third Level"];
// A general import warning is not repeated when a review item already asks the same question.
const GENERAL_WARNING_TOPICS = [
  [/exterior walls have no material classification/i, "external-wall-type"],
  [/internal walls have no material classification/i, "internal-wall-type"],
  [/openings need width and height|no width and height, so no architrave/i, "opening-size"],
  [/enter wall or ceiling heights/i, "wall-height"],
  [/need a wall assignment|need a wall link or frame thickness/i, "opening-host"],
  [/Eaves have mixed or missing widths/i, "eave-width"],
  [/posts\/columns have no structural/i, "post-type"],
  [/Assign the measured plan sheets/i, "sheet-level"],
  [/need calibration or valid geometry/i, "calibration"],
];

function scheduleForJob(job, workbook) {
  return createTakeoffSchedule({
    ...job,
    totalPages: job.totalPages || job.plan?.totalPages || 1,
    jobSetupRows: workbook.data?.inputDataSheet?.rows || {},
  });
}

const RAW_TAKEOFF_ARRAYS = ["completedWallRuns", "placedOpenings", "completedFloorplans", "completedAreas", "completedEaves", "completedMeasurements"];

// The takeoff attached to a job can end up an empty {} - not corrupted, just never
// (re)synced back onto this workbook copy after being measured and saved in its own
// right. Job Setup must not read that as "this takeoff has nothing", or the estimator
// is told to redraw hours of tracing that is sitting safely elsewhere.
function hasMeasurableTakeoffData(job) {
  return Boolean(job) && (RAW_TAKEOFF_ARRAYS.some((key) => Array.isArray(job[key]) && job[key].length > 0)
    || ['rooms', 'fixtures', 'documentedQuantities'].some((key) => job.scheduleState?.aiAnalysis?.[key]?.length > 0)
    || job.completedPillars?.length > 0);
}
// Exported (separately from the declaration above, which scripts/test-job-setup-takeoff-
// import-empty-attached-recovery.mjs extracts and evals verbatim from source text - an
// inline `export` there is invalid outside a module and breaks that extraction) so
// EstimateBuilderWorkbook can apply the identical "is this actually empty" test when
// deciding whether the attached takeoff needs recovering, rather than a second,
// possibly-drifting definition of the same check.
export { hasMeasurableTakeoffData };

// Legacy project IDs must be explicitly recorded on this master job. Similar
// names or ID prefixes cannot establish ownership of another job's quantities.
function isRelatedProjectId(candidateId, knownIds) {
  const candidate = String(candidateId || "").trim();
  if (!candidate) return false;
  return knownIds.includes(candidate);
}

export default function JobSetupTakeoffImport({ sheet, takeoffJob, projectId, jobName, jobOpen = true, request, onRequestConsumed, onOpenTakeoff }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState(null);
  const [recent, setRecent] = useState([]);
  const [sheetLevels, setSheetLevels] = useState({});
  const [selected, setSelected] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [allowMismatch, setAllowMismatch] = useState(false);
  const workbook = sheet.workbook;

  // `previous` (the last Job Setup sync recorded on this workbook) is legitimately absent the
  // first time a job's takeoff is ever imported, on a brand new job, and on any workbook that
  // predates lastJobSetupSync existing at all - so every read of it must be optional. A takeoff id
  // is also legitimately absent (a job or a "Send to Job Setup" request whose takeoff has never
  // been saved with an id), and two absent ids are NOT evidence of "the same takeoff" - requiring
  // a real, non-empty id on the side being tested closes that off. Without both of these, this
  // used to read `.sheetLevels` off `previous` after a condition that could be true holding only
  // `undefined === undefined`, throwing "Cannot read properties of undefined (reading
  // 'sheetLevels')" the moment a job with no takeoffId was opened for its very first import.
  const previousSheetLevelsIfSameTakeoff = (previous, takeoffId) =>
    (takeoffId && previous?.provenance?.takeoffId === takeoffId ? previous?.sheetLevels : null) || {};

  function useSource(job) {
    setAllowMismatch(false);
    setSource({
      name: job.takeoffName || job.jobName || job.planFilename || "Saved takeoff",
      schedule: scheduleForJob(job, workbook),
      options: { jobId: job.masterJobId || job.jobId || "", takeoffId: job.takeoffId || "", revision: job.revision || 0, projectId: job.associatedProjectId || job.platformProject?.projectId || "" },
    });
    const previous = workbook.takeoffEngine?.lastJobSetupSync?.payload;
    // Priority, in order: (1) this job's own explicit per-sheet level assignments, which always
    // win when present; (2) failing that, a still-relevant previous sync's assignments, so a
    // sheet already assigned to a level is not asked again on every reopen; (3) failing both,
    // empty - individual measurements then fall back to Unassigned rather than any default level.
    setSheetLevels({ ...previousSheetLevelsIfSameTakeoff(previous, job.takeoffId), ...(job.sheetLevels || {}) });
  }

  useEffect(() => {
    if (!request) return;
    setOpen(true);
    setError("");
    setMessage("");
    setAllowMismatch(false);
    setSource({ name: request.planFilename || "Current takeoff", schedule: request.schedule, payload: request, options: request.provenance || {} });
    const previous = workbook.takeoffEngine?.lastJobSetupSync?.payload;
    const requestSheetLevels = request.sheetLevels || {};
    setSheetLevels(Object.keys(requestSheetLevels).length
      ? requestSheetLevels
      : previousSheetLevelsIfSameTakeoff(previous, request.provenance?.takeoffId));
    onRequestConsumed?.();
  }, [request]);

  const payload = useMemo(() => source?.schedule
    ? createJobSetupPayload(source.schedule, { ...source.options, sheetLevels })
    : source?.payload || null, [source, sheetLevels]);
  const preview = useMemo(() => payload ? createJobSetupImportPreview(workbook, payload, { allowProjectMismatch: allowMismatch }) : { rows: [], warnings: [] }, [workbook, payload, allowMismatch]);
  useEffect(() => {
    setSelected(Object.fromEntries(preview.rows.map((row) => [row.destinationKey, Boolean(row.selected)])));
  }, [payload, workbook.data, allowMismatch]);
  const unassignedPages = useMemo(() => {
    const records = source?.schedule?.measurementRecords || [];
    return [...new Set(records.filter((row) => !row.level || row.level === "Unassigned").map((row) => row.page))].filter(Boolean).sort((a, b) => a - b);
  }, [source]);
  // When nothing maps, say what the takeoff actually holds rather than leaving the estimator guessing.
  const sourceSummary = useMemo(() => {
    const records = source?.schedule?.measurementRecords;
    if (!Array.isArray(records)) return null;
    const kinds = { floorArea: "Floor areas", wall: "Walls", opening: "Windows and doors", roofArea: "Roof areas", eave: "Eaves", floorFinish: "Floor finishes", measurement: "General measurements" };
    return {
      total: records.length,
      counts: Object.entries(kinds).map(([kind, label]) => ({ label, count: records.filter((row) => row.kind === kind).length })).filter((row) => row.count),
      unmeasured: records.filter((row) => row.quantity === null).length,
      unassigned: records.filter((row) => (!row.level || row.level === "Unassigned") && ["floorArea", "wall", "roofArea", "eave"].includes(row.kind)).length,
    };
  }, [source]);
  const otherWarnings = useMemo(() => [...new Set(preview.warnings.filter((warning) => warning !== preview.projectMismatch?.message))], [preview]);
  // What the builder sees: a short summary, the few things that need a decision, and - kept
  // apart and collapsed - import notes and the AI's own technical diagnostics.
  const reviewSummary = useMemo(() => {
    const review = payload?.review;
    if (!review) return { checklist: [], decisions: [], extra: otherWarnings, notes: [], diagnostics: [] };
    const topics = new Set(review.decisions.map((decision) => decision.topic));
    const fromTakeoff = new Set(payload.warnings || []);
    const covered = (warning) => GENERAL_WARNING_TOPICS.some(([pattern, topic]) => pattern.test(warning) && topics.has(topic))
      || review.decisions.some((decision) => decision.detail.includes(warning));
    return {
      checklist: review.checklist,
      decisions: review.decisions,
      extra: otherWarnings.filter((warning) => fromTakeoff.has(warning) && !covered(warning)),
      notes: otherWarnings.filter((warning) => !fromTakeoff.has(warning)),
      diagnostics: review.diagnostics,
    };
  }, [payload, otherWarnings]);
  const reviewCount = reviewSummary.decisions.length + reviewSummary.extra.length;
  const selectedKeys = preview.rows.filter((row) => selected[row.destinationKey] && !["unavailable", "unchanged"].includes(row.status)).map((row) => row.destinationKey);

  async function startImport() {
    setOpen(true);
    setError("");
    setMessage("");
    const ids = masterJobAliases(workbook);
    // A takeoff id this workbook has itself synced from before is this job's takeoff
    // regardless of what project id was recorded on the takeoff's own save - a stronger
    // signal than any id string comparison.
    const syncedTakeoffId = String(workbook.takeoffEngine?.lastJobSetupSync?.takeoffId || workbook.takeoffEngine?.lastJobSetupSync?.payload?.provenance?.takeoffId || "").trim();
    const allRecent = loadRecentTakeoffJobs();
    const related = allRecent.filter((job) => job.takeoffId !== takeoffJob?.takeoffId
      && (!job.masterJobId || job.masterJobId === masterJobId(workbook))
      && (isRelatedProjectId(job.associatedPlatformProjectId, ids) || (syncedTakeoffId && job.takeoffId === syncedTakeoffId)));
    setRecent(related);

    if (hasMeasurableTakeoffData(takeoffJob)) { useSource(takeoffJob); return; }

    // The attached takeoff has nothing to import. Before showing a dead end, look in two
    // places, in order of how directly they can be trusted to be THIS job's own takeoff:
    //
    //   1. This same job's own snapshot history. Traced live: a "pre-ai-plan-takeoff-
    //      overwrite" safety snapshot recorded 40 walls / 50 openings / 6 floorplans at
    //      one revision, and the very next revision's attached copy was empty - with no
    //      refused overwrite in between to explain it. That data is not lost, only
    //      unreachable through the live attached copy; every revision survives as a
    //      snapshot of this exact job, purely for this kind of recovery.
    //   2. A legacy record with an explicitly recorded project ID alias or prior
    //      takeoff sync receipt belonging to this master job.
    //
    // Either way this is a read-only preview source: nothing is written until the
    // estimator reviews and imports it, and the attached takeoff itself is left exactly
    // as it is.
    const jobKey = workbook.jobId ? `job:${workbook.jobId}` : workbook.registeredJob?.jobId ? `job:${workbook.registeredJob.jobId}` : "";
    const snapshotRecovery = jobKey ? await findMostRecentTakeoffSnapshotWithData(jobKey) : { ok: false };
    if (snapshotRecovery.ok) {
      useSource(snapshotRecovery.takeoffJob);
      setMessage(`The takeoff attached to this job had no measurements to import. Recovered this job's own last measured save (revision ${snapshotRecovery.revision}, ${snapshotRecovery.savedAt ? new Date(snapshotRecovery.savedAt).toLocaleString() : "date not recorded"}: ${snapshotRecovery.counts.walls} walls, ${snapshotRecovery.counts.openings} openings, ${snapshotRecovery.counts.floorplans} floor areas). Review the values below before importing.`);
      return;
    }

    const crossJobRecovery = related.slice().sort((a, b) => String(b.lastSuccessfullySavedAt || "").localeCompare(String(a.lastSuccessfullySavedAt || "")))[0];
    if (crossJobRecovery) {
      await loadSource(crossJobRecovery.takeoffId, crossJobRecovery);
      setMessage(`The takeoff attached to this job had no measurements to import. Recovered "${crossJobRecovery.displayName || crossJobRecovery.takeoffId}", last saved ${crossJobRecovery.lastSuccessfullySavedAt ? new Date(crossJobRecovery.lastSuccessfullySavedAt).toLocaleString() : "previously"}. Review the values below before importing.`);
      return;
    }
    if (takeoffJob) useSource(takeoffJob);
  }

  // recordOverride lets a caller resolve a specific recent-job record it already has in
  // hand (e.g. a just-computed recovery candidate) without depending on `recent` state,
  // which is set moments earlier in the same tick and is not guaranteed to have
  // committed yet - `recent.find(...)` on the stale value would silently resolve nothing.
  async function loadSource(key, recordOverride) {
    setError("");
    if (key === "current") { if (takeoffJob) useSource(takeoffJob); return; }
    setBusy(true);
    try {
      const result = await resolveRecentTakeoffIndexedDbRecord(recordOverride || recent.find((job) => job.takeoffId === key));
      if (!result.ok) throw new Error(result.message || "Saved takeoff could not be opened.");
      useSource(result.takeoffJob);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }

  async function importSelected() {
    setError("");
    setBusy(true);
    try {
      const result = await sheet.importJobSetupTakeoff(payload, selectedKeys, { allowProjectMismatch: allowMismatch });
      if (!result?.ok) throw new Error(result?.message || "The quantities could not be imported.");
      setMessage(`${result.count} fields imported. Calculations and linked quote quantities have been refreshed.`);
      setOpen(false);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }

  return (
    <section data-testid="job-setup-takeoff-import" style={{ padding: 16, border: "1px solid #b8ded9", borderRadius: 8, background: "#f0fdfa", color: "#163444" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div><strong>Takeoff quantities</strong><div style={{ fontSize: 13, marginTop: 4 }}>Bring measured areas, lengths and counts into Job Setup.</div></div>
        <button type="button" style={buttonStyle} disabled={sheet.previewMode || !sheet.hydrated || !jobOpen || busy} onClick={startImport}>Import takeoff quantities</button>
      </div>
      {!jobOpen && <p>Open a job to import its takeoff quantities.</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      {open && <div style={{ marginTop: 16 }}>
        <p style={{ margin: "0 0 12px" }}>Import into <strong>{jobName || "this job"}</strong>. Review the values below and select the fields to update.</p>
        {recent.length > 0 && <label style={{ display: "block", marginBottom: 12 }}>Saved takeoff: <select aria-label="Saved takeoff for Job Setup" disabled={busy} defaultValue={takeoffJob ? "current" : ""} onChange={(event) => loadSource(event.target.value)} style={buttonStyle}>
          {!takeoffJob && <option value="" disabled>Choose a saved takeoff</option>}
          {takeoffJob && <option value="current">{takeoffJob.takeoffName || takeoffJob.jobName || "Current job takeoff"}</option>}
          {recent.map((job) => <option key={job.takeoffId} value={job.takeoffId}>{job.displayName || job.takeoffName || job.takeoffId}</option>)}
        </select></label>}
        {!source && <p>No saved takeoff is available for this job. Open AI Plan Takeoff, attach the takeoff to this project and save it, or use Export Takeoff to Job Setup from its summary.</p>}
        {source && <>
          <p style={{ fontSize: 13 }}>Source: <strong>{source.name}</strong>{source.options?.revision ? ` · Revision ${source.options.revision}` : ""}</p>
          {unassignedPages.length > 0 && <div style={{ background: "#fff", padding: 12, borderRadius: 6, marginBottom: 12 }}>
            <strong>Assign floor levels</strong>
            <p style={{ margin: "6px 0 10px", fontSize: 13 }}>Choose a level for each plan sheet with unlabelled measurements. Measurements with their own level keep it.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{unassignedPages.map((page) => <label key={page}>Plan sheet {page} <select aria-label={`Floor level for plan sheet ${page}`} style={buttonStyle} value={sheetLevels[page] || ""} onChange={(event) => setSheetLevels((current) => ({ ...current, [page]: event.target.value }))}>
              <option value="">Choose level</option>{levelOptions.map((level) => <option key={level}>{level}</option>)}
            </select></label>)}</div>
          </div>}
          {preview.projectMismatch && <div style={{ background: "#fff7ed", border: "3px solid #d97706", borderRadius: 8, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(217,119,6,0.25)" }}>
            <strong style={{ display: "block", fontSize: 16, color: "#92400e" }}>⚠ IMPORTANT — CHECK THE TAKEOFF PLAN BEFORE IMPORTING</strong>
            <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.5 }}>The saved Takeoff identifies itself differently from the currently open job. Review the project/client details and Takeoff measurements below. Only tick the confirmation box if you have confirmed this is the correct plan for this job.</p>
            <p style={{ margin: "10px 0 0", fontSize: 13 }}>{preview.projectMismatch.message}</p>
            {preview.projectMismatch.clientMatches && <p style={{ margin: "10px 0 0", fontSize: 13 }}>Both record the client <strong>{preview.projectMismatch.targetClient}</strong>. A takeoff traced before the job was registered, or a job re-saved under a new id, keeps the project id it was measured under.</p>}
            <label style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 15, fontWeight: 700, marginTop: 14, padding: 12, background: "#fff", border: "2px solid #d97706", borderRadius: 6, cursor: "pointer" }}>
              <input
                type="checkbox"
                aria-label="I have checked this takeoff and confirm it is the correct plan for this job"
                checked={allowMismatch}
                onChange={(event) => setAllowMismatch(event.target.checked)}
                style={{ width: 26, height: 26, minWidth: 26, marginTop: 2, accentColor: "#d97706", cursor: "pointer" }}
              />
              <span>I HAVE CHECKED THIS TAKEOFF AND CONFIRM IT IS THE CORRECT PLAN FOR THIS JOB — import these quantities into <strong>{jobName || "this job"}</strong> anyway.</span>
            </label>
          </div>}
          {(reviewSummary.checklist.length > 0 || reviewCount > 0) && <div data-testid="takeoff-review-summary" style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, padding: 12, margin: "10px 0" }}>
            <strong style={{ fontSize: 16 }}>{source.schedule?.aiAnalysis ? "AI Takeoff Complete" : "Takeoff summary"}</strong>
            {reviewSummary.checklist.map((item) => <div key={item.label} style={{ color: "#166534", marginTop: 4 }}>✓ {item.label}</div>)}
            <div style={{ marginTop: 8, fontWeight: 700, color: reviewCount ? "#b45309" : "#166534" }}>{reviewCount ? `⚠ ${reviewCount} item${reviewCount === 1 ? "" : "s"} require${reviewCount === 1 ? "s" : ""} confirmation` : "✓ Nothing needs confirmation"}</div>
          </div>}
          {reviewCount > 0 && <div data-testid="takeoff-requires-review" style={{ margin: "10px 0" }}>
            <strong>Requires review ({reviewCount})</strong>
            {reviewSummary.decisions.map((decision) => <div key={decision.id} data-review-decision={decision.id} style={{ border: "1px solid #fcd34d", background: "#fffbeb", borderRadius: 6, padding: 10, marginTop: 8 }}>
              <strong style={{ display: "block", color: "#78350f" }}>{decision.title}</strong>
              <div style={{ color: "#451a03", marginTop: 4 }}>{decision.detail}</div>
            </div>)}
            {reviewSummary.extra.map((warning, index) => <div key={index} style={{ border: "1px solid #fcd34d", background: "#fffbeb", borderRadius: 6, padding: 10, marginTop: 8, color: "#451a03" }}>{warning}</div>)}
            <button type="button" style={{ ...buttonStyle, marginTop: 10 }} onClick={onOpenTakeoff}>Open AI Plan Takeoff to answer these</button>
            <p style={{ fontSize: 13, margin: "6px 0 0" }}>Each item is answered with one click or one number in the takeoff. Quantities that do not depend on them can be imported now.</p>
          </div>}
          {reviewSummary.notes.length > 0 && <details style={{ margin: "10px 0" }}><summary>Import notes ({reviewSummary.notes.length})</summary><ul>{reviewSummary.notes.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
          {reviewSummary.diagnostics.length > 0 && <details data-testid="takeoff-ai-diagnostics" style={{ margin: "10px 0" }}><summary>Advanced AI diagnostics ({reviewSummary.diagnostics.length})</summary><p style={{ fontSize: 13 }}>Technical notes recorded by the analysis. Nothing here needs action.</p><ul>{reviewSummary.diagnostics.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
          {payload?.unsupported?.length > 0 && <details style={{ margin: "10px 0" }}><summary>Measurements needing a destination ({payload.unsupported.length})</summary><ul>{payload.unsupported.map((item, index) => <li key={index}>{item.category} · Sheet {item.page} · {item.quantity ?? "Unmeasured"} {item.unit}: {item.reason}</li>)}</ul></details>}
          <p style={{ fontSize: 13 }}>Existing manual values are left unselected. Select any you want to replace. Fields without measurements stay as they are.</p>
          <div style={{ maxHeight: 400, overflow: "auto", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ position: "sticky", top: 0, background: "#deedf3" }}><tr>{["Import", "Job Setup field", "Current", "Takeoff", "Unit", "Source / status"].map((label) => <th key={label} style={cellStyle}>{label}</th>)}</tr></thead>
              <tbody>{preview.rows.map((row) => <tr key={row.destinationKey} data-import-field={row.destinationKey}>
                <td style={cellStyle}><input type="checkbox" aria-label={`Import ${row.label}`} disabled={["unavailable", "unchanged"].includes(row.status)} checked={Boolean(selected[row.destinationKey]) && !["unavailable", "unchanged"].includes(row.status)} onChange={(event) => setSelected((current) => ({ ...current, [row.destinationKey]: event.target.checked }))} /></td>
                <td style={cellStyle}>{row.label}</td><td style={cellStyle}>{String(row.currentValue ?? "") || "—"}</td><td style={cellStyle}>{String(row.value ?? "")}</td><td style={cellStyle}>{row.unit}</td><td style={cellStyle}>{row.reason || (row.status === "unchanged" ? "Already matches" : row.source)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {!preview.rows.length && <div style={{ background: "#fff7ed", border: "1px solid #fdba74", padding: 12, borderRadius: 6, marginTop: 12 }}>
            <strong>Nothing in this takeoff maps to Job Setup yet</strong>
            {!sourceSummary || !sourceSummary.total ? (
              <p style={{ margin: "6px 0", fontSize: 13 }}>This takeoff holds no measurements at all. Open it in AI Plan Takeoff to check the plan pages loaded and the measurements were saved, or choose a different saved takeoff above.</p>
            ) : (<>
              <p style={{ margin: "6px 0", fontSize: 13 }}>It holds {sourceSummary.total} measurement{sourceSummary.total === 1 ? "" : "s"}:</p>
              <ul style={{ margin: "6px 0", fontSize: 13 }}>{sourceSummary.counts.map((row) => <li key={row.label}>{row.label}: {row.count}</li>)}</ul>
              {sourceSummary.unmeasured > 0 && <p style={{ margin: "6px 0", fontSize: 13 }}>{sourceSummary.unmeasured} of them have no calibrated scale or valid geometry, so no quantity could be read.</p>}
              {sourceSummary.unassigned > 0 && <p style={{ margin: "6px 0", fontSize: 13 }}>{sourceSummary.unassigned} need a building level before they can be imported. Assign the plan sheets above.</p>}
            </>)}
          </div>}
        </>}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button type="button" style={{ ...buttonStyle, background: "#0f766e", color: "#fff", opacity: !selectedKeys.length || busy ? 0.5 : 1 }} disabled={!selectedKeys.length || busy} onClick={importSelected}>Import selected quantities</button>
          <button type="button" style={buttonStyle} onClick={() => setOpen(false)}>Cancel</button>
          {!source && <button type="button" style={buttonStyle} onClick={onOpenTakeoff}>Open AI Plan Takeoff</button>}
        </div>
      </div>}
    </section>
  );
}
