import { convertAiTakeoffDetections } from './adapter.js';
import { validateAnalysisEvidence } from './analysisEvidence.js';
import { calculatePolygonAreaM2 } from '../floorplanGeometry.js';
import { normaliseLevel, CLADDING_PRODUCTS } from '../takeoffRunData.js';
import { resolveWallFromEvidence, parseOpeningSizeCode, findScheduleEntry, resolveOpeningSubType, establishedDoorHeight, levelFromAreaLabel, isAreaUnit } from './planEvidence.js';
import { reviewAudience } from './reviewSummary.js';

const AREA_TYPES = ['Footprint', 'Living', 'Garage', 'Alfresco', 'Patio', 'Porch', 'Balcony', 'Other'];
const THICKNESSES = [70, 90, 100, 110, 140, 150, 200, 230, 270, 300, 350];
const positive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const evidence = (item, overrides = {}) => validateAnalysisEvidence({ basis: item?.basis, confidence: item?.confidence, evidence: item?.evidence, ...overrides });
const pageOf = (item) => item?.page ?? item?.pageNumber;
const closeScale = (a, b) => Math.abs(a - b) / Math.max(a, b) <= 0.02;
const FINISHES_BY_SYSTEM = { brick_veneer: ['face_brick', 'rendered_brick'], core_filled_blockwork: ['rendered'], lightweight_cladding: CLADDING_PRODUCTS };
// Overall wall thickness the canvas draws for a construction system whose thickness is not printed.
const SYSTEM_THICKNESS = { brick_veneer: 230, core_filled_blockwork: 200, double_brick: 230 };
const nearestThickness = (value) => THICKNESSES.reduce((best, item) => (Math.abs(item - value) < Math.abs(best - value) ? item : best));
const metadataOnly = (raw = {}) => {
  const { nodes, polygon, points, exclusions, ...metadata } = raw || {};
  return metadata;
};

export function parseWindowSizeCode(value) {
  if (typeof value !== 'string') return null;
  // A size code is a separate four-digit token, never an arbitrary tag number.
  const match = value.trim().match(/^([0-9]{2})([0-9]{2})$/);
  if (!match) return null;
  const heightMm = Number(match[1]) * 100;
  const widthMm = Number(match[2]) * 100;
  return heightMm > 0 && widthMm > 0 ? { heightMm, widthMm, rawSizeCode: value } : null;
}

function normalizedPoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y)
    && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

function dimensionEvidenceIssue(dimension, millimetres) {
  if (!Number.isInteger(millimetres) || !parseWindowSizeCode(String(millimetres))) return null;
  const description = `${dimension.label || ''} ${dimension.evidence || ''}`;
  const openingReference = /\b(?:window|door|jamb|stacker|sliding|sgd|gsd|hhww|size\s*code|opening\s*(?:code|tag|label)|centre\s+opening)\b/i.test(description);
  const dimensionAnnotation = /\b(?:dimension\s+(?:line|string|arrows?|ticks?|endpoints?)|extension\s+lines?|dimensioned|written\s+dimension|printed\s+dimension|measurement\s+endpoints?)\b/i.test(description);
  const explicitMillimetres = new RegExp(`\\b${millimetres}\\s*(?:mm|millimet(?:er|re)s?)\\b`, 'i').test(description);
  // Opening jambs are not dimension-line endpoints. A real dimension beside an
  // opening remains eligible when its own annotation explicitly states mm.
  if (dimensionAnnotation && (!openingReference || explicitMillimetres)) return null;
  return openingReference
    ? 'Evidence describes an opening size code or opening extents, without an independent written dimension in millimetres.'
    : 'The four-digit value could be height/width shorthand; independent dimension-line evidence was not supplied.';
}

/** Scale candidates use the existing logical px/mm unit; no new calibration store. */
export function resolveAnalysisScale({ pages = [], inspections = [], existingPixelsPerMm, sheetCalibrations = {}, pdfUnits = false } = {}) {
  const input = Array.isArray(inspections) ? inspections : inspections.pages || [];
  const candidates = [];
  const discardedCandidates = [];
  const review = [];
  const conflicts = [];
  const selected = [];
  const notes = [];
  // A sheet the estimator calibrated keeps that calibration; one that was never calibrated
  // itself inherits the takeoff's calibration. Either way the user's figure is authoritative.
  const calibrationFor = (pageNumber) => {
    const own = Number(sheetCalibrations?.[pageNumber]?.pixelsPerMm ?? sheetCalibrations?.[pageNumber]);
    return positive(own) ? own : positive(existingPixelsPerMm) ? existingPixelsPerMm : null;
  };
  for (const inspection of input.filter((item) => item && item.relevant !== false)) {
    const page = pages.find((item) => pageOf(item) === pageOf(inspection));
    if (!page || !positive(page.logicalWidth) || !positive(page.logicalHeight)) continue;
    const calibrated = calibrationFor(pageOf(page));
    const choices = [];
    for (const dimension of inspection.writtenDimensions || inspection.dimensionReferences || []) {
      const p1 = dimension.p1 || dimension.start, p2 = dimension.p2 || dimension.end;
      const mm = dimension.valueMm ?? dimension.lengthMm;
      if (!normalizedPoint(p1) || !normalizedPoint(p2) || !positive(mm)
        || !['OBSERVED', 'DERIVED'].includes(dimension.basis) || !(dimension.confidence >= 0.7 && dimension.confidence <= 1)) continue;
      const evidenceIssue = dimensionEvidenceIssue(dimension, mm);
      if (evidenceIssue) {
        discardedCandidates.push({ page: pageOf(page), valueMm: mm, reason: evidenceIssue, evidence: dimension.evidence || '' });
        review.push(`Sheet ${pageOf(page)}: discarded ${mm} mm calibration reference. ${evidenceIssue}`);
        continue;
      }
      const distance = Math.hypot((p2.x - p1.x) * page.logicalWidth, (p2.y - p1.y) * page.logicalHeight);
      if (!positive(distance)) continue;
      choices.push({ page: pageOf(page), pixelsPerMm: distance / mm,
        source: dimension.basis === 'OBSERVED' ? 'written-dimension' : 'derived-dimension',
        priority: dimension.basis === 'OBSERVED' ? 1 : 4, ...evidence(dimension) });
    }
    const scale = inspection.scale;
    const pageHasPaperUnits = page.pdfUnits ?? pdfUnits;
    if (pageHasPaperUnits && positive(scale?.denominator) && scale.basis === 'OBSERVED' && scale.confidence >= 0.8 && scale.confidence <= 1) {
      choices.push({ page: pageOf(page), pixelsPerMm: 72 / 25.4 / scale.denominator, denominator: scale.denominator,
        source: 'detected-scale', priority: 2, ...evidence(scale) });
    } else if (positive(scale?.denominator) && !pageHasPaperUnits) {
      // Only worth saying when nothing else calibrates the sheet. A calibrated sheet needs no printed ratio.
      if (calibrated) notes.push(`Sheet ${pageOf(page)}: printed scale 1:${scale.denominator} noted; the calibrated ${calibrated.toPrecision(5)} px/mm is used.`);
      else review.push(`Sheet ${pageOf(page)}: 1:${scale.denominator} cannot determine image pixels/mm without reliable PDF paper units or a written dimension.`);
    }
    if (calibrated) choices.push({ page: pageOf(page), pixelsPerMm: calibrated,
      source: 'existing-calibration', priority: 0, basis: 'OBSERVED', confidence: 1, evidence: 'Existing confirmed Takeoff calibration.' });
    choices.sort((a, b) => a.priority - b.priority || b.confidence - a.confidence);
    candidates.push(...choices);
    if (!choices.length) {
      const message = `Sheet ${pageOf(page)} requires the existing manual calibration workflow.`;
      review.push(message);
      conflicts.push({ page: pageOf(page), message });
      continue;
    }
    const first = choices[0];
    const equallyRankedConflict = choices.some((item) => item.priority === first.priority && !closeScale(item.pixelsPerMm, first.pixelsPerMm));
    if (equallyRankedConflict) conflicts.push({ page: pageOf(page), message: 'Reliable dimension references disagree; confirm calibration manually.' });
    else selected.push(first);
    if (choices.some((item) => !closeScale(item.pixelsPerMm, first.pixelsPerMm))) review.push(`Sheet ${pageOf(page)} has conflicting scale evidence; higher-precedence ${first.source} was selected for confirmation.`);
  }
  if (!selected.length && !conflicts.length && positive(existingPixelsPerMm)) selected.push({ pixelsPerMm: existingPixelsPerMm, source: 'existing-calibration' });
  const first = selected[0];
  if (first && selected.some((item) => !closeScale(item.pixelsPerMm, first.pixelsPerMm))) conflicts.push({ message: 'Relevant sheets have different scales. The existing Takeoff supports one shared calibration; review these sheets separately.' });
  const value = conflicts.length ? null : first?.pixelsPerMm || null;
  return {
    pixelsPerMm: value, source: first?.source || null, denominator: first?.denominator || null,
    requiresConfirmation: Boolean(value && first.source !== 'existing-calibration'),
    wouldChangeExistingCalibration: Boolean(value && positive(existingPixelsPerMm) && !closeScale(value, existingPixelsPerMm)),
    conflicts, review, notes, candidates, discardedCandidates,
  };
}

