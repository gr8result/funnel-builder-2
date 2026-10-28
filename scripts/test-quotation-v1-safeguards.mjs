// V1 release safeguards: floor-waste double charge and AI Takeoff calibration gate.
// Optional: pass a corrected package path to verify it has no repeated tiling floor-waste rows.
import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { collapseDuplicateFloorWastes, findDuplicateFloorWastes, roomHasFloorWaste } from "../lib/builders/tilingFloorWasteDuplicates.js";
import { takeoffCalibrationCheck } from "../lib/construction-estimation/takeoffCalibrationGate.js";

let passed = 0;
const check = async (name, run) => { await run(); passed += 1; console.log("PASS", name); };
const waste = (extra = {}) => ({ productId: "fw-1", productName: "Forme Square Floor Waste", application: "Shower", quantity: 1, unitPrice: 33, linear: false, ...extra });

await check("exact clone floor wastes are detected with their extra charge", () => {
  const rooms = [{ id: "r1", name: "Main Bathroom", floorWastes: [waste(), waste(), waste()] }];
  const [finding] = findDuplicateFloorWastes(rooms);
  assert.equal(finding.copies, 3);
  assert.equal(finding.extraChargeIncGst, 66);
});
await check("collapse keeps one clone and every legitimate distinct charge", () => {
  const rooms = [{ id: "r1", name: "Ensuite", floorWastes: [waste(), waste(), waste({ quantity: 2 }), waste({ application: "Floor" }), waste({ id: "explicit-1" }), waste({ id: "explicit-2" })] }];
  const { rooms: fixed, removed } = collapseDuplicateFloorWastes(rooms);
  assert.equal(removed.length, 1);
  assert.equal(fixed[0].floorWastes.length, 5);
  assert.deepEqual(fixed[0].floorWastes.map((w) => w.id || `${w.application}-${w.quantity}`), ["Shower-1", "Shower-2", "Floor-1", "explicit-1", "explicit-2"]);
  assert.equal(rooms[0].floorWastes.length, 6, "input is not mutated");
});
await check("rooms without duplicates are returned unchanged", () => {
  const rooms = [{ id: "r1", name: "Laundry", floorWastes: [waste()] }];
  assert.equal(collapseDuplicateFloorWastes(rooms).rooms, rooms);
});
await check("editor guard recognises a product already added at that location", () => {
  const room = { floorWastes: [waste()] };
  assert.equal(roomHasFloorWaste(room, "fw-1", "shower"), true);
  assert.equal(roomHasFloorWaste(room, "fw-1", "Floor"), false);
  assert.equal(roomHasFloorWaste(room, "fw-2", "Shower"), false);
});

await check("calibration probe (sheet 2 at 2 px/mm exported at 1 px/mm) blocks import", () => {
  const job = { pixelsPerMm: 1, scheduleState: { sheetCalibrations: { 1: { pixelsPerMm: 1 }, 2: { pixelsPerMm: 2 } } },
    completedFloorplans: [{ page: 1, nodes: [] }, { page: 2, nodes: [] }] };
  const result = takeoffCalibrationCheck(job);
  assert.equal(result.ok, false);
  assert.deepEqual(result.problems.map((p) => p.page), [2]);
  assert.match(result.message, /sheet 2/);
});
await check("measurements with no calibration at all block import", () => {
  const result = takeoffCalibrationCheck({ completedWallRuns: [{ page: 1 }] });
  assert.equal(result.ok, false);
  assert.match(result.problems[0].reason, /no calibration/);
});
await check("consistent calibration (numeric or object sheet scales) allows import", () => {
  assert.equal(takeoffCalibrationCheck({ pixelsPerMm: 0.5, scheduleState: { sheetCalibrations: { 1: 0.5, 2: { pixelsPerMm: 0.5012 } } }, completedAreas: [{ page: 1 }, { pageId: 2 }] }).ok, true);
  assert.equal(takeoffCalibrationCheck({ pixelsPerMm: 0.5, completedWallRuns: [{ page: 3 }] }).ok, true);
  assert.equal(takeoffCalibrationCheck({}).ok, true);
});

const corrected = process.argv[2];
if (corrected) {
  await check(`corrected package has no repeated tiling floor-waste rows (${corrected})`, async () => {
    const zip = await JSZip.loadAsync(fs.readFileSync(corrected));
    const doc = JSON.parse(await zip.file("quotation.json").async("string"));
    let quotation = null;
    (function find(o, d = 0) { if (quotation || !o || typeof o !== "object" || d > 8) return; if (o.quotation && Object.values(o.quotation).some((s) => Array.isArray(s?.rows))) { quotation = o.quotation; return; } for (const v of Object.values(o)) find(v, d + 1); })(doc);
    assert(quotation, "quotation not found");
    const ids = Object.values(quotation).flatMap((s) => s.rows || []).map((r) => r.id).filter((id) => /^tiling:[^:]+:waste-/.test(id || ""));
    assert(ids.length > 0);
    assert.equal(new Set(ids).size, ids.length);
    const checksumText = (text) => { let hash = 0x811c9dc5; for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); } return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`; };
    const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
    for (const [name, expected] of Object.entries(manifest.sectionChecksums || {})) {
      assert.equal(checksumText(await zip.file(`${name}.json`).async("string")), expected, `${name} checksum (import verification)`);
    }
  });
}
console.log(`Quotation V1 safeguards: ${passed} checks passed.`);
