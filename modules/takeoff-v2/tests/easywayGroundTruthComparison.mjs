// Ground-truth comparison probe for the Easyway Page 2 plan. This is a
// diagnostic/acceptance script, not production logic.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractVectorSegmentsFromOperatorList } from "../geometry/planVectorExtraction.js";
import { buildPlanGeometryIndex } from "../geometry/planGeometryIndex.js";
import { extractTextBoxesFromTextContent } from "../geometry/pdfTextExtraction.js";
import { buildStructuralGraph, resolveWallRunFromStructuralGraph } from "../takeoff/structuralGraph.js";
import { openingWorkflowPatch } from "../takeoff/windowWorkflow.js";
import { withPlanPageDefaults } from "../types.js";
import { easywayPage2GroundTruth, allGroundTruthWalls } from "./fixtures/easywayPage2GroundTruth.js";

const planPath = process.env.TAKEOFF_EASYWAY_PDF || easywayPage2GroundTruth.source;
if (!fs.existsSync(planPath)) {
  console.error(`Plan not found: ${planPath}`);
  process.exit(2);
}

const outputDir = path.resolve("test-results/easyway-ground-truth");
fs.mkdirSync(outputDir, { recursive: true });

const data = new Uint8Array(fs.readFileSync(planPath));
const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
const pdfPage = await pdf.getPage(easywayPage2GroundTruth.pageNumber);
const viewport = pdfPage.getViewport({ scale: 1, rotation: 0 });
const operatorList = await pdfPage.getOperatorList();
const vectorSegments = extractVectorSegmentsFromOperatorList(
  { fnArray: operatorList.fnArray, argsArray: operatorList.argsArray, OPS: pdfjsLib.OPS },
  { pageWidth: viewport.width, pageHeight: viewport.height },
);
const textBoxes = extractTextBoxesFromTextContent(await pdfPage.getTextContent(), { pageWidth: viewport.width, pageHeight: viewport.height });
const planGeometryIndex = {
  ...buildPlanGeometryIndex(vectorSegments, { pageWidth: viewport.width, pageHeight: viewport.height }),
  source: "pdf-vector",
  rawSegments: vectorSegments,
  textBoxes,
};
const page = {
  sourceWidth: viewport.width,
  sourceHeight: viewport.height,
  calibration: { mmPerDocumentUnit: easywayPage2GroundTruth.scale.mmPerDocumentUnit },
  exteriorWalls: { constructionType: "brick_veneer", wallThicknessMm: 230 },
  internalWalls: { constructionType: "interior_partition", wallThicknessMm: 90 },
};
const graph = buildStructuralGraph(planGeometryIndex, page, { textBoxes });

function length(run) {
  return Math.hypot(run.end.x - run.start.x, run.end.y - run.start.y);
}

function axis(run) {
  return Math.abs(run.end.x - run.start.x) >= Math.abs(run.end.y - run.start.y) ? "h" : "v";
}

function overlap1d(a0, a1, b0, b1) {
  const minA = Math.min(a0, a1);
  const maxA = Math.max(a0, a1);
  const minB = Math.min(b0, b1);
  const maxB = Math.max(b0, b1);
  return Math.max(0, Math.min(maxA, maxB) - Math.max(minA, minB));
}

function wallOverlap(expected, detected, tolerance = 11) {
  const expectedAxis = axis(expected);
  const detectedAxis = axis(detected);
  if (expectedAxis !== detectedAxis) return 0;
  if (expectedAxis === "h") {
    const yDelta = Math.abs((expected.start.y + expected.end.y) / 2 - (detected.start.y + detected.end.y) / 2);
    if (yDelta > tolerance) return 0;
    return overlap1d(expected.start.x, expected.end.x, detected.start.x, detected.end.x);
  }
  const xDelta = Math.abs((expected.start.x + expected.end.x) / 2 - (detected.start.x + detected.end.x) / 2);
  if (xDelta > tolerance) return 0;
  return overlap1d(expected.start.y, expected.end.y, detected.start.y, detected.end.y);
}

