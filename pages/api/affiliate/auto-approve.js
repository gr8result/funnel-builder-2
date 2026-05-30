// pages/api/affiliate/auto-approve.js
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import withAdmin from "../../../lib/withAdmin";

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  // Find application by token
  const { data, error } = await supabaseAdmin
    .from('affiliate_applications')
    .select('id')
    .eq('email_confirm_token', token)
    .maybeSingle();

  if (error || !data) return res.status(400).json({ error: 'Invalid token' });

  // Set approved = true
  const { error: updateErr } = await supabaseAdmin
    .from('affiliate_applications')
    .update({ approved: true })
    .eq('id', data.id);

  if (updateErr) return res.status(400).json({ error: 'Failed to approve application' });
  return res.status(200).json({ ok: true });
}

export default withAdmin(handler);