function strictInside(point, nodes) {
  let inside = false;
  for (let i = 0, j = nodes.length - 1; i < nodes.length; j = i++) {
    const a = nodes[i], b = nodes[j];
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
    if (Math.abs(cross) < 1e-10 && point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x)
      && point.y >= Math.min(a.y, b.y) && point.y <= Math.max(a.y, b.y)) return false;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function overlaps(a, b) {
  if (a.some((point) => strictInside(point, b)) || b.some((point) => strictInside(point, a))) return true;
  const edgeMidpointInside = (source, target) => source.some((point, index) => {
    const next = source[(index + 1) % source.length];
    return strictInside({ x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }, target);
  });
  if (edgeMidpointInside(a, b) || edgeMidpointInside(b, a)) return true;
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  for (let i = 0; i < a.length; i += 1) for (let j = 0; j < b.length; j += 1) {
    const p = a[i], q = a[(i + 1) % a.length], r = b[j], s = b[(j + 1) % b.length];
    if (cross(p, q, r) * cross(p, q, s) < -1e-12 && cross(r, s, p) * cross(r, s, q) < -1e-12) return true;
  }
  // Identical polygons, including a different start corner or reversed winding.
  return a.length === b.length && a.every((point) => b.some((other) => point.x === other.x && point.y === other.y));
}

function projectOpeningToHost(point, host, page, scale, reachMm = 0) {
  if (!normalizedPoint(point)) throw new Error('Opening location must lie on the submitted drawing.');
  const x = point.x * page.logicalWidth, y = point.y * page.logicalHeight;
  let closest = null;
  for (let index = 1; index < host.nodes.length; index += 1) {
    const a = { x: host.nodes[index - 1].x * page.logicalWidth, y: host.nodes[index - 1].y * page.logicalHeight };
    const b = { x: host.nodes[index].x * page.logicalWidth, y: host.nodes[index].y * page.logicalHeight };
    const dx = b.x - a.x, dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (!lengthSq) continue;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSq));
    const px = a.x + t * dx, py = a.y + t * dy;
    const distance = Math.hypot(px - x, py - y);
    if (!closest || distance < closest.distance) closest = { x: px / page.logicalWidth, y: py / page.logicalHeight, distance };
  }
  const tolerance = Math.max(300, host.thicknessMm * 2, reachMm) * scale;
  if (!closest || closest.distance > tolerance) throw new Error('Opening location is too far from its claimed host wall; association requires review.');
  return { x: closest.x, y: closest.y, distanceMm: closest.distance / scale };
}

const normalizeLabel = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normalizeAreaLabel = (value) => normalizeLabel(value).replace(/\barea\b/g, '').replace(/\s+/g, ' ').trim();

function matchAreaBenchmark(label, polygons) {
  const normalized = normalizeLabel(label);
  // "TOTAL GROUND FLOOR" / "TOTAL 1ST FLOOR AREA" are a level's gross footprint, unless the total names an area type.
  const totalFootprint = /^(total (building |floor )?area|total under roof( area)?|under roof( area)?|gross (building )?(floor )?area)$/.test(normalized)
    || (/^total\b/.test(normalized) && !AREA_TYPES.some((value) => value !== 'Footprint' && normalized.includes(value.toLowerCase())));
  const type = totalFootprint ? 'Footprint' : AREA_TYPES.find((value) => normalized.includes(value.toLowerCase()));
  if (!type) return { type: null, polygons: [], reason: 'No unambiguous canonical area category matches this printed label.' };
  const candidates = polygons.filter((area) => area.type === type);
  if (!candidates.length) return { type, polygons: [], reason: null };
  if (type === 'Footprint' || /\btotal\b/.test(normalized)) return { type, polygons: candidates, reason: null };
  const scopedLabel = normalizeAreaLabel(label);
  const exact = candidates.filter((area) => normalizeAreaLabel(area.label || area.type) === scopedLabel);
  if (exact.length) return { type, polygons: exact, reason: null };
  if (scopedLabel !== normalizeAreaLabel(type)) return { type, polygons: [], reason: `No traced polygon matches the named printed ${label}; a different ${type} polygon was not substituted.` };
  if (candidates.length === 1) return { type, polygons: candidates, reason: null };
  return { type, polygons: [], reason: `Printed ${label} could refer to several separately named ${type} polygons; their combined area was not substituted.` };
}

const toPixels = (point, page) => ({ x: point.x * page.logicalWidth, y: point.y * page.logicalHeight });
function distanceToSegment(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq)) : 0;
  return Math.hypot(a.x + t * dx - point.x, a.y + t * dy - point.y);
}

// A position read off a drawing image is good to roughly half a metre, so "the same wall" and
// "the same opening" are judged with that much slack, never by exact coordinates.
const READ_TOLERANCE_MM = 600;

/** Share of a traced line (page pixels) that runs along any of the given segments. */
function shareAlongSegments(nodes, segments, toleranceMm, scale) {
  return coveredByExistingWalls(nodes, [{ nodes: [], segments, thicknessMm: 0 }], scale, toleranceMm);
}
const polygonSegments = (polygon) => polygon.map((point, index) => [point, polygon[(index + 1) % polygon.length]]);

/**
 * Share of a traced wall that runs along a wall already in the takeoff. Walls the estimator has
 * already drawn are authoritative; an AI trace of the same wall must not be counted a second time.
 */
