import Head from 'next/head';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import { supabase } from '../../../utils/supabase-client';

const PLATFORM_OPTIONS = [
  { key: 'facebook',  label: 'Facebook',   icon: '📘' },
  { key: 'instagram', label: 'Instagram',  icon: '📷' },
  { key: 'linkedin',  label: 'LinkedIn',   icon: '💼' },
  { key: 'tiktok',   label: 'TikTok',     icon: '🎵' },
  { key: 'youtube',  label: 'YouTube',    icon: '▶️' },
  { key: 'pinterest',label: 'Pinterest',  icon: '📌' },
];

const PLATFORM_META = {
  facebook:  { icon: '📘', color: '#1877F2', label: 'Facebook' },
  instagram: { icon: '📷', color: '#E1606C', label: 'Instagram' },
  linkedin:  { icon: '💼', color: '#0A66C2', label: 'LinkedIn' },
  tiktok:    { icon: '🎵', color: '#ff0050', label: 'TikTok' },
  youtube:   { icon: '▶️', color: '#FF0000', label: 'YouTube' },
  pinterest: { icon: '📌', color: '#E60023', label: 'Pinterest' },
};
const DEFAULT_META = { icon: '🌐', color: '#7C3AED', label: 'Post' };

function pm(platform) {
  return PLATFORM_META[String(platform || '').toLowerCase()] || DEFAULT_META;
}

function clamp(value, min, max) {
  const n = Number(value);
  return Number.isNaN(n) ? min : Math.min(max, Math.max(min, n));
}

function buildBulkScheduleQueue(posts, start, scheduleMode, secondTime) {
  const grouped = new Map();
  for (const post of posts || []) {
    const platform = String(post.platform || '').toLowerCase();
    if (!grouped.has(platform)) grouped.set(platform, []);
    grouped.get(platform).push(post);
  }

  const parseTime = (value, fallbackDate) => {
    const [hh, mm] = String(value || '').split(':');
    return {
      hours: clamp(parseInt(hh, 10), 0, 23),
      minutes: clamp(parseInt(mm, 10), 0, 59),
      fallbackHours: fallbackDate.getHours(),
      fallbackMinutes: fallbackDate.getMinutes(),
    };
  };

  const secondSlot = secondTime
    ? parseTime(secondTime, start)
    : { hours: clamp(start.getHours() + 12, 0, 23), minutes: start.getMinutes() };

  const scheduled = [];
  for (const [platform, platformPosts] of grouped.entries()) {
    platformPosts.forEach((post, index) => {
      const scheduledFor = new Date(start);
      if (scheduleMode === 'daily') {
        scheduledFor.setDate(start.getDate() + index);
        scheduledFor.setHours(start.getHours(), start.getMinutes(), 0, 0);
      } else {
        const dayOffset = Math.floor(index / 2);
        const slotOffset = index % 2;
        scheduledFor.setDate(start.getDate() + dayOffset);
        if (slotOffset === 0) {
          scheduledFor.setHours(start.getHours(), start.getMinutes(), 0, 0);
        } else {
          scheduledFor.setHours(secondSlot.hours, secondSlot.minutes, 0, 0);
        }
      }
      scheduled.push({ post, platform, scheduledFor });
    });
  }

  scheduled.sort((a, b) => {
    const timeDiff = a.scheduledFor.getTime() - b.scheduledFor.getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.platform.localeCompare(b.platform);
  });

  return scheduled;
}

