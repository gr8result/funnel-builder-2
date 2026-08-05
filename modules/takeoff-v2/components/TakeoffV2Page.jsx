import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { CURRENT_ORIENTATION_STATE_VERSION, rotateLeft, rotateRight } from "../types.js";
import {
  listDocuments,
  listPages,
  getSelectedPageId,
  setSelectedPageId,
  savePage,
  migrateLegacyTakeoffStorage,
} from "../persistence/planStore.js";
import { usePdfDocument } from "../viewer/usePdfDocument.js";
import { readJobSummaryFromQuery, jobSummaryFromJobFileData, deriveJobId, DEFAULT_JOB_ID } from "../jobSummary.js";
import { detectPageOrientation } from "../orientation/detectPageOrientation.js";
import { applyOrientationResult } from "../orientation/applyOrientationResult.js";
import { CONFIDENCE_HIGH } from "../orientation/analyzeOrientation.js";
import { applyManualOrientationState, resetToDetectedOrientationState } from "../orientation/orientationState.js";
import { useJobFile } from "../../../hooks/useJobFile.ts";
import { useTakeoffTools } from "../hooks/useTakeoffTools.js";
import { usePlanGeometry } from "../hooks/usePlanGeometry.js";
import JobDetailsBanner from "./JobDetailsBanner.jsx";
import PlanDocumentList from "./PlanDocumentList.jsx";
import PlanStorageManager from "./PlanStorageManager.jsx";
import PlanPageStrip from "./PlanPageStrip.jsx";
import PlanViewer from "./PlanViewer.jsx";
import OrientationNotice from "./OrientationNotice.jsx";
import OrientationPicker from "./OrientationPicker.jsx";
import TakeoffToolbar from "./TakeoffToolbar.jsx";
import ScaleCalibrationDialog from "./ScaleCalibrationDialog.jsx";
import AreaConfirmDialog from "./AreaConfirmDialog.jsx";
import ManualAreaConfirmDialog from "./ManualAreaConfirmDialog.jsx";
import ResultsPanel from "./ResultsPanel.jsx";

