import { useEffect, useRef } from "react";
import { pageToScreenPoint } from "../viewer/pageToScreenPoint.js";
import { midpoint, distance } from "../takeoff/geometry.js";
import { formatLength } from "../takeoff/units.js";
import { normalizeRegionCorners } from "../takeoff/planRegion.js";
import { rectFromCorners } from "../takeoff/roomBoundaryDetection.js";

const IDENTITY_VIEW = { panX: 0, panY: 0, zoomScale: 1 };

const SNAP_STYLES = {
  intersection: { fill: "#7c3aed", radius: 4, label: "Intersection" },
  endpoint: { fill: "#2563eb", radius: 4, label: "Endpoint" },
  line: { fill: "#0d9488", radius: 3, label: "On line" },
  manual: { fill: "#f59e0b", radius: 3, label: "Manual" },
};

// Wall-drawing snap status text (spec: "Snap: Corner", "Snap: Wall endpoint",
// ...) — distinguishes an existing vertex of the graph being drawn ("Corner")
// from a detected line endpoint/intersection/nearest-point-on-line, and
// surfaces the H/V soft-lock as its own status when no geometry candidate
// was found at all.
// Suggested defaults from the spec, kept in one place so every marker/fill
// agrees: exterior green, internal blue, windows cyan, doors orange, open
// openings yellow, areas translucent purple, unconfirmed automatic
// candidates dashed red.
const WALL_COLOR = { exterior: "#16a34a", internal: "#2563eb" };
const OPENING_COLOR = {
  window: "#06b6d4",
  "internal-door": "#f97316",
  "external-door": "#f97316",
  "sliding-door": "#f97316",
  "garage-door": "#f97316",
  "open-opening": "#eab308",
};
const AUTOMATIC_UNCONFIRMED = "#dc2626";

function openingLayerFor(openingType) {
  if (openingType === "window") return "windows";
  if (openingType === "open-opening") return "openings";
  return "doors";
}

function isAutomaticCandidate(segment) {
  return segment?.source === "automatic" && segment.confirmed === false;
}

