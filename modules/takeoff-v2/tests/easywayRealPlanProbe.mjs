// Diagnostic probe (not an assertion test): runs the real Easyway ground
// floor plan through the opening-span and wall-band logic and reports what it
// finds, so the garage / front-entry behaviour can be checked against actual
// plan geometry rather than synthetic fixtures.
//
//   node modules/takeoff-v2/tests/easywayRealPlanProbe.mjs
//   TAKEOFF_EASYWAY_PDF="path/to/plan.pdf" node ...
//
// Set TAKEOFF_MM_PER_UNIT to override the assumed scale.

import fs from "node:fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractVectorSegmentsFromOperatorList } from "../geometry/planVectorExtraction.js";
import { buildPlanGeometryIndex } from "../geometry/planGeometryIndex.js";
import { detectManualWallBandForSegment, detectWallRunFromSeed, isStructuralPlanLine } from "../takeoff/manualWallBand.js";
import { classifyOpeningWidthMm, projectRawSegmentToGuide, findJambsAt } from "../takeoff/wallOpeningSpan.js";

const planPath = process.env.TAKEOFF_EASYWAY_PDF || "C:/Users/grant/Downloads/2 GROUND FLOOR PLAN.pdf";
if (!fs.existsSync(planPath)) {
  console.error(`Plan not found: ${planPath}`);
  process.exit(2);
}

const data = new Uint8Array(fs.readFileSync(planPath));
const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
const pdfPage = await pdf.getPage(1);
const viewport = pdfPage.getViewport({ scale: 1, rotation: 0 });
const operatorList = await pdfPage.getOperatorList();
const vectorSegments = extractVectorSegmentsFromOperatorList(
  { fnArray: operatorList.fnArray, argsArray: operatorList.argsArray, OPS: pdfjsLib.OPS },
  { pageWidth: viewport.width, pageHeight: viewport.height },
);
const planGeometryIndex = {
  ...buildPlanGeometryIndex(vectorSegments, { pageWidth: viewport.width, pageHeight: viewport.height }),
  source: "vector",
  segmentCount: vectorSegments.length,
};

console.log(`plan: ${planPath}`);
console.log(`page: ${Math.round(viewport.width)} x ${Math.round(viewport.height)} pt, ${vectorSegments.length} vector segments`);

// A PDF point is 1/72", so at 1:100 one point represents 25.4/72*100 mm.
const mmPerDocumentUnit = Number(process.env.TAKEOFF_MM_PER_UNIT) || (25.4 / 72) * 100;
console.log(`assumed scale: ${mmPerDocumentUnit.toFixed(3)} mm per document unit (1:100)\n`);

const page = {
  sourceWidth: viewport.width,
  sourceHeight: viewport.height,
  calibration: { mmPerDocumentUnit },
  exteriorWalls: { constructionType: "brick_veneer", wallThicknessMm: 250, thicknessLocked: true },
  internalWalls: { constructionType: "interior_partition", wallThicknessMm: 90, thicknessLocked: true },
};

const raw = planGeometryIndex.rawSegments || vectorSegments;

// Find horizontal wall-face runs, group them by y, and look for gaps that are
// bounded by jamb returns - i.e. candidate door / garage openings.
const guide = { ux: 1, uy: 0, nx: 0, ny: 1, angle: 0 };
const projected = raw.map((s) => projectRawSegmentToGuide(s, guide)).filter(Boolean);
const horizontals = projected.filter((l) => l.angleDiffFromGuide <= 2 && l.length >= 8);

const byY = new Map();
horizontals.forEach((l) => {
  const key = Math.round(l.fixed * 2) / 2;
  if (!byY.has(key)) byY.set(key, []);
  byY.get(key).push(l);
});

const thicknessRange = { min: 200 / mmPerDocumentUnit, max: 300 / mmPerDocumentUnit, target: 240 / mmPerDocumentUnit };
console.log(`exterior thickness window: ${thicknessRange.min.toFixed(1)} - ${thicknessRange.max.toFixed(1)} doc units\n`);

// Pair up face rows separated by a plausible exterior thickness.
const rows = [...byY.keys()].sort((a, b) => a - b);
const pairs = [];
rows.forEach((low) => {
  rows.forEach((high) => {
    const t = high - low;
    if (t >= thicknessRange.min && t <= thicknessRange.max) pairs.push([low, high]);
  });
});

