import { supabase } from '../../../lib/supabaseAdmin';
import { checkRateLimit, getIp } from '../../../lib/rateLimit';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code required' });

  // Rate limit by IP + email to prevent brute force of 6-digit codes
  const rl = checkRateLimit(`verify2fa:${getIp(req)}:${String(email).toLowerCase()}`, 10, 15 * 60 * 1000);
  if (!rl.ok) return res.status(429).json({ error: 'Too many attempts. Try again later.' });

  // Find the latest code for this email
  const { data, error } = await supabase
    .from('user_2fa_codes')
    .select('*')
    .eq('email', email)
    .order('expires_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return res.status(400).json({ error: 'No code found' });
  const record = data[0];
  if (record.code !== code) return res.status(401).json({ error: 'Invalid code' });
  if (new Date(record.expires_at) < new Date()) return res.status(410).json({ error: 'Code expired' });

  // Optionally: delete or invalidate the code after use
  await supabase.from('user_2fa_codes').delete().eq('id', record.id);

  return res.status(200).json({ ok: true });
}
