// /pages/api/admin/get-all-affiliates.js
// Admin API â€” Fetch all affiliate applications (bypasses RLS via supabaseAdmin)

import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { withAdmin } from '../../../lib/withAdmin';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const { data, error, count } = await supabaseAdmin
      .from('affiliate_applications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    res.status(200).json({ affiliates: data || [], count: count || 0 });
  } catch (err) {
    console.error('get-all-affiliates error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

export default withAdmin(handler);

