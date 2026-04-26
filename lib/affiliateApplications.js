// lib/affiliateApplications.js
import { supabaseAdmin } from './supabaseAdmin';

export async function getAffiliateApplications() {
  const { data, error } = await supabaseAdmin
    .from('affiliate_applications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