// Purely visual overlay, rendered as a sibling to the two plan canvases
// *inside* PlanViewer's existing pan/zoom transform wrapper — so every point
// drawn here inherits pan/zoom/rotation for free via that CSS transform,
// exactly like the canvases do. pointerEvents:"none" because all pointer
// handling stays on PlanViewer's own container (single source of truth for
// click-vs-drag-vs-pan detection).
export default function TakeoffCanvasOverlay({ page, tools, viewport, planGeometryIndex, sourceCanvas }) {
  if (!viewport) return null;
  const project = (point) => pageToScreenPoint({ viewport, ...IDENTITY_VIEW }, point.x, point.y);
  const layers = page?.layerVisibility || {};
  const showLayer = (key) => layers[key] !== false;
  const shouldShowWallSegment = (segment) => !isAutomaticCandidate(segment) || showLayer("automaticCandidates");

  const exteriorWalls = page?.exteriorWalls;
  const internalWalls = page?.internalWalls;
  const visibleExteriorSegments = exteriorWalls?.segments.filter(shouldShowWallSegment) || [];
  const visibleInternalSegments = internalWalls?.segments.filter(shouldShowWallSegment) || [];

  function displayVerticesFor(graph, field, visibleSegments) {
    if (!graph) return [];
    const visibleVertexIds = new Set();
    visibleSegments.forEach((segment) => {
      visibleVertexIds.add(segment.aId);
      visibleVertexIds.add(segment.bId);
    });
    return graph.vertices.filter((v) => visibleVertexIds.has(v.id)).map((v) =>
      tools.draggingVertex?.id === v.id && (tools.draggingVertex.field || "exteriorWalls") === field
        ? { ...v, x: tools.draggingVertex.x, y: tools.draggingVertex.y }
        : v
    );
  }
  const exteriorDisplayVertices = displayVerticesFor(exteriorWalls, "exteriorWalls", visibleExteriorSegments);
  const internalDisplayVertices = displayVerticesFor(internalWalls, "internalWalls", visibleInternalSegments);
  const exteriorVertexById = new Map(exteriorDisplayVertices.map((v) => [v.id, v]));
  const internalVertexById = new Map(internalDisplayVertices.map((v) => [v.id, v]));

  const isScaleOrMeasure = tools.activeTool === "set-scale" || tools.activeTool === "measure";
  const isWallDraw = tools.activeTool === "exterior-wall" || tools.activeTool === "internal-wall";
  const isOpeningTool = ["window", "internal-door", "external-door", "sliding-door", "garage-door", "open-opening"].includes(tools.activeTool);
  const isAreaTool = tools.activeTool === "area";
  const isPlanRegionTool = tools.activeTool === "plan-region";
  const isEditTool = tools.activeTool === "edit" || tools.activeTool === "edit-walls";
  const preview = tools.hoverPreview;

  const openings = (page?.openings || []).map((o) =>
    tools.draggingOpening?.id === o.id ? { ...o, start: tools.draggingOpening.start, end: tools.draggingOpening.end } : o
  );

  return (
    <>
      <svg
        width={viewport.width}
        height={viewport.height}
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" }}
        data-testid="takeoff-overlay"
        data-area-search-draft={tools.areaSearchDraft ? "true" : "false"}
      >
        {/* Confirmed calibration reference line (dim, small) */}
        {page?.calibration && (
          <CalibrationMark calibration={page.calibration} project={project} />
        )}

        {/* Saved measurements */}
        {(page?.measurements || []).map((measurement) => {
          const a = project(measurement.pointA);
          const b = project(measurement.pointB);
          const mid = project(midpoint(measurement.pointA, measurement.pointB));
          return (
            <g key={measurement.id} data-testid="measurement-line">
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0ea5e9" strokeWidth={2} />
              <circle cx={a.x} cy={a.y} r={4} fill="#0ea5e9" />
              <circle cx={b.x} cy={b.y} r={4} fill="#0ea5e9" />
              <rect x={mid.x - 28} y={mid.y - 18} width={56} height={16} fill="#0ea5e9" rx={3} />
              <text x={mid.x} y={mid.y - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
                {formatLength(measurement.lengthMm)}
              </text>
            </g>
          );
        })}

        {/* Plan region is an explicit region-edit overlay only. It is not wall
            geometry and must not appear during normal wall editing/delete. */}
        {isPlanRegionTool && page?.planRegion?.confirmed && (
          <PlanRegionRect region={page.planRegion} project={project} dashed={false} testId="plan-region-confirmed" />
        )}
        {isPlanRegionTool && !page?.planRegion?.confirmed && tools.suggestedPlanRegion && !tools.planRegionDraftCorner && (
          <PlanRegionRect region={tools.suggestedPlanRegion} project={project} dashed testId="plan-region-suggested" />
        )}
        {isPlanRegionTool && tools.planRegionDraftCorner && tools.planRegionHoverPoint && (
          <PlanRegionRect
            region={normalizeRegionCorners(tools.planRegionDraftCorner, tools.planRegionHoverPoint)}
            project={project}
            dashed
            testId="plan-region-draft"
          />
        )}

        {/* Confirmed area polygon fills */}
        {showLayer("areas") && (page?.areas || []).map((area) => {
          const boundary = area.outerBoundary || area.vertices || [];
          const pts = boundary.map((p) => project(p)).map((p) => `${p.x},${p.y}`).join(" ");
          const areaCenter = project(centroid(boundary));
          return (
            <g key={area.id} data-testid="area-polygon">
              <polygon points={pts} fill="rgba(124,58,237,0.15)" stroke="#7c3aed" strokeWidth={1.5} opacity={area.included === false ? 0.4 : 1} />
              <text x={areaCenter.x} y={areaCenter.y} textAnchor="middle" fontSize={11} fontWeight={700} fill="#5b21b6">{area.name}</text>
              {(area.holes || []).map((hole) => {
                const holePts = hole.vertices.map((p) => project(p)).map((p) => `${p.x},${p.y}`).join(" ");
                return <polygon key={hole.id} points={holePts} fill="rgba(249,115,22,0.20)" stroke="#f97316" strokeWidth={1.2} strokeDasharray="4 3" data-testid="area-exclusion-polygon" />;
              })}
            </g>
          );
        })}

        {/* In-progress manual area trace */}
        {isAreaTool && tools.areaDraftVertices.length > 0 && (
          <ManualAreaDraft vertices={tools.areaDraftVertices} hoverPoint={tools.areaHoverPoint} project={project} />
        )}
        {isAreaTool && tools.areaSearchDraft?.start && tools.areaSearchDraft?.end && (
          <AreaSearchRect rect={rectFromCorners(tools.areaSearchDraft.start, tools.areaSearchDraft.end)} project={project} />
        )}

        {/* Exterior + internal wall segments */}
        {showLayer("exteriorWalls") && visibleExteriorSegments.map((segment) => (
          <WallSegmentLine key={segment.id} segment={segment} vertexById={exteriorVertexById} project={project}
            selected={tools.selectedField === "exteriorWalls" && tools.selectedSegmentId === segment.id} />
        ))}
        {showLayer("internalWalls") && visibleInternalSegments.map((segment) => (
          <WallSegmentLine key={segment.id} segment={segment} vertexById={internalVertexById} project={project}
            selected={tools.selectedField === "internalWalls" && tools.selectedSegmentId === segment.id} />
        ))}

        {/* Wall vertices, numbered — shown while editing or drawing that graph */}
        {(isEditTool || tools.activeTool === "exterior-wall") && exteriorWalls && exteriorDisplayVertices.map((vertex, index) => (
          <WallVertexDot key={vertex.id} vertex={vertex} index={index} project={project}
            selected={tools.selectedField === "exteriorWalls" && tools.selectedVertexId === vertex.id} />
        ))}
        {(isEditTool || tools.activeTool === "internal-wall") && internalWalls && internalDisplayVertices.map((vertex, index) => (
          <WallVertexDot key={vertex.id} vertex={vertex} index={index} project={project}
            selected={tools.selectedField === "internalWalls" && tools.selectedVertexId === vertex.id} />
        ))}

        {/* Chain-draw preview while editing walls (legacy exterior-only tool) */}
        {tools.activeTool === "edit-walls" && tools.selectedVertexId && tools.hoverPoint && exteriorVertexById.get(tools.selectedVertexId) && (
          <LiveLine from={exteriorVertexById.get(tools.selectedVertexId)} to={tools.hoverPoint} project={project} dashed />
        )}

        {/* Manual Exterior/Internal Wall drawing: keep the canvas precise.
            Length/status text lives outside the drawing area in the toolbar. */}
        {isWallDraw && tools.wallDrawHoverPreview?.point && (
          <SnapMarker point={tools.wallDrawHoverPreview.point} snap={tools.wallDrawHoverPreview.snap} project={project} />
        )}
        {isWallDraw && tools.wallDrawChainVertexId && tools.wallDrawHoverPreview?.point && (() => {
          const field = tools.activeTool === "exterior-wall" ? "exteriorWalls" : "internalWalls";
          const vertexById = field === "exteriorWalls" ? exteriorVertexById : internalVertexById;
          const chainStart = vertexById.get(tools.wallDrawChainVertexId);
          if (!chainStart) return null;

          return (
            <g data-testid="wall-draw-preview">
              <LiveLine from={chainStart} to={tools.wallDrawHoverPreview.point} project={project} />
            </g>
          );
        })()}

        {/* Wall openings: Window / Internal Door / External Door / Sliding Door / Garage Door / Open Opening */}
        {openings.map((opening) => {
          const layer = openingLayerFor(opening.openingType);
          if (!showLayer(layer)) return null;
          const selected = tools.selectedOpeningId === opening.id;
          return <OpeningGlyph key={opening.id} opening={opening} project={project} selected={selected} />;
        })}

        {/* Opening placement in progress: highlight host wall + live span */}
        {isOpeningTool && tools.openingHostWall && (
          <HighlightedSegmentPoints start={tools.openingHostWall.start} end={tools.openingHostWall.end} project={project} />
        )}
        {isOpeningTool && tools.openingStart && tools.openingHostWall && (
          <LiveLine from={tools.openingStart} to={tools.openingHostWall.point} project={project} />
        )}
        {isOpeningTool && tools.openingHostWall && !tools.openingStart && (
          <SnapMarker point={tools.openingHostWall.point} snap={{ kind: "line" }} project={project} />
        )}

        {/* Set Scale / Measure Length: snapped, axis-locked preview */}
        {isScaleOrMeasure && preview && (
          <>
            {preview.snap?.lineId && (
              <HighlightedPlanLine lineId={preview.snap.lineId} planGeometryIndex={planGeometryIndex} project={project} />
            )}
            {preview.snap?.lineIds && (
              <>
                {preview.snap.lineIds.map((lineId) => (
                  <HighlightedPlanLine key={lineId} lineId={lineId} planGeometryIndex={planGeometryIndex} project={project} />
                ))}
              </>
            )}

            {tools.pendingPoint && (
              <SnapMarker point={tools.pendingPoint.point} snap={tools.pendingPoint.snap} project={project} />
            )}

            {preview.valid ? (
              <SnapMarker point={preview.point} snap={preview.snap} project={project} />
            ) : (
              <Crosshair point={preview.rawPoint} project={project} />
            )}

            {tools.pendingPoint && preview.valid && (
              <AxisLockedPreviewLine
                from={tools.pendingPoint.point}
                to={preview.point}
                angleDegrees={preview.angleDegrees}
                project={project}
              />
            )}
          </>
        )}
      </svg>

      {isScaleOrMeasure && preview && sourceCanvas && (
        <Magnifier point={preview.valid ? preview.point : preview.rawPoint} project={project} viewport={viewport} sourceCanvas={sourceCanvas} />
      )}
    </>
  );
}

function centroid(vertices) {
  if (!Array.isArray(vertices) || vertices.length === 0) return { x: 0, y: 0 };
  const sum = vertices.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / vertices.length, y: sum.y / vertices.length };
}

