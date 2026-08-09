// Stage 1 exterior detection boundary: reuse the shared plan geometry index
// only. The older image/AI-overlay fallback produced screen/image-space
// candidate polylines that were not the same source used by scale snapping,
// so it is deliberately disabled until a later exterior-detection stage.

import { detectExteriorWallsFromGeometry } from "./vectorExteriorDetection.js";

export async function detectExteriorWalls({
  imageDataUrl,
  imageWidth,
  imageHeight,
  viewport,
  stitchToleranceDocUnits = 6,
  planRegion = null,
  planGeometryIndex = null,
  page = null,
} = {}) {
  void imageDataUrl;
  void imageWidth;
  void imageHeight;
  void viewport;

  const geometryResult = detectExteriorWallsFromGeometry({ planGeometryIndex, page, planRegion, stitchToleranceDocUnits });
  if (geometryResult?.segments?.length) return geometryResult;

  return {
    connected: false,
    code: "GEOMETRY_REQUIRED",
    vertices: [],
    segments: [],
    isClosed: false,
    detectionConfidence: null,
    completeness: 0,
    connectedComponents: 0,
    openGaps: 0,
    useful: false,
    warnings: ["Automatic exterior polygon generation is disabled for Stage 1."],
    diagnostics: {
      source: "geometry-index",
      rawLines: planGeometryIndex?.lines?.length || planGeometryIndex?.segments?.length || 0,
      filteredWallLines: 0,
      wallPairs: 0,
      connectedComponents: 0,
      candidateExteriorSegments: 0,
      excludedByRegion: 0,
    },
    message: "Automatic exterior polygon generation is disabled for Stage 1. Reuse the shared plan geometry index first.",
  };
}
