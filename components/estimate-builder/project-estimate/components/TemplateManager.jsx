// Compact modal for managing Project Estimate templates: list (system
// default + this organisation's templates), switch the current estimate to
// a different template, rename, duplicate, set as organisation default, and
// delete. Deliberately small and focused — this is not the website builder's
// template gallery.
import { useEffect, useState } from "react";
import {
  listTemplates,
  updateTemplate,
  deleteTemplate,
  createTemplate,
  getTemplate,
} from "../persistence/ProjectEstimateApiClient";

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000,
  },
  dialog: {
    background: "#ffffff", borderRadius: 12, width: "min(640px, 92vw)", maxHeight: "82vh",
    overflow: "auto", padding: 20, boxShadow: "0 20px 60px rgba(15,23,42,0.35)",
  },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  row: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: 8,
  },
  rowActive: { borderColor: "#0ea5e9", background: "#f0f9ff" },
  name: { fontWeight: 700, color: "#0f172a" },
  meta: { fontSize: 12, color: "#64748b" },
  actions: { display: "flex", gap: 6, flexWrap: "wrap" },
  button: { border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 6, padding: "5px 8px", fontSize: 12, cursor: "pointer" },
  primaryButton: { border: "1px solid #0ea5e9", background: "#0ea5e9", color: "#ffffff", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 700 },
  dangerButton: { border: "1px solid #ef4444", background: "#ffffff", color: "#ef4444", borderRadius: 6, padding: "5px 8px", fontSize: 12, cursor: "pointer" },
  muted: { color: "#64748b", fontSize: 13 },
  error: { color: "#b91c1c", fontSize: 13, marginTop: 8 },
};

export default function ProjectEstimateTemplateManager({ workspaceId, currentTemplateId, onClose, onSelectTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const reload = () => {
    if (!workspaceId) return;
    setLoading(true);
    listTemplates(workspaceId)
      .then((rows) => setTemplates(rows))
      .catch((err) => setError(err?.message || "Could not load templates."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const withBusy = async (id, fn) => {
    setBusyId(id);
    setError("");
    try {
      await fn();
      reload();
    } catch (err) {
      setError(err?.message || "Action failed.");
    } finally {
      setBusyId("");
    }
  };

  const handleRename = (template) => {
    if (typeof window === "undefined") return;
    const nextName = window.prompt("Rename template", template.templateName);
    if (!nextName || nextName === template.templateName) return;
    withBusy(template.id, () => updateTemplate(workspaceId, template.id, { templateName: nextName }));
  };

  const handleSetOrgDefault = (template) => {
    withBusy(template.id, () => updateTemplate(workspaceId, template.id, { setAsOrganisationDefault: true }));
  };

  const handleDuplicate = (template) => {
    if (typeof window === "undefined") return;
    const nextName = window.prompt("Name for the duplicated template", `${template.templateName} Copy`);
    if (!nextName) return;
    withBusy(template.id, async () => {
      const full = await getTemplate(workspaceId, template.id);
      await createTemplate(workspaceId, {
        templateName: nextName,
        description: full.description,
        pageOrder: full.pageOrder,
        settings: full.settings,
        pages: full.pages || [],
        sourceTemplateId: template.id,
      });
    });
  };

  const handleDelete = (template) => {
    if (typeof window === "undefined" || !window.confirm(`Delete "${template.templateName}"? This cannot be undone.`)) return;
    withBusy(template.id, () => deleteTemplate(workspaceId, template.id));
  };

  return (
    <div style={styles.overlay} onMouseDown={onClose}>
      <div style={styles.dialog} onMouseDown={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <strong>Project Estimate Templates</strong>
          <button type="button" style={styles.button} onClick={onClose}>Close</button>
        </div>
        {loading ? <p style={styles.muted}>Loading templates...</p> : null}
        {!loading && !templates.length ? <p style={styles.muted}>No templates yet.</p> : null}
        {templates.map((template) => (
          <div key={template.id} style={{ ...styles.row, ...(template.id === currentTemplateId ? styles.rowActive : {}) }}>
            <div>
              <div style={styles.name}>
                {template.templateName}
                {template.isSystemDefault ? " (System Default)" : ""}
                {template.isOrganisationDefault ? " · Organisation Default" : ""}
              </div>
              <div style={styles.meta}>
                {template.id === currentTemplateId ? "Currently used by this estimate" : `Updated ${new Date(template.updatedAt).toLocaleString()}`}
              </div>
            </div>
            <div style={styles.actions}>
              <button
                type="button"
                style={styles.primaryButton}
                disabled={busyId === template.id || template.id === currentTemplateId}
                onClick={() => onSelectTemplate(template.id)}
              >
                Use for this estimate
              </button>
              {!template.isSystemDefault ? (
                <>
                  <button type="button" style={styles.button} disabled={busyId === template.id} onClick={() => handleRename(template)}>Rename</button>
                  <button type="button" style={styles.button} disabled={busyId === template.id} onClick={() => handleSetOrgDefault(template)}>Set Org Default</button>
                </>
              ) : null}
              <button type="button" style={styles.button} disabled={busyId === template.id} onClick={() => handleDuplicate(template)}>Duplicate</button>
              {!template.isSystemDefault ? (
                <button type="button" style={styles.dangerButton} disabled={busyId === template.id} onClick={() => handleDelete(template)}>Delete</button>
              ) : null}
            </div>
          </div>
        ))}
        {error ? <p style={styles.error}>{error}</p> : null}
      </div>
    </div>
  );
}
