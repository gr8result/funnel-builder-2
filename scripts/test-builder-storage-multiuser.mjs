// Builder-owned storage, verified with SEPARATE PROCESSES over the network interface - not browser
// tabs: a job server process on a storage folder, five user processes each on their own job, and
// two more user processes editing one shared job at the same moment. Then: isolation, conflict
// protection, authentication / authorisation, revision history, recovery, backup, offline work.
// Run: node scripts/test-builder-storage-multiuser.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fork, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { JobStore } from "../lib/job-storage/jobStore.js";
import { JobConflictError, LocalJobClient, RemoteJobClient } from "../lib/job-storage/jobClient.js";
import { FileSystemStorageProvider } from "../lib/job-storage/fileSystemProvider.js";
import { MemoryStorageProvider, assertStorageKey } from "../lib/job-storage/storageProviders.js";
import { assetHashesOf, joinJob, splitJob } from "../lib/job-storage/jobPackage.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const pass = (message) => console.log(`PASS ${message}`);
const data = fs.mkdtempSync(path.join(os.tmpdir(), "gr8-job-store-"));
const ROUNDS = 12;

// ---- the stored form is lossless -----------------------------------------------------------------
const big = "data:image/png;base64," + "A".repeat(200000);
const sample = { jobId: "j1", quotation: { rows: [{ id: "r1", qty: 2, note: "" }] }, plans: [{ dataUrl: big }, { dataUrl: big }], page: { design: "x".repeat(40000), nothing: null, list: [1, "two", false] } };
const packed = await splitJob(sample);
assert.equal(packed.assets.size, 2, "the same plan stored twice is one asset");
assert(JSON.stringify(packed.core).length < 1000, "the core record carries references, not documents");
assert.deepEqual(await joinJob(packed.core, (hash) => packed.assets.get(hash), { verify: true }), sample, "split then join returns the identical job");
await assert.rejects(joinJob(packed.core, () => "tampered", { verify: true }), /does not match its content hash/);
for (const key of ["../x", "a//b", "/abs", "a/../b", ""]) assert.throws(() => assertStorageKey(key), /Invalid storage key/);
pass("a job splits into a small core record plus content-addressed assets, and joins back exactly");

// ---- seed the builder's installation, then start the job server as its own process -----------------
const seed = new JobStore({ provider: new FileSystemStorageProvider({ root: path.join(data, "objects"), kind: "office-server" }), databasePath: path.join(data, "job-store.sqlite") });
const companyA = seed.createCompany({ name: "Builder A" });
const companyB = seed.createCompany({ name: "Builder B" });
const solo = Array.from({ length: 5 }, (_, index) => seed.createUser({ companyId: companyA.id, name: `User ${index + 1}`, role: "member" }));
const pair = ["User 6", "User 7"].map((name) => seed.createUser({ companyId: companyA.id, name, role: "member" }));
const adminA = seed.createUser({ companyId: companyA.id, name: "Admin A", role: "admin" });
const viewerA = seed.createUser({ companyId: companyA.id, name: "Viewer A", role: "viewer" });
const userB = seed.createUser({ companyId: companyB.id, name: "User B", role: "member" });
seed.close();
const server = spawn(process.execPath, [path.join(here, "job-storage-server.mjs"), "serve", "--data", data, "--port", "0"], { stdio: ["ignore", "pipe", "inherit", "ipc"] });
const port = await new Promise((resolve, reject) => { server.on("message", (message) => resolve(message.listening)); server.on("exit", () => reject(new Error("job server exited"))); });
const baseUrl = `http://127.0.0.1:${port}`;
const clientFor = (account, companyId = companyA.id) => new RemoteJobClient({ baseUrl, token: account.token, companyId });

