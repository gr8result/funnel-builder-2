// pages/api/affiliate-application-status.js
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { id, approved } = req.body;
  if (!id || typeof approved !== 'boolean') {
    return res.status(400).json({ error: 'Missing id or approved' });
  }
  // Update affiliate_product_applications status
  const { data: appData, error: appError } = await supabaseAdmin
    .from('affiliate_product_applications')
    .select('*')
    .eq('id', id)
    .single();
  if (appError || !appData) {
    return res.status(500).json({ error: appError?.message || 'Application not found' });
  }
  const updateRes = await supabaseAdmin
    .from('affiliate_product_applications')
    .update({ status: approved ? 'approved' : 'denied' })
    .eq('id', id);
  if (updateRes.error) {
    return res.status(500).json({ error: updateRes.error.message });
  }
  // If approved, upsert affiliate_applications
  if (approved) {
    // Fetch affiliate details
    const { data: affiliateDetails } = await supabaseAdmin
      .from('affiliate_applications')
      .select('*')
      .eq('affiliate_user_id', appData.affiliate_user_id)
      .single();
    await supabaseAdmin
      .from('affiliate_applications')
      .upsert({
        affiliate_user_id: appData.affiliate_user_id,
        product_id: appData.product_id,
        approved: true,
        emoji: affiliateDetails?.emoji || '😊',
        name: affiliateDetails?.name || '',
        email: affiliateDetails?.email || '',
        phone_number: affiliateDetails?.phone_number || '',
        business_name: affiliateDetails?.business_name || '',
        abn_tax_number: affiliateDetails?.abn_tax_number || '',
      });
  }
  return res.status(200).json({ ok: true });
}
