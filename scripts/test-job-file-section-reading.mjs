import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import { readJob, writeJob } from '../lib/jobFile.ts';

let stored;
const handle = {
  name: 'section-reading.gr8job',
  getFile: async () => { if (!stored) throw Object.assign(new Error('not created'), { name: 'NotFoundError' }); return new File([stored], handle.name); },
  createWritable: async () => ({ write: async blob => { stored = blob; }, close: async () => {} }),
};
const mb = Number(process.env.GR8_TEST_ASSET_MB || 12);
const asset = 'data:image/png;base64,' + 'aBcDeFgH01234567'.repeat(mb * 1024 * 1024 / 16);
const takeoff = { calibration: 0.25, levels: ['Lower', 'Upper'], rooms: [{ id: 'r1', approved: true }],
  manualCorrections: [{ id: 'w1', lengthMm: 3210 }], quantities: { wallsLm: 3.21 }, image: asset };
const started = performance.now();
await writeJob(handle, { jobId: 'section-reading', jobName: 'Section reading', takeoff });
assert.ok(stored?.size > 0);

// Count actual ZIP entry decompressions through the public reader. There should be
// one per section, with checksum validation still rejecting damaged packages.
const load = JSZip.loadAsync;
const counts = new Map();
JSZip.loadAsync = async (...args) => {
  const zip = await load.apply(JSZip, args);
  for (const [name, entry] of Object.entries(zip.files)) {
    const original = entry.async;
    entry.async = function (...params) { counts.set(name, (counts.get(name) || 0) + 1); return original.apply(this, params); };
  }
  return zip;
};
let restored;
try { restored = await readJob(await handle.getFile()); } finally { JSZip.loadAsync = load; }
for (const key of Object.keys(takeoff)) assert.deepEqual(restored.takeoff[key], takeoff[key], `${key} preserved`);
assert.equal(restored.jobId, 'section-reading');
for (const [name, count] of counts) assert.equal(count, 1, `${name} decompressed once`);

const corrupt = await JSZip.loadAsync(await stored.arrayBuffer());
corrupt.file('takeoff.json', JSON.stringify({ ...takeoff, calibration: 999 }));
await assert.rejects(readJob(new File([await corrupt.generateAsync({ type: 'uint8array' })], 'corrupt.gr8job')), /checksum/);
corrupt.remove('takeoff.json');
await assert.rejects(readJob(new File([await corrupt.generateAsync({ type: 'uint8array' })], 'missing.gr8job')), /missing/);
const future = await JSZip.loadAsync(await stored.arrayBuffer());
const manifest = JSON.parse(await future.file('manifest.json').async('text'));
manifest.sectionChecksums['future-section'] = 'invalid';
future.file('manifest.json', JSON.stringify(manifest));
await assert.rejects(readJob(new File([await future.generateAsync({ type: 'uint8array' })], 'future.gr8job')), /future-section/);
const evidence = { assetMB: mb, packageBytes: stored.size, elapsedMs: Math.round(performance.now() - started),
  peakRssKB: process.resourceUsage().maxRSS, sectionReads: Object.fromEntries(counts),
  preserved: ['identity', 'calibration', 'levels', 'rooms', 'approvals', 'manual corrections', 'quantities', 'image'],
  corruptionChecks: 'PASS', roundtrip: 'PASS' };
fs.mkdirSync('artifacts/test-results/takeoff-resume-20261116', { recursive: true });
fs.writeFileSync(`artifacts/test-results/takeoff-resume-20261116/package-${mb}mb.json`, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
