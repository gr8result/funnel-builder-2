import test from "node:test";
import assert from "node:assert/strict";
import { canRedo, canUndo, createHistory, pushHistory, redo, undo } from "../core/historyEngine.js";

test("history supports undo and redo", () => {
  let history = createHistory({ value: 1 });
  history = pushHistory(history, { value: 2 });
  history = pushHistory(history, { value: 3 });
  assert.equal(canUndo(history), true);
  history = undo(history);
  assert.equal(history.present.value, 2);
  assert.equal(canRedo(history), true);
  history = redo(history);
  assert.equal(history.present.value, 3);
});
