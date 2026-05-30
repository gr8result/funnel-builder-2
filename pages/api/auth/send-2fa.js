import { randomInt } from 'crypto';
import { supabase } from '../../../lib/supabaseAdmin';
import sendEmail from '../../../lib/sendEmail';
import { checkRateLimit, getIp } from '../../../lib/rateLimit';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getIp(req);
  const rl = checkRateLimit(`2fa:${ip}`, 5, 10 * 60 * 1000);
  if (!rl.ok) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  // Generate a 6-digit code
  const code = randomInt(100000, 999999).toString();

  // Store code in Supabase (with expiry)
  const { error } = await supabase
    .from('user_2fa_codes')
    .insert({ email, code, expires_at: new Date(Date.now() + 10 * 60 * 1000) }); // 10 min expiry
  if (error) return res.status(500).json({ error: 'Failed to store code' });

  // Send code via email
  await sendEmail({
    to: email,
    subject: 'Your Xchange Marketplace 2FA Code',
    text: `Your verification code is: ${code}`,
    html: `<p>Your verification code is: <b>${code}</b></p>`
  });

  return res.status(200).json({ ok: true });
}
