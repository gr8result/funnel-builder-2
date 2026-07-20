import { useEffect, useRef, useState } from "react";

export default function OnlyOfficePresentationEditor({ documentId, authToken, onStatus, onClose }) {
  const containerId = useRef(`onlyoffice-standard-inclusions-${Math.random().toString(36).slice(2, 9)}`);
  const editorRef = useRef(null);
  const [loading, setLoading] = useState(Boolean(documentId));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!documentId || !authToken) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");

    async function loadEditor() {
      try {
        const response = await fetch(`/api/standard-inclusions/onlyoffice/config?documentId=${encodeURIComponent(documentId)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not load ONLYOFFICE editor.");
        await loadOnlyOfficeScript(payload.editor.scriptUrl);
        if (cancelled) return;
        const DocsAPI = window.DocsAPI;
        if (!DocsAPI?.DocEditor) throw new Error("ONLYOFFICE editor script loaded but DocsAPI.DocEditor is unavailable.");
        editorRef.current?.destroyEditor?.();
        editorRef.current = new DocsAPI.DocEditor(containerId.current, payload.editor.config);
        onStatus?.("PowerPoint opened in ONLYOFFICE Presentation Editor.");
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError?.message || "ONLYOFFICE editor failed to load.");
          onStatus?.(nextError?.message || "ONLYOFFICE editor failed to load.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEditor();
    return () => {
      cancelled = true;
      editorRef.current?.destroyEditor?.();
      editorRef.current = null;
    };
  }, [documentId, authToken]);

  async function exportPdf() {
    if (!documentId || !authToken) return;
    onStatus?.("Exporting Standard Inclusions PDF...");
    try {
      const response = await fetch("/api/standard-inclusions/onlyoffice/export-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ documentId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "PDF export failed.");
      onStatus?.("Standard Inclusions PDF exported.");
    } catch (nextError) {
      onStatus?.(nextError?.message || "PDF export failed.");
    }
  }

  return (
    <section style={styles.shell}>
      <div style={styles.toolbar}>
        <strong>ONLYOFFICE Presentation Editor</strong>
        <span style={styles.documentId}>{documentId}</span>
        <button type="button" style={styles.secondaryButton} onClick={exportPdf}>Export PDF</button>
        <button type="button" style={styles.secondaryButton} onClick={onClose}>Close</button>
      </div>
      {loading ? <div style={styles.state}>Loading ONLYOFFICE...</div> : null}
      {error ? <div style={styles.error}>{error}</div> : null}
      <div id={containerId.current} style={styles.editorFrame} />
    </section>
  );
}

function loadOnlyOfficeScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("ONLYOFFICE can only load in the browser."));
    if (window.DocsAPI?.DocEditor) return resolve();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load ONLYOFFICE editor script.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load ONLYOFFICE editor script."));
    document.head.appendChild(script);
  });
}

const styles = {
  shell: { display: "grid", gap: 10, border: "1px solid #cbd5e1", borderRadius: 12, background: "#ffffff", padding: 12 },
  toolbar: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  documentId: { color: "#64748b", fontSize: 12, fontWeight: 800 },
  secondaryButton: { border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 8, padding: "8px 11px", fontWeight: 850, cursor: "pointer" },
  state: { border: "1px solid #bae6fd", background: "#eff6ff", color: "#075985", borderRadius: 8, padding: 10, fontWeight: 800 },
  error: { border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", borderRadius: 8, padding: 10, fontWeight: 800 },
  editorFrame: { width: "100%", height: "78vh", minHeight: 680, border: "1px solid #d8dee8", borderRadius: 8, overflow: "hidden" },
};
