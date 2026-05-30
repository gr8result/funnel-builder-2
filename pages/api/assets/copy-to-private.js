import { requireUser } from '../../../lib/social/auth';
import { withAuth } from "../../../lib/withWorkspace";
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

const BUCKET = 'assets';

function extensionFromMime(mimeType = '') {
  const m = String(mimeType || '').toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  if (m.includes('svg')) return 'svg';
  return 'jpg';
}

function extensionFromUrl(url = '') {
  const ext = String(url || '').split('?')[0].split('.').pop()?.toLowerCase() || '';
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : '';
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const items = Array.isArray(req.body?.assets) ? req.body.assets.slice(0, 25) : [];
  if (!items.length) return res.status(400).json({ ok: false, error: 'assets array is required' });

  const userId = auth.user.id;
  const results = [];

  for (const item of items) {
    const imageUrl = String(item?.imageUrl || '').trim();
    const name = String(item?.name || 'Image').trim();

    if (!imageUrl) {
      results.push({ name, ok: false, error: 'Missing imageUrl' });
      continue;
    }

    try {
      // Download image bytes
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`Could not download image (${response.status})`);
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      const buffer = Buffer.from(await response.arrayBuffer());

      // Use a timestamp-based filename — intentionally NO content hash in the name.
      // If the filename contained the same SHA256 hash as the generic source,
      // listMergedSharedMediaLibrary would treat it as a duplicate of the generic
      // image and suppress it from the private section. A timestamp path avoids this.
      const ext = extensionFromUrl(imageUrl) || extensionFromMime(mimeType);
      const filename = `${userId}/private-copy-${Date.now()}.${ext}`;
      const storagePath = `${BUCKET}:${filename}`;

      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(filename, buffer, { contentType: mimeType, upsert: false });

      if (uploadError && uploadError.statusCode !== '409' && uploadError.status !== 409) {
        throw uploadError;
      }

      const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(filename);
      const publicUrl = urlData?.publicUrl || imageUrl;

      const { data: row, error: dbError } = await admin
        .from('social_image_library')
        .insert({
          user_id: userId,
          url: publicUrl,
          storage_path: storagePath,
          description: name,
          tags: ['copied-from-generic'],
        })
        .select()
        .single();

      if (dbError) throw dbError;

      results.push({ name, ok: true, url: publicUrl, id: row?.id });
    } catch (error) {
      results.push({ name, ok: false, error: error?.message || 'Copy failed' });
    }
  }

  const anyFailed = results.some((r) => !r.ok);
  return res.status(anyFailed && results.every((r) => !r.ok) ? 500 : 200).json({ ok: true, results });
}

export default withAuth(handler);

