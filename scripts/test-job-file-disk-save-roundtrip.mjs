import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJob, saveJob, writeJob } from "../lib/jobFile.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "test-results", "job-file-disk-save-roundtrip");
await fs.mkdir(outDir, { recursive: true });
const filePath = path.join(outDir, "Save Roundtrip Test.gr8job");
await fs.rm(filePath, { force: true });

const calls = { createWritable: 0, write: 0, close: 0, getFile: 0 };
const handle = {
  name: "Save Roundtrip Test.gr8job",
  async getFile() {
    calls.getFile += 1;
    const bytes = await fs.readFile(filePath);
    return new File([bytes], this.name);
  },
  async createWritable() {
    calls.createWritable += 1;
    let chunks = [];
    return {
      async write(value) {
        calls.write += 1;
        const buffer = value instanceof Blob
          ? Buffer.from(await value.arrayBuffer())
          : Buffer.from(value);
        chunks.push(buffer);
      },
      async close() {
        calls.close += 1;
        await fs.writeFile(filePath, Buffer.concat(chunks));
      },
    };
  },
};

const baseline = {
  jobName: "Save Roundtrip Test",
  clientName: "Disk Persistence Baseline",
  jobNumber: "SAVE-ROUNDTRIP-001",
  address: "1 Roundtrip Circuit",
  "job-details": { projectId: "save-roundtrip-test", marker: "job-details-preserved" },
  estimate: {
    workbook: {
      projectId: "save-roundtrip-test",
      commercialProjectId: "save-roundtrip-test",
      registeredJob: { jobId: "save-roundtrip-test", jobName: "Save Roundtrip Test", jobNumber: "SAVE-ROUNDTRIP-001", clientName: "Disk Persistence Baseline" },
      data: {
        inputDataSheet: {
          rows: {
            projectName: { value: "Save Roundtrip Test" },
            clientName: { value: "Disk Persistence Baseline" },
            jobNumber: { value: "SAVE-ROUNDTRIP-001" },
            expectedBuildDuration: { value: "12 weeks" },
          },
        },
      },
      clientSelectionsBook: { selections: { test: { value: "baseline selection" } } },
      aiPlanTakeoffJob: { plan: { pages: [{ id: "plan-page-1", marker: "takeoff-asset-preserved" }] } },
      procurement: [{ id: "procurement-preserved" }],
      variations: [{ id: "variation-preserved" }],
    },
  },
  takeoff: { assets: [{ id: "takeoff-file", marker: "takeoff-section-preserved" }] },
  "client-selections": { book: { rooms: [{ id: "kitchen" }], selections: { fixture: { value: "selection-section-preserved" } } } },
  quotation: { rows: [{ id: "quote-row", marker: "quotation-preserved" }] },
  boq: { items: [{ id: "boq-row", marker: "boq-preserved" }] },
  procurement: { items: [{ id: "po-row", marker: "procurement-section-preserved" }] },
  variations: { items: [{ id: "variation-row", marker: "variation-section-preserved" }] },
  "project-documents": { documents: [{ id: "doc-row", marker: "documents-preserved" }] },
  assets: { plans: [{ id: "plan-asset", marker: "assets-preserved" }] },
};

await writeJob(handle, baseline);
const initialStat = await fs.stat(filePath);
const opened = await readJob(handle);
const initialRevision = Number(opened.masterRevision || opened.manifest?.revision || 0);
assert.ok(initialStat.size > 0, "initial physical package is non-zero");

const editedWorkbook = {
  ...(opened.workbook || {}),
  data: {
    ...(opened.workbook?.data || {}),
    inputDataSheet: {
      ...(opened.workbook?.data?.inputDataSheet || {}),
      rows: {
        ...(opened.workbook?.data?.inputDataSheet?.rows || {}),
        projectName: { value: "Save Roundtrip Test Updated" },
        clientName: { value: "Disk Persistence Verified" },
        expectedBuildDuration: { value: "27 weeks" },
      },
    },
  },
  jobFileMeta: {
    ...(opened.workbook?.jobFileMeta || {}),
    jobName: "Save Roundtrip Test Updated",
    clientName: "Disk Persistence Verified",
  },
  clientSelectionsBook: {
    ...(opened.workbook?.clientSelectionsBook || {}),
    selections: {
      ...(opened.workbook?.clientSelectionsBook?.selections || {}),
      diskPersistence: { value: "client selection survived disk save" },
    },
  },
};

const saveResult = await saveJob({ ...opened, jobName: "Save Roundtrip Test Updated", clientName: "Disk Persistence Verified", workbook: editedWorkbook }, handle);
assert.equal(saveResult.ok, true, "save returns success");
assert.equal(saveResult.storageLocation, "computer-file", "save reports the computer file as the destination");
assert.match(saveResult.message || "", /Saved to Save Roundtrip Test\.gr8job at /, "save message names the physical file");
assert.ok(calls.createWritable >= 2, "save uses createWritable after initial package creation");
assert.ok(calls.write >= 2, "save writes the package blob");
assert.ok(calls.close >= 2, "save closes the writable stream");

const savedStat = await fs.stat(filePath);
assert.ok(savedStat.size > 0, "saved physical package is non-zero");
assert.ok(savedStat.mtimeMs >= initialStat.mtimeMs, "saved physical package modified time does not move backward");

const reopened = await readJob(handle);
const reopenedRows = reopened.workbook?.data?.inputDataSheet?.rows || {};
assert.equal(reopenedRows.projectName?.value, "Save Roundtrip Test Updated");
assert.equal(reopenedRows.clientName?.value, "Disk Persistence Verified");
assert.equal(reopenedRows.expectedBuildDuration?.value, "27 weeks");
assert.equal(reopened.workbook?.clientSelectionsBook?.selections?.diskPersistence?.value, "client selection survived disk save");
assert.equal(reopened.jobId, "save-roundtrip-test", "job ID remains unchanged");
assert.equal(Number(reopened.masterRevision || reopened.manifest?.revision || 0), initialRevision + 1, "revision increases after save");
assert.equal(reopened.quotation?.rows?.[0]?.marker, "quotation-preserved", "quotation namespace is preserved");
assert.equal(reopened.assets?.plans?.[0]?.marker, "assets-preserved", "asset namespace is preserved");

console.log(JSON.stringify({
  filePath,
  initialSize: initialStat.size,
  savedSize: savedStat.size,
  initialModifiedTime: initialStat.mtime.toISOString(),
  savedModifiedTime: savedStat.mtime.toISOString(),
  initialRevision,
  savedRevision: reopened.masterRevision || reopened.manifest?.revision || 0,
  createWritableCalls: calls.createWritable,
  writeCalls: calls.write,
  closeCalls: calls.close,
}, null, 2));
