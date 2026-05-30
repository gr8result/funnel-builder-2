// /pages/api/admin/get-pending-affiliates.js
// Admin API â€” Fetch all pending affiliate applications

import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { withAdmin } from '../../../lib/withAdmin';

async function handler(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('affiliate_applications')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({ affiliates: data || [] });
  } catch (err) {
    console.error('Get pending affiliates error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

export default withAdmin(handler);

