// pages/api/affiliate/confirm-email.js
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  // Find application by token
  const { data, error } = await supabaseAdmin
    .from('affiliate_applications')
    .select('id,affiliate_user_id,email_confirmed')
    .eq('email_confirm_token', token)
    .maybeSingle();

  if (error || !data) return res.status(400).json({ error: 'Invalid token' });
  if (data.email_confirmed) return res.status(200).json({ ok: true, alreadyConfirmed: true });

  // Mark email as confirmed
  const { error: updateErr } = await supabaseAdmin
    .from('affiliate_applications')
    .update({ email_confirmed: true })
    .eq('id', data.id);

  if (updateErr) return res.status(400).json({ error: 'Failed to confirm email' });
  return res.status(200).json({ ok: true });
}
