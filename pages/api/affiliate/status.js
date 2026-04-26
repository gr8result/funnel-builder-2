// pages/api/affiliate/status.js
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  const { affiliate_user_id } = req.query;
  if (!affiliate_user_id) return res.status(400).json({ error: 'Missing affiliate_user_id' });

  const { data, error } = await supabaseAdmin
    .from('affiliate_applications')
    .select('approved,affiliate_user_id,email_confirmed')
    .eq('affiliate_user_id', affiliate_user_id)
    .maybeSingle();

  if (error || !data) return res.status(404).json({ error: 'Affiliate not found' });
  return res.status(200).json(data);
}
