import assert from 'node:assert/strict';
import { validateGeometryModel, polygonIssue, assertTakeoffImportable, geometrySignature, signatureFromSchedule } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/geometryValidation.js';
import { buildInclusionScope, emptyScopeProfile, sanitizeScopeProfile } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/inclusionScope.js';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { restoreAnalysisCoordinates } from '../components/construction-estimation/ai-plan-takeoff/ai-integration/analysisPages.js';

const rect = (x1, y1, x2, y2) => [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
const context = { jobId: 'job-a', takeoffId: 'takeoff-a', documentHash: 'hash-a', pixelsPerMm: .1,
  pages: [{ pageNumber: 1, logicalWidth: 1000, logicalHeight: 1000 }], completedWallRuns: [], placedOpenings: [], completedFloorplans: [], completedAreas: [], completedEaves: [] };
const outline = rect(0, 0, 1000, 1000);
const canonical = { completedWallRuns: [{ id: 'ext', page: 1, level: 'Ground Floor', category: 'exterior', constructionSystem: 'brick_veneer', thicknessMm: 230, wallHeightM: 2.7, nodes: [...outline, outline[0]] },
  { id: 'int', page: 1, level: 'Ground Floor', category: 'interior', constructionSystem: 'internal_timber_frame', thicknessMm: 70, wallHeightM: 2.7, nodes: [{ x: 500, y: 0 }, { x: 500, y: 1000 }] }],
  placedOpenings: [{ id: 'door', page: 1, hostWallId: 'int', type: 'door', x: 500, y: 500, widthMm: 900, heightMm: 2100 }],
  completedFloorplans: [{ page: 1, type: 'Footprint', nodes: outline }], completedAreas: [{ page: 1, level: 'Ground Floor', category: 'Roof Area', nodes: outline }],
  completedEaves: [{ page: 1, nodes: [{ x: 0, y: 0 }, { x: 1000, y: 0 }], widthMm: 600 }] };
const analysis = { pages: [{ page: 1, drawingType: 'floor_plan' }], review: [], benchmarks: [{ page: 1, label: 'Total area', unit: 'm2', value: 100, measured: 100 }] };
const original = structuredClone({ canonical, context, analysis });
const valid = validateGeometryModel({ canonical, context, analysis });
assert.equal(valid.passed, true);
assert.deepEqual({ canonical, context, analysis }, original, 'validation preserves all submitted and manual geometry');
const badOpening = { ...canonical, placedOpenings: [{ ...canonical.placedOpenings[0], hostWallId: '' }] };
assert.ok(validateGeometryModel({ canonical: badOpening, context, analysis }).blockers.some((b) => b.code === 'unhosted-opening'));
const disconnected = { ...canonical, completedWallRuns: [{ ...canonical.completedWallRuns[0], nodes: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] }, canonical.completedWallRuns[1]] };
assert.ok(validateGeometryModel({ canonical: disconnected, context, analysis }).blockers.some((b) => b.code === 'disconnected-exterior'));
assert.equal(validateGeometryModel({ canonical, context, analysis: { ...analysis, review: [{ page: 1, code: 'benchmark-discrepancy', message: 'Printed living area differs by 20%.' }] } }).passed, false);
assert.equal(validateGeometryModel({ canonical, context, analysis: { ...analysis, benchmarks: [{ unit: 'm2', measured: null, label: 'Side Patio', value: 7.59 }] } }).passed, false);
assert.ok(polygonIssue([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }]));

const profile = emptyScopeProfile('Classic');
profile.rules = profile.rules.map((r) => ({ ...r, floorFinish: r.group === 'Bedrooms' ? 'Carpets' : 'Tiles', wallTiling: 'full-height', splashback: 'none' }));
profile.roofNotApplicable = ['Ridges', 'Hips', 'Valleys'];
const rooms = [{ page: 1, name: 'Bedroom 1', level: 'Ground Floor', x: .25, y: .5, nodes: rect(0, 0, .5, 1), basis: 'OBSERVED', confidence: .95 },
  { page: 1, name: 'Bathroom', level: 'Ground Floor', x: .75, y: .5, nodes: rect(.5, 0, 1, 1), basis: 'OBSERVED', confidence: .95 }];
const roofMeasurements = ['Fascia', 'Gutters', 'Downpipes'].map((type) => ({ type, page: 1, level: 'Ground Floor', quantity: type === 'Downpipes' ? 2 : 10, evidence: 'Separate measured geometry.' }));
const input = { profile, rooms, roofMeasurements, canonical, context, geometryValidation: valid,
  planEvidence: { roofPitchDegrees: 30, levels: { 'Ground Floor': { ceilingHeightMm: 2700 } } } };
