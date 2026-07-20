import React from "react";
import type { TakeoffDocument, TakeoffObject, TakeoffPage } from "../state/takeoffTypes";

export default function PropertiesPanel({
  document,
  page,
  selectedObject,
  onUpdateSelected,
  onConfirmSelected,
  onRejectSelected,
  onDeleteSelected,
  onToggleCalibrationLine,
}: {
  document: TakeoffDocument;
  page: TakeoffPage | null;
  selectedObject?: TakeoffObject | null;
  onUpdateSelected?: (patch: Partial<TakeoffObject>) => void;
  onConfirmSelected?: () => void;
  onRejectSelected?: () => void;
  onDeleteSelected?: () => void;
  onToggleCalibrationLine?: () => void;
}) {
  const scaleConfirmed = page?.scaleStatus === "confirmed";
  return (
    <aside style={styles.panel}>
      <div style={styles.title}>Properties</div>
      {page ? (
        <div style={styles.grid}>
          <span>Document</span><strong>{document.fileName || document.name}</strong>
          <span>Hash</span><strong>{document.fileHash ? document.fileHash.slice(0, 12) : "None"}</strong>
          <span>Page</span><strong>{page.pageNumber} of {document.pageCount}</strong>
          <span>PDF size</span><strong>{Math.round(page.originalWidth)} x {Math.round(page.originalHeight)}</strong>
          <span>Final size</span><strong>{Math.round(page.renderedWidth)} x {Math.round(page.renderedHeight)}</strong>
          <span>Final</span><strong>{page.finalRotation}</strong>
          <span>Scale</span><strong>{scaleConfirmed && page.scaleRatio ? `Scale confirmed 1:${page.scaleRatio}` : "Not calibrated"}</strong>
          <span>Scale confidence</span><strong>{Math.round((page.scaleConfidence || 0) * 100)}%</strong>
          <span>Objects</span><strong>{page.aiDetectionRun ? page.objects?.filter((object) => object.status !== "rejected").length || 0 : 0}</strong>
        </div>
      ) : <div style={styles.empty}>Upload a PDF to inspect page data.</div>}
      {scaleConfirmed ? (
        <button type="button" style={styles.fullButton} onClick={onToggleCalibrationLine}>
          {page?.showCalibrationLine ? "Hide Calibration Line" : "Show Calibration Line"}
        </button>
      ) : null}

      {selectedObject ? (
        <div style={styles.objectPanel}>
          <div style={styles.title}>Selected Object</div>
          <label style={styles.label}>Label</label>
          <input
            style={styles.input}
            value={selectedObject.label || ""}
            onChange={(event) => onUpdateSelected?.({ label: event.target.value })}
          />
          <div style={styles.grid}>
            <span>Type</span><strong>{selectedObject.wallType || selectedObject.type}</strong>
            <span>Status</span><strong>{selectedObject.status}</strong>
            <span>Confidence</span><strong>{Math.round((selectedObject.confidence || 0) * 100)}%</strong>
            <span>Length</span><strong>{selectedObject.lengthMm ? `${selectedObject.lengthMm.toLocaleString()} mm` : "-"}</strong>
            <span>Area</span><strong>{selectedObject.areaMm2 ? `${(selectedObject.areaMm2 / 1000000).toFixed(2)} m2` : "-"}</strong>
            <span>Perimeter</span><strong>{selectedObject.perimeterMm ? `${selectedObject.perimeterMm.toLocaleString()} mm` : "-"}</strong>
          </div>
          {selectedObject.type === "wall" ? (
            <div style={styles.row}>
              <button type="button" style={styles.button} onClick={() => onUpdateSelected?.({ wallType: "exterior", displayColour: "green", status: "edited" })}>Exterior</button>
              <button type="button" style={styles.button} onClick={() => onUpdateSelected?.({ wallType: "interior", displayColour: "blue", status: "edited" })}>Interior</button>
            </div>
          ) : null}
          <div style={styles.row}>
            <button type="button" style={styles.primaryButton} onClick={onConfirmSelected}>Confirm</button>
            <button type="button" style={styles.button} onClick={onRejectSelected}>Reject</button>
            <button type="button" style={styles.dangerButton} onClick={onDeleteSelected}>Delete</button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    minWidth: 245,
    width: 245,
    borderLeft: "1px solid #d7dee8",
    background: "#ffffff",
    padding: 10,
    overflow: "auto",
  },
  title: {
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "82px minmax(0, 1fr)",
    gap: "7px 8px",
    alignItems: "start",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
  },
  empty: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },
  objectPanel: {
    marginTop: 14,
    borderTop: "1px solid #e2e8f0",
    paddingTop: 12,
    display: "grid",
    gap: 8,
  },
  label: {
    color: "#475569",
    fontSize: 11,
    fontWeight: 900,
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "7px 8px",
    fontSize: 12,
    fontWeight: 800,
  },
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  button: {
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    background: "#ffffff",
    color: "#0f172a",
    padding: "6px 8px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  primaryButton: {
    border: "1px solid #0f766e",
    borderRadius: 6,
    background: "#0f766e",
    color: "#ffffff",
    padding: "6px 8px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerButton: {
    border: "1px solid #fecaca",
    borderRadius: 6,
    background: "#fff1f2",
    color: "#991b1b",
    padding: "6px 8px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  fullButton: {
    width: "100%",
    marginTop: 12,
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    background: "#ffffff",
    color: "#0f172a",
    padding: "7px 8px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
};
