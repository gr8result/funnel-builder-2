import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { getPlanDisplayIdentity } from '../components/construction-estimation/ai-plan-takeoff/takeoffLifecycle.js';

// Execute the actual plan-display effect, so a destructive reset added back to
// the component fails this regression. No copied implementation or schedule math.
const filename = new URL('../components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx', import.meta.url);
const source = readFileSync(filename, 'utf8');
const parsed = ts.createSourceFile(filename.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const effects = [];
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'useEffect') {
    const callback = node.arguments[0]?.getText(parsed) || '';
    if (callback.includes('renderPdfPage(pdfDoc, currentPage)')) effects.push(callback);
  }
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.equal(effects.length, 1, 'Find the production plan-display effect exactly once');

const state = {
  activePolyline: [], activeAreaPolyline: [], eavePoints: [], measurePoints: [], boxStartPoint: null,
  completedEaves: [{ id: 'saved-eave', page: 3, nodes: [{ x: 0, y: 0 }, { x: 40, y: 0 }], lengthMm: 4000 }],
  currentPage: 3, pixelsPerMm: 0.01, sheetLevels: { 3: 'Second Level' },
  activeTool: 'eaves', stageScale: 2.5, stagePos: { x: -150, y: 90 },
};
const loads = [];
const context = {
  ...state,
  planPages: [
    { pageNumber: 3, dataUrl: 'data:image/png;base64,sheet3', dataUrlAssetId: 'sheet3-asset' },
    { pageNumber: 4, dataUrl: 'data:image/png;base64,sheet4', dataUrlAssetId: 'sheet4-asset' },
  ],
  pdfDoc: null,
  displayedPlanRef: { current: null },
  getPlanDisplayIdentity,
  logTakeoffRefresh: () => {},
  showPlanPage: (pages, page) => { loads.push({ kind: 'image', page }); return Promise.resolve(); },
  renderPdfPage: (pdf, page) => { loads.push({ kind: 'pdf', page }); return Promise.resolve(); },
};
for (const name of Object.keys(state)) {
  context[`set${name[0].toUpperCase()}${name.slice(1)}`] = (value) => {
    state[name] = typeof value === 'function' ? value(state[name]) : value;
    context[name] = state[name];
  };
}
vm.createContext(context);
const runEffect = vm.runInContext(`(${effects[0]})`, context);
let cleanup;
async function replayEffect() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = runEffect();
  await Promise.resolve();
}
function seedDrafts() {
  for (const name of ['eavePoints', 'activePolyline', 'activeAreaPolyline', 'measurePoints']) {
    state[name] = [{ x: 2, y: 3 }, { x: 17, y: 3 }, { x: 17, y: 29 }];
    context[name] = state[name];
  }
  state.boxStartPoint = context.boxStartPoint = { x: 2, y: 3 };
}
const snapshot = () => JSON.stringify(state);

await replayEffect();
seedDrafts();
const before = snapshot();
const initialLoads = loads.length;
await replayEffect();
assert.equal(state.eavePoints.length, 3, 'Same-sheet effect replay must preserve all unfinished eave points');
assert.equal(snapshot(), before, 'Effect replay must preserve drafts, completed eaves, scale, level, tool, zoom, and pan');
assert.equal(loads.length, initialLoads, 'Effect replay must not reload the displayed plan');

context.planPages = context.planPages.map((page) => ({ ...page }));
await replayEffect();
assert.equal(snapshot(), before, 'Equivalent plan metadata must preserve the active workspace');
assert.equal(loads.length, initialLoads, 'Equivalent plan metadata must not reload the displayed plan');

context.planPages = context.planPages.map((page) => page.pageNumber === 3
  ? { ...page, dataUrl: 'data:image/png;base64,relinked-sheet3', dataUrlAssetId: 'relinked-sheet3-asset' }
  : page);
await replayEffect();
assert.equal(snapshot(), before, 'Reloading the background of the same sheet must preserve active measurements');
assert.equal(loads.length, initialLoads + 1, 'A changed plan asset reloads exactly once');
assert.equal(loads.at(-1).page, 3);

context.currentPage = state.currentPage = 4;
await replayEffect();
assert.equal(loads.at(-1).page, 4, 'A deliberate sheet switch loads the selected sheet');
for (const name of ['activePolyline', 'activeAreaPolyline', 'eavePoints']) {
  assert.equal(state[name].length, 0, `A deliberate sheet switch clears ${name}`);
}
assert.equal(state.completedEaves[0].id, 'saved-eave', 'A sheet switch preserves saved geometry');
assert.equal(state.pixelsPerMm, 0.01, 'A sheet switch preserves calibration');
assert.equal(state.sheetLevels[3], 'Second Level', 'A sheet switch preserves assigned levels');

// React runs cleanup/setup again on effect replay. Cleanup must not revoke the
// active asset or zero the working canvas in between those two calls.
const cleanupEffects = [];
function findCleanup(node) {
  if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'useEffect') {
    const callback = node.arguments[0]?.getText(parsed) || '';
    if (callback.includes("logTakeoffRefresh('component-detached')")) cleanupEffects.push(callback);
  }
  ts.forEachChild(node, findCleanup);
}
findCleanup(parsed);
assert.equal(cleanupEffects.length, 1);
const queued = [];
const revoked = [];
let clears = 0;
const canvas = { width: 640, height: 480, getContext: () => ({ clearRect: () => { clears += 1; } }) };
const pendingImage = {};
const lifecycle = { attachment: 0, hydrationVersion: 0, imageRequest: pendingImage };
const setup = vm.runInNewContext(`(${cleanupEffects[0]})`, {
  takeoffLifecycle: lifecycle, logTakeoffRefresh: () => {}, queueMicrotask: (fn) => queued.push(fn),
  rawCanvasRef: { current: canvas }, planPages: [{ dataUrl: 'blob:active-plan' }],
  revokeTakeoffObjectUrl: (url) => revoked.push(url),
});
const firstCleanup = setup();
firstCleanup();
const finalCleanup = setup();
queued.splice(0).forEach((fn) => fn());
assert.equal(clears, 0, 'Effect replay must not clear the working canvas');
assert.equal(canvas.width, 640);
assert.equal(revoked.length, 0, 'Effect replay must not revoke the displayed plan URL');
assert.equal(lifecycle.imageRequest, pendingImage);
finalCleanup();
queued.splice(0).forEach((fn) => fn());
assert.equal(clears, 1, 'A real detach still releases canvas memory');
assert.equal(canvas.width, 0);
assert.deepEqual(revoked, ['blob:active-plan']);
assert.equal(lifecycle.imageRequest, null, 'A detached viewer cannot receive a pending image result');
assert.equal(lifecycle.hydrationVersion, 1);

console.log('Takeoff refresh stability checks passed: actual effects preserve drafts/view and canvas resources on replay, ignore equivalent metadata, preserve same-sheet drafts, and still handle sheet switching and real detach.');
