import { distance } from "../../takeoff-v2/takeoff/geometry.js";

const CONNECT_TOLERANCE = 3;

function linePoint(line, key) {
  return line?.[key] || line?.[key === "start" ? "a" : "b"] || null;
}

function segmentLength(line) {
  const start = linePoint(line, "start");
  const end = linePoint(line, "end");
  return start && end ? distance(start, end) : 0;
}

function pointToSegmentDistance(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared === 0) return distance(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSquared));
  return distance(point, { x: a.x + abx * t, y: a.y + aby * t });
}

function linesTouch(a, b) {
  const aStart = linePoint(a, "start");
  const aEnd = linePoint(a, "end");
  const bStart = linePoint(b, "start");
  const bEnd = linePoint(b, "end");
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return (
    distance(aStart, bStart) <= CONNECT_TOLERANCE ||
    distance(aStart, bEnd) <= CONNECT_TOLERANCE ||
    distance(aEnd, bStart) <= CONNECT_TOLERANCE ||
    distance(aEnd, bEnd) <= CONNECT_TOLERANCE ||
    pointToSegmentDistance(aStart, bStart, bEnd) <= CONNECT_TOLERANCE ||
    pointToSegmentDistance(aEnd, bStart, bEnd) <= CONNECT_TOLERANCE ||
    pointToSegmentDistance(bStart, aStart, aEnd) <= CONNECT_TOLERANCE ||
    pointToSegmentDistance(bEnd, aStart, aEnd) <= CONNECT_TOLERANCE
  );
}

function buildTraceableComponents(lines) {
  const seen = new Set();
  const components = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (seen.has(i)) continue;
    const stack = [i];
    const indexes = [];
    seen.add(i);
    while (stack.length) {
      const index = stack.pop();
      indexes.push(index);
      for (let next = 0; next < lines.length; next += 1) {
        if (seen.has(next)) continue;
        if (linesTouch(lines[index], lines[next])) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    const componentLines = indexes.map((index) => lines[index]);
    components.push({
      id: `component-${components.length + 1}`,
      lineIds: componentLines.map((line) => line.id).filter(Boolean),
      lineCount: componentLines.length,
      totalLength: componentLines.reduce((sum, line) => sum + segmentLength(line), 0),
      lines: componentLines,
    });
  }
  return components.sort((a, b) => b.totalLength - a.totalLength || b.lineCount - a.lineCount);
}

function selectedComponentId(components, result) {
  const finalLineIds = new Set((result?.diagnostics?.finalLoop?.edges || []).flatMap((edge) => edge.lineIds || edge.sourceLineIds || []));
  if (finalLineIds.size) {
    const selected = components.find((component) => component.lineIds.some((lineId) => finalLineIds.has(lineId)));
    if (selected) return selected.id;
  }
  return components[0]?.id || null;
}

export function createV3TraceDiagnostics({ planGeometryIndex, detectorResult, runtimeMs }) {
  const traceableSegments = Array.isArray(planGeometryIndex?.lines) ? planGeometryIndex.lines : [];
  const components = buildTraceableComponents(traceableSegments);
  const manualProof = detectorResult?.diagnostics?.manualTraceProof || [];
  const unsupportedEdges = manualProof.filter((proof) => proof.manualTraceable !== true);
  const finalLoopEdges = detectorResult?.diagnostics?.finalLoop?.edges || [];
  const graphNodeById = new Map((detectorResult?.diagnostics?.traceGraphNodes || []).map((node) => [node.id, node]));
  const traceGraphEdges = (detectorResult?.diagnostics?.traceGraphEdges || []).map((edge) => ({
    ...edge,
    from: graphNodeById.get(edge.startNodeId) || null,
    to: graphNodeById.get(edge.endNodeId) || null,
  }));
  return {
    totalTraceableSegments: traceableSegments.length,
    graphNodes: detectorResult?.diagnostics?.traceGraphNodeCount || 0,
    connectedComponents: components.length,
    selectedComponentId: selectedComponentId(components, detectorResult),
    selectedComponentSize: components.find((component) => component.id === selectedComponentId(components, detectorResult))?.lineCount || 0,
    candidateBoundaryEdges: finalLoopEdges.length,
    finalExteriorEdges: Array.isArray(detectorResult?.segments) ? detectorResult.segments.length : 0,
    unsupportedEdges: unsupportedEdges.length,
    gaps: detectorResult?.exteriorPerimeter?.gapCount || detectorResult?.openGaps || 0,
    selfIntersections: detectorResult?.exteriorPerimeter?.selfIntersectionCount || 0,
    runtimeMs: Math.round(runtimeMs),
    components,
    finalLoopEdges,
    traceGraphEdges,
    manualTraceProof: manualProof,
    resultUseful: Boolean(detectorResult?.useful),
    message: detectorResult?.message || detectorResult?.warnings?.[0] || "",
  };
}
