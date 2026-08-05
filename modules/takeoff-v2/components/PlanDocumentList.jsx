import { useCallback, useRef, useState } from "react";
import { createPlanDocument, createPlanPage, generateId } from "../types.js";
import { loadPdfDocument, getPageDimensions } from "../viewer/PdfViewport.js";
import { deleteDocument, findDuplicateDocument, listPages, saveDocument, savePages } from "../persistence/planStore.js";
import { detectPageOrientation } from "../orientation/detectPageOrientation.js";
import { applyOrientationResult } from "../orientation/applyOrientationResult.js";

export default function PlanDocumentList({ jobId, documents, onDocumentsChange, selectedPageId, onSelectPage, onManageStorage }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const fileRef = useRef(null);

  const handleUpload = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError("");
    setLoading(true);

    try {
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
          setError("Takeoff Engine V2 currently accepts PDF plans only.");
          continue;
        }

        setProgress(`Checking ${file.name}...`);
        const duplicate = await findDuplicateDocument(jobId, file);
        if (duplicate) {
          const openExisting = window.confirm(`This plan is already stored as "${duplicate.fileName}".\n\nChoose OK to open the existing copy, or Cancel to import another copy.`);
          if (openExisting) {
            await onDocumentsChange();
            const existingPages = await listPages(duplicate.id);
            if (existingPages[0]) onSelectPage(duplicate.id, existingPages[0].id);
            continue;
          }
        }

        setProgress(`Opening ${file.name}...`);
        const pdfDocument = await loadPdfDocument(file);

        const document = createPlanDocument({
          id: generateId("doc"),
          jobId,
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          fileSize: file.size,
          originalFileUrl: "",
          storage: "indexeddb",
        });

        const pages = [];
        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
          setProgress(`Reading ${file.name} page ${pageNumber} of ${pdfDocument.numPages}...`);
          const { width, height } = await getPageDimensions(pdfDocument, pageNumber);
          let page = createPlanPage({
            id: generateId("page"),
            documentId: document.id,
            pageNumber,
            sourceWidth: width,
            sourceHeight: height,
          });

          // First-import automatic orientation — never rerun on later reloads,
          // only here or on an explicit Re-detect Orientation click.
          setProgress(`Checking orientation for ${file.name} page ${pageNumber}...`);
          const detection = await detectPageOrientation(pdfDocument, pageNumber, { sourceWidth: width, sourceHeight: height });
          page = applyOrientationResult(page, detection);

          pages.push(page);
        }

        await saveDocument(document, file);
        await savePages(document.id, pages);
        await onDocumentsChange();
        if (!selectedPageId && pages[0]) onSelectPage(document.id, pages[0].id);
      }
      setProgress("");
    } catch (err) {
      setError(`The plan could not be saved in browser storage. The plan is still open for this session. ${err.message || ""}`.trim());
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, [jobId, onDocumentsChange, onSelectPage, selectedPageId]);

  const handleFileInput = useCallback((event) => {
    handleUpload(event.target.files);
    event.target.value = "";
  }, [handleUpload]);

  const confirmDelete = useCallback((documentId) => {
    (async () => {
      await deleteDocument(jobId, documentId);
      setConfirmingDeleteId(null);
      await onDocumentsChange();
    })();
  }, [jobId, onDocumentsChange]);

  return (
    <div style={S.wrap}>
      <div style={S.title}>Plan Documents</div>

      <div style={S.dropZone} onClick={() => fileRef.current?.click()}>
        {loading ? (
          <div style={S.progressText}>{progress || "Working..."}</div>
        ) : (
          <>
            <div style={S.uploadLabel}>Upload PDF Plan</div>
            <div style={S.uploadSub}>Click to choose a PDF</div>
          </>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        style={{ display: "none" }}
        onChange={handleFileInput}
        data-testid="plan-upload-input"
      />

      {error && <div style={S.error}>{error}</div>}
      {error ? (
        <div style={S.errorActions}>
          <button type="button" style={S.manageButton} onClick={() => onManageStorage?.()} data-testid="manage-plan-storage-from-error">Manage Plan Storage</button>
        </div>
      ) : null}

      {documents.length === 0 ? (
        <div style={S.empty} data-testid="plan-empty-state">No plans uploaded yet.</div>
      ) : (
        <div style={S.list}>
          {documents.map((document) => (
            <div key={document.id} style={S.card} data-testid="plan-document-card">
              <div style={S.cardHeader}>
                <strong>{document.fileName}</strong>
              </div>
              {confirmingDeleteId === document.id ? (
                <div style={S.confirmRow}>
                  <span>Delete this plan and all its pages?</span>
                  <button type="button" style={S.confirmButton} onClick={() => confirmDelete(document.id)} data-testid="confirm-delete-button">
                    Confirm delete
                  </button>
                  <button type="button" style={S.cancelButton} onClick={() => setConfirmingDeleteId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" style={S.deleteButton} onClick={() => setConfirmingDeleteId(document.id)} data-testid="delete-document-button">
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const S = {
  wrap: { display: "flex", flexDirection: "column", gap: 10, padding: 12 },
  title: { fontSize: 14, fontWeight: 800, color: "#1e293b" },
  dropZone: { border: "2px dashed #93c5fd", borderRadius: 10, padding: "16px 12px", textAlign: "center", cursor: "pointer", background: "#f0f9ff" },
  uploadLabel: { fontSize: 14, fontWeight: 800, color: "#1d4ed8" },
  uploadSub: { fontSize: 12, color: "#64748b", marginTop: 4 },
  progressText: { fontSize: 13, color: "#64748b" },
  error: { background: "#fef2f2", color: "#dc2626", padding: "8px 10px", borderRadius: 6, fontSize: 13 },
  errorActions: { display: "flex", gap: 8 },
  manageButton: { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 6, padding: "6px 8px", fontSize: 12, cursor: "pointer", fontWeight: 700 },
  empty: { border: "1px dashed #cbd5e1", borderRadius: 8, padding: 12, color: "#64748b", fontSize: 12, textAlign: "center" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  card: { border: "1px solid #cbd5e1", borderRadius: 8, padding: 10, background: "#fff" },
  cardHeader: { fontSize: 13, color: "#0f172a" },
  deleteButton: { marginTop: 6, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 6, padding: "5px 8px", fontSize: 12, cursor: "pointer" },
  confirmRow: { marginTop: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155" },
  confirmButton: { border: "1px solid #fca5a5", background: "#dc2626", color: "#fff", borderRadius: 6, padding: "5px 8px", fontSize: 12, cursor: "pointer", fontWeight: 700 },
  cancelButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", borderRadius: 6, padding: "5px 8px", fontSize: 12, cursor: "pointer" },
};
