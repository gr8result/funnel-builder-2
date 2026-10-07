import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = ts.createSourceFile('takeoff.jsx', fs.readFileSync('components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
let body;
(function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.body?.getText(source).includes('const loadedChecksum = pendingLoadedContentChecksumRef.current')) body = node.arguments[0].body.getText(source);
  ts.forEachChild(node, visit);
})(source);
assert.ok(body, 'Exercise the actual content publication effect');
const ref = current => ({ current });
const published = [], requests = [];
const context = {
  suppressUnsavedChangeRef: ref(true), suppressAutosaveFromLoadRef: ref(true),
  pendingLoadedContentChecksumRef: ref('empty'), lastSeenContentChecksumRef: ref('empty'), lastSavedContentChecksumRef: ref('empty'),
  takeoffContentChecksum: 'plan-added', pendingDragChecksumRef: ref(''), contentEditVersionRef: ref(0),
  latestAutosaveBasisRef: ref({}), draggingVertex: false, draggingItem: false, draggingMeasureId: false, draggingEaveId: false,
  setHasUnsavedChanges() {}, setAutosaveRequest: value => requests.push(value),
  masterTakeoffChangeRef: ref(job => { published.push(job); return { ok: true }; }),
  latestBuildJobDataRef: ref(() => ({ masterJobId: 'master-a', checksum: context.takeoffContentChecksum })),
  platformContext: { jobId: 'master-a' }, jobName: 'Michael and Sarah Johnson', isRecoveryPreview: false,
  setPlatformSaveMessage() {},
};
const effect = new Function('context', `with (context) { return () => ${body}; }`)(context);
effect();
assert.equal(published.length, 1, 'First plan import after opening an unchanged empty workspace is published');
effect();
assert.equal(published.length, 1, 'A parent render cannot publish unchanged content again');
context.suppressUnsavedChangeRef.current = true;
context.suppressAutosaveFromLoadRef.current = true;
context.pendingLoadedContentChecksumRef.current = 'loaded-existing-plan';
context.takeoffContentChecksum = 'loaded-existing-plan';
effect();
assert.equal(published.length, 1, 'Hydration of existing content cannot overwrite the master');
context.takeoffContentChecksum = 'measurement-added';
context.draggingVertex = true;
effect();
assert.equal(published.length, 1, 'Partial drag does not save incomplete geometry');
context.draggingVertex = false;
effect();
assert.equal(published.length, 2, 'Completed edit is published once');
effect();
assert.equal(requests.length, 2);
console.log('PASS first plan import, hydration, completed edits and unchanged parent renders publish correctly without a feedback loop');
