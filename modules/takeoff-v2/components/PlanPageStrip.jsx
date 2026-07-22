import { useEffect, useRef } from "react";
import { createPageRenderer } from "../viewer/PdfViewport.js";
import { usePdfDocument } from "../viewer/usePdfDocument.js";

const THUMB_WIDTH = 96;

function PageThumb({ planDocument, page, selected, onSelect }) {
  const { pdfDocument } = usePdfDocument(planDocument);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return undefined;
    if (!rendererRef.current) rendererRef.current = createPageRenderer(canvasRef.current);

    const isSideways = page.rotation === 90 || page.rotation === 270;
    const unrotatedWidth = page.sourceWidth || 1;
    const baseScale = THUMB_WIDTH / (isSideways ? (page.sourceHeight || 1) : unrotatedWidth);

    rendererRef.current.render({
      pdfDocument,
      pageNumber: page.pageNumber,
      rotation: page.rotation,
      scale: baseScale,
    }).catch(() => {});

    return () => rendererRef.current?.cancel();
  }, [pdfDocument, page.pageNumber, page.rotation, page.sourceWidth, page.sourceHeight]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      data-testid="plan-page-thumb"
      data-page-id={page.id}
      data-selected={selected ? "true" : "false"}
      style={{ ...S.thumb, ...(selected ? S.thumbSelected : {}) }}
    >
      <canvas ref={canvasRef} style={S.canvas} />
      <div style={S.pageLabel}>Page {page.pageNumber}</div>
    </div>
  );
}

export default function PlanPageStrip({ documents, pagesByDocument, selectedPageId, onSelectPage }) {
  if (!documents.length) return null;

  return (
    <div style={S.strip} data-testid="plan-page-strip">
      {documents.map((planDocument) => (
        <div key={planDocument.id} style={S.group}>
          <div style={S.groupLabel}>{planDocument.fileName}</div>
          <div style={S.groupPages}>
            {(pagesByDocument[planDocument.id] || []).map((page) => (
              <PageThumb
                key={page.id}
                planDocument={planDocument}
                page={page}
                selected={page.id === selectedPageId}
                onSelect={() => onSelectPage(planDocument.id, page.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const S = {
  strip: { display: "flex", flexDirection: "column", gap: 12, padding: 12, overflowY: "auto" },
  group: { display: "flex", flexDirection: "column", gap: 6 },
  groupLabel: { fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" },
  groupPages: { display: "flex", flexWrap: "wrap", gap: 8 },
  thumb: { border: "1.5px solid #e2e8f0", borderRadius: 6, padding: 4, cursor: "pointer", background: "#fff" },
  thumbSelected: { border: "1.5px solid #3b82f6", background: "#eff6ff" },
  canvas: { display: "block", maxWidth: THUMB_WIDTH },
  pageLabel: { fontSize: 10, color: "#334155", textAlign: "center", marginTop: 2 },
};
