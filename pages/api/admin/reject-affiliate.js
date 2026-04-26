// /pages/api/admin/reject-affiliate.js
// Admin API — Reject affiliate application

import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing affiliate id' });
  try {
    const { error } = await supabaseAdmin
      .from('affiliate_applications')
      .update({ status: 'rejected' })
      .eq('id', id);
    if (error) throw error;
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
