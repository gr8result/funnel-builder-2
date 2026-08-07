import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { chromium } from "playwright";
import { extractVectorSegmentsFromOperatorList } from "../modules/takeoff-v2/geometry/planVectorExtraction.js";
import { buildPlanGeometryIndex } from "../modules/takeoff-v2/geometry/planGeometryIndex.js";
import { detectExteriorWallsFromGeometry } from "../modules/takeoff-v2/takeoff/vectorExteriorDetection.js";
import { polygonAreaDocUnits2, polygonPerimeter } from "../modules/takeoff-v2/takeoff/geometry.js";

const samplePath = process.env.TAKEOFF_SAMPLE_PLANS_PDF || "C:/Users/grant/Downloads/SAMPLES PLANS W DIMS.pdf";
const outDir = path.resolve("tmp/takeoff-exterior-diagnostics");
fs.mkdirSync(outDir, { recursive: true });

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
}

function lineSvg(a, b, attrs = "") {
  return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" ${attrs} />`;
}

function polylineSvg(points = [], attrs = "") {
  if (!points.length) return "";
  const d = points.map((point) => `${point.x},${point.y}`).join(" ");
  return `<polyline points="${d} ${points[0].x},${points[0].y}" ${attrs} />`;
}

function bandMidpoint(band) {
  const line = band.centreline || band.centerline;
  return { x: (line.start.x + line.end.x) / 2, y: (line.start.y + line.end.y) / 2 };
}

function bandInBox(band, box) {
  const p = bandMidpoint(band);
  return p.x >= box.x1 && p.x <= box.x2 && p.y >= box.y1 && p.y <= box.y2;
}

function pointInBox(point, box) {
  return point.x >= box.x1 && point.x <= box.x2 && point.y >= box.y1 && point.y <= box.y2;
}

function sectionReport(audit = [], boundary = []) {
  const sections = [
    { name: "left side of garage", x1: 344, y1: 390, x2: 390, y2: 650 },
    { name: "garage upper/side returns", x1: 380, y1: 360, x2: 555, y2: 430 },
    { name: "western/left side of house", x1: 344, y1: 640, x2: 430, y2: 725 },
    { name: "alfresco perimeter", x1: 470, y1: 785, x2: 620, y2: 840 },
    { name: "alfresco recess/returns", x1: 470, y1: 700, x2: 525, y2: 820 },
    { name: "upper exterior around FAMILY", x1: 485, y1: 375, x2: 610, y2: 430 },
    { name: "right exterior wall", x1: 590, y1: 380, x2: 640, y2: 795 },
    { name: "lower STUDY/PATIO region", x1: 500, y1: 790, x2: 635, y2: 840 },
    { name: "genuine stepped wall returns", x1: 360, y1: 625, x2: 610, y2: 835 },
  ];
  return sections.map((section) => {
    const bands = audit.filter((band) => bandInBox(band, section));
    const accepted = bands.filter((band) => band.accepted);
    const reasonCounts = new Map();
    bands.filter((band) => !band.accepted).forEach((band) => {
      reasonCounts.set(band.rejectionCode || "OTHER", (reasonCounts.get(band.rejectionCode || "OTHER") || 0) + 1);
    });
    const reason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return {
      expectedExteriorSection: section.name,
      wallBandDetected: bands.length > 0,
      detectedBandIds: bands.slice(0, 12).map((band) => band.id),
      includedInFinalBoundary: accepted.length > 0 && boundary.some((point) => pointInBox(point, section)),
      acceptedBandIds: accepted.slice(0, 12).map((band) => band.id),
      rejectionReason: accepted.length ? null : reason || "NO_WALL_BAND_IN_SECTION",
    };
  });
}

function componentColor(id) {
  const colors = ["#16a34a", "#dc2626", "#2563eb", "#9333ea", "#ea580c", "#0891b2", "#be123c", "#65a30d"];
  return colors[((id || 1) - 1) % colors.length];
}

function svgDocument({ title, width, height, body, note = "" }) {
  return `<!doctype html>
<html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif">
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#f8fafc"/>
  <text x="18" y="30" font-size="18" font-weight="700" fill="#0f172a">${esc(title)}</text>
  <text x="18" y="52" font-size="12" fill="#334155">${esc(note)}</text>
  <g transform="translate(0 70)">${body}</g>
</svg>
</body></html>`;
}

