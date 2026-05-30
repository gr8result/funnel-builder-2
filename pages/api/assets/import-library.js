import { requireUser } from '../../../lib/social/auth';
import { createHash } from 'crypto';
import { isBlockedSharedMediaHash } from '../../../lib/sharedMediaModeration';
import { withAuth } from "../../../lib/withWorkspace";

const SHARED_ASSET_BUCKET = 'assets';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

function safeName(value = 'image') {
  return String(value || 'image')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'image';
}

function hashText(value = '') {
  let hash = 0;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function canonicalSourceUrl(imageUrl = '') {
  const value = String(imageUrl || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString();
  } catch {
    return value.split('?')[0];
  }
}

function isPlaceholderSourceUrl(imageUrl = '') {
  const value = String(imageUrl || '').trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return host === 'placehold.co' || host === 'via.placeholder.com' || host === 'dummyimage.com';
  } catch {
    return false;
  }
}

function extensionFromMime(mimeType = '') {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('svg')) return 'svg';
  return 'jpg';
}

function extensionFromUrl(imageUrl = '') {
  const cleanUrl = String(imageUrl || '').split('?')[0];
  const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : '';
}

async function readImageInput(imageUrl) {
  if (imageUrl.startsWith('data:image/')) {
    const matches = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) throw new Error('Invalid image data');
    return {
      mimeType: matches[1],
      buffer: Buffer.from(matches[2], 'base64'),
      suggestedExt: extensionFromMime(matches[1]),
    };
  }

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to download image (${response.status})`);

  const mimeType = response.headers.get('content-type') || 'image/jpeg';
  if (!String(mimeType).toLowerCase().startsWith('image/')) {
    throw new Error('URL did not return an image');
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    mimeType,
    buffer: Buffer.from(arrayBuffer),
    suggestedExt: extensionFromUrl(imageUrl) || extensionFromMime(mimeType),
  };
}

function isConflictError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.statusCode === '409' || error?.status === 409 || message.includes('already exists') || message.includes('duplicate');
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const items = Array.isArray(req.body?.assets) ? req.body.assets.slice(0, 25) : [];
  if (!items.length) return res.status(400).json({ ok: false, error: 'assets array is required' });

  const results = [];

  for (const item of items) {
    const imageUrl = String(item?.imageUrl || '').trim();
    const assetKey = safeName(item?.assetKey || item?.name || `asset-${Date.now()}`);
    const displayName = String(item?.name || assetKey || 'Shared image').trim();

    if (!imageUrl) {
      results.push({ assetKey, ok: false, error: 'Missing imageUrl' });
      continue;
    }

    if (isPlaceholderSourceUrl(imageUrl)) {
      results.push({ assetKey, name: displayName, ok: false, error: 'Placeholder image sources are not imported into the shared library' });
      continue;
    }

    try {
      const { mimeType, buffer, suggestedExt } = await readImageInput(imageUrl);
      const extension = suggestedExt || 'jpg';
      const sourceKey = canonicalSourceUrl(imageUrl) || imageUrl;
      const fullContentHash = sha256(buffer);
      if (isBlockedSharedMediaHash(fullContentHash)) {
        results.push({ assetKey, name: displayName, ok: false, error: 'Blocked image source is not imported into the shared library' });
        continue;
      }
      const contentHash = fullContentHash.slice(0, 20);
      const sourceHash = hashText(sourceKey);
      const storagePath = `generic/library-${String(sourceHash)}-${contentHash}.${extension}`;

      const uploadResult = await auth.admin.storage
        .from(SHARED_ASSET_BUCKET)
        .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

      if (uploadResult.error && !isConflictError(uploadResult.error)) {
        throw uploadResult.error;
      }

      const { data } = auth.admin.storage.from(SHARED_ASSET_BUCKET).getPublicUrl(storagePath);
      results.push({
        assetKey,
        name: displayName,
        ok: true,
        publicUrl: data?.publicUrl || imageUrl,
        storagePath,
        sourceUrl: sourceKey,
        existed: Boolean(uploadResult.error),
      });
    } catch (error) {
      results.push({ assetKey, name: displayName, ok: false, error: error?.message || 'Import failed' });
    }
  }

  return res.status(200).json({ ok: true, results });
}

export default withAuth(handler);
