// Builder corrections as training examples for a future locally trained geometry classifier.
//
// Rules this module keeps:
//  - Opt-in. Nothing is captured unless the takeoff is run with trainingCapture === true (a builder
//    setting); the default is off.
//  - Builder-owned and job-scoped. Examples live inside that job's own takeoff report (the builder's
//    storage, under its tenant and job), carry the job, takeoff and plan identity, and are never sent
//    anywhere by this code. They leave the job only through exportTrainingExamples, an explicit action
//    that refuses examples belonging to another job or plan.
//  - Minimal. An example keeps the decided element's geometry, the linework within a small radius of it
//    (coordinates in mm relative to the element, no page image, no text), the builder's decision and the
//    detector version. It is enough to learn from and not a copy of the plan.
export const TRAINING_SCHEMA = 'gr8-takeoff-training-example/1';
export const CONTEXT_RADIUS_MM = 1500;
export const MAX_EXAMPLES_PER_REPORT = 2000;
const MAX_CONTEXT_SEGMENTS = 400;

const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

// The detected element a decision names: a wall pair (linework:vw-N) or a structure (linework:vs-N).
export function decidedElement(detected, detectionKey) {
  const id = String(detectionKey || '').replace(/^linework(?:-bridge)?:/, '');
  const wall = (detected?.walls || []).find((w) => w.id === id);
  if (wall) return { kind: 'wall-pair', id, nodes: wall.nodes, thicknessMm: wall.measuredThicknessMm ?? wall.thicknessMm ?? null, quantityReview: wall.quantityReview || null, classification: wall.classification?.element || null };
  const structure = (detected?.structures || []).find((s, i) => s.id === id || `vs-${i}` === id);
  if (structure) return { kind: 'structure', id, nodes: structure.nodes, thicknessMm: structure.thicknessMm ?? null, classification: structure.element || null, label: structure.label || null };
  return null;
}

export function buildTrainingExample({ identity, page, pixelsPerMm, detected, detectionKey, decision, segments = [], decidedAt = new Date().toISOString(), detectorVersion }) {
  if (!['interior', 'exterior', 'reject'].includes(decision)) throw new Error('A training example needs a builder decision: interior, exterior or reject.');
  if (!identity?.jobId || !identity?.documentHash) throw new Error('A training example must carry its job and plan identity.');
  if (!(pixelsPerMm > 0)) throw new Error('A training example needs the sheet calibration.');
  const element = decidedElement(detected, detectionKey);
  if (!element || element.nodes?.length < 2) return null;
  const [a, b] = element.nodes;
  const origin = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const angle = Math.atan2(b.y - a.y, b.x - a.x), cos = Math.cos(-angle), sin = Math.sin(-angle);
  // Element frame: x along the element, y across it, millimetres.
  const local = (p) => { const dx = (p.x - origin.x) / pixelsPerMm, dy = (p.y - origin.y) / pixelsPerMm; return { x: round(dx * cos - dy * sin), y: round(dx * sin + dy * cos) }; };
  const halfLength = Math.hypot(b.x - a.x, b.y - a.y) / 2 / pixelsPerMm;
  const reach = halfLength + CONTEXT_RADIUS_MM;
  const context = [];
  for (const s of segments) {
    const p = local({ x: s.x1, y: s.y1 }), q = local({ x: s.x2, y: s.y2 });
    if (Math.min(Math.abs(p.x), Math.abs(q.x)) > reach && Math.sign(p.x) === Math.sign(q.x)) continue;
    if (Math.min(Math.abs(p.y), Math.abs(q.y)) > CONTEXT_RADIUS_MM && Math.sign(p.y) === Math.sign(q.y)) continue;
    context.push([p.x, p.y, q.x, q.y, round(s.widthPx || 0, 2), s.paint === 'fill' ? 'f' : 's', s.color || '#000000', s.dashed ? 1 : 0]);
    if (context.length >= MAX_CONTEXT_SEGMENTS) break;
  }
  return {
    schema: TRAINING_SCHEMA,
    id: `${identity.documentHash}:${page}:${detectionKey}`,
    owner: { jobId: identity.jobId, takeoffId: identity.takeoffId || null, documentHash: identity.documentHash, page },
    detector: { version: detectorVersion || detected?.engine || 'unknown', classifier: detected?.stats?.classifier ? 'element-classifier-1' : null, printedLabels: detected?.stats?.printedLabels ? 'printed-labels-1' : null },
    element: { kind: element.kind, detectionKey, lengthMm: round(halfLength * 2, 0), thicknessMm: element.thicknessMm, detectorReading: element.classification || 'wall', quantityReview: element.quantityReview || null, label: element.label || null },
    context: { radiusMm: CONTEXT_RADIUS_MM, frame: 'element-local mm, x along the element', segmentFields: ['x1', 'y1', 'x2', 'y2', 'penPt', 'paint', 'colour', 'dashed'], segments: context, truncated: context.length >= MAX_CONTEXT_SEGMENTS },
    label: { decision, isWall: decision !== 'reject', source: 'builder-review', decidedAt },
  };
}

// Adds an example to a job's report store, replacing an earlier decision on the same element.
export function addTrainingExample(store = [], example, limit = MAX_EXAMPLES_PER_REPORT) {
  if (!example) return store;
  return [...store.filter((item) => item.id !== example.id), example].slice(-limit);
}

// The explicit export: only this job's (and, when given, this plan's) examples, in a self-describing file.
export function exportTrainingExamples(report, { jobId, documentHash } = {}) {
  if (!jobId) throw new Error('Choose the job whose training examples to export.');
  const examples = (report?.trainingExamples || []).filter((item) => item.owner?.jobId === jobId && (!documentHash || item.owner.documentHash === documentHash));
  const foreign = (report?.trainingExamples || []).length - examples.length;
  return { schema: TRAINING_SCHEMA, exportedAt: new Date().toISOString(), jobId, documentHash: documentHash || null, count: examples.length, excludedFromOtherJobsOrPlans: foreign, examples };
}
