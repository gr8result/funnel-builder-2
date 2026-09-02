import { memo, useEffect, useMemo, useRef } from "react";
import { pageToScreenPoint } from "../viewer/pageToScreenPoint.js";
import { midpoint, distance } from "../takeoff/geometry.js";
import { formatLength } from "../takeoff/units.js";
import { normalizeRegionCorners } from "../takeoff/planRegion.js";
import { rectFromCorners } from "../takeoff/roomBoundaryDetection.js";
import { buildStructuralGraph } from "../takeoff/structuralGraph.js";

const IDENTITY_VIEW = { panX: 0, panY: 0, zoomScale: 1 };

const SNAP_STYLES = {
  intersection: { fill: "#7c3aed", radius: 4, label: "Intersection" },
  endpoint: { fill: "#2563eb", radius: 4, label: "Endpoint" },
  line: { fill: "#0d9488", radius: 3, label: "On line" },
  "wall-band": { fill: "#0284c7", radius: 3, label: "Wall band" },
  manual: { fill: "#f59e0b", radius: 3, label: "Manual" },
  // Wall-chain aware snap targets.
  corner: { fill: "#7c3aed", radius: 4, label: "Corner" },
  reentrant_corner: { fill: "#db2777", radius: 4, label: "Internal corner" },
  jamb: { fill: "#a855f7", radius: 4, label: "Jamb" },
  opening_jamb_continuation: { fill: "#a855f7", radius: 4, label: "Opposite jamb" },
};

