// /lib/affiliate/affiliatePayouts.js
// Handles affiliate payout requests
import { supabase } from '../supabaseAdmin';

export async function requestAffiliatePayout({ affiliateUserId, amount }) {
  if (!affiliateUserId || !amount) return { error: 'Missing fields' };

  const { data, error } = await supabase
    .from('affiliate_payout_requests')
    .insert([
      {
        affiliate_user_id: affiliateUserId,
        amount,
        status: 'pending',
        requested_at: new Date().toISOString(),
      },
    ]);

  if (error) return { error };
  return { ok: true, data };
}

export async function getAffiliatePayouts(affiliateUserId) {
  const { data, error } = await supabase
    .from('affiliate_payout_requests')
    .select('*')
    .eq('affiliate_user_id', affiliateUserId)
    .order('requested_at', { ascending: false });

  if (error) return { error };
  return { ok: true, data };
}
