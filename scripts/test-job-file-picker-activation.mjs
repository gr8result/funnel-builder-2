import assert from "node:assert/strict";
import fs from "node:fs";
import { createNewJob, saveJob, saveJobAs } from "../lib/jobFile.ts";

let pickerCalls = 0;
globalThis.window = {
  showOpenFilePicker() {},
  async showSaveFilePicker() { pickerCalls++; throw new DOMException("Cancelled", "AbortError"); },
  clearTimeout() {},
  setTimeout() { return 1; },
};
const job = { jobName: "Picker regression", get workbook() { throw new Error("Workbook processed before the picker"); } };
for (const save of [saveJobAs, createNewJob, (value) => saveJob(value, null)]) {
  const before = pickerCalls;
  const pending = save(job);
  assert.equal(pickerCalls, before + 1, "Picker must start synchronously before processing workbook data");
  assert.equal((await pending).cancelled, true);
}

const source = fs.readFileSync("components/estimate-builder/EstimateBuilderWorkbook.js", "utf8");
const actionSource = source.slice(source.indexOf("  async function runSaveAction("), source.indexOf("  async function runTemplateFileAction("));
const statuses = [];
const run = new Function("saveStatusTimerRef", "setSaveStatus", `${actionSource}; return runSaveAction;`)({ current: null }, (value) => statuses.push(value));
const before = pickerCalls;
const pending = run("Saving job to computer", () => saveJob(job, null));
assert.equal(pickerCalls, before + 1, "Save action must not defer the picker behind a render or timer");
assert.equal((await pending).cancelled, true);
assert.equal(statuses.at(-1).state, "idle");
const failed = await run("Saving job to computer", () => { throw new DOMException("User activation expired", "SecurityError"); });
assert.equal(failed.ok, false);
assert.equal(statuses.at(-1).state, "error", "Picker errors should display in the save status without an unhandled rejection");
delete globalThis.window;
console.log("PASS picker runs before packaging or timers; cancellation and errors are handled.");
