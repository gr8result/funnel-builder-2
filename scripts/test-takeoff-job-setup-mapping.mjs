import assert from 'node:assert/strict';
import { createTakeoffSchedule, createJobSetupPayload } from '../components/construction-estimation/ai-plan-takeoff/takeoffSchedule.js';
import { INPUT_DATA_SHEET_TEMPLATE } from '../lib/construction-estimation/inputDataSheetTemplate.js';

const rect = (width, height) => [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
const fixture = {
  totalPages: 8, pixelsPerMm: 1,
  projectInfo: { projectName: 'Measured project', siteAddress: '12 Test Street' },
  completedFloorplans: [
    { id: 'footprint', page: 5, type: 'Footprint', nodes: rect(10000, 10000) },
    { id: 'garage', page: 5, type: 'Garage', nodes: rect(4000, 5000) },
    { id: 'alfresco', page: 5, type: 'Alfresco', nodes: rect(2000, 5000) },
    { id: 'porch', page: 5, type: 'Porch', nodes: rect(1000, 2000) },
    { id: 'deck', page: 5, type: 'Deck', nodes: rect(2000, 3000) },
    { id: 'patio', page: 5, type: 'Patio', nodes: rect(1000, 3000) },
    { id: 'upper-living', page: 5, level: 'Second Level', type: 'Living', nodes: rect(5000, 5000) },
    { id: 'balcony', page: 6, type: 'Balcony', nodes: rect(2000, 3000) },
  ],
  completedWallRuns: [
    { id: 'external', page: 5, category: 'exterior', exteriorType: 'Brick Veneer', lengthMm: 10000, wallHeightM: 2.7, thicknessMm: 90 },
    { id: 'internal', page: 5, category: 'interior', lengthMm: 5000, wallHeightM: 2.7, thicknessMm: 70, linedFaces: 2 },
  ],
  placedOpenings: [
    { id: 'window', page: 5, type: 'window', hostWallId: 'external', widthMm: 1000, heightMm: 1200, brickSillRequired: true },
    { id: 'door', page: 5, type: 'door', openingClass: 'Internal Door', widthMm: 1000, heightMm: 2000, hostWallId: 'internal' },
  ],
  completedAreas: [
    { id: 'finish', page: 5, category: 'Tiles', nodes: rect(5000, 5000), exclusions: [{ nodes: rect(1000, 1000) }] },
    { id: 'roof', page: 8, level: 'Ground Floor', category: 'Roof Area', nodes: rect(10000, 12000) },
  ],
  completedEaves: [{ id: 'eave', page: 8, level: 'Second Level', lengthMm: 20000, widthMm: 600 }],
};

const schedule = createTakeoffSchedule(fixture);
const withoutLevels = createJobSetupPayload(schedule);
assert.equal(withoutLevels.dataInputFields.lowerFloorAreaM2, undefined, 'PDF page numbers must not become building levels');
assert.equal(withoutLevels.dataInputFields.upperFloorAreaM2, 25, 'An explicit measurement level is usable without sheet assignments');
assert.equal(withoutLevels.dataInputFields.floorFinishTilesM2, 24, 'Project finish totals can import independently of levels');
assert.ok(withoutLevels.unsupported.some((row) => row.itemId === 'footprint'));

const payload = createJobSetupPayload(schedule, { sheetLevels: { 5: 'Ground Floor', 6: 'Third Level', 8: 'Third Level' }, projectId: 'project-1', takeoffId: 'takeoff-1', revision: 2 });
const fields = payload.dataInputFields;
assert.equal(fields.lowerFloorAreaM2, 59, 'Living is footprint less garage, alfresco, porch, deck and patio');
assert.equal(fields.lowerGarageAreaM2, 20);
assert.equal(fields.lowerAlfrescoAreaM2, 10);
assert.equal(fields.lowerPorchAreaM2, 2);
assert.equal(fields.lowerOtherAreaM2, 6, 'Deck retains the Other row');
assert.equal(fields.lowerPatioAreaM2, 3, 'Patio has its own editable row');
assert.equal(fields.upperFloorAreaM2, 25, 'Explicit item levels take priority over sheet assignments');
assert.equal(fields.upperBalconyAreaM2, 6, 'The third level balcony uses the real template destination');
// lowerExternalWallsLm / lowerInternalWallsLm are DERIVED sheet totals (calculated: true, formula
// summing the hidden per-frame lowerExternal70mmWallsLm/90mmWallsLm rows) - those hidden rows are
// the single authoritative imported measurement per the "one wall = one imported measurement" rule.
assert.equal((fields.lowerExternal70mmWallsLm || 0) + (fields.lowerExternal90mmWallsLm || 0), 10, 'Exterior subtotal and individual records are not double counted');
assert.equal(fields.totalBrickVeneerExternalWallsLm, 10);
assert.equal((fields.lowerInternal70mmWallsLm || 0) + (fields.lowerInternal90mmWallsLm || 0), 5);
assert.equal(fields.lowerInternalWallGrossPlasterboardM2, 27, 'Internal plasterboard subtotal is not doubled');
assert.equal(fields.lowerInternalWallNetPlasterboardM2, 23, 'Linked opening is deducted from both lined faces');
assert.equal(fields.windowOpeningsQty, 1);
assert.equal(fields.windowOpeningsAreaM2, 1.2);
assert.equal(fields.doorOpeningsQty, 1);
assert.equal(fields.doorOpeningsAreaM2, 2);
assert.equal(fields.lowerBrickSillLengthLm, 1);
assert.equal(fields.lowerRoofPlanAreaM2, 120, 'Explicit roof level takes priority over sheet 8 assignment');
assert.equal(fields.upperEavesLm, 20);
assert.equal(fields.eavesWidthM, 0.6, 'Eaves width is converted from millimetres to metres');
assert.equal(fields.lowerCeilingHeight, 2700, 'Explicit metre wall height converts to the Job Setup millimetre input');
assert.equal(fields.floorFinishCarpetsM2, undefined, 'Unmeasured categories do not overwrite existing values with zero');
assert.equal(fields.totalExternalWallsLm, undefined, 'Calculated totals stay under workbook formula control');
assert.equal(fields.eavesAreaM2, undefined, 'Calculated eaves area stays under workbook formula control');
assert.equal(payload.provenance.projectId, 'project-1');
assert.deepEqual(payload.provenance.sheetLevels, payload.sheetLevels);
for (const key of Object.keys(fields)) {
  const destination = INPUT_DATA_SHEET_TEMPLATE.rows.find((row) => row.key === key);
  assert.ok(destination?.editable && !destination.calculated && !destination.heading, `${key} must be an editable actual input`);
}

const noCalibration = createJobSetupPayload(createTakeoffSchedule({ ...fixture, pixelsPerMm: null }), { sheetLevels: { 5: 'Ground Floor' } });
assert.equal(noCalibration.dataInputFields.lowerFloorAreaM2, undefined);
assert.equal(noCalibration.dataInputFields.floorFinishTilesM2, undefined);
assert.equal((noCalibration.dataInputFields.lowerExternal70mmWallsLm || 0) + (noCalibration.dataInputFields.lowerExternal90mmWallsLm || 0), 10, 'Stored measured lengths do not require polygon calibration');
assert.ok(noCalibration.warnings.some((warning) => /calibration/.test(warning)));

const mixedWidths = createJobSetupPayload(createTakeoffSchedule({ ...fixture, completedEaves: [...fixture.completedEaves, { id: 'other-eave', page: 8, level: 'Ground Floor', lengthMm: 4000, widthMm: 900 }] }));
assert.equal(mixedWidths.dataInputFields.eavesWidthM, undefined, 'Mixed widths do not silently choose a single width');
assert.ok(mixedWidths.warnings.some((warning) => /mixed/.test(warning)));

const unknownHeight = createJobSetupPayload(createTakeoffSchedule({ pixelsPerMm: 1, completedWallRuns: [{ id: 'wall', page: 1, level: 'Ground Floor', category: 'interior', lengthMm: 1000 }] }));
// No thicknessMm on this wall means it carries no construction-system evidence, so its length
// lands in the unclassified internal bucket rather than a 70mm/90mm framed bucket.
assert.equal(unknownHeight.dataInputFields.lowerUnclassifiedInternalLm, 1);
assert.equal(unknownHeight.dataInputFields.lowerCeilingHeight, undefined, 'No implicit 2.4 metre height is imported');
assert.equal(unknownHeight.dataInputFields.lowerInternalWallGrossPlasterboardM2, undefined);
assert.ok(unknownHeight.warnings.some((warning) => /height/.test(warning)));

const zeroArea = createJobSetupPayload(createTakeoffSchedule({ pixelsPerMm: 1, completedAreas: [{ id: 'fully-excluded', page: 1, category: 'Tiles', nodes: rect(1000, 1000), exclusions: [{ nodes: rect(1000, 1000) }] }] }));
assert.equal(zeroArea.dataInputFields.floorFinishTilesM2, 0, 'An explicitly measured zero after exclusions remains importable');

const smallAreas = createJobSetupPayload(createTakeoffSchedule({ pixelsPerMm: 1, completedAreas: Array.from({ length: 10 }, (_, id) => ({ id, page: 1, category: 'Tiles', nodes: rect(40, 100) })) }));
assert.equal(smallAreas.dataInputFields.floorFinishTilesM2, 0.04, 'Preserve precision until the final aggregated area is rounded');
const unknownWall = createJobSetupPayload(createTakeoffSchedule({ completedWallRuns: [{ id: 'unknown', page: 1, category: 'retaining', level: 'Ground Floor', lengthMm: 2000 }] }));
assert.equal(unknownWall.dataInputFields.lowerInternalWallsLm, undefined, 'Unknown wall categories must not silently become interior walls');
assert.ok(unknownWall.unsupported.some((item) => item.itemId === 'unknown'));
console.log('Takeoff to Job Setup mapping checks passed.');
