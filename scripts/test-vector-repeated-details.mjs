import assert from 'node:assert/strict';
import { detectVectorWalls } from '../components/construction-estimation/ai-plan-takeoff/geometry/vectorWalls.js';

function fixture(angle, pixelsPerMm, withPartitions = false, label = 'STAIRS') {
  const segments = [];
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  const point = ([x, y]) => ({ x: (x * cosine - y * sine + 10000) * pixelsPerMm, y: (x * sine + y * cosine + 10000) * pixelsPerMm });
  const line = (start, end) => {
    const first = point(start), last = point(end);
    segments.push({ x1: first.x, y1: first.y, x2: last.x, y2: last.y, paint: 'stroke', widthPx: .24, color: '#000000', path: segments.length, subpath: 0 });
  };
  const wall = (start, end) => {
    const dx = end[0] - start[0], dy = end[1] - start[1], length = Math.hypot(dx, dy);
    for (const side of [-1, 1]) line([start[0] - side * dy / length * 45, start[1] + side * dx / length * 45], [end[0] - side * dy / length * 45, end[1] + side * dx / length * 45]);
  };
  wall([0, 0], [6000, 0]); wall([6000, 0], [6000, 6000]);
  wall([6000, 6000], [0, 6000]); wall([0, 6000], [0, 0]);
  if (withPartitions) {
    wall([0, 2000], [6000, 2000]); wall([0, 4000], [6000, 4000]);
  } else {
    for (let index = 0; index < 7; index += 1) line([0, 500 + index * 250], [1800, 500 + index * 250]);
    line([1800, 500], [1800, 2000]);
  }
  const stairLabel = point([900, 1250]);
  return { segments, point, context: {
    pixelsPerMm, logicalWidth: 25000 * pixelsPerMm, logicalHeight: 25000 * pixelsPerMm,
    textItems: withPartitions ? [] : [{ text: label, x: stairLabel.x, y: stairLabel.y }],
  } };
}

for (const angle of [0, Math.PI / 2, Math.PI / 4]) for (const scale of [.03, .1]) {
  const stair = fixture(angle, scale);
  const found = detectVectorWalls(stair.segments, stair.context);
  const inverse = node => {
    const x = node.x / scale - 10000, y = node.y / scale - 10000;
    return { x: x * Math.cos(angle) + y * Math.sin(angle), y: -x * Math.sin(angle) + y * Math.cos(angle) };
  };
  assert.ok(!found.walls.some(wall => {
    const first = inverse(wall.nodes[0]), last = inverse(wall.nodes.at(-1));
    return Math.abs(first.y - last.y) < 10 && first.y > 400 && first.y < 2100 && Math.max(first.x, last.x) < 1900;
  }), 'repeated stair treads must not form architectural walls');
  // A stair labelled only by its run direction (UP beside the arrow) is the same evidence.
  const up = fixture(angle, scale, false, 'UP');
  const upFound = detectVectorWalls(up.segments, up.context);
  assert.ok(!upFound.walls.some(wall => {
    const first = inverse(wall.nodes[0]), last = inverse(wall.nodes.at(-1));
    return Math.abs(first.y - last.y) < 10 && first.y > 400 && first.y < 2100 && Math.max(first.x, last.x) < 1900;
  }), 'treads beside an UP run label must not form walls');
  // An unrelated word near repeated lines is not stair evidence.
  const other = fixture(angle, scale, false, 'LAUNDRY');
  assert.ok(detectVectorWalls(other.segments, other.context).walls.length >= detectVectorWalls(up.segments, up.context).walls.length, 'only stair labels withhold repeated lines');
  const partitions = fixture(angle, scale, true);
  const real = detectVectorWalls(partitions.segments, partitions.context);
  assert.ok(real.walls.length >= 6, 'regularly spaced real walls retain their independently paired faces');
}
console.log('Repeated details: stair treads withheld, real paired partitions retained across rotation and scale.');