import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const target = path.resolve(process.argv[2] || '');
if (process.argv[3] === '--record') {
  // Each independent process parses exactly one closed disk file, then exits.
  const bytes = fs.statSync(target).size;
  if (!bytes) throw new Error('Zero-byte backup.');
  const record = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (!(String(record.key).startsWith('job:03-09/123') || String(record.key).startsWith('job-backup:new-job-03-09:')) || !record.workbook) throw new Error('Unexpected record identity.');
  const jobs = [record.workbook.aiPlanTakeoffJob, record.workbook.takeoffEngine?.aiPlanTakeoffJob].filter(Boolean);
  const job = jobs.find(job => (job.plan?.pages || job.planPages || []).length) || {};
  const pages = job.plan?.pages || job.planPages || [];
  const complete = pages.length === 5 && pages.every(page => typeof page.dataUrl === 'string' && /^data:image\/[^;]+;base64,[A-Za-z0-9+/]+=*$/.test(page.dataUrl) && page.dataUrl.length > 100 && Number(page.width || page.logicalWidth) > 0 && Number(page.height || page.logicalHeight) > 0);
  let embeddedArtworkFields = 0, embeddedArtworkCharacters = 0;
  function countArtwork(value) {
    if (typeof value === 'string' && value.startsWith('data:')) { embeddedArtworkFields++; embeddedArtworkCharacters += value.length; }
    else if (value && typeof value === 'object') for (const key of Object.keys(value)) countArtwork(value[key]);
  }
  countArtwork(record.workbook);
  let duplicatedQuotationArtworkPages = 0;
  for (const builder of [record.workbook.clientPage?.proposalBuilder, record.workbook.projectEstimateBuilder]) {
    for (const page of builder?.pages || []) {
      if (typeof page.baseArtwork === 'string' && page.baseArtwork.startsWith('data:') && page.baseArtwork === page.design?.backgroundImageUrl && page.baseArtwork === page.importedDocument?.baseArtwork) duplicatedQuotationArtworkPages++;
    }
  }
  console.log(JSON.stringify({ file: path.basename(target), key: record.key, name: job.takeoffName || job.jobName || record.name || '', projectId: job.associatedProjectId || record.workbook.registeredJob?.jobId || record.workbook.projectId || '', bytes, savedAt: record.savedAt, revision: job.revision ?? null, pageCount: pages.length, complete, embeddedArtworkFields, embeddedArtworkCharacters, duplicatedQuotationArtworkPages }));
} else {
  const report = { directory: target, verified: [], failures: [], newestComplete: null, originalRecordsModified: false };
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.raw.json')) continue;
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), path.join(target, entry.name), '--record'], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    if (result.status !== 0) report.failures.push({ file: entry.name, error: result.stderr });
    else {
      const metadata = JSON.parse(result.stdout);
      report.verified.push(metadata);
      if (metadata.complete && (!report.newestComplete || metadata.savedAt > report.newestComplete.savedAt)) report.newestComplete = metadata;
    }
  }
  fs.writeFileSync(path.join(target, 'independent-verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ verified: report.verified.length, failures: report.failures.length, newestComplete: report.newestComplete }));
  if (report.failures.length) process.exitCode = 1;
}
