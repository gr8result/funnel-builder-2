import { useCallback, useEffect, useMemo, useState } from "react";
import { rotateLeft, rotateRight } from "../types.js";
import {
  getSelectedPageId,
  listDocuments,
  listPages,
  setSelectedPageId,
  savePage,
} from "../persistence/planStore.js";
import { usePdfDocument } from "../viewer/usePdfDocument.js";
import { usePlanGeometry } from "../hooks/usePlanGeometry.js";
import { useTakeoffTools } from "../hooks/useTakeoffTools.js";
import PlanDocumentList from "./PlanDocumentList.jsx";
import PlanPageStrip from "./PlanPageStrip.jsx";
import PlanViewer from "./PlanViewer.jsx";
import TakeoffToolbar from "./TakeoffToolbar.jsx";
import ResultsPanel from "./ResultsPanel.jsx";
import ScaleCalibrationDialog from "./ScaleCalibrationDialog.jsx";
import AreaConfirmDialog from "./AreaConfirmDialog.jsx";
import ManualAreaConfirmDialog from "./ManualAreaConfirmDialog.jsx";
import ProjectCompactBanner from "../../../components/project-workspace/ProjectCompactBanner.jsx";

export default function TakeoffV2Page({ jobId = "dev-job-1", embedded = false, jobSummary = null, onTakeoffWorkflowChange = null }) {
  const [documents, setDocuments] = useState([]);
  const [pagesByDocument, setPagesByDocument] = useState({});
  const [selectedPageId, setSelectedPageIdState] = useState(null);
  const [pagesCollapsed, setPagesCollapsed] = useState(false);
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const refresh = useCallback(() => {
    const docs = listDocuments(jobId);
    const pages = {};
    docs.forEach((doc) => { pages[doc.id] = listPages(doc.id); });
    setDocuments(docs);
    setPagesByDocument(pages);
  }, [jobId]);

  // Explicit load boundary on mount / job change only — no effect re-runs on every
  // render that could race a fresh load against an in-progress user action.
  useEffect(() => {
    refresh();
    setSelectedPageIdState(getSelectedPageId(jobId));
  }, [jobId, refresh]);

  const selectPage = useCallback((documentId, pageId) => {
    setSelectedPageIdState(pageId);
    setSelectedPageId(jobId, pageId);
  }, [jobId]);

  const handleDocumentsChange = useCallback(() => {
    refresh();
    setSelectedPageIdState(null);
  }, [refresh]);

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

  const { pdfDocument, error: pdfError } = usePdfDocument(selectedDocument);
  const { geometry: planGeometryIndex } = usePlanGeometry(pdfDocument, selectedPage?.pageNumber);

  const commitPage = useCallback((patch) => {
    if (!selectedPage) return;
    const updated = savePage({ ...selectedPage, ...patch });
    if (
      typeof onTakeoffWorkflowChange === "function" &&
      (
        Object.prototype.hasOwnProperty.call(patch, "windowRecords") ||
        Object.prototype.hasOwnProperty.call(patch, "quotationBuilderModel") ||
        Object.prototype.hasOwnProperty.call(patch, "windowsDoorsModel")
      )
    ) {
      onTakeoffWorkflowChange({
        pageId: updated.id,
        documentId: updated.documentId,
        windowRecords: updated.windowRecords || [],
        windowOrderLines: updated.windowOrderLines || [],
        windowReconciliation: updated.windowReconciliation || null,
        windowsDoorsModel: updated.windowsDoorsModel || null,
        quotationBuilderModel: updated.quotationBuilderModel || null,
        boqWindowLines: updated.boqWindowLines || [],
        supplierQuotationWindowLines: updated.supplierQuotationWindowLines || [],
        procurementWindowLines: updated.procurementWindowLines || [],
        purchaseOrderWindowLines: updated.purchaseOrderWindowLines || [],
        projectEstimateWindowLines: updated.projectEstimateWindowLines || [],
      });
    }
    setPagesByDocument((prev) => ({
      ...prev,
      [selectedPage.documentId]: (prev[selectedPage.documentId] || []).map((page) =>
        page.id === updated.id ? updated : page),
    }));
  }, [selectedPage, onTakeoffWorkflowChange]);

  const tools = useTakeoffTools({ page: selectedPage, commitPage, planGeometryIndex });

  useEffect(() => {
    if (!focusMode) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusMode]);

  const applyRotation = useCallback((nextRotation) => {
    commitPage({
      rotation: nextRotation,
      orientationSource: "manual",
      orientationConfirmed: true,
      orientationConfidence: 1,
    });
  }, [commitPage]);

  const handleRotateLeft = useCallback(() => {
    if (!selectedPage) return;
    applyRotation(rotateLeft(selectedPage.rotation));
  }, [applyRotation, selectedPage]);

  const handleRotateRight = useCallback(() => {
    if (!selectedPage) return;
    applyRotation(rotateRight(selectedPage.rotation));
  }, [applyRotation, selectedPage]);

  const handleResetRotation = useCallback(() => {
    applyRotation(0);
  }, [applyRotation]);

  const handleConfirmOrientation = useCallback(() => {
    if (!selectedPage) return;
    applyRotation(selectedPage.rotation ?? 0);
  }, [applyRotation, selectedPage]);

  return (
    <div
      style={{ ...S.page, ...(embedded ? S.embeddedPage : {}), ...(focusMode ? S.focusPage : {}) }}
      data-testid="takeoff-v2-page"
      data-job-id={jobId}
      data-focus-mode={focusMode ? "true" : "false"}
    >
      {jobSummary && !embedded ? (
        <ProjectCompactBanner
          projectName={jobSummary.projectName}
          projectAddress={jobSummary.projectAddress}
          accent="linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)"
          style={{ ...(focusMode ? S.hidden : {}), marginBottom: 0, borderRadius: 0, boxShadow: "none" }}
        />
      ) : null}
      {selectedPage && (
        <TakeoffToolbar
          page={selectedPage}
          tools={tools}
          focusMode={focusMode}
          onToggleFocus={() => setFocusMode((current) => !current)}
          onRotateLeft={handleRotateLeft}
          onRotateRight={handleRotateRight}
          onResetRotation={handleResetRotation}
          onConfirmOrientation={handleConfirmOrientation}
        />
      )}
      <div style={S.body}>
        {!focusMode && (
          <div style={{ ...S.sidebar, ...(pagesCollapsed ? S.sidebarCollapsed : {}) }} data-testid="pages-panel" data-collapsed={pagesCollapsed ? "true" : "false"}>
            <button type="button" style={S.panelToggle} onClick={() => setPagesCollapsed((current) => !current)} data-testid="toggle-pages-panel">
              {pagesCollapsed ? "Pages" : "< Pages"}
            </button>
            {!pagesCollapsed && (
              <>
                <PlanDocumentList
                  jobId={jobId}
                  documents={documents}
                  onDocumentsChange={handleDocumentsChange}
                  selectedPageId={selectedPageId}
                  onSelectPage={selectPage}
                />
                <PlanPageStrip
                  documents={documents}
                  pagesByDocument={pagesByDocument}
                  selectedPageId={selectedPageId}
                  onSelectPage={selectPage}
                />
              </>
            )}
          </div>
        )}
        <div style={S.main}>
          {selectedPage && pdfDocument ? (
            <>
              <div style={S.viewerRow}>
                <div style={S.viewerPane}>
                  <PlanViewer
                    pdfDocument={pdfDocument}
                    page={selectedPage}
                    tools={tools}
                    planGeometryIndex={planGeometryIndex}
                  />
                </div>
                {!focusMode && (
                  <div style={{ ...S.resultsPane, ...(propertiesCollapsed ? S.resultsPaneCollapsed : {}) }} data-testid="properties-panel" data-collapsed={propertiesCollapsed ? "true" : "false"}>
                    <button type="button" style={S.panelToggle} onClick={() => setPropertiesCollapsed((current) => !current)} data-testid="toggle-properties-panel">
                      {propertiesCollapsed ? "Properties" : "Properties >"}
                    </button>
                    {!propertiesCollapsed && <ResultsPanel page={selectedPage} tools={tools} />}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={S.emptyViewer} data-testid="viewer-empty-state">
              {pdfError || (documents.length === 0 ? "Upload a plan to get started." : "Select a page to view it.")}
            </div>
          )}
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
        page={selectedPage}
        calculatedAreaM2={tools.calculatedAreaM2}
        footprintAndInternalArea={tools.footprintAndInternalArea}
        boundaryBasis={selectedPage?.exteriorWalls?.boundaryBasis}
        wallThicknessMm={selectedPage?.exteriorWalls?.wallThicknessMm}
        onAccept={tools.confirmArea}
        onCancel={() => tools.setAreaDialogOpen(false)}
        onEditWalls={() => tools.setActiveTool("edit-walls")}
        onSetBoundaryBasis={tools.setExteriorBoundaryBasis}
        onSetWallThicknessMm={tools.setExteriorWallThicknessMm}
      />
      <ManualAreaConfirmDialog
        open={tools.manualAreaDialogOpen}
        candidate={tools.manualAreaCandidate}
        onAccept={tools.confirmManualArea}
        onCancel={() => tools.setManualAreaDialogOpen(false)}
      />
    </div>
  );
}

const S = {
  page: { display: "flex", flexDirection: "column", height: "100vh", background: "#f1f5f9", fontFamily: "system-ui, sans-serif" },
  embeddedPage: { height: "calc(100vh - 210px)", minHeight: 720, border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" },
  focusPage: { position: "fixed", inset: 0, zIndex: 9999, height: "100vh", minHeight: 0, borderRadius: 0, border: 0 },
  hidden: { display: "none" },
  contextBar: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "8px 12px", borderBottom: "1px solid #e2e8f0", background: "#ffffff", color: "#334155", fontSize: 12 },
  body: { flex: 1, display: "flex", minHeight: 0 },
  sidebar: { width: 204, flexShrink: 0, borderRight: "1px solid #e2e8f0", background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" },
  sidebarCollapsed: { width: 48, overflow: "hidden" },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  viewerRow: { flex: 1, display: "flex", minHeight: 0, minWidth: 0 },
  viewerPane: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  resultsPane: { width: 280, flexShrink: 0, borderLeft: "1px solid #e2e8f0", overflowY: "auto", background: "#f8fafc" },
  resultsPaneCollapsed: { width: 54, overflow: "hidden" },
  panelToggle: { margin: 8, flex: "0 0 auto", border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 6, padding: "6px 8px", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" },
  emptyViewer: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 14 },
};

