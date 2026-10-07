import assert from "node:assert/strict";
import { canEditGeometry, canPan, createPointerSession, ownerForPointerDown, TOOLS } from "../core/interactionState.js";

assert.equal(ownerForPointerDown({ tool: TOOLS.SELECT, targetType: "vertex" }), "geometry");
assert.equal(ownerForPointerDown({ tool: TOOLS.PAN, targetType: "empty" }), "viewer");
assert.equal(ownerForPointerDown({ tool: TOOLS.DRAW_EXTERIOR, targetType: "empty" }), "drawing");
assert.equal(ownerForPointerDown({ tool: TOOLS.DRAW_EXTERIOR, targetType: "empty", spaceKey: true }), "viewer");
assert.equal(ownerForPointerDown({ tool: TOOLS.PAN, targetType: "vertex" }), "geometry");

const vertexDrag = createPointerSession({ pointerId: 1, tool: TOOLS.SELECT, targetType: "vertex" });
assert.equal(canPan(vertexDrag), false, "vertex drag does not pan");
assert.equal(canEditGeometry(vertexDrag), true, "vertex drag can edit");

const pan = createPointerSession({ pointerId: 2, tool: TOOLS.PAN, targetType: "empty" });
assert.equal(canPan(pan), true, "pan mode owns empty canvas");
assert.equal(canEditGeometry(pan), false, "pan mode does not edit");

const drawSpacePan = createPointerSession({ pointerId: 3, tool: TOOLS.DRAW_EXTERIOR, targetType: "empty", spaceKey: true });
assert.equal(canPan(drawSpacePan), true, "Space+drag pans in draw mode");

console.log("takeoff-v3 interactionState.test.mjs passed");
