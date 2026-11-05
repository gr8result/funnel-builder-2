import assert from 'node:assert/strict';
import { confirmOpeningClass } from '../components/construction-estimation/ai-plan-takeoff/manualOpeningEdit.js';
const frame = { id: 'measured-frame', type: 'door', openingClass: 'External Door', subType: 'Sliding',
  x: 250, y: 80, widthMm: 900, heightMm: null, hostWallId: 'wall-1', needsClassification: true, ai: { detectionId: 'frame-1' } };
const window = confirmOpeningClass(frame, 'Window', 'test-time');
assert.equal(window.type, 'window');
assert.equal(window.openingType, 'window');
assert.equal(window.needsClassification, false);
assert.equal(window.typeConfirmedAt, 'test-time');
for (const key of ['id', 'x', 'y', 'widthMm', 'heightMm', 'hostWallId', 'ai']) assert.deepEqual(window[key], frame[key]);
assert.equal(frame.needsClassification, true, 'manual confirmation does not mutate the detection');
assert.equal(confirmOpeningClass(frame, 'unknown'), frame, 'unknown classes cannot admit geometry');
assert.equal(confirmOpeningClass(frame, 'External Door').subType, 'Sliding', 'confirmation preserves an existing subtype');
assert.equal(confirmOpeningClass(window, 'Internal Door').type, 'door');
console.log('Manual opening class: explicit confirmation, consistent type, measured geometry and provenance preserved.');
