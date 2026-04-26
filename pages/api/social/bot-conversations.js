// /pages/api/social/bot-conversations.js
// GET → paginated conversation log for the current user
// DELETE → clear all conversations for user (optional bulk clear)

import { requireUser } from '../../../lib/social/auth';

export default async function handler(req, res) {
  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const { admin, user } = auth;

  if (req.method === 'GET') {
    const page    = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit   = Math.min(50, parseInt(req.query.limit || '30', 10));
    const offset  = (page - 1) * limit;
    const platform = req.query.platform || null;
    const actionFilter = req.query.action || null; // 'none' | 'replied_comment' | etc.

    let q = admin
      .from('social_bot_conversations')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (platform) q = q.eq('platform', platform);
    if (actionFilter === 'unmatched') q = q.eq('action_taken', 'none');
    else if (actionFilter) q = q.ilike('action_taken', `%${actionFilter}%`);

    const { data, error, count } = await q;
    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.status(200).json({ ok: true, conversations: data, total: count, page, limit });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    let q = admin.from('social_bot_conversations').delete().eq('user_id', user.id);
    if (id) q = q.eq('id', id);

    const { error } = await q;
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
