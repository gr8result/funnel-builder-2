// pages/api/affiliate/send-confirmation.js
import { sendEmail } from '../../../lib/sendEmail';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, token } = req.body;
  if (!email || !token) return res.status(400).json({ error: 'Missing email or token' });

  const confirmUrl = `${process.env.APP_URL || 'http://localhost:3000'}/marketplace/confirm-email?token=${encodeURIComponent(token)}`;
  const subject = 'Confirm your Gr8Result Affiliate Application';
  const html = `<p>Thanks for applying to become a Gr8Result affiliate!<br><br>
To complete your application, please <a href="${confirmUrl}">click here to confirm your email address</a>.<br><br>
Once confirmed, you can apply for affiliate offers and start earning commissions.<br><br>
If you did not apply, you can safely ignore this email.</p>`;

  const result = await sendEmail({
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || 'no-reply@gr8result.com',
    subject,
    html,
  });

  if (!result.ok) return res.status(400).json({ error: result.error || 'Failed to send email' });
  return res.status(200).json({ ok: true });
}