function WallSegmentLine({ segment, vertexById, project, selected }) {
  const a = vertexById.get(segment.aId);
  const b = vertexById.get(segment.bId);
  if (!a || !b) return null;
  const pa = project(a);
  const pb = project(b);
  const unconfirmedAutomatic = segment.source === "automatic" && !segment.confirmed;
  const color = unconfirmedAutomatic ? AUTOMATIC_UNCONFIRMED : WALL_COLOR[segment.wallType] || WALL_COLOR.exterior;
  return (
    <line
      x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
      stroke={selected ? "#f97316" : color}
      strokeWidth={selected ? 4 : 3}
      strokeDasharray={unconfirmedAutomatic ? "6 4" : undefined}
      data-testid="wall-segment"
      data-wall-type={segment.wallType}
    />
  );
}

function WallVertexDot({ vertex, index, project, selected }) {
  const p = project(vertex);
  const isFirst = index === 0;
  return (
    <g data-testid="wall-vertex" data-first-corner={isFirst || undefined}>
      {(isFirst || selected) && (
        <circle cx={p.x} cy={p.y} r={selected ? 8 : 7} fill="none" stroke={selected ? "#f97316" : "#1d4ed8"} strokeWidth={2} />
      )}
      <circle
        cx={p.x} cy={p.y}
        r={4}
        fill="#fff"
        stroke={selected ? "#f97316" : "#1d4ed8"}
        strokeWidth={2}
      />
      <circle cx={p.x} cy={p.y} r={1.3} fill={selected ? "#f97316" : "#1d4ed8"} />
    </g>
  );
}

