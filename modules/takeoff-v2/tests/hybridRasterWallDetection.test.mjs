import assert from "node:assert/strict";
import {
  adaptiveThreshold,
  bridgeShortGaps,
  connectedComponents,
  contourFromMask,
  createPdfRasterTransform,
  morphClose,
  removeThinIsolatedStrokes,
  selectPrimaryBuildingComponent,
  selfIntersectionCount,
  simplifyCollinear,
  snapContourToVectorGeometry,
} from "../experimental/hybridRasterWallDetection.js";

function mask(width, height, fill = 0) {
  return new Uint8Array(width * height).fill(fill);
}

function fillRect(m, width, x1, y1, x2, y2, value = 1) {
  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) m[y * width + x] = value;
  }
}

{
  const transform = createPdfRasterTransform({ dpi: 400, pageWidth: 720, pageHeight: 360 });
  const rasterPoint = transform.pdfToRaster({ x: 72, y: 36 });
  assert.ok(Math.abs(rasterPoint.x - 400) < 1e-9);
  assert.ok(Math.abs(rasterPoint.y - 200) < 1e-9);
  const pdfPoint = transform.rasterToPdf(rasterPoint);
  assert.ok(Math.abs(pdfPoint.x - 72) < 1e-9);
  assert.ok(Math.abs(pdfPoint.y - 36) < 1e-9);
}

{
  const a = createPdfRasterTransform({ dpi: 300, pageWidth: 100, pageHeight: 100 });
  const b = createPdfRasterTransform({ dpi: 600, pageWidth: 100, pageHeight: 100 });
  assert.ok(Math.abs(b.width - a.width * 2) <= 1);
  assert.deepEqual(b.rasterToPdf(b.pdfToRaster({ x: 33, y: 44 })), { x: 33, y: 44 });
}

{
  const width = 40;
  const height = 24;
  const m = mask(width, height);
  fillRect(m, width, 3, 10, 36, 10, 1); // isolated one-pixel dimension line
  fillRect(m, width, 8, 4, 30, 8, 1); // wall band mass
  const cleaned = removeThinIsolatedStrokes(m, width, height, { minPixels: 8, minThickness: 3 }).mask;
  assert.equal(cleaned[10 * width + 20], 0, "thin isolated line must be suppressed");
  assert.equal(cleaned[6 * width + 20], 1, "thick wall band mass must be preserved");
}

{
  const width = 48;
  const height = 20;
  const m = mask(width, height);
  fillRect(m, width, 4, 8, 18, 11, 1);
  fillRect(m, width, 24, 8, 40, 11, 1);
  const bridged = bridgeShortGaps(m, width, height, { maxGap: 5, minRun: 8 });
  assert.ok(bridged.bridged.length > 0, "short door/window gap with continuation must bridge");
  assert.equal(bridged.mask[9 * width + 21], 1);
}

{
  const width = 70;
  const height = 20;
  const m = mask(width, height);
  fillRect(m, width, 4, 8, 18, 11, 1);
  fillRect(m, width, 38, 8, 60, 11, 1);
  const bridged = bridgeShortGaps(m, width, height, { maxGap: 5, minRun: 8 });
  assert.equal(bridged.bridged.length, 0, "long arbitrary gap must not bridge");
}

{
  const width = 100;
  const height = 80;
  const m = mask(width, height);
  fillRect(m, width, 30, 20, 70, 24, 1);
  fillRect(m, width, 30, 56, 70, 60, 1);
  fillRect(m, width, 30, 20, 34, 60, 1);
  fillRect(m, width, 66, 20, 70, 60, 1);
  fillRect(m, width, 5, 70, 95, 72, 1); // title-block-like long bottom rule
  const selected = selectPrimaryBuildingComponent(m, width, height);
  assert.ok(selected.selected.minX > 20 && selected.selected.maxY < 65, "primary building component should reject bottom title-block rule");
}

{
  const width = 80;
  const height = 80;
  const m = mask(width, height);
  fillRect(m, width, 20, 20, 60, 24, 1);
  fillRect(m, width, 20, 56, 60, 60, 1);
  fillRect(m, width, 20, 20, 24, 60, 1);
  fillRect(m, width, 56, 20, 60, 60, 1);
  for (let y = 30; y <= 50; y += 4) fillRect(m, width, 30, y, 50, y, 1); // stair-tread-like isolated lines inside
  const closed = morphClose(m, width, height, 1);
  const selected = selectPrimaryBuildingComponent(closed, width, height);
  const contour = contourFromMask(selected.mask, width, height);
  assert.ok(contour.length >= 4, "contour should close around wall mass");
  assert.equal(selfIntersectionCount(contour), 0, "contour must not self-intersect");
  assert.equal(contour.some((p) => p.y >= 30 && p.y <= 50 && p.x > 28 && p.x < 52), false, "internal stair treads should not define exterior contour");
}

{
  const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 }];
  const simplified = simplifyCollinear(points);
  assert.deepEqual(simplified, [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 }]);
}

{
  const gray = new Uint8Array(25).fill(240);
  gray[12] = 20;
  const threshold = adaptiveThreshold(gray, 5, 5, { radius: 1, bias: 10 });
  assert.equal(threshold[12], 1, "dark structural pixel should enter threshold mask");
}

{
  const contour = [{ x: 0, y: 1 }, { x: 10, y: 1 }, { x: 10, y: 9 }, { x: 0, y: 9 }];
  const vectors = [
    { a: { x: 0, y: 0 }, b: { x: 12, y: 0 } },
    { a: { x: 0, y: 10 }, b: { x: 12, y: 10 } },
    { a: { x: 0, y: 0 }, b: { x: 0, y: 10 } },
    { a: { x: 10, y: 0 }, b: { x: 10, y: 10 } },
  ];
  const snapped = snapContourToVectorGeometry(contour, vectors, { maxDistance: 2 });
  assert.ok(snapped.snapPercentage >= 0.75, "nearby compatible vector walls should snap most contour corners");
}

console.log("hybridRasterWallDetection.test.mjs passed");
