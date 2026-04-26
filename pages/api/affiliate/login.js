// pages/api/affiliate/login.js
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });


  // Find affiliate application by email (case-insensitive, trimmed)
  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await supabaseAdmin
    .from('affiliate_applications')
    .select('id,affiliate_user_id,email_confirmed')
    .ilike('email', cleanEmail)
    .maybeSingle();

  if (error || !data) return res.status(401).json({ error: 'Affiliate not found or not confirmed.' });
  if (!data.email_confirmed) return res.status(401).json({ error: 'Email not confirmed.' });

  // Set cookie for session (simple demo, use JWT for production)
  res.setHeader('Set-Cookie', `affiliate_user_id=${data.affiliate_user_id}; Path=/; SameSite=Lax; Max-Age=86400;`);
  return res.status(200).json({ ok: true });
}
