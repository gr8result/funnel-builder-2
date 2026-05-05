import 'dotenv/config';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
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

async function cleanupUserFolder(userId) {
  const { data: rows, error: rowError } = await supabase
    .from('social_image_library')
    .select('id, url, storage_path, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (rowError) throw rowError;

  const keepByHash = new Map();
  const duplicateRowIds = [];
  const duplicatePathsByBucket = new Map();

  for (const row of rows || []) {
    const response = await fetch(row.url);
    if (!response.ok) continue;
    const buffer = Buffer.from(await response.arrayBuffer());
    const hash = hashBuffer(buffer);
    const target = resolveStorageTarget(row.storage_path, row.url);
    if (!keepByHash.has(hash)) {
      keepByHash.set(hash, { id: row.id, target });
      continue;
    }

    duplicateRowIds.push(row.id);
    if (target?.bucket && target?.path) {
      if (!duplicatePathsByBucket.has(target.bucket)) duplicatePathsByBucket.set(target.bucket, []);
      duplicatePathsByBucket.get(target.bucket).push(target.path);
    }
  }

  for (const [bucket, paths] of duplicatePathsByBucket.entries()) {
    const uniquePaths = Array.from(new Set(paths));
    if (!uniquePaths.length) continue;
    const { error } = await supabase.storage.from(bucket).remove(uniquePaths);
    if (error) throw error;
  }

  if (duplicateRowIds.length) {
    const { error } = await supabase.from('social_image_library').delete().in('id', duplicateRowIds);
    if (error) throw error;
  }

  return {
    userId,
    kept: keepByHash.size,
    removedFiles: Array.from(duplicatePathsByBucket.values()).reduce((sum, paths) => sum + Array.from(new Set(paths)).length, 0),
    removedRows: duplicateRowIds.length,
  };
}

async function main() {
  const { data: users, error } = await supabase
    .from('social_image_library')
    .select('user_id');
  if (error) throw error;
  const folderNames = Array.from(new Set((users || []).map((row) => row.user_id).filter(Boolean)));

  const results = [];
  for (const folderName of folderNames) {
    try {
      const result = await cleanupUserFolder(folderName);
      results.push(result);
    } catch (error) {
      results.push({ userId: folderName, error: error.message || String(error) });
    }
  }

  const totals = results.reduce((acc, item) => {
    acc.users += item.error ? 0 : 1;
    acc.removedFiles += item.removedFiles || 0;
    acc.removedRows += item.removedRows || 0;
    acc.kept += item.kept || 0;
    return acc;
  }, { users: 0, kept: 0, removedFiles: 0, removedRows: 0 });

  console.log(JSON.stringify({ totals, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
