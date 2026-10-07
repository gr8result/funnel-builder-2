// Renders the two screens a builder reviews an AI takeoff on - the takeoff panel and the Job Setup
// import - and checks they show a short summary, actionable review items and collapsed diagnostics,
// never the raw diagnostic dump. Run with both loaders:
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-takeoff-review-screens.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { transform } from 'sucrase';
import { normalizePlanAnalysis } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisContract.js';
import { convertAiTakeoffDetections } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/adapter.js';
import { applyReviewDecision } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/reviewSummary.js';
import { createTakeoffSchedule } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { V4_DATA_SECTIONS } from '../lib/construction-estimation/estimateWorksheetV4Schema.js';

const dom = new JSDOM('<div id="root"></div>', { url: 'https://takeoff-unit.invalid/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The components are JSX; compile a temporary copy beside each source so their imports resolve.
const compiled = [];
async function load(source) {
  const target = new URL(source.replace(/\.jsx$/, '.review-screen-test.mjs'), import.meta.url);
  fs.writeFileSync(target, transform(fs.readFileSync(new URL(source, import.meta.url), 'utf8'), { transforms: ['jsx'], jsxRuntime: 'automatic', production: true }).code);
  compiled.push(target);
  return import(target.href);
}

const observed = { basis: 'OBSERVED', confidence: 0.95, evidence: 'Printed on the drawing.' };
const context = { jobId: 'job', takeoffId: 'takeoff', documentHash: 'hash', pixelsPerMm: 0.1, pages: [{ pageNumber: 1, logicalWidth: 1000, logicalHeight: 800 }], completedWallRuns: [], placedOpenings: [], completedFloorplans: [] };
const wall = (id, category, nodes) => ({ detectionId: id, category, nodes, thicknessMm: null, wallHeightM: null, exteriorType: 'Other', constructionSystem: 'unclassified', frameThicknessMm: null, exteriorFinish: null, ...observed });
const opening = (id, extra) => ({ detectionId: id, type: 'window', openingClass: 'Window', x: 0.4, y: 0.1, hostDetectionId: null, tag: null, sizeCode: null, quantity: 1, ...observed, ...extra });
const { batch, analysis } = normalizePlanAnalysis({ context, runId: 'run', modelVersion: 'model', responses: [{
  page: 1, level: 'Ground Floor',
  walls: [wall('ext', 'exterior', [{ x: 0.1, y: 0.1 }, { x: 0.8, y: 0.1 }]), wall('int', 'interior', [{ x: 0.1, y: 0.5 }, { x: 0.6, y: 0.5 }])],
  openings: [opening('w1', { sizeCode: '1806dh' }), opening('d1', { type: 'door', openingClass: 'Internal Door', x: 0.3, y: 0.5, explicitWidthMm: 820 })],
  buildingAreas: [], pillars: [], eaves: [], rooms: [], fixtures: [], documentedQuantities: [],
  review: ['Wall thicknesses and wall heights are not legible on this sheet, so they are left null.'],
}] });
analysis.review.push({ message: 'Sheet 1: 1:100 cannot determine image pixels/mm without reliable PDF paper units or a written dimension.', code: 'scale-review', audience: 'diagnostic' });
const collections = { ...convertAiTakeoffDetections(batch, context), completedMeasurements: [] };
const takeoff = { ...collections, pixelsPerMm: 0.1, totalPages: 1, sheetLevels: { 1: 'Ground Floor' }, scheduleState: { aiAnalysis: { ...analysis, status: 'appended', provider: 'OpenAI', modelVersion: 'model' } }, takeoffId: 'takeoff', takeoffName: 'Unit takeoff' };

const root = createRoot(document.getElementById('root'));
const text = () => document.getElementById('root').textContent;
try {
  // ---- AI Plan Takeoff panel ------------------------------------------------------------------
  const { AiTakeoffAction } = await load('../components/construction-estimation/ai-plan-takeoff/ai-integration/AiTakeoffAction.jsx');
  const answers = [];
  const shown = [];
  const panel = (job) => React.createElement(AiTakeoffAction, {
    schedule: createTakeoffSchedule(job), sheetLevels: job.sheetLevels, disabled: false, onCalibrate() {}, onReview() {}, onSave() {}, onGoToPage: (page) => shown.push(page),
    analysis: { stage: 'complete', message: 'AI TAKEOFF COMPLETE', report: job.scheduleState.aiAnalysis, scaleProposal: null, run() {}, cancel() {}, resolveDecision: (decision, value) => answers.push([decision, value]),
      rooms: { busy: false, message: '', error: false, read() {}, add() {}, remove() {} } },
  });
  await act(() => root.render(panel(takeoff)));
  const result = document.getElementById('ai-takeoff-result');
  assert.match(result.textContent, /AI TAKEOFF COMPLETE/);
  assert.match(result.textContent, /✓ 1 window identified/);
  assert.match(result.textContent, /✓ 1 internal door identified/);
  assert.match(result.textContent, /✓ External walls measured — 7\.0 lm/);
  const decisions = [...result.querySelectorAll('[data-review-decision]')];
  assert.deepEqual(decisions.map((item) => item.dataset.reviewDecision), ['external-wall-type:Ground Floor', 'ceiling-height:Ground Floor', 'internal-wall-type', 'door-height']);
  assert.match(document.getElementById('ai-takeoff-review-count').textContent, /⚠ 4 items require confirmation/);
  const diagnostics = document.getElementById('ai-takeoff-diagnostics');
  assert.equal(diagnostics.open, false, 'technical diagnostics are collapsed');
  assert.match(diagnostics.querySelector('summary').textContent, /Advanced AI diagnostics \(\d+\)/);
  assert.match(diagnostics.textContent, /not legible on this sheet/);
  assert.match(diagnostics.textContent, /cannot determine image pixels\/mm/);
  const visible = [...result.children].filter((node) => node !== diagnostics).map((node) => node.textContent).join(' ');
  assert.ok(!/not legible|pixels\/mm|manual default|OBSERVED/.test(visible), 'no internal diagnostic is shown to the builder outside the advanced section');
  // Each item is answered where it is shown.
  const byId = (id) => decisions.find((item) => item.dataset.reviewDecision === id);
  await act(() => [...byId('external-wall-type:Ground Floor').querySelectorAll('button')].find((button) => button.textContent === 'Rendered brick veneer').click());
  await act(() => [...byId('door-height').querySelectorAll('button')].find((button) => button.textContent === 'Apply').click());
  await act(() => [...byId('door-height').querySelectorAll('button')].find((button) => /Show sheet 1/.test(button.textContent)).click());
  assert.deepEqual(answers.map(([decision, value]) => [decision.id, value]), [['external-wall-type:Ground Floor', 'brick_veneer:rendered_brick'], ['door-height', 2040]]);
  assert.deepEqual(shown, [1]);
  // The answers change the takeoff, and the items clear.
  const answered = { ...takeoff };
  for (const [decision, value] of answers) Object.assign(answered, applyReviewDecision(decision, value, answered));
  await act(() => root.render(panel(answered)));
  assert.match(document.getElementById('ai-takeoff-review-count').textContent, /⚠ 2 items require confirmation/);

  // ---- Job Setup: Import takeoff quantities ---------------------------------------------------
  const { default: JobSetupTakeoffImport } = await load('../components/estimate-builder/JobSetupTakeoffImport.jsx');
  const rows = Object.fromEntries(V4_DATA_SECTIONS.find((section) => section.key === 'inputDataSheet').rows.map((row) => [row.key, { value: '' }]));
  const workbook = { jobId: 'job', data: { inputDataSheet: { rows, hiddenRows: [] } }, formulas: {}, takeoffEngine: {} };
  await act(() => root.render(React.createElement(JobSetupTakeoffImport, { sheet: { workbook, hydrated: true, previewMode: false, importJobSetupTakeoff: async () => ({ ok: true, count: 0 }) }, takeoffJob: { ...takeoff, masterJobId: 'job' }, projectId: 'job', jobName: 'Unit job', jobOpen: true, onOpenTakeoff() {} })));
  await act(async () => { [...document.querySelectorAll('button')].find((button) => button.textContent === 'Import takeoff quantities').click(); await new Promise((resolve) => setTimeout(resolve, 20)); });
  const summary = document.querySelector('[data-testid="takeoff-review-summary"]');
  assert.ok(summary, text().slice(0, 400));
  assert.match(summary.textContent, /AI Takeoff Complete/);
  assert.match(summary.textContent, /✓ 1 window identified/);
  assert.match(summary.textContent, /⚠ 4 items require confirmation/);
  const required = document.querySelector('[data-testid="takeoff-requires-review"]');
  assert.equal(required.querySelectorAll('[data-review-decision]').length, 4);
  assert.match(required.textContent, /Ground Floor: what are the external walls built from\?/);
  assert.match(required.textContent, /Open AI Plan Takeoff to answer these/);
  assert.ok(!/Some exterior walls have no material classification|enter wall or ceiling heights/.test(required.textContent), 'a general warning is not repeated beside the review item that asks the same question');
  const jobDiagnostics = document.querySelector('[data-testid="takeoff-ai-diagnostics"]');
  assert.equal(jobDiagnostics.open, false);
  assert.match(jobDiagnostics.textContent, /not legible on this sheet/);
  assert.ok(!/Needs attention/.test(text()), 'the old all-in-one warning list is gone');
  assert.ok(!/not legible|pixels\/mm/.test(required.textContent + summary.textContent));
  console.log('AI Takeoff review screens: summary, actionable review items, answers and collapsed diagnostics render in the takeoff panel and in Job Setup.');
} finally {
  await act(() => root.unmount());
  for (const file of compiled) fs.rmSync(file, { force: true });
}
