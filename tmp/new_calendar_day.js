import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../utils/supabase-client';

const DAY_COLORS = ['#fda4af', '#fdba74', '#fde047', '#86efac', '#7dd3fc', '#a5b4fc', '#f0abfc'];
const DAY_BG     = ['#9f1239', '#9a3412', '#854d0e', '#166534', '#0c4a6e', '#3730a3', '#6b21a8'];

const PLATFORMS = {
  facebook:  { color: '#1877F2', label: 'Facebook' },
  instagram: { color: '#E1306C', label: 'Instagram' },
  linkedin:  { color: '#0A66C2', label: 'LinkedIn' },
  x:         { color: '#1d9bf0', label: 'X' },
  tiktok:    { color: '#ff0050', label: 'TikTok' },
  youtube:   { color: '#FF0000', label: 'YouTube' },
  pinterest: { color: '#E60023', label: 'Pinterest' },
};

const LOGO = {
  facebook:  (c) => <svg viewBox="0 0 24 24" width="28" height="28" fill={c}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  instagram: (c) => <svg viewBox="0 0 24 24" width="28" height="28" fill={c}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
  linkedin:  (c) => <svg viewBox="0 0 24 24" width="28" height="28" fill={c}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
  x:         (c) => <svg viewBox="0 0 24 24" width="28" height="28" fill={c}><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 7.184zm-1.161 19.52h2.04L6.29 3.24H4.11z"/></svg>,
  tiktok:    (c) => <svg viewBox="0 0 24 24" width="28" height="28" fill={c}><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>,
  youtube:   (c) => <svg viewBox="0 0 24 24" width="28" height="28" fill={c}><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>,
  pinterest: (c) => <svg viewBox="0 0 24 24" width="28" height="28" fill={c}><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>,
};

function plat(name) {
  return PLATFORMS[String(name || '').toLowerCase()] || { color: '#7c3aed', label: 'Post' };
}

function toDayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
}

