// /pages/api/social/update-post.js
import { requireUser } from '../../../lib/social/auth';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const { postId, content, mediaUrl } = req.body || {};
  if (!postId) {
    return res.status(400).json({ ok: false, error: 'Missing postId' });
  }
  if (content !== undefined && typeof content !== 'string') {
    return res.status(400).json({ ok: false, error: 'Invalid content' });
  }
  if (content !== undefined && !content.trim()) {
    return res.status(400).json({ ok: false, error: 'Content cannot be empty' });
  }

  try {
    // Verify ownership before updating
    const { data: existing, error: fetchErr } = await auth.admin
      .from('social_posts')
      .select('id')
      .eq('id', postId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (fetchErr || !existing) {
      return res.status(404).json({ ok: false, error: 'Post not found' });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (content !== undefined) updates.content = content.trim();
    if (mediaUrl !== undefined) updates.media_url = mediaUrl;

    const { error } = await auth.admin
      .from('social_posts')
      .update(updates)
      .eq('id', postId)
      .eq('user_id', auth.user.id);

    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
