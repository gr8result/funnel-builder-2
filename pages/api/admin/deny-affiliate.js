// /pages/api/admin/deny-affiliate.js
// Admin API â€” Deny affiliate application

import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { sendEmail } from '../../../lib/sendEmail';
import { withAdmin } from '../../../lib/withAdmin';

const FROM = process.env.SENDGRID_FROM_EMAIL || 'no-reply@gr8result.com';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing affiliate id' });
  try {
    // Fetch applicant details first so we have email/name for the notification
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('affiliate_applications')
      .select('id, email, name')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;

    const { error } = await supabaseAdmin
      .from('affiliate_applications')
      .update({ status: 'denied', approved: false })
      .eq('id', id);
    if (error) throw error;

    // Send denial notification email â€” non-fatal
    if (existing?.email) {
      const firstName = (existing.name || 'Applicant').split(' ')[0];
      const emailResult = await sendEmail({
        to: existing.email,
        from: FROM,
        subject: 'An Update on Your Affiliate Application â€” GR8 RESULT',
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;">

      <!-- HEADER -->
      <tr>
        <td style="background:#060d18;padding:36px 40px 28px;text-align:center;border-bottom:3px solid #3b82f6;">
          <div style="font-size:36px;font-weight:900;letter-spacing:3px;color:#f97316;line-height:1;">GR8 RESULT</div>
          <div style="font-size:11px;color:#64748b;margin-top:6px;letter-spacing:2px;text-transform:uppercase;">Digital Solutions</div>
          <div style="font-size:13px;color:#94a3b8;margin-top:14px;letter-spacing:1px;text-transform:uppercase;">Xchange Marketplace Â· Affiliate Program</div>
        </td>
      </tr>

      <!-- STATUS BANNER -->
      <tr>
        <td style="background:#1c1917;padding:14px 40px;text-align:center;border-bottom:1px solid #292524;">
          <span style="font-size:16px;font-weight:800;color:#fca5a5;letter-spacing:0.5px;">Application Status Update</span>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="background:#0f172a;padding:40px 40px 32px;">
          <h1 style="font-size:26px;font-weight:800;color:#f1f5f9;margin:0 0 6px;">Hi ${firstName},</h1>
          <p style="font-size:15px;color:#64748b;margin:0 0 28px;line-height:1.6;">Thank you for your interest in the GR8 RESULT affiliate program.</p>

          <p style="font-size:16px;color:#cbd5e1;line-height:1.75;margin:0 0 16px;">
            We appreciate you taking the time to apply. After carefully reviewing your application, we are <strong style="color:#fca5a5;">unable to approve it at this time</strong>.
          </p>
          <p style="font-size:16px;color:#cbd5e1;line-height:1.75;margin:0 0 36px;">
            This decision does not reflect negatively on you, and we encourage you to reapply in the future as our program requirements evolve.
          </p>

          <!-- INFO BOX -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e1b1b;border:1px solid #44403c;border-radius:10px;margin-bottom:36px;">
            <tr><td style="padding:20px 24px;">
              <div style="font-size:13px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Need clarity or think this is an error?</div>
              <p style="font-size:15px;color:#a8a29e;margin:0;line-height:1.7;">Simply reply to this email and our team will review your case and respond as soon as possible.</p>
            </td></tr>
          </table>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#060d18;padding:24px 40px;border-top:1px solid #1e293b;">
          <p style="font-size:13px;color:#475569;margin:0;line-height:1.7;">
            We wish you all the best in your endeavours.<br>
            <strong style="color:#f97316;">The GR8 RESULT Team</strong>
            &nbsp;Â·&nbsp;
            <a href="https://www.gr8result.com.au" style="color:#3b82f6;text-decoration:none;">gr8result.com.au</a>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body></html>`,
        text: `Hi ${firstName}, thank you for applying to the GR8 RESULT affiliate program. Unfortunately we are unable to approve your application at this time. Please reply to this email if you have any questions.`,
      });

      if (!emailResult?.ok) {
        console.warn('Denial email not sent (non-fatal):', emailResult?.error || 'Unknown email send failure');
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export default withAdmin(handler);

