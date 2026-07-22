import assert from "node:assert/strict";
import { ROTATIONS, isValidRotation, normalizeRotation, rotateLeft, rotateRight } from "../types.js";

assert.deepEqual(ROTATIONS, [0, 90, 180, 270]);

assert.equal(isValidRotation(0), true);
assert.equal(isValidRotation(90), true);
assert.equal(isValidRotation(45), false);
assert.equal(isValidRotation(360), false);

assert.equal(normalizeRotation(0), 0);
assert.equal(normalizeRotation(360), 0);
assert.equal(normalizeRotation(450), 90);
assert.equal(normalizeRotation(-90), 270);
assert.equal(normalizeRotation(45), 0);
assert.equal(normalizeRotation(undefined), 0);

// Rotate Right: (rotation + 90) % 360
assert.equal(rotateRight(0), 90);
assert.equal(rotateRight(90), 180);
assert.equal(rotateRight(180), 270);
assert.equal(rotateRight(270), 0);

// Rotate Left: (rotation + 270) % 360
assert.equal(rotateLeft(0), 270);
assert.equal(rotateLeft(90), 0);
assert.equal(rotateLeft(180), 90);
assert.equal(rotateLeft(270), 180);

// Four rights == identity; a right then a left == identity
let r = 0;
for (let i = 0; i < 4; i += 1) r = rotateRight(r);
assert.equal(r, 0);
assert.equal(rotateLeft(rotateRight(90)), 90);

console.log("rotation.test.mjs passed");