function HighlightedSegmentPoints({ start, end, project }) {
  const a = project(start);
  const b = project(end);
  return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0d9488" strokeWidth={5} opacity={0.35} data-testid="opening-host-wall" />;
}

function OpeningGlyph({ opening, project, selected }) {
  const a = project(opening.start);
  const b = project(opening.end);
  const color = OPENING_COLOR[opening.openingType] || "#64748b";
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  return (
    <g data-testid="opening-glyph" data-opening-type={opening.openingType}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={selected ? "#f97316" : color} strokeWidth={selected ? 5 : 4} opacity={opening.confirmed === false ? 0.55 : 1} strokeDasharray={opening.confirmed === false ? "5 3" : undefined} />
      {(opening.openingType === "internal-door" || opening.openingType === "external-door") && opening.swing && (
        <path
          d={`M ${a.x} ${a.y} A ${len} ${len} 0 0 1 ${a.x + nx * len} ${a.y + ny * len}`}
          fill="none" stroke={color} strokeWidth={1} opacity={0.6}
        />
      )}
      {opening.openingType === "sliding-door" && (
        <line x1={a.x + nx * 4} y1={a.y + ny * 4} x2={b.x + nx * 4} y2={b.y + ny * 4} stroke={color} strokeWidth={2} opacity={0.7} />
      )}
      <circle cx={a.x} cy={a.y} r={4} fill={color} stroke="#fff" strokeWidth={1} data-testid="opening-handle-start" />
      <circle cx={b.x} cy={b.y} r={4} fill={color} stroke="#fff" strokeWidth={1} data-testid="opening-handle-end" />
      {selected && (
        <text x={mid.x} y={mid.y - 8} textAnchor="middle" fontSize={10} fontWeight={700} fill="#334155">{Math.round(opening.widthMm)}mm</text>
      )}
    </g>
  );
}

