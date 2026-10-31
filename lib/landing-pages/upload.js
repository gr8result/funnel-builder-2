// Stores an uploaded image in the public "assets" bucket under the workspace's landing-pages folder.

import { supabaseAdmin } from '../supabaseAdmin';

const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': null };
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function parseImageDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m || !IMAGE_TYPES[m[1]]) throw Object.assign(new Error('Upload a JPG, PNG, WebP, GIF or AVIF image'), { status: 400 });
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > MAX_IMAGE_BYTES) throw Object.assign(new Error('Images must be under 8 MB'), { status: 400 });
  return { contentType: m[1], ext: IMAGE_TYPES[m[1]], bytes };
}

export async function storeImage(workspaceId, folder, { dataUrl, fileName }) {
  const { contentType, ext, bytes } = parseImageDataUrl(dataUrl);
  const name = String(fileName || 'image').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9-]+/g, '-').slice(0, 40) || 'image';
  const path = `landing-pages/${workspaceId}/${folder}/${Date.now()}-${name}.${ext}`;
  const up = await supabaseAdmin.storage.from('assets').upload(path, bytes, { contentType, upsert: false, cacheControl: '31536000' });
  if (up.error) throw new Error(`upload failed: ${up.error.message}`);
  const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(path);
  return data.publicUrl;
}