function detectedAssemblyRuns(kind) {
  const assemblies = kind === "exterior" ? graph.exteriorAssemblies : graph.interiorAssemblies;
  return assemblies.map((assembly, index) => ({
    id: `${kind}-detected-${index + 1}`,
    kind,
    thicknessMm: assembly.thicknessMm,
    confidence: kind === "exterior" ? assembly.exteriorScore : assembly.interiorScore,
    start: assembly.centerline?.start || assembly.pair?.centerline?.start || assembly.faceA?.start,
    end: assembly.centerline?.end || assembly.pair?.centerline?.end || assembly.faceA?.end,
    assembly,
  })).filter((run) => run.start && run.end && length(run) > 1);
}

const detectedExterior = detectedAssemblyRuns("exterior");
const detectedInterior = detectedAssemblyRuns("interior");
const expectedExterior = easywayPage2GroundTruth.exteriorWallBands;
const expectedInterior = easywayPage2GroundTruth.interiorWallBands;

function compareWalls(expected, detected) {
  const expectedLength = expected.reduce((total, wall) => total + length(wall), 0);
  const detectedLength = detected.reduce((total, wall) => total + length(wall), 0);
  const matchedExpected = new Set();
  const matchedDetected = new Set();
  let matchedLength = 0;
  expected.forEach((truth) => {
    let best = { detected: null, overlap: 0 };
    detected.forEach((candidate) => {
      const overlap = wallOverlap(truth, candidate);
      if (overlap > best.overlap) best = { detected: candidate, overlap };
    });
    if (best.detected && best.overlap / Math.max(1, length(truth)) >= 0.45) {
      matchedExpected.add(truth.id);
      matchedDetected.add(best.detected.id);
      matchedLength += Math.min(best.overlap, length(truth));
    }
  });
  return {
    expectedCount: expected.length,
    detectedCount: detected.length,
    expectedLength,
    detectedLength,
    matchedLength,
    precision: detectedLength > 0 ? matchedLength / detectedLength : 0,
    recall: expectedLength > 0 ? matchedLength / expectedLength : 0,
    missed: expected.filter((wall) => !matchedExpected.has(wall.id)).map((wall) => wall.id),
    falseItems: detected.filter((wall) => !matchedDetected.has(wall.id)).map((wall) => wall.id),
  };
}

function comparePoints(expected, detectedNodes, acceptedTypes) {
  const candidates = detectedNodes.filter((node) => acceptedTypes.includes(node.type));
  const matchedExpected = new Set();
  const matchedDetected = new Set();
  expected.forEach((truth) => {
    let best = { node: null, distance: 14 };
    candidates.forEach((node) => {
      const d = Math.hypot(node.x - truth.point.x, node.y - truth.point.y);
      if (d < best.distance) best = { node, distance: d };
    });
    if (best.node) {
      matchedExpected.add(truth.id);
      matchedDetected.add(best.node.id);
    }
  });
  return {
    expectedCount: expected.length,
    detectedCount: candidates.length,
    matched: matchedExpected.size,
    precision: candidates.length ? matchedDetected.size / candidates.length : 0,
    recall: expected.length ? matchedExpected.size / expected.length : 0,
    missed: expected.filter((item) => !matchedExpected.has(item.id)).map((item) => item.id),
  };
}

function seedResults(expected) {
  return expected.map((wall) => {
    const seed = { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 };
    const result = resolveWallRunFromStructuralGraph(seed, {
      graph,
      planGeometryIndex,
      page,
      zoomScale: 1,
      wallType: wall.kind,
      field: wall.kind === "exterior" ? "exteriorWalls" : "internalWalls",
    });
    return {
      id: wall.id,
      click: seed,
      wallType: wall.kind,
      expectedThicknessMm: wall.thicknessMm,
      status: result.status,
      reason: result.reason || "",
      detectedThicknessMm: result.metadata?.thicknessMm ?? null,
      traceStart: result.start || null,
      traceEnd: result.end || null,
      matchesPlan: result.status === "resolved" && wallOverlap(wall, result) / Math.max(1, length(wall)) >= 0.45,
    };
  });
}

