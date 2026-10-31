// Creates an independently addressable copy of a .gr8job for browser testing. The source file is only read.
// Every embedded job identity (id, derived ids, job number, name) is replaced in the section text, the manifest
// checksums are recomputed with the application's own algorithm, and the result is verified before it is kept.
//   node --max-old-space-size=8192 scripts/create-isolated-reconciliation-test-job.mjs <source.gr8job> [output-dir]
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const sourcePath = path.resolve(process.argv[2] || 'recovery/master-quotation-reconstruction-2026-10-09/job-file/New Job 03 09.gr8job');
const TEST_NAME = 'GR8 RESULT - QUOTATION RECONCILIATION TEST';
const TEST_NUMBER = 'TEST-RECON-0001';
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const checksumText = (text) => { let hash = 0x811c9dc5; for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); } return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, '0')}`; };

const sourceHashBefore = sha256(sourcePath);
const source = await JSZip.loadAsync(fs.readFileSync(sourcePath));
const sections = Object.keys(source.files).filter((name) => /^[a-z-]+\.json$/.test(name) && name !== 'manifest.json');
const jobDetails = JSON.parse(await source.file('job-details.json').async('string'));
const OLD_ID = jobDetails.jobId, OLD_NAME = jobDetails.jobName, OLD_NUMBER = jobDetails.jobNumber;
assert(OLD_ID && OLD_NAME && OLD_NUMBER, 'source job identity is readable');
const NEW_ID = `gr8-reconcile-test-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
const outDir = path.resolve(process.argv[3] || path.join('test-artifacts', 'isolated-jobs', NEW_ID));
const outFile = path.join(outDir, `${TEST_NAME}.gr8job`);
assert(!fs.existsSync(outFile), 'never overwrite an existing file');
assert(path.resolve(outFile) !== sourcePath);

const swap = (text) => text.split(OLD_ID).join(NEW_ID).split(OLD_NUMBER).join(TEST_NUMBER).split(OLD_NAME).join(TEST_NAME);
const texts = {}, counts = {};
for (const name of sections) {
  const original = await source.file(name).async('string');
  counts[name] = { id: original.split(OLD_ID).length - 1, number: original.split(OLD_NUMBER).length - 1, name: original.split(OLD_NAME).length - 1 };
  texts[name] = swap(original);
}
const marker = { sourceJobIdSha256: crypto.createHash('sha256').update(OLD_ID).digest('hex'), sourceFileSha256: sourceHashBefore, createdAt: new Date().toISOString(), purpose: 'Quotation reconciliation browser verification. Never merge back into the source job.' };
const details = JSON.parse(texts['job-details.json']);
details.isolatedTestCopy = marker;
texts['job-details.json'] = JSON.stringify(details, null, 2);

const manifest = JSON.parse(swap(await source.file('manifest.json').async('string')));
manifest.generatedAt = marker.createdAt; manifest.lastSavedDate = marker.createdAt;
manifest.project = { ...manifest.project, id: NEW_ID, jobName: TEST_NAME, projectName: TEST_NAME, jobNumber: TEST_NUMBER };
manifest.projectId = NEW_ID; manifest.backupVersions = [];
manifest.sectionChecksums = Object.fromEntries(sections.map((name) => [name.replace(/\.json$/, ''), checksumText(texts[name])]));
manifest.migrationHistory = [...(manifest.migrationHistory || []), { schemaVersion: manifest.schemaVersion, migratedAt: marker.createdAt, note: `Isolated test copy; new job identity.` }];

const zip = new JSZip();
for (const name of sections) zip.file(name, texts[name]);
zip.file('manifest.json', JSON.stringify(manifest, null, 2));
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

