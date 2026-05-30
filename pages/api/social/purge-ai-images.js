// /pages/api/social/purge-ai-images.js
// Deletes all auto-generated social campaign images from the user's image library.
// These are images tagged ['social', 'generated'] that the AI image generator
// saved automatically. They are NOT manually-uploaded library images.

import { requireUser } from '../../../lib/social/auth';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from "../../../lib/withWorkspace";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function resolveStoragePath(row) {
  const raw = String(row.storage_path || '');
  if (raw.startsWith('assets:')) return { bucket: 'assets', path: raw.slice('assets:'.length) };
  return null;
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ error: auth.error });

  try {
    // Load all auto-generated social images for this user
    const { data: rows, error: fetchError } = await admin
      .from('social_image_library')
      .select('id, storage_path, tags')
      .eq('user_id', auth.user.id)
      .contains('tags', ['generated']);

    if (fetchError) throw fetchError;
    if (!rows || rows.length === 0) {
      return res.status(200).json({ ok: true, deleted: 0, message: 'Nothing to purge.' });
    }

    // Delete the storage objects first
    const storagePaths = rows
      .map(resolveStoragePath)
      .filter(Boolean)
      .filter(r => r.bucket === 'assets');

    if (storagePaths.length) {
      await admin.storage
        .from('assets')
        .remove(storagePaths.map(r => r.path));
      // Storage removal errors are non-fatal — the DB row deletion is more important
    }

    // Delete the library rows
    const ids = rows.map(r => r.id);
    const { error: deleteError } = await admin
      .from('social_image_library')
      .delete()
      .in('id', ids);

    if (deleteError) throw deleteError;

    return res.status(200).json({ ok: true, deleted: ids.length });
  } catch (err) {
    console.error('purge-ai-images error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to purge images' });
  }
}

export default withAuth(handler);
