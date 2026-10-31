// Builds the isolated verification copy ({ projectId, name, workbook }) from an EXTRACTED .gr8job copy.
// Reads the extracted files only; writes a new JSON under artifacts/. The original job is never opened.
import fs from 'node:fs';
import path from 'node:path';
const [dir, out] = process.argv.slice(2);
const estimate = JSON.parse(fs.readFileSync(path.join(dir, 'estimate.json'), 'utf8'));
const details = JSON.parse(fs.readFileSync(path.join(dir, 'job-details.json'), 'utf8'));
fs.writeFileSync(out, JSON.stringify({ name: `${details.jobName} (isolated copy)`, projectId: details.jobId, revision: 1, savedAt: details.lastModified, workbook: estimate.workbook }));
console.log('written', out, fs.statSync(out).size);