const exteriorComparison = compareWalls(expectedExterior, detectedExterior);
const interiorComparison = compareWalls(expectedInterior, detectedInterior);
const cornerComparison = comparePoints(easywayPage2GroundTruth.corners, graph.nodes, ["L"]);
const intersectionComparison = comparePoints(easywayPage2GroundTruth.junctions, graph.nodes, ["T", "X", "near_intersection"]);
const seedChecks = [...seedResults(expectedExterior), ...seedResults(expectedInterior)];
const openingsComparison = {
  expectedCount: easywayPage2GroundTruth.openings.length,
  detectedCount: 0,
  precision: 0,
  recall: 0,
  missed: easywayPage2GroundTruth.openings.map((opening) => opening.id),
  falseItems: [],
};

const sampleOpening = easywayPage2GroundTruth.openings.find((opening) => opening.openingType === "window");
const sampleWorkflow = openingWorkflowPatch(sampleOpening ? [{
  id: sampleOpening.id,
  openingType: "window",
  windowType: "window",
  code: "W-GT-01",
  widthMm: sampleOpening.widthMm,
  heightMm: 1200,
  quantity: 1,
  level: "Ground Level",
  room: "Family",
  elevation: "East",
  frameMaterial: "Aluminium",
  frameColour: "Monument",
  glazingType: "Low-E",
  supplier: "Fixture supplier",
  productModel: "Fixture model",
  source: "manual-ground-truth-probe",
  confirmed: true,
}] : [], { id: "easyway-page-2", documentId: "easyway-fixture" });
const reloadedSamplePage = withPlanPageDefaults(JSON.parse(JSON.stringify({
  id: "easyway-page-2",
  documentId: "easyway-fixture",
  pageNumber: easywayPage2GroundTruth.pageNumber,
  sourceWidth: viewport.width,
  sourceHeight: viewport.height,
  openings: sampleOpening ? [{ id: sampleOpening.id, openingType: "window", start: sampleOpening.start, end: sampleOpening.end }] : [],
  ...sampleWorkflow,
})));

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" }[char]));
}

function sourceLineSvg(segment) {
  return `<line x1="${segment.a.x}" y1="${segment.a.y}" x2="${segment.b.x}" y2="${segment.b.y}" stroke="#111827" stroke-width="0.25" opacity="0.18" />`;
}

function runSvg(run, { color, width = 3, opacity = 0.9, label = "" }) {
  const mid = { x: (run.start.x + run.end.x) / 2, y: (run.start.y + run.end.y) / 2 };
  return [
    `<line x1="${run.start.x}" y1="${run.start.y}" x2="${run.end.x}" y2="${run.end.y}" stroke="${color}" stroke-width="${width}" opacity="${opacity}" stroke-linecap="round" />`,
    label ? `<text x="${mid.x + 3}" y="${mid.y - 3}" font-size="6" fill="${color}" font-weight="700">${esc(label)}</text>` : "",
  ].join("");
}

function pointSvg(item, color) {
  return `<circle cx="${item.point.x}" cy="${item.point.y}" r="4" fill="${color}" opacity="0.85"><title>${esc(item.id)}</title></circle>`;
}

function svgDocument({ mode }) {
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewport.width} ${viewport.height}" width="${Math.round(viewport.width * 1.35)}" height="${Math.round(viewport.height * 1.35)}">`);
  parts.push(`<rect x="0" y="0" width="${viewport.width}" height="${viewport.height}" fill="#fff" />`);
  parts.push(vectorSegments.filter((_, index) => index % 2 === 0).map(sourceLineSvg).join(""));
  if (mode === "ground-truth") {
    parts.push(expectedExterior.map((run) => runSvg(run, { color: "#16a34a", width: 4, label: run.id })).join(""));
    parts.push(expectedInterior.map((run) => runSvg(run, { color: "#2563eb", width: 3, label: run.id })).join(""));
    parts.push(easywayPage2GroundTruth.corners.map((point) => pointSvg(point, "#f97316")).join(""));
    parts.push(easywayPage2GroundTruth.junctions.map((point) => pointSvg(point, "#8b5cf6")).join(""));
    parts.push(easywayPage2GroundTruth.openings.map((opening) => runSvg(opening, { color: opening.openingType === "window" ? "#eab308" : "#ef4444", width: 5, label: opening.id })).join(""));
  } else {
    parts.push(detectedExterior.map((run) => runSvg(run, { color: "#22c55e", width: 4, label: run.id })).join(""));
    parts.push(detectedInterior.map((run) => runSvg(run, { color: "#0ea5e9", width: 3, label: run.id })).join(""));
    parts.push(graph.nodes.map((node) => `<circle cx="${node.x}" cy="${node.y}" r="2" fill="${node.type === "L" ? "#f97316" : node.type === "T" ? "#8b5cf6" : node.type === "X" ? "#db2777" : "#64748b"}" opacity="0.85" />`).join(""));
  }
  parts.push("</svg>");
  return parts.join("");
}