const result = buildInclusionScope(input);
assert.equal(result.complete, true, JSON.stringify(result.checklist.filter((c) => !c.passed)));
assert.equal(result.areas.length, 2);
assert.ok(Math.abs(result.quantities.find((q) => q.category === 'Carpets').quantity - 50) < 1e-8);
assert.ok(Math.abs(result.quantities.find((q) => q.category === 'Tiles').quantity - 50) < 1e-8);
assert.ok(Math.abs(result.quantities.find((q) => q.category === 'Wall tiles').quantity - 79.11) < 1e-8);
assert.ok(Math.abs(result.quantities.find((q) => q.category === 'Roof covering').quantity - 100 / Math.cos(Math.PI / 6)) < 1e-8);
assert.equal(buildInclusionScope({ ...input, geometryValidation: { passed: false } }).areas.length, 0, 'invalid geometry cannot generate commercial finish objects');
assert.equal(buildInclusionScope({ ...input, rooms: rooms.slice(0, 1) }).complete, false, 'an omitted room cannot silently complete flooring scope');
assert.equal(buildInclusionScope({ ...input, rooms: [rooms[0], { ...rooms[1], nodes: rooms[0].nodes }] }).areas.length, 0, 'overlapping room floors cannot be counted twice');
assert.equal(buildInclusionScope({ ...input, profile: emptyScopeProfile('Premium') }).complete, false, 'Premium has no invented default specification');
const premium = structuredClone(profile); premium.schedule = 'Premium'; premium.rules.find((r) => r.group === 'Bedrooms').floorFinish = 'Hybrid';
const changed = buildInclusionScope({ ...input, profile: premium });
assert.deepEqual(changed.areas.map((a) => a.nodes), result.areas.map((a) => a.nodes), 'a schedule change reuses geometry');
assert.deepEqual(changed.areas.map((a) => a.id), result.areas.map((a) => a.id), 'reapplying scope updates stable room objects');
assert.ok(Math.abs(changed.quantities.find((q) => q.category === 'Hybrid').quantity - 50) < 1e-8);
const noHeights = buildInclusionScope({ ...input, planEvidence: { roofPitchDegrees: 30 } });
assert.equal(noHeights.complete, false, 'full-height wall tiles cannot use an invented ceiling height');
assert.equal(sanitizeScopeProfile({ schedule: 'Premium', rules: [{ wallTileHeightMm: 999999 }] }).rules[0].wallTileHeightMm, null);
assert.throws(() => assertTakeoffImportable({ status: 'appended' }), /geometry/);
assert.throws(() => assertTakeoffImportable({ geometryValidation: valid, scopeResult: { complete: false } }), /scope/);
assert.doesNotThrow(() => assertTakeoffImportable({ geometryValidation: valid, scopeResult: result }));
assert.doesNotThrow(() => assertTakeoffImportable(null), 'manual takeoffs remain available');
const validatedReport = { ...analysis, geometryValidation: valid, scopeResult: result, geometrySignature: geometrySignature(canonical, context.pixelsPerMm) };
const schedule = createTakeoffSchedule({ ...canonical, pixelsPerMm: context.pixelsPerMm, totalPages: 1, sheetLevels: { 1: 'Ground Floor' }, aiAnalysis: validatedReport });
assert.equal(signatureFromSchedule(schedule), validatedReport.geometrySignature, 'Schedule projections retain the geometry validation signature.');
assert.doesNotThrow(() => createJobSetupPayload(schedule));
const edited = structuredClone(schedule); edited.measurementRecords.find((m) => m.kind === 'wall').nodes[0].x += 5;
assert.throws(() => createJobSetupPayload(edited), /changed after validation/, 'Manual geometry edits invalidate an earlier validation result.');
const rotated = restoreAnalysisCoordinates({ rooms: [{ ...rooms[0] }], roofMeasurements: [{ nodes: [{ x: .2, y: .3 }] }] }, 90);
assert.deepEqual(rotated.roofMeasurements[0].nodes[0], { x: .3, y: .8 });
assert.equal(rotated.rooms[0].nodes[1].x, .5);
console.log('Takeoff validation and scope: topology, host links, area reconciliation, room coverage, overlaps, roof pitch, tiling deductions, schedule changes and import guards passed.');

const standardProfile = structuredClone(profile);
standardProfile.rules = standardProfile.rules.map((r) => ({ ...r, wallTiling: 'standard', wallTileHeightMm: 1200, showerTileHeightMm: 2100 }));
const standardRooms = rooms.map((r) => r.name === 'Bathroom' ? { ...r, showerWallNodes: [{ x: .5, y: 0 }, { x: 1, y: 0 }, { x: 1, y: .1 }] } : r);
const standardResult = buildInclusionScope({ ...input, profile: standardProfile, rooms: standardRooms });
assert.equal(standardResult.complete, true, JSON.stringify(standardResult.checklist.filter((r) => !r.passed)));
assert.ok(Math.abs(standardResult.quantities.find((q) => q.category === 'Wall tiles').quantity - 40.32) < 1e-8, 'base perimeter tiling plus measured shower walls, less door deduction');
const aiEaveSchedule = createTakeoffSchedule({ ...canonical, completedEaves: canonical.completedEaves.map((e) => ({ ...e, source: 'ai' })), pixelsPerMm: .1 });
assert.equal(aiEaveSchedule.projectTotals.roofAndEaves[0].gutterLengthLm, 0, 'AI eaves must not invent matching gutter runs');