try {
  // The shared job exists before the two collaborators start.
  const SHARED = "job-shared";
  await clientFor(pair[0]).save(SHARED, { jobId: SHARED, edits: [], plans: [{ dataUrl: big }] }, { baseRevision: 0, name: "Shared job" });

  // ---- five users on five jobs + two users on one job, all at the same time, each its own process ----
  const startAt = Date.now() + 1500;
  const run = (account, mode, jobId) => new Promise((resolve, reject) => {
    const child = fork(path.join(here, "job-storage-user-agent.mjs"), [JSON.stringify({ baseUrl, token: account.token, companyId: companyA.id, userName: account.user.name, mode, jobId, rounds: ROUNDS, startAt })], { stdio: ["ignore", "pipe", "inherit", "ipc"] });
    let out = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.on("exit", (code) => { try { resolve(JSON.parse(out.trim().split("\n").pop())); } catch { reject(new Error(`agent ${account.user.name} exited ${code}: ${out}`)); } });
  });
  const results = await Promise.all([...solo.map((account, index) => run(account, "own-job", `job-${index + 1}`)), ...pair.map((account) => run(account, "shared-job", SHARED))]);
  assert.equal(new Set([process.pid, server.pid, ...results.map((item) => item.pid)]).size, 9, "nine separate processes: the server, the test, and seven users");
  assert.deepEqual(results.flatMap((item) => item.errors), [], "no user hit an error");

  const own = results.filter((item) => item.mode === "own-job");
  for (const item of own) {
    assert.deepEqual([item.saves, item.conflicts, item.finalRevision, item.ownEditsOnly, item.documentIntact], [ROUNDS, 0, ROUNDS, true, true], `${item.user} saved ${ROUNDS} revisions of its own job, undisturbed`);
    assert.equal(item.uploadedAssets, 1, `${item.user}'s plan was uploaded once, not with every save`);
  }
  const admin = clientFor(adminA);
  const jobs = await admin.list();
  assert.deepEqual(jobs.map((job) => job.jobId).sort(), ["job-1", "job-2", "job-3", "job-4", "job-5", SHARED].sort());
  for (const [index, account] of solo.entries()) {
    const job = await admin.open(`job-${index + 1}`);
    assert.deepEqual([job.revision, job.workbook.owner, job.workbook.edits.length, job.workbook.edits.every((edit) => edit.by === account.user.name), job.workbook.quotation.rows.length], [ROUNDS, account.user.name, ROUNDS, true, ROUNDS], `job-${index + 1} holds only ${account.user.name}'s work`);
    assert.deepEqual((await admin.history(`job-${index + 1}`)).map((entry) => entry.createdByName), Array(ROUNDS).fill(account.user.name), "every revision of the job was written by its own user");
  }
  pass(`five users, five jobs, ${ROUNDS} saves each at the same time: no job was touched by another user`);

  // ---- two users, one job --------------------------------------------------------------------------
  const collaborators = results.filter((item) => item.mode === "shared-job");
  const shared = await admin.open(SHARED);
  const by = (name) => shared.workbook.edits.filter((edit) => edit.by === name).map((edit) => edit.round);
  assert.deepEqual([by("User 6"), by("User 7")], [Array.from({ length: ROUNDS }, (_, index) => index + 1), Array.from({ length: ROUNDS }, (_, index) => index + 1)], "every edit of both users is in the job, in order: nothing was lost or overwritten");
  assert.equal(shared.revision, 1 + ROUNDS * 2, "one revision per accepted save");
  assert(collaborators.reduce((total, item) => total + item.conflicts, 0) > 0, "the two users really did collide, and each collision was refused rather than overwritten");
  assert.equal(shared.workbook.plans[0].dataUrl, big, "the shared plan document is intact");
  const sharedHistory = await admin.history(SHARED);
  assert.deepEqual([...new Set(sharedHistory.map((entry) => entry.createdByName))].sort(), ["User 6", "User 7"]);
  assert.deepEqual(sharedHistory.map((entry) => entry.baseRevision), sharedHistory.map((entry) => entry.revision - 1), "every accepted save was based on the revision before it");
  console.log(`     collisions refused: ${collaborators.map((item) => `${item.user} ${item.conflicts}`).join(", ")}`);
  pass("two users on one job at the same time: every edit kept, every stale save refused");

  // ---- a stale save is refused; the newer work stays ------------------------------------------------
  const first = clientFor(pair[0]), second = clientFor(pair[1]);
  const a = await first.open("job-1"), b = await second.open("job-1");
  await first.save("job-1", { ...a.workbook, note: "first" }, { baseRevision: a.revision });
  await assert.rejects(second.save("job-1", { ...b.workbook, note: "second (stale)" }, { baseRevision: b.revision }), (error) => error instanceof JobConflictError && error.head.revision === a.revision + 1 && error.head.updatedByName === "User 6");
  assert.equal((await admin.open("job-1")).workbook.note, "first");
  await assert.rejects(first.save("job-1", a.workbook, {}), /which revision it is based on/, "a save with no base revision is not sent");
  pass("a save based on an older revision is refused with who saved and when; nothing is overwritten");

  // ---- authentication and authorisation on every request --------------------------------------------
  const status = async (promise) => { try { await promise; return 200; } catch (error) { return error.status || error.code; } };
  const outsider = clientFor(userB);   // a real user of ANOTHER company, pointing at company A
  assert.equal(await status(outsider.list()), 403, "another company's user cannot list this company's jobs");
  assert.equal(await status(outsider.open("job-1")), 403); assert.equal(await status(outsider.history("job-1")), 403);
  assert.equal(await status(outsider.save("job-1", { jobId: "job-1" }, { baseRevision: 99 })), 403, "nor write to them");
  assert.equal(await status(outsider.request("GET", `/companies/${companyA.id}/assets/${assetHashesOf(packed.core)[0]}`, { raw: true })), 403, "nor read their documents");
  assert.deepEqual(await clientFor(userB, companyB.id).list(), [], "and in its own company it sees none of company A's jobs");
  assert.equal(await status(new RemoteJobClient({ baseUrl, token: "gr8_wrong", companyId: companyA.id }).list()), 401, "an unknown token is refused");
  assert.equal(await status(fetch(`${baseUrl}/v1/companies/${companyA.id}/jobs`).then((response) => { if (!response.ok) { const error = new Error("x"); error.status = response.status; throw error; } })), 401, "no token is refused");
  const viewer = clientFor(viewerA);
  assert.equal((await viewer.open("job-2")).revision, ROUNDS, "a viewer can read");
  assert.equal(await status(viewer.save("job-2", { jobId: "job-2" }, { baseRevision: ROUNDS })), 403, "a viewer cannot write");
  assert.equal(await status(clientFor(solo[0]).request("POST", `/companies/${companyA.id}/backups`)), 403, "a member cannot run admin actions");
  pass("every request is authenticated and authorised: wrong company 403, bad or missing token 401, role limits enforced");

  // ---- revision history, recovery, backup -------------------------------------------------------------
  const before = await admin.open("job-3");
  const old = await admin.open("job-3", { revision: 4 });
  assert.equal(old.workbook.edits.length, 4, "any earlier revision can be read");
  const restored = await admin.restore("job-3", 4);
  assert.equal(restored.revision, before.revision + 1, "restoring makes a new revision; history is not rewritten");
  assert.deepEqual((await admin.open("job-3")).workbook, old.workbook);
  assert.equal((await admin.open("job-3", { revision: before.revision })).workbook.edits.length, ROUNDS, "the revision that was replaced is still there");
  const backup = await admin.request("POST", `/companies/${companyA.id}/backups`);
  assert(backup.jobs === 6 && backup.revisions >= 6 * ROUNDS && fs.existsSync(path.join(data, "objects", ...backup.key.split("/"))), "a backup manifest of every job and revision is written to the builder's storage");
  pass("every revision is kept and readable; restore adds a revision; backups are written beside the data");

  // ---- the documents are in the builder's folder, per company ----------------------------------------
  const stored = await new FileSystemStorageProvider({ root: path.join(data, "objects") }).listObjects("companies/");
  assert(stored.every((key) => key.startsWith(`companies/${companyA.id}/`) || key.startsWith(`companies/${companyB.id}/`)));
  assert.equal(stored.filter((key) => key.includes("/assets/")).length, 6, "six documents stored once each: five users' plans and the shared plan");
  pass(`job documents live in the builder's own storage folder (${stored.length} objects), separated by company`);

  // ---- offline, then reconnect -------------------------------------------------------------------------
  const queue = new MemoryStorageProvider();
  const offline = new RemoteJobClient({ baseUrl: "http://127.0.0.1:9", token: solo[1].token, companyId: companyA.id, pendingStore: queue });
  const mine = await clientFor(solo[1]).open("job-2");
  const queued = await offline.saveOrQueue("job-2", { ...mine.workbook, note: "made offline" }, { baseRevision: mine.revision });
  assert.deepEqual([queued.queued, (await offline.pending("job-2")).workbook.note], [true, "made offline"], "work done offline is kept on this computer");
  const online = new RemoteJobClient({ baseUrl, token: solo[1].token, companyId: companyA.id, pendingStore: queue });
  assert.deepEqual(await online.syncPending("job-2"), { synced: true, revision: mine.revision + 1 }, "nobody changed the job meanwhile: the offline work goes in on reconnect");
  assert.equal(await online.pending("job-2"), null);
  // The same again, but another user saves while this computer is offline.
  const base = await online.open("job-2");
  await offline.saveOrQueue("job-2", { ...base.workbook, note: "offline again" }, { baseRevision: base.revision });
  await admin.save("job-2", { ...base.workbook, note: "saved by the office meanwhile" }, { baseRevision: base.revision });
  const reconnect = await online.syncPending("job-2");
  assert.deepEqual([reconnect.synced, reconnect.conflict, reconnect.head.updatedByName, reconnect.pending.workbook.note], [false, true, "Admin A", "offline again"], "the job changed while offline: the reconnect reports a conflict");
  assert.equal((await admin.open("job-2")).workbook.note, "saved by the office meanwhile", "the other user's work was not overwritten");
  assert.equal((await online.pending("job-2")).workbook.note, "offline again", "and the offline work is still held, for the user to resolve");
  pass("offline work is queued locally; on reconnect it is saved only if the job did not change, else reported as a conflict with both versions kept");

  // ---- single-user local storage uses the same stored form ----------------------------------------------
  const local = new LocalJobClient({ provider: new FileSystemStorageProvider({ root: path.join(data, "local-computer"), kind: "local" }) });
  assert.deepEqual([local.describe().shared, local.describe().label, online.describe().shared, online.describe().label], [false, "Local only (single user)", true, "Shared storage (multi-user)"], "local-only and shared storage are told apart");
  const one = await local.save("job-local", sample, { baseRevision: 0, name: "Local job" });
  const two = await local.save("job-local", { ...sample, note: "v2" }, { baseRevision: 1 });
  assert.deepEqual([one.uploadedAssets, two.uploadedAssets, two.revision], [2, 0, 2]);
  await assert.rejects(local.save("job-local", sample, { baseRevision: 1 }), JobConflictError);
  assert.deepEqual((await local.open("job-local", { revision: 1 })).workbook, sample);
  // A job moves from local to shared storage unchanged.
  const moved = await local.open("job-local");
  await admin.save("job-moved", moved.workbook, { baseRevision: 0 });
  assert.deepEqual((await admin.open("job-moved")).workbook, moved.workbook);
  pass("local single-user storage keeps revisions the same way, and a job moves to shared storage unchanged");
} finally {
  server.send("stop");
  await new Promise((resolve) => server.on("exit", resolve));
  fs.rmSync(data, { recursive: true, force: true });
}
console.log("\nBuilder-owned storage (multi-process): all checks passed");
