// Reports which product-library records have a usable image and which will render
// "Image awaiting verification". Checks that locally-referenced files actually exist
// under public/, since a path that points nowhere fails the same way as no path.
//
//   node scripts/audit-product-library-images.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('E:/dev/funnel-builder-clean');
const CATALOGUES = path.join(ROOT, 'data/product-library/catalogues');
const PUBLIC = path.join(ROOT, 'public');

const IMAGE_FIELDS = ['primaryImageUrl', 'imageUrl', 'swatchImage', 'thumbnailUrl', 'swatchThumbnail', 'image', 'primary_image_url', 'thumbnail_url'];
const NAME_FIELDS = ['productName', 'product_name', 'colourName', 'name', 'id'];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.json') && !entry.name.endsWith('.report.json')) out.push(full);
  }
  return out;
}

function records(value) {
  if (Array.isArray(value)) return value.filter((v) => v && typeof v === 'object');
  if (value && typeof value === 'object') {
    for (const key of ['products', 'items', 'records', 'data']) {
      if (Array.isArray(value[key])) return value[key].filter((v) => v && typeof v === 'object');
    }
  }
  return [];
}

const localExists = new Map();
function localImageExists(url) {
  if (localExists.has(url)) return localExists.get(url);
  const clean = url.split('?')[0].split('#')[0];
  const ok = fs.existsSync(path.join(PUBLIC, clean.replace(/^\//, '')));
  localExists.set(url, ok);
  return ok;
}

const summary = [];
let totals = { records: 0, withImage: 0, remote: 0, localOk: 0, localMissing: 0, none: 0 };
const missingExamples = [];

for (const file of walk(CATALOGUES)) {
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
  const rows = records(parsed);
  if (!rows.length) continue;

  const stat = { file: path.relative(ROOT, file), records: rows.length, none: 0, localMissing: 0, localOk: 0, remote: 0 };
  for (const row of rows) {
    totals.records += 1;
    const field = IMAGE_FIELDS.find((f) => typeof row[f] === 'string' && row[f].trim());
    const url = field ? row[field].trim() : '';
    const name = NAME_FIELDS.map((f) => row[f]).find(Boolean) || '(unnamed)';

    if (!url) {
      stat.none += 1; totals.none += 1;
      if (missingExamples.length < 25) missingExamples.push({ file: stat.file, name, reason: 'no image field' });
    } else if (/^https?:\/\//i.test(url)) {
      stat.remote += 1; totals.remote += 1; totals.withImage += 1;
    } else if (localImageExists(url)) {
      stat.localOk += 1; totals.localOk += 1; totals.withImage += 1;
    } else {
      stat.localMissing += 1; totals.localMissing += 1;
      if (missingExamples.length < 25) missingExamples.push({ file: stat.file, name, reason: `file not found: ${url}` });
    }
  }
  summary.push(stat);
}

summary.sort((a, b) => (b.none + b.localMissing) - (a.none + a.localMissing));

console.log(`Product library image audit\n${'='.repeat(78)}`);
console.log(`${'catalogue'.padEnd(52)} ${'recs'.padStart(5)} ${'ok'.padStart(5)} ${'missing'.padStart(8)}`);
for (const s of summary) {
  const missing = s.none + s.localMissing;
  console.log(`${s.file.slice(-52).padEnd(52)} ${String(s.records).padStart(5)} ${String(s.localOk + s.remote).padStart(5)} ${String(missing).padStart(8)}${missing ? '  <-' : ''}`);
}

console.log(`\nTotals`);
console.log(`  records                 ${totals.records}`);
console.log(`  with a usable image     ${totals.withImage}  (${((totals.withImage / totals.records) * 100).toFixed(1)}%)`);
console.log(`    - local file present  ${totals.localOk}`);
console.log(`    - remote URL          ${totals.remote}`);
console.log(`  will show placeholder   ${totals.none + totals.localMissing}`);
console.log(`    - no image at all     ${totals.none}`);
console.log(`    - path points nowhere ${totals.localMissing}`);

if (missingExamples.length) {
  console.log(`\nExamples of records that will render the placeholder:`);
  for (const m of missingExamples) console.log(`  ${m.name} — ${m.reason}`);
}
