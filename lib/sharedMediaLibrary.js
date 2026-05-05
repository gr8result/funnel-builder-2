function isImageName(name = '') {
  return /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(String(name || ''));
}

export function getSharedMediaStorageName(storagePath = '', url = '') {
  const raw = String(storagePath || '').replace(/^assets:/, '').trim();
  if (raw) {
    const parts = raw.split('/');
    return parts[parts.length - 1] || '';
  }

  const cleanUrl = String(url || '').split('?')[0];
  const segments = cleanUrl.split('/');
  return segments[segments.length - 1] || '';
}

export function getSharedMediaKind(storagePath = '', url = '') {
  const name = getSharedMediaStorageName(storagePath, url).toLowerCase();
  if (name.startsWith('library-')) return 'template';
  if (name.startsWith('shared-')) return 'edited';
  if (name.startsWith('logo-')) return 'logo';
  if (name.startsWith('web-')) return 'upload';
  return 'asset';
}

export function isTemplateSharedMedia(storagePath = '', url = '') {
  return getSharedMediaKind(storagePath, url) === 'template';
}

function sortNewestFirst(a, b) {
  return new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime();
}

function canonicalUrl(url = '') {
  const value = String(url || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return value;
  }
}

function extractContentHash(...values) {
  for (const value of values) {
    const filename = String(value || '').split('?')[0].split('/').pop() || '';
    const matches = filename.match(/[a-f0-9]{64}/gi);
    if (matches?.length) return matches[matches.length - 1].toLowerCase();
  }
  return '';
}

function deriveDisplayName({ description = '', storagePath = '', url = '' }) {
  const text = String(description || '').trim();
  if (text) return text;

  const storage = String(storagePath || '').replace(/^assets:/, '');
  if (storage) return storage.split('/').pop() || storage;

  const cleanUrl = String(url || '').split('?')[0];
  return cleanUrl.split('/').pop() || 'Image';
}

async function listAllStorageEntries({ admin, bucket, prefix, limit }) {
  const pageSize = Math.min(Math.max(Number(limit) || 500, 100), 1000);
  const results = [];
  let offset = 0;

  while (results.length < limit) {
    const remaining = limit - results.length;
    const batchSize = Math.min(pageSize, remaining);
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: batchSize, offset, sortBy: { column: 'created_at', order: 'desc' } });

    if (error) throw error;

    const batch = data || [];
    results.push(...batch);
    if (batch.length < batchSize) break;
    offset += batch.length;
  }

  return results;
}

export async function listMergedSharedMediaLibrary({ admin, userId, bucket = 'assets', limit = 500 }) {
  const { data: rows, error } = await admin
    .from('social_image_library')
    .select('id, url, description, tags, created_at, storage_path')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const prefix = `${userId}/`;
  const storageEntries = await listAllStorageEntries({ admin, bucket, prefix, limit });

  const rowByStoragePath = new Map((rows || [])
    .filter((row) => row?.storage_path)
    .sort(sortNewestFirst)
    .map((row) => [row.storage_path, row]));

  const rowByUrl = new Map((rows || [])
    .filter((row) => row?.url)
    .sort(sortNewestFirst)
    .map((row) => [canonicalUrl(row.url), row]));

  const merged = [];
  const seen = new Set();
  const seenUrls = new Set();
  const seenHashes = new Set();

  for (const entry of (storageEntries || []).filter((item) => isImageName(item?.name))) {
    const objectPath = `${prefix}${entry.name}`;
    const storagePath = `${bucket}:${objectPath}`;
    const { data: publicData } = admin.storage.from(bucket).getPublicUrl(objectPath);
    const publicUrl = publicData?.publicUrl || '';
    const match = rowByStoragePath.get(storagePath) || rowByUrl.get(canonicalUrl(publicUrl));
    const id = match?.id || `asset:${objectPath}`;
    const canonical = canonicalUrl(publicUrl);
    const contentHash = extractContentHash(storagePath, publicUrl, entry.name, match?.url);
    if (seen.has(id) || (canonical && seenUrls.has(canonical)) || (contentHash && seenHashes.has(contentHash))) continue;
    seen.add(id);
    if (canonical) seenUrls.add(canonical);
    if (contentHash) seenHashes.add(contentHash);
    merged.push({
      id,
      url: publicUrl,
      name: deriveDisplayName({ description: match?.description, storagePath, url: publicUrl }),
      description: match?.description || entry.name,
      tags: match?.tags || [],
      created_at: match?.created_at || entry.created_at || entry.updated_at || new Date().toISOString(),
      storage_path: storagePath,
      kind: getSharedMediaKind(storagePath, publicUrl),
      is_template: isTemplateSharedMedia(storagePath, publicUrl),
      shared: true,
    });
  }

  for (const row of (rows || []).sort(sortNewestFirst)) {
    if (!row?.url) continue;
    const canonical = canonicalUrl(row.url);
    const contentHash = extractContentHash(row.storage_path, row.url, row.description);
    if (seen.has(row.id) || (canonical && seenUrls.has(canonical)) || (contentHash && seenHashes.has(contentHash))) continue;
    seen.add(row.id);
    if (canonical) seenUrls.add(canonical);
    if (contentHash) seenHashes.add(contentHash);
    merged.push({
      ...row,
      name: deriveDisplayName({ description: row.description, storagePath: row.storage_path, url: row.url }),
      kind: getSharedMediaKind(row.storage_path, row.url),
      is_template: isTemplateSharedMedia(row.storage_path, row.url),
    });
  }

  return merged.sort(sortNewestFirst);
}