// Exterior wall detection. There is no traditional image/CV wall detector
// anywhere in this repo's history (confirmed by searching current code and
// git history) — the only "detection" that ever existed for this is GPT-4o
// vision via the existing /api/ai/plan-detect endpoint, which is reused here
// unmodified. This module's job is purely to convert its response (image-pixel
// polylines with per-segment confidence) into a page-space wall graph.
//
// A tiny fetch wrapper is duplicated here (rather than importing
// components/estimate-builder/ai-takeoff/aiDetectionService.js) to keep
// modules/takeoff-v2 self-contained, per its existing isolation rule.

import { buildWallGraphFromPolylines } from "./wallGraph.js";
import { assessExteriorDetectionGraph, normalizeSegmentConfidence } from "./wallDetectionQuality.js";
import { polylineWithinRegion } from "./planRegion.js";
import { detectExteriorWallsFromGeometry } from "./vectorExteriorDetection.js";
import { supabase } from "../../../utils/supabase-client";

// Root cause of "AI detection API error 401" (verified live, not guessed —
// see scripts/test-takeoff-v2-detection-auth.mjs): /api/ai/plan-detect is
// wrapped in withAuth (lib/withWorkspace.js), which requires an
// `Authorization: Bearer <supabase-access-token>` header — this is the Gr8
// Result APPLICATION's own auth, checked before the handler ever looks at
// OPENAI_API_KEY. The fetch here previously sent no auth header at all, so
// every call was rejected by withAuth (USER_AUTH_REQUIRED) before reaching
// the AI provider at all. Same pattern already used elsewhere in this app
// (hooks/useWorkspace.js). Confirmed live:
//   curl with no Authorization header  -> 401 {"error":"Unauthorized: missing token"}
//   curl with a garbage bearer token   -> 401 {"error":"Unauthorized: invalid token"}
// both from withAuth, never from OpenAI.
//
// The server (pages/api/ai/plan-detect.js) now returns a `code` distinguishing
// every failure stage instead of a single generic message:
//   USER_AUTH_REQUIRED     — the app's own session is missing/invalid (fixed here)
//   PROVIDER_NOT_CONFIGURED — OPENAI_API_KEY isn't set server-side
//   PROVIDER_AUTH_FAILED   — OpenAI itself rejected the server's API key
//   PROVIDER_ERROR         — any other provider-side failure
async function requestExteriorWallDetection({ imageDataUrl, imageWidth, imageHeight }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token || "";
  if (!accessToken) {
    return { connected: false, overlays: [], confidence: 0, code: "USER_AUTH_REQUIRED", message: "Your session has expired. Sign in again." };
  }

  try {
    const response = await fetch("/api/ai/plan-detect", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ imageDataUrl, imageWidth, imageHeight }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      return { connected: false, overlays: [], confidence: 0, code: data.code || "USER_AUTH_REQUIRED", message: "Your session has expired. Sign in again." };
    }
    if (!response.ok) {
      return { connected: false, overlays: [], confidence: 0, code: data.code || "PROVIDER_ERROR", message: data.message || `AI detection API error ${response.status}` };
    }
    return {
      connected: data.connected ?? true,
      overlays: data.overlays || [],
      confidence: data.confidence || 0,
      code: data.code || (data.connected === false ? "PROVIDER_ERROR" : "OK"),
      message: data.message || "",
    };
  } catch {
    return { connected: false, overlays: [], confidence: 0, code: "PROVIDER_ERROR", message: "Exterior wall detection service is not reachable." };
  }
}

// viewport is the same pdfjs PageViewport used by pageToScreenPoint/
// screenToPagePoint — its convertToPdfPoint already bakes in rotation, so the
// resulting graph lands directly in page-space regardless of current rotation.
// `planRegion` (page-space, unrotated PDF points) is optional — when the
// page has one set, any detected overlay whose points mostly fall outside
// it is dropped before it ever becomes a wall segment. This is what keeps a
// misfired "externalWall" overlay over the title block, a legend, or the
// sheet's own border rectangle from ever entering the wall graph, without
// needing any text/table classifier — the user-confirmed region is the
// single source of truth for "this is the actual floor plan area."
export async function detectExteriorWalls({ imageDataUrl, imageWidth, imageHeight, viewport, stitchToleranceDocUnits = 6, planRegion = null, planGeometryIndex = null, page = null }) {
  const vectorResult = detectExteriorWallsFromGeometry({ planGeometryIndex, page, planRegion, stitchToleranceDocUnits });
  if (vectorResult?.segments?.length) return vectorResult;

  const result = await requestExteriorWallDetection({ imageDataUrl, imageWidth, imageHeight });
  if (!result.connected) {
    return {
      connected: false,
      code: result.code || "PROVIDER_ERROR",
      message: result.message || "AI detection service is not connected yet.",
      vertices: [], segments: [], isClosed: false, detectionConfidence: null,
    };
  }

  const totalOverlays = result.overlays.filter((overlay) => overlay.type === "externalWall").length;

  const polylines = result.overlays
    .filter((overlay) => overlay.type === "externalWall" && Array.isArray(overlay.points) && overlay.points.length >= 2)
    .map((overlay) => ({
      points: overlay.points.map((point) => {
        const [x, y] = viewport.convertToPdfPoint(point.x, point.y);
        return { x, y };
      }),
      confidence: normalizeSegmentConfidence(overlay.confidence),
    }))
    .filter((polyline) => polylineWithinRegion(polyline.points, planRegion));

  const excludedByRegion = totalOverlays - polylines.length;

  const graph = buildWallGraphFromPolylines(polylines, { tolerance: stitchToleranceDocUnits, source: "automatic" });
  const quality = assessExteriorDetectionGraph(graph.vertices, graph.segments, result.confidence || 0);
  const isClosed = quality.isClosed;
  const segments = graph.segments.map((segment) => {
    const inPerimeter = quality.largestSegmentIds.has(segment.id);
    return { ...segment, confirmed: Boolean(quality.useful && quality.isClosed && inPerimeter), inDetectedPerimeter: inPerimeter };
  });

  const baseMessage = quality.useful
    ? `Exterior candidate found. ${segments.length} segment${segments.length !== 1 ? "s" : ""} need review.`
    : `Exterior detection incomplete. ${graph.segments.length} isolated candidate${graph.segments.length !== 1 ? "s" : ""} found. No usable perimeter created.`;
  return {
    connected: true,
    vertices: graph.vertices,
    segments,
    isClosed,
    detectionConfidence: quality.confidence,
    completeness: quality.completeness,
    connectedComponents: quality.connectedComponents,
    openGaps: quality.openGaps,
    useful: quality.useful,
    warnings: quality.warnings,
    diagnostics: {
      source: "ai-overlay",
      rawLines: totalOverlays,
      filteredWallLines: polylines.length,
      wallPairs: 0,
      connectedComponents: quality.connectedComponents,
      candidateExteriorSegments: graph.segments.length,
      excludedByRegion,
    },
    message: excludedByRegion > 0
      ? `${baseMessage} (${excludedByRegion} candidate${excludedByRegion !== 1 ? "s" : ""} outside the plan region excluded.)`
      : baseMessage,
  };
}
