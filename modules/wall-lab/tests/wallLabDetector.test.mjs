import assert from "node:assert/strict";
import {
  WALL_LAB_CLASSES,
  compareDetectionResults,
  detectWallsFromImageData,
  hitTestWall,
} from "../wallLabDetector.js";

function createImage(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    data[offset] = 255;
    data[offset + 1] = 255;
    data[offset + 2] = 255;
    data[offset + 3] = 255;
  }
  return { data, width, height };
}

function darkPixel(image, x, y) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const offset = (Math.round(y) * image.width + Math.round(x)) * 4;
  image.data[offset] = 0;
  image.data[offset + 1] = 0;
  image.data[offset + 2] = 0;
  image.data[offset + 3] = 255;
}

function drawRect(image, x, y, width, height) {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      darkPixel(image, col, row);
    }
  }
}

function drawHorizontalLine(image, x1, x2, y, thickness = 1) {
  drawRect(image, x1, y, x2 - x1 + 1, thickness);
}

function drawVerticalLine(image, x, y1, y2, thickness = 1) {
  drawRect(image, x, y1, thickness, y2 - y1 + 1);
}

function testStructuralWallPairIsAccepted() {
  const image = createImage(220, 140);
  drawHorizontalLine(image, 30, 180, 44, 2);
  drawHorizontalLine(image, 30, 180, 56, 2);
  drawVerticalLine(image, 30, 44, 104, 2);
  drawVerticalLine(image, 42, 44, 104, 2);

  const result = detectWallsFromImageData(image, { source: "unit" });
  assert.ok(result.walls.length >= 2, "parallel wall faces should produce structural walls");
  assert.ok(result.walls.every((wall) => wall.type === WALL_LAB_CLASSES.STRUCTURAL_WALL));
  assert.ok(result.diagnostics.wallThicknessHistogram["<=12"] >= 1);
}

function testDimensionLineIsRejected() {
  const image = createImage(220, 100);
  drawHorizontalLine(image, 20, 190, 40, 1);
  for (const x of [30, 70, 110, 150, 185]) {
    drawVerticalLine(image, x, 34, 46, 1);
  }

  const result = detectWallsFromImageData(image, { source: "unit" });
  assert.equal(result.walls.length, 0, "single dimension chain should not become a wall");
  assert.ok(
    result.rejected.some((item) => item.type === WALL_LAB_CLASSES.DIMENSION),
    "dimension chain should be classified as rejected dimension geometry"
  );
}

function testHitTestingReturnsOnlyOneWall() {
  const image = createImage(220, 140);
  drawHorizontalLine(image, 30, 180, 44, 2);
  drawHorizontalLine(image, 30, 180, 56, 2);
  const result = detectWallsFromImageData(image, { source: "unit" });
  const wall = hitTestWall(result.walls, { x: 100, y: 50 }, 8);
  assert.ok(wall, "point near the middle of a wall should hit that wall");
  assert.equal(wall.id, result.walls[0].id, "hit testing should return a single nearest wall object");
}

function testPdfComparisonSummarisesCounts() {
  const png = { walls: new Array(92).fill(null) };
  const pdf = { walls: new Array(27).fill(null) };
  const comparison = compareDetectionResults(png, pdf);
  assert.equal(comparison.pngDetectedWalls, 92);
  assert.equal(comparison.pdfDetectedWalls, 27);
  assert.ok(comparison.likelyReasons.length >= 1);
}

testStructuralWallPairIsAccepted();
testDimensionLineIsRejected();
testHitTestingReturnsOnlyOneWall();
testPdfComparisonSummarisesCounts();

console.log("Wall lab detector tests passed.");