function ManualAreaDraft({ vertices, hoverPoint, project }) {
  const screenPoints = vertices.map(project);
  const pathPoints = screenPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const hoverScreen = hoverPoint ? project(hoverPoint) : null;
  return (
    <g data-testid="area-draft">
      <polyline points={pathPoints} fill="none" stroke="#7c3aed" strokeWidth={2} />
      {hoverScreen && screenPoints.length > 0 && (
        <line x1={screenPoints[screenPoints.length - 1].x} y1={screenPoints[screenPoints.length - 1].y} x2={hoverScreen.x} y2={hoverScreen.y} stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 4" />
      )}
      {screenPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 6 : 4} fill={i === 0 ? "#fff" : "#7c3aed"} stroke="#7c3aed" strokeWidth={2} />
      ))}
    </g>
  );
}

function PlanRegionRect({ region, project, dashed, testId }) {
  if (!region || !(region.width > 0) || !(region.height > 0)) return null;
  const topLeft = project({ x: region.x, y: region.y });
  const bottomRight = project({ x: region.x + region.width, y: region.y + region.height });
  const x = Math.min(topLeft.x, bottomRight.x);
  const y = Math.min(topLeft.y, bottomRight.y);
  const width = Math.abs(bottomRight.x - topLeft.x);
  const height = Math.abs(bottomRight.y - topLeft.y);
  return (
    <rect
      x={x} y={y} width={width} height={height}
      fill="none" stroke="#0891b2" strokeWidth={2}
      strokeDasharray={dashed ? "8 5" : undefined}
      data-testid={testId}
    />
  );
}

function AreaSearchRect({ rect, project }) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
  const topLeft = project({ x: rect.x, y: rect.y });
  const bottomRight = project({ x: rect.x + rect.width, y: rect.y + rect.height });
  return (
    <rect
      x={Math.min(topLeft.x, bottomRight.x)}
      y={Math.min(topLeft.y, bottomRight.y)}
      width={Math.abs(bottomRight.x - topLeft.x)}
      height={Math.abs(bottomRight.y - topLeft.y)}
      fill="rgba(124,58,237,0.12)"
      stroke="#7c3aed"
      strokeWidth={1.5}
      strokeDasharray="6 4"
      data-testid="area-search-rect"
    />
  );
}

