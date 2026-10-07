import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readJob, writeJob } from '../lib/jobFile.ts';
import { withWallLiningMappings } from '../lib/construction-estimation/quotationWallLinings.js';
const dir = 'recovery/quotation-changes-2026-10-03';
const audit = JSON.parse(fs.readFileSync(`${dir}/audit.json`));
const record = audit.filter(r=>r.recordKey === 'job:recovered-03-09-123' && r.workbookCopy).sort((a,b)=>b.recordSavedAt.localeCompare(a.recordSavedAt))[0];
assert(record);
const workbook = JSON.parse(fs.readFileSync(record.workbookCopy));
workbook.quotation = withWallLiningMappings(workbook.quotation);
const base = await readJob(new File([fs.readFileSync(`${dir}/download-original.gr8job`)], 'New Job 03 09.gr8job'));
// Browser records reference separately stored plan images. Embed the identical hash-verified
// images from the backup so this recovery file is portable to a fresh browser/profile.
const assets = new Map();
for (const job of [base.workbook?.aiPlanTakeoffJob, base.workbook?.takeoffEngine?.aiPlanTakeoffJob]) {
  for (const page of [...(job?.plan?.pages || []), ...(job?.planPages || [])]) {
    if (!page.dataUrl) continue;
    const hash = createHash('sha256').update(page.dataUrl).digest('hex');
    if(page.dataUrlAssetId) assert.equal(hash,page.dataUrlAssetId);
    assets.set(hash,page.dataUrl);
  }
}
for(const job of [workbook.aiPlanTakeoffJob,workbook.takeoffEngine?.aiPlanTakeoffJob]) {
  for(const page of [...(job?.plan?.pages || []),...(job?.planPages || [])]) {
    if(page.dataUrlAssetId && !page.dataUrl) {
      assert(assets.has(page.dataUrlAssetId),`missing backed-up image ${page.dataUrlAssetId}`);
      page.dataUrl=assets.get(page.dataUrlAssetId);
    }
  }
}
const destination = path.resolve(dir, `current-job-verified-${Date.now()}.gr8job`);
const handle = { name: path.basename(destination), getFile: async()=>new File([fs.readFileSync(destination)],path.basename(destination)), createWritable: async()=>({ write: async blob=>fs.writeFileSync(destination,Buffer.from(await blob.arrayBuffer())), close:async()=>{} }) };
const result = await writeJob(handle,{...base,workbook});
assert(result.ok);
const exported = await readJob(await handle.getFile());
const ids = w=>Object.fromEntries(Object.entries(w.quotation).map(([name,s])=>[name,s.rows.map(r=>r.id)]));
assert.deepEqual(ids(exported.workbook),ids(workbook));
fs.writeFileSync(`${dir}/current-fixture.json`,JSON.stringify({file:destination,source:record.workbookCopy,savedAt:record.recordSavedAt,jobId:workbook.jobId,rows:ids(workbook)},null,2));
console.log('PASS latest current browser job preserved in verified package',destination);
