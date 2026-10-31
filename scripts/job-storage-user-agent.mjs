// One user, as its own operating-system process, working against the builder's job server over
// HTTP. Started by scripts/test-builder-storage-multiuser.mjs; reports its result as one JSON line.
//   mode "own-job"     opens / creates its own job and saves `rounds` edits to it
//   mode "shared-job"  works on a job another user is editing at the same time: on a conflict it
//                      reloads the newer revision, re-applies its own edit and saves again
import { JobConflictError, RemoteJobClient } from "../lib/job-storage/jobClient.js";

const config = JSON.parse(process.argv[2]);
const client = new RemoteJobClient({ baseUrl: config.baseUrl, token: config.token, companyId: config.companyId });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const result = { user: config.userName, mode: config.mode, jobId: config.jobId, pid: process.pid, saves: 0, conflicts: 0, uploadedAssets: 0, errors: [] };
// A document only this user's job carries, large enough to be stored as a separate asset.
const ownDocument = `${config.userName}:`.padEnd(48 * 1024, config.userName.slice(-1));

try {
  await wait(Math.max(0, config.startAt - Date.now()));   // every user starts at the same moment
  if (config.mode === "own-job") {
    let workbook = { jobId: config.jobId, owner: config.userName, quotation: { rows: [] }, plans: [{ name: "plan-1", dataUrl: ownDocument }], edits: [] };
    let revision = 0;
    for (let round = 1; round <= config.rounds; round++) {
      workbook = { ...workbook, edits: [...workbook.edits, { by: config.userName, round }], quotation: { rows: [...workbook.quotation.rows, { id: `row-${round}`, qty: round }] } };
      const saved = await client.save(config.jobId, workbook, { baseRevision: revision, name: `${config.userName}'s job` });
      revision = saved.revision; result.saves += 1; result.uploadedAssets += saved.uploadedAssets;
      await wait(Math.random() * 15);
    }
    const reopened = await client.open(config.jobId);
    result.finalRevision = reopened.revision;
    result.ownEditsOnly = reopened.workbook.edits.length === config.rounds && reopened.workbook.edits.every((edit) => edit.by === config.userName) && reopened.workbook.owner === config.userName;
    result.documentIntact = reopened.workbook.plans[0].dataUrl === ownDocument;
  } else {
    for (let round = 1; round <= config.rounds; round++) {
      for (;;) {
        const current = await client.open(config.jobId);
        const workbook = { ...current.workbook, edits: [...current.workbook.edits, { by: config.userName, round }] };
        try { await client.save(config.jobId, workbook, { baseRevision: current.revision }); result.saves += 1; break; }
        catch (error) { if (!(error instanceof JobConflictError)) throw error; result.conflicts += 1; }   // reload and re-apply; never force
      }
    }
  }
} catch (error) { result.errors.push(`${error.name}: ${error.message}`); }
console.log(JSON.stringify(result));
