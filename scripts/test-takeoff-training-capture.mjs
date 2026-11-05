// Builder corrections captured as training examples: opt-in data shape, element-local context only,
// job/plan ownership, replacement of a changed decision, and an export that never mixes jobs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTrainingExample, addTrainingExample, exportTrainingExamples, decidedElement, TRAINING_SCHEMA } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/trainingCapture.js';

const ppm = 0.05;
const detected = { engine: 'vector-walls-3', stats: { classifier: {} },
  walls: [{ id: 'vw-13', nodes: [{ x: 100, y: 100 }, { x: 100 + 3684 * ppm, y: 100 }], measuredThicknessMm: 72 }],
  structures: [{ element: 'retaining', nodes: [{ x: 0, y: 0 }, { x: 0, y: 400 }], thicknessMm: 190, label: '190 Series Block Retaining Wall' }] };
const near = { x1: 120, y1: 102, x2: 120, y2: 135, widthPx: 0.24, paint: 'stroke', color: '#000000' };
const far = { x1: 900, y1: 900, x2: 950, y2: 900, widthPx: 0.72, paint: 'stroke', color: '#000000' };
const identity = { jobId: 'job-a', takeoffId: 'tk-1', documentHash: 'doc-1' };
const example = buildTrainingExample({ identity, page: 4, pixelsPerMm: ppm, detected, detectionKey: 'linework:vw-13', decision: 'reject', segments: [near, far], decidedAt: '2026-11-04T00:00:00Z' });
assert.equal(example.schema, TRAINING_SCHEMA);
assert.deepEqual(example.owner, { jobId: 'job-a', takeoffId: 'tk-1', documentHash: 'doc-1', page: 4 });
assert.deepEqual(example.label, { decision: 'reject', isWall: false, source: 'builder-review', decidedAt: '2026-11-04T00:00:00Z' });
assert.equal(example.element.kind, 'wall-pair'); assert.equal(example.element.lengthMm, 3684); assert.equal(example.element.thicknessMm, 72);
assert.equal(example.detector.version, 'vector-walls-3');
assert.equal(example.context.segments.length, 1, 'only the linework near the element is kept');
const [x1, y1] = example.context.segments[0];
assert.ok(Math.abs(x1 - (-1442)) < 2 && Math.abs(y1 - 40) < 2, `element-local millimetres (${x1}, ${y1})`);
assert.ok(!JSON.stringify(example).includes('dataUrl') && !('text' in example.context), 'no page image and no text are copied');
assert.equal(decidedElement(detected, 'linework:vs-0').kind, 'structure', 'a structure is identified by its review key');
assert.equal(buildTrainingExample({ identity, page: 4, pixelsPerMm: ppm, detected, detectionKey: 'linework:vw-99', decision: 'reject' }), null, 'an element no longer detected is not captured');
assert.throws(() => buildTrainingExample({ identity: { documentHash: 'doc-1' }, page: 4, pixelsPerMm: ppm, detected, detectionKey: 'linework:vw-13', decision: 'reject' }), /job/);
assert.throws(() => buildTrainingExample({ identity, page: 4, pixelsPerMm: ppm, detected, detectionKey: 'linework:vw-13', decision: 'maybe' }), /decision/);

// A changed decision replaces the earlier one; examples of another job are never exported with this one.
let store = addTrainingExample([], example);
store = addTrainingExample(store, { ...example, label: { ...example.label, decision: 'interior', isWall: true } });
assert.equal(store.length, 1); assert.equal(store[0].label.decision, 'interior');
const other = { ...example, id: 'doc-9:1:linework:vw-1', owner: { ...example.owner, jobId: 'job-b', documentHash: 'doc-9' } };
const out = exportTrainingExamples({ trainingExamples: [...store, other] }, { jobId: 'job-a' });
assert.equal(out.count, 1); assert.equal(out.excludedFromOtherJobsOrPlans, 1); assert.ok(out.examples.every((e) => e.owner.jobId === 'job-a'));
assert.throws(() => exportTrainingExamples({ trainingExamples: store }, {}), /job/);

// The app captures only when the builder has turned it on, and keeps it in the job's own report.
const hook = fs.readFileSync('components/construction-estimation/ai-plan-takeoff/ai-integration/useAiTakeoffAnalysis.js', 'utf8');
assert.match(hook, /wallDecision && latest\.current\.trainingCapture === true/);
assert.ok(!/fetch\(|sendBeacon|XMLHttpRequest/.test(fs.readFileSync('components/construction-estimation/ai-plan-takeoff/ai-integration/trainingCapture.js', 'utf8')), 'the capture module makes no network calls');
console.log('Training capture: opt-in, element-local context, job/plan ownership, decision replacement and job-scoped export passed.');
