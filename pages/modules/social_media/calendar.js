import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../utils/supabase-client';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Bright label colour per day-of-week
const DAY_COLORS = ['#fda4af','#fdba74','#fde047','#86efac','#7dd3fc','#a5b4fc','#f0abfc'];
// Solid vivid cell background per day-of-week
const DAY_BG     = ['#9f1239','#9a3412','#854d0e','#166534','#0c4a6e','#3730a3','#6b21a8'];

const PLATFORM_META = {
  facebook:  { icon: 'f',  color: '#1877F2', label: 'Facebook' },
  instagram: { icon: 'IG', color: '#E1606C', label: 'Instagram' },
  linkedin:  { icon: 'in', color: '#0A66C2', label: 'LinkedIn' },
  x:         { icon: 'X',  color: '#1d9bf0', label: 'X' },
  tiktok:    { icon: 'TT', color: '#ff0050', label: 'TikTok' },
  youtube:   { icon: 'YT', color: '#FF0000', label: 'YouTube' },
  pinterest: { icon: 'P',  color: '#E60023', label: 'Pinterest' },
};

function pm(platform) {
  return PLATFORM_META[String(platform || '').toLowerCase()] || { icon: '??', color: '#7C3AED', label: 'Post' };
}

function toDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildGrid(view, anchor) {
  if (view === 'month') {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }
  const start = getWeekStart(anchor);
  const count = view === 'week' ? 7 : view === '16days' ? 16 : 91;
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
}

