import 'dotenv/config';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: node scripts/cleanup-user-image-duplicates.mjs <userId>');
  process.exit(1);
}

function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function resolveStorageTarget(storagePath = '', fallbackUrl = '') {
  const raw = String(storagePath || '');
  if (raw.startsWith('assets:')) return { bucket: 'assets', path: raw.slice('assets:'.length) };
  if (raw) return { bucket: 'social-images', path: raw };
  const url = String(fallbackUrl || '');
  const assetsMarker = '/storage/v1/object/public/assets/';
  const socialMarker = '/storage/v1/object/public/social-images/';
  if (url.includes(assetsMarker)) return { bucket: 'assets', path: url.split(assetsMarker)[1]?.split('?')[0] || '' };
  if (url.includes(socialMarker)) return { bucket: 'social-images', path: url.split(socialMarker)[1]?.split('?')[0] || '' };
  return null;
}

const { data: rows, error } = await supabase
  .from('social_image_library')
  .select('id, url, storage_path, created_at, description')
  .eq('user_id', userId)
  .order('created_at', { ascending: true });

if (error) {
  console.error(error.message);
  process.exit(1);
}

const keepByHash = new Map();
const duplicateRowIds = [];
const duplicatePathsByBucket = new Map();

async function hashRow(row) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(row.url, { signal: controller.signal });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      row,
      hash: hashBuffer(buffer),
      target: resolveStorageTarget(row.storage_path, row.url),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

const batchSize = 5;
for (let index = 0; index < (rows || []).length; index += batchSize) {
  const batch = (rows || []).slice(index, index + batchSize);
  const hashedBatch = await Promise.all(batch.map((row) => hashRow(row).catch(() => null)));
  for (const item of hashedBatch) {
    if (!item) continue;
    const { row, hash, target } = item;
    if (!keepByHash.has(hash)) {
      keepByHash.set(hash, { id: row.id, target, row });
      continue;
    }
    duplicateRowIds.push(row.id);
    if (target?.bucket && target?.path) {
      if (!duplicatePathsByBucket.has(target.bucket)) duplicatePathsByBucket.set(target.bucket, []);
      duplicatePathsByBucket.get(target.bucket).push(target.path);
    }
  }
}

for (const [bucket, paths] of duplicatePathsByBucket.entries()) {
  const uniquePaths = Array.from(new Set(paths));
  if (!uniquePaths.length) continue;
  const { error: removeError } = await supabase.storage.from(bucket).remove(uniquePaths);
  if (removeError) {
    console.error(`Failed removing from ${bucket}: ${removeError.message}`);
    process.exit(1);
  }
}

if (duplicateRowIds.length) {
  const { error: deleteError } = await supabase.from('social_image_library').delete().in('id', duplicateRowIds);
  if (deleteError) {
    console.error(deleteError.message);
    process.exit(1);
  }
}

console.log(JSON.stringify({
  userId,
  keptUniqueImages: keepByHash.size,
  removedIndexDuplicates: duplicateRowIds.length,
  removedStorageDuplicates: Array.from(duplicatePathsByBucket.values()).reduce((sum, paths) => sum + Array.from(new Set(paths)).length, 0),
  removedByBucket: Object.fromEntries(Array.from(duplicatePathsByBucket.entries()).map(([bucket, paths]) => [bucket, Array.from(new Set(paths)).length])),
}, null, 2));
