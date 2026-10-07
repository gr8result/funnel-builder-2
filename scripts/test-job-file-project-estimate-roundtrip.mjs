import assert from "node:assert/strict";
import JSZip from "jszip";
import { readJob, writeJob } from "../lib/jobFile.ts";

const rootDocument = { pages: [{ id: "root", blocks: [{ dataUrl: "data:application/pdf;base64,ROOT_DOCUMENT_BYTES", futureField: { preserve: 0 } }] }], unknownRoot: [false, ""] };
const legacyDocument = { importedDocuments: { legacy: { dataUrl: "data:application/pdf;base64,LEGACY_DOCUMENT_BYTES" } }, pages: [], unknownLegacy: { preserve: true } };
const cases = [
  ["root-only", { projectEstimateBuilder: rootDocument }],
  ["legacy-only", { clientPage: { proposalBuilder: legacyDocument } }],
  ["independent-both", { projectEstimateBuilder: rootDocument, clientPage: { proposalBuilder: legacyDocument } }],
];

for (const [name, documents] of cases) {
  const workbook = {
    jobId: `document-roundtrip-${name}`, projectId: `document-roundtrip-${name}`,
    data: { inputDataSheet: { rows: { projectName: { value: name } } } },
    futureModule: { items: [{ preserve: "unknown" }] },
    ...documents,
    clientPage: { ...(documents.clientPage || {}), unrelated: "retained" },
  };
  const original = structuredClone(workbook);
  let bytes = new ArrayBuffer(0);
  const handle = {
    name: `${name}.gr8job`,
    getFile: async () => new File([bytes], `${name}.gr8job`),
    createWritable: async () => ({ write: async (blob) => { bytes = await blob.arrayBuffer(); }, close: async () => {} }),
  };
  assert.equal((await writeJob(handle, { jobName: name, workbook })).ok, true, `${name}: real ZIP save succeeds`);
  const estimateText = await (await JSZip.loadAsync(bytes)).file("estimate.json").async("string");
  const estimate = JSON.parse(estimateText);
  assert.deepEqual(estimate.workbook, original, `${name}: archive preserves the exact document locations and independent values`);
  assert.equal(estimate.projectEstimate, null, `${name}: no extra document copy is introduced into the package section`);
  for (const [key, expected] of [["ROOT_DOCUMENT_BYTES", Boolean(documents.projectEstimateBuilder)], ["LEGACY_DOCUMENT_BYTES", Boolean(documents.clientPage?.proposalBuilder)]]) {
    assert.equal(estimateText.split(key).length - 1, Number(expected), `${name}: ${key} occurs only in its original location`);
  }
  const reopened = await readJob(handle);
  assert.deepEqual(reopened.workbook, original, `${name}: documents and unknown fields survive the actual reader`);
  assert.deepEqual(workbook, original, `${name}: writing must not mutate the input workbook`);
}
console.log("PASS real ZIP save/read preserves root-only, legacy-only and independent dual project documents, without adding document copies.");