function StatusBadge({ status }) {
  const map = {
    draft:     { bg: 'rgba(75,85,99,0.4)',    color: '#9CA3AF', label: 'Draft' },
    scheduled: { bg: 'rgba(37,99,235,0.25)',  color: '#93C5FD', label: 'Scheduled' },
    published: { bg: 'rgba(5,150,105,0.25)',  color: '#6EE7B7', label: 'Published' },
    failed:    { bg: 'rgba(239,68,68,0.25)',  color: '#FCA5A5', label: 'Failed' },
    queued:    { bg: 'rgba(217,119,6,0.25)',  color: '#FCD34D', label: 'Queued' },
  };
  const s = map[status] || map.draft;
  return (
    <span style={{ fontSize: 16, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
      background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {s.label}
    </span>
  );
}

const VIEW_BTNS = [
  { id: 'week',   label: 'This Week' },
  { id: '16days', label: '16 Days' },
  { id: 'month',  label: 'Month' },
  { id: '90days', label: '90 Days' },
];

export default function SocialCalendar() {
  const router = useRouter();

  const [view, setView]               = useState('month');
  const [anchor, setAnchor]           = useState(new Date());
  const [cards, setCards]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [notice, setNotice]           = useState('');
  const [dragOver, setDragOver]       = useState(null);


  const todayKey   = toDayKey(new Date());
  const grid       = useMemo(() => buildGrid(view, anchor), [view, anchor]);
  const rangeLabel = useMemo(() => {
    if (view === 'month') return anchor.toLocaleString('en-AU', { month: 'long', year: 'numeric' });
    const first = grid[0], last = grid[grid.length - 1];
    const fmt = d => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    return `${fmt(first)} – ${fmt(last)} ${last.getFullYear()}`;
  }, [view, anchor, grid]);

  function navigate(dir) {
    setAnchor(prev => {
      const d = new Date(prev);
      if (view === 'week')       d.setDate(d.getDate() + dir * 7);
      else if (view === '16days') d.setDate(d.getDate() + dir * 16);
      else if (view === 'month')  d.setMonth(d.getMonth() + dir);
      else                        d.setDate(d.getDate() + dir * 91);
      return d;
    });
  }

  const grouped = useMemo(() => {
    const byDay = {};
    for (const card of cards) {
      if (card.scheduledFor) {
        const key = toDayKey(new Date(card.scheduledFor));
        if (!byDay[key]) byDay[key] = [];
        byDay[key].push(card);
      }
    }
    for (const key in byDay) {
      byDay[key].sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
    }
    return byDay;
  }, [cards]);

  useEffect(() => { loadBoard(); }, []);

  async function loadBoard() {
    setLoading(true); setNotice('');
    try {
      const token = await getToken();
      if (!token) { setNotice('Sign in to view the calendar.'); setLoading(false); return; }
      const res  = await fetch('/api/social/calendar-board', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load');
      setCards(json.cards || []);
    } catch (err) { setNotice(err.message); }
    finally { setLoading(false); }
  }

  function openDayPanel(key) {
    router.push(`/modules/social_media/calendar-day?date=${key}`);
  }

  async function dropPost(postId, targetDay) {
    const card = cards.find(c => c.postId === postId);
    if (!card) return;
    // Preserve time-of-day if already scheduled, else default to 09:00
    const existing = card.scheduledFor ? new Date(card.scheduledFor) : null;
    const h = existing ? existing.getHours() : 9;
    const m = existing ? existing.getMinutes() : 0;
    const newDate = new Date(targetDay);
    newDate.setHours(h, m, 0, 0);
    const newIso = newDate.toISOString();
    // Optimistic update
    setCards(prev => prev.map(c => c.postId === postId ? { ...c, scheduledFor: newIso, status: c.status === 'draft' ? 'scheduled' : c.status } : c));
    try {
      const token = await getToken();
      const res = await fetch('/api/social/calendar-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId, scheduledFor: newIso }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
    } catch (err) {
      setNotice('Move failed: ' + err.message);
      loadBoard(); // revert
    }
  }

  const totalScheduled = cards.filter(c => c.scheduledFor).length;

  const cellMinH  = view === '90days' ? 140 : 280;

  return (
    <>
      <Head><title>Social Calendar</title></Head>
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0c0420 0%,#0d1a3a 50%,#0c0420 100%)', fontFamily: 'system-ui,sans-serif', color: '#F3F0FF' }}>
        <div style={{ maxWidth: 1800, margin: '0 auto', padding: '0 16px' }}>

        {/* -- Banner -- */}
        <div style={{ paddingTop: 16, maxWidth: 1320, margin: '0 auto' }}>
          <div style={{ background: "#286ae4", border: '1px solid rgb(90, 43, 233)', borderRadius: 16, padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(167,169,250,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>📅</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 48, fontWeight: 600, color: '#F3F0FF', lineHeight: 1.1 }}>Social Calendar</div>
              <div style={{ fontSize: 18, color: '#ffffff', marginTop: 2 }}>
                {loading ? 'Loading...' : `Plan and schedule your content across every channel — ${totalScheduled} post${totalScheduled !== 1 ? 's' : ''} lined up for publishing`}
              </div>
            </div>
            <button onClick={() => router.push('/modules/social_media/dashboard')}
              style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid rgba(167,169,250,0.3)', background: 'rgb(200, 182, 253)', color: '#4f39a8', fontWeight: 600, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>Dashboard</button>
          </div>
        </div>

        {/* -- Toolbar (all buttons live here) -- */}
        <div style={{ padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 4 }}>
          {/* View toggles */}
          {VIEW_BTNS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              style={{ padding: '8px 16px', borderRadius: 9, border: `2px solid ${view === v.id ? '#7C3AED' : 'rgba(124,58,237,0.3)'}`, background: view === v.id ? '#7C3AED' : 'rgba(124,58,237,0.1)', color: view === v.id ? '#fff' : '#C4B5FD', fontWeight: 600, fontSize: 16, cursor: 'pointer', transition: 'all 0.15s' }}>
              {v.label}
            </button>
          ))}

          <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.12)', margin: '0 2px' }} />

          {/* Navigation */}
          <button onClick={() => navigate(-1)}
            style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(167,169,250,0.3)', background: 'rgba(255,255,255,0.05)', color: '#E9D5FF', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>←</button>
          <span style={{ fontWeight: 600, fontSize: 16, color: '#11b491', minWidth: 155, textAlign: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>{rangeLabel}</span>
          <button onClick={() => navigate(1)}
            style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(167,169,250,0.3)', background: 'rgba(255,255,255,0.05)', color: '#E9D5FF', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>→</button>
          <button onClick={() => setAnchor(new Date())}
            style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(236,72,153,0.4)', background: 'rgba(236,72,153,0.12)', color: '#F9A8D4', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>Today</button>
          <button onClick={loadBoard}
            style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.1)', color: '#6EE7B7', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>↺</button>

          <div style={{ flex: 1 }} />

          <button onClick={() => router.push('/modules/social_media/review')}
            style={{ padding: '8px 18px', borderRadius: 9, border: '1px solid rgb(28, 79, 124)', background: 'rgb(245, 247, 248)', color: '#1155a3', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>Review Posts</button>
        </div>

        {/* -- Calendar grid -- */}
        <div style={{ padding: '8px 16px 24px' }}>
          {notice && <div style={{ marginBottom: 12, padding: '10px 16px', borderRadius: 9, background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(167,169,250,0.4)', fontSize: 16, color: '#DDD6FE' }}>{notice}</div>}

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8 }}>
            {WEEKDAY.map((d, i) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 16, fontWeight: 600, color: '#fff', padding: '8px 0', letterSpacing: 1, textTransform: 'uppercase', background: DAY_BG[i], borderRadius: 8, border: `2px solid ${DAY_COLORS[i]}` }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {grid.map(day => {
              const key         = toDayKey(day);
              const isCurrMonth = view === 'month' ? day.getMonth() === anchor.getMonth() : true;
              const isToday     = key === todayKey;
              const posts       = grouped[key] || [];
              const hasPosts    = posts.length > 0;
              const count       = posts.length;
              const chipSize    = view === '90days' ? 32
                : view === 'month'
                  ? count >= 7 ? 24
                  : count >= 5 ? 28
                  : count >= 4 ? 40
                  : count >= 3 ? 52
                  : 66
                : 80;
              const showLabel   = chipSize > 44;
              const dow         = day.getDay();
              const cellBg      = DAY_BG[dow];
              const cellColor   = DAY_COLORS[dow];

              return (
                <div key={key}
                  onClick={() => openDayPanel(key, day)}
                  style={{
                    minHeight: cellMinH,
                    border: dragOver === key ? `3px dashed ${cellColor}` : isToday ? `3px solid ${cellColor}` : `2px solid ${cellColor}`,
                    borderRadius: 10,
                    background: dragOver === key ? `${cellColor}22` : isCurrMonth ? '#ffffff' : 'rgba(255,255,255,0.12)',
                    padding: '6px',
                    cursor: 'pointer',
                    boxShadow: isToday ? `0 0 16px ${cellColor}88` : 'none',
                    transition: 'background 0.1s, border 0.1s',
                  }}
                  onMouseEnter={e => { if (dragOver !== key) e.currentTarget.style.filter = 'brightness(0.96)'; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
                  onDragOver={e => { e.preventDefault(); setDragOver(key); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
                  onDrop={e => { e.preventDefault(); setDragOver(null); const pid = e.dataTransfer.getData('text/plain'); if (pid) dropPost(pid, day); }}
                >
                  {/* Day number – circle */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: isToday ? cellColor : 'rgba(0,0,0,0.08)',
                      border: isToday ? 'none' : `2px solid ${cellColor}55`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 600, color: isToday ? '#fff' : '#1e293b', lineHeight: 1 }}>{day.getDate()}</span>
                    </div>
                  </div>

                  {/* Post chips – side-by-side squares with platform colour */}
                  {hasPosts && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {posts.map(post => {
                        const meta    = pm(post.platform);
                        const timeStr = post.scheduledFor
                          ? new Date(post.scheduledFor).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })
                          : '';
                        return (
                          <div key={post.postId}
                            draggable
                            onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData('text/plain', post.postId); e.dataTransfer.effectAllowed = 'move'; }}
                            onClick={e => { e.stopPropagation(); openDayPanel(key, day); }}
                            style={{
                              width: chipSize,
                              borderRadius: 8,
                              overflow: 'hidden',
                              border: `2.5px solid ${meta.color}`,
                              background: meta.color,
                              cursor: 'grab',
                              boxShadow: `0 2px 8px ${meta.color}55`,
                              display: 'flex',
                              flexDirection: 'column',
                            }}>
                            {/* Square image */}
                            <div style={{ width: chipSize, height: chipSize, overflow: 'hidden', flexShrink: 0 }}>
                              {post.mediaUrl
                                ? <img src={post.mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                : <div style={{ width: '100%', height: '100%', background: `${meta.color}dd`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: chipSize * 0.4 }}>{meta.icon}</div>
                              }
                            </div>
                            {/* Platform label bar underneath */}
                            <div style={{ background: meta.color, padding: '3px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, flexShrink: 0 }}>
                              <span style={{ fontSize: showLabel ? 12 : 9, lineHeight: 1 }}>{meta.icon}</span>
                              {showLabel && (
                                <span style={{ fontSize: 16, fontWeight: 600, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{meta.label}</span>
                              )}
                              {timeStr && showLabel && (
                                <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', fontWeight: 600, marginLeft: 2, whiteSpace: 'nowrap' }}>{timeStr}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Empty hint */}
                  {!hasPosts && view !== '90days' && (
                    <div style={{ textAlign: 'center', marginTop: 10, fontSize: 16, color: cellColor }}>+ add</div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 16, color: '#6B7280' }}>
            <span style={{ color: '#A78BFA', fontWeight: 600 }}>{totalScheduled} scheduled</span>
            <span>·</span>
            <span>{cards.filter(c => !c.scheduledFor).length} unscheduled</span>
            <span style={{ marginLeft: 'auto' }}>Click any day to view or add posts</span>
          </div>
        </div>

        </div>
      </div>
    </>
  );
}
