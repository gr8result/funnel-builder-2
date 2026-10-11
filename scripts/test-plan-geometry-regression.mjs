// Real-plan regression: the geometry engine must not lose rooms, openings or wall coverage that the
// New Job 03/09 plans previously gave. Needs the recovered job file (large, not in git); skipped without it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const job = process.env.GR8_GEOMETRY_JOB || 'E:/dev/funnel-builder-clean/artifacts/test-results/resume-2026-10-10/working-copy.gr8job';
if (!fs.existsSync(job)) { console.log(`SKIPPED plan geometry regression: ${job} not found (set GR8_GEOMETRY_JOB).`); process.exit(0); }
const floor = JSON.parse(fs.readFileSync('test/fixtures/new-job-03-09-geometry-floor.json', 'utf8'));
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'geometry-regression-'));
execFileSync('node', ['--max-old-space-size=12288', '--import', './scripts/register-extensionless-loader.mjs', '--import', './scripts/register-json-loader.mjs', 'scripts/benchmark-plan-geometry.mjs', '--job', job, '--room-references', 'test/fixtures/new-job-03-09-room-reference.template.json', '--out', out], { stdio: 'ignore', maxBuffer: 1 << 28 });
const report = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8'));
for (const sheet of report.sheets) {
  const limits = floor.sheets[String(sheet.page)];
  if (!limits) continue;
  const label = `${limits.level} (page ${sheet.page})`;
  assert.ok(sheet.rooms.detected >= limits.minRooms, `${label}: rooms ${sheet.rooms.detected} fell below ${limits.minRooms}`);
  assert.ok(sheet.openings.matched >= limits.minOpeningsMatched700mm, `${label}: matched openings ${sheet.openings.matched} fell below ${limits.minOpeningsMatched700mm}`);
  assert.ok(sheet.missingManualWallLengthLm.exterior <= limits.maxMissingExteriorLm, `${label}: missing exterior wall ${sheet.missingManualWallLengthLm.exterior} lm exceeds ${limits.maxMissingExteriorLm}`);
  assert.ok(sheet.missingManualWallLengthLm.interior <= limits.maxMissingInteriorLm, `${label}: missing interior wall ${sheet.missingManualWallLengthLm.interior} lm exceeds ${limits.maxMissingInteriorLm}`);
  assert.ok(sheet.manualWallCoverage.exterior.share >= limits.minWallCoverageExterior, `${label}: exterior wall coverage ${sheet.manualWallCoverage.exterior.share} fell below ${limits.minWallCoverageExterior}`);
  assert.ok(sheet.manualWallCoverage.interior.share >= limits.minWallCoverageInterior, `${label}: interior wall coverage ${sheet.manualWallCoverage.interior.share} fell below ${limits.minWallCoverageInterior}`);
  assert.ok(sheet.openings.matchedWithin200mm >= limits.minOpeningsMatched200mm, `${label}: openings within 200 mm ${sheet.openings.matchedWithin200mm} fell below ${limits.minOpeningsMatched200mm}`);
  for (const tag of limits.requiredOpenings || []) assert.ok(sheet.openings.list.some((item) => item.tag === tag), `${label}: ${tag} is no longer found`);
  assert.ok(sheet.walls.unsupportedByManualLm <= limits.maxWallNotOnTraceLm, `${label}: wall not on any traced wall ${sheet.walls.unsupportedByManualLm} lm exceeds ${limits.maxWallNotOnTraceLm}`);
  if (limits.minMeanRoomIoU) {
    assert.equal(sheet.roomPolygonAccuracy.status, 'compared', `${label}: room polygons were not compared`);
    assert.ok(sheet.roomPolygonAccuracy.meanIoU >= limits.minMeanRoomIoU, `${label}: room polygon IoU ${sheet.roomPolygonAccuracy.meanIoU} fell below ${limits.minMeanRoomIoU}`);
    for (const room of sheet.roomPolygonAccuracy.rooms) assert.ok(Math.abs(room.areaErrorPercent) <= limits.maxRoomAreaErrorPercent[room.name], `${label}: ${room.name} area error ${room.areaErrorPercent}% exceeds ${limits.maxRoomAreaErrorPercent[room.name]}%`);
  }
}
fs.rmSync(out, { recursive: true, force: true });
console.log('plan geometry regression: rooms, matched openings, wall coverage and room polygon accuracy hold on the New Job 03/09 plans');
