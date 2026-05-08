// /pages/modules/social_media/setup.js
// User-facing account connection page.
// Users simply click "Connect" per platform — they never enter app credentials.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../utils/supabase-client';

const PLATFORMS = {
  meta: {
    label: 'Facebook & Instagram',
    icon: '📘',
    description: 'Connect your Facebook Pages and linked Instagram Business account so this app can publish your scheduled content.',
    note: 'You will be asked to choose which Facebook Pages and Instagram accounts to connect for posting from this app.',
  },
  tiktok: {
    label: 'TikTok',
    icon: '🎵',
    description: 'Connect your TikTok Business or Creator account so this app can publish TikTok posts for you.',
    note: 'Requires a TikTok Business or Creator account. TikTok also requires the developer app to be approved before real users can connect. Until that review is complete, TikTok may reject sign-in for non-test accounts.',
  },
  linkedin: {
    label: 'LinkedIn',
    icon: '💼',
    description: 'Connect your LinkedIn profile or Company Page so this app can publish posts for you.',
    note: 'Personal profile posting is wired in this build. Company Page publishing still needs its own page-selection flow.',
  },
  pinterest: {
    label: 'Pinterest',
    icon: '📌',
    description: 'Connect your Pinterest business account so this app can publish pins for you.',
    note: 'Pinterest controls its own consent-screen wording. In this build, Gr8 Result only requests the access needed to identify the account, choose a board, and publish pins from this app.',
    safetyNote: 'We cannot actually access your account to browse through it or make manual changes outside the actions you approve through this app.',
  },
  youtube: {
    label: 'YouTube',
    icon: '▶️',
    description: 'Connect your YouTube channel so this app can upload videos for you when YouTube publishing is enabled.',
    note: 'OAuth connection is wired, but YouTube publishing is not yet implemented in the posting queue.',
  },
};

function getFriendlyPlatformName(platform) {
  return PLATFORMS[platform]?.label || 'This platform';
}

function sanitizeConnectionMessage(platform, message, fallback = 'Connection failed. Please try again.') {
  const raw = String(message || '').trim();
  const lower = raw.toLowerCase();

  if (!raw) return fallback;
  if (lower.includes('please sign in first')) return 'Please sign in and try again.';
  if (lower.includes('oauth state expired') || lower.includes('expired or invalid')) return 'This connection attempt expired. Please try again.';
  if (
    lower.includes('app id not configured') ||
    lower.includes('app secret not configured') ||
    lower.includes('client id not configured') ||
    lower.includes('client secret not configured') ||
    lower.includes('configuration id not configured') ||
    lower.includes('credentials not configured')
  ) {
    return `${getFriendlyPlatformName(platform)} connection is temporarily unavailable right now. Please try again later.`;
  }

  return raw;
}

async function getToken(retries = 0) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    if (token) return token;
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  return '';
}

function getAccountsForPlatform(platformKey, connected) {
  if (platformKey === 'meta') {
    return [
      ...(connected.facebook || []),
      ...(connected.instagram || []),
    ];
  }

  return connected[platformKey] || [];
}

function getGroupedConnectedCount(connected) {
  return Object.keys(PLATFORMS).filter((platformKey) => getAccountsForPlatform(platformKey, connected).length > 0).length;
}

function getAccountDisplayName(platformKey, account) {
  if (platformKey !== 'meta') {
    return account.account_name || account.account_id;
  }

  const prefix = account.platform === 'instagram' ? 'Instagram' : 'Facebook';
  return `${prefix}: ${account.account_name || account.account_id}`;
}

