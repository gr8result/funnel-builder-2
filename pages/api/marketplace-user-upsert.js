// pages/api/marketplace-user-upsert.js
import { supabase } from '../../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }
  // Look up user by email
  let { data: user, error } = await supabase
    .from('users')
    .select('id, email, password_hash, verified, phone_verified, user_code')
    .eq('email', email)
    .maybeSingle();
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  if (!user) {
    // Create user if not found
    const user_code = uuidv4();
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({ email, user_code })
      .select('id, email, password_hash, verified, phone_verified, user_code')
      .maybeSingle();
    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }
    user = newUser;
  }
  return res.status(200).json(user);
}
