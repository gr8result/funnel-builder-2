// Migrates a .gr8job file into builder-owned storage and PROVES nothing was lost. It never changes
// the source file and never touches the application's own (browser) storage:
//   1. backs the source file up, byte for byte, and checks the copy's SHA-256;
//   2. saves the job through a real job server process into the target storage folder
//      (core record + separately stored documents);
//   3. reopens it from that storage and compares it with the source, value for value;
//   4. makes ten further saves, as an editing session would, and measures what each one costs;
//   5. exports the stored job back to a .gr8job file and re-imports that, to confirm compatibility.
// Run: node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/migrate-job-to-builder-storage.mjs --job <file.gr8job> --data <target folder> [--keep]
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readJob, writeJob } from "../lib/jobFile.ts";
import { JobStore } from "../lib/job-storage/jobStore.js";
import { RemoteJobClient } from "../lib/job-storage/jobClient.js";
import { FileSystemStorageProvider } from "../lib/job-storage/fileSystemProvider.js";
import { splitJob } from "../lib/job-storage/jobPackage.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback = "") => { const index = process.argv.indexOf(`--${name}`); return index >= 0 ? process.argv[index + 1] : fallback; };
const source = path.resolve(arg("job"));
const data = path.resolve(arg("data"));
const keep = process.argv.includes("--keep");
assert(fs.existsSync(source), `job file not found: ${source}`);
const mb = (bytes) => Math.round(bytes / 104857.6) / 10;
const sha = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const rss = () => mb(process.memoryUsage().rss);
const report = { source: path.basename(source), sourceMb: mb(fs.statSync(source).size), steps: {} };

// 1 - back up the source before anything else
fs.mkdirSync(path.join(data, "migration-backups"), { recursive: true });
const sourceSha = sha(source);
const backup = path.join(data, "migration-backups", `${path.basename(source, ".gr8job")}.${sourceSha.slice(0, 12)}.gr8job`);
fs.copyFileSync(source, backup);
assert.equal(sha(backup), sourceSha, "the backup is byte-identical to the source");
report.steps.backup = { file: backup, sha256: sourceSha };
console.log(`PASS backed up ${report.source} (${report.sourceMb} MB), SHA-256 verified`);

// 2 - read the job as the application does, and describe what it holds
const original = await readJob(new File([fs.readFileSync(source)], path.basename(source)));
const workbook = original.workbook;
const describe = (book) => ({
  jobId: book.jobId, jobName: book.jobName || book.projectName || "",
  quotationSections: Object.keys(book.quotation || {}).length,
  quotationRows: Object.values(book.quotation || {}).reduce((total, section) => total + (section.rows || []).length, 0),
  selectionRooms: (book.clientSelectionsBook?.rooms || []).length,
  selectionRows: (book.clientSelectionsBook?.rooms || []).reduce((total, room) => total + (room.rows || []).length, 0),
  guidedSelections: (book.clientSelectionsBook?.rooms || []).flatMap((room) => room.rows || []).filter((row) => row.guidedSelection).length,
  takeoffOpenings: (book.aiPlanTakeoffJob?.placedOpenings || []).length,
  takeoffWallRuns: (book.aiPlanTakeoffJob?.completedWallRuns || []).length,
  planPages: (book.aiPlanTakeoffJob?.plan?.pages || []).length,
  pageBuilderPages: (book.projectEstimateBuilder?.pages || []).length,
});
report.contents = describe(workbook);
const packed = await splitJob(workbook);
const coreBytes = Buffer.byteLength(JSON.stringify(packed.core));
report.steps.split = { coreRecordMb: mb(coreBytes), documents: packed.assets.size, documentsMb: mb([...packed.assets.values()].reduce((total, text) => total + Buffer.byteLength(text), 0)), wholeJobMb: mb(Buffer.byteLength(JSON.stringify(workbook))) };
console.log(`PASS read the job: ${JSON.stringify(report.contents)}`);
console.log(`     whole job ${report.steps.split.wholeJobMb} MB = core record ${report.steps.split.coreRecordMb} MB + ${report.steps.split.documents} documents ${report.steps.split.documentsMb} MB`);

