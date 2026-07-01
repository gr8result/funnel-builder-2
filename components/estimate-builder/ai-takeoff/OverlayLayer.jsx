// OverlayLayer.jsx
// SVG layer rendered on top of the plan canvas.
// Draws all overlays colour-coded by type, shows selection handles,
// and emits click/pointer events for interaction.
//
// Props:
//   overlays        Overlay[]
//   selectedId      string | null
//   drawingPreview  { type, points, preview } | null   — in-progress drawing
//   calibrating     { points: Point[] } | null
//   width           number   — SVG viewBox width
//   height          number   — SVG viewBox height
//   zoom            number   — canvas zoom factor
//   onOverlayClick  (id, overlay) => void
//   onPointDrag     (id, pointIndex, newPoint) => void
//   onSvgMouseDown  (pt) => void
//   onSvgMouseMove  (pt) => void
//   onSvgMouseUp    (pt) => void
//   onSvgDoubleClick(pt) => void

import { useCallback, useRef } from "react";
import {
  OVERLAY_STYLE, OVERLAY_STATUS,
  LINEAR_TYPES, POLYGON_TYPES, MARKER_TYPES,
} from "./takeoffTypes";
import { polygonCentroid } from "./takeoffUtils";

const STATUS_DASH = {
  [OVERLAY_STATUS.SUGGESTED]: "6 3",
  [OVERLAY_STATUS.EDITED]:    "4 2",
  [OVERLAY_STATUS.CONFIRMED]: "none",
};

const STATUS_OPACITY = {
  [OVERLAY_STATUS.SUGGESTED]: 0.65,
  [OVERLAY_STATUS.EDITED]:    0.85,
  [OVERLAY_STATUS.CONFIRMED]: 1,
};

export default function OverlayLayer({
  overlays = [], selectedId, drawingPreview,
  calibrating, width, height,
  onOverlayClick, onPointDrag,
  onSvgMouseDown, onSvgMouseMove, onSvgMouseUp, onSvgDoubleClick,
}) {
  const svgRef = useRef(null);

  const svgPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = width  / rect.width;
    const scaleY = height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }, [width, height]);

  return (
    <svg
      ref={svgRef}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "visible" }}
      viewBox={`0 0 ${width} ${height}`}
      onMouseDown={(e) => onSvgMouseDown?.(svgPoint(e))}
      onMouseMove={(e) => onSvgMouseMove?.(svgPoint(e))}
      onMouseUp={(e)   => onSvgMouseUp?.(svgPoint(e))}
      onDoubleClick={(e) => { e.preventDefault(); onSvgDoubleClick?.(svgPoint(e)); }}
    >
      {/* ── Confirmed / edited / suggested overlays ─────────────────────────── */}
      {overlays.map((ov) => (
        <OverlayShape
          key={ov.id}
          overlay={ov}
          selected={ov.id === selectedId}
          onOverlayClick={onOverlayClick}
        />
      ))}

      {/* ── Drag handles for selected overlay ──────────────────────────────── */}
      {overlays.filter((ov) => ov.id === selectedId).map((ov) => (
        <DragHandles
          key={`handles-${ov.id}`}
          overlay={ov}
          onPointDrag={onPointDrag}
          svgRef={svgRef}
          svgWidth={width}
          svgHeight={height}
        />
      ))}

      {/* ── In-progress drawing preview ─────────────────────────────────────── */}
      {drawingPreview && <DrawingPreview preview={drawingPreview} />}

      {/* ── Calibration points ──────────────────────────────────────────────── */}
      {calibrating && calibrating.points.map((pt, i) => (
        <g key={`cal-${i}`}>
          <circle cx={pt.x} cy={pt.y} r={8}  fill="rgba(239,68,68,0.2)" />
          <circle cx={pt.x} cy={pt.y} r={4}  fill="#ef4444" />
          <text x={pt.x + 10} y={pt.y - 6} fontSize={11} fill="#ef4444" fontWeight="bold">
            Cal {i + 1}
          </text>
        </g>
      ))}
      {calibrating && calibrating.points.length === 2 && (
        <line
          x1={calibrating.points[0].x} y1={calibrating.points[0].y}
          x2={calibrating.points[1].x} y2={calibrating.points[1].y}
          stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 3"
        />
      )}
    </svg>
  );
}

// ── Single overlay shape ──────────────────────────────────────────────────────