const found = [];
pairs.forEach(([lowY, highY]) => {
  const lines = [...(byY.get(lowY) || []), ...(byY.get(highY) || [])].sort((a, b) => a.startAlong - b.startAlong);
  if (lines.length < 2) return;
  // merge coverage
  const merged = [];
  lines.forEach((l) => {
    const cur = merged[merged.length - 1];
    if (cur && l.startAlong <= cur.end + 10) cur.end = Math.max(cur.end, l.endAlong);
    else merged.push({ start: l.startAlong, end: l.endAlong });
  });
  for (let i = 1; i < merged.length; i += 1) {
    const gapStart = merged[i - 1].end;
    const gapEnd = merged[i].start;
    const widthMm = (gapEnd - gapStart) * mmPerDocumentUnit;
    if (!(widthMm >= 600 && widthMm <= 7200)) continue;
    const startJambs = findJambsAt(projected, { along: gapStart, faceLowFixed: lowY, faceHighFixed: highY });
    const endJambs = findJambsAt(projected, { along: gapEnd, faceLowFixed: lowY, faceHighFixed: highY });
    // Only report gaps closed off at BOTH ends, otherwise this degenerates
    // into every drafting break on the sheet.
    if (!startJambs.length || !endJambs.length) continue;
    const cls = classifyOpeningWidthMm(widthMm, { hasStartJamb: true, hasEndJamb: true });
    if (!cls) continue;
    found.push({ lowY, highY, gapStart, gapEnd, widthMm, startJambs: startJambs.length, endJambs: endJambs.length, type: cls.type });
  }
});

found.sort((a, b) => b.widthMm - a.widthMm);
console.log(`candidate horizontal openings bounded by exterior-thickness face pairs: ${found.length}`);
found.slice(0, 14).forEach((f) => {
  console.log(
    `  ${f.type.padEnd(18)} ${Math.round(f.widthMm).toString().padStart(5)} mm  `
    + `x ${f.gapStart.toFixed(0)}..${f.gapEnd.toFixed(0)}  y ${f.lowY.toFixed(0)}/${f.highY.toFixed(0)}  `
    + `jambs ${f.startJambs}/${f.endJambs}`,
  );
});

// Now the actual acceptance behaviour: does a jamb-to-jamb trace resolve?
console.log("\njamb-to-jamb band resolution (what clicking jamb A then jamb B does):");
let resolved = 0;
found.slice(0, 14).forEach((f) => {
  const midY = (f.lowY + f.highY) / 2;
  const band = detectManualWallBandForSegment(
    { x: f.gapStart, y: midY },
    { x: f.gapEnd, y: midY },
    { planGeometryIndex, page, wallType: "exterior" },
  );
  const ok = band?.geometryStatus === "resolved";
  if (ok) resolved += 1;
  console.log(
    `  ${Math.round(f.widthMm).toString().padStart(5)} mm  -> ${ok ? "RESOLVED" : "unresolved"}`
    + `  ${ok ? `${band.openingSpan?.type || "(no span)"} thickness ${Math.round(band.thicknessMm || 0)}mm` : band?.resolutionFailure || ""}`,
  );
});
console.log(`\nresolved ${resolved} / ${Math.min(found.length, 14)} candidate openings`);

console.log("\none-click seeded wall-run scan:");
const structuralSeeds = raw
  .filter((segment) => isStructuralPlanLine(segment, page))
  .map((segment) => ({
    x: (segment.a.x + segment.b.x) / 2,
    y: (segment.a.y + segment.b.y) / 2,
    length: Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y),
  }))
  .filter((seed) => seed.length >= 20)
  .sort((left, right) => right.length - left.length)
  .slice(0, 260);

for (const wallType of ["exterior", "internal"]) {
  const field = wallType === "exterior" ? "exteriorWalls" : "internalWalls";
  let seedResolved = 0;
  const failures = {};
  const examples = [];
  structuralSeeds.forEach((seed) => {
    const result = detectWallRunFromSeed(seed, { planGeometryIndex, page, wallType, field, zoomScale: 1 });
    if (result.status === "resolved") {
      seedResolved += 1;
      if (examples.length < 8) {
        examples.push(
          `${Math.round(seed.x)},${Math.round(seed.y)} -> `
          + `${Math.round(result.start.x)},${Math.round(result.start.y)}..${Math.round(result.end.x)},${Math.round(result.end.y)} `
          + `${Math.round(result.metadata.thicknessMm || 0)}mm`,
        );
      }
      return;
    }
    failures[result.reason || "not_found"] = (failures[result.reason || "not_found"] || 0) + 1;
  });
  console.log(`  ${wallType}: ${seedResolved}/${structuralSeeds.length} resolved`, failures);
  examples.forEach((example) => console.log(`    ${example}`));
}