// 3 - a builder installation on the target folder, served by its own process
const seed = new JobStore({ provider: new FileSystemStorageProvider({ root: path.join(data, "objects"), kind: "office-server" }), databasePath: path.join(data, "job-store.sqlite") });
const company = seed.createCompany({ name: "Migration check" });
const account = seed.createUser({ companyId: company.id, name: "Migration", role: "admin" });
seed.close();
const server = spawn(process.execPath, [path.join(here, "job-storage-server.mjs"), "serve", "--data", data, "--port", "0"], { stdio: ["ignore", "pipe", "inherit", "ipc"], env: { ...process.env, NODE_NO_WARNINGS: "1" } });
const port = await new Promise((resolve, reject) => { server.on("message", (message) => resolve(message.listening)); server.on("exit", () => reject(new Error("job server exited"))); });
const client = new RemoteJobClient({ baseUrl: `http://127.0.0.1:${port}`, token: account.token, companyId: company.id });
const serverRss = () => { try { return mb(Number(fs.readFileSync(`/proc/${server.pid}/statm`, "utf8").split(" ")[1]) * 4096); } catch { return null; } };
const jobId = workbook.jobId || "migrated-job";
try {
  let started = Date.now();
  const first = await client.save(jobId, workbook, { baseRevision: 0, name: report.contents.jobName, note: `Migrated from ${report.source}` });
  report.steps.migrate = { revision: first.revision, documentsUploaded: first.uploadedAssets, coreRecordMb: mb(first.coreBytes), seconds: (Date.now() - started) / 1000 };
  console.log(`PASS migrated as revision ${first.revision}: ${first.uploadedAssets} documents uploaded, core record ${mb(first.coreBytes)} MB, ${report.steps.migrate.seconds}s`);

  // 4 - reopen from storage and compare with the source, value for value
  started = Date.now();
  const reopened = await client.open(jobId, { verify: true });
  assert.deepStrictEqual(reopened.workbook, JSON.parse(JSON.stringify(workbook)), "the job read back from builder storage is identical to the source job");
  assert.deepEqual(describe(reopened.workbook), report.contents);
  report.steps.verify = { identical: true, seconds: (Date.now() - started) / 1000 };
  console.log("PASS reopened from builder storage: identical to the source (selections, estimate, takeoff and documents)");

  // 5 - ten more saves, as an editing session makes them
  let current = reopened.workbook, revision = reopened.revision, sent = 0, peak = rss();
  const firstSection = Object.keys(current.quotation || {})[0];
  started = Date.now();
  for (let index = 1; index <= 10; index++) {
    current = { ...current, quotation: { ...current.quotation, [firstSection]: { ...current.quotation[firstSection], migrationCheckEdit: index } } };
    const saved = await client.save(jobId, current, { baseRevision: revision, note: `edit ${index}` });
    assert.equal(saved.uploadedAssets, 0, "an edit that changes no document uploads no document");
    revision = saved.revision; sent += saved.coreBytes; peak = Math.max(peak, rss());
  }
  report.steps.tenSaves = { revisions: revision, sentPerSaveMb: mb(sent / 10), documentsReuploaded: 0, secondsPerSave: (Date.now() - started) / 10000, clientPeakRssMb: peak, storedWholeJobPerSaveBeforeMb: report.steps.split.wholeJobMb };
  console.log(`PASS ten further saves: ${report.steps.tenSaves.sentPerSaveMb} MB sent per save (was ${report.steps.split.wholeJobMb} MB per save stored whole), no document re-uploaded, ${report.steps.tenSaves.secondsPerSave}s per save`);
  assert.equal((await client.history(jobId)).length, 11, "all eleven revisions are kept");
  assert.deepStrictEqual((await client.open(jobId, { revision: 1 })).workbook, JSON.parse(JSON.stringify(workbook)), "the migrated revision is still exactly the source job");
  const objects = await new FileSystemStorageProvider({ root: path.join(data, "objects") }).listObjects("companies/");
  const stored = objects.reduce((total, key) => total + fs.statSync(path.join(data, "objects", ...key.split("/"))).size, 0);
  report.steps.storage = { objects: objects.length, storedMb: mb(stored), elevenWholeCopiesWouldBeMb: mb(11 * Buffer.byteLength(JSON.stringify(workbook))) };
  console.log(`PASS eleven revisions kept in ${report.steps.storage.storedMb} MB of builder storage (eleven whole copies would be ${report.steps.storage.elevenWholeCopiesWouldBeMb} MB)`);

  // 6 - .gr8job export / import compatibility
  const exportFile = path.join(data, "export-check.gr8job");
  const handle = { name: path.basename(exportFile), getFile: async () => new File([fs.readFileSync(exportFile)], path.basename(exportFile)), createWritable: async () => ({ write: async (blob) => fs.writeFileSync(exportFile, Buffer.from(await blob.arrayBuffer())), close: async () => {} }) };
  const written = await writeJob(handle, { ...original, workbook: reopened.workbook });
  assert(written.ok, "the stored job exports as a .gr8job file");
  const reimported = await readJob(await handle.getFile());
  assert.deepStrictEqual(JSON.parse(JSON.stringify(reimported.workbook)), JSON.parse(JSON.stringify(reopened.workbook)), "and that file imports back to the same job");
  report.steps.gr8job = { exportedMb: mb(fs.statSync(exportFile).size), roundTrip: true };
  console.log(`PASS exported to .gr8job (${report.steps.gr8job.exportedMb} MB) and re-imported: identical`);
  report.passed = true;
} finally {
  server.send("stop");
  await new Promise((resolve) => server.on("exit", resolve));
  const out = path.join(here, "..", "artifacts", "test-artifacts", "builder-storage-migration");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  if (!keep) fs.rmSync(data, { recursive: true, force: true });
}
console.log(`\nMigration check ${report.passed ? "passed" : "FAILED"}; report in artifacts/test-artifacts/builder-storage-migration/report.json${keep ? "" : " (the trial storage folder was removed)"}`);
