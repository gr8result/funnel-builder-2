import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: node scripts/inspect-user-image-duplicates.mjs <userId>');
  process.exit(1);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function hashUrl(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return `ERR:${response.status}`;
    const buffer = Buffer.from(await response.arrayBuffer());
    return sha256(buffer);
  } catch (error) {
    return `ERR:${error.message}`;
  }
}

const { data: rows, error } = await supabase
  .from('social_image_library')
  .select('id, url, storage_path, created_at, description')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(500);

if (error) {
  console.error(error.message);
  process.exit(1);
}

const hashedRows = [];
for (const row of rows || []) {
  hashedRows.push({
    id: row.id,
    url: row.url,
    storage_path: row.storage_path,
    created_at: row.created_at,
    description: row.description,
    hash: await hashUrl(row.url),
  });
}

const counts = hashedRows.reduce((map, row) => {
  map.set(row.hash, (map.get(row.hash) || 0) + 1);
  return map;
}, new Map());

const duplicateGroups = [...counts.entries()]
  .filter(([hash, count]) => !String(hash).startsWith('ERR:') && count > 1)
  .sort((a, b) => b[1] - a[1]);

const duplicates = hashedRows.filter((row) => duplicateGroups.some(([hash]) => hash === row.hash));
const bucketBreakdown = hashedRows.reduce((acc, row) => {
  const storage = String(row.storage_path || '');
  const bucket = storage.startsWith('assets:') ? 'assets' : storage ? 'social-images' : 'none';
  acc[bucket] = (acc[bucket] || 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  userId,
  rowCount: hashedRows.length,
  bucketBreakdown,
  duplicateGroups: duplicateGroups.slice(0, 25),
  duplicateRows: duplicates.slice(0, 200),
}, null, 2));
