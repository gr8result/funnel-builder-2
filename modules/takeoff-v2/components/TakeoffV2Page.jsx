import { useCallback, useEffect, useMemo, useState } from "react";
import { rotateLeft, rotateRight } from "../types.js";
import {
  listDocuments,
  listPages,
  getSelectedPageId,
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

export default function TakeoffV2Page({ jobId = "dev-job-1" }) {
  const [documents, setDocuments] = useState([]);
  const [pagesByDocument, setPagesByDocument] = useState({});
  const [selectedPageId, setSelectedPageIdState] = useState(null);

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

  const { pdfDocument, error: pdfError } = usePdfDocument(selectedDocument);
  const { geometry: planGeometryIndex } = usePlanGeometry(pdfDocument, selectedPage?.pageNumber);

  const commitPage = useCallback((patch) => {
    if (!selectedPage) return;
    const updated = savePage({ ...selectedPage, ...patch });
    setPagesByDocument((prev) => ({
      ...prev,
      [selectedPage.documentId]: (prev[selectedPage.documentId] || []).map((page) =>
        page.id === updated.id ? updated : page),
    }));
  }, [selectedPage]);

  const tools = useTakeoffTools({ page: selectedPage, commitPage, planGeometryIndex });

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

  return (
    <div style={S.page} data-testid="takeoff-v2-page">
      <div style={S.body}>
        <div style={S.sidebar}>
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
        </div>
        <div style={S.main}>
          {selectedPage && pdfDocument ? (
            <>
              <TakeoffToolbar page={selectedPage} tools={tools} />
              <div style={S.viewerRow}>
                <div style={S.viewerPane}>
                  <PlanViewer
                    pdfDocument={pdfDocument}
                    page={selectedPage}
                    tools={tools}
                    planGeometryIndex={planGeometryIndex}
                    onRotateLeft={handleRotateLeft}
                    onRotateRight={handleRotateRight}
                    onResetRotation={handleResetRotation}
                  />
                </div>
                <div style={S.resultsPane}>
                  <ResultsPanel page={selectedPage} tools={tools} />
                </div>
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
  body: { flex: 1, display: "flex", minHeight: 0 },
  sidebar: { width: 300, flexShrink: 0, borderRight: "1px solid #e2e8f0", background: "#fff", display: "flex", flexDirection: "column", overflowY: "auto" },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  viewerRow: { flex: 1, display: "flex", minHeight: 0, minWidth: 0 },
  viewerPane: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  resultsPane: { width: 280, flexShrink: 0, borderLeft: "1px solid #e2e8f0", overflowY: "auto", background: "#f8fafc" },
  emptyViewer: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 14 },
};

