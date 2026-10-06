import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { Stage } from 'konva/lib/Stage.js';
import { Transform } from 'konva/lib/Util.js';

// Execute the production conversion with Konva's actual pointer normalization
// and transform matrices. No copied coordinate conversion or calibration change.
const filename = new URL('../components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx', import.meta.url);
const source = readFileSync(filename, 'utf8');
const ast = ts.createSourceFile(filename.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
let conversion;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'getCanvasPointerPos') conversion = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(conversion, 'Locate the actual pointer conversion');

const knownPoints = [{ x: 100, y: 120 }, { x: 500, y: 120 }];
const rows = [];
for (const zoom of [0.75, 1, 1.5]) {
  for (const cssScale of [1, 0.75, 44.508894075101786 / 59.9]) {
    for (const rotation of [0, 270]) {
      const stageTransform = new Transform().translate(47, -13).scale(zoom, zoom);
      const layerTransform = new Transform().translate(595 / 2, 842 / 2)
        .rotate(rotation * Math.PI / 180).translate(-595 / 2, -842 / 2);
      const absoluteTransform = stageTransform.copy().multiply(layerTransform);
      const rect = { left: 83, top: 129, width: 1600 * cssScale, height: 1000 * cssScale };
      const stage = {
        content: { getBoundingClientRect: () => rect, clientWidth: 1600, clientHeight: 1000 },
        _getContentPosition: Stage.prototype._getContentPosition,
        setPointersPositions: Stage.prototype.setPointersPositions,
        getPointerPosition() { return this._pointerPositions?.[0] || null; },
        scaleX: () => zoom, scaleY: () => zoom, x: () => 47, y: () => -13,
        getAbsoluteTransform: () => stageTransform,
      };
      const context = {
        stageRef: { current: stage }, stageScale: zoom,
        canvasHostRef: { current: { getBoundingClientRect: () => rect } },
        layerRef: { current: { getTransform: () => layerTransform, getAbsoluteTransform: () => absoluteTransform } },
      };
      const convert = vm.runInNewContext(`(${conversion})`, context);
      const nativeEvents = knownPoints.map((point) => {
        const screen = absoluteTransform.point(point);
        return { type: 'click', clientX: rect.left + screen.x * cssScale, clientY: rect.top + screen.y * cssScale };
      });
      const points = nativeEvents.map((event) => convert({ evt: event }));
      const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      rows.push({ zoom, cssScale, rotation, points, distance });
      // The native-event path and Konva's stored-pointer fallback must agree.
      for (let index = 0; index < nativeEvents.length; index += 1) {
        stage.setPointersPositions(nativeEvents[index]);
        const fallback = convert();
        assert.ok(Math.hypot(fallback.x - knownPoints[index].x, fallback.y - knownPoints[index].y) < 1e-7);
      }
    }
  }
}
for (const row of rows) {
  assert.ok(Math.abs(row.distance - 400) < 1e-7,
    `Stable 400px plan line at zoom=${row.zoom}, CSS=${row.cssScale}, rotation=${row.rotation}: got ${row.distance}px (${row.distance / 400} of expected)`);
  row.points.forEach((point, index) => assert.ok(Math.hypot(point.x - knownPoints[index].x, point.y - knownPoints[index].y) < 1e-7));
}
console.log(`Takeoff pointer transform checks passed: ${rows.length} zoom/CSS/rotation combinations preserve exact plan points and 400px distance; native events agree with Konva pointer fallback.`);
