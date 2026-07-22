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
import PlanDocumentList from "./PlanDocumentList.jsx";
import PlanPageStrip from "./PlanPageStrip.jsx";
import PlanViewer from "./PlanViewer.jsx";

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

  const applyRotation = useCallback((nextRotation) => {
    if (!selectedPage) return;
    const updated = savePage({ ...selectedPage, rotation: nextRotation });
    setPagesByDocument((prev) => ({
      ...prev,
      [selectedPage.documentId]: (prev[selectedPage.documentId] || []).map((page) =>
        page.id === updated.id ? updated : page),
    }));
  }, [selectedPage]);

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

  const allPages = useMemo(() => Object.values(pagesByDocument).flat(), [pagesByDocument]);

  return (
    <div style={S.page} data-testid="takeoff-v2-page">
      <div style={S.diagnostics} data-testid="state-diagnostics">
        <span>DOCUMENT COUNT: {documents.length}</span>
        <span>PAGE COUNT: {allPages.length}</span>
        <span>SELECTED DOCUMENT ID: {selectedDocument?.id || "none"}</span>
        <span>SELECTED PAGE ID: {selectedPageId || "none"}</span>
        <span data-testid="selected-page-found">SELECTED PAGE FOUND: {selectedPage ? "YES" : "NO"}</span>
        <span>SELECTED PAGE SOURCE URL PRESENT: {selectedDocument?.originalFileUrl ? "YES" : "NO"}</span>
      </div>
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
            <PlanViewer
              pdfDocument={pdfDocument}
              page={selectedPage}
              onRotateLeft={handleRotateLeft}
              onRotateRight={handleRotateRight}
              onResetRotation={handleResetRotation}
            />
          ) : (
            <div style={S.emptyViewer} data-testid="viewer-empty-state">
              {documents.length === 0 ? "Upload a plan to get started." : "Select a page to view it."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const S = {
  page: { display: "flex", flexDirection: "column", height: "100vh", background: "#f1f5f9", fontFamily: "system-ui, sans-serif" },
  diagnostics: { display: "flex", flexWrap: "wrap", gap: 16, padding: "6px 12px", background: "#0f172a", color: "#7dd3fc", fontSize: 11, fontFamily: "monospace", flexShrink: 0 },
  body: { flex: 1, display: "flex", minHeight: 0 },
  sidebar: { width: 300, flexShrink: 0, borderRight: "1px solid #e2e8f0", background: "#fff", display: "flex", flexDirection: "column", overflowY: "auto" },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  emptyViewer: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 14 },
};
