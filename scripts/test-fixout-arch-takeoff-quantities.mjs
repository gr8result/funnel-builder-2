// FIX OUT architrave sets follow the AI Plan Takeoff door and window schedules:
// INTERNAL DOOR ARCHS = hinged internal doors + cavity sliders, WINDOW ARCHS = windows (quantities
// summed), ROBE ARCHS = robe doors. Entry, sliding glass and garage doors are never counted.
//
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-fixout-arch-takeoff-quantities.mjs
import assert from "node:assert/strict";
import { __quotationPersistenceTestUtils as T } from "../hooks/estimate-builder/useEstimateBuilderWorkbook.js";
import { createEstimateBuilderWorkbookDefaults } from "../lib/construction-estimation/estimateBuilderWorkbookDefaults.js";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";

const wall = (id, category, x) => ({ id, page: 1, level: "Ground Floor", category, lengthMm: 6000, nodes: [{ x, y: 0 }, { x: x + 6000, y: 0 }], thicknessMm: 90, frameThicknessMm: 90, constructionSystem: category === "exterior" ? "brick_veneer" : undefined });
let n = 0;
const opening = (hostWallId, type, subType, extra = {}) => ({ id: `o${++n}`, page: 1, level: "Ground Floor", hostWallId, type, subType, widthMm: 820, heightMm: 2040, ...extra });

function takeoff({ hinged, cavity, robes, windows }) {
  n = 0;
  return {
    pixelsPerMm: 1,
    sheetLevels: { 1: "Ground Floor" },
    completedWallRuns: [wall("ext", "exterior", 0), wall("int", "interior", 10000)],
    placedOpenings: [
      ...hinged.map((quantity) => opening("int", "door", "Internal", { quantity })),
      ...Array.from({ length: cavity }, () => opening("int", "door", "Cavity")),
      ...Array.from({ length: robes }, () => opening("int", "door", "Robe", { widthMm: 1800 })),
      ...windows.map((quantity) => opening("ext", "window", "Awning", { quantity, widthMm: 1200, heightMm: 1200 })),
      opening("ext", "door", "Entry"),
      opening("ext", "door", "SlidingGlass", { widthMm: 2400 }),
      opening("ext", "door", "PanelLift", { widthMm: 4800, heightMm: 2100 }),
    ],
  };
}

function fixOut(job) {
  const saved = createEstimateBuilderWorkbookDefaults();
  saved.aiPlanTakeoffJob = job;
  const name = Object.keys(saved.quotation).find((section) => /^fix out/i.test(section));
  // A stale, previously typed quantity must not survive: Takeoff owns these rows.
  Object.assign(saved.quotation[name].rows.find((row) => row.id === "quote-1361"), { quantity: "99" });
  const workbook = T.normalizeWorkbook(saved);
  const result = calculateEstimateBuilderWorkbook(workbook);
  const rows = result.quotation[name].rows;
  const row = (id) => rows.find((entry) => entry.id === id);
  return { name, q: result.quantities, internal: row("quote-1357"), window: row("quote-1361"), robe: row("quote-1362"), untouched: row("quote-1358"), order: rows.map((entry) => entry.id) };
}

function check(label, job, expected) {
  const r = fixOut(job);
  assert.deepEqual([r.q.takeoffInternalDoorCount, r.q.takeoffWindowCount, r.q.takeoffRobeDoorCount], expected);
  for (const [row, qty] of [[r.internal, expected[0]], [r.window, expected[1]], [r.robe, expected[2]]]) {
    assert.equal(row.qty, qty, `${row.item} qty`);
    assert.equal(row.unit, "EACH");
    assert.equal(row.cost, Math.round(qty * 1.5 * 100) / 100, `${row.item}: Qty x $1.50`);
  }
  assert.equal(r.untouched.qty, 0, "other FIX OUT rows unchanged");
  console.log(`${label} [${r.name}]`);
  for (const row of [r.internal, r.window, r.robe]) console.log(`  ${row.item}: Qty ${row.qty} ${row.unit} x ${row.finalRateUsed} = $${row.cost.toFixed(2)} (${row.quantityKey})`);
  return r.order;
}

const orderA = check("Fixture A: 4 hinged (one qty 2) + 1 cavity, windows 1 + 3, 2 robes, plus entry/sliding glass/garage", takeoff({ hinged: [1, 1, 1, 2], cavity: 1, robes: 2, windows: [1, 3] }), [6, 4, 2]);
const orderB = check("Fixture B: Takeoff changed - 2 hinged + 2 cavity, windows 1 + 3 + 2 + 1, 1 robe", takeoff({ hinged: [1, 1], cavity: 2, robes: 1, windows: [1, 3, 2, 1] }), [4, 7, 1]);
assert.deepEqual(orderA, orderB, "row order unchanged");
console.log("\nFIX OUT arch Takeoff quantity tests passed.");
