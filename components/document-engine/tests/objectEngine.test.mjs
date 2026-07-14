import test from "node:test";
import assert from "node:assert/strict";
import { createObject, duplicateObject, moveObject, resizeObject } from "../core/objectEngine.js";

test("object movement stores snapped page coordinates", () => {
  const object = createObject("text", { x: 10, y: 10, width: 100, height: 40 });
  const moved = moveObject(object, 11, 13, { snapSize: 8 });
  assert.equal(moved.x, 24);
  assert.equal(moved.y, 24);
});

test("object resize respects minimum dimensions", () => {
  const object = createObject("image", { width: 100, height: 80 });
  const resized = resizeObject(object, 2, 3, { minWidth: 12, minHeight: 14, snap: false });
  assert.equal(resized.width, 12);
  assert.equal(resized.height, 14);
});

test("object duplicate receives a new id and offset", () => {
  const object = createObject("shape", { id: "shape_1", x: 20, y: 30 });
  const copy = duplicateObject(object);
  assert.notEqual(copy.id, object.id);
  assert.equal(copy.x, 44);
  assert.equal(copy.y, 54);
});
