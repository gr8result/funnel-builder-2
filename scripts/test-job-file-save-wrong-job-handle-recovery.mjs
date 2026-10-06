// Regression coverage for the live crash on Job Setup Save:
//
//   Runtime TypeError [uncaught]: Cannot preserve the previous computer file: This computer
//   file belongs to a different job. Choose a different file.
//   lib/jobFile.ts (774) writeJob -> saveJob -> hooks/useJobFile.ts (371) save
//   -> EstimateBuilderWorkbook.js (799) runSaveAction -> onClick (15661)
//
// Root cause: the deliberate "this file belongs to a different job" guard threw a plain Error
// inside writeJob's inner try/catch, which the SAME catch block then re-wrapped (because it
// isn't the ENOENT "file missing" case that catch exists for) and re-threw as
// "Cannot preserve the previous computer file: ...". That escaped writeJob's outer catch
// (which only recognises AbortError) as a genuinely uncaught exception, crashing the whole
// Job Setup page - even though the file being the wrong job is an entirely expected, common
// situation (most often a stale handle left over from an earlier job-id reassignment such as a
// recovery step), never a reason to lose the user's edits or crash the app.
//
// This suite drives the real writeJob/saveJob/saveJobAs against fake FileSystemFileHandle-shaped
// objects backed by an in-memory buffer (the same technique
// scripts/test-job-file-disk-save-roundtrip.mjs already uses against a real file on disk), so it
// exercises the actual shipped code, not a description of it.
import assert from "node:assert/strict";
import { readJob, saveJob, saveJobAs, writeJob } from "../lib/jobFile.ts";

// The saveJob wrong-job fallback calls writeJob(null, job), whose no-handle path triggers a
// browser download (URL.createObjectURL + an <a download> click). Node has neither; this is
// a minimal stand-in sufficient for that one call, not a DOM implementation.
if (typeof globalThis.document === "undefined") {
  globalThis.document = {
    createElement: () => ({ click() {}, remove() {}, style: {} }),
    body: { appendChild() {} },
  };
}
if (typeof globalThis.URL.createObjectURL !== "function") {
  globalThis.URL.createObjectURL = () => "blob:test";
  globalThis.URL.revokeObjectURL = () => {};
}

function makeHandle(name, initialBytes = null) {
  let bytes = initialBytes;
  return {
    name,
    async getFile() {
      if (bytes === null) {
        const error = new Error("A file was not found at the requested location.");
        error.name = "NotFoundError";
        throw error;
      }
      return new File([bytes], name);
    },
    async createWritable() {
      const chunks = [];
      return {
        async write(value) {
          chunks.push(value instanceof Blob ? Buffer.from(await value.arrayBuffer()) : Buffer.from(value));
        },
        async close() {
          bytes = Buffer.concat(chunks);
        },
      };
    },
    _debugBytes: () => bytes,
  };
}

function jobFor(jobId, overrides = {}) {
  return {
    jobId,
    jobName: `Job ${jobId}`,
    "job-details": { projectId: jobId },
    estimate: { workbook: { projectId: jobId, jobId, data: { inputDataSheet: { rows: { projectName: { value: `Job ${jobId}` } } } } } },
    ...overrides,
  };
}

// --- 1. Normal Save Job: an empty (new) handle saves cleanly -------------------------------
{
  const handle = makeHandle("job-a.gr8job", null);
  const result = await writeJob(handle, jobFor("job-a"));
  assert.equal(result.ok, true, "A fresh, empty file handle saves without any wrong-job complication");
  assert.equal(result.storageLocation, "computer-file");
  assert.equal(result.wrongJobFile, undefined);
}

// --- 2. Save existing matching computer file: same job id round-trips normally -------------
{
  const handle = makeHandle("job-a.gr8job", null);
  await writeJob(handle, jobFor("job-a"));
  const second = await writeJob(handle, jobFor("job-a", { jobName: "Job A renamed" }));
  assert.equal(second.ok, true, "Saving again to the SAME job's own file must succeed normally");
  assert.equal(second.wrongJobFile, undefined);
  const reread = await readJob(handle);
  assert.equal(reread.jobName, "Job A renamed", "The edit made before the second save is the one actually on disk");
}

// --- 3. THE LIVE BUG: a handle belonging to a different job must not crash writeJob --------
{
  const handleForJobA = makeHandle("job-a.gr8job", null);
  await writeJob(handleForJobA, jobFor("job-a")); // file now genuinely belongs to job-a

  let threw = null;
  let result = null;
  try {
    result = await writeJob(handleForJobA, jobFor("job-b"));
  } catch (error) {
    threw = error;
  }
  assert.equal(threw, null, "writeJob must NEVER throw for a wrong-job handle - this is exactly what crashed the real browser");
  assert.equal(result.ok, false, "The write itself did not happen against the wrong file");
  assert.equal(result.wrongJobFile, true, "The result is tagged so callers can recognise this specific, expected condition");
  assert.match(result.message, /belongs to a different job/i);
  // The wrong file itself must be completely untouched - never partially overwritten.
  const stillJobA = await readJob(handleForJobA);
  assert.equal(stillJobA.jobId, "job-a", "The other job's file is left exactly as it was");
}

