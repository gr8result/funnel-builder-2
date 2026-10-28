import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportDirectory = path.resolve(process.argv[2]);
const applicationInputDirectory = path.resolve(process.argv[3]);
if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node scripts/render-wall-stage-review-crops.mjs <accuracy-output> <captured-application-input>');
const report = JSON.parse(fs.readFileSync(path.join(reportDirectory, 'report.json'), 'utf8'));
const page = report.pages[0];
const trace = JSON.parse(fs.readFileSync(path.join(reportDirectory, `page-${page.page}-wall-stage-trace.json`), 'utf8'));
const reading = JSON.parse(fs.readFileSync(path.join(reportDirectory, `page-${page.page}-application-reading.json`), 'utf8'));
const plan = JSON.parse(fs.readFileSync(path.join(applicationInputDirectory, 'application-input.json'), 'utf8'));
const rasterImage = await loadImage(path.join(applicationInputDirectory, 'application-raster.png'));
const rasterCanvas = createCanvas(rasterImage.width, rasterImage.height);
rasterCanvas.getContext('2d').drawImage(rasterImage, 0, 0);
const rasterScaleX = rasterImage.width / plan.logicalWidth;
const rasterScaleY = rasterImage.height / plan.logicalHeight;
const pixelsPerMm = plan.pixelsPerMm;
const outputDirectory = path.join(reportDirectory, 'wall-review-crops');
fs.mkdirSync(outputDirectory, { recursive: true });
const reviewCandidates = trace.reviewCandidates || [];
const acceptedWalls = reading.admitted.walls || [];
const mmToLogical = point => ({ x: point.x * pixelsPerMm, y: point.y * pixelsPerMm });

for (const referenceWall of trace.poorlyMatchedReferenceWalls) {
  const endpoints = [referenceWall.stages.canonicalAccepted.candidateIds, referenceWall.stages.detectorAccepted.candidateIds];
  const reference = JSON.parse(fs.readFileSync(path.join(root, 'recovery/plan-references/liberty-terrace/reference.json'), 'utf8'))
    .walls.find(wall => wall.id === referenceWall.id);
  const a = reference.a, b = reference.b;
  const points = [a, b];
  const margin = 48;
  const source = { x: Math.max(0, Math.min(...points.map(point => point.x)) - margin),
    y: Math.max(0, Math.min(...points.map(point => point.y)) - margin),
    right: Math.min(plan.logicalWidth, Math.max(...points.map(point => point.x)) + margin),
    bottom: Math.min(plan.logicalHeight, Math.max(...points.map(point => point.y)) + margin) };
  const sourceWidth = Math.max(1, source.right - source.x), sourceHeight = Math.max(1, source.bottom - source.y);
  const size = 900, scale = size / Math.max(sourceWidth, sourceHeight);
  const canvas = createCanvas(size, size), context = canvas.getContext('2d');
  context.fillStyle = '#fff'; context.fillRect(0, 0, size, size);
  context.drawImage(rasterCanvas, source.x * rasterScaleX, source.y * rasterScaleY,
    sourceWidth * rasterScaleX, sourceHeight * rasterScaleY, 0, 0, sourceWidth * scale, sourceHeight * scale);
  const project = point => ({ x: (point.x - source.x) * scale, y: (point.y - source.y) * scale });
  const drawMmPolyline = (nodes, color, width, dash = []) => {
    if (!Array.isArray(nodes) || nodes.length < 2) return;
    context.save(); context.strokeStyle = color; context.lineWidth = width; context.setLineDash(dash);
    context.beginPath(); nodes.forEach((point, index) => { const screen = project(mmToLogical(point)); if (index) context.lineTo(screen.x, screen.y); else context.moveTo(screen.x, screen.y); });
    context.stroke(); context.restore();
  };
  context.save(); context.strokeStyle = '#16a34a'; context.lineWidth = 5; context.setLineDash([]);
  context.beginPath(); context.moveTo(...Object.values(project(points[0]))); context.lineTo(...Object.values(project(points[1]))); context.stroke(); context.restore();
  for (const wall of acceptedWalls) drawMmPolyline(wall.points, wall.category === 'exterior' ? '#2563eb' : '#c026d3', 3);
  for (const candidate of reviewCandidates) drawMmPolyline(candidate.points, '#d97706', 3, [10, 7]);
  for (const rejected of referenceWall.detectorRejectedCandidates || []) drawMmPolyline([rejected.a, rejected.b], '#7c3aed', 3, [5, 5]);
  context.fillStyle = 'rgba(255,255,255,0.95)'; context.fillRect(0, 0, size, 34);
  context.fillStyle = '#111827'; context.font = '17px sans-serif';
  context.fillText(`${referenceWall.id} | detector ${referenceWall.stages.detectorAccepted.foundShare.toFixed(2)} | model ${referenceWall.stages.connectedModel.foundShare.toFixed(2)} | accepted ${referenceWall.finalAcceptedShare.toFixed(2)} | loss ${referenceWall.lossStage || 'none'}`, 9, 23);
  const basename = referenceWall.id.replace(/[^a-z0-9-]/gi, '_');
  fs.writeFileSync(path.join(outputDirectory, `${basename}.png`), canvas.toBuffer('image/png'));
  fs.writeFileSync(path.join(outputDirectory, `${basename}.json`), JSON.stringify({ id: referenceWall.id,
    expectedCategory: referenceWall.expectedCategory, lengthMm: referenceWall.lengthMm, stages: referenceWall.stages,
    lossStage: referenceWall.lossStage, detectorRejectedCandidates: referenceWall.detectorRejectedCandidates,
    connectedModelCandidates: referenceWall.stages.connectedModel.candidateIds, adapterCandidates: referenceWall.stages.adapterResponse.candidateIds,
    canonicalCandidates: referenceWall.stages.canonicalAccepted.candidateIds,
    colors: { reference: 'green', accepted: 'blue exterior / magenta interior', reviewCandidate: 'dashed amber, not quantity eligible', nearbyDetectorRejection: 'dashed violet' } }, null, 2));
}
console.log(`Rendered ${trace.poorlyMatchedReferenceWalls.length} reference-focused review crops to ${outputDirectory}`);