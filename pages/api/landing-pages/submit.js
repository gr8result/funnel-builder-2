// POST /api/landing-pages/submit — public enquiry endpoint for published landing pages.
//
// 1. Rate-limit, honeypot and signed-token checks.  2. Find the published page; its workspace is the tenant (never
// trusted from the browser).  3. Validate against the *published* form.  4. Record the submission durably (idempotent
// on the browser's key).  5. Copy it into Leads/CRM atomically.  6. Notify.  The visitor is told "received" as soon as
// step 4 succeeds; if step 5 fails the submission stays queued for retry and is never lost.

import { checkRateLimit } from '../../../lib/rateLimit';
import { sendEmail } from '../../../lib/sendEmail';
import { getPublishedById, recordSubmission, recordEvent, syncSubmission, audit } from '../../../lib/landing-pages/repository';
import { validateSubmission, verifyFormToken, isHoneypotTripped, cleanAttribution, hashIp, contactName } from '../../../lib/landing-pages/submission';
import { clientIp } from '../../../lib/landing-pages/http';

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }
  const ip = clientIp(req);
  if (!checkRateLimit(`lp-submit:${ip}`, 8, 60_000).ok) return res.status(429).json({ ok: false, error: 'Too many enquiries from this connection. Please wait a minute and try again.' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const pageId = String(body.pageId || '');
  if (!/^[0-9a-f-]{36}$/i.test(pageId)) return res.status(400).json({ ok: false, error: 'Invalid form' });

  // Bots that fill the hidden field get a normal-looking success and nothing is stored.
  if (isHoneypotTripped(body)) return res.status(200).json({ ok: true });

  let published;
  try { published = await getPublishedById(pageId); } catch (e) { console.error('[landing-pages/submit] lookup', e.message); return res.status(503).json({ ok: false, error: 'We could not send your enquiry just now. Please try again.' }); }
  if (!published) return res.status(404).json({ ok: false, error: 'This page is no longer accepting enquiries.' });

  const token = verifyFormToken(body.token, pageId);
  if (!token.ok) {
    if (token.reason === 'too-fast') return res.status(200).json({ ok: true });
    return res.status(400).json({ ok: false, error: 'This form has expired. Please refresh the page and try again.' });
  }

  const v = validateSubmission(published.document.form, body);
  if (!v.ok) return res.status(422).json({ ok: false, error: 'Please check the highlighted fields.', errors: v.errors });

  const { page, campaign, version } = published;
  let recorded;
  try {
    recorded = await recordSubmission({
      workspace_id: page.workspace_id, campaign_id: campaign.id, page_id: page.id, page_version_id: version.id,
      idempotency_key: v.idempotencyKey, name: contactName(v.values) || null, email: v.values.email.toLowerCase(), phone: v.values.phone || null,
      fields: v.values, consent: v.consent, consent_text: v.consent ? published.document.form.consent?.text || null : null,
      attribution: cleanAttribution(body.attribution), ip_hash: hashIp(ip), user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
    });
  } catch (e) {
    console.error('[landing-pages/submit] record', e.message);
    return res.status(503).json({ ok: false, error: 'We could not send your enquiry just now. Please try again.' });
  }

  if (recorded.duplicate) return res.status(200).json({ ok: true, duplicate: true });

  const sync = await syncSubmission(recorded.submission.id);
  if (!sync.ok) {
    console.error('[landing-pages/submit] CRM sync failed; queued for retry', recorded.submission.id, sync.error);
    await audit(page.workspace_id, 'submission', recorded.submission.id, 'crm_sync_failed', { error: sync.error });
  }
  try { await recordEvent({ page, type: 'submit', visitorHash: hashIp(ip), attribution: cleanAttribution(body.attribution) }); } catch { /* stats only */ }

  const notifyTo = published.document.brand?.email;
  if (notifyTo) {
    const rows = Object.entries(v.values).map(([k, val]) => `<tr><td style="padding:4px 12px 4px 0;color:#555">${esc(k.replace(/_/g, ' '))}</td><td style="padding:4px 0">${esc(val)}</td></tr>`).join('');
    sendEmail({
      to: notifyTo,
      subject: `New enquiry — ${campaign.name}`,
      html: `<div style="font-family:system-ui,sans-serif"><h2 style="margin:0 0 8px">New landing page enquiry</h2><p>Campaign: <strong>${esc(campaign.name)}</strong></p><table>${rows}</table><p style="color:#555">${sync.ok ? 'Added to Leads and CRM.' : 'Recorded; CRM update is queued and will retry automatically.'}</p></div>`,
    }).catch((e) => console.warn('[landing-pages/submit] notify failed', e?.message));
  }

  return res.status(200).json({ ok: true });
}
