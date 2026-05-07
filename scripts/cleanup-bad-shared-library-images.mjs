import 'dotenv/config';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { isBlockedSharedMediaHash, isPlaceholderSvgBuffer } from '../lib/sharedMediaModeration.js';

const userId = process.argv[2];

if (!userId) {
  console.error('Usage: node scripts/cleanup-bad-shared-library-images.mjs <userId>');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function isImageName(name = '') {
  return /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(String(name || ''));
}

async function listAllStorageEntries(bucket, prefix) {
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

const prefix = `${userId}/`;
const storageEntries = await listAllStorageEntries('assets', prefix);
const imageEntries = storageEntries.filter((entry) => isImageName(entry?.name));
const badPaths = [];

for (const entry of imageEntries) {
  const objectPath = `${prefix}${entry.name}`;
  const { data } = supabase.storage.from('assets').getPublicUrl(objectPath);
  const publicUrl = data?.publicUrl || '';
  if (!publicUrl) continue;
  const response = await fetch(publicUrl);
  if (!response.ok) continue;
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const buffer = Buffer.from(await response.arrayBuffer());
  const hash = sha256(buffer);
  if (isBlockedSharedMediaHash(hash) || isPlaceholderSvgBuffer(buffer, contentType)) {
    badPaths.push(objectPath);
  }
}

const uniquePaths = [...new Set(badPaths)];
if (uniquePaths.length) {
  const { error } = await supabase.storage.from('assets').remove(uniquePaths);
  if (error) throw error;
}

const pathFilters = uniquePaths.map((path) => `assets:${path}`);
if (pathFilters.length) {
  const { error } = await supabase
    .from('social_image_library')
    .delete()
    .eq('user_id', userId)
    .in('storage_path', pathFilters);
  if (error) throw error;
}

console.log(JSON.stringify({ userId, removedFiles: uniquePaths.length }, null, 2));