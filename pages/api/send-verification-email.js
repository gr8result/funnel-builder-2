import { sendEmail } from '../../lib/sendEmail';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, userCode } = req.body;
  if (!email || !userCode) {
    return res.status(400).json({ error: 'Missing email or userCode' });
  }

  const from =
    process.env.SENDGRID_FROM_EMAIL ||
    process.env.DEFAULT_FROM_EMAIL ||
    'no-reply@gr8result.com';

  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host;
  const hostOrigin = host ? `${protocol}://${host}` : '';
  const origin =
    hostOrigin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    process.env.APP_URL ||
    'http://localhost:3000';

  // Send users straight into marketplace verification handling.
  const verificationLink = `${origin}/marketplace?code=${encodeURIComponent(userCode)}`;

  const subject = 'Verify your email for Xchange';
  // Use absolute public path for logo (works for local and production)
  const logoUrl = `${origin}/xchange-logo.gif`;
  const html = `
    <div style="max-width:600px;margin:auto;padding:32px 24px;background:#181f2e;border-radius:16px;color:#fff;font-family:sans-serif;">
      <img src="${logoUrl}" alt="Xchange Logo" style="display:block;margin:auto;width:120px;height:120px;object-fit:contain;" />
      <h1 style="font-size:32px;font-weight:700;margin:24px 0 12px 0;color:#22c55e;">Welcome to The Xchange Marketplace!</h1>
      <p style="font-size:18px;margin-bottom:24px;">Click below to verify your email and activate your account:</p>
      <p style="margin:24px 0;text-align:center;">
        <a href="${verificationLink}" style="display:inline-block;padding:16px 32px;background:#22c55e;color:#181f2e;font-weight:bold;font-size:20px;border-radius:8px;text-decoration:none;">Click here to verify your email</a>
      </p>
      <p style="font-size:16px;margin-bottom:24px;">If you did not request this, you can ignore this email.</p>
      <hr style="margin:32px 0;border:none;border-top:1px solid #333;" />
      <p style="font-size:16px;margin-bottom:8px;">Kind regards,<br />The Xchange Marketplace Team</p>
      <p style="font-size:14px;color:#aaa;">The Xchange Marketplace is part of <strong>Gr8 Result Digital Solutions</strong>.</p>
    </div>
  `;

  try {
    const result = await sendEmail({
      to: email,
      from,
      subject,
      html,
      text: `Welcome to Xchange Marketplace! Please verify your email: ${verificationLink}`,
    });
    if (result.ok) {
      res.status(200).json({ ok: true });
    } else {
      // Log error for debugging
      console.error('SendGrid error:', result.error);
      res.status(500).json({ error: result.error || 'Failed to send email', skipped: !!result.skipped });
    }
  } catch (err) {
    // Log unexpected error
    console.error('Unexpected error sending email:', err);
    res.status(500).json({ error: err?.message || String(err) });
  }
}
