// POST /api/landing-pages/track { pageId, attribution } — records one visit to a published landing page.

import crypto from 'node:crypto';
import { checkRateLimit } from '../../../lib/rateLimit';
import { getPublishedById, recordEvent } from '../../../lib/landing-pages/repository';
import { cleanAttribution } from '../../../lib/landing-pages/submission';
import { clientIp } from '../../../lib/landing-pages/http';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const ip = clientIp(req);
  if (!checkRateLimit(`lp-track:${ip}`, 30, 60_000).ok) return res.status(204).end();
  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const pageId = String(body.pageId || '');
  if (!/^[0-9a-f-]{36}$/i.test(pageId)) return res.status(204).end();
  if (/bot|crawl|spider|preview|facebookexternalhit/i.test(String(req.headers['user-agent'] || ''))) return res.status(204).end();
  try {
    const published = await getPublishedById(pageId);
    if (published) {
      const visitorHash = crypto.createHash('sha256').update(`${ip}|${req.headers['user-agent'] || ''}|${new Date().toISOString().slice(0, 10)}`).digest('hex').slice(0, 32);
      await recordEvent({ page: published.page, type: 'visit', visitorHash, attribution: cleanAttribution(body.attribution) });
    }
  } catch (e) {
    console.warn('[landing-pages/track]', e.message);
  }
  return res.status(204).end();
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
