import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import { describeJobFileSelectionConflict } from '../lib/builders/jobFileSelectionConflict.js';

// The 2026-10-30 scenario with the real files: the older Downloads job file against the corrected saved job.
//   node ... scripts/test-job-file-selection-conflict.mjs <older.gr8job> <corrected.gr8job> <reconciled.gr8job>
// A .gr8job is either JSON or a zipped package (estimate.json + client-selections.json + ...).
const read = async (file) => {
  const bytes = fs.readFileSync(file);
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const zip = await JSZip.loadAsync(bytes);
    const estimate = JSON.parse(await zip.file('estimate.json').async('string'));
    const selections = zip.file('client-selections.json') ? JSON.parse(await zip.file('client-selections.json').async('string')) : {};
    const workbook = estimate.workbook || estimate;
    return { ...workbook, clientSelectionsBook: selections.clientSelectionsBook || selections.book || workbook.clientSelectionsBook };
  }
  const value = JSON.parse(bytes.toString('utf8'));
  return value.workbook || value;
};
const [olderPath, correctedPath, reconciledPath] = process.argv.slice(2);
const older = await read(olderPath), corrected = await read(correctedPath);
const conflict = describeJobFileSelectionConflict(older, corrected);
console.log(JSON.stringify({ file: conflict.file, saved: conflict.saved, missingCorrections: conflict.missingCorrections, newerConfirmedRoomList: conflict.newerConfirmedRoomList }, null, 1));
assert.equal(conflict.conflict, true, 'the older file is a conflict');
assert(conflict.missingCorrections.some((text) => /ICON/.test(text)) && conflict.missingCorrections.some((text) => /STANZA/.test(text)), 'the user is told which confirmed corrections the file lacks');
assert.equal(conflict.newerConfirmedRoomList, true);
console.log('PASS the 30 October file is reported as older than the saved job, with the corrections it lacks');
assert.equal(describeJobFileSelectionConflict(corrected, older).conflict, false, 'a newer file over an older saved job is not a conflict');
assert.equal(describeJobFileSelectionConflict(corrected, corrected).conflict, false, 'the same revision is not a conflict');
assert.equal(describeJobFileSelectionConflict(older, null).conflict, false, 'nothing saved: no conflict');
console.log('PASS newer file, same revision and nothing saved are not conflicts');
if (reconciledPath) {
  const reconciled = await read(reconciledPath);
  assert.equal(describeJobFileSelectionConflict(older, reconciled).conflict, true);
  assert.equal(describeJobFileSelectionConflict(reconciled, older).conflict, false);
  console.log('PASS the reconciled job is protected from the older file too');
}
