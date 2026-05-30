// pages/api/affiliate/apply.js
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { withAuth } from '../../../lib/withWorkspace';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { product_id } = req.body;
  const affiliate_user_id = req.user.id;
  if (!product_id) return res.status(400).json({ error: 'Missing product_id' });

  // Prevent duplicate applications
  const { data: existing, error: findErr } = await supabaseAdmin
    .from('affiliate_applications')
    .select('id')
    .eq('product_id', product_id)
    .eq('affiliate_user_id', affiliate_user_id)
    .maybeSingle();
  if (existing) return res.status(409).json({ error: 'Already applied for this offer.' });

  const { error } = await supabaseAdmin
    .from('affiliate_applications')
    .insert([{ product_id, affiliate_user_id, status: 'pending', created_at: new Date().toISOString() }]);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}

export default withAuth(handler);

