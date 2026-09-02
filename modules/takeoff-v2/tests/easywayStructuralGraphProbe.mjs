// Diagnostic probe for the structural wall-face graph only.
//
// This intentionally does not create exterior/internal wall objects. It reads
// the Easyway PDF vector paths, builds the structural graph, and reports the
// line/node/face-pair counts needed before wall selection is allowed to depend
// on the graph.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractVectorSegmentsFromOperatorList } from "../geometry/planVectorExtraction.js";
import { extractTextBoxesFromTextContent } from "../geometry/pdfTextExtraction.js";
import { buildPlanGeometryIndex } from "../geometry/planGeometryIndex.js";
import { buildStructuralGraph } from "../takeoff/structuralGraph.js";

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
const textContent = await pdfPage.getTextContent();
const textBoxes = extractTextBoxesFromTextContent(textContent, { pageWidth: viewport.width, pageHeight: viewport.height });
const planGeometryIndex = {
  ...buildPlanGeometryIndex(vectorSegments, { pageWidth: viewport.width, pageHeight: viewport.height }),
  source: "pdf-vector",
  rawSegments: vectorSegments,
  textBoxes,
};

const page = {
  sourceWidth: viewport.width,
  sourceHeight: viewport.height,
  calibration: { mmPerDocumentUnit: Number(process.env.TAKEOFF_MM_PER_UNIT) || (25.4 / 72) * 100 },
  exteriorWalls: { constructionType: "brick_veneer", wallThicknessMm: 250 },
  internalWalls: { constructionType: "interior_partition", wallThicknessMm: 90 },
};

const beforeGraph = buildStructuralGraph(
  { ...planGeometryIndex, textBoxes: [] },
  page,
  { textBoxes: [], planRegionBBox: { x: 0, y: 0, width: viewport.width, height: viewport.height } },
);
const graph = buildStructuralGraph(planGeometryIndex, page, { textBoxes });
const pairBuckets = graph.facePairs.reduce((acc, pair) => {
  const key = `${pair.targetThicknessMm}mm`;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});
const rejectionBuckets = graph.rejected.reduce((acc, entry) => {
  acc[entry.reason] = (acc[entry.reason] || 0) + 1;
  return acc;
}, {});

console.log(`plan: ${planPath}`);
console.log(`page: ${Math.round(viewport.width)} x ${Math.round(viewport.height)} pt`);
console.log(`vector segments: ${vectorSegments.length}`);
console.log(`text boxes: ${textBoxes.length}`);
console.log(`scale: ${page.calibration.mmPerDocumentUnit.toFixed(3)} mm/unit`);
console.log("before cleanup:", beforeGraph.summary);
console.log("summary:", graph.summary);
console.log("plan region:", graph.planRegionBBox && {
  x: Math.round(graph.planRegionBBox.x),
  y: Math.round(graph.planRegionBBox.y),
  width: Math.round(graph.planRegionBBox.width),
  height: Math.round(graph.planRegionBBox.height),
});
console.log("face pair buckets:", pairBuckets);
console.log("top rejection buckets:", Object.fromEntries(Object.entries(rejectionBuckets).sort((a, b) => b[1] - a[1]).slice(0, 10)));
console.log("sample nodes:", graph.nodes.slice(0, 12).map((node) => `${node.type}@${Math.round(node.x)},${Math.round(node.y)}`).join(" | "));
console.log("sample face pairs:", graph.facePairs.slice(0, 12).map((pair) => `${Math.round(pair.separationMm)}mm ${pair.faceAId}/${pair.faceBId}`).join(" | "));

const outputDir = path.resolve("test-results/easyway-structural-graph");
fs.mkdirSync(outputDir, { recursive: true });

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" }[char]));
}

function lineSvg(line, { color = "#94a3b8", width = 0.55, opacity = 0.45 } = {}) {
  const a = line.start || line.a;
  const b = line.end || line.b;
  if (!a || !b) return "";
  return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${color}" stroke-width="${width}" opacity="${opacity}" stroke-linecap="round" />`;
}

