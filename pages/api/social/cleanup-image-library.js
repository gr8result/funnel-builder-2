import { createHash } from 'crypto';
import { requireUser } from '../../../lib/social/auth';
import { isBlockedSharedMediaHash, isPlaceholderSvgBuffer } from '../../../lib/sharedMediaModeration';

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function resolveStorageTarget(storagePath = '', fallbackUrl = '') {
  const raw = String(storagePath || '');
  if (raw.startsWith('assets:')) return { bucket: 'assets', path: raw.slice('assets:'.length) };
  if (raw) return { bucket: 'social-images', path: raw };
  const url = String(fallbackUrl || '');
  const assetsMarker = '/storage/v1/object/public/assets/';
  const socialMarker = '/storage/v1/object/public/social-images/';
  if (url.includes(assetsMarker)) {
    return { bucket: 'assets', path: url.split(assetsMarker)[1]?.split('?')[0] || '' };
  }
  if (url.includes(socialMarker)) {
    return { bucket: 'social-images', path: url.split(socialMarker)[1]?.split('?')[0] || '' };
  }
  return null;
}

async function listAllStorageEntries(admin, bucket, prefix) {
  const results = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await admin.storage
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

function isLegacyGenericLibraryObject(name = '') {
  return /^library-(funnel-template|website-template)-/i.test(String(name || ''));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });
  if (!auth.isDeveloper) return res.status(403).json({ ok: false, error: 'Only developer accounts can remove shared library duplicates.' });

  const { data: rows, error: rowError } = await auth.admin
    .from('social_image_library')
    .select('id, url, storage_path, created_at, description')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: true });

  if (rowError) return res.status(500).json({ ok: false, error: rowError.message });

  const prefix = `${auth.user.id}/`;

  let storageEntries;
  try {
    storageEntries = await listAllStorageEntries(auth.admin, 'assets', prefix);
  } catch (storageError) {
    return res.status(500).json({ ok: false, error: storageError.message });
  }

  const legacyEntries = (storageEntries || []).filter((entry) => isLegacyGenericLibraryObject(entry?.name));
  if (legacyEntries.length) {
    const legacyPaths = legacyEntries.map((entry) => `${prefix}${entry.name}`);
    const legacyPublicUrls = legacyPaths.map((path) => auth.admin.storage.from('assets').getPublicUrl(path)?.data?.publicUrl).filter(Boolean);

    await auth.admin.storage.from('assets').remove(legacyPaths);

    if (legacyPaths.length || legacyPublicUrls.length) {
      const clauses = [];
      if (legacyPaths.length) {
        clauses.push(...legacyPaths.map((path) => `storage_path.eq.assets:${path}`));
      }
      if (legacyPublicUrls.length) {
        clauses.push(...legacyPublicUrls.map((url) => `url.eq.${url}`));
      }
      if (clauses.length) {
        await auth.admin
          .from('social_image_library')
          .delete()
          .eq('user_id', auth.user.id)
          .or(clauses.join(','));
      }
    }

    storageEntries = storageEntries.filter((entry) => !isLegacyGenericLibraryObject(entry?.name));
  }

  const rowStoragePaths = new Set((rows || []).map((row) => row?.storage_path).filter(Boolean));
  const rowUrls = new Set((rows || []).map((row) => String(row?.url || '').trim()).filter(Boolean));

  const storageOnlyRows = (storageEntries || [])
    .filter((entry) => /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(String(entry?.name || '')))
    .map((entry) => {
      const path = `${prefix}${entry.name}`;
      const { data } = auth.admin.storage.from('assets').getPublicUrl(path);
      return {
        id: `asset:${path}`,
        url: data?.publicUrl || '',
        storage_path: `assets:${path}`,
        created_at: entry.created_at || entry.updated_at || new Date().toISOString(),
        description: entry.name,
      };
    })
    .filter((entry) => !rowStoragePaths.has(entry.storage_path) && !rowUrls.has(entry.url));

  const allRows = [...(rows || []), ...storageOnlyRows].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  const keepByHash = new Map();
  const duplicateObjectsByBucket = new Map();
  const duplicateRowIds = [];
  const invalidObjectsByBucket = new Map();
  const invalidRowIds = [];

  for (const row of allRows) {
    try {
      const response = await fetch(row.url);
      const target = resolveStorageTarget(row.storage_path, row.url);
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!response.ok || !contentType.startsWith('image/')) {
        invalidRowIds.push(row.id);
        if (target?.bucket && target?.path) {
          if (!invalidObjectsByBucket.has(target.bucket)) invalidObjectsByBucket.set(target.bucket, []);
          invalidObjectsByBucket.get(target.bucket).push(target.path);
        }
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const hash = sha256(buffer);
      if (isBlockedSharedMediaHash(hash) || isPlaceholderSvgBuffer(buffer, contentType)) {
        invalidRowIds.push(row.id);
        if (target?.bucket && target?.path) {
          if (!invalidObjectsByBucket.has(target.bucket)) invalidObjectsByBucket.set(target.bucket, []);
          invalidObjectsByBucket.get(target.bucket).push(target.path);
        }
        continue;
      }

      if (!keepByHash.has(hash)) {
        keepByHash.set(hash, { rowId: row.id, target });
        continue;
      }

      const kept = keepByHash.get(hash);
      duplicateRowIds.push(row.id);
      const sameTarget = kept?.target?.bucket === target?.bucket && kept?.target?.path === target?.path;
      if (!sameTarget && target?.bucket && target?.path) {
        if (!duplicateObjectsByBucket.has(target.bucket)) duplicateObjectsByBucket.set(target.bucket, []);
        duplicateObjectsByBucket.get(target.bucket).push(target.path);
      }
    } catch {
      continue;
    }
  }

  for (const [bucket, paths] of duplicateObjectsByBucket.entries()) {
    if (!paths.length) continue;
    await auth.admin.storage.from(bucket).remove(Array.from(new Set(paths)));
  }

  for (const [bucket, paths] of invalidObjectsByBucket.entries()) {
    if (!paths.length) continue;
    await auth.admin.storage.from(bucket).remove(Array.from(new Set(paths)));
  }

  const actualRowIds = duplicateRowIds.filter((id) => !String(id).startsWith('asset:'));
  const actualInvalidRowIds = invalidRowIds.filter((id) => !String(id).startsWith('asset:'));

  if (actualRowIds.length) {
    await auth.admin.from('social_image_library').delete().in('id', actualRowIds);
  }

  if (actualInvalidRowIds.length) {
    await auth.admin.from('social_image_library').delete().in('id', actualInvalidRowIds);
  }

  return res.json({
    ok: true,
    removedLegacyGenericFiles: legacyEntries.length,
    removedInvalidFiles: Array.from(invalidObjectsByBucket.values()).reduce((sum, paths) => sum + Array.from(new Set(paths)).length, 0),
    removedStorageDuplicates: Array.from(duplicateObjectsByBucket.values()).reduce((sum, paths) => sum + Array.from(new Set(paths)).length, 0),
    removedIndexDuplicates: actualRowIds.length + actualInvalidRowIds.length,
    keptUniqueImages: keepByHash.size,
  });
}