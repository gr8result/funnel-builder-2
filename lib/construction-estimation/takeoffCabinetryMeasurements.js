// Calibrated plan measurements -> cabinetry requirements (benchtops and MDF bulkheads).
//
// A takeoff measurement ({ id, page, p1, p2 } or a polyline `nodes`) may carry a `cabinetry` tag:
//   { kind: 'benchtop' | 'bulkhead', room, areaId, label, depthMm, bulkheadType, status,
//     calibration: { pixelsPerMm }, source: 'manual' | 'ai', confidence }
// The length is ALWAYS computed from the geometry and the sheet's calibration; a typed or detected
// length is never trusted. Only APPROVED, calibrated, fully specified runs become quantities. Every
// other run is returned as an issue so it stays visible in the quotation reconciliation.
export const CABINETRY_MEASUREMENT_KINDS = Object.freeze(['benchtop', 'bulkhead']);
export const MEASUREMENT_REVIEW = Object.freeze({ PENDING: 'PENDING_REVIEW', APPROVED: 'APPROVED', REJECTED: 'REJECTED' });
export const BULKHEAD_TYPES = Object.freeze([
  { key: 'bulkhead_300', label: 'MDF bulkhead 300mm' },
  { key: 'bulkhead_450', label: 'MDF bulkhead 450mm' },
]);
export const BENCHTOP_DEPTHS_MM = Object.freeze([600, 900, 1200]);

const CALIBRATION_TOLERANCE = 0.005;
const text = value => String(value ?? '').trim();
const finite = value => Number.isFinite(Number(value)) && value !== '' && value !== null;
const slug = value => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const roundLm = mm => Math.round(mm / 10) / 100;

export function measurementPoints(measurement = {}) {
  const nodes = Array.isArray(measurement.nodes) ? measurement.nodes : [measurement.p1, measurement.p2];
  return nodes.filter(point => point && finite(point.x) && finite(point.y)).map(point => ({ x: Number(point.x), y: Number(point.y) }));
}

export function measurementPage(measurement = {}) {
  return Number(measurement.page ?? measurement.pageId) || 1;
}

// The calibration of the sheet the run sits on: the sheet's own, else the job's.
export function sheetPixelsPerMm(job = {}, page = 1) {
  const own = job.scheduleState?.sheetCalibrations?.[page];
  const value = Number(own?.pixelsPerMm ?? own ?? job.pixelsPerMm);
  return value > 0 ? value : null;
}

export function measurementLengthMm(measurement, pixelsPerMm) {
  const points = measurementPoints(measurement);
  if (points.length < 2 || !(pixelsPerMm > 0)) return 0;
  let px = 0;
  for (let index = 1; index < points.length; index += 1) px += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  return Math.round(px / pixelsPerMm);
}

// What stops a tagged run becoming a quantity. Empty = ready.
export function cabinetryMeasurementIssues(measurement, job = {}) {
  const tag = measurement?.cabinetry;
  if (!tag) return [];
  const issues = [];
  const pixelsPerMm = sheetPixelsPerMm(job, measurementPage(measurement));
  if (!CABINETRY_MEASUREMENT_KINDS.includes(tag.kind)) issues.push('Choose benchtop or bulkhead');
  if (!text(tag.room)) issues.push('Choose the room');
  if (!pixelsPerMm) issues.push('Calibrate this sheet');
  else if (tag.calibration?.pixelsPerMm && Math.abs(tag.calibration.pixelsPerMm - pixelsPerMm) / pixelsPerMm > CALIBRATION_TOLERANCE) issues.push('Calibration changed since this run was reviewed');
  if (pixelsPerMm && !(measurementLengthMm(measurement, pixelsPerMm) > 0)) issues.push('Run has no length');
  if (tag.kind === 'benchtop' && !(Number(tag.depthMm) > 0)) issues.push('Choose the benchtop depth');
  if (tag.kind === 'bulkhead' && !BULKHEAD_TYPES.some(type => type.key === tag.bulkheadType)) issues.push('Choose the bulkhead size');
  return issues;
}

