import assert from 'node:assert/strict';
import { localVectorReadiness } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/localVectorReadiness.js';
const clean = { admission: { status: 'appended' }, rooms: [{ confirmed: true, reviewRequired: false }] };
assert.equal(localVectorReadiness(clean).needsReview, false);
for (const input of [
  { vector: { report: { unclassifiedWalls: 2 } } },
  { vector: { report: { openingsOnUnclassifiedWalls: 1 } } },
  { vector: { report: { openingsWithoutWall: 1 } } },
  { detected: { openings: [{ confirmed: false }] } },
  { rooms: [{ confirmed: false, reviewRequired: true }] },
  { rooms: [] },
  { analysis: { unresolved: [{ kind: 'opening' }] } },
  { analysis: { review: [{ code: 'benchmark-discrepancy' }] } },
]) assert.equal(localVectorReadiness({ ...clean, ...input }).needsReview, true, JSON.stringify(input));
const uncertainWalls = localVectorReadiness({ ...clean, vector: { report: { unclassifiedWalls: 2 } } });
assert.match(uncertainWalls.issues[0].message, /visible as review-only candidates/);
assert.match(uncertainWalls.issues[0].message, /before including them in quantities/);
assert.equal(localVectorReadiness({ ...clean, detected: { openings: [{ confirmed: false, bridgeOnly: true }] } }).needsReview, false, 'a gross wall bridge is not another physical opening');
console.log('Vector readiness regression: inserted objects cannot hide geometry or room review blockers.');
assert.equal(localVectorReadiness({...clean,vector:{report:{openingsNeedingClassification:1}}}).needsReview,true,'located but unclassified frames cannot finish a takeoff');
