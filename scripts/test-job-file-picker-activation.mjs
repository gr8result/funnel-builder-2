import assert from "node:assert/strict";
import fs from "node:fs";
import { createNewJob, openJob, readJob, saveJob, saveJobAs } from "../lib/jobFile.ts";

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
const deniedHandle = {
  name: "Isolated permission test.gr8job",
  async getFile() { throw new DOMException("The request is not allowed by the user agent or the platform in the current context.", "NotAllowedError"); },
};
await assert.rejects(readJob(deniedHandle), error => error.name === "NotAllowedError"
  && /browser blocked access/.test(error.message) && /current job has not been replaced/.test(error.message));
let fallbackOpened = false;
globalThis.window.showOpenFilePicker = async () => [deniedHandle];
const fallbackFile = new File([JSON.stringify({ jobId: "permission-test", jobName: "Permission test", workbook: { jobId: "permission-test", data: {}, quotation: {} } })], "Permission test.gr8job", { type: "application/json" });
globalThis.document = {
  body: { appendChild() {} },
  createElement() { return { style: {}, remove() {}, click() { fallbackOpened = true; this.files = [fallbackFile]; this.onchange(); } }; },
};
const recoveredOpen = await openJob();
assert.equal(fallbackOpened, true, "Denied file handle opens the ordinary file selection fallback");
assert.equal(recoveredOpen.ok, true, recoveredOpen.message);
assert.equal(recoveredOpen.handle, null, "Fallback must not retain the denied computer handle");
assert.equal(recoveredOpen.fileName, fallbackFile.name);
delete globalThis.document;
delete globalThis.window;
console.log("PASS picker runs before packaging or timers; cancellation and errors are handled.");