function CalibrationMark({ calibration, project }) {
  if (!calibration?.pointA || !calibration?.pointB) return null;
  const a = project(calibration.pointA);
  const b = project(calibration.pointB);
  return (
    <g data-testid="calibration-mark">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#16a34a" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />
      <circle cx={a.x} cy={a.y} r={3} fill="#16a34a" />
      <circle cx={b.x} cy={b.y} r={3} fill="#16a34a" />
    </g>
  );
}

function LiveLine({ from, to, project, dashed }) {
  if (!from || !to) return null;
  const a = project(from);
  const b = project(to);
  return (
    <g data-testid="live-line">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#dc2626" strokeWidth={2} strokeDasharray={dashed ? "6 4" : undefined} />
      <circle cx={a.x} cy={a.y} r={5} fill="#dc2626" stroke="#fff" strokeWidth={1.5} />
      <g>
        <line x1={b.x - 8} y1={b.y} x2={b.x + 8} y2={b.y} stroke="#dc2626" strokeWidth={1.5} />
        <line x1={b.x} y1={b.y - 8} x2={b.x} y2={b.y + 8} stroke="#dc2626" strokeWidth={1.5} />
      </g>
    </g>
  );
}

// Live length shown while drawing a wall segment — always in calibrated
// real-world units (never a raw page-space number) once a scale exists;
// falls back to a plain document-unit readout only when no calibration has
// been set yet. `statusLabel` is the snap-status text (e.g. "Snap: Corner",
// "Click to close perimeter") shown near the moving endpoint.
// eslint-disable-next-line no-unused-vars
function WallDrawLengthLabel({ from, to, angleDegrees, mmPerDocumentUnit, project, statusLabel, highlightClose }) {
  const a = project(from);
  const b = project(to);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const spanDocUnits = distance(from, to);
  const lengthText = mmPerDocumentUnit ? formatLength(spanDocUnits * mmPerDocumentUnit) : `${spanDocUnits.toFixed(1)} units`;
  const mainText = angleDegrees != null ? `${angleDegrees}° · ${lengthText}` : lengthText;
  return (
    <g>
      <rect x={mid.x - 38} y={mid.y - 24} width={76} height={16} fill="#111827" rx={3} />
      <text x={mid.x} y={mid.y - 12} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff" data-testid="wall-draw-live-length">
        {mainText}
      </text>
      {statusLabel && (
        <g>
          <rect x={b.x - 58} y={b.y + 10} width={116} height={16} fill={highlightClose ? "#16a34a" : "#1f2937"} rx={3} />
          <text x={b.x} y={b.y + 22} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff" data-testid="wall-draw-snap-status">
            {statusLabel}
          </text>
        </g>
      )}
    </g>
  );
}

// The axis-locked live line, with a 0deg/90deg angle label and the running
// distance in document units — never a free diagonal.
function AxisLockedPreviewLine({ from, to, angleDegrees, project }) {
  if (!from || !to) return null;
  const a = project(from);
  const b = project(to);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const span = distance(from, to);
  return (
    <g data-testid="axis-locked-preview-line">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#dc2626" strokeWidth={2} />
      <circle cx={a.x} cy={a.y} r={4} fill="#dc2626" stroke="#fff" strokeWidth={1.5} />
      <rect x={mid.x - 34} y={mid.y - 26} width={68} height={18} fill="#111827" rx={3} />
      <text x={mid.x} y={mid.y - 13} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" data-testid="axis-lock-angle-label">
        {angleDegrees}&deg; &middot; {span.toFixed(1)}
      </text>
    </g>
  );
}

