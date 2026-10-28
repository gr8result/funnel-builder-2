import { vectorAnalysisFromLinework } from '../geometry/planModelAdapter.js';
import { normalizePlanAnalysis } from './analysisContract.js';
import { detectRoomBoundary } from './roomGeometry.js';

const roomLabelPattern = /^(bed(room)?\s*\d*|master bedroom|living( room)?|kitchen|dining|e-?suite|ens(uite)?|wir|robe|bath(room)?|powder|l'?dry|laundry|home office|office|study|pantry|outdoor terrace|terrace|balcony|lobby|store|garage|entry|alfresco|patio)$/i;

// Room names printed on the sheet, with their centre in logical plan pixels.
export function roomLabelsFromText(planPage) {
  return (planPage.textItems || []).filter((item) => typeof item.text === 'string' && roomLabelPattern.test(item.text.trim())
    && Number.isFinite(item.x) && Number.isFinite(item.y)).map((item) => ({
    name: item.text.trim(), x: item.x + Math.max(0, Number(item.width) || 0) / 2,
    y: item.y - Math.max(0, Number(item.height) || 0) / 2,
  }));
}

export function buildLocalVectorAnalysis({ planPage, detected, pixelsPerMm, level, context, runId }) {
  const labels = roomLabelsFromText(planPage);
  const vector = vectorAnalysisFromLinework(detected, {
    id: `page-${planPage.pageNumber}`, name: level, page: planPage.pageNumber, pixelsPerMm,
    logicalWidth: planPage.logicalWidth, logicalHeight: planPage.logicalHeight,
  }, { labels });
  const normalized = normalizePlanAnalysis({ context, responses: [vector.response], runId, modelVersion: detected.engine });
  const rooms = vector.rooms.map((room, index) => detectRoomBoundary(room, {
    page: planPage.pageNumber, level, width: planPage.logicalWidth, height: planPage.logicalHeight,
    pixelsPerMm, walls: context.completedWallRuns || [], openings: context.placedOpenings || [],
  }, index));
  return { ...normalized, vector, rooms };
}