// /pages/modules/social_media/roi.js
// ROI & Analytics dashboard for Social Media module.
// Shows post performance, platform breakdowns, activity trends – based on internal DB data.
// When platform insights APIs are connected (Facebook Insights, etc.), this page can be extended.

import Head from 'next/head';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../utils/supabase-client';

const PLATFORM_META = {
  facebook:  { color: '#1877F2', label: 'Facebook',  icon: '📘' },
  instagram: { color: '#E1606C', label: 'Instagram', icon: '📷' },
  linkedin:  { color: '#0A66C2', label: 'LinkedIn',  icon: '💼' },
  x:         { color: '#1d9bf0', label: 'X',         icon: '𝕏'  },
  twitter:   { color: '#1d9bf0', label: 'X',         icon: '𝕏'  },
  tiktok:    { color: '#ff0050', label: 'TikTok',    icon: '🎵' },
  youtube:   { color: '#FF0000', label: 'YouTube',   icon: '▶️' },
  pinterest: { color: '#E60023', label: 'Pinterest', icon: '📌' },
};
const pm = (p) => PLATFORM_META[String(p || '').toLowerCase()] || { color: '#7C3AED', label: p || 'Unknown', icon: '🌐' };

const RANGES = [
  { label: '7 days',  days: 7  },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

const S = {
  page:        { minHeight: '100vh', background: '#1f0420', padding: '0 20px 48px', fontFamily: 'system-ui,sans-serif', color: '#F3F0FF' },
  shell:       { maxWidth: 1320, margin: '0 auto', padding: '0' },
  banner:      { maxWidth: 1320, margin: '16px auto 0', background: 'linear-gradient(90deg,#6D28D9,#9333EA)', borderRadius: 16, padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  bannerLeft:  { display: 'flex', alignItems: 'center', gap: 16 },
  bannerIcon:  { background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 14px', fontSize: 24 },
  bannerTitle: { fontSize: 48, fontWeight: 600, color: '#fff', margin: 0 },
  bannerSub:   { fontSize: 18, color: 'rgba(255,255,255,0.8)', marginTop: 3 },
  bannerNav:   { display: 'flex', gap: 8, flexWrap: 'wrap' },
  bannerBtn:   { padding: '9px 18px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 600, fontSize: 18, cursor: 'pointer', whiteSpace: 'nowrap' },
  section:     { marginTop: 28 },
  sectionTitle:{ fontSize: 28, fontWeight: 600, color: '#E9D5FF', marginBottom: 16, marginTop: 0 },
  statsGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 },
  statCard:    { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(167,169,250,0.15)', borderRadius: 14, padding: '20px 18px', textAlign: 'center' },
  statVal:     { fontSize: 40, fontWeight: 600, lineHeight: 1.1, marginBottom: 6 },
  statLabel:   { fontSize: 16, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 },
  statSub:     { fontSize: 16, color: '#6B7280', marginTop: 4 },
  card:        { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(167,169,250,0.12)', borderRadius: 16, padding: '22px 24px' },
  twoCol:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 },
  row:         { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  rangeStack:  { display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' },
  rangeBtn: (a)=> ({ padding: '6px 16px', borderRadius: 20, border: a ? '1px solid #A78BFA' : '1px solid rgba(167,169,250,0.2)', background: a ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.04)', color: a ? '#F3F0FF' : '#9CA3AF', fontWeight: 600, fontSize: 16, cursor: 'pointer' }),
  barTrack:    { flex: 1, height: 10, background: 'rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' },
  empty:       { textAlign: 'center', padding: '40px 20px', color: '#6B7280', fontSize: 16 },
  note:        { background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '14px 18px', fontSize: 16, color: '#FCD34D', lineHeight: 1.7, marginTop: 18 },
  postRow:     { display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'flex-start' },
  postIcon:    { width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  pill: (c)  => ({ display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 16, fontWeight: 600, background: c + '22', color: c, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }),
};

const STATUS_COLORS = {
  published: '#6EE7B7',
  scheduled: '#93C5FD',
  draft:     '#9CA3AF',
  failed:    '#FCA5A5',
  queued:    '#FCD34D',
};

// Build last N days array for bar chart
function buildDailyBuckets(posts, days) {
  const now = new Date();
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    buckets.push({ key, date: d, created: 0, published: 0 });
  }
  for (const p of posts) {
    const created = p.created_at ? p.created_at.slice(0, 10) : null;
    const published = p.published_at ? p.published_at.slice(0, 10) : null;
    const cb = buckets.find(b => b.key === created);
    if (cb) cb.created++;
    const pb = buckets.find(b => b.key === published);
    if (pb) pb.published++;
  }
  return buckets;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShortDate(d) {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

const STORAGE_KEY = 'social_roi_inputs';

const DEFAULT_ROI = {
  adSpend:        '',   // $ paid ads / boosted posts
  contentCost:    '',   // $ paid to writers, designers, agencies
  toolsCost:      '',   // $ subscriptions (this platform, schedulers, etc)
  hoursPerWeek:   '',   // hours your team spends on social per week
  hourlyRate:     '',   // dollar value of that time
  revenueLeads:   '',   // $ revenue from leads attributed to social
  revenueDirect:  '',   // $ direct sales / affiliate clicks from social posts
  periodWeeks:    '4',  // how many weeks does the above cover
};

function fmtMoney(n) {
  if (!isFinite(n) || isNaN(n)) return '—';
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ROIAnalytics() {
  const router = useRouter();
  const [posts, setPosts]         = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [range, setRange]         = useState(30);
  const [roi, setRoi]             = useState(DEFAULT_ROI);
  const [roiSaved, setRoiSaved]   = useState(false);

  useEffect(() => {
    load();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setRoi({ ...DEFAULT_ROI, ...JSON.parse(saved) });
    } catch {}
  }, []);

  function updateRoi(field, val) {
    setRoi(prev => ({ ...prev, [field]: val }));
    setRoiSaved(false);
  }

  function saveRoi() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(roi));
    setRoiSaved(true);
    setTimeout(() => setRoiSaved(false), 2500);
  }

  function clearRoi() {
    localStorage.removeItem(STORAGE_KEY);
    setRoi(DEFAULT_ROI);
    setRoiSaved(false);
  }

  async function load() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;

      const [postsRes, accountsRes] = await Promise.all([
        supabase
          .from('social_posts')
          .select('id,platform,status,content,created_at,published_at,media_url,platform_post_id')
          .eq('user_id', uid)
          .order('created_at', { ascending: false }),
        supabase
          .from('social_accounts')
          .select('platform,account_name,is_active')
          .eq('user_id', uid),
      ]);

      setPosts(postsRes.data || []);
      setAccounts(accountsRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // ── Filtered to selected range ──────────────────────────────────
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - range);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [range]);

  const rangedPosts = useMemo(() =>
    posts.filter(p => p.created_at && new Date(p.created_at) >= since),
    [posts, since]
  );

  // ── Stats ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total     = rangedPosts.length;
    const published = rangedPosts.filter(p => p.status === 'published').length;
    const scheduled = rangedPosts.filter(p => p.status === 'scheduled' || p.status === 'queued').length;
    const failed    = rangedPosts.filter(p => p.status === 'failed').length;
    const draft     = rangedPosts.filter(p => p.status === 'draft').length;
    const withMedia = rangedPosts.filter(p => p.media_url).length;
    const successRate = total > 0 ? Math.round((published / total) * 100) : 0;
    const connected = accounts.filter(a => a.is_active).length;
    return { total, published, scheduled, failed, draft, withMedia, successRate, connected };
  }, [rangedPosts, accounts]);

  // ── Platform breakdown ──────────────────────────────────────────
  const platformBreakdown = useMemo(() => {
    const map = {};
    for (const p of rangedPosts) {
      const key = p.platform || 'unknown';
      if (!map[key]) map[key] = { created: 0, published: 0, failed: 0, scheduled: 0 };
      map[key].created++;
      if (p.status === 'published') map[key].published++;
      else if (p.status === 'failed') map[key].failed++;
      else if (p.status === 'scheduled' || p.status === 'queued') map[key].scheduled++;
    }
    return Object.entries(map)
      .map(([plat, v]) => ({ plat, ...v, rate: v.created > 0 ? Math.round((v.published / v.created) * 100) : 0 }))
      .sort((a, b) => b.created - a.created);
  }, [rangedPosts]);

  const maxPlatformCount = useMemo(() =>
    Math.max(1, ...platformBreakdown.map(p => p.created)),
    [platformBreakdown]
  );

  // ── Daily buckets ───────────────────────────────────────────────
  const dailyBuckets = useMemo(() => buildDailyBuckets(rangedPosts, range), [rangedPosts, range]);
  const maxDaily = useMemo(() => Math.max(1, ...dailyBuckets.map(b => b.created)), [dailyBuckets]);

  // ── Status breakdown (all time vs range) ───────────────────────
  const allTimeByStatus = useMemo(() => {
    const m = {};
    for (const p of posts) {
      m[p.status] = (m[p.status] || 0) + 1;
    }
    return m;
  }, [posts]);

  // ── Recent published posts ──────────────────────────────────────
  const recentPublished = useMemo(() =>
    posts.filter(p => p.status === 'published').slice(0, 10),
    [posts]
  );

  // ── Weekly cadence ──────────────────────────────────────────────
  const avgPerWeek = useMemo(() => {
    if (!rangedPosts.length) return 0;
    return (rangedPosts.length / (range / 7)).toFixed(1);
  }, [rangedPosts, range]);

  const publishedPerWeek = useMemo(() => {
    const pub = rangedPosts.filter(p => p.status === 'published').length;
    return (pub / (range / 7)).toFixed(1);
  }, [rangedPosts, range]);

  // ── Posting streak ──────────────────────────────────────────────
  const streak = useMemo(() => {
    const days = new Set(
      posts
        .filter(p => p.status === 'published' && p.published_at)
        .map(p => p.published_at.slice(0, 10))
    );
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (days.has(key)) count++;
      else if (i > 0) break;
    }
    return count;
  }, [posts]);

  // ── Bucket spacing — show every N-th label to avoid crowding ───
  const labelEvery = range <= 7 ? 1 : range <= 30 ? 5 : 14;

  // ── ROI Calculations ────────────────────────────────────────────
  const roiCalc = useMemo(() => {
    const weeks    = Math.max(1, parseFloat(roi.periodWeeks) || 4);
    const adSpend  = parseFloat(roi.adSpend)       || 0;
    const content  = parseFloat(roi.contentCost)   || 0;
    const tools    = parseFloat(roi.toolsCost)      || 0;
    const hours    = parseFloat(roi.hoursPerWeek)   || 0;
    const rate     = parseFloat(roi.hourlyRate)     || 0;
    const revLeads = parseFloat(roi.revenueLeads)   || 0;
    const revDirect= parseFloat(roi.revenueDirect)  || 0;

    const timeCost     = hours * rate * weeks;
    const totalInvest  = adSpend + content + tools + timeCost;
    const totalReturn  = revLeads + revDirect;
    const netProfit    = totalReturn - totalInvest;
    const roiPct       = totalInvest > 0 ? ((netProfit / totalInvest) * 100) : null;
    const breakEven    = totalInvest > 0 && totalReturn < totalInvest;
    const published    = posts.filter(p => p.status === 'published').length;
    const costPerPost  = published > 0 && totalInvest > 0 ? totalInvest / published : null;
    const revenuePerPost = published > 0 && totalReturn > 0 ? totalReturn / published : null;
    return { totalInvest, totalReturn, netProfit, roiPct, breakEven, timeCost, costPerPost, revenuePerPost, weeks };
  }, [roi, posts]);

  return (
    <>
      <Head><title>ROI Analytics — Social Media</title></Head>
      <div style={S.page}>

        {/* Banner */}
        <div style={S.banner}>
          <div style={S.bannerLeft}>
            <div style={S.bannerIcon}>📊</div>
            <div>
              <h1 style={S.bannerTitle}>ROI Analytics</h1>
              <div style={S.bannerSub}>Track reach, engagement and publishing performance across all platforms</div>
            </div>
          </div>
          <div style={S.bannerNav}>
            <button style={S.bannerBtn} onClick={() => router.push('/modules/social_media/create')}>+ Create Posts</button>
            <button style={S.bannerBtn} onClick={() => router.push('/modules/social_media/calendar')}>📅 Calendar</button>
            <button style={S.bannerBtn} onClick={() => router.push('/modules/social_media/dashboard')}>Back to Dashboard</button>
          </div>
        </div>

        <div style={S.shell}>

          {/* Date range picker */}
          <div style={{ ...S.section }}>
            <div style={S.rangeStack}>
              <span style={{ fontSize: 16, color: '#9CA3AF', fontWeight: 600, marginRight: 4 }}>DATE RANGE:</span>
              {RANGES.map(r => (
                <button key={r.days} style={S.rangeBtn(range === r.days)} onClick={() => setRange(r.days)}>
                  {r.label}
                </button>
              ))}
              {!loading && <span style={{ fontSize: 16, color: '#6B7280', marginLeft: 8 }}>{rangedPosts.length} posts in this period</span>}
            </div>
          </div>

          {/* Stat cards */}
          <div style={S.statsGrid}>
            <StatCard label="Posts Created"   value={loading ? '…' : stats.total}       color="#A78BFA" accent top />
            <StatCard label="Published"        value={loading ? '…' : stats.published}   color="#6EE7B7" accent top />
            <StatCard label="Scheduled"        value={loading ? '…' : stats.scheduled}   color="#93C5FD" accent top />
            <StatCard label="Failed"           value={loading ? '…' : stats.failed}      color="#FCA5A5" accent top />
            <StatCard label="Success Rate"     value={loading ? '…' : `${stats.successRate}%`} color="#FCD34D" accent top sub="of created posts published" />
            <StatCard label="Posts / Week"     value={loading ? '…' : avgPerWeek}        color="#C4B5FD" accent top sub="created" />
            <StatCard label="Published / Wk"  value={loading ? '…' : publishedPerWeek}  color="#6EE7B7" accent top sub="avg this period" />
            <StatCard label="Publishing Streak" value={loading ? '…' : `${streak}d`}    color="#F9A8D4" accent top sub="consecutive days" />
          </div>

          {/* ── ROI: Investment vs Return ─────────────────────────── */}
          <div style={S.section}>
            <div style={{ ...S.card, border: '1px solid rgba(124,58,237,0.35)' }}>
              <p style={S.sectionTitle}>💰 Return on Investment (ROI)</p>

              {/* ROI Summary bars */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 28 }}>
                <RoiSummaryCard
                  label="Total Investment"
                  value={fmtMoney(roiCalc.totalInvest)}
                  color="#FCA5A5"
                  sub={`Over ${roiCalc.weeks} week${roiCalc.weeks !== 1 ? 's' : ''}`}
                  hasData={roiCalc.totalInvest > 0}
                />
                <RoiSummaryCard
                  label="Total Return"
                  value={fmtMoney(roiCalc.totalReturn)}
                  color="#6EE7B7"
                  sub="Revenue attributed to social"
                  hasData={roiCalc.totalReturn > 0}
                />
                <RoiSummaryCard
                  label="Net Profit"
                  value={roiCalc.totalInvest > 0 ? fmtMoney(roiCalc.netProfit) : '—'}
                  color={roiCalc.netProfit >= 0 ? '#6EE7B7' : '#FCA5A5'}
                  sub={roiCalc.netProfit >= 0 ? 'Positive return' : 'Operating at a loss'}
                  hasData={roiCalc.totalInvest > 0}
                />
                <RoiSummaryCard
                  label="ROI"
                  value={roiCalc.roiPct !== null ? `${roiCalc.roiPct >= 0 ? '+' : ''}${roiCalc.roiPct.toFixed(1)}%` : '—'}
                  color={roiCalc.roiPct === null ? '#9CA3AF' : roiCalc.roiPct >= 100 ? '#FCD34D' : roiCalc.roiPct >= 0 ? '#6EE7B7' : '#FCA5A5'}
                  sub="(Return − Investment) ÷ Investment"
                  hasData={roiCalc.roiPct !== null}
                  large
                />
                <RoiSummaryCard
                  label="Cost Per Post"
                  value={roiCalc.costPerPost !== null ? fmtMoney(roiCalc.costPerPost) : '—'}
                  color="#C4B5FD"
                  sub="Total investment ÷ published posts"
                  hasData={roiCalc.costPerPost !== null}
                />
                <RoiSummaryCard
                  label="Revenue Per Post"
                  value={roiCalc.revenuePerPost !== null ? fmtMoney(roiCalc.revenuePerPost) : '—'}
                  color="#FCD34D"
                  sub="Total return ÷ published posts"
                  hasData={roiCalc.revenuePerPost !== null}
                />
              </div>

              {/* ROI visual bar */}
              {roiCalc.totalInvest > 0 && roiCalc.totalReturn > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#9CA3AF', marginBottom: 6 }}>
                    <span>Investment {fmtMoney(roiCalc.totalInvest)}</span>
                    <span>Return {fmtMoney(roiCalc.totalReturn)}</span>
                  </div>
                  <div style={{ height: 22, background: 'rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${Math.min(100, Math.round((roiCalc.totalReturn / Math.max(roiCalc.totalInvest, roiCalc.totalReturn)) * 100))}%`,
                      background: roiCalc.totalReturn >= roiCalc.totalInvest
                        ? 'linear-gradient(90deg,#6EE7B7,#34D399)'
                        : 'linear-gradient(90deg,#FCA5A5,#F87171)',
                      borderRadius: 12, transition: 'width 0.5s ease',
                    }} />
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${Math.min(100, Math.round((roiCalc.totalInvest / Math.max(roiCalc.totalInvest, roiCalc.totalReturn)) * 100))}%`,
                      border: '2px dashed rgba(252,165,165,0.6)', borderRadius: 12, pointerEvents: 'none',
                    }} />
                  </div>
                  <div style={{ fontSize: 16, color: '#6B7280', marginTop: 6, textAlign: 'center' }}>
                    {roiCalc.totalReturn >= roiCalc.totalInvest
                      ? `You are ${fmtMoney(roiCalc.netProfit)} ahead — ${roiCalc.roiPct?.toFixed(1)}% ROI`
                      : `You need ${fmtMoney(roiCalc.totalInvest - roiCalc.totalReturn)} more revenue to break even`}
                  </div>
                </div>
              )}

              {/* Input form */}
              <div style={{ borderTop: '1px solid rgba(167,169,250,0.15)', paddingTop: 22 }}>
                <p style={{ ...S.sectionTitle, marginBottom: 18 }}>📝 Enter Your Numbers</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>

                  {/* Expenditure */}
                  <div>
                    <div style={{ fontSize: 16, color: '#FCA5A5', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>💸 Expenditure</div>
                    <RoiInput label="Paid ads / boosted posts ($)" field="adSpend"       roi={roi} update={updateRoi} />
                    <RoiInput label="Content creation costs ($)"   field="contentCost"   roi={roi} update={updateRoi} />
                    <RoiInput label="Tools &amp; subscriptions ($)"field="toolsCost"      roi={roi} update={updateRoi} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <RoiInput label="Hours/week on social"       field="hoursPerWeek"  roi={roi} update={updateRoi} />
                      <RoiInput label="Hourly rate ($)"            field="hourlyRate"    roi={roi} update={updateRoi} />
                    </div>
                    {(parseFloat(roi.hoursPerWeek) > 0 && parseFloat(roi.hourlyRate) > 0) && (
                      <div style={{ fontSize: 16, color: '#9CA3AF', marginTop: 4 }}>
                        Time cost: {fmtMoney((parseFloat(roi.hoursPerWeek)||0) * (parseFloat(roi.hourlyRate)||0) * (parseFloat(roi.periodWeeks)||4))}
                      </div>
                    )}
                  </div>

                  {/* Return */}
                  <div>
                    <div style={{ fontSize: 16, color: '#6EE7B7', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>📈 Return</div>
                    <RoiInput label="Revenue from social-attributed leads ($)" field="revenueLeads"  roi={roi} update={updateRoi} />
                    <RoiInput label="Direct sales / affiliate revenue ($)"      field="revenueDirect" roi={roi} update={updateRoi} />
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 16, color: '#9CA3AF', marginBottom: 6 }}>Period covered (weeks)</div>
                      <input
                        type="number" min="1" max="520"
                        value={roi.periodWeeks}
                        onChange={e => updateRoi('periodWeeks', e.target.value)}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(167,169,250,0.25)', borderRadius: 8, color: '#F3F0FF', padding: '9px 14px', fontSize: 16, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 20, alignItems: 'center' }}>
                  <button
                    onClick={saveRoi}
                    style={{ padding: '10px 24px', borderRadius: 9, border: 'none', background: 'rgba(124,58,237,0.7)', color: '#fff', fontWeight: 600, fontSize: 18, cursor: 'pointer' }}>
                    Save Numbers
                  </button>
                  <button
                    onClick={clearRoi}
                    style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#9CA3AF', fontWeight: 600, fontSize: 18, cursor: 'pointer' }}>
                    Clear
                  </button>
                  {roiSaved && <span style={{ fontSize: 16, color: '#6EE7B7' }}>✓ Saved to this browser</span>}
                </div>
                <p style={{ fontSize: 16, color: '#6B7280', marginTop: 10 }}>Numbers are saved locally in your browser. No data leaves this device.</p>
              </div>
            </div>
          </div>

          {/* Activity bar chart */}
          <div style={{ ...S.section }}>
            <div style={S.card}>
              <p style={S.sectionTitle}>📈 Daily Post Activity — Last {range} Days</p>
              {loading ? (
                <div style={S.empty}>Loading…</div>
              ) : rangedPosts.length === 0 ? (
                <div style={S.empty}>No posts created in this period.</div>
              ) : (
                <div>
                  {/* Bar chart */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: range > 30 ? 2 : 4, height: 100, marginBottom: 6 }}>
                    {dailyBuckets.map((b, i) => {
                      const createdH = Math.max(2, Math.round((b.created / maxDaily) * 90));
                      const pubH     = b.published > 0 ? Math.max(2, Math.round((b.published / maxDaily) * 90)) : 0;
                      return (
                        <div key={b.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 1, cursor: 'default', minWidth: 0 }}
                          title={`${fmtShortDate(b.date)}: ${b.created} created, ${b.published} published`}>
                          <div style={{ width: '100%', background: b.created > 0 ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.05)', borderRadius: '3px 3px 0 0', height: createdH, position: 'relative' }}>
                            {pubH > 0 && (
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#6EE7B7', borderRadius: '2px 2px 0 0', height: pubH }} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* X-axis labels */}
                  <div style={{ display: 'flex', gap: range > 30 ? 2 : 4, fontSize: 11, color: '#6B7280' }}>
                    {dailyBuckets.map((b, i) => (
                      <div key={b.key} style={{ flex: 1, textAlign: 'center', overflow: 'hidden', minWidth: 0 }}>
                        {i % labelEvery === 0 ? fmtShortDate(b.date) : ''}
                      </div>
                    ))}
                  </div>
                  {/* Legend */}
                  <div style={{ display: 'flex', gap: 18, marginTop: 12, fontSize: 16, color: '#9CA3AF' }}>
                    <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(167,139,250,0.6)', borderRadius: 2, marginRight: 5 }} />Created</span>
                    <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#6EE7B7', borderRadius: 2, marginRight: 5 }} />Published</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Platform breakdown + Connected accounts */}
          <div style={S.twoCol}>

            {/* Platform breakdown */}
            <div style={S.card}>
              <p style={S.sectionTitle}>🌐 Platform Breakdown</p>
              {loading ? (
                <div style={S.empty}>Loading…</div>
              ) : platformBreakdown.length === 0 ? (
                <div style={S.empty}>No posts in this period.</div>
              ) : (
                platformBreakdown.map(({ plat, created, published, failed, rate }) => {
                  const meta = pm(plat);
                  return (
                    <div key={plat} style={S.row}>
                      <span style={{ fontSize: 20, width: 26, textAlign: 'center', flexShrink: 0 }}>{meta.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 16, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                          <span style={{ fontSize: 16, color: '#9CA3AF' }}>{published}/{created} published</span>
                        </div>
                        <div style={S.barTrack}>
                          <div style={{ height: '100%', width: `${Math.round((created / maxPlatformCount) * 100)}%`, background: meta.color + '88', borderRadius: 6, position: 'relative' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${rate}%`, background: meta.color, borderRadius: 6 }} />
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 600, color: rate >= 80 ? '#6EE7B7' : rate >= 50 ? '#FCD34D' : '#FCA5A5', width: 38, textAlign: 'right', flexShrink: 0 }}>
                        {rate}%
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Status breakdown */}
            <div style={S.card}>
              <p style={S.sectionTitle}>📋 All-Time Status Summary</p>
              {loading ? (
                <div style={S.empty}>Loading…</div>
              ) : posts.length === 0 ? (
                <div style={S.empty}>No posts yet.</div>
              ) : (
                <>
                  {Object.entries(allTimeByStatus).sort((a,b) => b[1]-a[1]).map(([status, count]) => {
                    const color = STATUS_COLORS[status] || '#9CA3AF';
                    const pct = Math.round((count / posts.length) * 100);
                    return (
                      <div key={status} style={S.row}>
                        <span style={S.pill(color)}>{status}</span>
                        <div style={S.barTrack}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color + '66', borderRadius: 6 }} />
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 600, color, width: 60, textAlign: 'right', flexShrink: 0 }}>{count} <span style={{ color: '#6B7280', fontWeight: 400, fontSize: 16 }}>({pct}%)</span></span>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 14, fontSize: 16, color: '#6B7280', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                    Total all-time: <strong style={{ color: '#E9D5FF' }}>{posts.length}</strong> posts across <strong style={{ color: '#E9D5FF' }}>{new Set(posts.map(p => p.platform)).size}</strong> platforms
                  </div>
                </>
              )}

              {/* Connected accounts */}
              <p style={{ ...S.sectionTitle, marginTop: 24 }}>🔌 Connected Accounts</p>
              {accounts.length === 0 ? (
                <div style={{ fontSize: 16, color: '#6B7280' }}>
                  No accounts connected.{' '}
                  <button style={{ background: 'none', border: 'none', color: '#A78BFA', cursor: 'pointer', fontSize: 16, textDecoration: 'underline', padding: 0 }}
                    onClick={() => router.push('/modules/social_media/setup')}>
                    Connect now →
                  </button>
                </div>
              ) : (
                accounts.map((a, i) => {
                  const meta = pm(a.platform);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 16 }}>
                      <span style={{ fontSize: 18 }}>{meta.icon}</span>
                      <span style={{ flex: 1, color: '#E9D5FF', fontWeight: 500 }}>{a.account_name || a.platform}</span>
                      <span style={{ ...S.pill(a.is_active ? '#6EE7B7' : '#FCA5A5') }}>{a.is_active ? 'Live' : 'Off'}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent published posts */}
          <div style={S.section}>
            <div style={S.card}>
              <p style={S.sectionTitle}>✅ Recently Published Posts</p>
              {loading ? (
                <div style={S.empty}>Loading…</div>
              ) : recentPublished.length === 0 ? (
                <div style={S.empty}>No published posts yet.</div>
              ) : (
                recentPublished.map(post => {
                  const meta = pm(post.platform);
                  const preview = (post.content || '').length > 120 ? post.content.slice(0, 120) + '…' : post.content || '(no content)';
                  return (
                    <div key={post.id} style={S.postRow}>
                      <div style={{ ...S.postIcon, background: meta.color + '22', border: `1.5px solid ${meta.color}55` }}>
                        {meta.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 16, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                          {post.media_url && <span style={{ fontSize: 16, color: '#9CA3AF' }}>🖼️ with image</span>}
                          {post.platform_post_id && (
                            <span style={{ fontSize: 16, color: '#6B7280' }}>ID: {post.platform_post_id}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 16, color: '#D8B4FE', lineHeight: 1.5 }}>{preview}</div>
                        <div style={{ fontSize: 16, color: '#6B7280', marginTop: 4 }}>Published {fmtDate(post.published_at)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Platform Insights notice */}
          <div style={S.note}>
            <strong>📡 Platform Insights (Reach, Likes, Comments) — Coming Soon</strong><br />
            Once your Facebook, Instagram, LinkedIn and X connections are verified via App Review,
            this page will automatically pull real engagement metrics — impressions, reach, likes,
            comments, shares and link clicks — directly from each platform&apos;s analytics API.
            The data above reflects your internal posting activity.
          </div>

        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, color, sub, top }) {
  return (
    <div style={{ ...S.statCard, borderTop: top ? `3px solid ${color}` : undefined }}>
      <div style={{ ...S.statVal, color }}>{value}</div>
      <div style={S.statLabel}>{label}</div>
      {sub && <div style={S.statSub}>{sub}</div>}
    </div>
  );
}

function RoiSummaryCard({ label, value, color, sub, hasData, large }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${color}33`, borderTop: `3px solid ${color}`, borderRadius: 14, padding: '18px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: large ? 36 : 28, fontWeight: 600, color: hasData ? color : '#4B5563', lineHeight: 1.1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 16, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
      {sub && <div style={{ fontSize: 16, color: '#6B7280', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function RoiInput({ label, field, roi, update }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 16, color: '#9CA3AF', marginBottom: 5 }}>{label}</div>
      <input
        type="number" min="0" step="0.01"
        value={roi[field]}
        onChange={e => update(field, e.target.value)}
        placeholder="0.00"
        style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(167,169,250,0.25)', borderRadius: 8, color: '#F3F0FF', padding: '9px 14px', fontSize: 16, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />
    </div>
  );
}
