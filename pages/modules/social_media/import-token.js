// /pages/modules/social_media/import-token.js
// Manual Facebook token import — bypasses OAuth while App Review is pending.

import Head from 'next/head';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../utils/supabase-client';

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
}

const S = {
  page:    { minHeight: '100vh', background: '#1f0420', fontFamily: 'system-ui,sans-serif', color: '#F3F0FF', padding: '32px 20px' },
  card:    { maxWidth: 680, margin: '0 auto', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(167,169,250,0.2)', borderRadius: 16, padding: '32px 36px' },
  title:   { fontSize: 26, fontWeight: 600, color: '#E9D5FF', marginBottom: 6, marginTop: 0 },
  sub:     { fontSize: 16, color: '#9CA3AF', marginBottom: 28, lineHeight: 1.7 },
  label:   { display: 'block', fontSize: 16, color: '#9CA3AF', marginBottom: 6, fontWeight: 600 },
  input:   { width: '100%', background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(167,169,250,0.25)', borderRadius: 8, color: '#F3F0FF', padding: '10px 14px', fontSize: 16, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 16 },
  btn:     { padding: '11px 28px', borderRadius: 9, background: 'rgba(124,58,237,0.8)', border: '1px solid rgba(167,169,250,0.4)', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer', width: '100%' },
  ok:      { padding: '12px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#6EE7B7', marginBottom: 16, fontSize: 16 },
  err:     { padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#FCA5A5', marginBottom: 16, fontSize: 16 },
  steps:   { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(253,224,71,0.2)', borderRadius: 12, padding: '18px 22px', marginBottom: 28 },
  stepTtl: { fontSize: 16, fontWeight: 600, color: '#FCD34D', marginBottom: 12, marginTop: 0 },
  ol:      { color: '#D8B4FE', fontSize: 16, lineHeight: 2.2, paddingLeft: 20, margin: 0 },
  a:       { color: '#93C5FD', textDecoration: 'underline' },
  or:      { textAlign: 'center', color: '#6B7280', fontSize: 16, margin: '20px 0', position: 'relative' },
  divider: { border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '24px 0' },
};

export default function ImportTokenPage() {
  const router = useRouter();
  const [userToken, setUserToken] = useState('');
  const [pageId,    setPageId]    = useState('');
  const [pageToken, setPageToken] = useState('');
  const [pageName,  setPageName]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);
  const [err,       setErr]       = useState('');

  async function submit(body) {
    setLoading(true); setErr(''); setResult(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/social/import-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Import failed');
      setResult(data.imported || []);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <>
      <Head><title>Import Facebook Token</title></Head>
      <div style={S.page}>
        <div style={S.card}>
          <h1 style={S.title}>Import Facebook Token Manually</h1>
          <p style={S.sub}>
            While waiting for Meta App Review, you can connect your Facebook pages manually
            using a token from the Graph API Explorer. This stores the page access tokens
            directly — no OAuth popup required.
          </p>

          {err    && <div style={S.err}>{err}</div>}
          {result && result.length > 0 && (
            <div style={S.ok}>
              ✓ Imported {result.length} account{result.length !== 1 ? 's' : ''}:{' '}
              {result.map(r => r.name).join(', ')}
              <div style={{ marginTop: 10 }}>
                <button style={{ ...S.btn, background: 'rgba(16,185,129,0.4)', width: 'auto', padding: '8px 18px', fontSize: 16 }}
                  onClick={() => router.push('/modules/social_media/setup')}>
                  Go to Setup →
                </button>
              </div>
            </div>
          )}

          {/* Method A — User token (auto-finds all pages) */}
          <div style={S.steps}>
            <p style={S.stepTtl}>Step 1 — Get your User Access Token</p>
            <ol style={S.ol}>
              <li>Open <a style={S.a} href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">Graph API Explorer</a></li>
              <li>Top right: select your app (<strong>Gr8 Results Bot App</strong>)</li>
              <li>Click <strong>Generate Access Token</strong></li>
              <li>Tick <strong>only</strong> these permissions: <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>pages_manage_posts</code></li>
              <li style={{ color: '#FCA5A5', fontWeight: 600 }}>⚠️ Do NOT check <code>manage_pages</code> — it is deprecated and will break the entire request</li>
              <li>Click <strong>Generate Token</strong> → accept the dialog → copy the token</li>
            </ol>
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', fontSize: 16, color: '#FCA5A5' }}>
              If you see &quot;Invalid Scopes&quot; error in the dialog — click OK, then uncheck <code>manage_pages</code> in the permissions list and try again.
            </div>
          </div>

          <label style={S.label}>User Access Token (auto-imports all your pages)</label>
          <input
            style={S.input}
            placeholder="EAABx..."
            value={userToken}
            onChange={e => setUserToken(e.target.value)}
          />
          <button style={S.btn} disabled={loading || !userToken.trim()} onClick={() => submit({ userToken: userToken.trim() })}>
            {loading ? 'Importing…' : 'Import All My Pages'}
          </button>

          {result && result.length === 0 && (
            <div style={{ marginTop: 14, padding: '14px 16px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10, fontSize: 16, color: '#FCD34D', lineHeight: 1.8 }}>
              <strong>⚠️ 0 pages found.</strong> This means either:<br />
              • The token doesn&apos;t have <code>pages_show_list</code> permission (try getting a new token — see Step 1 above)<br />
              • Your Facebook account has no Pages it administers<br />
              • <strong>Try Method B below</strong>: in Graph API Explorer, set the request to <code>GET /me/accounts</code>, run it, then copy each page&apos;s <code>access_token</code> and <code>id</code> and paste them in the &quot;Import a single page directly&quot; form below.
            </div>
          )}

          <hr style={S.divider} />
          <div style={S.or}>— or import a single page directly —</div>

          <label style={S.label}>Page ID</label>
          <input style={S.input} placeholder="123456789" value={pageId} onChange={e => setPageId(e.target.value)} />

          <label style={S.label}>Page Name (optional)</label>
          <input style={S.input} placeholder="My Business Page" value={pageName} onChange={e => setPageName(e.target.value)} />

          <label style={S.label}>Page Access Token</label>
          <input style={S.input} placeholder="EAABx..." value={pageToken} onChange={e => setPageToken(e.target.value)} />

          <button style={{ ...S.btn, background: 'rgba(59,130,246,0.6)' }}
            disabled={loading || !pageId.trim() || !pageToken.trim()}
            onClick={() => submit({ pageId: pageId.trim(), pageToken: pageToken.trim(), pageName: pageName.trim() })}>
            {loading ? 'Importing…' : 'Import This Page'}
          </button>

          <hr style={S.divider} />
          <button style={{ ...S.btn, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#9CA3AF', fontSize: 16 }}
            onClick={() => router.back()}>
            ← Back
          </button>
        </div>
      </div>
    </>
  );
}
