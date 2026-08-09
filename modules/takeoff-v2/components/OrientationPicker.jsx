import { useEffect, useRef } from "react";
import { createPageRenderer } from "../viewer/PdfViewport.js";
import { ROTATIONS } from "../types.js";

const PREVIEW_WIDTH = 120;

function RotationPreview({ pdfDocument, page, rotation, onPick }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    if (!rendererRef.current) rendererRef.current = createPageRenderer(canvasRef.current);

    const sideways = rotation === 90 || rotation === 270;
    const unrotatedWidth = page.sourceWidth || 1;
    const unrotatedHeight = page.sourceHeight || 1;
    const width = sideways ? unrotatedHeight : unrotatedWidth;
    const scale = PREVIEW_WIDTH / width;

    rendererRef.current.render({ pdfDocument, pageNumber: page.pageNumber, rotation, scale }).catch(() => {});
    return () => rendererRef.current?.cancel();
  }, [pdfDocument, page.pageNumber, page.sourceWidth, page.sourceHeight, rotation]);

  return (
    <button type="button" style={S.option} onClick={() => onPick(rotation)} data-testid="orientation-pick-option" data-rotation={rotation}>
      <canvas ref={canvasRef} style={S.canvas} />
      <span style={S.label}>{rotation}&deg;</span>
    </button>
  );
}

/**
 * Shown when a page's orientation was never auto-applied (low confidence or no
 * native text at all — the non-OCR fallback for scanned pages). Purely a
 * convenience picker; Rotate Left/Right/Reset in the toolbar keep working
 * regardless of whether this is showing.
 */
export default function OrientationPicker({ pdfDocument, page, onPick }) {
  return (
    <div style={S.wrap} data-testid="orientation-picker">
      <div style={S.heading}>Orientation isn&apos;t confident for this page — pick the correct one:</div>
      <div style={S.options}>
        {ROTATIONS.map((rotation) => (
          <RotationPreview key={rotation} pdfDocument={pdfDocument} page={page} rotation={rotation} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

const S = {
  wrap: { padding: "10px 12px", background: "#eff6ff", borderBottom: "1px solid #bfdbfe" },
  heading: { fontSize: 12, fontWeight: 700, color: "#1e3a8a", marginBottom: 8 },
  options: { display: "flex", gap: 10 },
  option: { border: "1.5px solid #93c5fd", background: "#fff", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  canvas: { display: "block", maxWidth: PREVIEW_WIDTH, maxHeight: PREVIEW_WIDTH },
  label: { fontSize: 11, fontWeight: 800, color: "#1d4ed8" },
};