function SnapMarker({ point, snap, project }) {
  if (!point) return null;
  const p = project(point);
  const kind = snap?.kind || "manual";
  const style = SNAP_STYLES[kind] || SNAP_STYLES.manual;
  return (
    <g data-testid="snap-marker" data-snap-kind={kind}>
      <circle cx={p.x} cy={p.y} r={kind === "manual" ? 5 : 6} fill="none" stroke={style.fill} strokeWidth={1.4} />
      <line x1={p.x - 8} y1={p.y} x2={p.x - 3} y2={p.y} stroke={style.fill} strokeWidth={1.2} />
      <line x1={p.x + 3} y1={p.y} x2={p.x + 8} y2={p.y} stroke={style.fill} strokeWidth={1.2} />
      <line x1={p.x} y1={p.y - 8} x2={p.x} y2={p.y - 3} stroke={style.fill} strokeWidth={1.2} />
      <line x1={p.x} y1={p.y + 3} x2={p.x} y2={p.y + 8} stroke={style.fill} strokeWidth={1.2} />
      {kind !== "manual" && <circle cx={p.x} cy={p.y} r={1.5} fill={style.fill} />}
    </g>
  );
}

// "No valid snap target" state — a plain crosshair, no filled marker.
function Crosshair({ point, project }) {
  if (!point) return null;
  const p = project(point);
  return (
    <g data-testid="no-snap-crosshair">
      <line x1={p.x - 9} y1={p.y} x2={p.x + 9} y2={p.y} stroke="#94a3b8" strokeWidth={1} />
      <line x1={p.x} y1={p.y - 9} x2={p.x} y2={p.y + 9} stroke="#94a3b8" strokeWidth={1} />
      <circle cx={p.x} cy={p.y} r={9} fill="none" stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 2" />
    </g>
  );
}

function HighlightedPlanLine({ lineId, planGeometryIndex, project }) {
  const segment = planGeometryIndex?.segments?.find((s) => s.id === lineId);
  if (!segment) return null;
  const a = project(segment.a);
  const b = project(segment.b);
  return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0d9488" strokeWidth={3} opacity={0.55} data-testid="highlighted-plan-line" />;
}

const MAGNIFIER_SIZE = 120;
const MAGNIFIER_SOURCE_RADIUS_PX = 45; // canvas-pixel radius cropped from the source canvas
const MAGNIFIER_OFFSET = 18;

// A small zoomed inset near the pointer showing the exact snap point and
// surrounding linework, cropped straight from the already-rendered plan
// canvas (so it always reflects real pixels, not a re-render).
function Magnifier({ point, project, viewport, sourceCanvas }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !point || !sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) return;
    const ctx = canvas.getContext("2d");
    const viewportPoint = pageToScreenPoint({ viewport, ...IDENTITY_VIEW }, point.x, point.y);
    const scaleX = sourceCanvas.width / viewport.width;
    const scaleY = sourceCanvas.height / viewport.height;
    const sx = viewportPoint.x * scaleX;
    const sy = viewportPoint.y * scaleY;
    const radius = MAGNIFIER_SOURCE_RADIUS_PX * Math.max(scaleX, scaleY);

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
    ctx.drawImage(sourceCanvas, sx - radius, sy - radius, radius * 2, radius * 2, 0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MAGNIFIER_SIZE / 2, 0);
    ctx.lineTo(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE);
    ctx.moveTo(0, MAGNIFIER_SIZE / 2);
    ctx.lineTo(MAGNIFIER_SIZE, MAGNIFIER_SIZE / 2);
    ctx.stroke();
  }, [point, viewport, sourceCanvas]);

  if (!point) return null;
  const screenPoint = project(point);
  return (
    <canvas
      ref={canvasRef}
      width={MAGNIFIER_SIZE}
      height={MAGNIFIER_SIZE}
      data-testid="snap-magnifier"
      style={{
        position: "absolute",
        left: screenPoint.x + MAGNIFIER_OFFSET,
        top: screenPoint.y + MAGNIFIER_OFFSET,
        width: MAGNIFIER_SIZE,
        height: MAGNIFIER_SIZE,
        borderRadius: "50%",
        border: "2px solid #1d4ed8",
        boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
        pointerEvents: "none",
        background: "#fff",
      }}
    />
  );
}
