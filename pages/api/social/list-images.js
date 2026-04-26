import { requireUser } from '../../../lib/social/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const { data, error } = await auth.admin
    .from('social_image_library')
    .select('id, url, description, tags, created_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ ok: false, error: error.message });

  return res.json({ ok: true, images: data || [] });
}
