// pages/api/marketplace-user.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }
  // Look up user by email
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, password_hash, verified, phone_verified, user_code')
    .eq('email', email)
    .maybeSingle();
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.status(200).json(user);
}
