import assert from "node:assert/strict";
import { sameStoredJobValue } from "../lib/construction-estimation/jobPersistence.js";

const image = `data:image/png;base64,${"A".repeat(4 * 1024 * 1024)}`;
const record = {
  key: "job:existing", jobId: "existing", revision: 8, checksum: "existing-checksum", savedAt: "saved-time",
  workbook: { data: { value: 0 }, pages: [{ image }], unknownModule: { enabled: false, nested: [null, "retained"] } },
};
const readback = structuredClone(record);
// Large job verification must compare the actual read-back content without
// constructing two complete JSON copies of all embedded documents and images.
const stringify = JSON.stringify;
JSON.stringify = () => { throw new Error("Read-back comparison must not allocate whole-job JSON strings"); };
try {
  assert.equal(sameStoredJobValue(record, readback), true);
  readback.workbook.pages[0].image = `${image.slice(0, 1000)}B${image.slice(1001)}`;
  assert.equal(sameStoredJobValue(record, readback), false, "A same-size image mutation must fail verification");
  readback.workbook.pages[0].image = image;
  readback.workbook.unknownModule.nested.reverse();
  assert.equal(sameStoredJobValue(record, readback), false, "Nested ordering remains significant");
  readback.workbook.unknownModule.nested.reverse();
  readback.revision += 1;
  assert.equal(sameStoredJobValue(record, readback), false, "Revision remains verified");
  readback.revision = record.revision;
  delete readback.workbook.unknownModule;
  assert.equal(sameStoredJobValue(record, readback), false, "Unknown sections remain verified");
} finally {
  JSON.stringify = stringify;
}
assert.equal(sameStoredJobValue({ a: 0, b: false }, { b: false, a: 0 }), true, "Object property insertion order is immaterial");
assert.equal(sameStoredJobValue(["a"], { 0: "a" }), false);
console.log("PASS exact read-back validation detects image/content/identity changes without whole-job JSON copies.");
