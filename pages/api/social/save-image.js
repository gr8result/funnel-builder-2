// /pages/api/social/save-image.js
// Saves a generated image (base64 or URL) to the social image library.
// Uploads to Supabase storage and records metadata in social_image_library.

import { requireUser } from '../../../lib/social/auth';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const { imageUrl, description = '', tags = [] } = req.body || {};
  if (!imageUrl) return res.status(400).json({ ok: false, error: 'imageUrl is required' });

  try {
    const userId = auth.user.id;
    let storagePath = null;
    let publicUrl = imageUrl;

    // If it's a base64 data URL, upload to Supabase storage
    if (imageUrl.startsWith('data:image/')) {
      const matches = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ ok: false, error: 'Invalid image data' });
      const mimeType = matches[1];
      const ext = mimeType.split('/')[1] || 'png';
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await admin.storage
        .from('social-images')
        .upload(filename, buffer, { contentType: mimeType, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = admin.storage.from('social-images').getPublicUrl(filename);
      publicUrl = urlData.publicUrl;
      storagePath = filename;
    }

    // Record in DB
    const { data, error: dbError } = await admin
      .from('social_image_library')
      .insert({
        user_id: userId,
        url: publicUrl,
        storage_path: storagePath,
        description: String(description).slice(0, 500),
        tags: Array.isArray(tags) ? tags : [],
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return res.json({ ok: true, image: data });
  } catch (err) {
    console.error('save-image error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
