// /pages/api/admin/approve-affiliate.js
// Admin API — Approve affiliate application
// Sets status=approved + verified, provisions vendors row, sends approval email.

import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { sendEmail } from '../../../lib/sendEmail';

const FROM = process.env.SENDGRID_FROM_EMAIL || 'no-reply@gr8result.com';

function getBaseUrl(req) {
  // Prefer explicit env override, then derive from the incoming request host
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.APP_URL) return process.env.APP_URL;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing affiliate id' });
  try {
    let emailStatus = { attempted: false, ok: false, skipped: false, error: null };

    // Fetch once so we can always email/provision from a known record.
    const { data: existingApp, error: fetchErr } = await supabaseAdmin
      .from('affiliate_applications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      return res.status(500).json({ error: fetchErr.message || 'Failed to read affiliate application' });
    }
    if (!existingApp) {
      return res.status(404).json({ error: 'No affiliate application found for this id' });
    }

    // 1. Mark approved (with graceful schema fallback for older DBs).
    const nowIso = new Date().toISOString();
    const updateCandidates = [
      { status: 'approved', approved: true, verified: true, verified_at: nowIso },
      { status: 'approved', approved: true, verified: true },
      { status: 'approved', approved: true },
      { status: 'approved' },
    ];

    let applicant = existingApp;
    let updateSucceeded = false;
    let lastUpdateError = null;

    for (const payload of updateCandidates) {
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('affiliate_applications')
        .update(payload)
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (!updateErr) {
        applicant = updated || applicant;
        updateSucceeded = true;
        break;
      }

      lastUpdateError = updateErr;
      console.warn('approve-affiliate update attempt failed:', updateErr.message);
    }

    if (!updateSucceeded) {
      return res.status(500).json({
        error: lastUpdateError?.message || 'Failed to approve affiliate application',
      });
    }

    // 2. Provision a vendors row so vendor/affiliate dashboard access is granted immediately.
    //    Skip if a vendor row already exists for this email or user_id.
    try {
      const lookupEmail = applicant.email || '';
      const lookupUserId = applicant.affiliate_user_id || null;

      const { data: existingVendor } = await supabaseAdmin
        .from('vendors')
        .select('id')
        .or(
          [
            lookupEmail ? `email.ilike.${lookupEmail}` : null,
            lookupUserId ? `user_id.eq.${lookupUserId}` : null,
          ]
            .filter(Boolean)
            .join(',')
        )
        .maybeSingle();

      if (!existingVendor?.id) {
        const { error: insertErr } = await supabaseAdmin.from('vendors').insert({
          user_id: lookupUserId,
          business_name: applicant.business_name || applicant.name || '',
          full_name: applicant.name || '',
          email: lookupEmail,
          created_at: new Date().toISOString(),
        });
        if (insertErr) {
          console.warn('vendors insert failed (non-fatal):', insertErr.message);
        }
      }
    } catch (vendorErr) {
      console.warn('Vendor provisioning failed (non-fatal):', vendorErr.message);
    }

    // 3. Send approval email — MUST be awaited before res.json() or it gets killed in serverless
    const APP_URL = getBaseUrl(req);
    if (applicant?.email) {
      const firstName = (applicant.name || 'Applicant').split(' ')[0];
      emailStatus.attempted = true;
      const emailResult = await sendEmail({
        to: applicant.email,
        from: FROM,
        subject: 'Your Affiliate Application Has Been Approved — GR8 RESULT',
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;">

      <!-- HEADER -->
      <tr>
        <td style="background:#060d18;padding:36px 40px 28px;text-align:center;border-bottom:3px solid #22c55e;">
          <div style="font-size:36px;font-weight:900;letter-spacing:3px;color:#22c55e;line-height:1;">GR8 RESULT</div>
          <div style="font-size:11px;color:#64748b;margin-top:6px;letter-spacing:2px;text-transform:uppercase;">Digital Solutions</div>
          <div style="font-size:13px;color:#94a3b8;margin-top:14px;letter-spacing:1px;text-transform:uppercase;">Xchange Marketplace · Affiliate Program</div>
        </td>
      </tr>

      <!-- STATUS BANNER -->
      <tr>
        <td style="background:#14532d;padding:14px 40px;text-align:center;">
          <span style="font-size:16px;font-weight:800;color:#bbf7d0;letter-spacing:0.5px;">✅ &nbsp;APPLICATION APPROVED</span>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="background:#0f172a;padding:40px 40px 32px;">
          <h1 style="font-size:26px;font-weight:800;color:#f1f5f9;margin:0 0 6px;">Congratulations, ${firstName}!</h1>
          <p style="font-size:15px;color:#64748b;margin:0 0 28px;line-height:1.6;">We're excited to welcome you to the GR8 RESULT affiliate network.</p>

          <p style="font-size:16px;color:#cbd5e1;line-height:1.75;margin:0 0 16px;">
            Your application has been reviewed and <strong style="color:#22c55e;">approved</strong>. You are now an authorised affiliate and can start browsing offers, generating unique links, and earning commission today.
          </p>
          <p style="font-size:16px;color:#cbd5e1;line-height:1.75;margin:0 0 36px;">
            Head to the Xchange Marketplace — your affiliate dashboard is ready and waiting.
          </p>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:36px;">
            <a href="${APP_URL}/marketplace"
               style="display:inline-block;background:#22c55e;color:#052e16;font-size:17px;font-weight:800;padding:16px 52px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">
              Visit the Marketplace &rarr;
            </a>
          </td></tr></table>

          <!-- NEXT STEPS -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1e293b;padding-top:28px;">
            <tr><td style="padding-bottom:16px;">
              <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1.5px;">What to do next</div>
            </td></tr>
            <tr><td style="padding:6px 0;"><table cellpadding="0" cellspacing="0"><tr>
              <td style="color:#22c55e;font-size:16px;font-weight:800;padding-right:12px;vertical-align:top;">1.</td>
              <td style="color:#94a3b8;font-size:15px;line-height:1.6;">Log in to the Xchange Marketplace with your account</td>
            </tr></table></td></tr>
            <tr><td style="padding:6px 0;"><table cellpadding="0" cellspacing="0"><tr>
              <td style="color:#22c55e;font-size:16px;font-weight:800;padding-right:12px;vertical-align:top;">2.</td>
              <td style="color:#94a3b8;font-size:15px;line-height:1.6;">Browse available products and apply for the offers you want to promote</td>
            </tr></table></td></tr>
            <tr><td style="padding:6px 0;"><table cellpadding="0" cellspacing="0"><tr>
              <td style="color:#22c55e;font-size:16px;font-weight:800;padding-right:12px;vertical-align:top;">3.</td>
              <td style="color:#94a3b8;font-size:15px;line-height:1.6;">Share your unique affiliate link and start earning commission on every sale</td>
            </tr></table></td></tr>
          </table>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#060d18;padding:24px 40px;border-top:1px solid #1e293b;">
          <p style="font-size:13px;color:#475569;margin:0;line-height:1.7;">
            Questions? Simply reply to this email — we're happy to help.<br>
            <strong style="color:#22c55e;">The GR8 RESULT Team</strong>
            &nbsp;·&nbsp;
            <a href="https://www.gr8result.com.au" style="color:#3b82f6;text-decoration:none;">gr8result.com.au</a>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body></html>`,
        text: `Congratulations ${firstName}! Your affiliate application has been approved. Visit ${APP_URL}/marketplace to get started.`,
      });

      emailStatus = {
        attempted: true,
        ok: !!emailResult?.ok,
        skipped: !!emailResult?.skipped,
        error: emailResult?.ok ? null : (emailResult?.error || 'Unknown email send failure'),
      };

      if (!emailStatus.ok) {
        console.warn('Approval email not sent (non-fatal):', emailStatus.error);
      }
    }

    return res.status(200).json({ ok: true, updated: applicant, email: emailStatus });
  } catch (err) {
    console.error('API handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
