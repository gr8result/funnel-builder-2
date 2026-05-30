// /pages/api/social/save-image.js
// Saves a generated image (base64 or URL) to the social image library.
// Uploads to the shared assets bucket and records metadata in social_image_library.

import { requireUser } from '../../../lib/social/auth';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { withAuth } from "../../../lib/withWorkspace";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SHARED_ASSET_BUCKET = 'assets';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

function safeName(value = 'image') {
  return String(value || 'image')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'image';
}

function extensionFromMime(mimeType = '') {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('svg')) return 'svg';
  return 'png';
}

function extensionFromUrl(imageUrl = '') {
  const cleanUrl = String(imageUrl || '').split('?')[0];
  const parts = cleanUrl.split('.');
  const ext = String(parts[parts.length - 1] || '').toLowerCase();
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
  const arrayBuffer = await response.arrayBuffer();
  return {
    mimeType,
    buffer: Buffer.from(arrayBuffer),
    suggestedExt: extensionFromUrl(imageUrl) || extensionFromMime(mimeType),
  };
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function findExistingImage(auth, userId, storagePath) {
  const { data } = await auth.admin
    .from('social_image_library')
    .select('id, url, storage_path, description, tags, created_at')
    .eq('user_id', userId)
    .eq('storage_path', storagePath)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

export async function persistImageForUser(auth, { imageUrl, description = '', tags = [], source = 'social', skipLibrary = false }) {
  const userId = auth.user.id;
  const { mimeType, buffer, suggestedExt } = await readImageInput(imageUrl);
  const descriptionText = String(description || '').slice(0, 500);
  const imageHash = sha256(buffer);
  const filename = `${userId}/shared-${imageHash}.${suggestedExt || 'png'}`;
  const storagePath = `assets:${filename}`;

  if (!skipLibrary) {
    const existing = await findExistingImage(auth, userId, storagePath);
    if (existing) return existing;
  }

  const { error: uploadError } = await admin.storage
    .from(SHARED_ASSET_BUCKET)
    .upload(filename, buffer, { contentType: mimeType, upsert: false });

  if (uploadError && uploadError.statusCode !== '409' && uploadError.status !== 409) throw uploadError;

  const { data: urlData } = admin.storage.from(SHARED_ASSET_BUCKET).getPublicUrl(filename);
  const publicUrl = urlData.publicUrl;

  // When skipLibrary is true (e.g. auto-generated campaign images), we upload to storage
  // for a stable URL but do not insert a library row — keeps the media library clean.
  if (skipLibrary) {
    return { url: publicUrl, storage_path: storagePath, id: null };
  }

  const { data, error: dbError } = await admin
    .from('social_image_library')
    .insert({
      user_id: userId,
      url: publicUrl,
      storage_path: storagePath,
      description: descriptionText,
      tags: Array.isArray(tags) ? tags : [],
    })
    .select()
    .single();

  if (dbError) {
    const reused = await findExistingImage(auth, userId, storagePath);
    if (reused) return reused;
    throw dbError;
  }
  return data;
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const { imageUrl, description = '', tags = [] } = req.body || {};
  if (!imageUrl) return res.status(400).json({ ok: false, error: 'imageUrl is required' });

  try {
    const data = await persistImageForUser(auth, { imageUrl, description, tags });

    return res.json({ ok: true, image: data });
  } catch (err) {
    console.error('save-image error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default withAuth(handler);
