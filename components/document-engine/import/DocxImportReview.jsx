import { useMemo, useState } from "react";
import { PageRenderer } from "../renderer/pageRenderer.jsx";

export default function DocxImportReview({ preview, busy = false, onConfirm, onCancel, onReturnToUpload, onSaveAsBaseTemplate, canSaveAsBaseTemplate = false }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const pages = preview?.document?.pages || [];
  const activePage = pages[activeIndex] || pages[0] || null;
  const summary = useMemo(() => ({
    pageCount: pages.length,
    paragraphCount: preview?.paragraphCount || 0,
    tableCount: preview?.tableCount || 0,
    imageCount: preview?.imageCount || 0,
    warnings: preview?.warnings || [],
    fontSubstitutions: preview?.fontSubstitutions || [],
    unsupportedFeatures: preview?.unsupportedFeatures || [],
  }), [pages.length, preview]);

  function saveAsBaseTemplate() {
    if (!window.confirm("Save this reviewed DOCX import as a draft shared Premier base template? Activation still requires platform-admin approval.")) return;
    onSaveAsBaseTemplate?.(preview.document);
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <header style={styles.header}>
          <div>
            <h2 style={styles.title}>Review Imported Word Schedule</h2>
            <p style={styles.subtitle}>{preview.fileName} - {summary.pageCount} page{summary.pageCount === 1 ? "" : "s"} generated from DOCX flow content.</p>
          </div>
          <button type="button" style={styles.ghostButton} disabled={busy} onClick={onCancel}>Cancel</button>
        </header>

        <div style={styles.summaryRow}>
          <SummaryStat label="Pages" value={summary.pageCount} />
          <SummaryStat label="Paragraphs" value={summary.paragraphCount} />
          <SummaryStat label="Tables" value={summary.tableCount} />
          <SummaryStat label="Images" value={summary.imageCount} />
          <SummaryStat label="Warnings" value={summary.warnings.length + summary.unsupportedFeatures.length} warn={summary.warnings.length || summary.unsupportedFeatures.length} />
        </div>

        {summary.fontSubstitutions.length ? (
          <div style={styles.noticeBox}>
            <strong>Font substitutions</strong>
            <ul style={styles.list}>
              {summary.fontSubstitutions.map((entry) => <li key={`${entry.originalFont}-${entry.substitutedFont}`}>{entry.originalFont}{" -> "}{entry.substitutedFont} ({entry.count}x)</li>)}
            </ul>
          </div>
        ) : null}

        {summary.warnings.length || summary.unsupportedFeatures.length ? (
          <div style={styles.warningBox}>
            <strong>Import warnings</strong>
            <ul style={styles.list}>
              {[...summary.warnings, ...summary.unsupportedFeatures].map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
            </ul>
          </div>
        ) : null}

        <div style={styles.body}>
          <aside style={styles.pageList}>
            {pages.map((page, index) => (
              <button key={page.id} type="button" style={{ ...styles.pageButton, ...(index === activeIndex ? styles.pageButtonActive : {}) }} onClick={() => setActiveIndex(index)}>
                <span>Page {index + 1}</span>
                <small>{page.objects.length} block{page.objects.length === 1 ? "" : "s"}</small>
              </button>
            ))}
          </aside>
          <main style={styles.previewWrap}>
            {activePage ? <div style={styles.previewScale}><PageRenderer page={activePage} /></div> : null}
          </main>
        </div>

        <footer style={styles.footer}>
          <button type="button" style={styles.ghostButton} disabled={busy} onClick={onReturnToUpload}>Return to Upload</button>
          <button type="button" style={styles.ghostButton} disabled={busy} onClick={onCancel}>Cancel</button>
          <button type="button" style={styles.primaryButton} disabled={busy || !pages.length} onClick={() => onConfirm(preview.document)}>{busy ? "Saving..." : "Accept Import"}</button>
          {canSaveAsBaseTemplate ? <button type="button" style={styles.baseButton} disabled={busy || !pages.length} onClick={saveAsBaseTemplate}>Save Draft Base Template</button> : null}
        </footer>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, warn }) {
  return (
    <div style={{ ...styles.stat, ...(warn ? styles.statWarn : {}) }}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

const styles = {
  overlay: { position: "fixed", inset: 0, zIndex: 220, display: "grid", placeItems: "center", background: "rgba(2,6,23,0.68)" },
  panel: { width: "min(1180px, 96vw)", maxHeight: "94vh", overflow: "auto", display: "grid", gap: 14, padding: 22, background: "#f8fafc", color: "#0f172a", borderRadius: 12, boxShadow: "0 24px 80px rgba(15,23,42,0.35)" },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  title: { margin: 0, fontSize: 20 },
  subtitle: { margin: "4px 0 0", color: "#64748b", fontSize: 13 },
  summaryRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 },
  stat: { display: "grid", gap: 2, border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", padding: 10 },
  statWarn: { borderColor: "#f59e0b", background: "#fffbeb" },
  noticeBox: { border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 8, padding: "10px 12px", fontSize: 13 },
  warningBox: { border: "1px solid #facc15", background: "#fefce8", borderRadius: 8, padding: "10px 12px", fontSize: 13 },
  list: { margin: "6px 0 0", paddingLeft: 18 },
  body: { display: "grid", gridTemplateColumns: "210px minmax(0, 1fr)", gap: 14, minHeight: 520 },
  pageList: { display: "grid", gap: 7, alignContent: "start", overflow: "auto", maxHeight: 600 },
  pageButton: { display: "grid", gap: 2, textAlign: "left", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 8, padding: "8px 10px", color: "#0f172a", cursor: "pointer" },
  pageButtonActive: { borderColor: "#2563eb", boxShadow: "0 0 0 2px rgba(37,99,235,0.14)" },
  previewWrap: { overflow: "auto", display: "grid", placeItems: "start center", background: "#e2e8f0", borderRadius: 8, padding: 18 },
  previewScale: { transform: "scale(0.72)", transformOrigin: "top center", minHeight: 810 },
  footer: { display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #cbd5e1", paddingTop: 12 },
  primaryButton: { border: 0, borderRadius: 8, background: "#2563eb", color: "#ffffff", fontWeight: 800, padding: "9px 14px", cursor: "pointer" },
  ghostButton: { border: "1px solid #94a3b8", borderRadius: 8, background: "#ffffff", color: "#0f172a", fontWeight: 700, padding: "9px 14px", cursor: "pointer" },
  baseButton: { border: "1px solid #d97706", borderRadius: 8, background: "#fffbeb", color: "#92400e", fontWeight: 800, padding: "9px 14px", cursor: "pointer" },
};
