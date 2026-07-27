import { useMemo, useState } from "react";
import { flattenPdfPageToImage, reprocessPdfPage } from "../../../lib/standard-inclusions/pdfImport.js";

// Sits between "PDF processed" and "saved as the live schedule" — the review
// step the previous import flow skipped entirely (it saved immediately on
// processing). Pages that imported cleanly need no action from the user;
// only pages with warnings or a low fidelity score need a decision.
export default function PdfImportReview({ preview, onConfirm, onCancel, onSaveAsBaseTemplate, canSaveAsBaseTemplate = false }) {
  const [pages, setPages] = useState(() => preview.document.pages.map((page, index) => ({
    ...page,
    _status: "pending", // pending | accepted | skipped | flattened | reprocessed
    _report: preview.pageReports?.[index] || null,
  })));
  const [activeIndex, setActiveIndex] = useState(0);
  const [busyIndex, setBusyIndex] = useState(-1);
  const [error, setError] = useState("");

  const activePage = pages[activeIndex];

  const summary = useMemo(() => ({
    pageCount: pages.length,
    textCount: preview.editableTextCount,
    imageCount: pages.reduce((sum, page) => sum + page.objects.filter((o) => o.type === "image").length, 0),
    shapeCount: pages.reduce((sum, page) => sum + page.objects.filter((o) => o.type === "shape" || o.type === "divider").length, 0),
    warningCount: preview.warnings.length,
    fontSubstitutions: preview.fontSubstitutions || [],
    ocrPageCount: preview.ocrPageCount || 0,
  }), [pages, preview]);

  function setPageStatus(index, status, patch = {}) {
    setPages((current) => current.map((page, i) => (i === index ? { ...page, ...patch, _status: status } : page)));
  }

  async function handleFlatten(index) {
    setBusyIndex(index);
    setError("");
    try {
      const pageNumber = index + 1;
      const flattened = await flattenPdfPageToImage(preview._pdf, pageNumber);
      setPageStatus(index, "flattened", { width: flattened.width, height: flattened.height, objects: flattened.objects });
    } catch (flattenError) {
      setError(flattenError?.message || `Could not flatten page ${index + 1}.`);
    }
    setBusyIndex(-1);
  }

  async function handleReprocess(index) {
    setBusyIndex(index);
    setError("");
    try {
      const pageNumber = index + 1;
      const result = await reprocessPdfPage(preview._pdf, pageNumber, { lib: preview._lib });
      setPageStatus(index, result.objects.length ? "reprocessed" : "pending", { width: result.width, height: result.height, objects: result.objects });
    } catch (reprocessError) {
      setError(reprocessError?.message || `Could not reprocess page ${index + 1}.`);
    }
    setBusyIndex(-1);
  }

  function handleSkip(index) {
    setPageStatus(index, "skipped");
  }

  function handleAccept(index) {
    setPageStatus(index, "accepted");
  }

  function buildFinalDocument() {
    const keptPages = pages.filter((page) => page._status !== "skipped").map(({ _status, _report, ...page }) => page);
    return {
      ...preview.document,
      pages: keptPages,
      activePageId: keptPages[0]?.id || preview.document.activePageId,
    };
  }

  function handleAcceptAll() {
    onConfirm(buildFinalDocument());
  }

  function handleConfirm() {
    onConfirm(buildFinalDocument());
  }

  function handleSaveAsBaseTemplate() {
    if (!window.confirm("Promote this imported schedule to the shared base template used by every new builder account? A backup of the previous base template is kept automatically.")) return;
    onSaveAsBaseTemplate?.(buildFinalDocument());
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <header style={styles.header}>
          <div>
            <h2 style={styles.title}>Review Imported Schedule</h2>
            <p style={styles.subtitle}>{preview.fileName} — {summary.pageCount} page{summary.pageCount === 1 ? "" : "s"} processed. Pages that imported cleanly need no action.</p>
          </div>
          <button type="button" style={styles.ghostButton} onClick={onCancel}>Cancel Import</button>
        </header>

        <div style={styles.summaryRow}>
          <SummaryStat label="Pages" value={summary.pageCount} />
          <SummaryStat label="Text boxes" value={summary.textCount} />
          <SummaryStat label="Images" value={summary.imageCount} />
          <SummaryStat label="Shapes" value={summary.shapeCount} />
          <SummaryStat label="OCR pages" value={summary.ocrPageCount} warn={summary.ocrPageCount > 0} />
          <SummaryStat label="Warnings" value={summary.warningCount} warn={summary.warningCount > 0} />
        </div>

        {summary.fontSubstitutions.length > 0 && (
          <div style={styles.fontBox}>
            <strong>Font substitutions:</strong>
            <ul style={styles.fontList}>
              {summary.fontSubstitutions.map((entry) => (
                <li key={`${entry.originalFont}-${entry.substitutedFont}`}>
                  "{entry.originalFont}" → {entry.substitutedFont} ({entry.method === "mapped" ? "explicit mapping" : "closest match"}, {entry.count}×)
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.body}>
          <div style={styles.pageList}>
            {pages.map((page, index) => (
              <button
                key={page.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                style={{ ...styles.pageListItem, ...(index === activeIndex ? styles.pageListItemActive : {}) }}
              >
                <span style={styles.pageListNumber}>{index + 1}</span>
                <span style={styles.pageListMeta}>
                  <strong>{page._status === "skipped" ? "Skipped" : `${page.objects.length} objects`}</strong>
                  {page._report?.warnings?.length ? <small style={styles.pageListWarning}>⚠ {page._report.warnings.length} warning(s)</small> : null}
                </span>
              </button>
            ))}
          </div>

          <div style={styles.pageDetail}>
            {activePage && (
              <>
                <div style={styles.pageDetailHeader}>
                  <h3 style={styles.pageDetailTitle}>Page {activeIndex + 1}</h3>
                  <span style={styles.statusTag}>{activePage._status}</span>
                </div>
                <p style={styles.pageDetailStats}>
                  {activePage.objects.filter((o) => o.type === "text").length} text ·{" "}
                  {activePage.objects.filter((o) => o.type === "image").length} images ·{" "}
                  {activePage.objects.filter((o) => o.type === "shape" || o.type === "divider").length} shapes
                </p>
                {activePage._report?.warnings?.map((warning, i) => (
                  <p key={i} style={styles.pageWarningText}>⚠ {warning}</p>
                ))}
                {activePage._report?.ocrConfidence != null && (
                  <p style={styles.pageWarningText}>OCR confidence: {Math.round(activePage._report.ocrConfidence)}%</p>
                )}
                <div style={styles.pageActions}>
                  <button type="button" style={styles.primaryButton} disabled={busyIndex === activeIndex} onClick={() => handleAccept(activeIndex)}>Accept Page</button>
                  <button type="button" style={styles.ghostButton} disabled={busyIndex === activeIndex} onClick={() => handleReprocess(activeIndex)}>
                    {busyIndex === activeIndex ? "Working..." : "Reprocess Page"}
                  </button>
                  <button type="button" style={styles.ghostButton} disabled={busyIndex === activeIndex} onClick={() => handleFlatten(activeIndex)}>
                    {busyIndex === activeIndex ? "Working..." : "Use As Flat Image"}
                  </button>
                  <button type="button" style={styles.dangerButton} disabled={busyIndex === activeIndex} onClick={() => handleSkip(activeIndex)}>Skip Page</button>
                </div>
              </>
            )}
          </div>
        </div>

        <footer style={styles.footer}>
          <button type="button" style={styles.ghostButton} onClick={onCancel}>Cancel</button>
          <button type="button" style={styles.primaryButton} onClick={handleAcceptAll}>Accept All &amp; Save</button>
          <button type="button" style={styles.confirmButton} onClick={handleConfirm}>Save With My Changes</button>
          {canSaveAsBaseTemplate && (
            <button type="button" style={styles.baseTemplateButton} onClick={handleSaveAsBaseTemplate}>Save As Base Template</button>
          )}
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
  overlay: { position: "fixed", inset: 0, background: "rgba(2,6,23,0.7)", display: "grid", placeItems: "center", zIndex: 200 },
  panel: { width: "min(960px, 96vw)", maxHeight: "92vh", overflowY: "auto", background: "#0b1626", color: "#e5eefb", borderRadius: 14, padding: 24, display: "grid", gap: 16 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  title: { margin: 0, fontSize: 20 },
  subtitle: { margin: "4px 0 0", color: "#93a4bd", fontSize: 13 },
  summaryRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 },
  stat: { border: "1px solid rgba(148,163,184,0.25)", borderRadius: 10, padding: 10, display: "grid", gap: 2, background: "rgba(15,23,42,0.6)" },
  statWarn: { borderColor: "rgba(251,191,36,0.5)" },
  fontBox: { border: "1px solid rgba(148,163,184,0.2)", borderRadius: 10, padding: "10px 12px", fontSize: 13 },
  fontList: { margin: "6px 0 0", paddingLeft: 18 },
  errorBox: { border: "1px solid rgba(248,113,113,0.45)", color: "#fecaca", background: "rgba(127,29,29,0.25)", borderRadius: 8, padding: "10px 12px", fontSize: 13 },
  body: { display: "grid", gridTemplateColumns: "220px 1fr", gap: 14, minHeight: 260 },
  pageList: { display: "grid", gap: 6, alignContent: "start", maxHeight: 420, overflowY: "auto" },
  pageListItem: { display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.6)", borderRadius: 8, padding: "8px 10px", color: "#e5eefb", cursor: "pointer", textAlign: "left" },
  pageListItemActive: { borderColor: "#2563eb", background: "rgba(37,99,235,0.18)" },
  pageListNumber: { width: 22, height: 22, borderRadius: 6, background: "rgba(56,189,248,0.16)", color: "#38bdf8", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800 },
  pageListMeta: { display: "grid", gap: 2, fontSize: 12 },
  pageListWarning: { color: "#fbbf24" },
  pageDetail: { border: "1px solid rgba(148,163,184,0.2)", borderRadius: 10, padding: 16, display: "grid", gap: 10, alignContent: "start" },
  pageDetailHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  pageDetailTitle: { margin: 0, fontSize: 15 },
  statusTag: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#93a4bd" },
  pageDetailStats: { margin: 0, color: "#93a4bd", fontSize: 13 },
  pageWarningText: { margin: 0, color: "#fbbf24", fontSize: 12.5 },
  pageActions: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 },
  footer: { display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid rgba(148,163,184,0.18)", paddingTop: 14 },
  primaryButton: { border: 0, borderRadius: 8, background: "#2563eb", color: "white", fontWeight: 800, padding: "9px 14px", cursor: "pointer" },
  confirmButton: { border: 0, borderRadius: 8, background: "#0f766e", color: "white", fontWeight: 800, padding: "9px 14px", cursor: "pointer" },
  ghostButton: { border: "1px solid rgba(148,163,184,0.35)", borderRadius: 8, background: "transparent", color: "#e5eefb", fontWeight: 700, padding: "9px 14px", cursor: "pointer" },
  dangerButton: { border: 0, borderRadius: 8, background: "#b91c1c", color: "white", fontWeight: 700, padding: "9px 14px", cursor: "pointer" },
  baseTemplateButton: { border: "1px solid #d97706", borderRadius: 8, background: "rgba(217,119,6,0.15)", color: "#fbbf24", fontWeight: 800, padding: "9px 14px", cursor: "pointer" },
};
