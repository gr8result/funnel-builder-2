import { connectedComponents, findOpenEndpoints, isPerimeterClosed } from "./wallGraph.js";

export const MIN_USEFUL_PERIMETER_SEGMENTS = 6;

export function normalizeSegmentConfidence(confidence) {
  if (confidence === "high" || confidence === "medium" || confidence === "low") return confidence;
  if (typeof confidence === "number") {
    if (confidence >= 0.75) return "high";
    if (confidence >= 0.45) return "medium";
    return "low";
  }
  return null;
}

export function assessExteriorDetectionGraph(vertices = [], segments = [], providerConfidence = 0) {
  const components = connectedComponents(vertices, segments).filter((component) => component.segments.length > 0);
  const largest = components.reduce((best, component) => (
    component.segments.length > (best?.segments.length || 0) ? component : best
  ), null);
  const largestSegmentCount = largest?.segments.length || 0;
  const usefulSegmentRatio = segments.length ? largestSegmentCount / segments.length : 0;
  const closed = largest ? isPerimeterClosed(largest.vertices, largest.segments) : false;
  const openGaps = largest ? findOpenEndpoints(largest.vertices, largest.segments).length : 0;
  const minimumSegmentScore = Math.min(1, largestSegmentCount / MIN_USEFUL_PERIMETER_SEGMENTS);
  const connectivityScore = components.length <= 1 ? 1 : usefulSegmentRatio;
  const closedScore = closed ? 1 : Math.max(0.35, 1 - openGaps / Math.max(largestSegmentCount, 1));
  const completeness = Math.round(minimumSegmentScore * connectivityScore * closedScore * 100);
  const overallConfidence = Math.round(Math.max(0, Math.min(100, (providerConfidence || 0) * 100 * (completeness / 100))));
  const useful = largestSegmentCount >= MIN_USEFUL_PERIMETER_SEGMENTS && connectivityScore >= 0.75 && components.length <= 3;
  const warnings = [];

  if (!segments.length) warnings.push("No exterior wall candidates found.");
  if (largestSegmentCount < MIN_USEFUL_PERIMETER_SEGMENTS) warnings.push(`${segments.length} isolated candidate${segments.length !== 1 ? "s" : ""} found. No usable perimeter created.`);
  if (components.length > 1) warnings.push(`${components.length} disconnected candidate groups found.`);
  if (!closed && useful) warnings.push(`Perimeter open at ${openGaps} location${openGaps !== 1 ? "s" : ""}.`);

  return {
    connectedComponents: components.length,
    largestSegmentIds: new Set((largest?.segments || []).map((segment) => segment.id)),
    largestSegmentCount,
    isClosed: closed,
    completeness,
    confidence: overallConfidence,
    openGaps,
    useful,
    warnings,
  };
}
