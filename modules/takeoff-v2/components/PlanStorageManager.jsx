import { useCallback, useEffect, useState } from "react";
import {
  auditTakeoffLocalStorage,
  cleanupObsoleteTakeoffLocalStorage,
  deleteDocument,
  estimateTakeoffStorageUsage,
  listStorageDocuments,
} from "../persistence/planStore.js";

function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

export default function PlanStorageManager({ jobId, open, onClose, onChanged }) {
  const [documents, setDocuments] = useState([]);
  const [usage, setUsage] = useState({ bytes: 0, documents: 0 });
  const [localStorageAudit, setLocalStorageAudit] = useState([]);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setDocuments(await listStorageDocuments(jobId));
    setUsage(await estimateTakeoffStorageUsage(jobId));
    setLocalStorageAudit(auditTakeoffLocalStorage());
  }, [jobId]);

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  const repair = useCallback(async () => {
    const removed = cleanupObsoleteTakeoffLocalStorage({ preserveSelectedPage: true });
    setNotice(removed.length ? `Removed ${removed.length} obsolete Takeoff cache item${removed.length === 1 ? "" : "s"}.` : "No obsolete Takeoff cache data found.");
    await refresh();
    await onChanged?.();
  }, [onChanged, refresh]);

  const removeDocument = useCallback(async (documentId, fileName) => {
    if (!window.confirm(`Delete "${fileName}" and all saved Takeoff data for this plan?`)) return;
    await deleteDocument(jobId, documentId);
    setNotice(`Deleted ${fileName}.`);
    await refresh();
    await onChanged?.();
  }, [jobId, onChanged, refresh]);

  if (!open) return null;

  return (
    <div style={S.overlay} data-testid="plan-storage-manager">
      <div style={S.panel}>
        <div style={S.header}>
          <div>
            <div style={S.title}>Manage Plan Storage</div>
            <div style={S.sub}>Takeoff storage used: {formatBytes(usage.bytes)}</div>
          </div>
          <button type="button" style={S.close} onClick={onClose}>Close</button>
        </div>

        <button type="button" style={S.repair} onClick={repair} data-testid="repair-takeoff-storage">
          Repair Takeoff Storage
        </button>
        {notice ? <div style={S.notice}>{notice}</div> : null}

        <div style={S.sectionTitle}>Stored plan documents</div>
        {documents.length ? (
          <div style={S.list}>
            {documents.map((doc) => (
              <div key={doc.id} style={S.row}>
                <div>
                  <strong>{doc.fileName}</strong>
                  <div style={S.meta}>{doc.pageCount || 0} pages · {formatBytes(doc.fileSize)} · Last opened {doc.lastOpenedAt ? new Date(doc.lastOpenedAt).toLocaleString() : "never"}</div>
                </div>
                <button type="button" style={S.delete} onClick={() => removeDocument(doc.id, doc.fileName)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={S.empty}>No saved plans in Takeoff storage.</div>
        )}

        <div style={S.sectionTitle}>Takeoff localStorage audit</div>
        <div style={S.auditList}>
          {localStorageAudit.length ? localStorageAudit.map((entry) => (
            <div key={entry.key} style={S.auditRow}>
              <span>{entry.key}</span>
              <strong>{formatBytes(entry.bytes)}</strong>
            </div>
          )) : <div style={S.empty}>No Takeoff localStorage keys found.</div>}
        </div>
      </div>
    </div>
  );
}

const S = {
  overlay: { position: "fixed", inset: 0, zIndex: 1200, background: "rgba(15,23,42,0.38)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  panel: { width: "min(720px, 100%)", maxHeight: "88vh", overflow: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 24px 80px rgba(15,23,42,0.28)", padding: 16, display: "flex", flexDirection: "column", gap: 12 },
  header: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  title: { fontSize: 18, fontWeight: 900, color: "#0f172a" },
  sub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  close: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", borderRadius: 8, padding: "7px 10px", cursor: "pointer", fontWeight: 700 },
  repair: { alignSelf: "flex-start", border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 8, padding: "8px 11px", cursor: "pointer", fontWeight: 800 },
  notice: { background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#047857", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontWeight: 700 },
  sectionTitle: { fontSize: 13, fontWeight: 900, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  row: { border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  meta: { fontSize: 12, color: "#64748b", marginTop: 3 },
  delete: { border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 7, padding: "6px 9px", cursor: "pointer", fontWeight: 800 },
  empty: { border: "1px dashed #cbd5e1", borderRadius: 8, padding: 10, color: "#64748b", fontSize: 13 },
  auditList: { display: "flex", flexDirection: "column", gap: 4 },
  auditRow: { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: "#475569", borderBottom: "1px solid #f1f5f9", padding: "4px 0" },
};