// --- 4. Save Job (the normal, no-dialog save) must fall back and keep the user's edits ------
{
  const handleForJobA = makeHandle("job-a.gr8job", null);
  await writeJob(handleForJobA, jobFor("job-a"));

  const jobBWithEdits = jobFor("job-b", { jobName: "Job B - has unsaved edits" });
  const result = await saveJob(jobBWithEdits, handleForJobA, { fallbackToSaveAs: true });
  assert.equal(result.ok, true, "Save Job must still succeed even though the linked handle belongs to job-a");
  assert.equal(result.storageLocation, "download", "It falls back to the safe, no-dialog internal save (a download), not a picker");
  assert.equal(result.clearedStaleHandle, true, "The caller is told to forget the stale handle");
  assert.match(result.message, /saved as a new file/i);
  assert.match(result.message, /belongs to a different job/i);
  assert.equal(result.data.jobName, "Job B - has unsaved edits", "The actual current edits are what gets saved, not stale data");
  // And the other job's own file was never touched by this save.
  const stillJobA = await readJob(handleForJobA);
  assert.equal(stillJobA.jobId, "job-a");
}

// --- 5. Save Job to Computer File (Save As) with an existing file for another job -----------
// saveJobAs always asks the picker for a destination; simulate the user choosing a file that
// happens to already belong to a different job.
{
  const handleForJobA = makeHandle("job-a.gr8job", null);
  await writeJob(handleForJobA, jobFor("job-a"));
  const previousPicker = globalThis.window;
  globalThis.window = { showSaveFilePicker: async () => handleForJobA, showOpenFilePicker: async () => [] };
  let threw = null;
  let result = null;
  try {
    result = await saveJobAs(jobFor("job-b"));
  } catch (error) {
    threw = error;
  } finally {
    globalThis.window = previousPicker;
  }
  assert.equal(threw, null, "saveJobAs must not crash when the chosen file belongs to a different job");
  assert.equal(result.ok, false, "The chosen file is not silently overwritten with job-b's data");
  assert.equal(result.wrongJobFile, true, "The caller can tell the user to choose a different file");
  const stillJobA = await readJob(handleForJobA);
  assert.equal(stillJobA.jobId, "job-a", "Job A's file is never overwritten by Job B's Save As");
}

// --- 6. Cancelled file picker: saveJobAs must not throw or claim success -------------------
{
  const previousPicker = globalThis.window;
  globalThis.window = { showSaveFilePicker: async () => { const error = new Error("The user aborted a request."); error.name = "AbortError"; throw error; }, showOpenFilePicker: async () => [] };
  let threw = null;
  let result = null;
  try {
    result = await saveJobAs(jobFor("job-c"));
  } catch (error) {
    threw = error;
  } finally {
    globalThis.window = previousPicker;
  }
  assert.equal(threw, null, "A cancelled picker must not throw");
  assert.equal(result.cancelled, true);
  assert.equal(result.ok, true, "A cancellation is not reported as a failure");
}

// --- 7. External write failure (a genuine, unexpected error) still surfaces, distinctly -----
// This must NOT be silently swallowed the way wrongJobFile now deliberately is - only the
// specific, expected "wrong job" condition gets a graceful fallback.
{
  const handle = makeHandle("job-a.gr8job", null);
  await writeJob(handle, jobFor("job-a"));
  handle.createWritable = async () => { throw new Error("Disk is full."); };
  let threw = null;
  try {
    await writeJob(handle, jobFor("job-a"));
  } catch (error) {
    threw = error;
  }
  assert.ok(threw, "A genuine, unexpected write failure must still be reported, not silently treated as success");
  assert.match(threw.message, /disk is full/i);
}

// --- 8. Internal save / read-back: a successful save is verified, not merely assumed --------
{
  const handle = makeHandle("job-a.gr8job", null);
  const result = await writeJob(handle, jobFor("job-a", { jobName: "Verify me" }));
  assert.equal(result.ok, true);
  const verified = await readJob(handle);
  assert.equal(verified.jobName, "Verify me", "What actually landed on disk matches what was meant to be saved");
}

// --- 9. Save -> refresh (new handle instance, same underlying bytes) -> reopen: edits persist
{
  const handle = makeHandle("job-a.gr8job", null);
  await writeJob(handle, jobFor("job-a", { jobName: "Before refresh" }));
  await writeJob(handle, jobFor("job-a", { jobName: "After refresh" }));
  // Simulate "reopening" with a fresh handle object bound to the same bytes, the way a page
  // reload would reacquire a stored handle rather than reuse the in-memory object.
  const reopened = makeHandle("job-a.gr8job", handle._debugBytes());
  const reread = await readJob(reopened);
  assert.equal(reread.jobName, "After refresh", "The edit survives a save -> refresh -> reopen cycle");
}

// --- 10. Job A's handle must never end up associated with Job B's data on disk -------------
{
  const handleForJobA = makeHandle("job-a.gr8job", null);
  await writeJob(handleForJobA, jobFor("job-a"));
  await saveJob(jobFor("job-b"), handleForJobA, { fallbackToSaveAs: true }); // falls back to download
  const stillOnDisk = await readJob(handleForJobA);
  assert.equal(stillOnDisk.jobId, "job-a", "Job A's own computer file is never mutated into holding Job B's data");
}

console.log("PASS jobFile wrong-job-handle recovery: normal save, matching save, the live wrong-job crash (writeJob/saveJob/saveJobAs), cancelled picker, genuine write failures, save/read-back, save-refresh-reopen, and cross-job file isolation all behave correctly.");
