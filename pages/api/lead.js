// /pages/api/leads.js
import { createClient } from '@supabase/supabase-js';

let supabase = null;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
if (url && key) supabase = createClient(url, key);

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const { email, slug, page_id } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(200).json({ ok: true, warning: 'missing-email' });
    }

    // Respond first so the browser never sees a 500.
    res.status(200).json({ ok: true });

    if (!supabase) { console.warn('Supabase not initialised'); return; }

    // Best-effort enrich
    let pageId = page_id || null, funnel_id = null, user_id = null;
    try {
      if (page_id) {
        const { data: p } = await supabase.from('pages')
          .select('id,funnel_id,user_id').eq('id', page_id).maybeSingle();
        if (p) { pageId = p.id; funnel_id = p.funnel_id || null; user_id = p.user_id || null; }
      } else if (slug) {
        const { data: p } = await supabase.from('pages')
          .select('id,funnel_id,user_id').eq('slug', slug).maybeSingle();
        if (p) { pageId = p.id; funnel_id = p.funnel_id || null; user_id = p.user_id || null; }
      }
    } catch (e) { console.warn('Lookup failed:', e?.message || e); }

    const { error } = await supabase.from('leads').insert({ email, funnel_id, page_id: pageId, user_id });
    if (error) console.warn('Lead insert failed:', error.message || error);
  } catch (e) {
    try { if (!res.headersSent) res.status(200).json({ ok: true, warning: 'api-exception' }); } catch {}
    console.error('API /leads fatal:', e?.message || e);
  }
}
