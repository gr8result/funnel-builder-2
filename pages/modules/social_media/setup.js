// /pages/modules/social_media/setup.js
// User-facing account connection page.
// Users simply click "Connect" per platform — they never enter app credentials.
// App credentials (App ID / Secret) are configured once by the platform admin at /admin/social-developer-config

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../utils/supabase-client';

const PLATFORMS = {
  meta: {
    label: 'Facebook & Instagram',
    icon: '📘',
    description: 'Connect your Facebook Pages and linked Instagram Business account to post and schedule content.',
    note: 'You will be asked to select which Facebook Pages and Instagram accounts to grant access to.',
  },
  tiktok: {
    label: 'TikTok',
    icon: '🎵',
    description: 'Connect your TikTok Business or Creator account to publish videos and posts.',
    note: 'Requires a TikTok Business or Creator account.',
  },
  linkedin: {
    label: 'LinkedIn',
    icon: '💼',
    description: 'Connect your LinkedIn profile or Company Page to share posts and articles.',
    note: 'You can connect a personal profile or a Company Page you manage.',
  },
  x: {
    label: 'X (Twitter)',
    icon: '𝕏',
    description: 'Connect your X account to post tweets and threads.',
    note: null,
  },
  youtube: {
    label: 'YouTube',
    icon: '▶️',
    description: 'Connect your YouTube channel to upload videos and manage content.',
    note: 'Requires a Google account with a YouTube channel.',
  },
};

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