function StatusBadge({ status }) {
  const map = {
    draft:     { bg: 'rgba(75,85,99,0.4)',    color: '#9CA3AF', label: 'Draft' },
    scheduled: { bg: 'rgba(37,99,235,0.25)',  color: '#93C5FD', label: 'Scheduled' },
    published: { bg: 'rgba(5,160,105,0.25)',  color: '#6EE7B7', label: 'Published' },
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

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
}

const S = {
  page:       { minHeight: '100vh', background: '#1f0420', padding: '0', fontFamily: 'system-ui,sans-serif', color: '#F3F0FF' },
  inner:      { padding: '24px 20px 24px', maxWidth: '100%' },
  banner:     { maxWidth: 1620, margin: '16px auto 0', background: 'rgba(194, 7, 169, 0.99)', border: '1px solid rgba(167,169,250,0.2)', borderRadius: 16, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 },
  bannerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  bannerRight:{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, maxWidth: '100%' },
  bannerIcon: { width: 48, height: 48, borderRadius: 16, background: 'rgb(166, 44, 248)', border: '1px solid rgba(167,169,250,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 },
  bannerTitle:{ fontSize: 48, fontWeight: 600, color: '#F3F0FF', margin: 0 },
  bannerSub:  { fontSize: 18, color: '#ffffff', marginTop: 2 },
  bannerNav:  { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', position: 'relative', zIndex: 2 },
  bannerBtn:  { padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(164,58,237,0.4)', background: 'rgb(240, 233, 233)', color: '#4c32b3', fontWeight: 600, fontSize: 16, cursor: 'pointer', whiteSpace: 'nowrap', position: 'relative', zIndex: 2 },
  bannerFilters:{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', position: 'relative', zIndex: 1, maxWidth: '100%' },
  notice:     { marginBottom: 16, padding: '10px 16px', borderRadius: 10, background: 'rgba(164,58,237,0.2)', border: '1px solid rgba(167,169,250,0.4)', fontSize: 16, color: '#2f1c86' },
  createBox:  { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(167,169,250,0.25)', borderRadius: 16, padding: '18px 20px', marginBottom: 20 },
  createTitle:{ fontSize: 16, fontWeight: 600, color: '#E9D5FF', marginBottom: 16 },
  ta:         { width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(167,169,250,0.3)', borderRadius: 8, color: '#F3F0FF', padding: '10px 16px', fontSize: 16, lineHeight: 1.6, resize: 'vertical', minHeight: 80, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' },
  input:      { background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(167,169,250,0.25)', borderRadius: 8, color: '#F3F0FF', padding: '8px 16px', fontSize: 16, outline: 'none', fontFamily: 'inherit' },
  tabs:       { display: 'flex', gap: 7, marginBottom: 18, flexWrap: 'wrap' },
  tab: (a) => ({ padding: '6px 16px', borderRadius: 8, border: a ? '1px solid rgba(167,169,250,0.5)' : '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', fontWeight: 600, fontSize: 16, background: a ? 'rgba(164,58,237,0.45)' : 'rgba(255,255,255,0.04)', color: a ? '#F3F0FF' : '#9CA3AF', transition: 'all 0.16s' }),
  card:       { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '16px 18px', marginBottom: 16, borderLeftWidth: 3, borderLeftStyle: 'solid' },
  cardTop:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  cardTa:     { width: '100%', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(167,169,250,0.3)', borderRadius: 8, color: '#F3F0FF', padding: '10px 16px', fontSize: 16, lineHeight: 1.6, resize: 'vertical', minHeight: 80, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' },
  actions:    { display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' },
  empty:      { textAlign: 'center', padding: '50px 20px', color: '#6B7280', fontSize: 16 },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 16, marginBottom: 24 },
  footer:     { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
};

const btn = {
  save:     { padding: '6px 16px', borderRadius: 8, border: 'none', background: 'rgba(164,58,237,0.5)', color: '#F3F0FF', fontWeight: 600, fontSize: 16, cursor: 'pointer' },
  cancel:   { padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#9CA3AF', fontWeight: 600, fontSize: 16, cursor: 'pointer' },
  delete:   { padding: '6px 16px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.18)', color: '#FCA5A5', fontWeight: 600, fontSize: 16, cursor: 'pointer', marginLeft: 'auto' },
  publish:  { padding: '6px 16px', borderRadius: 8, border: 'none', background: 'rgba(5,160,105,0.28)', color: '#6EE7B7', fontWeight: 600, fontSize: 16, cursor: 'pointer' },
  schedule: { padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(37,99,235,0.5)', background: 'rgba(37,99,235,0.16)', color: '#93C5FD', fontWeight: 600, fontSize: 16, cursor: 'pointer' },
  edit:     { padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#E9D5FF', fontWeight: 600, fontSize: 16, cursor: 'pointer' },
  primary:  { padding: '9px 20px', borderRadius: 9, border: 'none', background: 'linear-gradient(90deg,#7C3AED,#6D28D9)', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer' },
  navPill:  { padding: '10px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(90deg,#7C3AED,#EC4899)', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer', boxShadow: '0 3px 16px rgba(164,58,237,0.35)' },
};

// ── Crop helpers ──────────────────────────────────────────────────
function imgDataUrl(image, crop) {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth  / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width  = Math.round(crop.width  * scaleX);
  canvas.height = Math.round(crop.height * scaleY);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    image,
    crop.x * scaleX, crop.y * scaleY,
    crop.width * scaleX, crop.height * scaleY,
    0, 0, canvas.width, canvas.height,
  );
  return canvas.toDataURL('image/jpeg', 0.92);
}

export default function ReviewPosts() {
  const router = useRouter();
  const [posts, setPosts]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState({});
  const [saving, setSaving]         = useState('');
  const [deleting, setDeleting]     = useState('');
  const [publishing, setPublishing] = useState('');
  const [notice, setNotice]         = useState('');
  const [filter, setFilter]         = useState('all');
  const [platFilter, setPlatFilter] = useState('all');
  const [selected, setSelected]     = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkScheduling, setBulkScheduling] = useState(false);
  const [bulkRescheduling, setBulkRescheduling] = useState(false);
  const [bulkRescheduleStartDate, setBulkRescheduleStartDate] = useState('');
  const [bulkRescheduleTime, setBulkRescheduleTime] = useState('09:00');
  const [bulkRescheduleSecondTime, setBulkRescheduleSecondTime] = useState('21:00');
  const [bulkRescheduleMode, setBulkRescheduleMode] = useState('daily');
  const [postSchedule, setPostSchedule] = useState({}); // { [postId]: { date, time } }

  // Image picker state
  const [picker, setPicker]         = useState(null); // { postId } or null
  const [pickerTab, setPickerTab]   = useState('upload'); // 'upload' | 'library'
  const [library, setLibrary]       = useState([]);
  const [libLoading, setLibLoading] = useState(false);
  const fileInputRef                = useRef();

  // Crop state
  const [cropSrc, setCropSrc]       = useState(null);  // data URL or https URL
  const [cropPostId, setCropPostId] = useState(null);
  const [crop, setCrop]             = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [applyingCrop, setApplyingCrop]   = useState(false);
  const cropImgRef                  = useRef(null);

  // ── Image picker helpers ────────────────────────────────────────
  function openPicker(postId) {
    setPicker({ postId });
    setPickerTab('upload');
  }
  function closePicker() {
    setPicker(null);
    setCropSrc(null);
    setCropPostId(null);
  }

  async function loadLibrary() {
    setLibLoading(true);
    try {
      const token = await getToken();
      const res   = await fetch('/api/social/list-images', { headers: { Authorization: `Bearer ${token}` } });
      const json  = await res.json();
      if (json.ok) setLibrary(json.images || []);
    } catch {}
    finally { setLibLoading(false); }
  }

  // When library tab is opened, load images
  useEffect(() => {
    if (picker && pickerTab === 'library') loadLibrary();
  }, [picker, pickerTab]);

  // File selected from Upload tab → straight into crop
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => startCrop(picker.postId, ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // Image chosen from library → straight into crop
  function handleLibrarySelect(url) {
    startCrop(picker.postId, url);
  }

  function startCrop(postId, src) {
    setCropSrc(src);
    setCropPostId(postId);
    setCrop(undefined);
    setCompletedCrop(null);
    setPicker(null); // close picker, crop modal takes over
  }

  function onCropImageLoad(e) {
    const { width, height } = e.currentTarget;
    const initial = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, 4 / 3, width, height),
      width, height,
    );
    setCrop(initial);
  }

  async function applyCrop() {
    if (!completedCrop || !cropImgRef.current) return;
    setApplyingCrop(true);
    try {
      const dataUrl = imgDataUrl(cropImgRef.current, completedCrop);
      const token   = await getToken();
      // Upload cropped image to storage
      const uploadRes  = await fetch('/api/social/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageUrl: dataUrl, description: 'Cropped post image' }),
      });
      const uploadJson = await uploadRes.json();
      if (!uploadJson.ok) throw new Error(uploadJson.error || 'Upload failed');
      const mediaUrl = uploadJson.image.url;
      // Save to post
      const patchRes  = await fetch('/api/social/update-post', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId: cropPostId, mediaUrl }),
      });
      const patchJson = await patchRes.json();
      if (!patchJson.ok) throw new Error(patchJson.error || 'Save failed');
      setPosts(prev => prev.map(p => p.postId === cropPostId ? { ...p, mediaUrl } : p));
      setNotice('Image updated.');
      setCropSrc(null); setCropPostId(null);
    } catch (err) { setNotice(err.message); }
    finally { setApplyingCrop(false); }
  }

  // Skip crop — use image as-is (for library images, upload to storage if needed)
  async function useImageDirect() {
    setApplyingCrop(true);
    try {
      const token = await getToken();
      let mediaUrl = cropSrc;
      if (cropSrc.startsWith('data:')) {
        const uploadRes  = await fetch('/api/social/save-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ imageUrl: cropSrc, description: 'Post image' }),
        });
        const uploadJson = await uploadRes.json();
        if (!uploadJson.ok) throw new Error(uploadJson.error || 'Upload failed');
        mediaUrl = uploadJson.image.url;
      }
      const patchRes  = await fetch('/api/social/update-post', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId: cropPostId, mediaUrl }),
      });
      const patchJson = await patchRes.json();
      if (!patchJson.ok) throw new Error(patchJson.error || 'Save failed');
      setPosts(prev => prev.map(p => p.postId === cropPostId ? { ...p, mediaUrl } : p));
      setNotice('Image updated.');
      setCropSrc(null); setCropPostId(null);
    } catch (err) { setNotice(err.message); }
    finally { setApplyingCrop(false); }
  }

  // Remove image from post
  async function removeImage(postId) {
    try {
      const token = await getToken();
      await fetch('/api/social/update-post', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId, mediaUrl: null }),
      });
      setPosts(prev => prev.map(p => p.postId === postId ? { ...p, mediaUrl: null } : p));
    } catch {}
  }

  // Manual create form
  const [showCreate, setShowCreate] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newPlatform, setNewPlatform] = useState('facebook');
  const [creating, setCreating]     = useState(false);

  useEffect(() => { loadPosts(); }, []);

  async function advanceDuePosts() {
    try {
      await fetch('/api/social/process-schedule', { method: 'POST' });
      await fetch('/api/social/process-queue', { method: 'POST' });
    } catch {}
  }

  async function loadPosts() {
    setLoading(true); setNotice('');
    try {
      const token = await getToken();
      if (!token) { setNotice('Sign in to view posts.'); setLoading(false); return; }
      await advanceDuePosts();
      const res  = await fetch('/api/social/calendar-board', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load posts');
      setPosts(json.cards || []);
    } catch (err) { setNotice(err.message); }
    finally { setLoading(false); }
  }

  async function createPost() {
    if (!newContent.trim()) { setNotice('Enter some content first.'); return; }
    setCreating(true); setNotice('');
    try {
      const token = await getToken();
      const res = await fetch('/api/social/create-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: newContent.trim(), platform: newPlatform, mediaUrl: null, scheduledFor: null }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Save failed');
      setNewContent('');
      setShowCreate(false);
      setNotice('Post created as draft.');
      await loadPosts();
    } catch (err) { setNotice(err.message); }
    finally { setCreating(false); }
  }

  async function saveEdit(postId) {
    const content = editing[postId];
    if (content === undefined) return;
    setSaving(postId);
    try {
      const token = await getToken();
      const res  = await fetch('/api/social/update-post', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId, content }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Save failed');
      setPosts(prev => prev.map(p => p.postId === postId ? { ...p, content } : p));
      setEditing(prev => { const n = { ...prev }; delete n[postId]; return n; });
      setNotice('Post updated.');
    } catch (err) { setNotice(err.message); }
    finally { setSaving(''); }
  }

  async function deletePost(postId) {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setDeleting(postId);
    try {
      const token = await getToken();
      const res  = await fetch(`/api/social/delete-post?id=${encodeURIComponent(postId)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Delete failed');
      setPosts(prev => prev.filter(p => p.postId !== postId));
      setNotice('Post deleted.');
    } catch (err) { setNotice(err.message); }
    finally { setDeleting(''); }
  }

  function toggleSelect(postId) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(postId) ? n.delete(postId) : n.add(postId);
      return n;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(p => p.postId)));
    }
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} post${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true); setNotice('');
    const token = await getToken();
    const ids = [...selected];
    let failed = 0;
    for (const postId of ids) {
      try {
        const res  = await fetch(`/api/social/delete-post?id=${encodeURIComponent(postId)}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!json.ok) failed++;
        else setPosts(prev => prev.filter(p => p.postId !== postId));
      } catch { failed++; }
    }
    setSelected(new Set());
    setBulkDeleting(false);
    setNotice(failed > 0 ? `Deleted ${ids.length - failed}, ${failed} failed.` : `Deleted ${ids.length} post${ids.length > 1 ? 's' : ''}.`);
  }

  async function bulkSchedule() {
    if (selected.size === 0) return;
    const token = await getToken();
    const ids = [...selected];
    const toSchedule = ids.map(postId => {
      const pd = postSchedule[postId];
      if (pd?.date && pd?.time) return { postId, date: pd.date, time: pd.time };
      const existing = posts.find(p => p.postId === postId);
      if (existing?.scheduledFor) {
        const d = new Date(existing.scheduledFor);
        return {
          postId,
          date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
          time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
        };
      }
      return null;
    }).filter(Boolean);

    const noDate = ids.length - toSchedule.length;
    if (toSchedule.length === 0) { setNotice('Set a date and time on each selected post first.'); return; }

    setBulkScheduling(true); setNotice('');
    const scheduledIds = [];
    let failed = 0;
    for (const { postId, date, time } of toSchedule) {
      try {
        const iso = new Date(`${date}T${time}:00`).toISOString();
        const res = await fetch('/api/social/calendar-board', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ postId, scheduledFor: iso }),
        });
        const json = await res.json();
        if (json.ok) {
          scheduledIds.push(postId);
        } else { failed++; }
      } catch { failed++; }
    }

    // Remove successfully scheduled posts from the list immediately
    if (scheduledIds.length > 0) {
      setPosts(prev => prev.filter(p => !scheduledIds.includes(p.postId)));
    }
    setSelected(new Set());
    setBulkScheduling(false);

    if (failed === 0 && noDate === 0) {
      // All good — go straight to calendar
      router.push('/modules/social_media/calendar');
    } else {
      const msg = [`Scheduled ${scheduledIds.length} post${scheduledIds.length !== 1 ? 's' : ''} to calendar.`];
      if (failed) msg.push(`${failed} failed.`);
      if (noDate) msg.push(`${noDate} skipped (no date set).`);
      setNotice(msg.join(' '));
    }
  }

  async function bulkReschedule(targetPosts = null) {
    const postsToReschedule = Array.isArray(targetPosts)
      ? targetPosts
      : posts.filter(post => selected.has(post.postId));
    if (!postsToReschedule.length) return;
    if (!bulkRescheduleStartDate || !bulkRescheduleTime) {
      setNotice('Set a start date and time for bulk reschedule first.');
      return;
    }

    const start = new Date(bulkRescheduleStartDate);
    const startYear = start.getFullYear();
    if (Number.isNaN(start.getTime()) || startYear < 2024 || startYear > 2035) {
      setNotice(`Invalid start date (year ${startYear}). Please re-enter the date.`);
      return;
    }

    const [hh, mm] = String(bulkRescheduleTime || '09:00').split(':');
    start.setHours(clamp(parseInt(hh, 10), 0, 23), clamp(parseInt(mm, 10), 0, 59), 0, 0);

    const queue = buildBulkScheduleQueue(postsToReschedule, start, bulkRescheduleMode, bulkRescheduleSecondTime);
    const token = await getToken();
    setBulkRescheduling(true);
    setNotice('');

    let ok = 0;
    let failed = 0;
    const updatedTimes = new Map();

    for (const item of queue) {
      try {
        const iso = item.scheduledFor.toISOString();
        const res = await fetch('/api/social/calendar-board', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ postId: item.post.postId, scheduledFor: iso }),
        });
        const json = await res.json();
        if (!json.ok) {
          failed++;
          continue;
        }
        ok++;
        updatedTimes.set(item.post.postId, iso);
      } catch {
        failed++;
      }
    }

    if (updatedTimes.size > 0) {
      setPosts(prev => prev.map(post => updatedTimes.has(post.postId)
        ? { ...post, scheduledFor: updatedTimes.get(post.postId), status: 'scheduled' }
        : post));
      setPostSchedule(prev => {
        const next = { ...prev };
        for (const postId of updatedTimes.keys()) delete next[postId];
        return next;
      });
    }

    setSelected(new Set());
    setBulkRescheduling(false);
    setNotice(failed > 0
      ? `Rescheduled ${ok} post${ok !== 1 ? 's' : ''}, ${failed} failed.`
      : `Rescheduled ${ok} post${ok !== 1 ? 's' : ''}.`);
  }

  async function schedulePost(postId, date, time) {
    if (!date || !time) { setNotice('Please set both a date and time.'); return; }
    try {
      const token = await getToken();
      const iso = new Date(`${date}T${time}:00`).toISOString();
      const res  = await fetch('/api/social/calendar-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId, scheduledFor: iso }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setPosts(prev => prev.map(p => p.postId === postId ? { ...p, scheduledFor: iso, status: 'scheduled' } : p));
      setPostSchedule(prev => { const n = { ...prev }; delete n[postId]; return n; });
      setNotice('Scheduled ✔');
    } catch (err) { setNotice(err.message); }
  }

  async function goToCalendar() {
    // Save any unsaved per-card schedules first, then navigate
    const token = await getToken();
    if (token) {
      const toSave = Object.entries(postSchedule).filter(([, v]) => v.date && v.time);
      await Promise.all(toSave.map(async ([postId, { date, time }]) => {
        try {
          const iso = new Date(`${date}T${time}:00`).toISOString();
          const res = await fetch('/api/social/calendar-board', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ postId, scheduledFor: iso }),
          });
          const json = await res.json();
          if (json.ok) setPosts(prev => prev.map(p => p.postId === postId ? { ...p, scheduledFor: iso, status: 'scheduled' } : p));
        } catch {}
      }));
    }
    router.push('/modules/social_media/calendar');
  }

  async function publishNow(postId) {
    if (!confirm('Publish this post immediately to the connected platform?')) return;
    setPublishing(postId); setNotice('');
    try {
      const token = await getToken();
      const res  = await fetch('/api/social/publish-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Publish failed');
      setPosts(prev => prev.map(p => p.postId === postId ? { ...p, status: 'published' } : p));
      setNotice('Post published.');
    } catch (err) { setNotice(err.message); }
    finally { setPublishing(''); }
  }

  const PUBLISHED_STATUSES = new Set(['published', 'posted']);
  const SCHEDULED_STATUSES = new Set(['scheduled', 'queued']);
  const activePosts    = posts.filter(p => !PUBLISHED_STATUSES.has(p.status));
  const counts = { all: activePosts.length, draft: 0, scheduled: 0, published: 0, failed: 0 };
  posts.forEach(p => {
    if (SCHEDULED_STATUSES.has(p.status)) counts.scheduled++;
    else if (PUBLISHED_STATUSES.has(p.status)) counts.published++;
    else if (p.status in counts) counts[p.status]++;
  });
  const statusFiltered = filter === 'all'       ? activePosts
    : filter === 'scheduled' ? posts.filter(p => SCHEDULED_STATUSES.has(p.status))
    : filter === 'published' ? posts.filter(p => PUBLISHED_STATUSES.has(p.status))
    : posts.filter(p => p.status === filter);
  const filtered = platFilter === 'all' ? statusFiltered : statusFiltered.filter(p => p.platform === platFilter);

  const TABS = [
    { key: 'all',       label: `Active (${counts.all})` },
    { key: 'draft',     label: `Drafts (${counts.draft})` },
    { key: 'scheduled', label: `Scheduled (${counts.scheduled})` },
    { key: 'published', label: `Published (${counts.published})` },
    { key: 'failed',    label: `Failed (${counts.failed})` },
  ];

  return (
    <>
      <Head><title>Review Posts — Social Media</title></Head>
      <div style={S.page}>

        {/* Module banner */}
        <div style={S.banner}>
          <div style={S.bannerLeft}>
            <div style={S.bannerIcon}>✏️</div>
            <div>
              <div style={S.bannerTitle}>Review &amp; Edit Posts</div>
              <div style={S.bannerSub}>Edit, approve, publish or schedule your posts</div>
            </div>
          </div>
          <div style={S.bannerRight}>
            <div style={S.bannerNav}>
              <button type="button" style={S.bannerBtn} onClick={() => router.push('/modules/social_media/create')}>+ Create Posts</button>
              <button type="button" style={S.bannerBtn} onClick={() => router.push('/modules/social_media/images')}>🖼️ Image Library</button>
              <button type="button" style={S.bannerBtn} onClick={goToCalendar}>📅 Calendar</button>
              <button type="button" style={S.bannerBtn} onClick={() => router.push('/modules/social_media/dashboard')}>Back to Dashboard</button>
            </div>
            {/* Platform filter chips */}
            <div style={S.bannerFilters}>
              <span style={{ fontSize: 16, color: '#ffffff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 2 }}>Filter:</span>
              <button onClick={() => setPlatFilter('all')}
                style={{ padding: '5px 16px', borderRadius: 20, border: platFilter === 'all' ? '2px solid #A78BFA' : '1px solid rgba(167,169,250,0.25)', background: platFilter === 'all' ? 'rgba(164,58,237,0.45)' : 'rgba(255,255,255,0.04)', color: platFilter === 'all' ? '#F3F0FF' : '#9CA3AF', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
                All
              </button>
              {PLATFORM_OPTIONS.map(p => {
                const meta   = PLATFORM_META[p.key] || {};
                const active = platFilter === p.key;
                const count  = activePosts.filter(post => post.platform === p.key).length;
                if (count === 0) return null;
                return (
                  <button key={p.key} onClick={() => setPlatFilter(active ? 'all' : p.key)}
                    style={{ padding: '5px 11px', borderRadius: 20, border: active ? `2px solid ${meta.color}` : `1px solid ${meta.color}44`, background: active ? `${meta.color}33` : 'rgba(255,255,255,0.04)', color: active ? '#fff' : '#9CA3AF', fontWeight: 600, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 16 }}>{p.icon}</span>
                    <span style={{ color: active ? meta.color : '#9CA3AF' }}>{p.label}</span>
                    <span style={{ background: active ? meta.color : 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 10, fontWeight: 600, borderRadius: 10, padding: '0 5px', marginLeft: 1 }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={S.inner}>

          {/* Notice */}
          {notice && <div style={S.notice}>{notice}</div>}

          {/* Manual create form */}
          <div style={S.createBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showCreate ? 16 : 0 }}>
              <span style={S.createTitle}>✍️ Write a Post Manually</span>
              <button style={{ ...btn.edit, fontSize: 20 }} onClick={() => setShowCreate(v => !v)}>
                {showCreate ? '▲ Hide' : '▼ Create'}
              </button>
            </div>
            {showCreate && (
              <div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <select value={newPlatform} onChange={e => setNewPlatform(e.target.value)}
                    style={{ ...S.input, minWidth: 160 }}>
                    {PLATFORM_OPTIONS.map(p => (
                      <option key={p.key} value={p.key}>{p.icon} {p.label}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  style={{ ...S.ta, marginBottom: 10 }}
                  placeholder="Write your post content here…"
                  value={newContent}
                  rows={4}
                  onChange={e => setNewContent(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btn.primary} disabled={creating} onClick={createPost}>
                    {creating ? 'Saving…' : '💾 Save as Draft'}
                  </button>
                  <button style={btn.cancel} onClick={() => { setShowCreate(false); setNewContent(''); }}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Filter tabs + select all + bulk actions */}
          <div style={{ ...S.tabs, alignItems: 'center' }}>
            {TABS.map(t => (
              <button key={t.key} style={S.tab(filter === t.key)} onClick={() => { setFilter(t.key); setSelected(new Set()); }}>
                {t.label}
              </button>
            ))}
            <div style={{ display: 'flex', gap: 7, marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
              {selected.size > 0 && (
                <>
                  <input
                    type="date"
                    value={bulkRescheduleStartDate}
                    onChange={e => setBulkRescheduleStartDate(e.target.value)}
                    style={{ ...S.input, width: 'auto', fontSize: 16, padding: '6px 10px' }}
                  />
                  <input
                    type="time"
                    value={bulkRescheduleTime}
                    onChange={e => setBulkRescheduleTime(e.target.value)}
                    style={{ ...S.input, width: 'auto', fontSize: 16, padding: '6px 10px' }}
                  />
                  {bulkRescheduleMode === 'twice' && (
                    <input
                      type="time"
                      value={bulkRescheduleSecondTime}
                      onChange={e => setBulkRescheduleSecondTime(e.target.value)}
                      style={{ ...S.input, width: 'auto', fontSize: 16, padding: '6px 10px' }}
                    />
                  )}
                  <select
                    value={bulkRescheduleMode}
                    onChange={e => setBulkRescheduleMode(e.target.value)}
                    style={{ ...S.input, width: 'auto', fontSize: 16, padding: '6px 10px' }}
                  >
                    <option value="daily">1 post per day</option>
                    <option value="twice">2 posts per day</option>
                  </select>
                </>
              )}
              {filtered.length > 0 && (
                <button onClick={toggleSelectAll}
                  style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(167,169,250,0.35)', background: selected.size === filtered.length ? 'rgba(164,58,237,0.4)' : 'rgba(255,255,255,0.04)', color: selected.size === filtered.length ? '#F3F0FF' : '#A78BFA', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
                  {selected.size === filtered.length && filtered.length > 0 ? '☑ Deselect All' : '☐ Select All'}
                </button>
              )}
              {selected.size > 0 && (
                <>
                  <button onClick={bulkReschedule} disabled={bulkRescheduling}
                    style={{ padding: '6px 18px', borderRadius: 8, border: 'none', background: bulkRescheduling ? 'rgba(5,150,105,0.25)' : 'linear-gradient(90deg,#059669,#2563EB)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: bulkRescheduling ? 'default' : 'pointer', boxShadow: '0 2px 10px rgba(37,99,235,0.3)' }}>
                    {bulkRescheduling ? 'Rescheduling…' : `⟳ Reschedule (${selected.size})`}
                  </button>
                  <button onClick={bulkSchedule} disabled={bulkScheduling}
                    style={{ padding: '6px 18px', borderRadius: 8, border: 'none', background: bulkScheduling ? 'rgba(37,99,235,0.25)' : 'linear-gradient(90deg,#7C3AED,#2563EB)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: bulkScheduling ? 'default' : 'pointer', boxShadow: '0 2px 10px rgba(124,58,237,0.3)' }}>
                    {bulkScheduling ? 'Scheduling…' : `📅 Schedule to Calendar (${selected.size})`}
                  </button>
                  <button onClick={bulkDelete} disabled={bulkDeleting}
                    style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.22)', color: '#FCA5A5', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
                    {bulkDeleting ? 'Deleting…' : `🗑 Delete (${selected.size})`}
                  </button>
                </>
              )}
              {selected.size === 0 && filtered.length > 0 && (
                <button onClick={() => bulkReschedule(filtered)} disabled={bulkRescheduling}
                  style={{ padding: '6px 18px', borderRadius: 8, border: 'none', background: bulkRescheduling ? 'rgba(5,150,105,0.25)' : 'linear-gradient(90deg,#059669,#2563EB)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: bulkRescheduling ? 'default' : 'pointer', boxShadow: '0 2px 10px rgba(37,99,235,0.3)' }}>
                  {bulkRescheduling ? 'Rescheduling…' : `⟳ Reschedule Filtered (${filtered.length})`}
                </button>
              )}
              <button style={{ ...S.tab(false) }} onClick={loadPosts}>↻ Refresh</button>
            </div>
          </div>

          {/* Post list */}
          {loading ? (
            <div style={S.empty}>Loading posts…</div>
          ) : filtered.length === 0 ? (
            <div style={S.empty}>
              {filter === 'all' ? 'No posts yet.' : `No ${filter} posts.`}
              {filter === 'all' && (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
                  <button onClick={() => setShowCreate(true)} style={btn.primary}>✍️ Write Manually</button>
                  <button onClick={() => router.push('/modules/social_media/create')}
                    style={{ ...btn.primary, background: 'rgba(164,58,237,0.4)' }}>
                    🤖 Generate with AI
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={S.grid}>
            {filtered.map(post => {
            const meta       = pm(post.platform);
            const isSaving   = saving     === post.postId;
            const isDeleting = deleting   === post.postId;
            const isPub      = publishing === post.postId;
            const editVal    = editing[post.postId] !== undefined ? editing[post.postId] : post.content;
            // Always keep editing state in sync
            if (editing[post.postId] === undefined) {
              // initialise lazily on first render via effect — use a stable key instead
            }
            const scheduledLabel = post.scheduledFor
              ? new Date(post.scheduledFor).toLocaleString('en-AU', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : null;

            const isSelected = selected.has(post.postId);

            return (
              <div key={post.postId} style={{ background: isSelected ? 'rgba(164,58,237,0.08)' : 'rgba(255,255,255,0.03)', border: isSelected ? '1px solid rgba(164,58,237,0.55)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderTopWidth: 3, borderTopStyle: 'solid', borderTopColor: meta.color, position: 'relative' }}>
                {/* Checkbox — top left */}
                <div onClick={() => toggleSelect(post.postId)}
                  style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, width: 22, height: 22, borderRadius: 6, border: isSelected ? '2px solid #7C3AED' : '2px solid rgba(167,169,250,0.45)', background: isSelected ? '#7C3AED' : 'rgba(0,0,0,0.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isSelected && <span style={{ color: '#fff', fontSize: 16, lineHeight: 1 }}>✓</span>}
                </div>
                {/* Image — click to change */}
                {post.mediaUrl ? (
                  <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => openPicker(post.postId)}>
                    <img src={post.mediaUrl} alt="Post image" style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.45)'; e.currentTarget.style.opacity = 1; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0)'; e.currentTarget.style.opacity = 0; }}>
                      <span style={{ color: '#fff', fontWeight: 600, fontSize: 16, background: 'rgba(0,0,0,0.55)', padding: '4px 16px', borderRadius: 8 }}>🖼 Change Image</span>
                    </div>
                    <button onClick={e => { e.stopPropagation(); removeImage(post.postId); }}
                      style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 16, padding: '2px 7px', cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => openPicker(post.postId)}
                    style={{ margin: '10px 16px 0', padding: '16px', borderRadius: 8, border: '1.5px dashed rgba(167,169,250,0.35)', background: 'rgba(164,58,237,0.07)', color: '#A78BFA', fontSize: 16, fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}>
                    🖼 Add Image
                  </button>
                )}
                {/* Header */}
                <div style={{ padding: '10px 16px 6px', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 18 }}>{meta.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 16, color: meta.color }}>{meta.label}</span>
                  <StatusBadge status={post.status} />
                  {scheduledLabel && <span style={{ fontSize: 16, color: '#6B7280' }}>📅 {scheduledLabel}</span>}
                  <span style={{ fontSize: 16, color: '#4B5563', marginLeft: 'auto' }}>{new Date(post.createdAt).toLocaleDateString('en-AU')}</span>
                </div>
                {/* Inline date + time scheduler */}
                {(() => {
                  const sched = post.scheduledFor ? new Date(post.scheduledFor) : null;
                  const pd = postSchedule[post.postId];
                  const currentDate = pd?.date  ?? (sched ? `${sched.getFullYear()}-${String(sched.getMonth()+1).padStart(2,'0')}-${String(sched.getDate()).padStart(2,'0')}` : '');
                  const currentTime = pd?.time  ?? (sched ? `${String(sched.getHours()).padStart(2,'0')}:${String(sched.getMinutes()).padStart(2,'0')}` : '');
                  const dirty = !!pd;
                  return (
                    <div style={{ padding: '0 16px 6px', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid rgba(167,169,250,0.16)' }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>📅</span>
                      <input type="date" value={currentDate}
                        onChange={e => setPostSchedule(prev => ({ ...prev, [post.postId]: { date: e.target.value, time: currentTime } }))}
                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(167,169,250,0.3)', borderRadius: 7, color: '#E9D5FF', padding: '6px 10px', fontSize: 16, outline: 'none', cursor: 'pointer' }}
                      />
                      <input type="time" value={currentTime}
                        onChange={e => setPostSchedule(prev => ({ ...prev, [post.postId]: { date: currentDate, time: e.target.value } }))}
                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(167,169,250,0.3)', borderRadius: 7, color: '#E9D5FF', padding: '6px 10px', fontSize: 16, outline: 'none', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 13, color: '#7dd3fc', background: 'rgba(14,116,144,0.25)', borderRadius: 6, padding: '4px 8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {Intl.DateTimeFormat().resolvedOptions().timeZone}
                      </span>
                      {dirty && (
                        <button onClick={() => schedulePost(post.postId, pd.date || currentDate, pd.time || currentTime)}
                          style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: 'rgba(37,99,235,0.5)', color: '#93C5FD', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
                          ✓ Save
                        </button>
                      )}
                    </div>
                  );
                })()}
                {/* Editable text — always editable */}
                <div style={{ padding: '0 16px', flex: 1 }}>
                  <textarea
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(167,169,250,0.25)', borderRadius: 8, color: '#E9D5FF', padding: '8px 10px', fontSize: 16, lineHeight: 1.6, resize: 'vertical', minHeight: 100, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
                    value={editing[post.postId] !== undefined ? editing[post.postId] : post.content}
                    onChange={e => setEditing(prev => ({ ...prev, [post.postId]: e.target.value }))}
                  />
                </div>
                {/* Save/Revert only when editing text */}
                {editing[post.postId] !== undefined && editing[post.postId] !== post.content && (
                  <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6 }}>
                    <button style={btn.save} disabled={isSaving} onClick={() => saveEdit(post.postId)}>{isSaving ? 'Saving…' : '✓ Save'}</button>
                    <button style={btn.cancel} onClick={() => setEditing(prev => { const n = { ...prev }; delete n[post.postId]; return n; })}>Revert</button>
                  </div>
                )}
              </div>
            );
          })}
            </div>
          )}

          {/* ── Image Picker Modal ──────────────────────────── */}
          {picker && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
              onClick={e => { if (e.target === e.currentTarget) closePicker(); }}>
              <div style={{ background: '#1a0840', border: '1px solid rgba(167,169,250,0.3)', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: 16, color: '#E9D5FF' }}>Select Image</span>
                  <button onClick={closePicker} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
                </div>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['upload', 'library'].map(t => (
                    <button key={t} onClick={() => setPickerTab(t)}
                      style={{ flex: 1, padding: '10px', background: pickerTab === t ? 'rgba(164,58,237,0.3)' : 'transparent', border: 'none', color: pickerTab === t ? '#E9D5FF' : '#6B7280', fontWeight: 600, fontSize: 16, cursor: 'pointer', borderBottom: pickerTab === t ? '2px solid #7C3AED' : '2px solid transparent', transition: 'all 0.16s' }}>
                      {t === 'upload' ? '⬆ Upload' : '🖼 Library'}
                    </button>
                  ))}
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                  {pickerTab === 'upload' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', padding: '30px 0' }}>
                      <div style={{ fontSize: 40 }}>📁</div>
                      <p style={{ color: '#A78BFA', margin: 0 }}>Choose an image file from your computer</p>
                      <button onClick={() => fileInputRef.current?.click()}
                        style={{ padding: '10px 24px', borderRadius: 9, background: 'linear-gradient(90deg,#7C3AED,#6D28D9)', border: 'none', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
                        Choose File
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
                    </div>
                  )}
                  {pickerTab === 'library' && (
                    libLoading ? (
                      <div style={{ textAlign: 'center', color: '#6B7280', padding: 30 }}>Loading library…</div>
                    ) : library.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#6B7280', padding: 30 }}>No images saved yet. Upload images via the Image Library page.</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                        {library.map(img => (
                          <img key={img.id} src={img.url} alt={img.description || 'Image'}
                            onClick={() => handleLibrarySelect(img.url)}
                            style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '2px solid transparent', transition: 'border 0.16s' }}
                            onMouseEnter={e => e.currentTarget.style.border = '2px solid #7C3AED'}
                            onMouseLeave={e => e.currentTarget.style.border = '2px solid transparent'} />
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Crop Modal ────────────────────────────────────── */}
          {cropSrc && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ background: '#1a0840', border: '1px solid rgba(167,169,250,0.3)', borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: 16, color: '#E9D5FF' }}>✂ Crop Image</span>
                  <button onClick={() => { setCropSrc(null); setCropPostId(null); }} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 20, cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', justifyContent: 'center', background: '#0c0420' }}>
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    style={{ maxWidth: '100%' }}
                  >
                    <img
                      ref={cropImgRef}
                      src={cropSrc}
                      onLoad={onCropImageLoad}
                      alt="Crop"
                      style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain' }}
                      crossOrigin="anonymous"
                    />
                  </ReactCrop>
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button onClick={() => { setCropSrc(null); setCropPostId(null); }}
                    style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#9CA3AF', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={useImageDirect} disabled={applyingCrop}
                    style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(167,169,250,0.4)', background: 'rgba(164,58,237,0.2)', color: '#C4B5FD', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
                    Use as-is
                  </button>
                  <button onClick={applyCrop} disabled={applyingCrop || !completedCrop}
                    style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(90deg,#7C3AED,#6D28D9)', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer', opacity: (!completedCrop || applyingCrop) ? 0.5 : 1 }}>
                    {applyingCrop ? 'Saving…' : '✓ Apply Crop'}
                  </button>
                </div>
              </div>
            </div>
          )}


        </div>
      </div>
    </>
  );
}