// Tag a measurement for review. Approval records the calibration it was approved against.
export function tagCabinetryMeasurement(measurement, patch = {}, job = {}, now = new Date().toISOString()) {
  const previous = measurement.cabinetry || {};
  const next = { source: 'manual', ...previous, ...patch };
  const geometryOrMeaningChanged = ['kind', 'room', 'areaId', 'depthMm', 'bulkheadType'].some(key => key in patch && patch[key] !== previous[key]);
  if (geometryOrMeaningChanged && patch.status === undefined) next.status = MEASUREMENT_REVIEW.PENDING;
  if (!next.status) next.status = MEASUREMENT_REVIEW.PENDING;
  const candidate = { ...measurement, cabinetry: next };
  if (next.status === MEASUREMENT_REVIEW.APPROVED) {
    const pixelsPerMm = sheetPixelsPerMm(job, measurementPage(measurement));
    const issues = cabinetryMeasurementIssues({ ...candidate, cabinetry: { ...next, calibration: undefined } }, job);
    if (issues.length) return { ...measurement, cabinetry: { ...next, status: MEASUREMENT_REVIEW.PENDING, approvalBlocked: issues } };
    return { ...measurement, cabinetry: { ...next, calibration: { pixelsPerMm }, approvedAt: now, approvalBlocked: undefined } };
  }
  return { ...candidate, cabinetry: { ...next, approvalBlocked: undefined } };
}

// Detections from the AI path are suggestions: always pending, never approved, geometry only.
export function cabinetryMeasurementsFromDetections(detections = [], { page, idPrefix = 'ai-cabinetry' } = {}) {
  return detections.filter(item => item && ['benchtop', 'bulkhead'].includes(item.kind) && Array.isArray(item.nodes) && item.nodes.length >= 2).map((item, index) => ({
    id: `${idPrefix}:${text(item.detectionId) || index}`, page: Number(item.page ?? page) || 1, nodes: item.nodes.map(point => ({ x: Number(point.x), y: Number(point.y) })), offset: { x: 0, y: 0 },
    cabinetry: { kind: item.kind, room: text(item.room), areaId: slug(item.areaId || item.label), label: text(item.label), depthMm: finite(item.depthMm) ? Number(item.depthMm) : '', bulkheadType: text(item.bulkheadType),
      status: MEASUREMENT_REVIEW.PENDING, source: 'ai', confidence: finite(item.confidence) ? Number(item.confidence) : null },
  }));
}

// Requirement items for the cabinetry engine (shape of collectCabinetryRequirements' explicit items).
export function cabinetryRequirementsFromTakeoff(job = {}) {
  const groups = new Map();
  for (const measurement of Array.isArray(job.completedMeasurements) ? job.completedMeasurements : []) {
    const tag = measurement?.cabinetry;
    if (!tag || tag.status === MEASUREMENT_REVIEW.REJECTED) continue;
    const page = measurementPage(measurement);
    const roomKey = slug(tag.room) || 'unassigned';
    const areaId = slug(tag.areaId || tag.label) || (tag.kind === 'bulkhead' ? 'bulkhead' : 'benchtop-main');
    const type = tag.kind === 'benchtop' ? (Number(tag.depthMm) > 0 ? `benchtop_${Number(tag.depthMm)}` : 'benchtop') : tag.kind === 'bulkhead' ? (tag.bulkheadType || 'bulkhead') : '';
    const key = [tag.kind, roomKey, areaId, type].join('\u0000');
    const group = groups.get(key) || { tag, roomKey, areaId, type, runs: [], pending: new Set(), approvedRuns: 0 };
    const issues = cabinetryMeasurementIssues(measurement, job);
    const approved = tag.status === MEASUREMENT_REVIEW.APPROVED;
    if (!approved) group.pending.add('Takeoff measurement awaiting review');
    for (const issue of issues) group.pending.add(issue);
    const mm = measurementLengthMm(measurement, sheetPixelsPerMm(job, page));
    if (approved && !issues.length) { group.runs.push({ id: measurement.id, page, mm }); group.approvedRuns += 1; }
    groups.set(key, group);
  }
  const items = [];
  for (const group of groups.values()) {
    const { tag } = group;
    const label = text(tag.label) || (tag.kind === 'bulkhead' ? 'MDF bulkhead' : 'Benchtop');
    const lengthMm = group.runs.reduce((total, run) => total + run.mm, 0);
    const lm = roundLm(lengthMm);
    const base = { id: `takeoff-${tag.kind}:${group.roomKey}:${group.areaId}:${group.type}`, room: text(tag.room), type: group.type, source: 'TAKEOFF', legacyLabel: label, areaId: group.areaId,
      planReference: [...new Set(group.runs.map(run => `Sheet ${run.page}`))].join(', ') };
    if (group.pending.size) {
      items.push({ ...base, id: `${base.id}:review`, quantity: 0, issue: [...group.pending].join('; '), issueFlag: 'MEASUREMENT REQUIRED', action: { kind: 'review-takeoff-measurement', label: `Review the ${label.toLowerCase()} measurement in AI Plan Takeoff` } });
    }
    if (lm > 0) items.push({ ...base, quantity: lm, lengthLm: lm, basis: `${group.runs.length} measured run${group.runs.length === 1 ? '' : 's'}: ${group.runs.map(run => `${run.mm}mm`).join(' + ')} (calibrated plan geometry)` });
  }
  return items;
}