function rectSvg(box, { color = "#ef4444", opacity = 0.22, width = 0.7 } = {}) {
  if (!box) return "";
  return `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${opacity}" />`;
}

function nodeColor(type) {
  return { L: "#22c55e", T: "#f97316", X: "#8b5cf6", near_intersection: "#eab308", endpoint: "#06b6d4" }[type] || "#06b6d4";
}

function pairColor(mm) {
  if (mm === 70) return "#22d3ee";
  if (mm === 90) return "#2563eb";
  if (mm === 230) return "#f97316";
  if (mm === 250) return "#22c55e";
  return "#a3e635";
}

function svgFor({ mode, crop = null }) {
  const view = crop || { x: 0, y: 0, width: viewport.width, height: viewport.height };
  const cropped = Boolean(crop);
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view.x} ${view.y} ${view.width} ${view.height}" width="${Math.round(view.width * 1.25)}" height="${Math.round(view.height * 1.25)}">`);
  parts.push(`<rect x="${view.x}" y="${view.y}" width="${view.width}" height="${view.height}" fill="#fff" />`);
  const sourceSegments = cropped ? vectorSegments : vectorSegments.filter((_, index) => index % 2 === 0);
  parts.push(`<g id="source-plan">${sourceSegments.map((segment) => lineSvg(segment, { color: "#111827", width: 0.32, opacity: 0.22 })).join("")}</g>`);
  if (mode === "plan-region" && graph.planRegionBBox) parts.push(rectSvg(graph.planRegionBBox, { color: "#dc2626", opacity: 0.9, width: 2 }));
  if (mode === "rejected-dimensions") {
    parts.push(graph.rejected.filter((entry) => String(entry.reason).includes("dimension") || String(entry.reason).includes("dashed")).map((entry) => lineSvg(entry, { color: "#ef4444", width: 0.9, opacity: 0.8 })).join(""));
  }
  if (mode === "rejected-text") {
    parts.push(textBoxes.map((text) => `${rectSvg(text.bbox, { color: "#db2777", opacity: 0.5, width: 0.7 })}<text x="${text.bbox.x}" y="${text.bbox.y}" font-size="${Math.max(4, Math.min(10, text.fontSize))}" fill="#be185d" opacity="0.55">${esc(text.text.slice(0, 20))}</text>`).join(""));
    parts.push(graph.rejected.filter((entry) => entry.reason === "text_glyph_or_label").map((entry) => lineSvg(entry, { color: "#db2777", width: 0.8, opacity: 0.8 })).join(""));
  }
  if (["structural-lines", "nodes", "pairs", "crop"].includes(mode)) {
    parts.push(graph.structuralLines.map((line) => lineSvg(line, { color: "#0ea5e9", width: 0.75, opacity: 0.85 })).join(""));
  }
  if (["pairs", "crop"].includes(mode)) {
    parts.push(graph.facePairs.slice(0, cropped ? 800 : 260).flatMap((pair) => [
      lineSvg(pair.faceA, { color: pairColor(pair.targetThicknessMm), width: 1.1, opacity: 0.72 }),
      lineSvg(pair.faceB, { color: pairColor(pair.targetThicknessMm), width: 1.1, opacity: 0.72 }),
    ]).join(""));
  }
  if (["nodes", "crop"].includes(mode)) {
    parts.push(graph.nodes.map((node) => `<circle cx="${node.x}" cy="${node.y}" r="1.9" fill="${nodeColor(node.type)}" stroke="#0f172a" stroke-width="0.25" opacity="0.95" />`).join(""));
  }
  parts.push("</svg>");
  return parts.join("");
}

async function writePng(name, svg) {
  const svgPath = path.join(outputDir, name.replace(/\.png$/, ".svg"));
  const pngPath = path.join(outputDir, name);
  fs.writeFileSync(svgPath, svg);
  await sharp(Buffer.from(svg)).png().toFile(pngPath);
  return pngPath;
}

