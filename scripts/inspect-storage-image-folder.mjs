import 'dotenv/config';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const bucket = process.argv[2];
const prefix = process.argv[3] || '';

if (!bucket) {
  console.error('Usage: node scripts/inspect-storage-image-folder.mjs <bucket> [prefix]');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function isImageName(name = '') {
  return /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(String(name || ''));
}

function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function listAllStorageEntries() {
  const results = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: pageSize, offset, sortBy: { column: 'created_at', order: 'asc' } });

    if (error) throw error;

    const batch = data || [];
    results.push(...batch);
    if (batch.length < pageSize) break;
    offset += batch.length;
  }

  return results;
}

const entries = (await listAllStorageEntries()).filter((entry) => isImageName(entry?.name));
const rows = [];

for (const entry of entries) {
  const path = prefix ? `${prefix}/${entry.name}`.replace(/\/+/g, '/') : entry.name;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const url = data?.publicUrl || '';
  const response = await fetch(url);
  if (!response.ok) {
    rows.push({ name: entry.name, path, status: response.status, hash: `ERR:${response.status}`, url });
    continue;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  rows.push({
    name: entry.name,
    path,
    created_at: entry.created_at || entry.updated_at || null,
    size: entry.metadata?.size || null,
    hash: hashBuffer(buffer),
    url,
  });
}

const duplicateGroups = [...rows.reduce((map, row) => {
  map.set(row.hash, (map.get(row.hash) || 0) + 1);
  return map;
}, new Map()).entries()]
  .filter(([hash, count]) => !String(hash).startsWith('ERR:') && count > 1)
  .sort((a, b) => b[1] - a[1]);

console.log(JSON.stringify({
  bucket,
  prefix,
  count: rows.length,
  duplicateGroups,
  rows,
}, null, 2));