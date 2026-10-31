// Shared helpers for the Landing Pages API routes.

import { randomUUID } from 'node:crypto';

const operationalAlerts = new Map();

export function sendError(res, err) {
  const databaseError = err?.cause || err;
  const missingSchema = ['PGRST205', 'PGRST204', 'PGRST202', '42P01', '42703', '42501'].includes(databaseError?.code) && /landing_(campaigns|pages|page_versions|page_submissions|page_events|audit_log)|lp_sync_submission/i.test(databaseError?.message || '');
  if (missingSchema) {
    const key = `${databaseError.code}:${databaseError.message}`;
    let alert = operationalAlerts.get(key);
    if (!alert || Date.now() - alert.at > 600_000) {
      alert = { reference: randomUUID(), at: Date.now() };
      if (operationalAlerts.size >= 100) operationalAlerts.clear();
      operationalAlerts.set(key, alert);
      console.error('[OPERATIONAL_ALERT]', JSON.stringify({ event: 'landing_pages_not_ready', severity: 'critical', reference: alert.reference, project: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || null, databaseCode: databaseError.code, detail: databaseError.message, action: 'Block release. Verify target and recoverable backup, obtain approval for 20261014000100_landing_page_campaigns.sql, then run the Landing Pages readiness check.' }));
    }
    return res.status(503).json({ ok: false, code: 'SERVICE_UNAVAILABLE', retryable: false, reference: alert.reference, error: 'Landing Pages is temporarily unavailable. Your campaigns have not been changed. Please try again later.' });
  }
  const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error('[landing-pages]', err?.message || err, err?.cause || '');
  const body = { ok: false, error: status >= 500 ? "We couldn't load your campaigns right now. Please try again." : err.message };
  if (status >= 500) body.retryable = true;
  if (err?.currentRevision != null) body.currentRevision = err.currentRevision;
  return res.status(status).json(body);
}

export function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export function publicBaseUrl(req) {
  const configured = process.env.LANDING_PAGES_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_PUBLIC_URL || '';
  if (/^https?:\/\//.test(configured)) return configured.replace(/\/+$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0] || (req.socket?.encrypted ? 'https' : 'http');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0];
  return `${proto}://${host}`;
}

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '';
}