async function savePng(html, name, width, height) {
  const htmlPath = path.join(outDir, `${name}.html`);
  const pngPath = path.join(outDir, `${name}.png`);
  fs.writeFileSync(htmlPath, html);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`file://${htmlPath.replace(/\\/g, "/")}`);
  await page.screenshot({ path: pngPath, fullPage: true });
  await browser.close();
  return pngPath;
}

async function main() {
  if (!fs.existsSync(samplePath)) throw new Error(`Sample PDF not found: ${samplePath}`);
  const data = new Uint8Array(fs.readFileSync(samplePath));
  const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1, rotation: 0 });
  const operatorList = await page.getOperatorList();
  const vectorSegments = extractVectorSegmentsFromOperatorList(
    { fnArray: operatorList.fnArray, argsArray: operatorList.argsArray, OPS: pdfjsLib.OPS },
    { pageWidth: viewport.width, pageHeight: viewport.height },
  );
  const index = { ...buildPlanGeometryIndex(vectorSegments), source: "vector", segmentCount: vectorSegments.length };
  const result = detectExteriorWallsFromGeometry({
    planGeometryIndex: index,
    page: { sourceWidth: viewport.width, sourceHeight: viewport.height, calibration: { mmPerDocumentUnit: 30 } },
    stitchToleranceDocUnits: 6,
  });
  const diagnostics = result.diagnostics || {};
  const audit = diagnostics.wallBandAudit || [];
  const before = diagnostics.boundaryBeforeSimplification || [];
  const after = diagnostics.boundaryAfterSimplification || [];
  const accepted = audit.filter((band) => band.accepted);
  const rejected = audit.filter((band) => !band.accepted);

  const pageWidth = viewport.width;
  const pageHeight = viewport.height + 90;
  const baseLines = vectorSegments
    .filter((line) => line.axis === "horizontal" || line.axis === "vertical")
    .slice(0, 1800)
    .map((line) => lineSvg(line.a, line.b, 'stroke="#cbd5e1" stroke-width="0.45" opacity="0.45"'))
    .join("");
  const bandLines = (bands, color, width = 2, labelled = false) => bands.map((band) => {
    const line = band.centreline || band.centerline;
    const mid = bandMidpoint(band);
    return `${lineSvg(line.start, line.end, `stroke="${color}" stroke-width="${width}" opacity="0.9"`)}${labelled ? `<text x="${mid.x + 2}" y="${mid.y - 2}" font-size="7" fill="#991b1b">${esc(band.id)}</text>` : ""}`;
  }).join("");
  const grey = rejected.filter((band) => /REGION|TITLE|DIMENSION|PAGE_BORDER|ANNOTATION/.test(band.rejectionCode || ""));
  const red = rejected.filter((band) => !grey.includes(band));

  const legend = '<rect x="18" y="72" width="265" height="78" fill="white" opacity="0.88"/><text x="28" y="92" font-size="12" fill="#16a34a">GREEN accepted exterior bands</text><text x="28" y="110" font-size="12" fill="#dc2626">RED structural rejected bands</text><text x="28" y="128" font-size="12" fill="#64748b">GREY annotation/dimension/title/page bands</text><text x="28" y="146" font-size="12" fill="#2563eb">BLUE final/candidate boundary</text>';
  const classificationBody = `${baseLines}${bandLines(grey, "#64748b", 1.5)}${bandLines(red, "#dc2626", 1.8)}${bandLines(accepted, "#16a34a", 2.2)}${polylineSvg(after, 'fill="none" stroke="#2563eb" stroke-width="3" opacity="0.95"')}${legend}`;
  const rejectedBody = `${baseLines}${bandLines(red, "#dc2626", 2, true)}${bandLines(grey, "#94a3b8", 1.2, true)}${polylineSvg(after, 'fill="none" stroke="#2563eb" stroke-width="2.5" opacity="0.9"')}`;
  const componentBody = `${baseLines}${audit.map((band) => {
    const line = band.centreline || band.centerline;
    const mid = bandMidpoint(band);
    return `${lineSvg(line.start, line.end, `stroke="${componentColor(band.componentId)}" stroke-width="2" opacity="0.8"`)}<text x="${mid.x + 2}" y="${mid.y - 2}" font-size="7" fill="${componentColor(band.componentId)}">C${band.componentId}</text>`;
  }).join("")}`;
  const beforeBody = `${baseLines}${bandLines(accepted, "#16a34a", 1.4)}${polylineSvg(before, 'fill="rgba(37,99,235,0.08)" stroke="#2563eb" stroke-width="3"')}`;
  const afterBody = `${baseLines}${bandLines(accepted, "#16a34a", 1.4)}${polylineSvg(after, 'fill="rgba(37,99,235,0.08)" stroke="#2563eb" stroke-width="3"')}${(diagnostics.boundaryEdgeSupport || []).filter((edge) => edge.wallSupportRatio < 0.7).map((edge) => lineSvg(edge.a, edge.b, 'stroke="#ef4444" stroke-width="5" opacity="0.85"')).join("")}`;

  const screenshots = {
    classification: await savePng(svgDocument({ title: "01 Wall Band Classification", width: pageWidth, height: pageHeight, body: classificationBody, note: `${accepted.length} accepted, ${red.length} structural rejected, ${grey.length} annotation/region rejected` }), "01-wall-band-classification", pageWidth, pageHeight),
    rejected: await savePng(svgDocument({ title: "02 Rejected Wall Bands Labelled", width: pageWidth, height: pageHeight, body: rejectedBody, note: "Red/grey labels are wall-band IDs with explicit rejection codes in summary.json" }), "02-rejected-wall-bands-labelled", pageWidth, pageHeight),
    components: await savePng(svgDocument({ title: "03 Building Components", width: pageWidth, height: pageHeight, body: componentBody, note: "Colours identify wall-band component IDs" }), "03-building-components", pageWidth, pageHeight),
    beforeSimplification: await savePng(svgDocument({ title: "04 Boundary Before Simplification", width: pageWidth, height: pageHeight, body: beforeBody, note: `${before.length} boundary points from envelope trace` }), "04-boundary-before-simplification", pageWidth, pageHeight),
    afterSimplification: await savePng(svgDocument({ title: "05 Boundary After Simplification", width: pageWidth, height: pageHeight, body: afterBody, note: `${after.length} boundary points; red edges fail support validation` }), "05-boundary-after-simplification", pageWidth, pageHeight),
  };

  const mmPerDocumentUnit = 30;
  const stats = {
    wallBandsConsidered: audit.length,
    acceptedStructuralBands: accepted.length,
    rejectedStructuralBands: red.length,
    exteriorSupportedBands: accepted.length,
    finalVertices: result.exteriorPerimeter?.points?.length || 0,
    finalSegments: result.segments?.length || 0,
    gaps: result.exteriorPerimeter?.gapCount ?? diagnostics.footprintValidation?.gapCount ?? 0,
    selfIntersections: result.exteriorPerimeter?.selfIntersectionCount ?? diagnostics.footprintValidation?.selfIntersectionCount ?? 0,
    wallSupportRatio: result.exteriorPerimeter?.wallSupportRatio ?? diagnostics.wallSupportRatio ?? 0,
    perimeterMetres: result.exteriorPerimeter ? result.exteriorPerimeter.perimeterDocumentUnits * mmPerDocumentUnit / 1000 : null,
    footprintAreaM2: result.exteriorPerimeter ? result.exteriorPerimeter.areaDocumentUnits * mmPerDocumentUnit * mmPerDocumentUnit / 1000000 : null,
    candidatePerimeterMetres: after.length ? polygonPerimeter(after) * mmPerDocumentUnit / 1000 : null,
    candidateFootprintAreaM2: after.length ? polygonAreaDocUnits2(after) * mmPerDocumentUnit * mmPerDocumentUnit / 1000000 : null,
    firstUnsupportedEdge: diagnostics.footprintValidation?.unsupportedEdge || null,
  };
  const summary = {
    samplePath,
    page: { width: viewport.width, height: viewport.height },
    result: { useful: result.useful, isClosed: result.isClosed, message: result.message, warnings: result.warnings || [] },
    stats,
    expectedSections: sectionReport(audit, result.exteriorPerimeter?.points || after),
    rejectionCounts: audit.reduce((acc, band) => {
      if (band.accepted) acc.ACCEPTED = (acc.ACCEPTED || 0) + 1;
      else acc[band.rejectionCode || "OTHER"] = (acc[band.rejectionCode || "OTHER"] || 0) + 1;
      return acc;
    }, {}),
    screenshots,
  };
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outDir, "wall-band-audit.json"), JSON.stringify(audit, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
