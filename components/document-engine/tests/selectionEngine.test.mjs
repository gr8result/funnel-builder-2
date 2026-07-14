import test from "node:test";
import assert from "node:assert/strict";
import { createSelectionState, getSelectionBounds, selectObject } from "../core/selectionEngine.js";

test("selection supports single and multi select", () => {
  let selection = createSelectionState();
  selection = selectObject(selection, "a");
  assert.deepEqual(selection.selectedObjectIds, ["a"]);
  selection = selectObject(selection, "b", { multi: true });
  assert.deepEqual(selection.selectedObjectIds, ["a", "b"]);
});

test("selection bounds wrap selected objects", () => {
  const bounds = getSelectionBounds([
    { id: "a", x: 10, y: 20, width: 100, height: 40 },
    { id: "b", x: 60, y: 90, width: 20, height: 20 },
  ], ["a", "b"]);
  assert.deepEqual(bounds, { x: 10, y: 20, width: 100, height: 90 });
});