export default function SetupPage() {
  const router = useRouter();
  const [connected, setConnected] = useState({});
  const [busyPlatform, setBusyPlatform] = useState('');
  const [notice, setNotice] = useState({});
  const [loading, setLoading] = useState(true);
  const [globalNotice, setGlobalNotice] = useState(null); // { type: 'success'|'error', message }

  useEffect(() => {
    loadConnections();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        loadConnections();
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleOAuthMessage(event) {
      if (event.origin !== window.location.origin) return;
      const payload = event.data || {};
      if (payload.type !== 'social-oauth-complete') return;

      const isSuccess = payload.status === 'ok' || payload.status === 'success';
      setBusyPlatform('');
      setGlobalNotice({
        type: isSuccess ? 'success' : 'error',
        message: sanitizeConnectionMessage(
          payload.platform || '',
          payload.message,
          isSuccess ? 'Account connected successfully!' : 'Connection failed. Please try again.'
        ),
      });
      loadConnections();
    }

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  // Show success/error from OAuth callback redirect
  useEffect(() => {
    if (!router.isReady) return;
    const params = new URLSearchParams(window.location.search);
    const connect = router.query.connect || params.get('connect');
    const message = router.query.message || params.get('message');
    const platform = router.query.platform || params.get('platform') || '';
    if (connect === 'success' || connect === 'ok') {
      setGlobalNotice({ type: 'success', message: 'Account connected successfully!' });
      loadConnections();
      router.replace('/modules/social_media/setup', undefined, { shallow: true });
    } else if (connect === 'error') {
      setGlobalNotice({ type: 'error', message: sanitizeConnectionMessage(platform, message, 'Connection failed. Please try again.') });
    }
  }, [router.isReady, router.query.connect]);

  async function loadConnections() {
    setLoading(true);
    try {
      const token = await getToken(4);
      if (!token) {
        setGlobalNotice((current) => current || { type: 'error', message: 'Your session is not ready yet. Refresh once if connections do not appear.' });
        return;
      }
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
    } catch (e) {
      console.error(e);
      setGlobalNotice({ type: 'error', message: 'Could not load connected accounts.' });
    }
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
        body: JSON.stringify({ redirectPath: `/modules/social_media/connect-complete?platform=${encodeURIComponent(platform)}` }),
      });
      const data = await res.json();
      if (!res.ok || !data.authUrl) throw new Error(sanitizeConnectionMessage(platform, data.error, `Could not start ${platform} login`));

      const authUrl = data.authUrl;

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
      setNotice(n => ({ ...n, [platform]: sanitizeConnectionMessage(platform, err.message) }));
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

  const connectedCount = getGroupedConnectedCount(connected);

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
              <div style={S.bannerSub}>Connect your social accounts so this app can publish on your behalf</div>
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
              to approve the page or account you want to connect — then you're done. It only takes a minute.
            </div>
            <div style={S.introCallout}>
              Platform note: if a connection is temporarily unavailable, we'll show a plain-language message here. Users never need to manage platform App IDs or developer credentials.
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
            const accounts = getAccountsForPlatform(key, connected);
            const isConnected = accounts.length > 0;
            const isBusy = busyPlatform === key;
            const err = notice[key];
            const isUnsupported = !!meta.unsupported;

            return (
              <div key={key} style={{ ...S.card, borderLeft: `5px solid ${isConnected ? '#10B981' : 'rgba(255,255,255,0.08)'}` }}>
                <div style={S.cardMain}>
                  <div style={S.platformIcon}>{meta.icon}</div>
                  <div style={S.cardContent}>
                    <div style={S.platformName}>{meta.label}</div>
                    <div style={S.platformDesc}>{meta.description}</div>
                    {meta.note && <div style={S.platformNote}>ℹ️ {meta.note}</div>}
                    {meta.safetyNote && <div style={S.platformSafetyNote}>⚠️ {meta.safetyNote}</div>}

                    {/* Connected accounts list */}
                    {accounts.length > 0 && (
                      <div style={S.accountList}>
                        {accounts.map(acc => (
                          <div key={acc.id} style={S.accountRow}>
                            <span style={S.connectedDot}>●</span>
                            <span style={S.accountName}>{getAccountDisplayName(key, acc)}</span>
                            <button style={S.disconnectBtn} onClick={() => disconnectAccount(acc.platform || key, acc.account_id)}>
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
                      disabled={isBusy || isUnsupported}
                      onClick={() => connectOAuth(key)}
                    >
                      {isUnsupported ? 'Not Available Yet' : isBusy ? 'Opening…' : key === 'meta' ? 'Start Meta Setup' : isConnected ? '+ Add Another Account' : `Connect ${meta.label}`}
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
  introCallout: {
    marginTop: 14, fontSize: 15, lineHeight: 1.6, color: '#FCD34D',
    background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
    borderRadius: 10, padding: '12px 14px',
  },

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
  platformSafetyNote: {
    marginTop: 12, fontSize: 15, lineHeight: 1.6, color: '#FCD34D',
    background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
    borderRadius: 10, padding: '12px 14px',
  },

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

