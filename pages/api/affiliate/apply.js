// pages/api/affiliate/apply.js
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { product_id, affiliate_user_id } = req.body;
  if (!product_id || !affiliate_user_id) return res.status(400).json({ error: 'Missing product_id or affiliate_user_id' });

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

