// pages/api/submit.js
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: { bodyParser: true }, // handles x-www-form-urlencoded + JSON
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // Accept both urlencoded and JSON; normalize to a plain object
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const slug = (body.slug || '').toString().trim();

    if (!slug) {
      return res.status(400).send('Missing slug');
    }

    // Some optional conveniences
    const page_id   = body.page_id ?? null;
    const funnel_id = body.funnel_id ?? null;

    // Remove our reserved keys from the saved payload
    const reserved = new Set(['slug', 'page_id', 'funnel_id', 'redirect']);
    const data = {};
    for (const [k, v] of Object.entries(body)) {
      if (!reserved.has(k)) data[k] = v;
    }

    // Basic capture of visitor info (best-effort)
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const ua = req.headers['user-agent'] || '';

    // Insert (RLS ensures only published slugs can be written)
    const { error } = await supabase.from('submissions').insert([{
      slug, page_id, funnel_id, data, ip, ua
    }]);

    if (error) {
      console.error('Insert failed:', error.message);
      return res.status(400).send('Submission failed');
    }

    // Optional thank-you redirect
    const redirect = (body.redirect || '').toString();
    if (redirect && /^https?:\/\//i.test(redirect) || redirect.startsWith('/')) {
      return res.redirect(302, redirect);
    }

    // Default plain response
    res.status(200).send('OK');
  } catch (e) {
    console.error('Submit error:', e);
    res.status(400).send('Bad Request');
  }
}
