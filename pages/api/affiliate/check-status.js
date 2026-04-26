// /pages/api/affiliate/check-status.js
// Server-side affiliate status check — bypasses RLS on affiliate_applications.
// Called by marketplace/index.js instead of a direct client query.
// GET ?affiliateId=XXXXXXXX

import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const affiliateId = String(req.query.affiliateId || '').trim().toUpperCase();
  if (!affiliateId) {
    return res.status(400).json({ approved: false, error: 'Missing affiliateId' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('affiliate_applications')
      .select('id, affiliate_id, affiliate_user_id, status, approved')
      .eq('affiliate_id', affiliateId)
      .maybeSingle();

    if (error) throw error;

    const isApproved = data?.status === 'approved';

    return res.status(200).json({
      approved: isApproved,
      affiliateId: data?.affiliate_id || null,
      affiliateUserId: data?.affiliate_user_id || null,
    });
  } catch (err) {
    console.error('check-status error:', err.message);
    return res.status(500).json({ approved: false, error: err.message });
  }
}