async function writeImage(name, svg) {
  const svgPath = path.join(outputDir, name.replace(/\.png$/, ".svg"));
  const pngPath = path.join(outputDir, name);
  fs.writeFileSync(svgPath, svg);
  await sharp(Buffer.from(svg)).png().toFile(pngPath);
  return pngPath;
}

const groundTruthImage = await writeImage("01-ground-truth.png", svgDocument({ mode: "ground-truth" }));
const detectedImage = await writeImage("02-detected-result.png", svgDocument({ mode: "detected" }));

const report = {
  planPath,
  page: { width: viewport.width, height: viewport.height },
  pipeline: {
    geometrySource: planGeometryIndex.source,
    vectorSegments: vectorSegments.length,
    rasterFallbackUsed: planGeometryIndex.source === "raster",
    detectionCoordinates: "canonical unrotated PDF page coordinates",
    detectorInput: "full PDF operator-list vector paths at scale=1, not displayed preview",
  },
  graphSummary: graph.summary,
  exteriorWall: exteriorComparison,
  interiorWall: interiorComparison,
  corners: cornerComparison,
  intersections: intersectionComparison,
  openings: openingsComparison,
  seedChecks,
  confirmedExteriorLengthMm: exteriorComparison.matchedLength * page.calibration.mmPerDocumentUnit,
  confirmedInteriorLengthMm: interiorComparison.matchedLength * page.calibration.mmPerDocumentUnit,
  sampleWindowRecord: sampleWorkflow.windowRecords[0] || null,
  sampleWindowsDoorsRecord: sampleWorkflow.windowsDoorsModel?.rows?.[0] || null,
  sampleQuotationLine: sampleWorkflow.quotationBuilderModel?.windowLineItems?.[0] || null,
  saveReloadShapeVerified: Boolean(
    reloadedSamplePage.windowRecords?.[0] &&
    reloadedSamplePage.windowsDoorsModel?.rows?.[0] &&
    reloadedSamplePage.quotationBuilderModel?.windowLineItems?.[0]
  ),
  images: { groundTruthImage, detectedImage },
};

fs.writeFileSync(path.join(outputDir, "comparison-report.json"), JSON.stringify(report, null, 2));

console.log("pipeline:", report.pipeline);
console.log("graph summary:", graph.summary);
console.log("exterior:", {
  precision: Number(report.exteriorWall.precision.toFixed(3)),
  recall: Number(report.exteriorWall.recall.toFixed(3)),
  missed: report.exteriorWall.missed,
  falseItems: report.exteriorWall.falseItems,
});
console.log("corners:", {
  precision: Number(report.corners.precision.toFixed(3)),
  recall: Number(report.corners.recall.toFixed(3)),
  missed: report.corners.missed,
});
console.log("intersections:", {
  precision: Number(report.intersections.precision.toFixed(3)),
  recall: Number(report.intersections.recall.toFixed(3)),
  missed: report.intersections.missed,
});
console.log("interior:", {
  precision: Number(report.interiorWall.precision.toFixed(3)),
  recall: Number(report.interiorWall.recall.toFixed(3)),
  missed: report.interiorWall.missed,
  falseItems: report.interiorWall.falseItems,
});
console.log("openings:", report.openings);
console.log("confirmed exterior length mm:", Math.round(report.confirmedExteriorLengthMm));
console.log("confirmed interior length mm:", Math.round(report.confirmedInteriorLengthMm));
console.log("sample window record:", report.sampleWindowRecord?.id || "none");
console.log("sample quotation line:", report.sampleQuotationLine?.id || "none");
console.log("images:");
console.log(`  ${groundTruthImage}`);
console.log(`  ${detectedImage}`);
console.log(`  ${path.join(outputDir, "comparison-report.json")}`);
