// Compact modal listing a template's version snapshots (date/time, user,
// version number) with a restore action per the Project Estimate spec.
// Restoring changes the TEMPLATE, not the currently-open estimate instance —
// the caller is responsible for telling the user to "Reset to My Template"
// if they want the restored version reflected in their in-progress estimate.
import { useEffect, useState } from "react";
import { listTemplateVersions, restoreTemplateVersion } from "../persistence/ProjectEstimateApiClient";

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000,
  },
  dialog: {
    background: "#ffffff", borderRadius: 12, width: "min(560px, 92vw)", maxHeight: "82vh",
    overflow: "auto", padding: 20, boxShadow: "0 20px 60px rgba(15,23,42,0.35)",
  },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  row: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: 8,
  },
  name: { fontWeight: 700, color: "#0f172a" },
  meta: { fontSize: 12, color: "#64748b" },
  button: { border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer" },
  primaryButton: { border: "1px solid #0ea5e9", background: "#0ea5e9", color: "#ffffff", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 700 },
  muted: { color: "#64748b", fontSize: 13 },
  error: { color: "#b91c1c", fontSize: 13, marginTop: 8 },
};

export default function ProjectEstimateVersionHistoryPanel({ workspaceId, templateId, onClose, onRestored }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    if (!workspaceId || !templateId) return;
    setLoading(true);
    listTemplateVersions(workspaceId, templateId)
      .then((rows) => setVersions(rows))
      .catch((err) => setError(err?.message || "Could not load version history."))
      .finally(() => setLoading(false));
  }, [workspaceId, templateId]);

  const handleRestore = async (version) => {
    if (typeof window !== "undefined" && !window.confirm(`Restore version ${version.versionNumber}? This replaces the template's current content.`)) return;
    setBusyId(version.id);
    setError("");
    try {
      await restoreTemplateVersion(workspaceId, templateId, version.id);
      onRestored?.();
    } catch (err) {
      setError(err?.message || "Could not restore this version.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div style={styles.overlay} onMouseDown={onClose}>
      <div style={styles.dialog} onMouseDown={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <strong>Version History</strong>
          <button type="button" style={styles.button} onClick={onClose}>Close</button>
        </div>
        {loading ? <p style={styles.muted}>Loading version history...</p> : null}
        {!loading && !versions.length ? <p style={styles.muted}>No saved versions yet — versions are created each time this template is updated.</p> : null}
        {versions.map((version) => (
          <div key={version.id} style={styles.row}>
            <div>
              <div style={styles.name}>Version {version.versionNumber}{version.label ? ` — ${version.label}` : ""}</div>
              <div style={styles.meta}>
                {new Date(version.createdAt).toLocaleString()}
                {version.createdByEmail ? ` · ${version.createdByEmail}` : ""}
              </div>
            </div>
            <button type="button" style={styles.primaryButton} disabled={busyId === version.id} onClick={() => handleRestore(version)}>
              Restore
            </button>
          </div>
        ))}
        {error ? <p style={styles.error}>{error}</p> : null}
      </div>
    </div>
  );
}
