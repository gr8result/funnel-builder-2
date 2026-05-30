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
  if (
    lower.includes('missing publish permission') ||
    lower.includes('missing posting permission') ||
    lower.includes('approve posting access') ||
    lower.includes('did not grant posting access') ||
    lower.includes('video publishing') ||
    lower.includes('video.upload')
  ) {
    return 'Reconnect TikTok and approve video publishing access so direct posting is authorized.';
  }

  return raw;
}

export default function ConnectCompletePage() {
  const router = useRouter();
  const platform = String(router.query.platform || '');
  const connect = String(router.query.connect || '');
  const rawMessage = String(router.query.message || '');
  const returnPath = '/modules/social_media/setup';
  const isSuccess = connect === 'ok' || connect === 'success';
  const title = isSuccess ? `${getFriendlyPlatformName(platform)} connected` : `${getFriendlyPlatformName(platform)} not connected`;
  const message = sanitizeConnectionMessage(
    platform,
    rawMessage,
    isSuccess ? 'Account connected successfully!' : 'Connection failed. Please try again.'
  );

  useEffect(() => {
    if (!router.isReady) return;

    let messageDelivered = false;
    if (window.opener) {
      try {
        window.opener.postMessage({
          type: 'social-oauth-complete',
          platform,
          status: connect,
          message,
        }, window.location.origin);
        messageDelivered = true;
      } catch {
        // COOP blocked postMessage — fall through to redirect
      }
    }

    // If opener is missing or postMessage was blocked, redirect after a short delay
    if (!messageDelivered) {
      const timer = window.setTimeout(() => {
        window.location.replace(returnPath);
      }, isSuccess ? 1200 : 2200);
      return () => window.clearTimeout(timer);
    }
  }, [router.isReady, platform, connect, message, isSuccess, returnPath]);

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.icon}>{isSuccess ? '✅' : '⚠️'}</div>
        <h1 style={S.title}>{title}</h1>
        <p style={S.message}>{message}</p>
        <div style={isSuccess ? S.successNote : S.warningNote}>
          {isSuccess
            ? (window.opener ? 'You may now close this page and continue in the main window.' : 'Returning you to Social Setup now.')
            : (window.opener ? 'You may close this page and continue in the main window after reviewing the message above.' : 'Returning you to Social Setup so you can try again.')}
        </div>
        <div style={S.actions}>
          <button onClick={() => {
            if (window.opener) {
              window.close();
              return;
            }
            window.location.href = returnPath;
          }} style={S.primaryBtn}>{window.opener ? 'Close This Page' : 'Return To Social Setup'}</button>
          <button onClick={() => { window.location.href = returnPath; }} style={S.secondaryBtn}>Open Settings Page</button>
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
    marginTop: 18, fontSize: 16, lineHeight: 1.6, color: '#86efac',
    background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.24)',
    borderRadius: 10, padding: '12px 14px',
  },
  warningNote: {
    marginTop: 18, fontSize: 16, lineHeight: 1.6, color: '#FCD34D',
    background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
    borderRadius: 10, padding: '12px 14px',
  },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 },
  primaryBtn: {
    padding: '13px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(90deg,#059669,#10B981)', color: '#fff', fontWeight: 600, fontSize: 16,
  },
  secondaryBtn: {
    padding: '13px 18px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.28)', cursor: 'pointer',
    background: 'rgba(15,23,42,0.9)', color: '#e5e7eb', fontWeight: 600, fontSize: 16,
  },
};