function OverlayShape({ overlay, selected, onOverlayClick }) {
  const ov     = overlay;
  const style  = OVERLAY_STYLE[ov.type] || { stroke: "#888", strokeWidth: 1, fill: "none" };
  const dash   = STATUS_DASH[ov.status]   || "none";
  const opac   = STATUS_OPACITY[ov.status] ?? 1;

  const selExtraStroke   = selected ? "#f59e0b" : "none";
  const selExtraWidth    = selected ? 3 : 0;

  const handleClick = (e) => {
    e.stopPropagation();
    onOverlayClick?.(ov.id, ov);
  };

  // ── Linear (walls) ───────────────────────────────────────────────────────
  if (LINEAR_TYPES.has(ov.type)) {
    if (!ov.points || ov.points.length < 2) return null;
    const pts = ov.points.map((p) => `${p.x},${p.y}`).join(" ");
    return (
      <g opacity={opac} onClick={handleClick} style={{ cursor: "pointer" }}>
        {/* Fat invisible hit target */}
        <polyline points={pts} stroke="transparent" strokeWidth={16} fill="none" />
        {/* Selection glow */}
        {selected && <polyline points={pts} stroke={selExtraStroke} strokeWidth={style.strokeWidth + selExtraWidth + 2} fill="none" strokeLinecap="round" />}
        {/* Actual line */}
        <polyline
          points={pts}
          stroke={style.stroke}
          strokeWidth={style.strokeWidth}
          fill="none"
          strokeDasharray={dash}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Mid-point label */}
        {ov.label && <WallLabel points={ov.points} label={ov.label} color={style.stroke} />}
      </g>
    );
  }

  // ── Polygon (rooms, wet areas, etc.) ─────────────────────────────────────
  if (POLYGON_TYPES.has(ov.type)) {
    if (!ov.points || ov.points.length < 3) return null;
    const pts     = ov.points.map((p) => `${p.x},${p.y}`).join(" ");
    const centroid= polygonCentroid(ov.points);
    return (
      <g opacity={opac} onClick={handleClick} style={{ cursor: "pointer" }}>
        {selected && (
          <polygon points={pts} stroke={selExtraStroke} strokeWidth={style.strokeWidth + selExtraWidth + 1} fill="none" />
        )}
        <polygon
          points={pts}
          stroke={style.stroke}
          strokeWidth={style.strokeWidth}
          fill={style.fill || "none"}
          strokeDasharray={dash}
          strokeLinejoin="round"
        />
        {ov.label && (
          <text
            x={centroid.x} y={centroid.y}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={11} fontWeight="600" fill={style.stroke}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {ov.label}
          </text>
        )}
      </g>
    );
  }

  // ── Marker (doors, windows) ───────────────────────────────────────────────
  if (MARKER_TYPES.has(ov.type)) {
    const pt = ov.points?.[0];
    if (!pt) return null;
    return (
      <g opacity={opac} onClick={handleClick} style={{ cursor: "pointer" }}>
        {selected && <circle cx={pt.x} cy={pt.y} r={14} fill={selExtraStroke} opacity={0.3} />}
        <circle cx={pt.x} cy={pt.y} r={9}  fill={style.fill || style.stroke} stroke="#fff" strokeWidth={1.5} />
        <text x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight="bold" fill="#fff" style={{ pointerEvents: "none", userSelect: "none" }}>
          {OVERLAY_STYLE[ov.type]?.short || "?"}
        </text>
      </g>
    );
  }

  return null;
}

// ── Wall mid-label ────────────────────────────────────────────────────────────

function WallLabel({ points, label, color }) {
  if (points.length < 2) return null;
  const mid = {
    x: (points[0].x + points[points.length - 1].x) / 2,
    y: (points[0].y + points[points.length - 1].y) / 2,
  };
  return (
    <text
      x={mid.x} y={mid.y - 6}
      textAnchor="middle" fontSize={9} fill={color} fontWeight="600"
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      {label}
    </text>
  );
}

// ── Drag handles ──────────────────────────────────────────────────────────────

function DragHandles({ overlay, onPointDrag, svgRef, svgWidth, svgHeight }) {
  const dragging = useRef(null);

  const handleMouseDown = (index) => (e) => {
    e.stopPropagation();
    dragging.current = index;
    const onMove = (me) => {
      if (dragging.current === null) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect   = svg.getBoundingClientRect();
      const scaleX = svgWidth  / rect.width;
      const scaleY = svgHeight / rect.height;
      const pt = {
        x: Math.max(0, Math.min(svgWidth,  (me.clientX - rect.left) * scaleX)),
        y: Math.max(0, Math.min(svgHeight, (me.clientY - rect.top)  * scaleY)),
      };
      onPointDrag?.(overlay.id, dragging.current, pt);
    };
    const onUp = () => { dragging.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <>
      {(overlay.points || []).map((pt, i) => (
        <circle
          key={i}
          cx={pt.x} cy={pt.y}
          r={6}
          fill="#ffffff"
          stroke="#f59e0b"
          strokeWidth={2}
          style={{ cursor: "grab" }}
          onMouseDown={handleMouseDown(i)}
        />
      ))}
    </>
  );
}

// ── In-progress drawing preview ───────────────────────────────────────────────

function DrawingPreview({ preview }) {
  const { type, points = [], cursorPt } = preview;
  const style = OVERLAY_STYLE[type] || { stroke: "#888", strokeWidth: 1 };
  const allPts = cursorPt ? [...points, cursorPt] : points;

  if (LINEAR_TYPES.has(type)) {
    if (allPts.length < 2) return null;
    const pts = allPts.map((p) => `${p.x},${p.y}`).join(" ");
    return (
      <polyline
        points={pts}
        stroke={style.stroke} strokeWidth={style.strokeWidth}
        fill="none" strokeDasharray="5 3" opacity={0.7}
        strokeLinecap="round" strokeLinejoin="round"
      />
    );
  }

  if (POLYGON_TYPES.has(type)) {
    if (allPts.length < 2) return null;
    // Draw lines between accumulated points + cursor
    return (
      <>
        {allPts.length >= 3 && (
          <polygon
            points={allPts.map((p) => `${p.x},${p.y}`).join(" ")}
            stroke={style.stroke} strokeWidth={style.strokeWidth || 1}
            fill={style.fill || "rgba(100,100,255,0.1)"}
            strokeDasharray="4 2" opacity={0.6}
          />
        )}
        <polyline
          points={allPts.map((p) => `${p.x},${p.y}`).join(" ")}
          stroke={style.stroke} strokeWidth={style.strokeWidth || 1}
          fill="none" strokeDasharray="4 2" opacity={0.8}
          strokeLinecap="round" strokeLinejoin="round"
        />
      </>
    );
  }

  // Marker preview — just a circle at cursor
  if (MARKER_TYPES.has(type) && cursorPt) {
    return (
      <circle cx={cursorPt.x} cy={cursorPt.y} r={9}
        fill={style.fill || style.stroke} stroke="#fff" strokeWidth={1.5} opacity={0.7}
      />
    );
  }

  return null;
}
