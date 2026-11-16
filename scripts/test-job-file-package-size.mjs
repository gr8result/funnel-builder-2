// .gr8job package size: the takeoff job (with its plan images) is written once, backups are the
// earlier versions on their own (never backups nested inside backups), and every copy the
// workbook holds comes back on read. Synthetic job; nothing is read from or written to real jobs.
// Run: node --import ./scripts/register-extensionless-loader.mjs scripts/test-job-file-package-size.mjs
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import JSZip from "jszip";
import { readJob, writeJob } from "../lib/jobFile.ts";

const IMAGE_BYTES = 2_000_000;
// Incompressible, like a real PNG data URL: deflate cannot hide a duplicate copy.
const noise = randomBytes(IMAGE_BYTES * 3 / 4).toString("base64");
const takeoffJob = { id: "takeoff-1", plan: { pages: [{ page: 1, dataUrl: `data:image/png;base64,${noise}` }] }, completedWallRuns: [{ id: "w1", lengthMm: 4200 }], sheetCalibrations: { 0: { pixelsPerMm: 0.5 }, 1: { pixelsPerMm: 0.5 } } };
const workbook = { jobId: "job-size-test", projectId: "job-size-test", jobFileMeta: { projectId: "job-size-test", jobName: "Size test" },
  quotation: { Section: { rows: [{ id: "r1", item: "Door", quantity: "3" }] } },
  aiPlanTakeoffJob: takeoffJob, takeoffEngine: { aiPlanTakeoffJob: takeoffJob, updatedAt: "2026-11-16T00:00:00.000Z" } };

let stored = new Uint8Array(0);
const handle = { name: "Size test.gr8job",
  async getFile() { return new File([stored], this.name); },
  async createWritable() { const parts = []; return { async write(blob) { parts.push(new Uint8Array(await blob.arrayBuffer())); }, async close() { stored = new Uint8Array(Buffer.concat(parts)); } }; } };

const sizes = [];
let current = { jobId: "job-size-test", jobName: "Size test", workbook };
for (let save = 1; save <= 4; save += 1) {
  // Backup names carry the save time to the second.
  if (save > 1) await new Promise((resolve) => setTimeout(resolve, 1100));
  const result = await writeJob(handle, current);
  assert.equal(result.ok, true, result.message);
  current = result.data;
  sizes.push(stored.length);
}

const zip = await JSZip.loadAsync(stored);
const occurrences = async (name) => { const text = await zip.file(name).async("text"); return text.split(noise.slice(0, 64)).length - 1; };
assert.equal(await occurrences("takeoff.json"), 1, "the takeoff section holds the plan image once");
assert.equal(await occurrences("estimate.json"), 0, "the estimate section's workbook refers to the takeoff job instead of copying it");

const backups = Object.keys(zip.files).filter((name) => /^backups\/.+\.gr8job$/i.test(name));
assert.equal(backups.length, 3, "three earlier versions are kept after four saves");
for (const name of backups) {
  const inner = await JSZip.loadAsync(await zip.file(name).async("uint8array"));
  assert.equal(Object.keys(inner.files).some((path) => path.startsWith("backups/")), false, `${name} holds no backups of its own`);
  const restored = await readJob(new File([await zip.file(name).async("uint8array")], "backup.gr8job"));
  assert.equal(restored.workbook.aiPlanTakeoffJob.plan.pages[0].dataUrl.length, takeoffJob.plan.pages[0].dataUrl.length, `${name} opens with its plan image`);
}
// Each save adds at most one more version of about one job's size; never a doubling.
const growth = sizes.slice(1).map((size, index) => size - sizes[index]);
assert.ok(growth.every((step) => step < sizes[0] * 1.3), `package grows linearly: sizes ${sizes.join(", ")}`);
assert.ok(sizes[0] < IMAGE_BYTES * 1.6, `one copy of the plan image per package (first save ${sizes[0]} bytes)`);

const back = await readJob(new File([stored], "Size test.gr8job"));
assert.deepEqual(back.workbook.aiPlanTakeoffJob, takeoffJob, "workbook takeoff job restored");
assert.deepEqual(back.workbook.takeoffEngine.aiPlanTakeoffJob, takeoffJob, "takeoff engine copy restored");
assert.deepEqual(back.takeoff.aiPlanTakeoffJob, takeoffJob, "takeoff section restored");
assert.deepEqual(back.workbook.aiPlanTakeoffJob.sheetCalibrations, takeoffJob.sheetCalibrations, "sheet calibrations survive");

// A copy that differs from the takeoff section is kept as written, not replaced by a reference.
const divergent = { ...workbook, takeoffEngine: { aiPlanTakeoffJob: { ...takeoffJob, completedWallRuns: [] } } };
stored = new Uint8Array(0);
const divergentResult = await writeJob(handle, { jobId: "job-size-test", jobName: "Size test", workbook: divergent });
assert.equal(divergentResult.ok, true, divergentResult.message);
const divergentBack = await readJob(new File([stored], "Size test.gr8job"));
assert.deepEqual(divergentBack.workbook.takeoffEngine.aiPlanTakeoffJob.completedWallRuns, [], "a different engine copy is preserved exactly");

// A reference with no target is a corrupt file, never silently empty.
const broken = await JSZip.loadAsync(stored);
const takeoffText = JSON.parse(await broken.file("takeoff.json").async("text"));
delete takeoffText.aiPlanTakeoffJob;
const brokenText = JSON.stringify(takeoffText, null, 2);
broken.file("takeoff.json", brokenText);
const manifest = JSON.parse(await broken.file("manifest.json").async("text"));
let hash = 0x811c9dc5; for (let i = 0; i < brokenText.length; i += 1) { hash ^= brokenText.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
manifest.sectionChecksums.takeoff = `fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`;
broken.file("manifest.json", JSON.stringify(manifest));
await assert.rejects(readJob(new File([await broken.generateAsync({ type: "uint8array" })], "broken.gr8job")), /reference takeoff\.aiPlanTakeoffJob has no saved target/);

console.log(`PASS .gr8job package size: sizes ${sizes.map((size) => (size / 1048576).toFixed(2)).join(" / ")} MB; plan image once; flat backups; all copies restored`);
