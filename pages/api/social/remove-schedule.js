// /pages/api/social/remove-schedule.js
import { requireUser } from '../../../lib/social/auth';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'Missing schedule id' });

  try {
    // Verify ownership
    const { data: schedule, error: fetchErr } = await auth.admin
      .from('social_schedule')
      .select('id, post_id')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (fetchErr || !schedule) {
      return res.status(404).json({ ok: false, error: 'Schedule not found' });
    }

    // Remove queue entry for this post/schedule
    await auth.admin
      .from('social_queue')
      .delete()
      .eq('post_id', schedule.post_id)
      .eq('user_id', auth.user.id)
      .eq('status', 'queued');

    // Delete the schedule row
    const { error } = await auth.admin
      .from('social_schedule')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id);

    if (error) throw error;

    // Revert post status back to draft
    await auth.admin
      .from('social_posts')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', schedule.post_id)
      .eq('user_id', auth.user.id)
      .eq('status', 'scheduled');

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
