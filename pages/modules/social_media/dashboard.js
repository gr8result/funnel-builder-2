import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../utils/supabase-client';
import PRICING from '../../../data/pricing';

const PLATFORM_META = {
  facebook:  { color: '#1877F2', label: 'Facebook',  svg: (c) => <svg viewBox="0 0 24 24" width="22" height="22" fill={c}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
  instagram: { color: '#E1606C', label: 'Instagram', svg: (c) => <svg viewBox="0 0 24 24" width="22" height="22" fill={c}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> },
  linkedin:  { color: '#0A66C2', label: 'LinkedIn',  svg: (c) => <svg viewBox="0 0 24 24" width="22" height="22" fill={c}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
  x:         { color: '#1d9bf0', label: 'X',         svg: (c) => <svg viewBox="0 0 24 24" width="22" height="22" fill={c}><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 7.184zm-1.161 19.52h2.04L6.29 3.24H4.11z"/></svg> },
  twitter:   { color: '#1d9bf0', label: 'X',         svg: (c) => <svg viewBox="0 0 24 24" width="22" height="22" fill={c}><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 7.184zm-1.161 19.52h2.04L6.29 3.24H4.11z"/></svg> },
  tiktok:    { color: '#ff0050', label: 'TikTok',    svg: (c) => <svg viewBox="0 0 24 24" width="22" height="22" fill={c}><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg> },
  youtube:   { color: '#FF0000', label: 'YouTube',   svg: (c) => <svg viewBox="0 0 24 24" width="22" height="22" fill={c}><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg> },
  pinterest: { color: '#E60023', label: 'Pinterest', svg: (c) => <svg viewBox="0 0 24 24" width="22" height="22" fill={c}><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg> },
  meta:      { color: '#1877F2', label: 'Meta',      svg: (c) => <svg viewBox="0 0 24 24" width="22" height="22" fill={c}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
};
const DEFAULT_META = { color: '#7C3AED', label: 'Social', svg: (c) => <svg viewBox="0 0 24 24" width="22" height="22" fill={c}><circle cx="12" cy="12" r="10"/></svg> };

function platformMeta(p) {
  return PLATFORM_META[p?.toLowerCase()] || DEFAULT_META;
}

function platformIcon(p) {
  return platformMeta(p).label;
}

function fmt(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString('en-AU', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SocialDashboard() {
  const [stats, setStats] = useState({ total: 0, scheduled: 0, published: 0, failed: 0 });
  const [accounts, setAccounts] = useState([]);
  const [todayPosts, setTodayPosts] = useState([]);
  const [upcomingPosts, setUpcomingPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socialPlanTier, setSocialPlanTier] = useState(null);
  const [socialPlanLoading, setSocialPlanLoading] = useState(true);
  const [monthlyPostCount, setMonthlyPostCount] = useState(0);

  useEffect(() => {
    loadDashboard();
    loadSocialPlan();
  }, []);

  async function loadSocialPlan() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      // Load social tier from user_modules workaround
      const { data: moduleRows } = await supabase
        .from('user_modules')
        .select('module_id')
        .eq('user_id', uid);
      if (moduleRows) {
        const ids = moduleRows.map((r) => r.module_id);
        const tierRow = ids.find((id) => id.startsWith('__social_plan_tier:'));
        if (tierRow) setSocialPlanTier(tierRow.split(':')[1]);
      }

      // Count posts CREATED this calendar month from the usage log
      // This is write-only — deleting posts does NOT affect this count
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { data: usageRows } = await supabase
        .from('social_usage_log')
        .select('posts_count')
        .eq('user_id', uid)
        .gte('created_at', monthStart.toISOString());
      const totalFromLog = (usageRows || []).reduce((sum, r) => sum + (r.posts_count || 0), 0);
      // Fallback: if log table doesn't exist yet, count live posts
      if (usageRows !== null) {
        setMonthlyPostCount(totalFromLog);
      } else {
        const { count } = await supabase
          .from('social_posts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .gte('created_at', monthStart.toISOString());
        setMonthlyPostCount(count || 0);
      }
    } catch (e) {
      console.warn('Could not load social plan:', e.message);
    } finally {
      setSocialPlanLoading(false);
    }
  }

  async function loadDashboard() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
      const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);

      const [postsRes, accountsRes, todayRes, upcomingRes] = await Promise.all([
        supabase.from('social_posts').select('status').eq('user_id', uid),
        supabase.from('social_accounts').select('*').eq('user_id', uid).eq('is_active', true),
        supabase.from('social_schedule')
          .select('id, scheduled_for, status, social_posts(platform, content)')
          .eq('user_id', uid)
          .gte('scheduled_for', todayStart.toISOString())
          .lte('scheduled_for', todayEnd.toISOString())
          .order('scheduled_for', { ascending: true })
          .limit(6),
        supabase.from('social_schedule')
          .select('id, scheduled_for, status, social_posts(platform, content)')
          .eq('user_id', uid)
          .gt('scheduled_for', todayEnd.toISOString())
          .lte('scheduled_for', weekEnd.toISOString())
          .order('scheduled_for', { ascending: true })
          .limit(6),
      ]);

      const rows = postsRes.data || [];
      setStats({
        total: rows.length,
        scheduled: rows.filter(r => r.status === 'scheduled').length,
        published: rows.filter(r => r.status === 'published').length,
        failed: rows.filter(r => r.status === 'failed').length,
      });
      setAccounts(accountsRes.data || []);
      setTodayPosts(todayRes.data || []);
      setUpcomingPosts(upcomingRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const failedAccounts = accounts.filter(a => !a.is_active);

  const socialPlanInfo = socialPlanTier ? PRICING[socialPlanTier] : null;
  const socialPlanName = socialPlanInfo?.name || null;
  const socialPlanPrice = typeof socialPlanInfo?.price === 'number' ? socialPlanInfo.price : null;
  const socialPostLimit = typeof socialPlanInfo?.limits?.aiPostsPerMonth === 'number' ? socialPlanInfo.limits.aiPostsPerMonth : 0;
  const socialUsagePercent = socialPostLimit > 0 ? Math.min(100, Math.round((monthlyPostCount / socialPostLimit) * 100)) : 0;
  const socialUsageStage =
    socialUsagePercent >= 100 ? { tone: 'critical', title: 'Hard Stop (100%)', text: 'Post scheduling is blocked until you upgrade your Social Media plan.' }
    : socialUsagePercent >= 95 ? { tone: 'critical', title: 'Critical Warning (95%+)', text: 'You are close to your post limit. Upgrade now to avoid interruptions.' }
    : socialUsagePercent >= 80 ? { tone: 'warning', title: 'Usage Notice (80%+)', text: 'Post scheduling is still active, but your allowance is running low.' }
    : null;

  return (
    <div style={S.page}>
      <div style={S.shell}>

        {/* ── BANNER ── */}
        <div style={S.banner}>
          <div style={S.bannerLeft}>
            <div style={S.bannerIcon}>📣</div>
            <div>
              <div style={S.bannerTitle}>Omni-Channel Social Media Engine</div>
              <div style={S.bannerSub}>Create and Schedule Social Media Content with Automated Publishing</div>
            </div>
          </div>
          <button style={S.bannerBtn} onClick={() => { window.location.href = '/dashboard'; }}>
            Exit Module
          </button>
        </div>

        {/* ── PLAN + USAGE BANNER ── */}
        <div style={{ background: 'linear-gradient(135deg, rgba(109,40,217,0.35) 0%, rgba(20,10,50,0.98) 100%)', borderRadius: 16, padding: '24px 28px', marginBottom: 14, border: '1px solid rgba(167,139,250,0.4)', boxShadow: '0 4px 28px rgba(109,40,217,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              {socialPlanLoading ? (
                <div style={{ fontSize: 16, color: '#A78BFA' }}>Loading plan details…</div>
              ) : socialPlanName ? (
                <>
                  <div style={{ fontSize: 16, color: '#A78BFA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>📋 Current Social Media Plan</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: '#F3F0FF' }}>
                    {socialPlanName}{' '}
                    <span style={{ fontWeight: 500, color: '#C4B5FD' }}>
                      {socialPlanPrice !== null ? `— $${socialPlanPrice}/month` : '(Custom Plan)'}
                    </span>
                  </div>
                  {socialPostLimit > 0 && (
                    <div style={{ fontSize: 16, color: '#A78BFA', marginTop: 5, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span>🌐 {socialPlanInfo?.limits?.platforms} platforms</span>
                      <span>✍️ {socialPostLimit.toLocaleString()} AI posts/mo</span>
                      <span>🖼️ {socialPlanInfo?.limits?.aiImagesPerMonth} images/mo</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 16, color: '#A78BFA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>⚠️ No Social Media Plan Selected</div>
                  <div style={{ fontSize: 16, color: '#DDD6FE' }}>Choose a plan to unlock AI post generation and scheduling limits.</div>
                </>
              )}
            </div>
            <button
              onClick={() => { window.location.href = '/modules/billing/social-plans'; }}
              style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(90deg,#7C3AED,#EC4899)', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 3px 16px rgba(236,72,153,0.35)', letterSpacing: 0.3 }}
            >
              {socialPlanName ? '⬆ Upgrade Plan' : '→ Select Plan'}
            </button>
          </div>
          <div style={{ marginTop: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 16, marginBottom: 10 }}>
              <span style={{ color: '#E9D5FF', fontWeight: 600, fontSize: 16 }}>📊 Monthly Post Usage</span>
              <span style={{ fontWeight: 600, color: '#F3F0FF', fontSize: 16 }}>
                <span style={{ color: '#A78BFA' }}>{monthlyPostCount.toLocaleString()}</span>
                {' '}/ {socialPostLimit > 0 ? <span style={{ color: '#DDD6FE' }}>{socialPostLimit.toLocaleString()}</span> : <span style={{ color: '#6B7280' }}>No limit yet</span>}
              </span>
            </div>
            {/* Bar track */}
            <div style={{ position: 'relative', height: 22, borderRadius: 11, background: 'linear-gradient(90deg, rgba(15,8,40,0.9), rgba(30,15,70,0.9))', border: '1px solid rgba(167,139,250,0.35)', overflow: 'visible', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4)' }}>
              {/* Fill — cyan-to-pink gradient when healthy */}
              <div style={{ height: '100%', borderRadius: 11, width: `${socialUsagePercent}%`, background: socialUsagePercent >= 95 ? 'linear-gradient(90deg,#B91C1C,#EF4444)' : socialUsagePercent >= 80 ? 'linear-gradient(90deg,#B45309,#FBBF24)' : 'linear-gradient(90deg,#06B6D4,#8B5CF6,#EC4899)', transition: 'width 0.5s ease', boxShadow: socialUsagePercent > 2 ? '0 0 14px rgba(139,92,246,0.7)' : 'none' }} />
              {/* 80% tick */}
              <div style={{ position: 'absolute', top: -4, left: '80%', width: 2, height: 30, background: 'rgba(255,255,255,0.5)', borderRadius: 1, boxShadow: '0 0 4px rgba(255,255,255,0.3)' }} />
              {/* % label inside fill */}
              {socialUsagePercent > 8 && (
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${socialUsagePercent}%`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 9, pointerEvents: 'none' }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{socialUsagePercent}%</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#6D5FA8', marginTop: 5 }}>
              <span>0%</span><span style={{ marginLeft: '75%' }}>80%</span><span>100%</span>
            </div>
            {socialUsageStage && (
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: socialUsageStage.tone === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', border: `1px solid ${socialUsageStage.tone === 'critical' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16 }}><strong>{socialUsageStage.title}</strong> {socialUsageStage.text}</span>
                <button onClick={() => { window.location.href = '/modules/billing/social-plans'; }} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#7C3AED', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer', whiteSpace: 'nowrap' }}>Upgrade Social Plan</button>
              </div>
            )}
            {!socialPlanName && !socialPlanLoading && (
              <div style={{ marginTop: 8, fontSize: 16, opacity: 0.5 }}>Select a plan to unlock your monthly post allowance.</div>
            )}
          </div>
        </div>

        {/* ── ALERT ── */}
        {stats.failed > 0 && (
          <div style={S.alertBanner}>
            🚨 <strong>{stats.failed} post{stats.failed > 1 ? 's' : ''} failed to publish.</strong>
            <button style={S.alertLink} onClick={() => { window.location.href = '/modules/social_media'; }}>Review now →</button>
          </div>
        )}

        {/* ── STATS ── */}
        <div style={S.statsRow}>
          <StatCard icon="📝" label="Total Posts" value={stats.total} color="#7C3AED" loading={loading} />
          <StatCard icon="⏰" label="Scheduled" value={stats.scheduled} color="#2563EB" loading={loading} />
          <StatCard icon="✅" label="Published" value={stats.published} color="#059669" loading={loading} />
          <StatCard icon="🔗" label="Connected Platforms" value={accounts.length} color="#D97706" loading={loading} />
        </div>

        {/* ── SCHEDULE + ACCOUNTS ── */}
        <div style={S.twoCol}>

          {/* Today + This Week */}
          <div>
            <div style={S.card}>
              <div style={S.cardHeader}>
                <div style={S.sectionTitle}>📅 Today</div>
              </div>
              {loading ? <div style={S.muted}>Loading…</div>
                : todayPosts.length === 0
                  ? <div style={S.emptyState}>Nothing scheduled for today.</div>
                  : todayPosts.map(item => <ScheduleRow key={item.id} item={item} />)
              }
            </div>

            <div style={{ ...S.card, marginTop: 14 }}>
              <div style={S.cardHeader}>
                <div style={S.sectionTitle}>🗓 This Week</div>
              </div>
              {loading ? <div style={S.muted}>Loading…</div>
                : upcomingPosts.length === 0
                  ? <div style={S.emptyState}>Nothing lined up yet.</div>
                  : upcomingPosts.map(item => <ScheduleRow key={item.id} item={item} />)
              }
            </div>
          </div>

          {/* Connected accounts */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Connected Accounts</div>
            {loading ? (
              <div style={S.muted}>Loading…</div>
            ) : accounts.length === 0 ? (
              <div style={S.emptyState}>No accounts connected yet.</div>
            ) : (
              accounts.map(acc => (
                <div key={acc.id} style={S.accountRow}>
                  <span style={{ fontSize: 24 }}>{platformIcon(acc.platform)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.accountName}>{acc.account_name || acc.account_id}</div>
                    <div style={S.accountPlatform}>{acc.platform}</div>
                  </div>
                  <div style={{ ...S.statusPill, background: acc.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: acc.is_active ? '#6EE7B7' : '#FCA5A5' }}>
                    {acc.is_active ? '● Live' : '✕ Off'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── NAVIGATION ── */}
        <div style={S.navGrid}>
          {[
            { icon: '✍️', label: 'Create & Publish',  desc: 'Write posts, use the AI generator, schedule & go live', href: '/modules/social_media/create' },
            { icon: '✏️', label: 'Review Posts',       desc: 'Edit, approve, publish or delete your saved drafts',    href: '/modules/social_media/review' },
            { icon: '🖼️', label: 'Image Library',     desc: 'Browse and manage your saved social media images',      href: '/modules/social_media/images' },
            { icon: '📅', label: 'Schedule Calendar',  desc: 'See all upcoming posts on the calendar view',           href: '/modules/social_media/calendar' },
            { icon: '📁', label: 'Campaigns',          desc: 'Manage saved AI campaigns and post collections',        href: '/modules/social_media/campaigns' },
            { icon: '📬', label: 'Smart Inbox',        desc: 'Review comments and replies from all platforms',        href: '/modules/social_media/inbox' },
            { icon: '📊', label: 'ROI Analytics',      desc: 'Track reach, engagement and performance over time',     href: '/modules/social_media/roi' },
            { icon: '📣', label: 'Paid Ads',           desc: 'Create and launch Facebook & Instagram ad campaigns',   href: '/modules/social_media/ads' },
            { icon: '⚙️', label: 'Platform Setup',     desc: 'Connect Facebook, TikTok, LinkedIn, Pinterest and more', href: '/modules/social_media/setup' },
          ].map(n => (
            <button key={n.label} style={S.navCard} onClick={() => { window.location.href = n.href; }}>
              <div style={S.navIcon}>{n.icon}</div>
              <div style={S.navLabel}>{n.label}</div>
              <div style={S.navDesc}>{n.desc}</div>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, loading }) {
  return (
    <div style={{ background: '#111827', borderRadius: 16, padding: '22px 20px', border: `1px solid rgba(255,255,255,0.06)`, borderTop: `3px solid ${color}`, textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 36, fontWeight: 600, color }}>{loading ? '—' : value}</div>
      <div style={{ fontSize: 16, opacity: 0.55, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
    </div>
  );
}

function ScheduleRow({ item }) {
  const platform = item.social_posts?.platform || 'unknown';
  const meta = platformMeta(platform);
  const content = item.social_posts?.content || '';
  const preview = content.length > 70 ? content.slice(0, 70) + '…' : content;
  const statusColor = item.status === 'published' ? '#6EE7B7' : item.status === 'failed' ? '#FCA5A5' : '#93C5FD';
  return (
    <div style={S.scheduleRow}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: meta.color + '22', border: `1.5px solid ${meta.color}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {meta.svg(meta.color)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: meta.color, marginBottom: 2 }}>{meta.label}</div>
        <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#E9D5FF' }}>{preview || '(no content)'}</div>
        <div style={{ fontSize: 13, opacity: 0.5, marginTop: 2 }}>{fmt(item.scheduled_for)}</div>
      </div>
      <div style={{ ...S.statusPill, background: `${statusColor}22`, color: statusColor, marginLeft: 10 }}>{item.status}</div>
    </div>
  );
}

const S = {
  page: { padding: 32, color: '#fff', minHeight: '100vh' },
  shell: { width: '100%', maxWidth: 1200, margin: '0 auto' },
  banner: {
    background: 'linear-gradient(90deg, #6D28D9, #9333EA)',
    borderRadius: 16, padding: '22px 28px', marginBottom: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
  },
  bannerLeft: { display: 'flex', alignItems: 'center', gap: 18 },
  bannerIcon: { background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 14, fontSize: 22 },
  bannerTitle: { fontSize: 48, fontWeight: 600 },
  bannerSub: { fontSize: 18, opacity: 0.85, marginTop: 4 },
  bannerBtn: { background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', padding: '12px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 15 },
  alertBanner: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 12, padding: '14px 20px', marginBottom: 20, fontSize: 16,
    display: 'flex', alignItems: 'center', gap: 10,
  },
  alertLink: { background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', fontSize: 16, marginLeft: 'auto' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 },
  card: { background: '#111827', borderRadius: 16, padding: 24, border: '1px solid rgba(255,255,255,0.06)' },
  cardHeader: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 },
  scheduleRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  statusPill: { fontSize: 16, padding: '4px 10px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' },
  accountRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  accountName: { fontSize: 16, fontWeight: 600 },
  accountPlatform: { fontSize: 16, opacity: 0.5, textTransform: 'capitalize', marginTop: 2 },
  navGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 },
  navCard: {
    background: '#111827', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16, padding: '22px 20px', cursor: 'pointer', color: '#fff',
    textAlign: 'left', transition: 'border-color 0.15s',
  },
  navIcon: { fontSize: 30, marginBottom: 10 },
  navLabel: { fontSize: 18, fontWeight: 600, marginBottom: 6 },
  navDesc: { fontSize: 16, opacity: 0.55, lineHeight: 1.6 },
  emptyState: { opacity: 0.45, fontSize: 16, padding: '16px 0' },
  muted: { opacity: 0.4, fontSize: 16 },
};