function textRegion(patterns, fallback) {
  const matches = textBoxes.filter((box) => patterns.some((pattern) => pattern.test(box.text)));
  if (!matches.length) return fallback;
  const minX = Math.min(...matches.map((box) => box.bbox.x));
  const minY = Math.min(...matches.map((box) => box.bbox.y));
  const maxX = Math.max(...matches.map((box) => box.bbox.x + box.bbox.width));
  const maxY = Math.max(...matches.map((box) => box.bbox.y + box.bbox.height));
  const pad = 135;
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    width: Math.min(viewport.width, maxX + pad) - Math.max(0, minX - pad),
    height: Math.min(viewport.height, maxY + pad) - Math.max(0, minY - pad),
  };
}

const generated = [];
generated.push(await writePng("01-plan-region.png", svgFor({ mode: "plan-region" })));
generated.push(await writePng("02-structural-lines-only.png", svgFor({ mode: "structural-lines" })));
generated.push(await writePng("03-structural-nodes.png", svgFor({ mode: "nodes" })));
generated.push(await writePng("04-wall-face-pairs.png", svgFor({ mode: "pairs" })));
generated.push(await writePng("05-rejected-dimensions.png", svgFor({ mode: "rejected-dimensions" })));
generated.push(await writePng("06-rejected-text.png", svgFor({ mode: "rejected-text" })));

const cropFallback = graph.planRegionBBox || { x: 0, y: 0, width: viewport.width, height: viewport.height };
const crops = [
  ["garage.png", [/GARAGE/i], { x: 450, y: 570, width: 310, height: 260 }],
  ["laundry-workshop.png", [/LAUNDRY/i, /W\/?SHOP/i, /WORKSHOP/i], { x: 520, y: 430, width: 220, height: 260 }],
  ["kitchen-pantry.png", [/KITCHEN/i, /PANTRY/i], { x: 300, y: 430, width: 260, height: 250 }],
  ["media-foyer-study.png", [/MEDIA/i, /FOYER/i, /STUDY/i], { x: 260, y: 620, width: 320, height: 300 }],
  ["family-alfresco.png", [/FAMILY/i, /ALFRESCO/i, /DINING/i], { x: 160, y: 330, width: 390, height: 340 }],
];
for (const [name, patterns, fallback] of crops) {
  generated.push(await writePng(name, svgFor({ mode: "crop", crop: textRegion(patterns, fallback || cropFallback) })));
}

function countInRegion(region) {
  const inside = (point) => point.x >= region.x && point.x <= region.x + region.width && point.y >= region.y && point.y <= region.y + region.height;
  const nodes = graph.nodes.filter((node) => inside(node));
  const pairs = graph.facePairs.filter((pair) => inside(pair.faceA.start) || inside(pair.faceA.end) || inside(pair.faceB.start) || inside(pair.faceB.end));
  return {
    structuralFaceLines: graph.structuralLines.filter((line) => inside(line.start) || inside(line.end)).length,
    L: nodes.filter((node) => node.type === "L").length,
    T: nodes.filter((node) => node.type === "T").length,
    X: nodes.filter((node) => node.type === "X").length,
    endpoints: nodes.filter((node) => node.type === "endpoint").length,
    near: nodes.filter((node) => node.type === "near_intersection").length,
    pairs70: pairs.filter((pair) => pair.targetThicknessMm === 70).length,
    pairs90: pairs.filter((pair) => pair.targetThicknessMm === 90).length,
    pairs230: pairs.filter((pair) => pair.targetThicknessMm === 230).length,
    pairs250: pairs.filter((pair) => pair.targetThicknessMm === 250).length,
  };
}

console.log("room/region diagnostics:");
for (const [name, patterns, fallback] of crops) {
  const region = textRegion(patterns, fallback || cropFallback);
  console.log(`  ${name}:`, countInRegion(region));
}
console.log("diagnostic files:");
generated.forEach((file) => console.log(`  ${file}`));
