import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  WALL_LAB_CLASSES,
  WALL_LAB_COLORS,
  compareDetectionResults,
  detectWallsFromImageData,
  hitTestWall,
} from "../../modules/wall-lab/wallLabDetector";

const PNG_ENDPOINT = "/api/dev/wall-lab/benchmark-image";
const PDF_ENDPOINT = "/api/dev/wall-lab/benchmark-pdf";
const ISOLATION_INSTRUCTION =
  "Do not modify the production Takeoff Engine while building this laboratory. Build the detector in complete isolation. Only after the PNG benchmark succeeds should any code be integrated back into the production Takeoff Engine.";

export default function WallDetectionLaboratory() {
  const originalCanvasRef = useRef(null);
  const candidatesCanvasRef = useRef(null);
  const acceptedCanvasRef = useRef(null);
  const rejectedCanvasRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const pdfOverlayCanvasRef = useRef(null);
  const [pngImage, setPngImage] = useState(null);
  const [pngResult, setPngResult] = useState(null);
  const [pdfResult, setPdfResult] = useState(null);
  const [hoveredWallId, setHoveredWallId] = useState(null);
  const [selectedWallIds, setSelectedWallIds] = useState(() => new Set());
  const [status, setStatus] = useState("Loading PNG benchmark...");
  const [pdfStatus, setPdfStatus] = useState("Waiting for PNG detector.");

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      setPngImage(image);
      const canvas = originalCanvasRef.current;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = detectWallsFromImageData(imageData, { source: "png" });
      setPngResult(result);
      setStatus(`PNG benchmark analysed: ${result.walls.length} accepted structural walls.`);
    };
    image.onerror = () => setStatus("PNG benchmark failed to load.");
    image.src = `${PNG_ENDPOINT}?t=${Date.now()}`;
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pngImage || !pngResult) return;
    drawImageToCanvas(candidatesCanvasRef.current, pngImage, (context) => {
      drawRejected(context, pngResult.rejected, 0.9);
      drawWalls(context, pngResult.candidates, { color: WALL_LAB_COLORS[WALL_LAB_CLASSES.UNKNOWN], alpha: 0.55, widthOffset: 2 });
      drawWalls(context, pngResult.walls, { color: WALL_LAB_COLORS[WALL_LAB_CLASSES.STRUCTURAL_WALL], alpha: 0.95, widthOffset: 4 });
    });
    drawImageToCanvas(acceptedCanvasRef.current, pngImage, (context) => {
      context.globalAlpha = 0.22;
      context.drawImage(pngImage, 0, 0);
      context.globalAlpha = 1;
      drawWalls(context, pngResult.walls, { color: WALL_LAB_COLORS[WALL_LAB_CLASSES.STRUCTURAL_WALL], alpha: 0.95, widthOffset: 4 });
    });
    drawImageToCanvas(rejectedCanvasRef.current, pngImage, (context) => {
      context.globalAlpha = 0.2;
      context.drawImage(pngImage, 0, 0);
      context.globalAlpha = 1;
      drawRejected(context, pngResult.rejected, 1);
    });
  }, [pngImage, pngResult]);

  useEffect(() => {
    if (!pngResult) return;

    let cancelled = false;
    async function runPdfComparison() {
      try {
        setPdfStatus("Rendering PDF with the same wall detector...");
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const response = await fetch(`${PDF_ENDPOINT}?t=${Date.now()}`);
        if (!response.ok) throw new Error("PDF benchmark failed to load.");
        const data = await response.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data, disableWorker: true });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = pdfCanvasRef.current;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvasContext: context, viewport }).promise;
        if (cancelled) return;

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = detectWallsFromImageData(imageData, { source: "pdf" });
        setPdfResult(result);
        drawImageToCanvas(pdfOverlayCanvasRef.current, canvas, (overlayContext) => {
          overlayContext.globalAlpha = 0.25;
          overlayContext.drawImage(canvas, 0, 0);
          overlayContext.globalAlpha = 1;
          drawRejected(overlayContext, result.rejected, 0.75);
          drawWalls(overlayContext, result.walls, { color: WALL_LAB_COLORS[WALL_LAB_CLASSES.STRUCTURAL_WALL], alpha: 0.9, widthOffset: 4 });
        });
        setPdfStatus(`PDF comparison analysed: ${result.walls.length} accepted structural walls.`);
      } catch (error) {
        setPdfStatus(error.message || "PDF comparison failed.");
      }
    }

    runPdfComparison();
    return () => {
      cancelled = true;
    };
  }, [pngResult]);

  const comparison = useMemo(() => compareDetectionResults(pngResult, pdfResult), [pngResult, pdfResult]);
  const hoveredWall = pngResult?.walls.find((wall) => wall.id === hoveredWallId) || null;
  const selectedWalls = useMemo(
    () => pngResult?.walls.filter((wall) => selectedWallIds.has(wall.id)) || [],
    [pngResult, selectedWallIds]
  );

  const handleWallPointerMove = useCallback(
    (event) => {
      if (!pngResult || !acceptedCanvasRef.current) return;
      const point = eventToCanvasPoint(event, acceptedCanvasRef.current, pngResult.width, pngResult.height);
      const wall = hitTestWall(pngResult.walls, point, 10);
      setHoveredWallId(wall?.id || null);
    },
    [pngResult]
  );

  const handleWallClick = useCallback(
    (event) => {
      if (!pngResult || !acceptedCanvasRef.current) return;
      const point = eventToCanvasPoint(event, acceptedCanvasRef.current, pngResult.width, pngResult.height);
      const wall = hitTestWall(pngResult.walls, point, 10);
      if (!wall) return;
      setSelectedWallIds((current) => {
        const next = new Set(current);
        if (next.has(wall.id)) next.delete(wall.id);
        else next.add(wall.id);
        return next;
      });
    },
    [pngResult]
  );

  return (
    <main className="lab-shell">
      <section className="instruction">{ISOLATION_INSTRUCTION}</section>
      <header className="lab-header">
        <div>
          <p>Developer Route /dev/wall-lab</p>
          <h1>Wall Detection Laboratory</h1>
        </div>
        <div className="status-block">
          <span>{status}</span>
          <span>{pdfStatus}</span>
        </div>
      </header>

      <section className="stage-grid">
        <CanvasPanel title="Panel 1" subtitle="Original PNG">
          <canvas ref={originalCanvasRef} data-testid="wall-lab-original" />
        </CanvasPanel>
        <CanvasPanel title="Panel 2" subtitle="Detected wall candidates">
          <canvas ref={candidatesCanvasRef} data-testid="wall-lab-candidates" />
        </CanvasPanel>
        <CanvasPanel title="Panel 3" subtitle="Accepted structural walls">
          <div className="interactive-canvas" onMouseMove={handleWallPointerMove} onMouseLeave={() => setHoveredWallId(null)} onClick={handleWallClick}>
            <canvas ref={acceptedCanvasRef} data-testid="wall-lab-accepted" />
            <svg viewBox={`0 0 ${pngResult?.width || 1} ${pngResult?.height || 1}`} preserveAspectRatio="none">
              {selectedWalls.map((wall) => (
                <WallPath key={`selected-${wall.id}`} wall={wall} className="selected-wall" />
              ))}
              {hoveredWall ? <WallPath wall={hoveredWall} className="hover-wall" /> : null}
            </svg>
          </div>
        </CanvasPanel>
        <CanvasPanel title="Panel 4" subtitle="Rejected geometry">
          <canvas ref={rejectedCanvasRef} data-testid="wall-lab-rejected" />
        </CanvasPanel>
      </section>

      <section className="diagnostics-grid">
        <Diagnostics title="PNG Diagnostics" result={pngResult} />
        <ComparisonPanel comparison={comparison} pngResult={pngResult} pdfResult={pdfResult} />
      </section>

      <section className="pdf-grid">
        <CanvasPanel title="PDF stage" subtitle="Original PDF page render">
          <canvas ref={pdfCanvasRef} data-testid="wall-lab-pdf-original" />
        </CanvasPanel>
        <CanvasPanel title="PDF stage" subtitle="Same detector over PDF render">
          <canvas ref={pdfOverlayCanvasRef} data-testid="wall-lab-pdf-detected" />
        </CanvasPanel>
      </section>

      <style jsx>{`
        .lab-shell {
          min-height: 100vh;
          background: #f6f7f9;
          color: #111827;
          padding: 18px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .instruction {
          border: 1px solid #111827;
          background: #fff7cc;
          color: #111827;
          padding: 12px 14px;
          font-weight: 700;
          font-size: 14px;
          margin-bottom: 14px;
        }

        .lab-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-end;
          margin-bottom: 16px;
        }

        .lab-header p {
          margin: 0 0 4px;
          color: #5b6472;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          font-size: 30px;
          line-height: 1.1;
        }

        .status-block {
          display: grid;
          gap: 6px;
          max-width: 420px;
          font-size: 13px;
          color: #374151;
          text-align: right;
        }

        .stage-grid,
        .pdf-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          align-items: start;
        }

        .pdf-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-top: 12px;
        }

        .diagnostics-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 12px;
          margin-top: 12px;
        }

        .interactive-canvas {
          position: relative;
          cursor: crosshair;
        }

        canvas,
        svg {
          display: block;
          width: 100%;
          height: auto;
        }

        .interactive-canvas svg {
          position: absolute;
          inset: 0;
          height: 100%;
          pointer-events: none;
        }

        .hover-wall {
          fill: none;
          stroke: #0ea5e9;
          stroke-width: 8;
          stroke-linecap: round;
          filter: drop-shadow(0 0 5px #38bdf8);
        }

        .selected-wall {
          fill: none;
          stroke: #facc15;
          stroke-width: 10;
          stroke-linecap: round;
          opacity: 0.88;
          filter: drop-shadow(0 0 3px #fde047);
        }

        @media (max-width: 1180px) {
          .stage-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .lab-header,
          .diagnostics-grid,
          .pdf-grid,
          .stage-grid {
            grid-template-columns: 1fr;
            display: grid;
          }

          .status-block {
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}

function CanvasPanel({ title, subtitle, children }) {
  return (
    <article className="panel">
      <div className="panel-header">
        <span>{title}</span>
        <strong>{subtitle}</strong>
      </div>
      <div className="canvas-wrap">{children}</div>
      <style jsx>{`
        .panel {
          background: #ffffff;
          border: 1px solid #d7dce3;
          border-radius: 8px;
          overflow: hidden;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: baseline;
          padding: 10px 12px;
          border-bottom: 1px solid #e5e7eb;
        }

        .panel-header span {
          color: #6b7280;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .panel-header strong {
          font-size: 14px;
        }

        .canvas-wrap {
          padding: 10px;
          background: #f9fafb;
        }
      `}</style>
    </article>
  );
}

function Diagnostics({ title, result }) {
  const diagnostics = result?.diagnostics;
  return (
    <section className="diagnostic-panel">
      <h2>{title}</h2>
      <div className="metric-row">
        <Metric label="Detected walls" value={diagnostics?.detectedWalls ?? "-"} />
        <Metric label="Rejected dimensions" value={diagnostics?.rejectedDimensions ?? "-"} />
        <Metric label="Rejected furniture" value={diagnostics?.rejectedFurniture ?? "-"} />
        <Metric label="Rejected unknown" value={diagnostics?.rejectedUnknown ?? "-"} />
      </div>
      <Histogram title="Wall thickness histogram" values={diagnostics?.wallThicknessHistogram} />
      <Histogram title="Wall confidence histogram" values={diagnostics?.wallConfidenceHistogram} />
      <FindingList title="False positives to inspect" items={diagnostics?.falsePositives} empty="No unknown long geometry currently flagged." />
      <FindingList title="False negatives" items={diagnostics?.falseNegatives} empty="No detector-level missing-wall signal yet; visual review remains the benchmark." />
      <style jsx>{diagnosticStyles}</style>
    </section>
  );
}

function ComparisonPanel({ comparison, pngResult, pdfResult }) {
  return (
    <section className="diagnostic-panel">
      <h2>PDF Comparison</h2>
      <div className="metric-row">
        <Metric label="PNG detected" value={comparison?.pngDetectedWalls ?? pngResult?.walls.length ?? "-"} />
        <Metric label="PDF detected" value={comparison?.pdfDetectedWalls ?? pdfResult?.walls.length ?? "-"} />
        <Metric label="Delta" value={comparison ? comparison.delta : "-"} />
        <Metric label="Ratio" value={comparison ? comparison.ratio.toFixed(2) : "-"} />
      </div>
      <FindingList title="Why results differ" items={comparison?.likelyReasons} empty="PDF comparison has not completed yet." />
      <p className="note">
        The PDF stage is deliberately downstream. It uses the same detector as the PNG benchmark so differences point to
        rendering, scale, crop, or document-noise problems rather than a second wall algorithm.
      </p>
      <style jsx>{diagnosticStyles}</style>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Histogram({ title, values }) {
  return (
    <div className="histogram">
      <h3>{title}</h3>
      <div>
        {Object.entries(values || {}).map(([bucket, value]) => (
          <span key={bucket}>
            {bucket}: <strong>{value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function FindingList({ title, items, empty }) {
  const list = items?.length ? items : [empty];
  return (
    <div className="findings">
      <h3>{title}</h3>
      <ul>
        {list.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function WallPath({ wall, className }) {
  return (
    <line
      className={className}
      x1={wall.centreline.start.x}
      y1={wall.centreline.start.y}
      x2={wall.centreline.end.x}
      y2={wall.centreline.end.y}
    />
  );
}

function drawImageToCanvas(canvas, image, draw) {
  if (!canvas || !image) return;
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  if (draw) draw(context);
}

function drawWalls(context, walls, options) {
  for (const wall of walls || []) {
    context.save();
    context.globalAlpha = options.alpha ?? 1;
    context.strokeStyle = options.color;
    context.lineWidth = Math.max(3, wall.thickness + (options.widthOffset || 0));
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(wall.centreline.start.x, wall.centreline.start.y);
    context.lineTo(wall.centreline.end.x, wall.centreline.end.y);
    context.stroke();
    context.restore();
  }
}

function drawRejected(context, rejected, alpha) {
  for (const item of rejected || []) {
    if (item.type === WALL_LAB_CLASSES.TEXT) continue;
    const color = WALL_LAB_COLORS[item.type] || WALL_LAB_COLORS[WALL_LAB_CLASSES.UNKNOWN];
    const stroke = item.stroke;
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = item.type === WALL_LAB_CLASSES.DIMENSION ? 2.5 : 2;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(stroke.x1, stroke.y1);
    context.lineTo(stroke.x2, stroke.y2);
    context.stroke();
    context.restore();
  }
}

function eventToCanvasPoint(event, canvas, imageWidth, imageHeight) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * imageWidth,
    y: ((event.clientY - rect.top) / rect.height) * imageHeight,
  };
}

const diagnosticStyles = `
  .diagnostic-panel {
    background: #ffffff;
    border: 1px solid #d7dce3;
    border-radius: 8px;
    padding: 12px;
  }

  h2 {
    font-size: 16px;
    margin: 0 0 10px;
  }

  .metric-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .metric {
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    border-radius: 6px;
    padding: 8px;
  }

  .metric span {
    display: block;
    color: #6b7280;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .metric strong {
    display: block;
    font-size: 20px;
    margin-top: 3px;
  }

  .histogram,
  .findings {
    margin-top: 10px;
  }

  h3 {
    font-size: 13px;
    margin: 0 0 6px;
  }

  .histogram div {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .histogram span {
    border: 1px solid #e5e7eb;
    border-radius: 999px;
    padding: 3px 8px;
    font-size: 12px;
    background: #f9fafb;
  }

  ul {
    margin: 0;
    padding-left: 18px;
    color: #374151;
    font-size: 13px;
  }

  .note {
    color: #4b5563;
    font-size: 13px;
    line-height: 1.45;
    margin: 10px 0 0;
  }
`;