function hourLabel(h) {
  if (h === 0)  return '12 am';
  if (h === 12) return '12 pm';
  return h > 12 ? `${h - 12} pm` : `${h} am`;
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function CalendarDay() {
  const router = useRouter();
  const { date: dateParam } = router.query;

  const [date, setDate]         = useState(null);
  const [posts, setPosts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [notice, setNotice]     = useState('');
  const [filterPlat, setFilter] = useState(null);
  const [modal, setModal]       = useState(null);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPub]    = useState(false);

  useEffect(() => {
    if (!dateParam) return;
    const parts = dateParam.split('-').map(Number);
    if (parts.length !== 3) return;
    const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    setDate(d);
    load(dateParam);
  }, [dateParam]);

  async function load(key) {
    setLoading(true); setNotice('');
    try {
      const token = await getToken();
      if (!token) { setNotice('Sign in to continue.'); setLoading(false); return; }
      const res  = await fetch('/api/social/calendar-board', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load');
      const day = (json.cards || [])
        .filter(c => c.scheduledFor && toDayKey(new Date(c.scheduledFor)) === key)
        .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
      setPosts(day);
    } catch (e) { setNotice(e.message); }
    finally { setLoading(false); }
  }

  function openModal(post) {
    const sched = post.scheduledFor ? new Date(post.scheduledFor) : null;
    const t = sched
      ? `${String(sched.getHours()).padStart(2, '0')}:${String(sched.getMinutes()).padStart(2, '0')}`
      : '';
    setModal({ post, content: post.content || '', time: t });
  }

  async function saveModal() {
    if (!modal) return;
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/social/update-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId: modal.post.postId, content: modal.content }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      let newIso = modal.post.scheduledFor;
      if (modal.time && modal.post.scheduledFor) {
        const d = new Date(modal.post.scheduledFor);
        const [h, m] = modal.time.split(':').map(Number);
        d.setHours(h, m, 0, 0);
        newIso = d.toISOString();
        await fetch('/api/social/calendar-board', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ postId: modal.post.postId, scheduledFor: newIso }),
        });
      }
      setPosts(prev => prev.map(p => p.postId === modal.post.postId ? { ...p, content: modal.content, scheduledFor: newIso } : p));
      setModal(null);
      setNotice('Saved.');
    } catch (e) { setNotice(e.message); }
    finally { setSaving(false); }
  }

  async function deletePost() {
    if (!modal || !confirm('Delete this post?')) return;
    setDeleting(true);
    try {
      const token = await getToken();
      const res  = await fetch(`/api/social/delete-post?id=${encodeURIComponent(modal.post.postId)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Delete failed');
      setPosts(prev => prev.filter(p => p.postId !== modal.post.postId));
      setModal(null);
    } catch (e) { setNotice(e.message); }
    finally { setDeleting(false); }
  }

  async function publishNow() {
    if (!modal || !confirm('Publish now?')) return;
    setPub(true);
    try {
      const token = await getToken();
      const res  = await fetch('/api/social/publish-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId: modal.post.postId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Publish failed');
      setPosts(prev => prev.map(p => p.postId === modal.post.postId ? { ...p, status: 'published' } : p));
      setModal(prev => ({ ...prev, post: { ...prev.post, status: 'published' } }));
      setNotice('Published!');
    } catch (e) { setNotice(e.message); }
    finally { setPub(false); }
  }

  if (!date) return null;

  const dow      = date.getDay();
  const accent   = DAY_COLORS[dow];
  const accentBg = DAY_BG[dow];
  const visible  = filterPlat ? posts.filter(p => p.platform === filterPlat) : posts;

  return (
    <>
      <Head>
        <title>{date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })} — Social Calendar</title>
      </Head>
      <div style={{ minHeight: '100vh', background: '#0c0420', fontFamily: 'system-ui, sans-serif', color: '#f3f0ff' }}>

        {/* Banner */}
        <div style={{ maxWidth: 1320, margin: '16px auto 0', padding: '20px 28px', background: '#1e1b4b', border: '2px solid #3730a3', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 40, fontWeight: 600, color: '#f3f0ff', lineHeight: 1 }}>Day View</h1>
            <p style={{ margin: '6px 0 0', fontSize: 18, color: '#ffffff', fontWeight: 400 }}>
              {date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => router.push('/modules/social_media/review')}
              style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#4c1d95', color: '#f3f0ff', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
              + Add Post
            </button>
            <button onClick={() => router.push('/modules/social_media/calendar')}
              style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#4c1d95', color: '#f3f0ff', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
              ← Calendar
            </button>
          </div>
        </div>

        {/* Date + Platform strip */}
        <div style={{ maxWidth: 1320, margin: '12px auto 0', padding: '18px 28px', background: accentBg, border: `2px solid ${accent}`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 26, fontWeight: 600, color: accentBg }}>{date.getDate()}</span>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: accent, textTransform: 'uppercase', letterSpacing: 2 }}>
              {date.toLocaleDateString('en-AU', { weekday: 'long' })}
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#f3f0ff' }}>
              {date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {Object.keys(PLATFORMS).map(name => {
              const p      = plat(name);
              const cnt    = posts.filter(x => x.platform === name).length;
              const active = filterPlat === name;
              const Icon   = LOGO[name];
              return (
                <button key={name}
                  onClick={() => cnt > 0 ? setFilter(active ? null : name) : null}
                  title={cnt > 0 ? `${p.label} (${cnt})` : p.label}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 12px', borderRadius: 12, border: `2px solid ${active ? p.color : cnt > 0 ? p.color : '#374151'}`, background: active ? p.color : cnt > 0 ? '#1e2a3a' : '#111827', cursor: cnt > 0 ? 'pointer' : 'default', outline: 'none', opacity: cnt === 0 ? 0.3 : 1, minWidth: 52 }}>
                  {Icon && Icon(active ? '#fff' : p.color)}
                  {cnt > 0 && <span style={{ fontSize: 16, fontWeight: 600, color: active ? '#fff' : p.color }}>{cnt}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeline */}
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '16px 20px 80px' }}>

          {notice && (
            <div style={{ marginBottom: 16, padding: '12px 18px', borderRadius: 10, background: '#1e1b4b', border: '1px solid #3730a3', fontSize: 16, color: '#f3f0ff' }}>
              {notice}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8', fontSize: 18 }}>Loading…</div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ fontSize: 22, color: '#94a3b8', marginBottom: 20 }}>No posts scheduled for this day.</div>
              <button onClick={() => router.push('/modules/social_media/review')}
                style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
                Schedule Posts →
              </button>
            </div>
          ) : (
            Array.from({ length: 24 }, (_, h) => h).map((hour, idx) => {
              const atHour  = visible.filter(p => p.scheduledFor && new Date(p.scheduledFor).getHours() === hour);
              const hasPost = atHour.length > 0;
              const rowBg   = idx % 2 === 0 ? '#0d1f35' : '#091525';
              return (
                <div key={hour} style={{ display: 'flex', borderTop: `2px solid ${hasPost ? accent : '#1e2a3a'}`, minHeight: 52, background: rowBg }}>
                  <div style={{ width: 110, flexShrink: 0, padding: '14px 14px 0', textAlign: 'right', borderRight: '2px solid #1e2a3a' }}>
                    <span style={{ fontSize: 18, fontWeight: 600, color: hasPost ? '#f3f0ff' : '#4a6080' }}>
                      {hourLabel(hour)}
                    </span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', gap: 16, flexWrap: 'wrap', padding: hasPost ? '10px 16px 20px' : '0 16px' }}>
                    {atHour.map(post => {
                      const p    = plat(post.platform);
                      const t    = post.scheduledFor ? fmtTime(post.scheduledFor) : '';
                      const Icon = LOGO[post.platform];
                      return (
                        <div key={post.postId} onClick={() => openModal(post)}
                          style={{ width: 220, flexShrink: 0, borderRadius: 12, overflow: 'hidden', background: '#fff', border: `3px solid ${p.color}`, cursor: 'pointer', transition: 'transform 0.12s' }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                          onMouseLeave={e => e.currentTarget.style.transform = ''}>
                          <div style={{ height: 140, background: '#f1f5f9', overflow: 'hidden', position: 'relative' }}>
                            {post.mediaUrl
                              ? <img src={post.mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.color + '18' }}>
                                  {Icon && <span style={{ transform: 'scale(2)', display: 'block' }}>{Icon(p.color)}</span>}
                                </div>
                            }
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: p.color, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{p.label}</span>
                              {t && <span style={{ marginLeft: 'auto', fontSize: 16, color: '#fff' }}>{t}</span>}
                            </div>
                          </div>
                          <div style={{ padding: '10px 12px 12px', background: '#fff' }}>
                            <p style={{ margin: '0 0 8px', fontSize: 16, color: '#1e293b', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {post.content || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No caption yet</span>}
                            </p>
                            <div style={{ textAlign: 'right', fontSize: 16, color: p.color, fontWeight: 600 }}>Edit →</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Edit Modal */}
        {modal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            onClick={e => e.target === e.currentTarget && setModal(null)}>
            <div style={{ background: '#1e1b4b', border: `2px solid ${plat(modal.post.platform).color}`, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              <div style={{ position: 'relative', flexShrink: 0, height: modal.post.mediaUrl ? 220 : 100, background: plat(modal.post.platform).color + '33', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {modal.post.mediaUrl
                  ? <img src={modal.post.mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : LOGO[modal.post.platform] && LOGO[modal.post.platform](plat(modal.post.platform).color)
                }
                <div style={{ position: 'absolute', top: 12, left: 12, background: '#000', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {LOGO[modal.post.platform] && LOGO[modal.post.platform](plat(modal.post.platform).color)}
                  <span style={{ fontSize: 16, fontWeight: 600, color: plat(modal.post.platform).color }}>{plat(modal.post.platform).label}</span>
                </div>
                <button onClick={() => setModal(null)}
                  style={{ position: 'absolute', top: 10, right: 10, background: '#000', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: 8, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {modal.post.scheduledFor && (
                  <div>
                    <label style={{ display: 'block', fontSize: 16, fontWeight: 600, color: '#a78bfa', marginBottom: 6 }}>Scheduled Time</label>
                    <input type="time" value={modal.time}
                      onChange={e => setModal(prev => ({ ...prev, time: e.target.value }))}
                      style={{ width: '100%', background: '#0f0628', border: '1px solid #4c1d95', borderRadius: 8, color: '#f3f0ff', padding: '10px 14px', fontSize: 16, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: 16, fontWeight: 600, color: '#a78bfa', marginBottom: 6 }}>Post Content</label>
                  <textarea value={modal.content}
                    onChange={e => setModal(prev => ({ ...prev, content: e.target.value }))}
                    rows={7}
                    style={{ width: '100%', background: '#0f0628', border: '1px solid #4c1d95', borderRadius: 8, color: '#f3f0ff', padding: '10px 14px', fontSize: 16, lineHeight: 1.6, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ padding: '16px 24px', borderTop: '1px solid #3730a3', display: 'flex', gap: 10, flexShrink: 0 }}>
                <button onClick={saveModal} disabled={saving}
                  style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: saving ? '#374151' : '#7c3aed', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                {modal.post.status !== 'published' && (
                  <button onClick={publishNow} disabled={publishing}
                    style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: publishing ? '#374151' : '#065f46', color: '#6ee7b7', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
                    {publishing ? 'Publishing…' : 'Publish Now'}
                  </button>
                )}
                <button onClick={deletePost} disabled={deleting}
                  style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: deleting ? '#374151' : '#7f1d1d', color: '#fca5a5', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
                  {deleting ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