// Preview label shown before committing, so the user can see the system has
// understood the gap intentionally rather than lost the wall.
const OPENING_PREVIEW_LABEL = {
  garage_door: "GARAGE DOOR",
  door: "DOOR",
  opening_candidate: "OPENING CANDIDATE",
  window: "WINDOW",
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
const WALL_COLOR = { exterior: "#31E85A", internal: "#168CFF" };
const WALL_FILL = { exterior: "rgba(49,232,90,0.54)", internal: "rgba(22,140,255,0.52)" };
const WALL_SELECTED_FILL = { exterior: "rgba(49,232,90,0.60)", internal: "rgba(22,140,255,0.58)" };
const WALL_OUTLINE = { exterior: "#F8FF2E", internal: "#ffffff" };
const HIGHLIGHTER_WALL_COLOR = {
  normal: "#6b7280",
  hover: "#0284c7",
  selected: "#facc15",
  gap: "#dc2626",
};
const OPENING_COLOR = {
  door: "#f97316",
  window: "#00E5FF",
  opening: "#F8FF2E",
  "internal-door": "#f97316",
  "external-door": "#f97316",
  "sliding-door": "#f97316",
  "garage-door": "#A855F7",
  "open-opening": "#F8FF2E",
};
const EXTERIOR_CANDIDATE = "#16a34a";
const MISSING_SECTION = "#65a30d";

function openingLayerFor(openingType) {
  if (openingType === "window") return "windows";
  if (openingType === "opening" || openingType === "open-opening") return "openings";
  return "doors";
}

function isAutomaticCandidate(segment) {
  return segment?.source === "automatic" && segment.confirmed === false;
}

function isMissingSectionIndicator(segment) {
  return Boolean(segment?.missingSectionIndicator || segment?.bridgedGapLength > 0);
}

// Purely visual overlay, rendered as a sibling to the two plan canvases
// *inside* PlanViewer's existing pan/zoom transform wrapper — so every point
// drawn here inherits pan/zoom/rotation for free via that CSS transform,
// exactly like the canvases do. pointerEvents:"none" because all pointer
// handling stays on PlanViewer's own container (single source of truth for
// click-vs-drag-vs-pan detection).
export default function TakeoffCanvasOverlay({ page, tools, viewport, planGeometryIndex, sourceCanvas }) {
  const showPlanGeometryDebug = isPlanGeometryDebugEnabled();
  const showStructuralDebug = showStructuralGraphDebug(tools);
  const structuralGraph = useMemo(
    () => (showStructuralDebug ? buildStructuralGraph(planGeometryIndex, page || {}) : null),
    [planGeometryIndex, page, showStructuralDebug]
  );
  const project = (point) => pageToScreenPoint({ viewport, ...IDENTITY_VIEW }, point.x, point.y);
  if (!viewport) return null;
  const layers = page?.layerVisibility || {};
  const showLayer = (key) => layers[key] !== false;
  const shouldShowWallSegment = (segment) => !isAutomaticCandidate(segment) || showLayer("automaticCandidates");

  const exteriorWalls = page?.exteriorWalls;
  const internalWalls = page?.internalWalls;
  const highlightedWalls = tools.exteriorHighlightedWalls || page?.exteriorHighlightedWalls || [];
  const highlightedWallIds = new Set(highlightedWalls.map((wall) => wall.id));
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
  const isExteriorHighlighter = tools.activeTool === "exterior-highlighter";
  const isOpeningTool = ["door", "window", "opening", "internal-door", "external-door", "sliding-door", "garage-door", "open-opening"].includes(tools.activeTool);
  const isAreaTool = tools.activeTool === "area";
  const isPlanRegionTool = tools.activeTool === "plan-region";
  const isEditTool = ["select", "move-corner", "add-corner", "edit", "edit-walls"].includes(tools.activeTool);
  const showAreaFills = isAreaTool || tools.activeTool === "select" || tools.activeTool === "edit";
  const showAllWallHandles = ["move-corner", "add-corner", "edit", "edit-walls"].includes(tools.activeTool);
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
        {!isExteriorHighlighter && page?.calibration && (
          <CalibrationMark calibration={page.calibration} project={project} />
        )}

        {/* Saved measurements */}
        {!isExteriorHighlighter && (page?.measurements || []).map((measurement) => {
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
        {!isExteriorHighlighter && isPlanRegionTool && page?.planRegion?.confirmed && (
          <PlanRegionRect region={page.planRegion} project={project} dashed={false} testId="plan-region-confirmed" />
        )}
        {!isExteriorHighlighter && isPlanRegionTool && !page?.planRegion?.confirmed && tools.suggestedPlanRegion && !tools.planRegionDraftCorner && (
          <PlanRegionRect region={tools.suggestedPlanRegion} project={project} dashed testId="plan-region-suggested" />
        )}
        {!isExteriorHighlighter && isPlanRegionTool && tools.planRegionDraftCorner && tools.planRegionHoverPoint && (
          <PlanRegionRect
            region={normalizeRegionCorners(tools.planRegionDraftCorner, tools.planRegionHoverPoint)}
            project={project}
            dashed
            testId="plan-region-draft"
          />
        )}

        {/* Confirmed area polygon fills */}
        {!isExteriorHighlighter && showAreaFills && showLayer("areas") && (page?.areas || []).map((area) => {
          const boundary = tools.draggingAreaVertex?.areaId === area.id
            ? tools.draggingAreaVertex.vertices
            : area.outerBoundary || area.vertices || [];
          const pts = boundary.map((p) => project(p)).map((p) => `${p.x},${p.y}`).join(" ");
          const areaCenter = project(centroid(boundary));
          return (
            <g key={area.id} data-testid="area-polygon">
              <polygon points={pts} fill="rgba(124,58,237,0.15)" stroke="#7c3aed" strokeWidth={1.5} opacity={area.included === false ? 0.4 : 1} />
              <text x={areaCenter.x} y={areaCenter.y} textAnchor="middle" fontSize={11} fontWeight={700} fill="#5b21b6">{area.name}</text>
              {isAreaTool && boundary.map((vertex, vertexIndex) => (
                <AreaVertexHandle
                  key={`${area.id}-${vertexIndex}`}
                  vertex={vertex}
                  vertexIndex={vertexIndex}
                  project={project}
                  dragging={tools.draggingAreaVertex?.areaId === area.id && tools.draggingAreaVertex.vertexIndex === vertexIndex}
                />
              ))}
              {(area.holes || []).map((hole) => {
                const holePts = hole.vertices.map((p) => project(p)).map((p) => `${p.x},${p.y}`).join(" ");
                return <polygon key={hole.id} points={holePts} fill="rgba(249,115,22,0.20)" stroke="#f97316" strokeWidth={1.2} strokeDasharray="4 3" data-testid="area-exclusion-polygon" />;
              })}
            </g>
          );
        })}

        {/* In-progress manual area trace */}
        {!isExteriorHighlighter && isAreaTool && tools.areaDraftVertices.length > 0 && (
          <ManualAreaDraft vertices={tools.areaDraftVertices} hoverPoint={tools.areaHoverPoint} project={project} />
        )}
        {!isExteriorHighlighter && isAreaTool && tools.areaSearchDraft?.start && tools.areaSearchDraft?.end && (
          <AreaSearchRect rect={rectFromCorners(tools.areaSearchDraft.start, tools.areaSearchDraft.end)} project={project} />
        )}

        {/* Exterior highlighter: one blue local preview, yellow clicked walls. */}
        {(isExteriorHighlighter || isEditTool) && highlightedWalls.map((wall) => (
          <HighlightableWallObject
            key={wall.id}
            wall={wall}
            project={project}
            selected
          />
        ))}
        {isExteriorHighlighter && tools.exteriorHighlightPreview && !highlightedWallIds.has(tools.exteriorHighlightPreview.id) && (
          <HighlightableWallObject
            wall={tools.exteriorHighlightPreview}
            project={project}
            hovered
          />
        )}
        {isExteriorHighlighter && tools.exteriorHighlightDebugEnabled && (
          <ExteriorHighlighterDebugOverlay
            pointer={tools.exteriorHighlightPointer}
            preview={tools.exteriorHighlightPreview}
            diagnostics={tools.exteriorHighlightDiagnostics || []}
            project={project}
          />
        )}
        {tools.exteriorHighlightGap && (
          <GapLine gap={tools.exteriorHighlightGap} project={project} />
        )}
        {isEditTool && (tools.exteriorHighlightJunctions || []).map((junction) => (
          <ExteriorHighlightJunctionHandle
            key={junction.id}
            junction={tools.draggingVertex?.id === junction.id && tools.draggingVertex.field === "exteriorHighlightedWalls"
              ? { ...junction, point: { x: tools.draggingVertex.x, y: tools.draggingVertex.y } }
              : junction}
            project={project}
            selected={tools.selectedField === "exteriorHighlightedWalls" && tools.selectedVertexId === junction.id}
            hovered={tools.wallEditHoverTarget?.type === "point" && tools.wallEditHoverTarget.id === junction.id && tools.wallEditHoverTarget.field === "exteriorHighlightedWalls"}
          />
        ))}

        {/* Exterior + internal wall segments */}
        {!isExteriorHighlighter && showLayer("exteriorWalls") && visibleExteriorSegments.map((segment) => (
          <WallSegmentLine key={segment.id} segment={segment} vertexById={exteriorVertexById} project={project}
            selected={tools.selectedField === "exteriorWalls" && tools.selectedSegmentId === segment.id}
            hovered={tools.wallEditHoverTarget?.type === "segment" && tools.wallEditHoverTarget.id === segment.id && tools.wallEditHoverTarget.field === "exteriorWalls"}
            openings={openings.filter((opening) => opening.wallGraph === "exterior" && opening.wallId === segment.id)}
            siblingSegments={visibleExteriorSegments}
            showWallFacesDebug={tools.wallSnapDebugEnabled} />
        ))}
        {!isExteriorHighlighter && showLayer("internalWalls") && visibleInternalSegments.map((segment) => (
          <WallSegmentLine key={segment.id} segment={segment} vertexById={internalVertexById} project={project}
            selected={tools.selectedField === "internalWalls" && tools.selectedSegmentId === segment.id}
            hovered={tools.wallEditHoverTarget?.type === "segment" && tools.wallEditHoverTarget.id === segment.id && tools.wallEditHoverTarget.field === "internalWalls"}
            openings={openings.filter((opening) => opening.wallGraph === "internal" && opening.wallId === segment.id)}
            siblingSegments={visibleInternalSegments}
            showWallFacesDebug={tools.wallSnapDebugEnabled} />
        ))}

        {!isExteriorHighlighter && (visibleExteriorSegments.length > 0 || visibleInternalSegments.length > 0) && (
          <PlanLineworkOverlay planGeometryIndex={planGeometryIndex} project={project} />
        )}

        {/* Wall vertices, numbered — shown while editing or drawing that graph */}
        {!isExteriorHighlighter && isEditTool && exteriorWalls && exteriorDisplayVertices.map((vertex, index) => (
          <WallVertexDot key={vertex.id} vertex={vertex} index={index} project={project}
            visible={showAllWallHandles || (tools.selectedField === "exteriorWalls" && tools.selectedVertexId === vertex.id) || (tools.wallEditHoverTarget?.type === "point" && tools.wallEditHoverTarget.id === vertex.id && tools.wallEditHoverTarget.field === "exteriorWalls")}
            selected={tools.selectedField === "exteriorWalls" && tools.selectedVertexId === vertex.id}
            hovered={tools.wallEditHoverTarget?.type === "point" && tools.wallEditHoverTarget.id === vertex.id && tools.wallEditHoverTarget.field === "exteriorWalls"} />
        ))}
        {!isExteriorHighlighter && isEditTool && internalWalls && internalDisplayVertices.map((vertex, index) => (
          <WallVertexDot key={vertex.id} vertex={vertex} index={index} project={project}
            visible={showAllWallHandles || (tools.selectedField === "internalWalls" && tools.selectedVertexId === vertex.id) || (tools.wallEditHoverTarget?.type === "point" && tools.wallEditHoverTarget.id === vertex.id && tools.wallEditHoverTarget.field === "internalWalls")}
            selected={tools.selectedField === "internalWalls" && tools.selectedVertexId === vertex.id}
            hovered={tools.wallEditHoverTarget?.type === "point" && tools.wallEditHoverTarget.id === vertex.id && tools.wallEditHoverTarget.field === "internalWalls"} />
        ))}

        {/* Chain-draw preview while editing walls (legacy exterior-only tool) */}
        {!isExteriorHighlighter && tools.activeTool === "edit-walls" && tools.selectedVertexId && tools.hoverPoint && exteriorVertexById.get(tools.selectedVertexId) && (
          <LiveLine from={exteriorVertexById.get(tools.selectedVertexId)} to={tools.hoverPoint} project={project} dashed />
        )}

        {/* Manual Exterior/Internal Wall drawing: keep the canvas precise.
            Length/status text lives outside the drawing area in the toolbar. */}
        {!isExteriorHighlighter && isWallDraw && tools.wallDrawHoverPreview?.snap?.wallBand && (
          <WallBandSnapPreview wallBand={tools.wallDrawHoverPreview.snap.wallBand} wallType={tools.activeTool === "internal-wall" ? "internal" : "exterior"} project={project} />
        )}
        {!isExteriorHighlighter && isWallDraw && tools.wallDrawHoverPreview?.point && tools.wallDrawHoverPreview?.snap && (
          <SnapMarker point={tools.wallDrawHoverPreview.point} snap={tools.wallDrawHoverPreview.snap} project={project} />
        )}
        {!isExteriorHighlighter && isWallDraw && tools.wallDrawHoverPreview && tools.wallDrawHoverPreview.valid === false && (
          <g>
            <Crosshair point={tools.wallDrawHoverPreview.rawPoint} project={project} />
            {tools.wallDrawHoverPreview.rawPoint && (() => {
              const p = project(tools.wallDrawHoverPreview.rawPoint);
              return (
                <text x={p.x + 12} y={p.y - 10} fontSize={10} fontWeight={800} fill="#b91c1c" data-testid="wall-no-snap-label">
                  No wall/corner snap
                </text>
              );
            })()}
          </g>
        )}
        {!isExteriorHighlighter && isEditTool && tools.wallEditSnapPreview?.point && (
          <SnapMarker point={tools.wallEditSnapPreview.point} snap={tools.wallEditSnapPreview.snap} label={tools.wallEditSnapPreview.label} project={project} />
        )}
        {/* Wall openings: Window / Internal Door / External Door / Sliding Door / Garage Door / Open Opening */}
        {!isExteriorHighlighter && openings.map((opening) => {
          const layer = openingLayerFor(opening.openingType);
          if (!showLayer(layer)) return null;
          const selected = tools.selectedOpeningId === opening.id;
          return <OpeningGlyph key={opening.id} opening={opening} project={project} selected={selected} />;
        })}

        {/* Opening placement in progress: highlight host wall + live span */}
        {!isExteriorHighlighter && isOpeningTool && tools.openingHostWall && (
          <HighlightedSegmentPoints start={tools.openingHostWall.start} end={tools.openingHostWall.end} project={project} />
        )}
        {!isExteriorHighlighter && isOpeningTool && tools.openingStart && tools.openingHostWall && (
          <LiveLine from={tools.openingStart} to={tools.openingHostWall.point} project={project} />
        )}
        {!isExteriorHighlighter && isOpeningTool && tools.openingHostWall && !tools.openingStart && (
          <SnapMarker point={tools.openingHostWall.point} snap={{ kind: "line" }} project={project} />
        )}

        {/* Set Scale / Measure Length: snapped, axis-locked preview */}
        {!isExteriorHighlighter && isScaleOrMeasure && preview && (
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

        {(showPlanGeometryDebug || showStructuralDebug) && (
          <>
            {showPlanGeometryDebug && <PlanGeometryDebugOverlay planGeometryIndex={planGeometryIndex} project={project} />}
            <StructuralGraphDebugOverlay graph={structuralGraph} project={project} />
            {showPlanGeometryDebug && <TraceGraphDebugOverlay diagnostics={page?.exteriorWalls?.detectionDiagnostics || page?.wallDetectionDiagnostics} project={project} />}
          </>
        )}
      </svg>

      {!isExteriorHighlighter && isScaleOrMeasure && preview && sourceCanvas && (
        <Magnifier point={preview.valid ? preview.point : preview.rawPoint} project={project} viewport={viewport} sourceCanvas={sourceCanvas} />
      )}
    </>
  );
}

function isPlanGeometryDebugEnabled() {
  if (process.env.NEXT_PUBLIC_TAKEOFF_GEOMETRY_DEBUG === "1") return true;
  if (typeof window === "undefined") return false;
  return window.localStorage?.getItem("takeoffGeometryDebug") === "1";
}

function showStructuralGraphDebug(tools) {
  return Boolean(tools?.structuralGraphDebugEnabled);
}

const STRUCTURAL_NODE_STYLE = {
  L: { fill: "#22c55e", label: "L" },
  T: { fill: "#f97316", label: "T" },
  X: { fill: "#8b5cf6", label: "X" },
  endpoint: { fill: "#06b6d4", label: "E" },
  jamb: { fill: "#eab308", label: "J" },
  near_intersection: { fill: "#84cc16", label: "N" },
};

const StructuralGraphDebugOverlay = memo(function StructuralGraphDebugOverlay({ graph, project }) {
  if (!graph) return null;
  return (
    <g data-testid="structural-graph-debug-overlay" pointerEvents="none">
      {graph.wallAssemblies?.slice(0, 1600).map((assembly) => (
        <WallAssemblyDebug key={assembly.id} assembly={assembly} project={project} />
      ))}
      {graph.facePairs.slice(0, 1200).map((pair) => {
        const a1 = project(pair.faceA.start);
        const a2 = project(pair.faceA.end);
        const b1 = project(pair.faceB.start);
        const b2 = project(pair.faceB.end);
        return (
          <g key={pair.id} data-testid="structural-wall-face-pair" data-thickness-mm={Math.round(pair.separationMm)}>
            <line x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y} stroke="#38bdf8" strokeWidth={0.8} opacity={0.38} />
            <line x1={b1.x} y1={b1.y} x2={b2.x} y2={b2.y} stroke="#38bdf8" strokeWidth={0.8} opacity={0.38} />
          </g>
        );
      })}
      {graph.structuralLines.slice(0, 2500).map((line) => {
        const a = project(line.start);
        const b = project(line.end);
        return (
          <line
            key={line.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#0ea5e9"
            strokeWidth={0.75}
            opacity={0.82}
            data-testid="structural-face-line"
          />
        );
      })}
      {graph.nodes.slice(0, 2500).map((node) => {
        const p = project(node.point || node);
        const style = STRUCTURAL_NODE_STYLE[node.type] || STRUCTURAL_NODE_STYLE.endpoint;
        return (
          <g key={node.id} data-testid="structural-graph-node" data-node-type={node.type}>
            <circle cx={p.x} cy={p.y} r={2.4} fill={style.fill} stroke="#0f172a" strokeWidth={0.45} opacity={0.95} />
          </g>
        );
      })}
    </g>
  );
});

function WallAssemblyDebug({ assembly, project }) {
  const start = assembly.frame ? {
    x: assembly.frame.ux * assembly.frame.startAlong + assembly.frame.nx * assembly.frame.fixed,
    y: assembly.frame.uy * assembly.frame.startAlong + assembly.frame.ny * assembly.frame.fixed,
  } : null;
  const end = assembly.frame ? {
    x: assembly.frame.ux * assembly.frame.endAlong + assembly.frame.nx * assembly.frame.fixed,
    y: assembly.frame.uy * assembly.frame.endAlong + assembly.frame.ny * assembly.frame.fixed,
  } : null;
  if (!start || !end) return null;
  const a = project(start);
  const b = project(end);
  const isExterior = assembly.exteriorScore >= 0.62;
  const isInterior = assembly.interiorScore >= 0.58;
  const rejected = assembly.rejectedAsExterior;
  const stroke = rejected ? "#ef4444" : isExterior ? "#22c55e" : isInterior ? "#a855f7" : "#64748b";
  const dash = rejected ? "6 4" : isInterior ? "3 3" : undefined;
  return (
    <g
      data-testid={rejected ? "rejected-cross-building-candidate-debug" : isExterior ? "exterior-candidate-debug" : isInterior ? "interior-candidate-debug" : "wall-assembly-debug"}
      data-wall-assembly-id={assembly.id}
      data-exterior-score={Number(assembly.exteriorScore || 0).toFixed(2)}
      data-interior-score={Number(assembly.interiorScore || 0).toFixed(2)}
      data-rejection-reason={(assembly.rejectionReasons || []).join("; ")}
    >
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={rejected || isExterior || isInterior ? 2.1 : 1.1} strokeDasharray={dash} opacity={rejected ? 0.9 : 0.72} />
      {(assembly.sideAOccupancy?.samples || []).slice(0, 7).map((sample, index) => (
        <OccupancySample key={`a-${index}`} sample={sample} side="A" project={project} />
      ))}
      {(assembly.sideBOccupancy?.samples || []).slice(0, 7).map((sample, index) => (
        <OccupancySample key={`b-${index}`} sample={sample} side="B" project={project} />
      ))}
      {rejected && (
        <text x={(a.x + b.x) / 2 + 4} y={(a.y + b.y) / 2 - 4} fontSize={9} fontWeight={800} fill="#ef4444" data-testid="rejected-exterior-reason-label">
          {(assembly.rejectionReasons || ["rejected"]).find((reason) => reason.includes("building occupancy") || reason.includes("perimeter shortcut")) || "rejected"}
        </text>
      )}
    </g>
  );
}

function OccupancySample({ sample, side, project }) {
  const p = project(sample.point);
  const fill = sample.classification === "building" ? "#f59e0b" : sample.classification === "outside" ? "#0ea5e9" : "#94a3b8";
  return (
    <circle
      cx={p.x}
      cy={p.y}
      r={1.8}
      fill={fill}
      opacity={0.78}
      data-testid="side-occupancy-debug-sample"
      data-side={side}
      data-occupancy={sample.classification}
    />
  );
}

function PlanGeometryDebugOverlay({ planGeometryIndex, project }) {
  const lines = planGeometryIndex?.lines || [];
  const endpoints = planGeometryIndex?.endpoints || [];
  const intersections = planGeometryIndex?.intersections || [];
  return (
    <g data-testid="plan-geometry-debug-overlay">
      {lines.map((line) => {
        const a = project(line.start || line.a);
        const b = project(line.end || line.b);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        return (
          <g key={line.id} data-testid="plan-geometry-debug-line" data-line-id={line.id} data-angle={Math.round(line.angleDegrees ?? 0)}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ef4444" strokeWidth={0.9} opacity={0.65} />
            <text x={mid.x + 3} y={mid.y - 3} fontSize={8} fill="#991b1b">
              {line.id} {Math.round(line.angleDegrees ?? 0)} deg
            </text>
          </g>
        );
      })}
      {endpoints.map((endpoint) => {
        const p = project(endpoint.point);
        return <circle key={endpoint.id || `${endpoint.lineId}-${p.x}-${p.y}`} cx={p.x} cy={p.y} r={2.3} fill="#2563eb" opacity={0.75} data-testid="plan-geometry-debug-endpoint" />;
      })}
      {intersections.map((intersection) => {
        const p = project(intersection.point);
        return (
          <g key={intersection.id || `${p.x}-${p.y}`} data-testid="plan-geometry-debug-intersection" data-intersection-type={intersection.type}>
            <circle cx={p.x} cy={p.y} r={3.5} fill="#16a34a" opacity={0.8} />
            <text x={p.x + 4} y={p.y - 4} fontSize={8} fill="#166534">{intersection.type}</text>
          </g>
        );
      })}
    </g>
  );
}

function TraceGraphDebugOverlay({ diagnostics, project }) {
  const debug = diagnostics?.traceGraphDebug;
  const loop = diagnostics?.finalLoop;
  if (!debug && !loop) return null;
  const start = loop?.points?.find((point) => point.id === diagnostics?.startNodeId) || loop?.points?.[0] || null;
  return (
    <g data-testid="trace-graph-debug-overlay">
      {loop?.edges?.map((edge) => {
        const a = project(edge.from);
        const b = project(edge.to);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        return (
          <g key={edge.id} data-testid="trace-graph-debug-chosen-edge" data-edge-id={edge.id}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#22c55e" strokeWidth={2.5} opacity={0.9} strokeDasharray={edge.bridgedGapLength ? "5 4" : undefined} />
            <text x={mid.x + 4} y={mid.y + 4} fontSize={9} fontWeight={800} fill="#15803d">{edge.id}</text>
          </g>
        );
      })}
      {loop?.points?.map((point) => {
        const p = project(point);
        const isStart = point.id === diagnostics?.startNodeId || point === start;
        return (
          <g key={point.id} data-testid={isStart ? "trace-graph-debug-start-node" : "trace-graph-debug-visited-node"} data-node-id={point.id}>
            <circle cx={p.x} cy={p.y} r={isStart ? 6 : 4} fill={isStart ? "#f97316" : "#84cc16"} stroke="#052e16" strokeWidth={1} />
            <text x={p.x + 7} y={p.y - 7} fontSize={9} fontWeight={900} fill={isStart ? "#c2410c" : "#3f6212"}>
              {isStart ? `START NODE: ${point.id}` : point.id}
            </text>
          </g>
        );
      })}
      {debug?.steps?.map((step, index) => {
        if (!step.rejected?.length) return null;
        return (
          <text key={`${step.nodeId}-${index}`} x={8} y={18 + index * 12} fontSize={10} fill="#7f1d1d" data-testid="trace-graph-debug-rejected-edge">
            {step.nodeId}: rejected {step.rejected.map((item) => `${item.edgeId} (${item.reason})`).join(", ")}
          </text>
        );
      })}
    </g>
  );
}

function centroid(vertices) {
  if (!Array.isArray(vertices) || vertices.length === 0) return { x: 0, y: 0 };
  const sum = vertices.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / vertices.length, y: sum.y / vertices.length };
}

function wallLine(wall) {
  if (wall?.axis?.start && wall?.axis?.end) return wall.axis;
  if (wall?.centreline?.start && wall?.centreline?.end) return wall.centreline;
  if (wall?.startJunction && wall?.endJunction) return { start: wall.startJunction, end: wall.endJunction };
  if (wall?.start && wall?.end) return { start: wall.start, end: wall.end };
  return null;
}

function HighlightableWallObject({ wall, project, selected, hovered }) {
  const line = wallLine(wall);
  if (!line) return null;
  const color = selected ? HIGHLIGHTER_WALL_COLOR.selected : hovered ? HIGHLIGHTER_WALL_COLOR.hover : HIGHLIGHTER_WALL_COLOR.normal;
  const strokeWidth = selected ? 2.5 : hovered ? 2 : 2;
  const totalLength = distance(line.start, line.end) || 1;
  const sections = Array.isArray(wall.sections) && wall.sections.length
    ? wall.sections
    : [{ type: "solid", startOffset: 0, endOffset: totalLength }];
  const pointAtOffset = (offset) => {
    const t = Math.max(0, Math.min(1, Number(offset || 0) / totalLength));
    return project({
      x: line.start.x + (line.end.x - line.start.x) * t,
      y: line.start.y + (line.end.y - line.start.y) * t,
    });
  };
  const labelForOpening = (type, index) => {
    if (type === "window") return `W${index + 1}`;
    if (type === "garage-door") return `GD${index + 1}`;
    if (type === "door") return `D${index + 1}`;
    return `O${index + 1}`;
  };
  let openingIndex = 0;
  return (
    <g
      data-testid={selected ? "highlighted-exterior-wall" : "highlightable-wall-preview"}
      data-wall-id={wall.id}
      data-highlighted={selected ? "true" : "false"}
      data-hovered={hovered ? "true" : "false"}
    >
      {sections.map((section, index) => {
        const a = pointAtOffset(section.startOffset);
        const b = pointAtOffset(section.endOffset);
        const isOpening = section.type !== "solid";
        const label = isOpening ? labelForOpening(section.type, openingIndex++) : "";
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        return (
          <g key={`${section.type}-${index}`} data-testid={isOpening ? "highlighted-wall-opening" : "highlighted-wall-solid"} data-opening-type={isOpening ? section.type : undefined}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={isOpening ? "3 5" : undefined}
              opacity={isOpening ? 0.62 : selected ? 0.78 : hovered ? 0.95 : 0.35}
            />
            {isOpening ? (
              <text x={mid.x} y={mid.y - 5} textAnchor="middle" fontSize={9} fontWeight={800} fill={color}>
                {label}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

function ExteriorHighlightJunctionHandle({ junction, project, selected, hovered }) {
  if (!junction?.point) return null;
  const p = project(junction.point);
  return (
    <g
      data-testid="exterior-highlight-junction"
      data-junction-id={junction.id}
      data-selected={selected ? "true" : "false"}
      data-hovered={hovered ? "true" : "false"}
    >
      <circle cx={p.x} cy={p.y} r={10} fill="transparent" stroke="transparent" data-testid="exterior-highlight-junction-hit-area" />
      {(selected || hovered) && <circle cx={p.x} cy={p.y} r={6} fill="none" stroke="#0f172a" strokeWidth={1.2} opacity={0.65} />}
      <circle cx={p.x} cy={p.y} r={hovered ? 4.5 : 4} fill="#fff7ed" stroke={selected ? "#f97316" : "#0f172a"} strokeWidth={1.5} />
      <path d={`M ${p.x - 2} ${p.y} L ${p.x + 2} ${p.y} M ${p.x} ${p.y - 2} L ${p.x} ${p.y + 2}`} stroke="#0f172a" strokeWidth={1} />
    </g>
  );
}

function ExteriorHighlighterDebugOverlay({ pointer, preview, diagnostics, project }) {
  const p = pointer ? project(pointer) : null;
  const rejectedDimension = diagnostics.find((entry) => entry.belongsToDimensionChain && entry.coordinates?.seed);
  const diagnosticLines = diagnostics.filter((entry) => entry.line?.start && entry.line?.end);
  return (
    <g data-testid="exterior-highlighter-debug-overlay">
      {p && (
        <>
          <circle cx={p.x} cy={p.y} r={5} fill="none" stroke="#ef4444" strokeWidth={1.5} />
          <path d={`M ${p.x - 8} ${p.y} L ${p.x + 8} ${p.y} M ${p.x} ${p.y - 8} L ${p.x} ${p.y + 8}`} stroke="#ef4444" strokeWidth={1} />
        </>
      )}
      {preview?.faceA && <DebugLine line={preview.faceA} project={project} color="#22c55e" dash="4 3" testId="debug-wall-face-a" />}
      {preview?.faceB && <DebugLine line={preview.faceB} project={project} color="#22c55e" dash="4 3" testId="debug-wall-face-b" />}
      {preview?.centreline && <DebugLine line={preview.centreline} project={project} color="#2563eb" width={1.5} testId="debug-wall-centreline" />}
      {diagnosticLines.map((entry, index) => (
        <DebugLine
          key={`${entry.label}-${index}`}
          line={entry.line}
          project={project}
          color={entry.color === "purple" ? "#7c3aed" : entry.color === "green" ? "#16a34a" : "#0284c7"}
          width={entry.color === "green" ? 2 : 1.5}
          dash={entry.color === "green" ? undefined : "5 4"}
          testId={`debug-${entry.label.toLowerCase().replaceAll(" ", "-")}`}
        />
      ))}
      {preview?.startJunction && <DebugPoint point={preview.startJunction.point || preview.startJunction} project={project} label="L" />}
      {preview?.endJunction && <DebugPoint point={preview.endJunction.point || preview.endJunction} project={project} label="R" />}
      {p && diagnostics.length > 0 && (
        <g data-testid="exterior-highlighter-debug-readout">
          <rect x={p.x + 12} y={p.y + 12} width={230} height={112} fill="#111827" opacity={0.88} rx={4} />
          {debugReadoutLines(pointer, diagnostics).map((line, index) => (
            <text key={line} x={p.x + 20} y={p.y + 30 + index * 13} fontSize={10} fill="#fff">{line}</text>
          ))}
        </g>
      )}
      {rejectedDimension?.coordinates?.seed && (
        <DebugLine
          line={{ start: rejectedDimension.coordinates.seed.start, end: rejectedDimension.coordinates.seed.end }}
          project={project}
          color="#dc2626"
          width={2}
          dash="7 4"
          testId="debug-rejected-dimension-line"
        />
      )}
    </g>
  );
}

function debugReadoutLines(pointer, diagnostics) {
  const expanded = diagnostics.find((entry) => entry.label === "Exterior expanded result") || {};
  const initial = diagnostics.find((entry) => entry.label === "Exterior initial result") || {};
  const scale = diagnostics.find((entry) => entry.label === "Scale Tool result") || {};
  const raster = diagnostics.find((entry) => entry.label === "Local raster fallback") || {};
  return [
    `Pointer: ${Math.round(pointer?.x || 0)}, ${Math.round(pointer?.y || 0)}`,
    `Raw PDF lines: ${raster.rawPdfLineCount ?? "-"}`,
    `Filtered lines: ${raster.filteredLineCount ?? "-"}`,
    `Raster edges: ${raster.rasterEdgeCount ?? "-"}`,
    `Wall bands: ${raster.wallBandCandidateCount ?? "-"}`,
    `Angle: ${Math.round(scale.angle || 0)} deg`,
    `Initial: ${Math.round(initial.initialSegmentLength || 0)}`,
    `Expanded: ${Math.round(expanded.expandedWallLength || 0)}`,
    `Nearest raster: ${Math.round(raster.nearestRasterEdgeDistance ?? 0)}`,
    `Reason: ${raster.reason || expanded.endEndpointReason || "-"}`,
  ].slice(0, 9);
}

function DebugLine({ line, project, color, width = 1, dash, testId }) {
  if (!line?.start || !line?.end) return null;
  const a = project(line.start);
  const b = project(line.end);
  return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={width} strokeDasharray={dash} data-testid={testId} />;
}

function DebugPoint({ point, project, label }) {
  if (!point) return null;
  const p = project(point);
  return (
    <g data-testid="debug-wall-endpoint">
      <circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke="#111827" strokeWidth={1.2} />
      <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize={9} fontWeight={700} fill="#111827">{label}</text>
    </g>
  );
}

function GapLine({ gap, project }) {
  if (!gap?.from || !gap?.to) return null;
  const a = project(gap.from);
  const b = project(gap.to);
  return (
    <line
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      stroke={HIGHLIGHTER_WALL_COLOR.gap}
      strokeWidth={6}
      strokeLinecap="round"
      strokeDasharray="8 6"
      opacity={0.75}
      data-testid="exterior-highlight-gap"
    />
  );
}

function PlanLineworkOverlay({ planGeometryIndex, project }) {
  const lines = planGeometryIndex?.rawSegments || planGeometryIndex?.segments || planGeometryIndex?.lines || [];
  if (!Array.isArray(lines) || lines.length === 0) return null;
  return (
    <g data-testid="plan-linework-over-wall-fill">
      {lines.slice(0, 6000).map((line, index) => {
        const start = line.start || line.a;
        const end = line.end || line.b;
        if (!start || !end) return null;
        const a = project(start);
        const b = project(end);
        const strokeWidth = Math.max(0.55, Math.min(1.2, Number(line.strokeWidth) || 0.75));
        return (
          <line
            key={line.id || `plan-line-${index}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#111827"
            strokeWidth={strokeWidth}
            strokeLinecap="square"
            opacity={0.72}
            data-testid="plan-linework-over-wall-fill-line"
          />
        );
      })}
    </g>
  );
}

function WallBandSnapPreview({ wallBand, wallType, project }) {
  const faceA = wallType === "exterior" ? (wallBand.innerFace || wallBand.faceA) : wallBand.faceA;
  const faceB = wallType === "exterior" ? (wallBand.outerFace || wallBand.faceB) : wallBand.faceB;
  if (!faceA?.start || !faceA?.end || !faceB?.start || !faceB?.end) {
    return null;
  }
  const points = [faceA.start, faceA.end, faceB.end, faceB.start]
    .map(project)
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
  const color = wallType === "internal" ? "rgba(22,140,255,0.56)" : "rgba(49,232,90,0.58)";
  const stroke = wallType === "internal" ? "#168CFF" : "#31E85A";
  return (
    <polygon
      points={points}
      fill={color}
      stroke={stroke}
      strokeWidth={1}
      style={{ mixBlendMode: "multiply" }}
      data-testid="wall-band-snap-preview"
    />
  );
}

function WallDrawBandPreview({ from, to, wallBand, wallType, project }) {
  const faces = previewFacesFromWallBand(from, to, wallBand, wallType);
  if (!faces) return null;
  const points = [faces.faceA.start, faces.faceA.end, faces.faceB.end, faces.faceB.start]
    .map(project)
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
  const fill = wallType === "internal" ? "rgba(22,140,255,0.62)" : "rgba(49,232,90,0.64)";
  const stroke = wallType === "internal" ? "#168CFF" : "#31E85A";
  return (
    <polygon
      points={points}
      fill={fill}
      stroke={stroke}
      strokeWidth={1.2}
      strokeLinejoin="round"
      style={{ mixBlendMode: "multiply" }}
      data-testid="wall-draw-band-preview"
    />
  );
}

function previewFacesFromWallBand(from, to, wallBand, wallType) {
  if (!from || !to) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return null;
  const normal = { nx: -dy / len, ny: dx / len };
  const primaryFaceA = wallType === "exterior" ? (wallBand?.innerFace || wallBand?.faceA) : wallBand?.faceA;
  const primaryFaceB = wallType === "exterior" ? (wallBand?.outerFace || wallBand?.faceB) : wallBand?.faceB;
  const offsetA = faceOffsetForPreview(primaryFaceA, from, normal);
  const offsetB = faceOffsetForPreview(primaryFaceB, from, normal);
  if (!Number.isFinite(offsetA) || !Number.isFinite(offsetB) || Math.abs(offsetA - offsetB) < 1) return null;
  return {
    faceA: { start: offsetPreviewPoint(from, normal, offsetA), end: offsetPreviewPoint(to, normal, offsetA) },
    faceB: { start: offsetPreviewPoint(from, normal, offsetB), end: offsetPreviewPoint(to, normal, offsetB) },
  };
}

function faceOffsetForPreview(face, start, normal) {
  if (!face?.start || !face?.end) return null;
  const a = (face.start.x - start.x) * normal.nx + (face.start.y - start.y) * normal.ny;
  const b = (face.end.x - start.x) * normal.nx + (face.end.y - start.y) * normal.ny;
  return (a + b) / 2;
}

function offsetPreviewPoint(point, normal, offset) {
  return { x: point.x + normal.nx * offset, y: point.y + normal.ny * offset };
}

function WallSegmentLine({ segment, vertexById, project, selected, hovered, openings = [], siblingSegments = [], showWallFacesDebug = false }) {
  const a = vertexById.get(segment.aId);
  const b = vertexById.get(segment.bId);
  if (!a || !b) return null;
  const pa = project(a);
  const pb = project(b);
  const unconfirmedAutomatic = segment.source === "automatic" && !segment.confirmed;
  const missingSection = isMissingSectionIndicator(segment);
  const color = missingSection ? MISSING_SECTION : unconfirmedAutomatic ? EXTERIOR_CANDIDATE : WALL_COLOR[segment.wallType] || WALL_COLOR.exterior;
  const wallType = segment.wallType || "exterior";
  const outlineColor = WALL_OUTLINE[wallType] || WALL_OUTLINE.exterior;
  const fillIntervals = wallFillIntervals(a, b, openings);
  const openingIntervals = openingFillIntervals(a, b, openings);
  const hasDetectedFaces = hasWallFaces(segment);
  return (
    <g data-testid={missingSection ? "missing-section-indicator" : "wall-segment"} data-wall-type={segment.wallType}>
      {hasDetectedFaces && fillIntervals.map((interval, index) => {
        const band = wallBandPolygon(segment, a, b, interval, siblingSegments);
        const bandPointString = band.map(project).map((p) => `${p.x},${p.y}`).join(" ");
        return (
          <polygon
            key={`fill-${index}`}
            points={bandPointString}
            fill={selected || hovered ? (WALL_SELECTED_FILL[wallType] || WALL_SELECTED_FILL.exterior) : (WALL_FILL[wallType] || WALL_FILL.exterior)}
            stroke={selected || hovered ? outlineColor : "none"}
            strokeWidth={selected ? 2.2 : hovered ? 1.4 : 0}
            strokeLinejoin="round"
            opacity={missingSection ? 0.65 : 1}
            style={{ mixBlendMode: "multiply" }}
            data-testid="wall-band-fill"
          />
        );
      })}
      {hasDetectedFaces && openingIntervals.map((interval, index) => {
        const band = wallBandPolygon(segment, a, b, interval, siblingSegments);
        const bandPointString = band.map(project).map((p) => `${p.x},${p.y}`).join(" ");
        const openingColor = OPENING_COLOR[interval.openingType] || OPENING_COLOR.opening;
        return (
          <polygon
            key={`opening-${index}`}
            points={bandPointString}
            fill={openingFillColor(interval.openingType)}
            stroke={openingColor}
            strokeWidth={1.4}
            strokeLinejoin="round"
            data-testid="wall-opening-cutout"
          />
        );
      })}
      {!hasDetectedFaces && (
        <>
          <line
            x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
            stroke={selected || hovered ? "#f97316" : "#b45309"}
            strokeWidth={selected || hovered ? 1.4 : 0.9}
            strokeLinecap="round"
            opacity={selected || hovered ? 0.85 : 0.45}
            data-testid="wall-faces-uncertain-preview"
          />
          {(selected || hovered) && (
            <text
              x={(pa.x + pb.x) / 2}
              y={(pa.y + pb.y) / 2 - 8}
              textAnchor="middle"
              fontSize={10}
              fontWeight={800}
              fill="#b91c1c"
              paintOrder="stroke"
              stroke="#fff"
              strokeWidth={3}
              data-testid="wall-thickness-unresolved-label"
            >
              Wall faces unresolved
            </text>
          )}
        </>
      )}
      {hasDetectedFaces && (selected || hovered || missingSection) && (
        <line
          x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
          stroke={missingSection ? color : outlineColor}
          strokeWidth={missingSection ? 1.8 : 1.1}
          strokeLinecap="round"
          strokeDasharray={missingSection ? "7 7" : selected ? "4 3" : undefined}
          opacity={missingSection ? 0.75 : 0.92}
        />
      )}
      {showWallFacesDebug && hasDetectedFaces && (
        <WallFacesDebugOverlay segment={segment} a={a} b={b} project={project} siblingSegments={siblingSegments} />
      )}
      {missingSection && (
        <>
          <text x={(pa.x + pb.x) / 2} y={(pa.y + pb.y) / 2 - 6} textAnchor="middle" fontSize={13} fontWeight={900} fill={MISSING_SECTION}>?</text>
        </>
      )}
    </g>
  );
}

function WallFacesDebugOverlay({ segment, a, b, project, siblingSegments }) {
  const faces = wallFacesWithCornerJoins(segment, a, b, { start: 0, end: 1 }, siblingSegments);
  const topologyStart = project(a);
  const topologyEnd = project(b);
  const faceAStart = project(faces.faceAStart);
  const faceAEnd = project(faces.faceAEnd);
  const faceBStart = project(faces.faceBStart);
  const faceBEnd = project(faces.faceBEnd);
  return (
    <g data-testid="wall-faces-debug-overlay" pointerEvents="none">
      <line x1={faceAStart.x} y1={faceAStart.y} x2={faceAEnd.x} y2={faceAEnd.y} stroke="#ff00ff" strokeWidth={1} data-testid="wall-face-a-debug" />
      <line x1={faceBStart.x} y1={faceBStart.y} x2={faceBEnd.x} y2={faceBEnd.y} stroke="#00ffff" strokeWidth={1} data-testid="wall-face-b-debug" />
      <line x1={topologyStart.x} y1={topologyStart.y} x2={topologyEnd.x} y2={topologyEnd.y} stroke="#ef4444" strokeWidth={0.9} strokeDasharray="4 3" data-testid="wall-topology-debug" />
      {[faceAStart, faceAEnd, faceBStart, faceBEnd].map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r={2} fill={index < 2 ? "#ff00ff" : "#00ffff"} stroke="#111827" strokeWidth={0.4} data-testid="wall-face-intersection-debug" />
      ))}
    </g>
  );
}

function hasWallFaces(segment) {
  const unresolved = segment?.geometryStatus === "unresolved" || segment?.geometryStatus === "unresolved_faces";
  return Boolean(
    !unresolved &&
    segment?.faceA?.start &&
    segment?.faceA?.end &&
    segment?.faceB?.start &&
    segment?.faceB?.end &&
    segment.faceA.source !== "inferred" &&
    segment.faceB.source !== "inferred" &&
    segment.snapSource !== "builder-defined-wall-band"
  );
}

function wallBandPolygon(segment, a, b, interval = { start: 0, end: 1 }, siblingSegments = []) {
  const faces = wallFacesWithCornerJoins(segment, a, b, interval, siblingSegments);
  return [
    faces.faceAStart,
    faces.faceAEnd,
    faces.faceBEnd,
    faces.faceBStart,
  ];
}

function wallFacesWithCornerJoins(segment, a, b, interval, siblingSegments) {
  const fullStart = Math.max(0, interval.start) <= 0.0001;
  const fullEnd = Math.min(1, interval.end) >= 0.9999;
  const faceAStart = lerpPoint(segment.faceA.start, segment.faceA.end, interval.start);
  const faceAEnd = lerpPoint(segment.faceA.start, segment.faceA.end, interval.end);
  const faceBStart = lerpPoint(segment.faceB.start, segment.faceB.end, interval.start);
  const faceBEnd = lerpPoint(segment.faceB.start, segment.faceB.end, interval.end);
  const joinedStart = fullStart ? joinedFaceEndpoint(segment, "start", "faceA", faceAStart, siblingSegments) : null;
  const joinedEnd = fullEnd ? joinedFaceEndpoint(segment, "end", "faceA", faceAEnd, siblingSegments) : null;
  const joinedBStart = fullStart ? joinedFaceEndpoint(segment, "start", "faceB", faceBStart, siblingSegments) : null;
  const joinedBEnd = fullEnd ? joinedFaceEndpoint(segment, "end", "faceB", faceBEnd, siblingSegments) : null;
  return {
    faceAStart: joinedStart || faceAStart,
    faceAEnd: joinedEnd || faceAEnd,
    faceBStart: joinedBStart || faceBStart,
    faceBEnd: joinedBEnd || faceBEnd,
  };
}

function joinedFaceEndpoint(segment, endKey, faceKey, fallback, siblingSegments) {
  const vertexId = endKey === "start" ? segment.aId : segment.bId;
  const adjacent = siblingSegments.find((candidate) => (
    candidate.id !== segment.id &&
    candidate.wallType === segment.wallType &&
    hasWallFaces(candidate) &&
    (candidate.aId === vertexId || candidate.bId === vertexId)
  ));
  if (!adjacent) return null;

  const currentFace = segment[faceKey];
  const options = ["faceA", "faceB"]
    .map((candidateFaceKey) => lineIntersection(currentFace.start, currentFace.end, adjacent[candidateFaceKey].start, adjacent[candidateFaceKey].end))
    .filter(Boolean)
    .filter((point) => distance(point, fallback) <= Math.max(18, Number(segment.thicknessDocUnits || segment.thicknessPx || 0) * 2.5));
  return options.sort((left, right) => distance(left, fallback) - distance(right, fallback))[0] || null;
}

function lineIntersection(a, b, c, d) {
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denominator) < 1e-9) return null;
  return {
    x: ((a.x * b.y - a.y * b.x) * (c.x - d.x) - (a.x - b.x) * (c.x * d.y - c.y * d.x)) / denominator,
    y: ((a.x * b.y - a.y * b.x) * (c.y - d.y) - (a.y - b.y) * (c.x * d.y - c.y * d.x)) / denominator,
  };
}

function lerpPoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function projectT(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (!(len2 > 0)) return 0;
  return Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2));
}

function openingFillIntervals(a, b, openings) {
  return openings
    .map((opening) => {
      const t0 = Number.isFinite(opening.startOffset) ? opening.startOffset : projectT(opening.start, a, b);
      const t1 = Number.isFinite(opening.endOffset) ? opening.endOffset : projectT(opening.end, a, b);
      const start = Math.max(0, Math.min(t0, t1) - 0.003);
      const end = Math.min(1, Math.max(t0, t1) + 0.003);
      return end - start > 0.005 ? { start, end, openingType: opening.openingType } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.start - right.start);
}

function openingFillColor(openingType) {
  if (openingType === "window") return "rgba(0,229,255,0.72)";
  if (openingType === "garage-door") return "rgba(168,85,247,0.72)";
  if (openingType === "opening" || openingType === "open-opening") return "rgba(248,255,46,0.72)";
  return "rgba(249,115,22,0.72)";
}

function wallFillIntervals(a, b, openings) {
  const gaps = openingFillIntervals(a, b, openings);
  if (!gaps.length) return [{ start: 0, end: 1 }];
  const intervals = [];
  let cursor = 0;
  gaps.forEach((gap) => {
    if (gap.start > cursor + 0.005) intervals.push({ start: cursor, end: gap.start });
    cursor = Math.max(cursor, gap.end);
  });
  if (cursor < 0.995) intervals.push({ start: cursor, end: 1 });
  return intervals.length ? intervals : [];
}

function WallVertexDot({ vertex, index, project, selected, hovered, visible }) {
  if (!visible) return null;
  const p = project(vertex);
  const isFirst = index === 0;
  return (
    <g data-testid="wall-vertex" data-first-corner={isFirst || undefined}>
      {(selected || hovered) && (
        <circle cx={p.x} cy={p.y} r={selected ? 6 : 5} fill="none" stroke={selected ? "#f97316" : "#64748b"} strokeWidth={1.3} />
      )}
      <circle
        cx={p.x} cy={p.y}
        r={12}
        fill="transparent"
        stroke="transparent"
        data-testid="wall-vertex-hit-area"
      />
      <circle
        cx={p.x} cy={p.y}
        r={selected ? 3.6 : 3}
        fill="#fff"
        stroke={selected ? "#f97316" : "#64748b"}
        strokeWidth={1.3}
      />
      <circle cx={p.x} cy={p.y} r={0.9} fill={selected ? "#f97316" : "#64748b"} />
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
      {(opening.openingType === "door" || opening.openingType === "internal-door" || opening.openingType === "external-door") && opening.swing && (
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
        <g key={i} data-testid="area-draft-point">
          <circle cx={p.x} cy={p.y} r={10} fill="transparent" stroke="transparent" data-testid="area-draft-point-hit-area" />
          {i === 0 && <circle cx={p.x} cy={p.y} r={5} fill="none" stroke="#7c3aed" strokeWidth={1.2} opacity={0.55} />}
          <circle cx={p.x} cy={p.y} r={i === 0 ? 3.8 : 3.2} fill={i === 0 ? "#fff" : "#7c3aed"} stroke="#7c3aed" strokeWidth={1.4} />
          <circle cx={p.x} cy={p.y} r={0.9} fill={i === 0 ? "#7c3aed" : "#fff"} />
        </g>
      ))}
    </g>
  );
}

function AreaVertexHandle({ vertex, vertexIndex, project, dragging }) {
  const p = project(vertex);
  return (
    <g data-testid="area-vertex-handle" data-vertex-index={vertexIndex} data-dragging={dragging ? "true" : "false"}>
      <circle cx={p.x} cy={p.y} r={10} fill="transparent" stroke="transparent" data-testid="area-vertex-hit-area" />
      <circle cx={p.x} cy={p.y} r={dragging ? 5 : 4} fill="#fff" stroke="#7c3aed" strokeWidth={1.8} />
      <circle cx={p.x} cy={p.y} r={1.2} fill="#7c3aed" />
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
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ef4444" strokeWidth={1.4} strokeDasharray={dashed ? "6 4" : undefined} opacity={0.85} />
      <g>
        <line x1={b.x - 7} y1={b.y} x2={b.x + 7} y2={b.y} stroke="#ef4444" strokeWidth={1.1} opacity={0.85} />
        <line x1={b.x} y1={b.y - 7} x2={b.x} y2={b.y + 7} stroke="#ef4444" strokeWidth={1.1} opacity={0.85} />
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

function SnapMarker({ point, snap, label, project }) {
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
      {label && (
        <text x={p.x + 10} y={p.y - 8} fontSize={10} fontWeight={800} fill={style.fill} data-testid="snap-marker-label">
          {label}
        </text>
      )}
      {snap?.openingCandidate && snap.openingCandidate !== "none" && (
        <text
          x={p.x + 10}
          y={p.y + 14}
          fontSize={10}
          fontWeight={800}
          fill="#a855f7"
          data-testid="opening-preview-label"
        >
          {`${OPENING_PREVIEW_LABEL[snap.openingCandidate] || "OPENING"}${snap.openingWidthMm ? ` ${Math.round(snap.openingWidthMm)}mm` : ""}`}
        </text>
      )}
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
