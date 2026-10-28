import { vectorProductionAnalysis } from './vectorProductionAnalysis.js';
import { vectorAnalysisFromLinework } from '../geometry/planModelAdapter.js';
import { normalizePlanAnalysis } from './analysisContract.js';
import { detectRoomBoundary } from './roomGeometry.js';

const roomLabelPattern = /^(bed(room)?\s*\d*|master bedroom|living( room)?|kitchen|dining|e-?suite|ens(uite)?|wir|robe|bath(room)?|powder|l'?dry|laundry|home office|office|study|pantry|outdoor terrace|terrace|balcony|lobby|store|garage|entry|alfresco|patio)$/i;

export function roomLabelsFromText(planPage) {
  const labels = (planPage.textItems || []).filter((item) => typeof item.text === 'string' && roomLabelPattern.test(item.text.trim())
    && Number.isFinite(item.x) && Number.isFinite(item.y)).map((item) => ({
    name: item.text.trim(), x: item.x + Math.max(0, Number(item.width) || 0) / 2,
    y: item.y - Math.max(0, Number(item.height) || 0) / 2,
  }));
  return labels;
}

export function buildLocalVectorAnalysis({ planPage, detected, pixelsPerMm, level, context, runId, wallDecisions = {}, admitReviewedWallKeys = [], semanticInput = null }) {
  const labels = roomLabelsFromText(planPage);
  const spec = {
    id: `page-${planPage.pageNumber}`, name: level, page: planPage.pageNumber, pixelsPerMm,
    logicalWidth: planPage.logicalWidth, logicalHeight: planPage.logicalHeight,
  };
  const production = semanticInput ? vectorProductionAnalysis(semanticInput, detected, spec, { labels, wallDecisions }) : null;
  const vector = production?.vector || vectorAnalysisFromLinework(detected, spec, { labels, wallDecisions });
  // Admission overrides apply only to the wall being explicitly accepted now.
  // A later rerun must retain manually moved/deleted canonical objects.
  const newlyReviewedKeys = new Set(admitReviewedWallKeys);
  const reviewedWalls = new Set(vector.wallLineage.filter(item => item.reviewed && newlyReviewedKeys.has(item.detectionKey)).map(item => item.detectionId));
  const reviewedDetectionIds = [...reviewedWalls, ...vector.response.openings.filter(item => reviewedWalls.has(item.hostDetectionId)).map(item => item.detectionId)]
    .map(id => `page-${planPage.pageNumber}:${id}`);
  const normalized = normalizePlanAnalysis({ context, responses: [vector.response], runId, modelVersion: detected.engine, reviewedDetectionIds });
  const rooms = vector.rooms.map((room, index) => detectRoomBoundary(room, {
    page: planPage.pageNumber, level, width: planPage.logicalWidth, height: planPage.logicalHeight,
    pixelsPerMm, walls: context.completedWallRuns || [], openings: context.placedOpenings || [],
  }, index));
  return { ...normalized, vector, rooms, detected: production?.detected || detected };
}