export default function TakeoffV2Page({ jobId: defaultJobId = DEFAULT_JOB_ID }) {
  const router = useRouter();
  // What Estimate Builder handed us at redirect time (URL query) — the
  // starting point until/unless the File control opens a different job.
  const queryJobSummary = useMemo(() => readJobSummaryFromQuery(router.query), [router.query]);
  const [openedJob, setOpenedJob] = useState(null); // { summary, fileName } | null

  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [jobFileError, setJobFileError] = useState("");

  // V2 never edits or saves job-file content — jobData only feeds useJobFile's
  // dirty-check/save(), neither of which V2 ever calls.
  const jobFileData = useMemo(() => ({
    jobName: "", clientName: "", jobNumber: "", address: "", notes: "",
    rooms: [], products: [], pricing: {}, created: "", lastModified: "",
  }), []);

  const jobFile = useJobFile({
    enabled: true,
    jobData: jobFileData,
    onOpenJob: (job, fileName) => {
      setJobFileError("");
      setOpenedJob({ summary: jobSummaryFromJobFileData(job, fileName), fileName });
    },
    onError: (message) => { if (message) setJobFileError(message); },
  });

  // Read-only: the banner never feeds back into plan/page/rotation/zoom state
  // — Open Job is the one exception, and even that only ever changes which
  // job's plans are shown, never their content.
  const jobSummary = openedJob ? openedJob.summary : queryJobSummary;
  const jobId = openedJob
    ? (deriveJobId(openedJob.fileName) || defaultJobId)
    : (deriveJobId(queryJobSummary.fileName) || defaultJobId);

  const [documents, setDocuments] = useState([]);
  const [pagesByDocument, setPagesByDocument] = useState({});
  const [selectedPageId, setSelectedPageIdState] = useState(null);

  const [storageNotice, setStorageNotice] = useState("");
  const [storageManagerOpen, setStorageManagerOpen] = useState(false);

  const refresh = useCallback(async () => {
    const docs = await listDocuments(jobId);
    const pages = {};
    await Promise.all(docs.map(async (doc) => { pages[doc.id] = await listPages(doc.id); }));
    setDocuments(docs);
    setPagesByDocument(pages);
  }, [jobId]);

  // Explicit load boundary on mount / job change only — no effect re-runs on every
  // render that could race a fresh load against an in-progress user action.
  // Re-running when jobId changes is exactly what makes "open a different job"
  // load only that job's plans.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const migration = await migrateLegacyTakeoffStorage(jobId);
        if (!cancelled && migration.migratedDocuments) setStorageNotice(`Repaired Takeoff storage: migrated ${migration.migratedDocuments} saved plan${migration.migratedDocuments === 1 ? "" : "s"} to IndexedDB.`);
      } catch (err) {
        if (!cancelled) setStorageNotice(`Takeoff storage needs repair. ${err?.message || ""}`.trim());
      }
      if (!cancelled) await refresh();
    })();
    setSelectedPageIdState(getSelectedPageId(jobId));
    return () => { cancelled = true; };
  }, [jobId, refresh]);

  const selectPage = useCallback((documentId, pageId) => {
    setSelectedPageIdState(pageId);
    setSelectedPageId(jobId, pageId);
  }, [jobId]);

  const handleDocumentsChange = useCallback(async () => {
    await refresh();
    const stillSelected = getSelectedPageId(jobId);
    setSelectedPageIdState(stillSelected);
  }, [jobId, refresh]);

  const selectedPage = useMemo(() => {
    for (const pages of Object.values(pagesByDocument)) {
      const found = pages.find((page) => page.id === selectedPageId);
      if (found) return found;
    }
    return null;
  }, [pagesByDocument, selectedPageId]);

  const selectedDocument = useMemo(() => {
    if (!selectedPage) return null;
    return documents.find((doc) => doc.id === selectedPage.documentId) || null;
  }, [documents, selectedPage]);

  const { pdfDocument } = usePdfDocument(selectedDocument);

  // Observes the authoritative pagesByDocument state itself (not a value read
  // synchronously right after setPagesByDocument, which would still show the
  // pre-update value — React state updates are async) so this always reflects
  // what actually landed.
  useEffect(() => {
    console.log("AUTHORITATIVE PAGE UPDATED", {
      selectedPageId,
      pageFound: Boolean(selectedPage),
      rotation: selectedPage?.rotation,
    });
  }, [pagesByDocument, selectedPageId, selectedPage]);

  const commitPage = useCallback((patch) => {
    if (!selectedPage) return;
    const optimistic = { ...selectedPage, ...patch, updatedAt: new Date().toISOString() };
    setPagesByDocument((prev) => ({
      ...prev,
      [selectedPage.documentId]: (prev[selectedPage.documentId] || []).map((page) =>
        page.id === optimistic.id ? optimistic : page),
    }));
    savePage(optimistic).catch((err) => setStorageNotice(`The plan state could not be saved. ${err?.message || ""}`.trim()));
  }, [selectedPage]);

  // Manual rotation always wins: it's never blocked by orientation state, and
  // it always marks the page orientationSource "manual" so first-import
  // auto-detection (and a stale Re-detect result) never overwrites it again.
  const applyRotation = useCallback((nextRotation) => {
    const orientationState = applyManualOrientationState(selectedPage?.orientationState, nextRotation);
    commitPage({
      rotation: orientationState.finalAppliedRotation,
      orientationState,
      orientationSource: "manual",
      orientationConfidence: orientationState.confidence,
      orientationConfirmed: true,
    });
  }, [commitPage, selectedPage]);

  const handleRotateLeft = useCallback(() => {
    if (!selectedPage) return;
    applyRotation(rotateLeft(selectedPage.rotation));
  }, [applyRotation, selectedPage]);

  const handleRotateRight = useCallback(() => {
    if (!selectedPage) return;
    applyRotation(rotateRight(selectedPage.rotation));
  }, [applyRotation, selectedPage]);

  const handleResetRotation = useCallback(() => {
    if (!selectedPage) return;
    const orientationState = resetToDetectedOrientationState(selectedPage.orientationState);
    commitPage({
      rotation: orientationState.finalAppliedRotation,
      orientationState,
      orientationSource: orientationState.source === "metadata" ? "metadata" : "auto",
      orientationConfidence: orientationState.confidence,
      orientationConfirmed: false,
    });
  }, [commitPage, selectedPage]);

  const handlePickOrientation = useCallback((rotation) => {
    const orientationState = applyManualOrientationState(selectedPage?.orientationState, rotation);
    commitPage({
      rotation: orientationState.finalAppliedRotation,
      orientationState,
      orientationSource: "manual",
      orientationConfidence: orientationState.confidence,
      orientationConfirmed: true,
    });
  }, [commitPage, selectedPage]);

  const [redetecting, setRedetecting] = useState(false);
  const handleRedetectOrientation = useCallback(async () => {
    if (!selectedPage || !pdfDocument) return;
    setRedetecting(true);
    try {
      const detection = await detectPageOrientation(pdfDocument, selectedPage.pageNumber, {
        sourceWidth: selectedPage.sourceWidth,
        sourceHeight: selectedPage.sourceHeight,
      });
      commitPage(applyOrientationResult(selectedPage, detection));
    } finally {
      setRedetecting(false);
    }
  }, [selectedPage, pdfDocument, commitPage]);

  const needsOrientationPick = Boolean(
    selectedPage &&
    selectedPage.orientationSource !== "manual" &&
    (!selectedPage.orientationSource || (selectedPage.orientationConfidence ?? 0) < CONFIDENCE_HIGH)
  );
  const showAutoNotice = Boolean(selectedPage && (selectedPage.orientationSource === "auto" || selectedPage.orientationSource === "metadata"));

  useEffect(() => {
    if (!selectedPage || !pdfDocument) return;
    if (selectedPage.orientationState?.version === CURRENT_ORIENTATION_STATE_VERSION) return;
    let cancelled = false;
    (async () => {
      const detection = await detectPageOrientation(pdfDocument, selectedPage.pageNumber, {
        sourceWidth: selectedPage.sourceWidth,
        sourceHeight: selectedPage.sourceHeight,
      });
      if (!cancelled) commitPage(applyOrientationResult(selectedPage, detection));
    })();
    return () => { cancelled = true; };
  }, [selectedPage?.id, selectedPage?.orientationState?.version, selectedPage?.pageNumber, selectedPage?.sourceWidth, selectedPage?.sourceHeight, pdfDocument, commitPage]);

  const { geometry: planGeometryIndex } = usePlanGeometry(pdfDocument, selectedPage?.pageNumber);
  const tools = useTakeoffTools({ page: selectedPage, commitPage, planGeometryIndex });
  const planViewerRef = useRef(null);

  const handleZoomToGeometry = useCallback((points) => {
    planViewerRef.current?.zoomToPoints(points);
  }, []);

  const handleOpenJob = useCallback(async () => {
    const result = await jobFile.open();
    if (!result.ok && result.message) setJobFileError(result.message);
  }, [jobFile]);

  const handleOpenRecentJob = useCallback(async (id) => {
    const result = await jobFile.openRecent(id);
    if (result.ok) setJobFileError("");
    else if (result.message) setJobFileError(result.message);
  }, [jobFile]);

  return (
    <div style={S.page} data-testid="takeoff-v2-page">
      <div style={S.bannerWrap}>
        <JobDetailsBanner
          {...jobSummary}
          fileMenu={{
            open: fileMenuOpen,
            busy: false,
            recentJobs: jobFile.recentJobs,
            onOpenRecentJob: handleOpenRecentJob,
            onToggle: () => setFileMenuOpen((current) => !current),
            onClose: () => setFileMenuOpen(false),
            items: [{ label: "Open Job", action: handleOpenJob }],
          }}
        />
        {jobFileError && <div style={S.jobFileError} data-testid="job-file-error">{jobFileError}</div>}
      </div>
      <div style={S.body}>
        <div style={S.sidebar}>
          <div style={S.storageTools}>
            <button type="button" style={S.storageButton} onClick={() => setStorageManagerOpen(true)} data-testid="manage-plan-storage-button">
              Manage Plan Storage
            </button>
            {storageNotice ? <div style={S.storageNotice} data-testid="takeoff-storage-notice">{storageNotice}</div> : null}
          </div>
          <PlanDocumentList
            jobId={jobId}
            documents={documents}
            onDocumentsChange={handleDocumentsChange}
            selectedPageId={selectedPageId}
            onSelectPage={selectPage}
            onManageStorage={() => setStorageManagerOpen(true)}
          />
          <PlanPageStrip
            documents={documents}
            pagesByDocument={pagesByDocument}
            selectedPageId={selectedPageId}
            onSelectPage={selectPage}
          />
        </div>
        <div style={S.main}>
          {selectedPage && pdfDocument ? (
            <>
              {showAutoNotice && (
                <OrientationNotice
                  rotation={selectedPage.rotation}
                  confidence={selectedPage.orientationConfidence}
                  needsConfirmation={selectedPage.orientationConfidence < CONFIDENCE_HIGH}
                />
              )}
              {needsOrientationPick && (
                <OrientationPicker
                  pdfDocument={pdfDocument}
                  page={selectedPage}
                  onPick={handlePickOrientation}
                />
              )}
              <TakeoffToolbar page={selectedPage} tools={tools} />
              <div style={S.viewerRow}>
              <div style={S.viewerFlex}>
                <PlanViewer
                  ref={planViewerRef}
                  pdfDocument={pdfDocument}
                  page={selectedPage}
                  onRotateLeft={handleRotateLeft}
                  onRotateRight={handleRotateRight}
                  onResetRotation={handleResetRotation}
                  onRedetectOrientation={handleRedetectOrientation}
                  redetecting={redetecting}
                  tools={tools}
                  planGeometryIndex={planGeometryIndex}
                />
              </div>
              <div style={S.resultsSidebar}>
                <ResultsPanel page={selectedPage} tools={tools} onZoomToGeometry={handleZoomToGeometry} />
              </div>
              </div>
              <ScaleCalibrationDialog
                calibrationDialog={tools.calibrationDialog}
                onConfirm={tools.confirmCalibration}
                onCancel={tools.cancelCalibration}
                onAdjustPoints={tools.adjustCalibrationPoints}
              />
              <AreaConfirmDialog
                open={tools.areaDialogOpen}
                calculatedAreaM2={tools.calculatedAreaM2}
                footprintAndInternalArea={tools.footprintAndInternalArea}
                boundaryBasis={selectedPage?.exteriorWalls?.boundaryBasis || "outside"}
                wallThicknessMm={selectedPage?.exteriorWalls?.wallThicknessMm ?? null}
                onSetBoundaryBasis={tools.setExteriorBoundaryBasis}
                onSetWallThicknessMm={tools.setExteriorWallThicknessMm}
                onAccept={tools.confirmArea}
                onEditWalls={() => { tools.setAreaDialogOpen(false); tools.setActiveTool("edit-walls"); }}
                onCancel={() => tools.setAreaDialogOpen(false)}
              />
              <ManualAreaConfirmDialog
                open={tools.manualAreaDialogOpen}
                candidate={tools.manualAreaCandidate}
                onAccept={tools.confirmManualArea}
                onCancel={() => tools.setManualAreaDialogOpen(false)}
              />
            </>
          ) : (
            <div style={S.emptyViewer} data-testid="viewer-empty-state">
              {documents.length === 0 ? "Upload a plan to get started." : "Select a page to view it."}
            </div>
          )}
        </div>
      </div>
      <PlanStorageManager
        jobId={jobId}
        open={storageManagerOpen}
        onClose={() => setStorageManagerOpen(false)}
        onChanged={handleDocumentsChange}
      />
    </div>
  );
}

const S = {
  page: { display: "flex", flexDirection: "column", height: "100vh", background: "#f1f5f9", fontFamily: "system-ui, sans-serif" },
  bannerWrap: { padding: "16px 16px 0", flexShrink: 0 },
  jobFileError: { marginTop: 8, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 8, padding: "8px 12px", fontWeight: 700, fontSize: 13 },
  body: { flex: 1, display: "flex", minHeight: 0 },
  sidebar: { width: 300, flexShrink: 0, borderRight: "1px solid #e2e8f0", background: "#fff", display: "flex", flexDirection: "column", overflowY: "auto" },
  storageTools: { padding: "12px 12px 0", display: "flex", flexDirection: "column", gap: 8 },
  storageButton: { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 800, cursor: "pointer" },
  storageNotice: { border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", borderRadius: 8, padding: 8, fontSize: 12, fontWeight: 700 },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  viewerRow: { flex: 1, minHeight: 0, display: "flex", gap: 0 },
  viewerFlex: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
  resultsSidebar: { width: 260, flexShrink: 0, borderLeft: "1px solid #e2e8f0", background: "#f8fafc", overflowY: "auto", padding: 10 },
  emptyViewer: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 14 },
};
