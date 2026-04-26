// EMAIL TEMPLATE SENT TO VENDOR:
/*
<h2>Verify your Vendor Agreement</h2>
<p>Hello [name],</p>
<p>Thank you for signing the Vendor Agreement. Please verify your email address and phone number to complete your application.</p>
<p><b>Email:</b> [email]<br/><b>Phone:</b> [phone]</p>
<p><a href="[verifyUrl]" style="background:#22c55e;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Verify and Go to Marketplace</a></p>
<p>If you did not request this, please ignore this email.</p>
*/
// /pages/api/vendor/send-verification.js
// Sends a verification email to the vendor with a link to verify and redirect to /modules/vendor
import { sendEmail } from '../../../lib/sendEmail';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, name, phone, token } = req.body;
  if (!email || !token) return res.status(400).json({ error: 'Missing email or token' });

  // Verification link (localhost for dev)
  // After clicking, user is redirected to /modules/vendor (see verify.js)
  const verifyUrl = `http://localhost:3000/api/vendor/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  const html = `
    <div style="text-align:center;margin-bottom:24px;">
      <img src="https://funnel-builder-2-btnj.vercel.app/xchange-logo.gif" alt="The Xchange Marketplace Logo" style="width:110px;height:auto;margin-bottom:10px;" />
    </div>
    <h2>Verify your Vendor Agreement</h2>
    <p>Hello ${name || ''},</p>
    <p>Thank you for signing the Vendor Agreement. Please verify your email address and phone number to complete your application.</p>
    <p><b>Email:</b> ${email}<br/><b>Phone:</b> ${phone || ''}</p>
    <p><a href="${verifyUrl}" style="background:#22c55e;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Verify and Go to Marketplace</a></p>
    <p>If you did not request this, please ignore this email.</p>
  `;

  try {
    await sendEmail({
      to: email,
      from: 'no-reply@gr8result.com',
      subject: 'Verify your Vendor Agreement',
      html,
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
