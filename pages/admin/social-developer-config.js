// /pages/admin/social-developer-config.js
// One-time setup page for the platform owner.
// Enter the App ID + Secret for each social platform once — every user then
// connects their own accounts through your app via OAuth.

import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase-client';

const PLATFORMS = {
  meta: {
    label: 'Facebook & Instagram (Meta)',
    icon: '📘',
    envAppId: 'META_APP_ID',
    envSecret: 'META_APP_SECRET',
    envConfigId: 'META_CONFIG_ID',
    appIdLabel: 'App ID',
    secretLabel: 'App Secret',
    configIdLabel: 'Configuration ID',
    devUrl: 'https://developers.facebook.com/apps',
    callbackPath: '/api/social/oauth/meta/callback',
    steps: [
      'Go to developers.facebook.com → My Apps → Create a Business app.',
      'Add Facebook Login for Business to the app.',
      'Open Configurations and create a User Access Token configuration for your Pages and Instagram permissions.',
      'Copy the Configuration ID and store it here with the App ID and App Secret.',
      'In Facebook Login Settings, add the Callback URL below to Valid OAuth Redirect URIs.',
      'In App Settings → Basic, add your app domain to App Domains.',
    ],
  },
  tiktok: {
    label: 'TikTok',
    icon: '🎵',
    envAppId: 'TIKTOK_CLIENT_KEY',
    envSecret: 'TIKTOK_CLIENT_SECRET',
    appIdLabel: 'Client Key',
    secretLabel: 'Client Secret',
    devUrl: 'https://developers.tiktok.com',
    callbackPath: '/api/social/oauth/tiktok/callback',
    steps: [
      'Go to developers.tiktok.com → Manage Apps → Create an app.',
      'Under "Login Kit", add the Callback URL below.',
      'Request scopes: user.info.basic, video.publish.',
      'Submit for review (TikTok requires app review before real users can connect).',
    ],
  },
  linkedin: {
    label: 'LinkedIn',
    icon: '💼',
    envAppId: 'LINKEDIN_CLIENT_ID',
    envSecret: 'LINKEDIN_CLIENT_SECRET',
    appIdLabel: 'Client ID',
    secretLabel: 'Client Secret',
    devUrl: 'https://www.linkedin.com/developers/apps',
    callbackPath: '/api/social/oauth/linkedin/callback',
    steps: [
      'Go to linkedin.com/developers/apps → Create App.',
      'Under Auth → OAuth 2.0 → Authorized Redirect URLs, add the Callback URL below.',
      'Under Products, request "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect".',
    ],
  },
  pinterest: {
    label: 'Pinterest',
    icon: '📌',
    envAppId: 'PINTEREST_APP_ID',
    envSecret: 'PINTEREST_APP_SECRET',
    appIdLabel: 'App ID',
    secretLabel: 'App Secret',
    devUrl: 'https://developers.pinterest.com/apps/',
    callbackPath: '/api/social/oauth/pinterest/callback',
    steps: [
      'Go to developers.pinterest.com → Apps → Create app.',
      'Add the Callback URL below to your Pinterest app redirect URIs.',
      'Copy the Pinterest App ID and App Secret and store them here.',
      'Pinterest is scaffolded in this build, but the full publish flow still needs implementation.',
    ],
  },
  x: {
    label: 'X (Twitter)',
    icon: '𝕏',
    envAppId: 'X_CLIENT_ID',
    envSecret: 'X_CLIENT_SECRET',
    appIdLabel: 'Client ID',
    secretLabel: 'Client Secret',
    devUrl: 'https://developer.twitter.com/en/portal/dashboard',
    callbackPath: '/api/social/oauth/x/callback',
    steps: [
      'Go to developer.twitter.com → Projects & Apps → Create an App.',
      'Set App permissions to "Read and Write".',
      'Under "User authentication settings", enable OAuth 2.0 and add the Callback URL below.',
      'Note: X requires a paid developer account ($100/month) for posting.',
    ],
  },
  youtube: {
    label: 'YouTube (Google)',
    icon: '▶️',
    envAppId: 'GOOGLE_CLIENT_ID',
    envSecret: 'GOOGLE_CLIENT_SECRET',
    appIdLabel: 'Client ID',
    secretLabel: 'Client Secret',
    devUrl: 'https://console.cloud.google.com/apis/credentials',
    callbackPath: '/api/social/oauth/youtube/callback',
    steps: [
      'Go to Google Cloud Console → Create a project.',
      'Enable the YouTube Data API v3.',
      'Under APIs & Services → Credentials → Create OAuth 2.0 Client ID.',
      'Add the Callback URL below to "Authorised redirect URIs".',
      'Add scopes: youtube.upload, youtube.readonly.',
    ],
  },
};

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

