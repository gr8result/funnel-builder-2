import assert from "node:assert/strict";
import { isClickPan, panViewFromDrag, shouldForcePan } from "../viewer/dragInteraction.js";

const view = { viewport: { width: 100, height: 100 }, panX: 10, panY: 20, zoomScale: 1 };

assert.deepEqual(
  panViewFromDrag(view, null, { clientX: 100, clientY: 100 }),
  view,
  "dragRef null during move must not read panX/panY or change view"
);

assert.deepEqual(
  panViewFromDrag(view, { mode: "pan", startX: 20, startY: 30, panX: 10, panY: 20 }, { clientX: 35, clientY: 50 }),
  { ...view, panX: 25, panY: 40 },
  "Space-pan/pan drag should apply smooth delta from the captured drag snapshot"
);

assert.equal(
  shouldForcePan({ code: "Space", buttons: 1, getModifierState: () => false }, "exterior-wall"),
  true,
  "Space+drag must pan while trace is active"
);

assert.equal(
  shouldForcePan({ buttons: 1, getModifierState: (key) => key === "Space" }, "exterior-wall"),
  true,
  "modifier-state Space pan must work for pointer events"
);

assert.equal(
  isClickPan({ mode: "pan", startX: 10, startY: 10 }, { clientX: 13, clientY: 14 }),
  true,
  "rapid click/pan/click sequence below the click threshold should still place a trace point"
);

assert.equal(
  isClickPan({ mode: "pan", startX: 10, startY: 10 }, { clientX: 40, clientY: 40 }),
  false,
  "real pan movement must not place a trace point on mouseup outside/after drag"
);

console.log("viewerDragSafety.test.mjs passed");