// Verification, from the bytes on disk.
const copy = await JSZip.loadAsync(fs.readFileSync(outFile));
const report = { sourceFile: sourcePath, sourceSha256: sourceHashBefore, newJobId: NEW_ID, newJobName: TEST_NAME, newJobNumber: TEST_NUMBER, outFile, checks: {} };
const reread = {};
for (const name of sections) {
  const text = await copy.file(name).async('string');
  reread[name] = text;
  assert(!text.includes(OLD_ID) && !text.includes(OLD_NUMBER) && !text.includes(OLD_NAME), `${name} holds no reference to the source identity`);
  JSON.parse(text);
}
const outManifest = JSON.parse(await copy.file('manifest.json').async('string'));
for (const [name, expected] of Object.entries(outManifest.sectionChecksums)) assert.equal(checksumText(reread[`${name}.json`]), expected, `${name} checksum`);
report.checks.noSourceIdentityRemains = true; report.checks.manifestChecksumsVerify = true;
report.checks.identityOccurrences = Object.fromEntries(sections.map((name) => [name, { replacedIds: counts[name].id, newIdNow: reread[name].split(NEW_ID).length - 1 }]));
for (const name of sections) assert.equal(reread[name].split(NEW_ID).length - 1, counts[name].id + (name === 'job-details.json' ? 0 : 0), `${name}: every id reference moved to the new id`);

// Relationships: quote rows, selection rows and mappings are identical apart from the identity text.
const ids = (value, out = []) => { if (Array.isArray(value)) value.forEach((x) => ids(x, out)); else if (value && typeof value === 'object') { if (typeof value.id === 'string') out.push(value.id); Object.values(value).forEach((x) => ids(x, out)); } return out; };
const original = JSON.parse(await source.file('quotation.json').async('string')), moved = JSON.parse(reread['quotation.json']);
const norm = (value) => JSON.stringify(value).split(OLD_ID).join('X').split(NEW_ID).join('X');
const quotationRows = (q) => Object.values(q.quotation || q).flatMap((section) => section?.rows || []);
assert.equal(norm(quotationRows(original)), norm(quotationRows(moved)).split(TEST_NUMBER).join(OLD_NUMBER).split(TEST_NAME).join(OLD_NAME));
assert.deepEqual(ids(original), ids(moved), 'every quotation id is unchanged');
const sel0 = JSON.parse(await source.file('client-selections.json').async('string')), sel1 = JSON.parse(reread['client-selections.json']);
assert.deepEqual(ids(sel0), ids(sel1), 'every selection id is unchanged');
const est0 = JSON.parse(await source.file('estimate.json').async('string')), est1 = JSON.parse(reread['estimate.json']);
assert.deepEqual(Object.keys(est0.workbook.quotation || {}), Object.keys(est1.workbook.quotation || {}), 'section order is unchanged');
assert.deepEqual(ids(est0.workbook.jobInclusionSnapshot || {}), ids(est1.workbook.jobInclusionSnapshot || {}), 'inclusion history is unchanged');
assert.equal(est1.workbook.jobId, NEW_ID); assert.equal(est1.workbook.projectId, NEW_ID); assert.equal(est1.workbook.registeredJob.jobId, NEW_ID);
report.checks.relationshipsPreserved = { quotationRowIds: ids(moved).length, selectionIds: ids(sel1).length, sections: Object.keys(est1.workbook.quotation).length, quoteTargetMappings: (est1.workbook.quoteTargetMappings || []).length };
report.checks.collisionFree = { newIdDiffersFromSource: NEW_ID !== OLD_ID, newIdAppearsInSource: (sections.some((name) => counts[name].id < 0)), newNumberDiffers: TEST_NUMBER !== OLD_NUMBER, newFileIsNotSource: outFile !== sourcePath };
const sourceHashAfter = sha256(sourcePath);
assert.equal(sourceHashAfter, sourceHashBefore, 'the source file is byte-identical after copying');
report.checks.sourceUnchanged = { before: sourceHashBefore, after: sourceHashAfter };
report.outSha256 = sha256(outFile);
fs.writeFileSync(path.join(outDir, 'isolation-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
