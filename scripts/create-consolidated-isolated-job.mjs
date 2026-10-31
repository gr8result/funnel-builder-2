// Builds a consolidated-structure browser test copy from an isolated test job. The input file is only read.
//   node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/create-consolidated-isolated-job.mjs <isolated.gr8job>
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { normalizeQuotationStructure, quotationSectionOrderAfterNormalize } from '../lib/construction-estimation/quotationStructure.js';
import { stampQuotationOrder } from '../lib/construction-estimation/quotationOrder.js';

const sourcePath = path.resolve(process.argv[2]);
const PROTECTED_HASH = '72bdbb4bbee9ffe20dd9c9d2d4d55018c2e49e66efcc3215a07059f73f6c1088';
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const checksumText = (text) => { let hash = 0x811c9dc5; for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); } return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, '0')}`; };
const sourceHash = sha256(sourcePath);
const source = await JSZip.loadAsync(fs.readFileSync(sourcePath));
const sections = Object.keys(source.files).filter((name) => /^[a-z-]+\.json$/.test(name) && name !== 'manifest.json');
const details = JSON.parse(await source.file('job-details.json').async('string'));
const OLD_ID = details.jobId, OLD_NAME = details.jobName, OLD_NUMBER = details.jobNumber;
assert(/^gr8-reconcile-test-/.test(OLD_ID) && details.isolatedTestCopy, 'input must itself be an isolated test copy');
const NEW_ID = `gr8-reconcile-test-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
const NEW_NAME = 'GR8 RESULT - QUOTATION PROGRESS ALLOCATION TEST';
const NEW_NUMBER = 'TEST-RECON-0003';
const outDir = path.resolve('test-artifacts', 'isolated-jobs', NEW_ID);
const outFile = path.join(outDir, `${NEW_NAME}.gr8job`);
const swap = (text) => text.split(OLD_ID).join(NEW_ID).split(OLD_NUMBER).join(NEW_NUMBER).split(OLD_NAME).join(NEW_NAME);

const texts = {};
for (const name of sections) texts[name] = swap(await source.file(name).async('string'));
const estimate = JSON.parse(texts['estimate.json']);
const original = estimate.workbook.quotation;
const normalized = normalizeQuotationStructure(original);
const order = quotationSectionOrderAfterNormalize(estimate.workbook.quotationSectionOrder, normalized);
const consolidated = stampQuotationOrder(normalized, order);
const quotationFile = JSON.parse(texts['quotation.json']);
const copies = { workbook: estimate.workbook, estimate, quotationFile };
const before = JSON.stringify(original);
for (const holder of Object.values(copies)) { if (holder.quotation && JSON.stringify(holder.quotation) === before) holder.quotation = consolidated; }
estimate.workbook.quotationSectionOrder = order;
if (Array.isArray(estimate.quotationSectionOrder)) estimate.quotationSectionOrder = order;
assert(estimate.workbook.quotation === consolidated && estimate.quotation === consolidated && quotationFile.quotation === consolidated, 'all three quotation copies replaced');
// Schedules and history point at a row by (legacy section, id); a row given a new id must be repointed.
const idMoves = new Map(Object.values(normalized).flatMap((section) => section.rows || []).filter((row) => row.legacyRowId && row.legacyRowId !== row.id && row.legacySectionName).map((row) => [`${row.legacySectionName}\u0000${row.legacyRowId}`, row.id]));
let repointed = 0;
const repoint = (value) => {
  if (value === consolidated) return;
  if (Array.isArray(value)) return value.forEach(repoint);
  if (!value || typeof value !== 'object') return;
  const moved = typeof value.id === 'string' && typeof value.section === 'string' ? idMoves.get(`${value.section}\u0000${value.id}`) : null;
  if (moved) { value.id = moved; repointed += 1; }
  Object.values(value).forEach(repoint);
};
repoint(estimate);
const takeoffFile = JSON.parse(texts['takeoff.json']); repoint(takeoffFile); texts['takeoff.json'] = JSON.stringify(takeoffFile);
texts['estimate.json'] = JSON.stringify(estimate);
texts['quotation.json'] = JSON.stringify(quotationFile);
const marker = { ...details.isolatedTestCopy, consolidatedFromIsolatedJobIdSha256: crypto.createHash('sha256').update(OLD_ID).digest('hex'), consolidatedAt: new Date().toISOString(), purpose: 'Consolidated trade structure browser verification. Never merge back into the source job.' };
const newDetails = JSON.parse(texts['job-details.json']); newDetails.isolatedTestCopy = marker; texts['job-details.json'] = JSON.stringify(newDetails, null, 2);

const manifest = JSON.parse(swap(await source.file('manifest.json').async('string')));
manifest.generatedAt = marker.consolidatedAt; manifest.lastSavedDate = marker.consolidatedAt;
manifest.project = { ...manifest.project, id: NEW_ID, jobName: NEW_NAME, projectName: NEW_NAME, jobNumber: NEW_NUMBER };
manifest.projectId = NEW_ID; manifest.backupVersions = [];
manifest.sectionChecksums = Object.fromEntries(sections.map((name) => [name.replace(/\.json$/, ''), checksumText(texts[name])]));
manifest.migrationHistory = [...(manifest.migrationHistory || []), { schemaVersion: manifest.schemaVersion, migratedAt: marker.consolidatedAt, note: 'Isolated test copy with consolidated trade sections; new job identity.' }];
const zip = new JSZip();
for (const name of sections) zip.file(name, texts[name]);
zip.file('manifest.json', JSON.stringify(manifest, null, 2));
fs.mkdirSync(outDir, { recursive: true });
assert(!fs.existsSync(outFile));
fs.writeFileSync(outFile, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

// Verify from disk.
const copy = await JSZip.loadAsync(fs.readFileSync(outFile));
const reread = {};
for (const name of sections) { reread[name] = await copy.file(name).async('string'); assert(!reread[name].includes(OLD_ID) && !reread[name].includes(OLD_NUMBER), `${name}: no earlier identity`); JSON.parse(reread[name]); }
const outManifest = JSON.parse(await copy.file('manifest.json').async('string'));
for (const [name, expected] of Object.entries(outManifest.sectionChecksums)) assert.equal(checksumText(reread[`${name}.json`]), expected, `${name} checksum`);
const out = JSON.parse(reread['estimate.json']).workbook;
assert.equal(out.jobId, NEW_ID);
assert.equal(Object.keys(out.quotation).length, Object.keys(consolidated).length);
assert.deepEqual([...out.quotationSectionOrder].sort(), Object.keys(out.quotation).sort(), 'saved section order names every section once');
const report = { sourceFile: sourcePath, sourceSha256: sourceHash, sourceSha256After: sha256(sourcePath), protectedRecoveredJobSha256: PROTECTED_HASH, newJobId: NEW_ID, newJobName: NEW_NAME, newJobNumber: NEW_NUMBER, outFile, sections: Object.keys(out.quotation).length, referencesRepointed: repointed, outSha256: sha256(outFile) };
assert.equal(report.sourceSha256After, sourceHash);
fs.writeFileSync(path.join(outDir, 'isolation-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