function coveredByExistingWalls(nodes, existingWalls, scale, toleranceMm = READ_TOLERANCE_MM) {
  const step = 250 * scale;
  let samples = 0, covered = 0;
  for (let index = 1; index < nodes.length; index += 1) {
    const a = nodes[index - 1], b = nodes[index];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!length) continue;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const parts = Math.max(1, Math.round(length / step));
    for (let part = 0; part <= parts; part += 1) {
      const point = { x: a.x + (b.x - a.x) * part / parts, y: a.y + (b.y - a.y) * part / parts };
      samples += 1;
      const near = existingWalls.some((wall) => {
        const tolerance = Math.max(toleranceMm, (Number(wall.thicknessMm) || 0) * 2) * scale;
        const segments = wall.segments || wall.nodes.slice(1).map((end, i) => [wall.nodes[i], end]);
        return segments.some(([start, end]) => {
          const difference = Math.abs(Math.atan2(end.y - start.y, end.x - start.x) - angle) % Math.PI;
          const parallel = Math.min(difference, Math.PI - difference) < 0.35;
          return parallel && distanceToSegment(point, start, end) <= tolerance;
        });
      });
      if (near) covered += 1;
    }
  }
  return samples ? covered / samples : 0;
}

/** Convert unreliable provider output into evidence-bearing Phase 1 detections. */
export function normalizePlanAnalysis({ context, responses = [], runId, modelVersion, planEvidence = null, projectDefaults = null }) {
  if (!context || !Array.isArray(responses)) throw new Error('Analysis requires the current Takeoff context and page responses.');
  const batch = { jobId: context.jobId, takeoffId: context.takeoffId, documentHash: context.documentHash, runId, modelVersion, pixelsPerMm: context.pixelsPerMm, detections: [] };
  const analysis = { schemaVersion: 'ai-takeoff-analysis.v1', runId, modelVersion, rooms: [], fixtures: [], documentedQuantities: [], unresolved: [], review: [], benchmarks: [], pages: [], alreadyMeasured: [], notAdded: [], openEdges: [], documentedAreas: [] };
  const report = (page, item, message, code = 'review') => analysis.review.push({ page, detectionId: item?.detectionId || '', message, code, audience: reviewAudience({ code }) });
  const scale = context.pixelsPerMm;
  const pageFor = (page) => context.pages.find((item) => pageOf(item) === page);
  const all = [];
  const roomLabels = [];
  for (const response of responses) {
    const page = pageOf(response);
    if (!context.pages.some((item) => pageOf(item) === page)) throw new Error(`Analysis references unloaded sheet ${page}.`);
    const level = normaliseLevel(response.level);
    analysis.pages.push({ page, level, drawingType: response.drawingType || 'floor-plan' });
    for (const item of response.review || []) report(page, null, typeof item === 'string' ? item : item.message || item.evidence || 'Review drawing evidence.');
    for (const [collection, kind] of [['walls', 'wall'], ['openings', 'opening'], ['pillars', 'pillar'], ['eaves', 'eave'], ['buildingAreas', 'floorplan']]) {
      for (const raw of response[collection] || []) all.push({ raw, page, level, kind });
    }
    for (const room of response.rooms || []) if (normalizedPoint(room) && typeof room.name === 'string') roomLabels.push({ page, name: room.name, x: room.x, y: room.y });
    for (const [collection, destination] of [['rooms', 'rooms'], ['fixtures', 'fixtures'], ['documentedQuantities', 'documentedQuantities']]) {
      for (const raw of response[collection] || []) {
        try {
          const provenance = evidence(raw);
          if (raw.page !== undefined && raw.page !== page) throw new Error('Evidence page does not match its response.');
          if (raw.basis === 'ASSUMED' || raw.confidence < 0.5) throw new Error('Uncertain evidence is retained for confirmation, not included in schedule quantities.');
          if (collection === 'fixtures' && (!Number.isInteger(raw.quantity) || raw.quantity <= 0)) throw new Error('Fixture quantity must be established from the drawing, not assumed.');
          if (collection === 'documentedQuantities' && (raw.basis !== 'OBSERVED' || !positive(raw.value))) throw new Error('Documented benchmark must be a positive quantity read from the drawing.');
          const metadata = { ...metadataOnly(raw), page, level, ...provenance };
          analysis[destination].push(metadata);
          if (raw.basis === 'ASSUMED') report(page, raw, `${raw.name || 'Room'} is assumed and is retained as metadata only.`, 'assumption');
        } catch (error) { analysis.unresolved.push({ ...metadataOnly(raw), page, kind: collection }); report(page, raw, error.message, 'withheld'); }
      }
    }
  }
  const levelOfPage = new Map(analysis.pages.map((item) => [item.page, item.level]));
  // Geometry already in the takeoff, in each page's own pixel space.
  const existingWalls = (context.completedWallRuns || []).filter((wall) => wall && wall.id !== undefined && wall.id !== null && Array.isArray(wall.nodes) && wall.nodes.length >= 2
    && wall.nodes.every((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))).map((wall) => ({ ...wall, page: Number(wall.page || wall.pageId || 1) }));
  const existingOpenings = (context.placedOpenings || []).filter((item) => item && Number.isFinite(item.x) && Number.isFinite(item.y)).map((item) => ({ ...item, page: Number(item.page || item.pageId || 1) }));
  const matchedExistingOpenings = new Set();
  // A stacker or sliding glass door is the same opening whether it was entered as a window or a door.
  const family = (item) => (item.type === 'window' || item.openingClass === 'Window' || item.openingClass === 'Large Glazed/Stacker/Sliding Door' ? 'glazed' : item.openingClass || item.type);
  const runLengthMm = (nodes) => nodes.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - nodes[index].x, point.y - nodes[index].y), 0) / scale;
  // A sheet the estimator has already measured is authoritative for what they measured on it.
  // The analysis may confirm it, classify it and query it, but a position read off a drawing image
  // is not accurate enough to add new walls, openings, areas or eaves alongside a hand trace.
  const tally = (map, key, amount) => map.set(key, (map.get(key) || 0) + amount);
  const found = new Map(), measured = new Map();
  for (const { raw, page, kind } of all) {
    if (kind === 'wall' && Array.isArray(raw?.nodes) && raw.nodes.every(normalizedPoint)) tally(found, `wall:${page}:${raw.category}`, runLengthMm(raw.nodes.map((point) => toPixels(point, pageFor(page)))));
    else if (kind === 'opening') tally(found, `opening:${page}:${family(raw)}`, 1);
    else if (kind === 'eave') tally(found, `eave:${page}`, 1);
  }
  for (const wall of existingWalls) tally(measured, `wall:${wall.page}:${wall.category}`, Number(wall.lengthMm) > 0 ? Number(wall.lengthMm) : runLengthMm(wall.nodes));
  for (const item of existingOpenings) tally(measured, `opening:${item.page}:${family(item)}`, 1);
  for (const item of context.completedEaves || []) tally(measured, `eave:${Number(item.page || item.pageId || 1)}`, 1);
  const estimatorMeasured = (key) => (measured.get(key) || 0) > 0 && measured.get(key) >= 0.5 * (found.get(key) || 0);
  const idCounts = new Map();
  all.forEach(({ raw, page }) => { const key = `${page}:${raw?.detectionId}`; idCounts.set(key, (idCounts.get(key) || 0) + 1); });
  const acceptedWalls = new Set();
  const acceptedAreas = (context.completedFloorplans || []).flatMap((item) => {
    const page = Number(item.page || item.pageId || 1);
    const dimensions = context.pages.find((candidate) => pageOf(candidate) === page);
    if (!dimensions || !Array.isArray(item.nodes) || item.nodes.length < 3
      || !item.nodes.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))) return [];
    return [{ type: item.type, page, existing: true,
      nodes: item.nodes.map((point) => ({ x: point.x / dimensions.logicalWidth, y: point.y / dimensions.logicalHeight })) }];
  });
  const wallShapes = new Set();
  // Outlines used to tell a wall from the open side of an outdoor area: this run's reliable
  // area outlines and the estimator's own, in page pixels.
  const OPEN_AREA_TYPES = ['Alfresco', 'Patio', 'Porch', 'Balcony'];
  const outlines = [
    ...acceptedAreas.map((item) => ({ page: item.page, type: item.type, nodes: item.nodes })),
    ...all.filter((item) => item.kind === 'floorplan' && item.raw?.basis !== 'ASSUMED' && item.raw?.confidence >= 0.5 && Array.isArray(item.raw.nodes) && item.raw.nodes.length >= 3 && item.raw.nodes.every(normalizedPoint))
      .map((item) => ({ page: item.page, type: item.raw.type, nodes: item.raw.nodes })),
  ].map((item) => ({ ...item, segments: polygonSegments(item.nodes.map((point) => toPixels(point, pageFor(item.page)))) }));
  const areaCandidates = all.filter((item) => item.kind === 'floorplan').sort((a, b) => (b.raw?.confidence || 0) - (a.raw?.confidence || 0));
  const ordered = [...all.filter((item) => item.kind === 'wall'), ...all.filter((item) => item.kind === 'opening'), ...all.filter((item) => item.kind === 'pillar' || item.kind === 'eave'), ...areaCandidates.filter((item) => item.raw?.type === 'Footprint'), ...areaCandidates.filter((item) => item.raw?.type !== 'Footprint')];
  const skip = (raw, page, kind, message) => { analysis.alreadyMeasured.push({ ...metadataOnly(raw), page, kind }); report(page, raw, message, 'already-measured'); };
  const hold = (raw, page, kind, message, extra = {}) => { analysis.notAdded.push({ ...metadataOnly(raw), page, kind, ...extra }); report(page, raw, message, 'not-added'); };
  for (const { raw, page, level, kind } of ordered) {
    try {
      const provenance = evidence(raw);
      if (!raw.detectionId || typeof raw.detectionId !== 'string' || idCounts.get(`${page}:${raw.detectionId}`) !== 1) throw new Error('Detection ID must be unique within its sheet.');
      if (raw.page !== undefined && raw.page !== page) throw new Error('Detection page differs from its response.');
      if (raw.basis === 'ASSUMED' || raw.confidence < 0.5) throw new Error('Assumed or low-confidence geometry is withheld for review.');
      const fields = {};
      const detectionId = `page-${page}:${raw.detectionId}`;
      const detection = { detectionId, kind, page, confidence: raw.confidence, coordinates: { space: 'normalized' }, ...(level === 'Unassigned' ? {} : { level }) };
      const targetPage = pageFor(page);
      if (kind === 'wall') {
        if (!['exterior', 'interior'].includes(raw.category)) throw new Error('Wall category must be observed as exterior or interior.');
        const pageWalls = existingWalls.filter((wall) => wall.page === page);
        if (pageWalls.length && Array.isArray(raw.nodes) && raw.nodes.every(normalizedPoint)
          && coveredByExistingWalls(raw.nodes.map((point) => toPixels(point, targetPage)), pageWalls, scale) >= 0.6) {
          skip(raw, page, kind, 'This wall is already traced in the takeoff; the existing wall is kept and the AI trace is not added.');
          continue;
        }
        // The open side of an alfresco, patio, porch or balcony is posts, columns or a balustrade,
        // not a wall. A line that runs along such an area's outline where that outline is also
        // the outside of the building is not added as wall; it is put to the builder once.
        if (raw.category === 'exterior' && Array.isArray(raw.nodes) && raw.nodes.every(normalizedPoint)) {
          const line = raw.nodes.map((point) => toPixels(point, targetPage));
          const footprint = outlines.filter((item) => item.page === page && item.type === 'Footprint').flatMap((item) => item.segments);
          const open = outlines.find((item) => item.page === page && OPEN_AREA_TYPES.includes(item.type)
            && shareAlongSegments(line, item.segments, 800, scale) >= 0.6 && footprint.length && shareAlongSegments(line, footprint, 800, scale) >= 0.6);
          if (open) {
            const lengthM = line.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - line[index].x, point.y - line[index].y), 0) / scale / 1000;
            analysis.openEdges.push({ ...metadataOnly(raw), page, level, area: open.type, lengthM });
            report(page, raw, `${lengthM.toFixed(1)} m along the open side of the ${open.type.toLowerCase()} was not added as a wall (posts, columns and balustrades are not walls). If it is a solid wall, draw it on the plan.`, 'open-edge');
            continue;
          }
        }
        if (estimatorMeasured(`wall:${page}:${raw.category}`)) {
          hold(raw, page, kind, `A possible ${raw.category} wall was not added: the ${raw.category} walls on this sheet are already traced and none matches it.`, { category: raw.category });
          continue;
        }
        // What the floor plan does not show is looked up across the plan set, then in Job Setup.
        const resolved = resolveWallFromEvidence({ category: raw.category, level }, planEvidence, projectDefaults);
        const fromSource = (item) => ({ basis: item.basis, confidence: item.basis === 'DERIVED' ? raw.confidence : 0, evidence: item.evidence });
        fields.lengthMm = { basis: 'DERIVED', confidence: raw.confidence, evidence: 'The Phase 1 adapter calculates length from this observed geometry and the confirmed Takeoff calibration.' };
        fields.linedFaces = { basis: 'ASSUMED', confidence: 0, evidence: 'Two lined faces is the existing manual wall tool default, not a measured finish specification.' };
        fields.openingDeductionsEnabled = { basis: 'ASSUMED', confidence: 0, evidence: 'Linked-opening deductions use the existing enabled manual wall setting.' };
        // Canonical construction-system classification (Phase 2A). Never inferred from category or
        // overall thickness alone: an unnamed system stays unclassified, never a guess.
        const systemChoices = raw.category === 'exterior'
          ? ['brick_veneer', 'core_filled_blockwork', 'double_brick', 'lightweight_cladding', 'custom', 'unclassified']
          : ['internal_timber_frame', 'custom', 'unclassified'];
        if (raw.constructionSystem !== undefined && raw.constructionSystem !== null && !systemChoices.includes(raw.constructionSystem)) throw new Error(`${raw.category} constructionSystem must be one of: ${systemChoices.join(', ')}.`);
        let constructionSystem = raw.constructionSystem;
        if (constructionSystem === 'custom' && typeof raw.customSystemLabel !== 'string') {
          report(page, raw, 'A custom construction system was proposed without naming it; treated as unclassified for review.', 'unclassified');
          constructionSystem = 'unclassified';
        }
        let systemSource = null;
        if (!constructionSystem || constructionSystem === 'unclassified') {
          if (resolved.constructionSystem && systemChoices.includes(resolved.constructionSystem.value)) {
            constructionSystem = resolved.constructionSystem.value;
            systemSource = resolved.constructionSystem;
            fields.constructionSystem = fromSource(systemSource);
          } else {
            fields.constructionSystem = { basis: 'ASSUMED', confidence: 0, evidence: 'Construction system is not established from the drawing.' };
            constructionSystem = 'unclassified';
            if (raw.category === 'exterior') report(page, raw, 'Exterior construction system remains unclassified; verify construction notes.', 'unclassified');
          }
        } else fields.constructionSystem = provenance;
        const framedSystems = ['brick_veneer', 'lightweight_cladding', 'internal_timber_frame'];
        let frameThicknessMm = null;
        let frameAssumed = false;
        if (framedSystems.includes(constructionSystem)) {
          if (raw.frameThicknessMm === 70 || raw.frameThicknessMm === 90) {
            frameThicknessMm = raw.frameThicknessMm;
            fields.frameThicknessMm = provenance;
          } else if (raw.category === 'interior' && (raw.thicknessMm === 70 || raw.thicknessMm === 90)) {
            // An internal timber wall reports its frame as its thickness.
            frameThicknessMm = raw.thicknessMm;
            fields.frameThicknessMm = provenance;
          } else if (resolved.frameThicknessMm) {
            frameThicknessMm = resolved.frameThicknessMm.value;
            fields.frameThicknessMm = fromSource(resolved.frameThicknessMm);
          } else {
            frameThicknessMm = 70;
            frameAssumed = true;
            fields.frameThicknessMm = { basis: 'ASSUMED', confidence: 0, evidence: '70 mm is the common manual tool frame default; frame thickness was not documented.' };
            report(page, raw, 'Frame thickness uses the 70 mm default; verify on the drawing.', 'assumption');
          }
        } else if (raw.frameThicknessMm !== undefined && raw.frameThicknessMm !== null) {
          throw new Error(`${constructionSystem} does not carry a timber frame; frameThicknessMm must be null.`);
        }
        let thickness = raw.thicknessMm;
        if (!positive(thickness)) {
          const documented = resolved.thicknessMm;
          const derived = documented?.value
            || (raw.category === 'interior' ? (constructionSystem === 'internal_timber_frame' ? frameThicknessMm : null)
              : constructionSystem === 'lightweight_cladding' ? frameThicknessMm : SYSTEM_THICKNESS[constructionSystem]);
          if (positive(derived)) {
            thickness = nearestThickness(derived);
            fields.thicknessMm = documented ? fromSource(documented)
              : { basis: 'DERIVED', confidence: frameAssumed ? 0 : raw.confidence, evidence: `${thickness} mm follows from this wall's construction system${frameThicknessMm ? ` and ${frameThicknessMm} mm frame` : ''}.` };
          } else {
            const defaultThickness = raw.category === 'exterior' ? 230 : 70;
            thickness = defaultThickness;
            fields.thicknessMm = { basis: 'ASSUMED', confidence: 0, evidence: `${defaultThickness} mm is the existing manual tool display default; wall thickness was not documented.` };
            report(page, raw, `Wall thickness uses the ${defaultThickness} mm manual default; verify on the drawing.`, 'assumption');
          }
        } else if (!THICKNESSES.includes(thickness)) {
          const nearest = nearestThickness(thickness);
          fields.thicknessMm = { basis: 'ASSUMED', confidence: 0, evidence: `${thickness} mm was detected; ${nearest} mm is the nearest supported manual tool thickness.` };
          report(page, raw, `Detected ${thickness} mm wall thickness is represented by supported ${nearest} mm; verify.`, 'assumption');
          thickness = nearest;
        } else fields.thicknessMm = provenance;
        if (raw.category === 'interior' && raw.exteriorFinish !== undefined && raw.exteriorFinish !== null) throw new Error('Interior wall cannot carry an exterior finish.');
        let exteriorFinish = raw.category === 'exterior' && typeof raw.exteriorFinish === 'string' ? raw.exteriorFinish : '';
        if (exteriorFinish) fields.exteriorFinish = provenance;
        else if (raw.category === 'exterior' && systemSource && resolved.exteriorFinish && (FINISHES_BY_SYSTEM[constructionSystem] || []).includes(resolved.exteriorFinish.value)) {
          exteriorFinish = resolved.exteriorFinish.value;
          fields.exteriorFinish = fromSource(resolved.exteriorFinish);
        }
        // exteriorType is the legacy five-class field every existing consumer (Job Setup's
        // per-finish LM fields, brick sills, canvas colours) still reads. Deriving it from the
        // canonical system/finish above - rather than trusting a second, independent AI answer -
        // guarantees the legacy and canonical classifications can never disagree for the same wall.
        const exteriorType = raw.category !== 'exterior' ? ''
          : constructionSystem === 'brick_veneer' ? (exteriorFinish === 'rendered_brick' ? 'Rendered Brick Veneer' : 'Face Brick Veneer')
            : constructionSystem === 'lightweight_cladding' ? 'Lightweight Cladding'
              : constructionSystem === 'core_filled_blockwork' ? 'Rendered Masonry'
                : 'Other';
        if (raw.category === 'exterior') fields.exteriorType = fields.constructionSystem;
        if (raw.wallHeightM != null && !positive(raw.wallHeightM)) throw new Error('Wall height must be a positive documented value or null.');
        let wallHeightM = raw.wallHeightM ?? null;
        if (positive(raw.wallHeightM)) fields.wallHeightM = provenance;
        else if (resolved.wallHeightM?.source === 'plan-set') { wallHeightM = resolved.wallHeightM.value; fields.wallHeightM = fromSource(resolved.wallHeightM); }
        // A Job Setup ceiling height is applied downstream to every wall without its own height.
        else if (resolved.wallHeightM) fields.wallHeightM = fromSource(resolved.wallHeightM);
        else report(page, raw, 'Wall height is not documented; existing downstream height defaults require review.', 'missing-height');
        Object.assign(detection, {
          nodes: raw.nodes, category: raw.category, thicknessMm: thickness, alignment: 'outer',
          exteriorType, wallHeightM, linedFaces: 2, openingDeductionsEnabled: true,
          constructionSystem, frameThicknessMm,
          ...(frameAssumed ? { frameAssumed: true } : {}),
          ...(exteriorFinish ? { exteriorFinish } : {}),
          ...(constructionSystem === 'custom' && typeof raw.customSystemLabel === 'string' ? { customSystemLabel: raw.customSystemLabel } : {}),
        });
        fields.alignment = { basis: 'DERIVED', confidence: raw.confidence, evidence: 'Trace is the outer wall face; the adapter uses the existing outer alignment convention.' };
        const forward = JSON.stringify(raw.nodes), reversed = JSON.stringify([...(raw.nodes || [])].reverse());
        const shape = `${page}:${raw.category}:${forward < reversed ? forward : reversed}`;
        if (wallShapes.has(shape)) throw new Error('Duplicate wall geometry is withheld to avoid double-counting.');
        detection.analysisEvidence = { ...provenance, fields };
        convertAiTakeoffDetections({ ...batch, detections: [detection] }, context);
        wallShapes.add(shape);
        acceptedWalls.add(detectionId);
      } else if (kind === 'opening') {
        if (raw.quantity != null && raw.quantity !== 1) throw new Error('A schedule quantity without separate located opening instances is retained as metadata; it is not duplicated at one point.');
        if (!normalizedPoint(raw)) throw new Error('Opening location must lie on the submitted drawing.');
        const pixel = toPixels(raw, targetPage);
        // An opening the estimator already placed is authoritative; each one absorbs at most one AI detection.
        const code = parseOpeningSizeCode(typeof raw.sizeCode === 'string' ? raw.sizeCode : '', planEvidence?.windowCodeOrder || 'height-width');
        const rawWidth = positive(raw.explicitWidthMm) ? raw.explicitWidthMm : code?.widthMm || (positive(raw.widthMm) ? raw.widthMm : null);
        const twin = existingOpenings.filter((item) => item.page === page && family(item) === family(raw) && !matchedExistingOpenings.has(item.id))
          .map((item) => ({ item, distanceMm: Math.hypot(item.x - pixel.x, item.y - pixel.y) / scale }))
          // The same size close by is the same opening; anything of the same kind right on top of it is too.
          .filter(({ item, distanceMm }) => distanceMm <= (rawWidth && Number(item.widthMm) === rawWidth ? 2500 : Math.max(900, (Number(item.widthMm) || 0) * 0.6)))
          .sort((a, b) => a.distanceMm - b.distanceMm)[0];
        if (twin) {
          matchedExistingOpenings.add(twin.item.id);
          skip(raw, page, kind, 'This opening is already placed in the takeoff; the existing opening is kept and the AI detection is not added.');
          continue;
        }
        if (estimatorMeasured(`opening:${page}:${family(raw)}`)) {
          const room = roomLabels.filter((label) => label.page === page).map((label) => ({ label, distance: Math.hypot((label.x - raw.x) * targetPage.logicalWidth, (label.y - raw.y) * targetPage.logicalHeight) })).sort((a, b) => a.distance - b.distance)[0];
          const what = `${raw.openingClass === 'Window' ? 'window' : raw.openingClass.toLowerCase()}${rawWidth ? ` ${rawWidth} wide` : ''}${room ? ` near ${room.label.name}` : ''}`;
          hold(raw, page, kind, `A possible ${what} was not added: this sheet's openings are already placed and none matches it.`, { what });
          report(page, raw, `${what[0].toUpperCase()}${what.slice(1)}.`, 'possible-missing-openings');
          continue;
        }
        // Host wall: the wall this opening sits in, among this run's walls and those already drawn.
        const category = raw.openingClass === 'Internal Door' ? 'interior' : raw.openingClass === 'Other Opening' ? null : 'exterior';
        const hosts = [
          ...batch.detections.filter((item) => item.kind === 'wall' && item.page === page).map((host) => ({ host, batch: true })),
          ...existingWalls.filter((wall) => wall.page === page).map((wall) => ({ batch: false, host: { ...wall, nodes: wall.nodes.map((point) => ({ x: point.x / targetPage.logicalWidth, y: point.y / targetPage.logicalHeight })) } })),
        ];
        const reach = (list, reachMm = 0) => list.flatMap((candidate) => {
          try { return [{ ...candidate, ...projectOpeningToHost(raw, candidate.host, targetPage, scale, reachMm) }]; }
          catch { return []; }
        }).sort((a, b) => a.distanceMm - b.distanceMm);
        let chosen = null;
        if (raw.hostDetectionId) {
          const claimed = hosts.find((candidate) => candidate.batch && candidate.host.detectionId === `page-${page}:${raw.hostDetectionId}` && acceptedWalls.has(candidate.host.detectionId));
          chosen = claimed ? reach([claimed])[0] || null : null;
          if (!chosen) report(page, raw, claimed ? 'Opening location is too far from its claimed host wall; another wall was looked for.' : 'Opening host wall was not reliably established in this analysis; another wall was looked for.', 'host-reassigned');
        }
        if (!chosen) {
          const sameKind = hosts.filter((candidate) => !category || candidate.host.category === category);
          // A point read off a drawing is approximate: look on the wall first, then a little further out.
          const matching = reach(sameKind);
          const candidates = matching.length ? matching : [reach(hosts), reach(sameKind, 1200), reach(hosts, 1200)].find((list) => list.length) || [];
          chosen = candidates[0] || null;
          if (chosen) {
            const ambiguous = candidates[1] && candidates[1].distanceMm - chosen.distanceMm < 50;
            fields.hostWall = { basis: 'DERIVED', confidence: ambiguous || !matching.length ? Math.min(raw.confidence, 0.6) : raw.confidence,
              evidence: ambiguous ? 'Two walls meet at this opening; the nearest was used.' : `Nearest ${matching.length ? 'matching ' : ''}wall on the same calibrated page.` };
            if (ambiguous) report(page, raw, 'Two walls are equally close to this opening; it was attached to the nearest.', 'host-ambiguous');
          }
        }
        if (chosen) {
          if (chosen.batch) detection.hostDetectionId = chosen.host.detectionId; else detection.hostWallId = chosen.host.id;
          fields.location = chosen.distanceMm > 0.01
            ? { basis: 'DERIVED', confidence: raw.confidence, evidence: `Observed opening point projected ${chosen.distanceMm.toFixed(1)} mm to its nearby observed host-wall trace.` }
            : provenance;
        } else {
          // Counted regardless: an observed opening is never dropped because its wall is unclear.
          detection.unhosted = true;
          fields.hostWall = { basis: 'ASSUMED', confidence: 0, evidence: 'No wall close enough to this opening was traced; it is counted without a wall link.' };
          fields.location = provenance;
          report(page, raw, 'Opening is counted, but no nearby wall was traced to attach it to.', 'unhosted');
        }
        const tag = typeof raw.tag === 'string' ? raw.tag : '';
        const sizeCode = typeof raw.sizeCode === 'string' ? raw.sizeCode : (/^\d{4}$/.test(tag.trim()) ? tag.trim() : '');
        // Height-width shorthand applies to windows and to glazed/garage doors; a hinged door's
        // four digits are not a size code.
        const codeCapable = raw.type === 'window' || ['Large Glazed/Stacker/Sliding Door', 'Garage Door'].includes(raw.openingClass);
        const interpreted = codeCapable ? parseOpeningSizeCode(sizeCode, planEvidence?.windowCodeOrder || 'height-width') : null;
        const scheduled = findScheduleEntry({ ...raw, tag, sizeCode }, planEvidence);
        const discrepancies = [];
        const dimension = (name) => {
          const explicit = raw[`explicit${name[0].toUpperCase()}${name.slice(1)}`];
          if (positive(explicit)) {
            if (interpreted && explicit !== interpreted[name]) discrepancies.push(`${name}: explicit ${explicit} mm takes precedence over ${sizeCode} shorthand ${interpreted[name]} mm.`);
            fields[name] = { basis: 'OBSERVED', confidence: raw.confidence, evidence: raw.dimensionEvidence || raw.evidence };
            return explicit;
          }
          if (positive(scheduled?.[name])) {
            if (interpreted && scheduled[name] !== interpreted[name]) discrepancies.push(`${name}: the schedule on sheet ${scheduled.page} gives ${scheduled[name]} mm; ${sizeCode} shorthand reads ${interpreted[name]} mm. The schedule was used.`);
            fields[name] = { basis: 'OBSERVED', confidence: raw.confidence, evidence: `Window/door schedule, sheet ${scheduled.page}. ${scheduled.evidence || ''}`.trim() };
            return scheduled[name];
          }
          if (interpreted) { fields[name] = { basis: 'DERIVED', confidence: raw.confidence, evidence: `Australian height-first shorthand ${sizeCode}: first two digits ×100 mm high, final two ×100 mm wide.` }; return interpreted[name]; }
          if (positive(raw[name]) && ['OBSERVED', 'DERIVED'].includes(raw.dimensionBasis)) { fields[name] = { basis: raw.dimensionBasis, confidence: raw.confidence, evidence: raw.dimensionEvidence || raw.evidence }; return raw[name]; }
          return null;
        };
        const widthMm = dimension('widthMm');
        let heightMm = dimension('heightMm');
        if (heightMm === null && raw.type === 'door' && positive(widthMm)) {
          const convention = establishedDoorHeight(existingOpenings, raw.openingClass);
          if (positive(planEvidence?.standardDoorHeightMm) && raw.openingClass !== 'Garage Door') {
            heightMm = planEvidence.standardDoorHeightMm;
            fields.heightMm = { basis: 'DERIVED', confidence: raw.confidence, evidence: 'Door height stated elsewhere in this plan set.' };
          } else if (convention) {
            heightMm = convention;
            fields.heightMm = { basis: 'DERIVED', confidence: raw.confidence, evidence: `${convention} mm is the height of the ${raw.openingClass.toLowerCase()}s already in this takeoff.` };
          }
        }
        for (const [name, value] of [['widthMm', widthMm], ['heightMm', heightMm]]) {
          if (value !== null) continue;
          fields[name] = { basis: 'ASSUMED', confidence: 0, evidence: 'Not documented; no dimension was invented.' };
          report(page, raw, `Opening ${name} is unknown. Its observed count is included; dimension-dependent quantities require review.`, 'missing-dimension');
        }
        // Glass type (Phase 2A part 4) is documented Takeoff data, never guessed: a wet-area window
        // is never assumed Obscured without drawing notation or window-schedule evidence. Explicit
        // window-schedule text takes precedence over a plan annotation when both are given.
        const GLASS_TYPES = ['Clear', 'Obscured', 'Translucent', 'Tinted', 'Low-E', 'Laminated', 'Toughened', 'Other', 'Unspecified'];
        if (raw.glassType !== undefined && raw.glassType !== null && !GLASS_TYPES.includes(raw.glassType)) throw new Error(`Opening glassType must be one of: ${GLASS_TYPES.join(', ')}.`);
        if (raw.scheduleGlassType !== undefined && raw.scheduleGlassType !== null && !GLASS_TYPES.includes(raw.scheduleGlassType)) throw new Error(`Opening scheduleGlassType must be one of: ${GLASS_TYPES.join(', ')}.`);
        const listed = (value) => (typeof value === 'string' && GLASS_TYPES.includes(value) && value !== 'Unspecified' ? value : '');
        const documentedGlassType = listed(raw.scheduleGlassType) || listed(scheduled?.glassType);
        const planGlassType = listed(raw.glassType);
        const glassType = documentedGlassType || planGlassType;
        if (documentedGlassType && planGlassType && documentedGlassType !== planGlassType) report(page, raw, `Glass type: window schedule states ${documentedGlassType}, plan annotation suggests ${planGlassType}; the documented schedule value was used.`, 'dimension-conflict');
        fields.glassType = glassType ? provenance : { basis: 'ASSUMED', confidence: 0, evidence: 'Glass type is not documented on the drawing or window schedule.' };
        // The room an opening belongs to: the nearest room name lettered on the same sheet.
        const nearestRoom = roomLabels.filter((room) => room.page === page)
          .map((room) => ({ room, distanceMm: Math.hypot((room.x - raw.x) * targetPage.logicalWidth, (room.y - raw.y) * targetPage.logicalHeight) / scale }))
          .sort((a, b) => a.distanceMm - b.distanceMm)[0];
        const location = nearestRoom && nearestRoom.distanceMm <= 4500 ? nearestRoom.room.name : '';
        Object.assign(detection, {
          x: chosen ? chosen.x : raw.x, y: chosen ? chosen.y : raw.y, type: raw.type, openingClass: raw.openingClass, widthMm, heightMm,
          itemTag: tag || sizeCode || raw.detectionId, subType: resolveOpeningSubType({ ...raw, tag, sizeCode }), glassType,
          ...(location ? { location } : {}),
        });
        detection.analysisEvidence = { ...provenance, fields, originalTag: tag, rawSizeCode: sizeCode, discrepancies };
        discrepancies.forEach((message) => report(page, raw, message, 'dimension-conflict'));
      } else if (kind === 'pillar') {
        // A pillar/post/column is a discrete vertical object, never folded into a wall or area
        // detection - its own kind, own canonical fields, admitted through the same adapter as
        // every other detection for final geometry/relationship validation.
        Object.assign(detection, {
          nodes: raw.nodes,
          coreType: raw.coreType,
          coreWidthMm: raw.coreWidthMm ?? null, coreDepthMm: raw.coreDepthMm ?? null,
          ...(raw.coreType === 'steel' && raw.steelSectionType ? { steelSectionType: raw.steelSectionType } : {}),
          ...(raw.coreType === 'steel' && raw.steelSectionDesignation ? { steelSectionDesignation: raw.steelSectionDesignation } : {}),
          ...(raw.coreType === 'timber' && raw.timberSizeOption ? { timberSizeOption: raw.timberSizeOption } : {}),
          ...(raw.coreType === 'brick' && raw.brickFinish ? { brickFinish: raw.brickFinish } : {}),
          ...(raw.coreType === 'custom' && raw.coreCustomLabel ? { coreCustomLabel: raw.coreCustomLabel } : {}),
          surroundType: raw.surroundType || 'none',
          ...(raw.surroundType && raw.surroundType !== 'none' ? { surroundWidthMm: raw.surroundWidthMm ?? null, surroundDepthMm: raw.surroundDepthMm ?? null } : {}),
          ...(raw.surroundType === 'custom' && raw.surroundCustomLabel ? { surroundCustomLabel: raw.surroundCustomLabel } : {}),
          heightMm: raw.heightMm ?? null,
          quantity: raw.quantity || 1,
          location: raw.location || '',
        });
        detection.analysisEvidence = { ...provenance, fields };
      } else if (kind === 'eave') {
        if (estimatorMeasured(`eave:${page}`)) { hold(raw, page, kind, 'An eave run was not added: the eaves on this sheet are already measured.'); continue; }
        let widthMm = raw.widthMm ?? null;
        if (!positive(widthMm)) {
          // The eave width is usually shown once, on an elevation or section, or set in Job Setup.
          const drawn = planEvidence?.eaveWidthMm, setup = projectDefaults?.eaveWidthMm;
          if (positive(drawn) || positive(setup)) {
            widthMm = positive(drawn) ? drawn : setup;
            fields.widthMm = positive(drawn) ? { basis: 'DERIVED', confidence: raw.confidence, evidence: 'Eave width read from the other sheets of this plan set.' }
              : { basis: 'ASSUMED', confidence: 0, evidence: 'Eave width taken from the Job Setup default.' };
          } else report(page, raw, 'Eave length is measured; its undocumented width needs confirmation before calculating area.', 'missing-dimension');
        }
        Object.assign(detection, { nodes: raw.nodes, widthMm, analysisEvidence: { ...provenance, fields } });
      } else if (raw.type === 'Roof Area') {
        Object.assign(detection, { kind: 'area', category: 'Roof Area', nodes: raw.nodes, analysisEvidence: { ...provenance, fields } });
      } else {
        if (!AREA_TYPES.includes(raw.type)) throw new Error('Named room or unsupported area category is retained as metadata, not an aggregate floor polygon.');
        const sameDrawing = (item) => item.page === page && (item.existing || item.level === level);
        if (raw.type === 'Living' && acceptedAreas.some((item) => sameDrawing(item) && item.type === 'Footprint')) throw new Error('Living outline is retained as metadata because the accepted Footprint and ancillary areas already determine living area.');
        const clash = acceptedAreas.find((item) => sameDrawing(item) && (item.type === 'Footprint') === (raw.type === 'Footprint') && overlaps(item.nodes, raw.nodes));
        if (clash?.existing) { skip(raw, page, kind, `${raw.label || raw.type} is already measured in the takeoff; the existing area is kept and the AI outline is not added.`); continue; }
        if (clash) throw new Error('Overlapping aggregate floor polygons are withheld to prevent double-counting; existing manual polygons are preserved.');
        Object.assign(detection, { type: raw.type, label: raw.label || raw.type, nodes: raw.nodes });
        fields.areaM2 = { basis: 'DERIVED', confidence: raw.confidence, evidence: 'Existing Takeoff polygon-area calculation and confirmed calibration.' };
        detection.analysisEvidence = { ...provenance, fields };
      }
      // Reuse the proven adapter for final geometry and relationship admission.
      convertAiTakeoffDetections({ ...batch, detections: [...batch.detections, detection] }, context);
      batch.detections.push(detection);
      if (detection.kind === 'floorplan') acceptedAreas.push({ ...raw, page, level });
    } catch (error) { analysis.unresolved.push({ ...metadataOnly(raw), page, kind }); report(page, raw, error.message, 'withheld'); }
  }
  // Where the estimator's trace is kept, a clearly longer AI measurement is worth one look.
  for (const [key, existingMm] of measured) {
    const [kind, page, category] = key.split(':');
    if (kind !== 'wall' || !estimatorMeasured(key)) continue;
    const openMm = analysis.openEdges.filter((item) => item.page === Number(page)).reduce((sum, item) => sum + item.lengthM * 1000, 0);
    const foundMm = (found.get(key) || 0) - (category === 'exterior' ? openMm : 0);
    if (foundMm > existingMm * 1.15) report(Number(page), null, `The plan reads as about ${(foundMm / 1000).toFixed(1)} lm of ${category} wall; ${(existingMm / 1000).toFixed(1)} lm is traced. Check the sheet for a wall not yet traced.`, 'possible-missing-walls');
  }
  const canonical = convertAiTakeoffDetections(batch, context);
  analysis.counts = { walls: canonical.completedWallRuns.length, windows: canonical.placedOpenings.filter((item) => item.type === 'window').length, doors: canonical.placedOpenings.filter((item) => item.type === 'door').length, floorAreas: canonical.completedFloorplans.length, roofAreas: canonical.completedAreas.length, eaves: canonical.completedEaves.length, pillars: canonical.completedPillars.reduce((sum, item) => sum + item.quantity, 0), rooms: analysis.rooms.length, fixtures: analysis.fixtures.reduce((total, item) => total + item.quantity, 0), alreadyMeasured: analysis.alreadyMeasured.length, notAdded: analysis.notAdded.length, review: analysis.review.length };
  // Every floor polygon now in the takeoff - this run's and the estimator's own - with its level.
  const sheetLevels = context.sheetLevels || {};
  const levelFor = (item) => {
    const own = normaliseLevel(item.level);
    if (own !== 'Unassigned') return own;
    return levelOfPage.get(item.page) && levelOfPage.get(item.page) !== 'Unassigned' ? levelOfPage.get(item.page) : normaliseLevel(sheetLevels[item.page]);
  };
  const floorPolygons = [
    ...canonical.completedFloorplans,
    ...(context.completedFloorplans || []).filter((item) => Array.isArray(item.nodes) && item.nodes.length >= 3).map((item) => ({ ...item, page: Number(item.page || item.pageId || 1) })),
  ].map((item) => ({ ...item, level: levelFor(item) }));
  const allWalls = [...canonical.completedWallRuns, ...existingWalls];
  const allOpenings = [...canonical.placedOpenings, ...existingOpenings];
  // Benchmarks compare printed quantities to the same adapter/helper results; no
  // provider total is substituted for the editable canonical geometry.
  const seenBenchmarks = new Set();
  for (const item of analysis.documentedQuantities) {
    const label = String(item.label || '').toLowerCase();
    const areaUnit = isAreaUnit(item.unit);
    const unit = areaUnit ? 'm2' : String(item.unit || '').toLowerCase().replace('²', '2');
    // An area table is printed on every floor-plan sheet; the same line is one benchmark, not two.
    const signature = `${normalizeLabel(item.label)}|${item.value}|${unit}`;
    if (areaUnit && seenBenchmarks.has(signature)) continue;
    seenBenchmarks.add(signature);
    let measured = null;
    let comparisonNote = null;
    if (['lm', 'm'].includes(unit) && /wall/.test(label)) {
      const category = /external|exterior/.test(label) ? 'exterior' : /internal|interior/.test(label) ? 'interior' : null;
      if (category) measured = allWalls.filter((wall) => wall.page === item.page && wall.category === category).reduce((sum, wall) => sum + (Number(wall.lengthMm) || 0) / 1000, 0);
    } else if (unit === 'm2') {
      // The label names its own storey ("GND FL LIVING AREA"); the sheet it is printed on does not.
      const namedLevel = levelFromAreaLabel(item.label);
      const wholeBuilding = !namedLevel && /^total( building| floor)? area$/.test(normalizeLabel(item.label));
      const onSheet = floorPolygons.filter((area) => area.page === item.page);
      let polygons = namedLevel ? floorPolygons.filter((area) => area.level === namedLevel) : wholeBuilding ? floorPolygons : onSheet;
      let matching = matchAreaBenchmark(item.label, polygons);
      // An area table lists the whole house: "BALCONY AREA" printed on the ground-floor sheet
      // still means the balcony upstairs.
      if (!namedLevel && !wholeBuilding && matching.type && !['Living', 'Footprint'].includes(matching.type) && !matching.polygons.length && !matching.reason) {
        polygons = floorPolygons;
        matching = matchAreaBenchmark(item.label, polygons);
      }
      const { type } = matching;
      comparisonNote = matching.reason;
      if (type) {
        const sum = (items) => items.reduce((total, area) => total + calculatePolygonAreaM2(area.nodes, context.pixelsPerMm), 0);
        measured = comparisonNote ? null : type === 'Living' && !polygons.some((area) => area.type === 'Living') && polygons.some((area) => area.type === 'Footprint')
          ? Math.max(0, sum(polygons.filter((area) => area.type === 'Footprint')) - sum(polygons.filter((area) => !['Footprint', 'Living'].includes(area.type))))
          : matching.polygons.length ? sum(matching.polygons) : null;
        // A clearly printed area is kept by level, so a level with no traced outline still has its figure.
        const matchedLevels = [...new Set(matching.polygons.map((area) => area.level))];
        const areaLevel = namedLevel || (matchedLevels.length === 1 ? matchedLevels[0] : type === 'Living' ? levelFor(item) : null);
        if (areaLevel && areaLevel !== 'Unassigned' && type !== 'Footprint' && item.confidence >= 0.9) analysis.documentedAreas.push({ level: areaLevel, type, valueM2: item.value, label: item.label, page: item.page, measured });
      }
    } else if (['count', 'each', 'no'].includes(unit) && /window|door/.test(label)) {
      measured = allOpenings.filter((opening) => opening.page === item.page && opening.type === (/window/.test(label) ? 'window' : 'door')).length;
    }
    if (comparisonNote) report(item.page, item, comparisonNote, 'benchmark-scope');
    const difference = measured === null ? null : measured - item.value;
    const tolerance = ['count', 'each', 'no'].includes(unit) ? 0 : Math.max(unit === 'm2' ? 0.5 : 0.1, item.value * 0.03);
    if (difference !== null && Math.abs(difference) > tolerance) {
      report(item.page, item, `Geometry for ${item.label} measures ${measured.toFixed(2)} ${item.unit}; the drawing documents ${item.value} ${item.unit} (${(Math.abs(difference) / item.value * 100).toFixed(1)}% difference). Review measurement scope and calibration.`, 'benchmark-discrepancy');
    }
    analysis.benchmarks.push({ ...item, measured, measuredBasis: measured === null ? null : 'DERIVED', difference, ...(comparisonNote ? { comparisonNote } : {}) });
  }
  for (const conflict of planEvidence?.conflicts || []) report(undefined, null, conflict, 'evidence-conflict');
  analysis.counts.review = analysis.review.length;
  return { batch, analysis };
}
