// Mandatory wall check: walls read from the drawing need the builder's per-sheet confirmation before
// takeoff quantities are applied. Hand-drawn walls do not. A confirmation covers the walls it saw: a wall
// detected later reopens it, a wall deleted after it does not. Job Setup refuses to import while open.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTakeoffReview } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/reviewSummary.js';

const wall = (id, page, source = 'ai', quantity = 3.684) => ({ id, page, kind: 'wall', source, category: 'interior', level: 'Upper Floor', quantity, unit: 'lm', classificationStatus: 'classified' });
const records = [wall('w1', 4), wall('w2', 4), wall('w3', 5), wall('hand-1', 6, 'manual')];
const checks = (review) => review.decisions.filter((d) => d.topic === 'wall-check');

let review = buildTakeoffReview({ records, analysis: {} });
assert.deepEqual(checks(review).map((d) => d.pages[0]), [4, 5], 'one required check per sheet with detected walls; none for hand-drawn walls');
const sheet4 = checks(review)[0];
assert.equal(sheet4.action.type, 'acknowledge');
assert.deepEqual(sheet4.wallIds, ['w1', 'w2']);
assert.match(sheet4.detail, /not reliably told apart automatically/, 'the limitation is stated, not hidden');
assert.match(sheet4.detail, /delete anything that is not a wall/i);

// Confirmed with the walls it covered (as useAiTakeoffAnalysis.resolveDecision stores it).
const resolvedDecisions = { 'wall-check:4': { resolvedAt: '2026-11-05T00:00:00Z', wallIds: ['w1', 'w2'] } };
review = buildTakeoffReview({ records, analysis: { resolvedDecisions } });
assert.deepEqual(checks(review).map((d) => d.pages[0]), [5], 'confirmed sheet no longer required');
review = buildTakeoffReview({ records: records.filter((r) => r.id !== 'w2'), analysis: { resolvedDecisions } });
assert.deepEqual(checks(review).map((d) => d.pages[0]), [5], 'deleting a wall after the check keeps it confirmed');
review = buildTakeoffReview({ records: [...records, wall('w9', 4)], analysis: { resolvedDecisions } });
assert.deepEqual(checks(review).map((d) => d.pages[0]), [4, 5], 'a newly detected wall reopens the check for its sheet');
review = buildTakeoffReview({ records, analysis: { resolvedDecisions: { ...resolvedDecisions, 'wall-check:5': { resolvedAt: 'x', wallIds: ['w3'] } } } });
assert.equal(checks(review).length, 0, 'all sheets checked: nothing required');

// Wiring: the decision stores its wall list; reruns keep decisions; Job Setup blocks import while open;
// the Takeoff header does not say complete while decisions remain.
const hook = fs.readFileSync('components/construction-estimation/ai-plan-takeoff/ai-integration/useAiTakeoffAnalysis.js', 'utf8');
assert.match(hook, /wallIds: decision\.wallIds\.map\(String\)/);
assert.match(hook, /completed\.resolvedDecisions = reportRef\.current\.resolvedDecisions/);
assert.match(hook, /resolvedDecisions: saved\.resolvedDecisions/);
const setup = fs.readFileSync('components/estimate-builder/JobSetupTakeoffImport.jsx', 'utf8');
assert.match(setup, /decision\.topic === "wall-check"/);
assert.match(setup, /disabled=\{!selectedKeys\.length \|\| busy \|\| Boolean\(importBlocked\)\}/);
const action = fs.readFileSync('components/construction-estimation/ai-plan-takeoff/ai-integration/AiTakeoffAction.jsx', 'utf8');
assert.match(action, /report\.status === 'review' \|\| review\.decisions\.length \? 'AI TAKEOFF REQUIRES REVIEW'/);
console.log('Wall check: required per sheet of detected walls, explicit limitation, covered-wall tracking, rerun preservation, Job Setup import blocked while open.');