export default function SetupPage() {
  const router = useRouter();
  const [connected, setConnected] = useState({});
  const [busyPlatform, setBusyPlatform] = useState('');
  const [notice, setNotice] = useState({});
  const [loading, setLoading] = useState(true);
  const [globalNotice, setGlobalNotice] = useState(null); // { type: 'success'|'error', message }

  useEffect(() => { loadConnections(); }, []);

  // Show success/error from OAuth callback redirect
  useEffect(() => {
    if (!router.isReady) return;
    const { connect, message } = router.query;
    if (connect === 'success') {
      setGlobalNotice({ type: 'success', message: 'Account connected successfully!' });
      router.replace('/modules/social_media/setup', undefined, { shallow: true });
    } else if (connect === 'error') {
      setGlobalNotice({ type: 'error', message: message || 'Connection failed.' });
      router.replace('/modules/social_media/setup', undefined, { shallow: true });
    }
  }, [router.isReady, router.query.connect]);

  async function loadConnections() {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch('/api/social/connections', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.ok) {
        const byPlatform = {};
        for (const acc of (json.connections || [])) {
          const p = acc.platform?.toLowerCase();
          if (!byPlatform[p]) byPlatform[p] = [];
          byPlatform[p].push(acc);
        }
        setConnected(byPlatform);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function connectOAuth(platform) {
    setBusyPlatform(platform);
    setNotice(n => ({ ...n, [platform]: '' }));
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in first.');
      const res = await fetch(`/api/social/oauth/${platform}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ redirectPath: '/modules/social_media/setup' }),
      });
      const data = await res.json();
      if (!res.ok || !data.authUrl) throw new Error(data.error || `Could not start ${platform} login`);

      let authUrl = data.authUrl;
      if (platform === 'meta') {
        try {
          const u = new URL(authUrl);
          // Only use approved scopes — pages_messaging requires Meta App Review
          const approvedScope = [
            'pages_show_list',
            'pages_read_engagement',
            'pages_manage_posts',
          ].join(',');
          u.searchParams.set('response_type', 'code');
          u.searchParams.delete('display');
          u.searchParams.set('scope', approvedScope);
          authUrl = u.toString();
        } catch (e) {
          console.warn('Meta OAuth URL normalization skipped:', e?.message || e);
        }
      }

      const popup = window.open(authUrl, 'oauth-popup', 'width=640,height=720,top=80,left=200,resizable=yes,scrollbars=yes');
      if (!popup) { window.location.href = authUrl; return; }

      const timer = setInterval(async () => {
        if (popup.closed) {
          clearInterval(timer);
          setBusyPlatform('');
          await loadConnections();
        }
      }, 800);
    } catch (err) {
      setNotice(n => ({ ...n, [platform]: err.message }));
      setBusyPlatform('');
    }
  }

  async function disconnectAccount(platform, accountId) {
    const token = await getToken();
    await fetch(`/api/social/connections?platform=${encodeURIComponent(platform)}&account_id=${encodeURIComponent(accountId)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    await loadConnections();
  }

  const connectedCount = Object.values(connected).filter(a => a?.length > 0).length;

  return (
    <div style={S.page}>
      <div style={S.shell}>

        {/* ── GLOBAL NOTICE (OAuth callback result) ── */}
        {globalNotice && (
          <div style={{
            padding: '14px 20px', borderRadius: 10, marginBottom: 20, fontSize: 15, fontWeight: 500,
            background: globalNotice.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${globalNotice.type === 'success' ? '#10B981' : '#ef4444'}`,
            color: globalNotice.type === 'success' ? '#10B981' : '#f87171',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>{globalNotice.message}</span>
            <button onClick={() => setGlobalNotice(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
          </div>
        )}

        {/* ── BANNER ── */}
        <div style={S.banner}>
          <div style={S.bannerLeft}>
            <div style={S.bannerIcon}>⚙️</div>
            <div>
              <div style={S.bannerTitle}>Social Media Settings</div>
              <div style={S.bannerSub}>Connect your social accounts and configure platform credentials</div>
            </div>
          </div>
          <button style={S.bannerBtn} onClick={() => { window.location.href = '/modules/social_media/dashboard'; }}>
            ← Back
          </button>
        </div>

        {/* INTRO */}
        <div style={S.intro}>
          <div style={S.introIcon}>🔌</div>
          <div style={{ flex: 1 }}>
            <div style={S.introTitle}>Connect Your Social Accounts</div>
            <div style={S.introText}>
              Click <strong>Connect</strong> on any platform below. You'll be taken to that platform's login page
              to approve access — then you're done. It only takes a minute.
            </div>
          </div>
          {connectedCount > 0 && (
            <button style={S.doneBtn} onClick={() => { window.location.href = '/modules/social_media/dashboard'; }}>
              Continue to Dashboard →
            </button>
          )}
        </div>

        {/* PLATFORM CARDS */}
        <div style={S.cardList}>
          {Object.entries(PLATFORMS).map(([key, meta]) => {
            const accounts = connected[key] || [];
            const isConnected = accounts.length > 0;
            const isBusy = busyPlatform === key;
            const err = notice[key];

            return (
              <div key={key} style={{ ...S.card, borderLeft: `5px solid ${isConnected ? '#10B981' : 'rgba(255,255,255,0.08)'}` }}>
                <div style={S.cardMain}>
                  <div style={S.platformIcon}>{meta.icon}</div>
                  <div style={S.cardContent}>
                    <div style={S.platformName}>{meta.label}</div>
                    <div style={S.platformDesc}>{meta.description}</div>
                    {meta.note && <div style={S.platformNote}>ℹ️ {meta.note}</div>}

                    {/* Connected accounts list */}
                    {accounts.length > 0 && (
                      <div style={S.accountList}>
                        {accounts.map(acc => (
                          <div key={acc.id} style={S.accountRow}>
                            <span style={S.connectedDot}>●</span>
                            <span style={S.accountName}>{acc.account_name || acc.account_id}</span>
                            <button style={S.disconnectBtn} onClick={() => disconnectAccount(key, acc.account_id)}>
                              Disconnect
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {err && <div style={S.errorMsg}>{err}</div>}
                  </div>

                  {/* Right side: status + button */}
                  <div style={S.cardActions}>
                    {isConnected
                      ? <div style={S.connectedBadge}>✅ Connected</div>
                      : <div style={S.notConnectedBadge}>Not connected</div>
                    }
                    <button
                      style={{ ...S.connectBtn, opacity: isBusy ? 0.6 : 1 }}
                      disabled={isBusy}
                      onClick={() => key === 'meta' ? window.location.href = '/modules/social_media/import-token' : connectOAuth(key)}
                    >
                      {isBusy ? 'Opening…' : isConnected ? '+ Add Another Account' : `Connect ${meta.label}`}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>


        {/* FOOTER */}
        {connectedCount > 0 && (
          <div style={S.footer}>
            <div style={S.footerText}>
              🎉 <strong>{connectedCount} platform{connectedCount > 1 ? 's' : ''}</strong> connected — you're ready to start publishing.
            </div>
            <button style={S.doneBtn} onClick={() => { window.location.href = '/modules/social_media/dashboard'; }}>
              Go to Dashboard →
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

const S = {
  page: { padding: 32, color: '#fff', minHeight: '100vh' },
  shell: { width: '100%', maxWidth: 1320, margin: '0 auto' },

  banner: {
    background: 'linear-gradient(90deg, #26be61, #26be61)',
    borderRadius: 16, padding: '22px 28px', marginBottom: 28,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
  },
  bannerLeft: { display: 'flex', alignItems: 'center', gap: 18 },
  bannerIcon: { background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 14, fontSize: 48 },
  bannerTitle: { fontSize: 48, fontWeight: 600 },
  bannerSub: { fontSize: 18, opacity: 0.85, marginTop: 6 },
  bannerBtn: { background: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.4)', color: '#fff', padding: '12px 24px', borderRadius: 10, cursor: 'pointer', fontSize: 18, fontWeight: 600 },

  intro: {
    background: '#111827', borderRadius: 16, padding: '28px 32px', marginBottom: 24,
    border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 22,
  },
  introIcon: { fontSize: 48, flexShrink: 0 },
  introTitle: { fontSize: 24, fontWeight: 700, marginBottom: 8 },
  introText: { fontSize: 18, opacity: 0.7, lineHeight: 1.7 },

  cardList: { display: 'flex', flexDirection: 'column', gap: 14 },
  card: {
    background: '#111827', borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.07)', padding: '28px 32px',
  },
  cardMain: { display: 'flex', alignItems: 'flex-start', gap: 24 },
  platformIcon: { fontSize: 44, flexShrink: 0, marginTop: 2 },
  cardContent: { flex: 1, minWidth: 0 },
  platformName: { fontSize: 22, fontWeight: 700, marginBottom: 6 },
  platformDesc: { fontSize: 17, opacity: 0.65, lineHeight: 1.65, marginBottom: 6 },
  platformNote: { fontSize: 15, opacity: 0.45, lineHeight: 1.5, marginTop: 4 },

  accountList: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  accountRow: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
    background: 'rgba(16,185,129,0.08)', borderRadius: 10,
    border: '1px solid rgba(16,185,129,0.15)',
  },
  connectedDot: { color: '#10B981', fontSize: 12 },
  accountName: { flex: 1, fontSize: 16, fontWeight: 600 },

  cardActions: { flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12, minWidth: 200 },
  connectedBadge: { fontSize: 16, fontWeight: 600, color: '#10B981' },
  notConnectedBadge: { fontSize: 16, opacity: 0.4 },
  connectBtn: {
    padding: '14px 26px', background: 'linear-gradient(90deg,#6D28D9,#9333EA)',
    border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 17,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  disconnectBtn: {
    background: 'none', border: '1px solid rgba(248,113,113,0.4)',
    color: '#f87171', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 15,
  },
  errorMsg: { marginTop: 10, color: '#f87171', fontSize: 16 },

  footer: {
    marginTop: 28, padding: '24px 32px', background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
  },
  footerText: { fontSize: 18, lineHeight: 1.5 },
  doneBtn: {
    padding: '14px 30px', background: 'linear-gradient(90deg,#059669,#10B981)',
    border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 17,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
  },
};