export default function SocialDeveloperConfig() {
  const [status, setStatus] = useState({});   // { meta: { configured: true }, ... }
  const [expanded, setExpanded] = useState('meta');
  const [editingPlatform, setEditingPlatform] = useState('');
  const [form, setForm] = useState({ appId: '', appSecret: '', configId: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://yoursite.com';

  useEffect(() => { loadStatus(); }, []);
  useEffect(() => {
    setForm({ appId: '', appSecret: '', configId: '' });
    setNotice('');
    setEditingPlatform('');
  }, [expanded]);

  async function loadStatus() {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/social-credential-status', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.ok) setStatus(json.status || {});
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function saveCredentials(platform) {
    if (!form.appId.trim()) { setNotice('App ID / Client ID is required.'); return; }
    if (platform === 'meta' && !form.configId.trim()) { setNotice('Meta Configuration ID is required.'); return; }
    setSaving(true); setNotice('');
    try {
      const token = await getToken();
      const res = await fetch('/api/social/platform-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          platform,
          appId: form.appId.trim(),
          appSecret: form.appSecret.trim(),
          configId: platform === 'meta' ? form.configId.trim() : '',
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Save failed');
      setNotice('saved');
      setForm({ appId: '', appSecret: '', configId: '' });
      setEditingPlatform('');
      await loadStatus();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeCredentials(platform) {
    if (!confirm(`Remove ${PLATFORMS[platform].label} credentials?`)) return;
    const token = await getToken();
    await fetch(`/api/social/platform-settings?platform=${encodeURIComponent(platform)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    await loadStatus();
  }

  const configuredCount = Object.values(status).filter(s => s?.configured).length;

  return (
    <div style={S.page}>
      <div style={S.shell}>

        {/* BANNER */}
        <div style={S.banner}>
          <div style={S.bannerLeft}>
            <div style={S.bannerIcon}>🛠️</div>
            <div>
              <div style={S.bannerTitle}>Social Media — Developer Setup</div>
              <div style={S.bannerSub}>Configure your platform app credentials — done once for all users</div>
            </div>
          </div>
          <button style={S.bannerBtn} onClick={() => { window.location.href = '/admin/dashboard'; }}>
            ← Admin Dashboard
          </button>
        </div>

        {/* EXPLAINER */}
        <div style={S.explainer}>
          <div style={S.explainerIcon}>💡</div>
          <div>
            <div style={S.explainerTitle}>How this works</div>
            <div style={S.explainerText}>
              You create one developer app on each platform (Meta, TikTok, etc.) and enter the credentials here.
              Your users then connect <em>their own accounts</em> through your app — they only see a standard
              login and permission screen. They never need to know anything about app IDs or secrets.
              This setup is done <strong>once by you</strong> and applies to all users of the platform.
            </div>
          </div>
        </div>

        {/* STATUS ROW */}
        <div style={S.statusRow}>
          {Object.entries(PLATFORMS).map(([key, meta]) => {
            const cfg = status[key]?.configured;
            return (
              <button
                key={key}
                style={{ ...S.statusPill, borderColor: cfg ? '#10B981' : 'rgba(255,255,255,0.1)', background: cfg ? 'rgba(16,185,129,0.1)' : '#111827' }}
                onClick={() => setExpanded(key)}
              >
                <span style={{ fontSize: 22 }}>{meta.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{meta.label}</span>
                <span style={{ fontSize: 13, color: cfg ? '#10B981' : '#6B7280', fontWeight: 600 }}>
                  {loading ? '…' : cfg ? '✅ Set' : '○ Not set'}
                </span>
              </button>
            );
          })}
        </div>

        {/* PLATFORM CARDS */}
        <div style={S.cardList}>
          {Object.entries(PLATFORMS).map(([key, meta]) => {
            const isOpen = expanded === key;
            const isCfg = status[key]?.configured;
            const callbackUrl = `${siteUrl}${meta.callbackPath}`;

            return (
              <div key={key} style={{ ...S.card, borderLeft: `5px solid ${isCfg ? '#10B981' : 'rgba(255,255,255,0.08)'}` }}>

                {/* Header */}
                <div style={S.cardHeader} onClick={() => setExpanded(isOpen ? '' : key)}>
                  <div style={S.cardLeft}>
                    <span style={{ fontSize: 36 }}>{meta.icon}</span>
                    <div>
                      <div style={S.platformName}>{meta.label}</div>
                      <div style={{ fontSize: 15, opacity: 0.45, marginTop: 3 }}>
                        Env vars: <code style={S.envName}>{meta.envAppId}</code> / <code style={S.envName}>{meta.envSecret}</code>{meta.envConfigId ? <> / <code style={S.envName}>{meta.envConfigId}</code></> : null}
                      </div>
                    </div>
                  </div>
                  <div style={S.cardRight}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: isCfg ? '#10B981' : '#6B7280' }}>
                      {loading ? '…' : isCfg ? '✅ Credentials set' : '○ Not configured'}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.4 }}>{isOpen ? '▲' : '▼'}</div>
                  </div>
                </div>

                {isOpen && (
                  <div style={S.cardBody}>

                    {/* Setup steps */}
                    <div style={S.stepsSection}>
                      <div style={S.stepsTitle}>Setup Guide</div>
                      {meta.steps.map((step, i) => (
                        <div key={i} style={S.stepRow}>
                          <div style={S.stepBullet}>{i + 1}</div>
                          <div style={S.stepText}>{step}</div>
                        </div>
                      ))}
                      <a href={meta.devUrl} target="_blank" rel="noreferrer" style={S.devLink}>
                        Open {meta.label} Developer Portal →
                      </a>
                    </div>

                    {/* Callback URL */}
                    <div style={S.callbackBox}>
                      <div style={S.callbackLabel}>Your OAuth Callback URL (copy this into your developer app):</div>
                      <div style={S.callbackUrl}>{callbackUrl}</div>
                    </div>

                    {/* Credentials form or saved state */}
                    <div style={S.credSection}>
                      <div style={S.stepsTitle}>Store Credentials</div>
                      <div style={{ fontSize: 16, opacity: 0.6, marginBottom: 20, lineHeight: 1.6 }}>
                        You can set credentials as env vars (<code style={S.envName}>{meta.envAppId}</code> / <code style={S.envName}>{meta.envSecret}</code>{meta.envConfigId ? <> / <code style={S.envName}>{meta.envConfigId}</code></> : null})
                        in your <code style={S.envName}>.env.local</code> file, or save them here and they'll be encrypted and stored in the database.
                      </div>
                      {notice === 'Missing SOCIAL_TOKEN_ENCRYPTION_KEY' && (
                        <div style={S.warningMsg}>
                          Secret storage is disabled until <code style={S.envName}>SOCIAL_TOKEN_ENCRYPTION_KEY</code> is set on the server. If this site is on Vercel, add the platform credentials as project environment variables instead of saving them here.
                        </div>
                      )}

                      {isCfg && editingPlatform !== key ? (
                        <div style={S.savedRow}>
                          <div style={{ flex: 1, minWidth: 260 }}>
                            <div style={{ fontSize: 17, color: '#10B981', fontWeight: 600 }}>✓ Credentials are configured</div>
                            <div style={S.savedHelpText}>
                              If these credentials are coming from env vars, removing DB credentials will not change the status here.
                              Use Replace Credentials to save the new App ID, App Secret, and Meta Configuration ID for this account.
                            </div>
                          </div>
                          <button style={S.secondaryBtn} onClick={() => { setEditingPlatform(key); setNotice(''); }}>
                            Replace Credentials
                          </button>
                          <button style={S.removeBtn} onClick={() => removeCredentials(key)}>Remove DB credentials</button>
                        </div>
                      ) : (
                        <div style={S.credForm}>
                          <div style={S.fieldGroup}>
                            <label style={S.label}>{meta.appIdLabel} <span style={{ color: '#f87171' }}>*</span></label>
                            <input
                              style={S.input}
                              value={form.appId}
                              onChange={e => setForm(f => ({ ...f, appId: e.target.value }))}
                              placeholder={`Your ${meta.appIdLabel}`}
                            />
                          </div>
                          {key === 'meta' && (
                            <div style={S.fieldGroup}>
                              <label style={S.label}>{meta.configIdLabel} <span style={{ color: '#f87171' }}>*</span></label>
                              <input
                                style={S.input}
                                value={form.configId}
                                onChange={e => setForm(f => ({ ...f, configId: e.target.value }))}
                                placeholder="Meta Business Login Configuration ID"
                              />
                            </div>
                          )}
                          <div style={S.fieldGroup}>
                            <label style={S.label}>{meta.secretLabel} <span style={{ fontSize: 13, opacity: 0.5 }}>(saved encrypted)</span></label>
                            <input
                              style={S.input}
                              type="password"
                              value={form.appSecret}
                              onChange={e => setForm(f => ({ ...f, appSecret: e.target.value }))}
                              placeholder="••••••••••••••••"
                            />
                          </div>
                          {notice && notice !== 'saved' && <div style={S.errorMsg}>{notice}</div>}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <button
                              style={{ ...S.saveBtn, opacity: saving || !form.appId.trim() ? 0.5 : 1 }}
                              disabled={saving || !form.appId.trim()}
                              onClick={() => saveCredentials(key)}
                            >
                              {saving ? 'Saving…' : 'Save Credentials'}
                            </button>
                            {isCfg && (
                              <button style={S.secondaryBtn} onClick={() => { setEditingPlatform(''); setForm({ appId: '', appSecret: '', configId: '' }); setNotice(''); }}>
                                Cancel
                              </button>
                            )}
                            {notice === 'saved' && <span style={{ color: '#10B981', fontSize: 16 }}>✓ Saved</span>}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ENV VARS REFERENCE */}
        <div style={S.envRefCard}>
          <div style={S.stepsTitle}>📋 Full .env.local Reference</div>
          <div style={{ fontSize: 16, opacity: 0.6, marginBottom: 16, lineHeight: 1.6 }}>
            Alternatively, set these environment variables directly in your <code style={S.envName}>.env.local</code> (or your hosting provider's env settings). Env var credentials take priority over database-stored credentials.
          </div>
          <pre style={S.envBlock}>{[
            '# Meta (Facebook + Instagram)',
            'META_APP_ID=your_meta_app_id',
            'META_APP_SECRET=your_meta_app_secret',
            'META_CONFIG_ID=your_meta_business_login_config_id',
            '',
            '# TikTok',
            'TIKTOK_CLIENT_KEY=your_tiktok_client_key',
            'TIKTOK_CLIENT_SECRET=your_tiktok_client_secret',
            '',
            '# LinkedIn',
            'LINKEDIN_CLIENT_ID=your_linkedin_client_id',
            'LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret',
            '',
            '# X (Twitter)',
            'X_CLIENT_ID=your_x_client_id',
            'X_CLIENT_SECRET=your_x_client_secret',
            '',
            '# YouTube (Google)',
            'GOOGLE_CLIENT_ID=your_google_client_id',
            'GOOGLE_CLIENT_SECRET=your_google_client_secret',
          ].join('\n')}</pre>
        </div>

      </div>
    </div>
  );
}

const S = {
  page: { padding: 32, color: '#fff', minHeight: '100vh' },
  shell: { width: '100%', maxWidth: 1320, margin: '0 auto' },

  banner: {
    background: 'linear-gradient(90deg, #1E3A5F, #1d4ed8)',
    borderRadius: 16, padding: '22px 28px', marginBottom: 28,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
  },
  bannerLeft: { display: 'flex', alignItems: 'center', gap: 18 },
  bannerIcon: { background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 14, fontSize: 48 },
  bannerTitle: { fontSize: 40, fontWeight: 600 },
  bannerSub: { fontSize: 18, opacity: 0.85, marginTop: 6 },
  bannerBtn: { background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.35)', color: '#fff', padding: '12px 24px', borderRadius: 10, cursor: 'pointer', fontSize: 17, fontWeight: 600 },

  explainer: {
    background: '#111827', borderRadius: 16, padding: '24px 28px', marginBottom: 24,
    border: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 20, alignItems: 'flex-start',
  },
  explainerIcon: { fontSize: 36, flexShrink: 0 },
  explainerTitle: { fontSize: 20, fontWeight: 700, marginBottom: 8 },
  explainerText: { fontSize: 17, opacity: 0.7, lineHeight: 1.7 },

  statusRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 },
  statusPill: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px',
    border: '1px solid', borderRadius: 30, cursor: 'pointer', color: '#fff',
    background: 'none',
  },

  cardList: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    background: '#111827', borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '22px 28px', cursor: 'pointer',
  },
  cardLeft: { display: 'flex', alignItems: 'center', gap: 18 },
  cardRight: { display: 'flex', alignItems: 'center', gap: 16 },
  platformName: { fontSize: 20, fontWeight: 700 },
  envName: { fontFamily: 'monospace', fontSize: 13, background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 },
  cardBody: { padding: '0 28px 28px', borderTop: '1px solid rgba(255,255,255,0.06)' },

  stepsSection: { paddingTop: 24, marginBottom: 24 },
  stepsTitle: { fontSize: 17, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 },
  stepRow: { display: 'flex', gap: 14, marginBottom: 12, alignItems: 'flex-start' },
  stepBullet: {
    width: 28, height: 28, borderRadius: '50%', background: 'rgba(29,78,216,0.3)', color: '#93C5FD',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
  },
  stepText: { fontSize: 17, opacity: 0.75, lineHeight: 1.65 },
  devLink: { color: '#818cf8', fontSize: 17, display: 'inline-block', marginTop: 8 },

  callbackBox: {
    background: '#0F172A', borderRadius: 12, padding: '16px 20px',
    border: '1px solid rgba(99,102,241,0.25)', marginBottom: 24,
  },
  callbackLabel: { fontSize: 16, opacity: 0.6, marginBottom: 8 },
  callbackUrl: { fontFamily: 'monospace', fontSize: 14, color: '#a3e635', wordBreak: 'break-all', userSelect: 'all', lineHeight: 1.6 },

  credSection: { background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '20px 24px', border: '1px solid rgba(255,255,255,0.05)' },
  credForm: { display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' },
  fieldGroup: { flex: '1 1 240px' },
  label: { fontSize: 16, opacity: 0.7, display: 'block', marginBottom: 6 },
  input: {
    width: '100%', padding: '12px 16px', background: '#0F172A',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
    color: '#fff', fontSize: 16, boxSizing: 'border-box',
  },
  savedRow: { display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0', flexWrap: 'wrap' },
  savedHelpText: { fontSize: 14, opacity: 0.58, lineHeight: 1.55, marginTop: 6 },
  errorMsg: { width: '100%', color: '#f87171', fontSize: 16, padding: '6px 0' },
  warningMsg: {
    width: '100%',
    marginBottom: 12,
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid rgba(251,191,36,0.35)',
    background: 'rgba(251,191,36,0.08)',
    color: '#FCD34D',
    fontSize: 14,
    lineHeight: 1.5,
  },
  saveBtn: {
    padding: '12px 28px', background: '#1d4ed8', border: 'none',
    borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 17, cursor: 'pointer',
  },
  secondaryBtn: {
    background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)',
    color: '#93C5FD', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontSize: 15,
  },
  removeBtn: {
    background: 'none', border: '1px solid rgba(248,113,113,0.4)',
    color: '#f87171', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 16,
  },

  envRefCard: {
    marginTop: 28, background: '#0F172A', borderRadius: 16, padding: '28px 32px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  envBlock: {
    fontFamily: 'monospace', fontSize: 14, color: '#a3e635',
    background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '20px 24px',
    lineHeight: 1.8, overflowX: 'auto', margin: 0,
    border: '1px solid rgba(255,255,255,0.06)',
  },
};
