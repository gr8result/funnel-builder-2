// /pages/api/social/bot-rules.js
// GET    → list rules for user
// POST   → create rule
// PUT    → update rule (pass id in body)
// DELETE → delete rule (?id=)

import { requireUser } from '../../../lib/social/auth';

export default async function handler(req, res) {
  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const { admin, user } = auth;

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('social_bot_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, rules: data });
  }

  if (req.method === 'POST') {
    const {
      account_id, platform, name, trigger_type = 'keyword', keywords = [],
      match_mode = 'any', scope = 'comment',
      reply_comment = null, reply_dm = null, like_comment = false, is_active = true,
    } = req.body || {};

    if (!account_id || !platform || !name) {
      return res.status(400).json({ ok: false, error: 'account_id, platform, and name are required' });
    }

    const { data, error } = await admin
      .from('social_bot_rules')
      .insert({
        user_id: user.id,
        account_id, platform, name, trigger_type,
        keywords, match_mode, scope,
        reply_comment, reply_dm, like_comment, is_active,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, rule: data });
  }

  if (req.method === 'PUT') {
    const { id, ...fields } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'Missing rule id' });

    const allowed = [
      'name', 'trigger_type', 'keywords', 'match_mode', 'scope',
      'reply_comment', 'reply_dm', 'like_comment', 'is_active',
    ];
    const update = {};
    for (const k of allowed) {
      if (k in fields) update[k] = fields[k];
    }
    update.updated_at = new Date().toISOString();

    const { data, error } = await admin
      .from('social_bot_rules')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, rule: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });

    const { error } = await admin
      .from('social_bot_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
