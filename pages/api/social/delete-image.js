import { requireUser } from '../../../lib/social/auth';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const { id } = req.query;
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  // Get storage_path before deleting so we can remove from storage too
  const { data: img } = await auth.admin
    .from('social_image_library')
    .select('id, storage_path, user_id')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .single();

  if (!img) return res.status(404).json({ ok: false, error: 'Image not found' });

  // Remove from storage if uploaded there
  if (img.storage_path) {
    await auth.admin.storage.from('social-images').remove([img.storage_path]);
  }

  const { error } = await auth.admin
    .from('social_image_library')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id);

  if (error) return res.status(500).json({ ok: false, error: error.message });

  return res.json({ ok: true });
}
