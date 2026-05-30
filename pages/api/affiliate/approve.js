// /pages/api/affiliate/approve.js
// Called by admin dashboard when approving an affiliate application.
// Marks the application approved, generates a verification token,
// and sends a verification email. When the applicant clicks the link,
// /api/vendor/verify-affiliate.js inserts them into the vendors table.
import crypto from "crypto";

import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { sendEmail } from '../../../lib/sendEmail';
import { withAdmin } from '../../../lib/withAdmin';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing application id' });

  // Fetch the application
  const { data: app, error: fetchErr } = await supabaseAdmin
    .from('affiliate_applications')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Generate a cryptographically secure verification token
  const token = crypto.randomBytes(32).toString('hex');

  // Mark approved and store token
  const { error: updateErr } = await supabaseAdmin
    .from('affiliate_applications')
    .update({ approved: true, status: 'approved', token })
    .eq('id', id);

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  // Send verification email
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://funnel-builder-2-btnj.vercel.app';
  const verifyUrl = `${baseUrl}/api/vendor/verify-affiliate?token=${encodeURIComponent(token)}`;

  const html = `
    <div style="text-align:center;margin-bottom:24px;">
      <img src="https://funnel-builder-2-btnj.vercel.app/xchange-logo.gif" alt="The Xchange Marketplace Logo" style="width:110px;height:auto;margin-bottom:10px;" />
    </div>
    <h2>Your Affiliate Application Has Been Approved!</h2>
    <p>Hello ${app.name || ''},</p>
    <p>Congratulations! Your application to join The Xchange Marketplace as a vendor/affiliate has been approved.</p>
    <p>Please click the button below to verify your email address and activate your vendor account.</p>
    <p style="text-align:center;margin:32px 0;">
      <a href="${verifyUrl}" style="background:#22c55e;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">
        Verify Email &amp; Activate Account
      </a>
    </p>
    <p>If you did not apply for this, please ignore this email.</p>
  `;

  try {
    await sendEmail({
      to: app.email,
      from: 'no-reply@gr8result.com',
      subject: 'Your Affiliate Application Has Been Approved â€” Please Verify',
      html,
    });
  } catch (emailErr) {
    // Don't fail the whole request if email fails â€” approval is still saved
    console.error('Failed to send approval email:', emailErr.message);
  }

  return res.status(200).json({ ok: true });
}

export default withAdmin(handler);


