import { useEffect } from 'react';
import { useRouter } from 'next/router';

const PLATFORM_LABELS = {
  meta: 'Facebook & Instagram',
  pinterest: 'Pinterest',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
};

function getFriendlyPlatformName(platform) {
  return PLATFORM_LABELS[String(platform || '').toLowerCase()] || 'Social account';
}

function sanitizeConnectionMessage(platform, message, fallback) {
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

export default function ConnectCompletePage() {
  const router = useRouter();
  const platform = String(router.query.platform || '');
  const connect = String(router.query.connect || '');
  const rawMessage = String(router.query.message || '');
  const isSuccess = connect === 'ok' || connect === 'success';
  const title = isSuccess ? `${getFriendlyPlatformName(platform)} connected` : `${getFriendlyPlatformName(platform)} not connected`;
  const message = sanitizeConnectionMessage(
    platform,
    rawMessage,
    isSuccess ? 'Account connected successfully!' : 'Connection failed. Please try again.'
  );

  useEffect(() => {
    if (!router.isReady || !window.opener) return;
    window.opener.postMessage({
      type: 'social-oauth-complete',
      platform,
      status: connect,
      message,
    }, window.location.origin);
  }, [router.isReady, platform, connect, message]);

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.icon}>{isSuccess ? '✅' : '⚠️'}</div>
        <h1 style={S.title}>{title}</h1>
        <p style={S.message}>{message}</p>
        <div style={isSuccess ? S.successNote : S.warningNote}>
          {isSuccess
            ? 'You may now close this page and continue in the main window.'
            : 'You may close this page and continue in the main window after reviewing the message above.'}
        </div>
        <div style={S.actions}>
          <button onClick={() => window.close()} style={S.primaryBtn}>Close This Page</button>
          <button onClick={() => { window.location.href = '/modules/social_media/setup'; }} style={S.secondaryBtn}>Open Settings Page</button>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: 'radial-gradient(circle at top, rgba(37,99,235,0.18), rgba(2,6,23,0.98) 55%)',
    color: '#fff',
    fontFamily: 'Segoe UI, Arial, sans-serif',
  },
  card: {
    width: 'min(560px, 100%)',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: '28px 28px 24px',
    boxShadow: '0 25px 80px rgba(0,0,0,0.4)',
  },
  icon: { fontSize: 42, marginBottom: 12 },
  title: { margin: 0, fontSize: 32, lineHeight: 1.1 },
  message: { margin: '14px 0 0', fontSize: 17, lineHeight: 1.6, color: 'rgba(255,255,255,0.78)' },
  successNote: {
    marginTop: 18, fontSize: 15, lineHeight: 1.6, color: '#86efac',
    background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.24)',
    borderRadius: 10, padding: '12px 14px',
  },
  warningNote: {
    marginTop: 18, fontSize: 15, lineHeight: 1.6, color: '#FCD34D',
    background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
    borderRadius: 10, padding: '12px 14px',
  },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 },
  primaryBtn: {
    padding: '13px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(90deg,#059669,#10B981)', color: '#fff', fontWeight: 700, fontSize: 15,
  },
  secondaryBtn: {
    padding: '13px 18px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.28)', cursor: 'pointer',
    background: 'rgba(15,23,42,0.9)', color: '#e5e7eb', fontWeight: 600, fontSize: 15,
  },
};