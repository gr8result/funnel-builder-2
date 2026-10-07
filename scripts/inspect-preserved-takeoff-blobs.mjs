// Offline, read-only corroboration of preserved Chrome blobs. This is not a
// substitute for a verified JSON backup: Chrome's V8 wire version is newer than
// Node's and the compatible plain-object subset is decoded with a header shim.
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function snappy(input) {
  let offset = 0, length = 0, shift = 0, byte;
  do { byte = input[offset++]; length += (byte & 127) * 2 ** shift; shift += 7; } while (byte & 128);
  if (length > 512 * 1024 * 1024) throw new Error('Unexpected decompression size.');
  const output = Buffer.alloc(length);
  let position = 0;
  while (offset < input.length && position < length) {
    const tag = input[offset++], type = tag & 3;
    let count, back;
    if (type === 0) {
      count = tag >> 2;
      if (count < 60) count++;
      else { const bytes = count - 59; count = input.readUIntLE(offset, bytes) + 1; offset += bytes; }
      if (offset + count > input.length || position + count > length) throw new Error('Invalid literal.');
      input.copy(output, position, offset, offset + count); offset += count; position += count;
    } else {
      if (type === 1) { count = 4 + ((tag >> 2) & 7); back = ((tag & 224) << 3) | input[offset++]; }
      else { count = 1 + (tag >> 2); const bytes = type === 2 ? 2 : 4; back = input.readUIntLE(offset, bytes); offset += bytes; }
      if (!back || back > position || position + count > length) throw new Error('Invalid copy.');
      for (let i = 0; i < count; i++) { output[position] = output[position - back]; position++; }
    }
  }
  if (position !== length) throw new Error('Truncated Snappy output.');
  return output;
}
const target = path.resolve(process.argv[2]);
if (process.argv[3] === '--blob') {
  let bytes = fs.readFileSync(target);
  if (bytes[0] === 255 && bytes[1] === 17 && bytes[2] === 2) bytes = snappy(bytes.subarray(3));
  const start = bytes.indexOf(Buffer.from([255, 16]));
  if (start < 0) throw new Error('Unsupported Chrome blob header.');
  bytes[start + 1] = 15; // In-memory only. The source file remains byte-for-byte intact.
  const record = v8.deserialize(bytes.subarray(start));
  const jobs = [record.workbook?.aiPlanTakeoffJob, record.workbook?.takeoffEngine?.aiPlanTakeoffJob].filter(Boolean);
  const job = jobs.find(job => (job.plan?.pages || job.planPages || []).length) || {};
  console.log(JSON.stringify({ file: path.basename(target), key: record.key, savedAt: record.savedAt, pageCount: (job.plan?.pages || job.planPages || []).length, revision: job.revision ?? null }));
} else {
  const report = { source: target, decoding: 'Best-effort offline V8 plain-object compatibility shim; originals unmodified', records: [], errors: [] };
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (!entry.isFile() || !/^1_00_/.test(entry.name)) continue;
    const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url), path.join(target, entry.name), '--blob'], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    if (run.status) report.errors.push({ file: entry.name, error: run.stderr.slice(0, 500) });
    else report.records.push(JSON.parse(run.stdout));
  }
  fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ inspected: report.records.length, errors: report.errors.length, withPlans: report.records.filter(row => row.pageCount > 0) }));
}
