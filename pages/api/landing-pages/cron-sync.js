// GET/POST /api/landing-pages/cron-sync — retries enquiries whose CRM copy failed. Protected by CRON_SECRET
// (Authorization: Bearer <secret>, as Vercel Cron sends it).

import { retryPendingSubmissions } from '../../../lib/landing-pages/repository';
import { timingSafeEqual } from 'node:crypto';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const secret = process.env.CRON_SECRET || '';
  const auth = Buffer.from(String(req.headers.authorization || ''));
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || auth.length !== expected.length || !timingSafeEqual(auth, expected)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    const results = await retryPendingSubmissions({ limit: 50 });
    return res.status(200).json({ ok: true, attempted: results.length, synced: results.filter((r) => r.ok).length });
  } catch (e) {
    console.error('[landing-pages/cron-sync]', e.message);
    return res.status(500).json({ ok: false, error: 'Retry failed' });
  }
}
