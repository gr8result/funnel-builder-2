import { useEffect, useRef, useState } from "react";
import { usePdfDocument } from "../viewer/usePdfDocument.js";

function PageThumb({ page, pdfDocument, selected, onSelect }) {
  const canvasRef = useRef(null);
  const [renderState, setRenderState] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    let renderTask = null;

    async function renderThumb() {
      if (!pdfDocument || !page?.pageNumber || !canvasRef.current) return;
      setRenderState("loading");
      try {
        const pdfPage = await pdfDocument.getPage(page.pageNumber);
        if (cancelled) return;
        const baseViewport = pdfPage.getViewport({ scale: 1, rotation: page.rotation || 0 });
        const maxWidth = 156;
        const maxHeight = 118;
        const scale = Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height);
        const viewport = pdfPage.getViewport({ scale, rotation: page.rotation || 0 });
        const canvas = canvasRef.current;
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
        canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));
        canvas.style.width = `${Math.round(viewport.width)}px`;
        canvas.style.height = `${Math.round(viewport.height)}px`;
        const context = canvas.getContext("2d");
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);
        renderTask = pdfPage.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) setRenderState("ready");
      } catch (error) {
        if (!cancelled && error?.name !== "RenderingCancelledException") setRenderState("error");
      }
    }

    renderThumb();
    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [page?.pageNumber, page?.rotation, pdfDocument]);

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid="plan-page-thumb"
      data-page-id={page.id}
      data-selected={selected ? "true" : "false"}
      style={{ ...S.thumb, ...(selected ? S.thumbSelected : {}) }}
    >
      <span style={S.canvasWrap}>
        <canvas ref={canvasRef} style={S.canvas} data-testid="plan-page-thumb-canvas" />
        {renderState !== "ready" && (
          <span style={S.placeholder}>{renderState === "error" ? "Preview unavailable" : "Rendering..."}</span>
        )}
      </span>
      <span style={S.pageLabel}>Page {page.pageNumber}</span>
    </button>
  );
}

function DocumentPageGroup({ planDocument, pages, selectedPageId, onSelectPage }) {
  const { pdfDocument, error } = usePdfDocument(planDocument);

  return (
    <div style={S.group}>
      <div style={S.groupLabel}>{planDocument.fileName}</div>
      {error ? <div style={S.error}>{error}</div> : null}
      <div style={S.groupPages}>
        {pages.map((page) => (
          <PageThumb
            key={page.id}
            page={page}
            pdfDocument={pdfDocument}
            selected={page.id === selectedPageId}
            onSelect={() => onSelectPage(planDocument.id, page.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default function PlanPageStrip({ documents, pagesByDocument, selectedPageId, onSelectPage }) {
  if (!documents.length) return null;

  return (
    <div style={S.strip} data-testid="plan-page-strip">
      {documents.map((planDocument) => (
        <DocumentPageGroup
          key={planDocument.id}
          planDocument={planDocument}
          pages={pagesByDocument[planDocument.id] || []}
          selectedPageId={selectedPageId}
          onSelectPage={onSelectPage}
        />
      ))}
    </div>
  );
}

const S = {
  strip: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12, padding: "4px 10px 12px", overflowY: "auto" },
  group: { display: "flex", flexDirection: "column", gap: 7 },
  groupLabel: { fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  groupPages: { display: "flex", flexDirection: "column", gap: 9 },
  thumb: { width: "100%", border: "2px solid #e2e8f0", borderRadius: 7, padding: 7, cursor: "pointer", background: "#fff", display: "grid", justifyItems: "center", gap: 5, textAlign: "center" },
  thumbSelected: { border: "2px solid #2563eb", background: "#eff6ff", boxShadow: "0 0 0 2px rgba(37,99,235,0.14)" },
  canvasWrap: { position: "relative", width: 158, minHeight: 92, display: "grid", placeItems: "center", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" },
  canvas: { display: "block", maxWidth: "100%", background: "#fff" },
  placeholder: { position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 8, color: "#64748b", fontSize: 11, fontWeight: 750, background: "rgba(248,250,252,0.86)" },
  pageLabel: { fontSize: 11, color: "#0f172a", fontWeight: 900 },
  error: { border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 5, padding: "6px 7px", fontSize: 11, fontWeight: 750 },
};
