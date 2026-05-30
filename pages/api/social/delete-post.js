// /pages/api/social/delete-post.js
import { requireUser } from '../../../lib/social/auth';
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'Missing post id' });

  try {
    // Verify ownership
    const { data: post, error: fetchErr } = await auth.admin
      .from('social_posts')
      .select('id')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (fetchErr || !post) {
      return res.status(404).json({ ok: false, error: 'Post not found' });
    }

    // Remove related schedule and queue rows first
    await auth.admin.from('social_schedule').delete().eq('post_id', id).eq('user_id', auth.user.id);
    await auth.admin.from('social_queue').delete().eq('post_id', id).eq('user_id', auth.user.id);

    // Delete the post
    const { error } = await auth.admin
      .from('social_posts')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id);

    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default withAuth(handler);
