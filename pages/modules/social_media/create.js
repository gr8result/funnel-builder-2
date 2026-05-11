import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../utils/supabase-client';
import ICONS from '../../../components/iconMap';
import ImageEditorCard from '../../../components/image-editor/ImageEditorCard';
import { openSharedMediaPicker } from '../../../lib/openSharedMediaPicker';

// ── Constants ──────────────────────────────────────────────────────────────
const PLATFORM_OPTIONS = [
  { key: 'facebook',  label: 'Facebook',   videoOnly: false },
  { key: 'instagram', label: 'Instagram',  videoOnly: false },
  { key: 'linkedin',  label: 'LinkedIn',   videoOnly: false },
  { key: 'x',         label: 'X',          videoOnly: false },
  { key: 'pinterest', label: 'Pinterest',  videoOnly: false },
  { key: 'tiktok',   label: 'TikTok',     videoOnly: false },
  { key: 'youtube',  label: 'YouTube',    videoOnly: true  },
];

const DEFAULT_SELECTED_PLATFORMS = {
  facebook: true,
  instagram: true,
  linkedin: true,
  x: false,
  pinterest: false,
  tiktok: false,
  youtube: false,
};

const PLATFORM_THEME = {
  facebook:  { color: '#1877F2', lightBg: 'rgba(24,119,242,0.1)',   border: 'rgba(24,119,242,0.35)',  icon: '📘', name: 'Facebook',  actions: ['👍 Like', '💬 Comment', '↗ Share'] },
  instagram: { color: '#E1306C', lightBg: 'rgba(225,48,108,0.1)',  border: 'rgba(225,48,108,0.35)', icon: '📷', name: 'Instagram', actions: ['❤️', '💬', '✈️', '🔖'] },
  linkedin:  { color: '#0A66C2', lightBg: 'rgba(10,102,194,0.1)',  border: 'rgba(10,102,194,0.35)', icon: '💼', name: 'LinkedIn',  actions: ['👍 Like', '💬 Comment', '🔁 Repost'] },
  x:         { color: '#111111', lightBg: 'rgba(17,17,17,0.12)',    border: 'rgba(255,255,255,0.2)', icon: '✕', name: 'X',         actions: ['💬', '🔁', '❤️', '📊'] },
  threads:   { color: '#101010', lightBg: 'rgba(16,16,16,0.14)',    border: 'rgba(255,255,255,0.2)', icon: '@', name: 'Threads',   actions: ['❤️', '💬', '🔁'] },
  bluesky:   { color: '#1185FE', lightBg: 'rgba(17,133,254,0.12)',  border: 'rgba(17,133,254,0.35)', icon: '☁', name: 'Bluesky',   actions: ['❤️', '💬', '🔁'] },
  pinterest: { color: '#E60023', lightBg: 'rgba(230,0,35,0.1)',    border: 'rgba(230,0,35,0.35)',   icon: '📌', name: 'Pinterest', actions: ['📌 Save', '↗ Share'] },
  tiktok:    { color: '#ff0050', lightBg: 'rgba(255,0,80,0.1)',    border: 'rgba(255,0,80,0.35)',   icon: '🎵', name: 'TikTok',    actions: ['❤️', '💬', '🔁', '⬆️'] },
  youtube:   { color: '#FF0000', lightBg: 'rgba(255,0,0,0.1)',     border: 'rgba(255,0,0,0.35)',    icon: '▶️', name: 'YouTube',   actions: ['👍', '👎', '↗ Share', '💬'] },
  googlebusiness: { color: '#4285F4', lightBg: 'rgba(66,133,244,0.12)', border: 'rgba(66,133,244,0.35)', icon: 'G', name: 'Google Business', actions: ['⭐ Review', '📍 Directions', '📞 Call'] },
  reddit:    { color: '#FF4500', lightBg: 'rgba(255,69,0,0.12)',   border: 'rgba(255,69,0,0.35)',   icon: '👽', name: 'Reddit',    actions: ['⬆️ Upvote', '💬 Comment', '↗ Share'] },
  snapchat:  { color: '#FFFC00', lightBg: 'rgba(255,252,0,0.14)',  border: 'rgba(255,252,0,0.35)',  icon: '👻', name: 'Snapchat',  actions: ['💬 Chat', '📷 Snap', '✨ Story'] },
  telegram:  { color: '#24A1DE', lightBg: 'rgba(36,161,222,0.12)', border: 'rgba(36,161,222,0.35)', icon: '✈', name: 'Telegram',  actions: ['📨 Send', '💬 Reply', '↗ Forward'] },
  whatsapp:  { color: '#25D366', lightBg: 'rgba(37,211,102,0.12)', border: 'rgba(37,211,102,0.35)', icon: '☎', name: 'WhatsApp', actions: ['💬 Reply', '📞 Call', '↗ Forward'] },
  discord:   { color: '#5865F2', lightBg: 'rgba(88,101,242,0.12)', border: 'rgba(88,101,242,0.35)', icon: '🎮', name: 'Discord',   actions: ['💬 Reply', '🧵 Thread', '📌 Pin'] },
  lemon8:    { color: '#18181B', lightBg: 'rgba(24,24,27,0.14)',   border: 'rgba(255,255,255,0.18)', icon: 'L8', name: 'Lemon8',   actions: ['❤️ Like', '💬 Comment', '🔖 Save'] },
};

const PLATFORM_LOGO = {
  facebook:  '/email-assets/social/facebook.svg',
  instagram: '/email-assets/social/instagram.svg',
  linkedin:  '/email-assets/social/linkedin.svg',
  x:         '/email-assets/social/x.svg',
  threads:   '/email-assets/social/threads.svg',
  bluesky:   '/email-assets/social/bluesky.svg',
  pinterest: '/email-assets/social/pinterest.svg',
  tiktok:    '/email-assets/social/tiktok.svg',
  youtube:   '/email-assets/social/youtube.svg',
  googlebusiness: '/email-assets/social/googlebusiness.svg',
  reddit:    '/email-assets/social/reddit.svg',
  snapchat:  '/email-assets/social/snapchat.svg',
  telegram:  '/email-assets/social/telegram.svg',
  whatsapp:  '/email-assets/social/whatsapp.svg',
  discord:   '/email-assets/social/discord.svg',
  lemon8:    '/email-assets/social/lemon8.svg',
};

const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKS = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

// ── Helpers ────────────────────────────────────────────────────────────────
function clamp(value, min, max) {
  const n = Number(value);
  return isNaN(n) ? min : Math.min(max, Math.max(min, n));
}

function buildScheduledQueue(postsByPlatform, start, scheduleMode, secondTime) {
  const scheduled = [];

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

  for (const [platform, posts] of Object.entries(postsByPlatform || {})) {
    const approvedPosts = (posts || []).filter(p => p.approved);
    approvedPosts.forEach((post, index) => {
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
      scheduled.push({ post, scheduledFor });
    });
  }

  scheduled.sort((a, b) => {
    const timeDiff = a.scheduledFor.getTime() - b.scheduledFor.getTime();
    if (timeDiff !== 0) return timeDiff;
    return String(a.post.platform).localeCompare(String(b.post.platform));
  });

  return scheduled;
}

async function getSessionData() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { token: '', userId: '' };
  return { token: session.access_token, userId: session.user.id };
}

function buildCtaBlock(platform, ing) {
  const p = String(platform || '').toLowerCase();
  const { websiteUrl = '', ctaText = '', ctaUrl = '', formUrl = '', phone = '', extraLine = '' } = ing || {};
  const lines = [];
  if (p === 'instagram') {
    if (websiteUrl) lines.push(`Website: ${websiteUrl}`);
    if (ctaText && (ctaUrl || websiteUrl)) lines.push(`${ctaText}: ${ctaUrl || websiteUrl}`);
    if (formUrl) lines.push(`Quick form: ${formUrl}`);
  } else if (p === 'linkedin') {
    if (ctaText && (ctaUrl || websiteUrl)) lines.push(`${ctaText} - ${ctaUrl || websiteUrl}`);
    if (formUrl) lines.push(`Form: ${formUrl}`);
    if (websiteUrl) lines.push(`Website: ${websiteUrl}`);
  } else if (p === 'x') {
    if (ctaUrl || websiteUrl) lines.push(`${ctaText || 'Learn more'}: ${ctaUrl || websiteUrl}`);
  } else if (p === 'pinterest') {
    if (ctaUrl || websiteUrl) lines.push(`Click through: ${ctaUrl || websiteUrl}`);
    if (formUrl) lines.push(`Details: ${formUrl}`);
  } else {
    if (ctaText && (ctaUrl || websiteUrl)) lines.push(`${ctaText}: ${ctaUrl || websiteUrl}`);
    if (formUrl) lines.push(`Quick form: ${formUrl}`);
    if (phone) lines.push(`Call/Text: ${phone}`);
    if (websiteUrl) lines.push(`Website: ${websiteUrl}`);
  }
  if (extraLine) lines.push(extraLine);
  const cleaned = lines.map(l => l.trim()).filter(Boolean);
  return cleaned.length ? `\n\n-\n${cleaned.join('\n')}` : '';
}

function applyIngredients(content, platform, ing) {
  const base = String(content || '').trim();
  const cta = buildCtaBlock(platform, ing);
  return cta ? `${base}${cta}`.trim() : base;
}

function tokenize(text) {
  return String(text || '').toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter(t => t.length > 2);
}

function scoreImage(postContent, imageMeta) {
  const pt = new Set(tokenize(postContent));
  const it = new Set(tokenize(imageMeta?.description || ''));
  if (!pt.size || !it.size) return 0;
  let n = 0; pt.forEach(t => { if (it.has(t)) n++; }); return n;
}

function dedupeAssignedImages(images) {
  const seen = new Set();
  return (images || []).filter((image) => {
    const key = String(image?.url || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function assignImages(posts, images) {
  const uniqueImages = dedupeAssignedImages(images);
  if (!uniqueImages.length || !posts?.length) return posts;
  const usage = new Map(uniqueImages.map((_, i) => [i, 0]));
  const maxUsagePerImage = Math.max(1, Math.ceil(posts.length / uniqueImages.length));
  let previousImageIndex = -1;
  return posts.map(post => {
    let bestIdx = 0, bestScore = -1, bestUsage = Infinity, bestWithinLimit = false;
    uniqueImages.forEach((img, i) => {
      const score = scoreImage(post.content, img);
      const used  = usage.get(i) || 0;
      const repeatsPrevious = i === previousImageIndex;
      const withinUsageLimit = used < maxUsagePerImage;
      const shouldReplace =
        (withinUsageLimit && !bestWithinLimit) ||
        (withinUsageLimit === bestWithinLimit && score > bestScore) ||
        (withinUsageLimit === bestWithinLimit && score === bestScore && used < bestUsage) ||
        (withinUsageLimit === bestWithinLimit && score === bestScore && used === bestUsage && !repeatsPrevious);
      if (shouldReplace) {
        bestIdx = i;
        bestScore = score;
        bestUsage = used;
        bestWithinLimit = withinUsageLimit;
      }
    });
    usage.set(bestIdx, (usage.get(bestIdx) || 0) + 1);
    previousImageIndex = bestIdx;
    return { ...post, image: uniqueImages[bestIdx]?.url || null };
  });
}

function assignImagesAcrossPlatforms(postsByPlatform, images) {
  if (!images?.length || !postsByPlatform || typeof postsByPlatform !== 'object') return postsByPlatform;
  const entries = Object.entries(postsByPlatform);
  const flattened = entries.flatMap(([platform, posts]) =>
    (posts || []).map((post, index) => ({ platform, index, post }))
  );
  if (!flattened.length) return postsByPlatform;

  const assigned = assignImages(flattened.map(({ post }) => post), images);
  const next = Object.fromEntries(entries.map(([platform, posts]) => [platform, [...(posts || [])]]));

  assigned.forEach((post, flatIndex) => {
    const target = flattened[flatIndex];
    if (!target) return;
    next[target.platform][target.index] = post;
  });

  return next;
}

function normalizePlatformPosts(data, style, targetCount) {
  const result = {};
  const source = data?.postsByPlatform;
  const desiredCount = Math.max(1, Number(targetCount) || 28);
  let counter = 0;
  if (source && typeof source === 'object') {
    const ts = Date.now();
    for (const [platform, posts] of Object.entries(source)) {
      if (!Array.isArray(posts) || !posts.length) continue;
      const cleaned = posts
        .map(p => ({
          id: `${platform}-${ts}-${counter++}`,
          content: String(p?.content || '').trim(),
          platform,
          tone: String(p?.tone || style || 'engaging'),
          approved: false,
          image: null,
        }))
        .filter(p => p.content.length > 0);
      if (!cleaned.length) continue;
      const base = [...cleaned];
      while (cleaned.length < desiredCount) {
        const seed = base[cleaned.length % base.length];
        cleaned.push({ ...seed, id: `${platform}-pad-${counter++}`, approved: false, image: null });
      }
      result[platform] = cleaned.slice(0, desiredCount);
    }
  }
  return result;
}

function buildFallbackTopicPosts(topic, platform, style, targetCount) {
  const desiredCount = Math.max(1, Number(targetCount) || 28);
  const sourceParagraphs = String(topic || '')
    .split(/\n\s*\n/)
    .map((chunk) => String(chunk || '').trim())
    .filter(Boolean);
  const seeds = sourceParagraphs.length ? sourceParagraphs : [String(topic || '').trim() || `Post about ${PLATFORM_THEME[platform]?.name || platform}`];
  const stamp = Date.now();

  return Array.from({ length: desiredCount }, (_, index) => ({
    id: `${platform}-fallback-${stamp}-${index}`,
    content: seeds[index % seeds.length],
    platform,
    tone: String(style || 'engaging'),
    approved: false,
    image: null,
  }));
}

function ensureRequestedPlatformPosts(postsByPlatform, requestedPlatforms, topic, style, targetCount) {
  const next = { ...(postsByPlatform || {}) };
  const safeRequested = Array.isArray(requestedPlatforms) ? requestedPlatforms.filter(Boolean) : [];

  safeRequested.forEach((platform) => {
    if (Array.isArray(next[platform]) && next[platform].length) return;
    next[platform] = buildFallbackTopicPosts(topic, platform, style, targetCount);
  });

  return next;
}

function getVisiblePlatforms(postsByPlatform, selectedPlatforms) {
  return PLATFORM_OPTIONS.map((option) => option.key);
}

function buildImageDescriptions(postsByPlatform, count) {
  const allPosts = Object.values(postsByPlatform).flat();
  const n = clamp(count, 1, Math.min(allPosts.length, 30));
  const toImageBrief = (post) => String(post?.content || '').replace(/#[a-z0-9_]+/gi, ' ').replace(/\s+/g, ' ').trim();
  if (n >= allPosts.length) return allPosts.map(toImageBrief);
  return Array.from({ length: n }, (_, i) =>
    toImageBrief(allPosts[Math.min(allPosts.length - 1, Math.floor((i / n) * allPosts.length))]) || ''
  ).filter(Boolean);
}

// ── PostCard sub-component — platform-specific UI mockups ────────────────
function PostCard({ post, theme, onToggle, onEdit, onPreview, brandName = 'Your Brand', videoSrc = '' }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(post.content);
  useEffect(() => { if (!editing) setText(post.content); }, [post.content, editing]);
  const handlePreview = () => {
    if (!post.image || !onPreview) return;
    onPreview();
  };

  const outerBase = {
    borderRadius: 10, overflow: 'hidden', position: 'relative',
    border: `1.5px solid ${post.approved ? 'rgba(34,197,94,0.65)' : theme.border}`,
    display: 'flex', flexDirection: 'column', transition: 'border-color 0.15s',
  };
  const approveBox = (
    <input type="checkbox" checked={post.approved} onChange={onToggle}
      title="Approve" style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, width: 18, height: 18, cursor: 'pointer', accentColor: '#86efac' }} />
  );
  const ta = (
    <textarea value={text} onChange={e => setText(e.target.value)}
      onBlur={() => { onEdit(text); setEditing(false); }} autoFocus
      style={{ width: '100%', minHeight: 80, background: 'transparent',
        border: 'none', borderBottom: '1.5px solid rgba(255,255,255,0.35)', color: 'inherit',
        padding: '2px 0', fontSize: 16, resize: 'none', boxSizing: 'border-box', lineHeight: 1.5, outline: 'none', fontFamily: 'inherit' }} />
  );
  const txt = (color = 'rgba(255,255,255,0.82)') => (
    <div onClick={() => setEditing(true)} title="Click to edit"
      style={{ fontSize: 16, lineHeight: 1.5, color, cursor: 'text', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
      {post.content}
    </div>
  );
  const img = (h = 80, fit = 'cover') => post.image ? (
    <img src={post.image} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} onClick={handlePreview}
      style={{ width: '100%', height: h, objectFit: fit, display: 'block', cursor: onPreview ? 'zoom-in' : 'default' }} />
  ) : null;
  const video = (aspectRatio) => videoSrc ? (
    <video
      src={videoSrc}
      muted
      loop
      playsInline
      controls
      style={{ width: '100%', height: '100%', aspectRatio, objectFit: 'cover', display: 'block', background: '#000' }}
    />
  ) : null;

  // ── Facebook ────────────────────────────────────────────────────────────
  if (post.platform === 'facebook') return (
    <div style={{ ...outerBase, background: '#1c2028' }}>
      {approveBox}
      <div style={{ background: '#242831', padding: '8px 32px 6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <img src={PLATFORM_LOGO.facebook} alt="fb" style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#e7e9ec', lineHeight: 1.2 }}>{brandName}</div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }}>Just now · 🌐</div>
        </div>
      </div>
      {post.image
        ? <img src={post.image} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} onClick={handlePreview} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', cursor: onPreview ? 'zoom-in' : 'default' }} />
        : <div style={{ width: '100%', aspectRatio: '1', background: 'linear-gradient(135deg,#0a1628,#1a2a4a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 26, opacity: 0.2 }}>📘</span></div>}
      <div style={{ padding: '8px 10px 6px', flex: 1, color: '#e7e9ec' }}>{editing ? ta : txt('#e7e9ec')}</div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '5px 10px', display: 'flex', justifyContent: 'space-around', background: '#1c2028' }}>
        {['👍 Like', '💬 Comment', '↗ Share'].map((a, i) => <span key={i} style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }}>{a}</span>)}
      </div>
    </div>
  );

  // ── Instagram ───────────────────────────────────────────────────────────
  if (post.platform === 'instagram') return (
    <div style={{ ...outerBase, background: '#000' }}>
      {approveBox}
      <div style={{ background: '#000', padding: '7px 32px 7px 9px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <img src={PLATFORM_LOGO.instagram} alt="ig" style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0 }} />
        <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{brandName}</span>
      </div>
      {post.image
        ? <img src={post.image} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} onClick={handlePreview} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', cursor: onPreview ? 'zoom-in' : 'default' }} />
        : <div style={{ width: '100%', aspectRatio: '1', background: 'linear-gradient(135deg,#1a0010,#0d0020)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 22, opacity: 0.2 }}>📷</span></div>}
      <div style={{ padding: '6px 9px 2px', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>{'❤️ 💬 ✈️'.split(' ').map((a, i) => <span key={i} style={{ fontSize: 16 }}>{a}</span>)}</div>
        <span style={{ fontSize: 16 }}>🔖</span>
      </div>
      <div style={{ padding: '2px 9px 8px', color: '#fff', flex: 1 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{brandName} </span>
        {editing ? ta : txt('#fff')}
      </div>
    </div>
  );

  // ── LinkedIn ────────────────────────────────────────────────────────────
  if (post.platform === 'linkedin') return (
    <div style={{ ...outerBase, background: '#1B1F23' }}>
      {approveBox}
      <div style={{ padding: '8px 32px 6px 10px', display: 'flex', alignItems: 'center', gap: 7 }}>
        <img src={PLATFORM_LOGO.linkedin} alt="li" style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>{brandName}</div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }}>Your Job Title · 1st</div>
        </div>
      </div>
      <div style={{ padding: '2px 10px 6px', flex: 1 }}>{editing ? ta : txt()}</div>
      {img(72)}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '5px 10px', display: 'flex', gap: 10, background: '#1B1F23' }}>
        {['👍 Like', '💬 Comment', '🔁 Repost'].map((a, i) => <span key={i} style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }}>{a}</span>)}
      </div>
    </div>
  );

  // ── X / Twitter ─────────────────────────────────────────────────────────
  if (post.platform === 'x') return (
    <div style={{ ...outerBase, background: '#0f1419' }}>
      {approveBox}
      <div style={{ padding: '8px 32px 5px 10px', display: 'flex', gap: 7 }}>
        <img src={PLATFORM_LOGO.x} alt="x" style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>{brandName}</div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>@{brandName.toLowerCase().replace(/\s+/g, '').slice(0, 15)}</div>
        </div>
      </div>
      <div style={{ padding: '0 10px 6px', flex: 1, color: '#e7e9ea' }}>{editing ? ta : txt('#e7e9ea')}</div>
      {post.image && <div style={{ padding: '0 10px 4px' }}><img src={post.image} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} onClick={handlePreview} style={{ width: '100%', borderRadius: 12, objectFit: 'cover', maxHeight: 80, display: 'block', cursor: onPreview ? 'zoom-in' : 'default' }} /></div>}
      <div style={{ padding: '4px 10px 7px', display: 'flex', gap: 12 }}>
        {['💬', '🔁', '❤️', '📊'].map((a, i) => <span key={i} style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }}>{a}</span>)}
      </div>
    </div>
  );

  // ── Pinterest ───────────────────────────────────────────────────────────
  if (post.platform === 'pinterest') return (
    <div style={{ ...outerBase, background: '#111' }}>
      {approveBox}
      {post.image
        ? <img src={post.image} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} onClick={handlePreview} style={{ width: '100%', minHeight: 90, objectFit: 'cover', display: 'block', cursor: onPreview ? 'zoom-in' : 'default' }} />
        : <div style={{ width: '100%', minHeight: 90, background: 'linear-gradient(135deg,#E60023,#8b0016)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>📌</div>}
      <div style={{ padding: '7px 9px 4px', flex: 1 }}>{editing ? ta : txt()}</div>
      <div style={{ padding: '4px 9px 8px', display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ background: '#E60023', color: '#fff', fontSize: 16, padding: '3px 10px', borderRadius: 12, fontWeight: 700 }}>Save</span>
      </div>
    </div>
  );

  // ── TikTok ──────────────────────────────────────────────────────────────
  if (post.platform === 'tiktok') return (
    <div style={{ ...outerBase, background: '#010101' }}>
      {approveBox}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '9/16', maxHeight: 110, overflow: 'hidden', background: '#1a0010' }}>
        {video('9/16')}
        {!videoSrc && post.image && <img src={post.image} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} onClick={handlePreview} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: onPreview ? 'zoom-in' : 'default' }} />}
        {!videoSrc && !post.image && <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, opacity: 0.3 }}>🎵</div>}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 50%,rgba(0,0,0,0.75))' }} />
      </div>
      <div style={{ padding: '6px 9px 3px', color: '#fff', flex: 1 }}>{editing ? ta : txt()}</div>
      <div style={{ padding: '3px 9px 8px', display: 'flex', gap: 10 }}>
        {['❤️', '💬', '🔁', '⬆️'].map((a, i) => <span key={i} style={{ fontSize: 12 }}>{a}</span>)}
      </div>
    </div>
  );

  // ── YouTube ─────────────────────────────────────────────────────────────
  if (post.platform === 'youtube') return (
    <div style={{ ...outerBase, background: '#0f0f0f' }}>
      {approveBox}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', maxHeight: 70, overflow: 'hidden', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {video('16/9')}
        {!videoSrc && post.image && <img src={post.image} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} onClick={handlePreview} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: onPreview ? 'zoom-in' : 'default' }} />}
        {!videoSrc && !post.image && <img src={PLATFORM_LOGO.youtube} alt="yt" style={{ width: 28, height: 28, opacity: 0.5 }} />}
        <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: 16, padding: '1px 4px', borderRadius: 3 }}>0:00</div>
      </div>
      <div style={{ padding: '6px 9px 4px', display: 'flex', gap: 6 }}>
        <img src={PLATFORM_LOGO.youtube} alt="yt" style={{ width: 22, height: 22, borderRadius: 4, flexShrink: 0 }} />
        <div style={{ flex: 1, color: '#fff', minWidth: 0 }}>{editing ? ta : txt('#fff')}</div>
      </div>
      <div style={{ padding: '0 9px 7px', display: 'flex', gap: 8 }}>
        {['👍', '👎', '↗ Share', '💬'].map((a, i) => <span key={i} style={{ fontSize: 16, color: 'rgba(255,255,255,0.28)' }}>{a}</span>)}
      </div>
    </div>
  );

  // ── Fallback ─────────────────────────────────────────────────────────────
  return (
    <div style={{ ...outerBase, background: '#0f172a' }}>
      {approveBox}
      <div style={{ background: theme.color, padding: '5px 7px' }}><span style={{ fontSize: 16, color: '#fff', fontWeight: 600 }}>{theme.icon} {theme.name}</span></div>
      {img()}
      <div style={{ flex: 1, padding: '7px 7px 4px' }}>{editing ? ta : txt()}</div>
      <div style={{ padding: '3px 7px', borderTop: `1px solid ${theme.border}`, display: 'flex', gap: 5 }}>
        {(theme.actions || []).slice(0, 3).map((a, i) => <span key={i} style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>{a}</span>)}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function CreateContent() {
  const router = useRouter();
  const imageUploadInputRef = useRef(null);

  const [notice,          setNotice]          = useState('');
  const [aiGenerating,    setAiGenerating]    = useState(false);
  const [postsByPlatform, setPostsByPlatform] = useState(() => {
    try { const s = localStorage.getItem('sm_draft_posts'); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [aiImages,        setAiImages]        = useState(() => {
    try { const s = localStorage.getItem('sm_draft_images'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [viewPlatform,    setViewPlatform]    = useState('all');

  // Campaign presets
  const [aiCampaignName,       setAiCampaignName]       = useState('');
  const [savedCampaigns,       setSavedCampaigns]       = useState([]);
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);

  // Generation settings
  const [aiTopic,        setAiTopic]        = useState('');
  const [doNotRewrite,   setDoNotRewrite]   = useState(false);
  const [aiStyle,        setAiStyle]        = useState('engaging');
  const [aiLength,       setAiLength]       = useState('short');
  const [aiHashtagLevel, setAiHashtagLevel] = useState('high');
  const [aiScheduleMode, setAiScheduleMode] = useState('daily');
  const [aiImageCount,   setAiImageCount]   = useState(10);
  const [aiContentType,  setAiContentType]  = useState('standard');
  const [aiImageCreativeType, setAiImageCreativeType] = useState('realistic');
  const [aiImageTextMode, setAiImageTextMode] = useState('headline-supporting');
  const [aiSelectedPlatforms, setAiSelectedPlatforms] = useState(() => {
    try {
      const saved = localStorage.getItem('sm_selected_platforms');
      if (!saved) return DEFAULT_SELECTED_PLATFORMS;
      return { ...DEFAULT_SELECTED_PLATFORMS, ...JSON.parse(saved) };
    } catch {
      return DEFAULT_SELECTED_PLATFORMS;
    }
  });

  // Video
  const [aiVideoFile,     setAiVideoFile]     = useState(null);
  const [aiVideoLocalUrl, setAiVideoLocalUrl] = useState('');
  const [aiUploadedVideoUrl, setAiUploadedVideoUrl] = useState('');

  // Ingredients (collapsible)
  const [showIngredients, setShowIngredients] = useState(false);
  const [aiIngredients,   setAiIngredients]   = useState({
    websiteUrl: '', ctaText: 'Book a Call', ctaUrl: '',
    formUrl: '', phone: '', extraLine: '',
  });

  // Lead form (collapsible)
  const [showLeadForm,       setShowLeadForm]       = useState(false);
  const [aiLeadForm,         setAiLeadForm]         = useState({
    enabled: false, title: 'Quick Survey', questions: [],
  });
  const [savedForms,         setSavedForms]         = useState([]);
  const [showFormDropdown,   setShowFormDropdown]   = useState(false);
  const [formTemplateName,   setFormTemplateName]   = useState('');

  // Campaign duration
  const [campaignWeeks, setCampaignWeeks] = useState(4);
  const [campaignDays,  setCampaignDays]  = useState(7);

  // Schedule
  const [aiScheduleStartDate, setAiScheduleStartDate] = useState('');
  const [aiScheduleTime,      setAiScheduleTime]      = useState('09:00');
  const [aiScheduleSecondTime, setAiScheduleSecondTime] = useState('21:00');
  const [manualImageTarget, setManualImageTarget] = useState(null);
  const [manualImageBusy, setManualImageBusy] = useState('');
  const [previewTarget, setPreviewTarget] = useState(null);
  const [previewEditingImage, setPreviewEditingImage] = useState(false);

  useEffect(() => { loadSavedCampaigns(); loadSavedForms(); }, []);
  useEffect(() => {
    try { localStorage.setItem('sm_selected_platforms', JSON.stringify(aiSelectedPlatforms)); } catch {}
  }, [aiSelectedPlatforms]);

  function getSelectedPlatforms() {
    return Object.entries(aiSelectedPlatforms).filter(([, v]) => v).map(([k]) => k);
  }

  function getPostsPerDay() {
    return aiScheduleMode === 'twice' ? 2 : 1;
  }

  function getPostsPerPlatformCount() {
    return campaignWeeks * campaignDays * getPostsPerDay();
  }

  function getDefaultViewPlatform(platforms = []) {
    if (!platforms.length) return 'all';
    return platforms.length > 1 ? 'all' : platforms[0];
  }

  function normalizePostsForSave(posts) {
    return Object.fromEntries(
      Object.entries(posts || {}).map(([plat, items]) => [
        plat,
        (items || []).map((p) => ({
          id: p.id,
          content: p.content,
          platform: p.platform,
          tone: p.tone,
          approved: p.approved,
          image: p.image?.startsWith('data:') ? null : (p.image || null),
        }))
      ])
    );
  }

  function buildCampaignSettings(postsOverride = postsByPlatform) {
    return {
      topic: aiTopic,
      style: aiStyle,
      length: aiLength,
      hashtagLevel: aiHashtagLevel,
      contentType: aiContentType,
      imageCreativeType: aiImageCreativeType,
      imageTextMode: aiImageTextMode,
      platforms: aiSelectedPlatforms,
      ingredients: aiIngredients,
      leadForm: aiLeadForm,
      scheduleMode: aiScheduleMode,
      imageCount: aiImageCount,
      campaignWeeks,
      campaignDays,
      scheduleTime: aiScheduleTime,
      scheduleSecondTime: aiScheduleSecondTime,
      posts: normalizePostsForSave(postsOverride),
    };
  }

  function persistDraftPosts(nextPosts) {
    try { localStorage.setItem('sm_draft_posts', JSON.stringify(nextPosts)); } catch {}
  }

  function clearDraftImages() {
    try { localStorage.removeItem('sm_draft_images'); } catch {}
  }

  function formatImageError(imageResult) {
    const code = String(imageResult?.errorCode || '').toLowerCase();
    const base = imageResult?.error || 'Image generation failed.';
    if (code.includes('billing_hard_limit_reached')) return `OpenAI image billing limit reached. ${base}`;
    if (code.includes('insufficient_quota')) return `OpenAI image quota exceeded. ${base}`;
    if (code.includes('missing_openai_key')) return base;
    return base;
  }

  function imageFallbackLabel(imageResult) {
    if (imageResult?.fallbackSource === 'library') return 'your Image Library';
    if (imageResult?.fallbackSource === 'stock') return 'the built-in stock image set';
    return 'fallback images';
  }

  function countSelectedWithinLimit(posts, limit) {
    return (posts || []).slice(0, limit).filter((post) => post.approved).length;
  }

  function buildSelectionSummary(postsByPlat, limit) {
    return Object.entries(postsByPlat || {})
      .map(([platform, posts]) => ({ platform, count: countSelectedWithinLimit(posts, limit) }))
      .filter((item) => item.count > 0);
  }

  function formatGenerationReason(reason) {
    if (reason === 'missing_openai_key') return 'Live AI is missing an OpenAI API key.';
    if (reason === 'openai_quota_or_billing') return 'The OpenAI key is hitting quota or billing limits.';
    if (reason === 'empty_or_invalid_openai_response') return 'OpenAI returned an unusable response.';
    return 'OpenAI generation fell back to template captions.';
  }

  function formatSelectionSummary(items) {
    if (!items.length) return 'No posts selected.';
    return items
      .map(({ platform, count }) => `${PLATFORM_THEME[platform]?.name || platform} ${count}`)
      .join(' · ');
  }

  async function syncCampaignPosts(nextPosts) {
    const campaignName = aiCampaignName.trim();
    if (!campaignName) return;

    const settings = buildCampaignSettings(nextPosts);
    setSavedCampaigns((prev) => prev.map((campaign) => (
      campaign.name === campaignName ? { ...campaign, ...settings } : campaign
    )));

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: existing } = await supabase.from('social_ai_presets')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('name', campaignName)
      .maybeSingle();

    if (!existing?.id) return;

    const { error } = await supabase.from('social_ai_presets')
      .update({ settings, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (error) setNotice(`Campaign sync failed: ${error.message}`);
  }

  // ── Campaign CRUD ───────────────────────────────────────────────────────
  async function loadSavedCampaigns() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from('social_ai_presets')
      .select('id, name, settings, updated_at')
      .eq('user_id', session.user.id)
      .not('name', 'like', '__FORM:%')
      .order('updated_at', { ascending: false });
    if (data) setSavedCampaigns(data.map(r => ({ id: r.id, name: r.name, ...r.settings })));
  }

  async function loadSavedForms() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from('social_ai_presets')
      .select('id, name, settings, updated_at')
      .eq('user_id', session.user.id)
      .like('name', '__FORM:%')
      .order('updated_at', { ascending: false });
    if (data) setSavedForms(data.map(r => ({ id: r.id, displayName: r.name.replace('__FORM:', ''), form: r.settings.formTemplate })));
  }

  async function saveFormTemplate() {
    const name = formTemplateName.trim() || aiLeadForm.title.trim() || 'My Form';
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const dbName = `__FORM:${name}`;
    const settings = { formTemplate: aiLeadForm };
    const { data: existing } = await supabase.from('social_ai_presets')
      .select('id').eq('user_id', session.user.id).eq('name', dbName).maybeSingle();
    let error;
    if (existing?.id) {
      ({ error } = await supabase.from('social_ai_presets')
        .update({ settings, updated_at: new Date().toISOString() })
        .eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('social_ai_presets')
        .insert({ user_id: session.user.id, name: dbName, settings, updated_at: new Date().toISOString() }));
    }
    if (error) { setNotice(`Save failed: ${error.message}`); return; }
    setNotice(`Form template "${name}" saved.`);
    setFormTemplateName('');
    await loadSavedForms();
  }

  function loadFormTemplate(saved) {
    setAiLeadForm(saved.form);
    setShowFormDropdown(false);
    setNotice(`Form template "${saved.displayName}" loaded.`);
  }

  async function deleteFormTemplate(id) {
    const { error } = await supabase.from('social_ai_presets').delete().eq('id', id);
    if (error) { setNotice(`Delete failed: ${error.message}`); return; }
    await loadSavedForms();
  }

  async function saveCampaign() {
    if (!aiCampaignName.trim()) { setNotice('Enter a campaign name first.'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const settings = buildCampaignSettings();
    const { data: existing } = await supabase.from('social_ai_presets')
      .select('id').eq('user_id', session.user.id).eq('name', aiCampaignName.trim()).maybeSingle();
    let error;
    if (existing?.id) {
      ({ error } = await supabase.from('social_ai_presets')
        .update({ settings, updated_at: new Date().toISOString() })
        .eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('social_ai_presets')
        .insert({ user_id: session.user.id, name: aiCampaignName.trim(), settings, updated_at: new Date().toISOString() }));
    }
    if (error) { setNotice(`Save failed: ${error.message}`); return; }
    setNotice(`Campaign "${aiCampaignName.trim()}" saved.`);
    await loadSavedCampaigns();
  }

  function loadCampaign(campaign) {
    setAiCampaignName(campaign.name);
    setAiTopic(campaign.topic || '');
    setAiStyle(campaign.style || 'engaging');
    setAiLength(campaign.length || 'short');
    setAiHashtagLevel(campaign.hashtagLevel || 'high');
    setAiContentType(campaign.contentType || 'standard');
    setAiImageCreativeType(campaign.imageCreativeType || 'realistic');
    setAiImageTextMode(campaign.imageTextMode || 'headline-supporting');
    setAiSelectedPlatforms({ ...DEFAULT_SELECTED_PLATFORMS, ...(campaign.platforms || {}) });
    if (campaign.ingredients)              setAiIngredients(campaign.ingredients);
    if (campaign.leadForm)                 setAiLeadForm(campaign.leadForm);
    setAiScheduleMode(campaign.scheduleMode || 'daily');
    setAiImageCount(campaign.imageCount ?? 10);
    if (campaign.campaignWeeks)            setCampaignWeeks(campaign.campaignWeeks);
    if (campaign.campaignDays)             setCampaignDays(campaign.campaignDays);
    if (campaign.scheduleTime)             setAiScheduleTime(campaign.scheduleTime);
    setAiScheduleSecondTime(campaign.scheduleSecondTime || '21:00');
    if (campaign.posts && Object.keys(campaign.posts).length) {
      setPostsByPlatform(campaign.posts);
      try { localStorage.setItem('sm_draft_posts', JSON.stringify(campaign.posts)); } catch {}
      setViewPlatform(getDefaultViewPlatform(Object.keys(campaign.posts)));
    }
    setShowCampaignDropdown(false);
    setNotice(`Campaign "${campaign.name}" loaded — all settings restored.`);
  }

  async function deleteSavedCampaign(id) {
    const { error } = await supabase.from('social_ai_presets').delete().eq('id', id);
    if (error) { setNotice(`Delete failed: ${error.message}`); return; }
    await loadSavedCampaigns();
  }

  // ── AI generation ───────────────────────────────────────────────────────
  async function generateAIContent() {
    if (!aiTopic.trim()) { setNotice('Please enter a topic first.'); return; }
    const platforms = getSelectedPlatforms();
    if (!platforms.length) { setNotice('Select at least one platform.'); return; }
    setAiGenerating(true);
    setNotice('');
    try {
      const { token, userId } = await getSessionData();
      if (!token) throw new Error('Sign in to generate content.');

      const res = await fetch('/api/social/ai-generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          topic: aiTopic, postsPerPlatform: getPostsPerPlatformCount(), platforms,
          style: aiStyle, contentLength: aiLength, hashtagLevel: aiHashtagLevel,
          userId, saveDrafts: false, doNotRewrite,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'AI generation failed');

      const byPlatform = ensureRequestedPlatformPosts(
        normalizePlatformPosts(data, aiStyle, getPostsPerPlatformCount()),
        platforms,
        aiTopic,
        aiStyle,
        getPostsPerPlatformCount()
      );
      if (!Object.keys(byPlatform).length) throw new Error('AI returned no usable posts. Try a more specific topic.');
      const fallbackEntries = Object.entries(data.generationMeta || {}).filter(([, meta]) => meta?.source === 'fallback');

      let msg = '';

      if (aiImageCount > 0) {
        try {
          const imgRes = await fetch('/api/social/ai-generate-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              descriptions: buildImageDescriptions(byPlatform, aiImageCount),
              style: aiStyle,
              creativeType: aiImageCreativeType,
              textMode: aiImageTextMode,
              count: aiImageCount,
            }),
          });
          const imgData = await imgRes.json();
          if (imgRes.ok && imgData.ok && imgData.images?.length) {
            setAiImages(imgData.images);
            try { localStorage.setItem('sm_draft_images', JSON.stringify(imgData.images)); } catch {}
            Object.assign(byPlatform, assignImagesAcrossPlatforms(byPlatform, imgData.images));
            if (imgData.fallback) {
              msg = `Generated posts and ${imgData.images.length} fallback real images from ${imageFallbackLabel(imgData)}. Saved to your shared Media Library. ${formatImageError(imgData)}`;
            } else if (imgData.partial) {
              msg = `Generated posts and ${imgData.images.length} real images. Saved to your shared Media Library. Some images failed: ${formatImageError(imgData)}`;
            } else {
              msg = `Generated posts for ${Object.keys(byPlatform).length} platforms and ${imgData.images.length} images. Saved to your shared Media Library.`;
            }
          } else {
            setAiImages([]);
            clearDraftImages();
            msg = `Posts generated. No images were created. ${formatImageError(imgData)}`;
          }
        } catch (e) {
          setAiImages([]);
          clearDraftImages();
          msg = `Posts generated. Image error: ${e.message}.`;
        }
      } else {
        setAiImages([]);
        clearDraftImages();
        const total = Object.values(byPlatform).reduce((s, arr) => s + arr.length, 0);
        msg = `Generated ${total} posts across ${Object.keys(byPlatform).length} platforms.`;
      }

      if (fallbackEntries.length) {
        const names = fallbackEntries.map(([platform]) => PLATFORM_THEME[platform]?.name || platform).join(', ');
        const fallbackReasons = [...new Set(fallbackEntries.map(([, meta]) => meta?.reason).filter(Boolean))]
          .map((reason) => formatGenerationReason(reason))
          .join(' ');
        msg += ` ${fallbackEntries.length === platforms.length ? 'Fallback captions were used for all selected platforms.' : `Fallback captions were used for ${names}.`} ${fallbackReasons}`;
      }

      setPostsByPlatform(byPlatform);
      persistDraftPosts(byPlatform);
      await syncCampaignPosts(byPlatform);
      setViewPlatform(getDefaultViewPlatform(Object.keys(byPlatform)));
      setNotice(msg);
    } catch (err) {
      setNotice(err.message || 'Failed to generate content');
    } finally {
      setAiGenerating(false);
    }
  }

  async function generateAIImagesOnly() {
    if (!aiTopic.trim()) { setNotice('Enter a topic first.'); return; }
    if (!aiImageCount) { setNotice('Image count is 0.'); return; }
    if (!Object.keys(postsByPlatform).length) { setNotice('Generate posts first, then add images.'); return; }
    setAiGenerating(true);
    setNotice('');
    try {
      const { token } = await getSessionData();
      const res = await fetch('/api/social/ai-generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          descriptions: buildImageDescriptions(postsByPlatform, aiImageCount),
          style: aiStyle,
          creativeType: aiImageCreativeType,
          textMode: aiImageTextMode,
          count: aiImageCount,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.images?.length) {
        setAiImages([]);
        clearDraftImages();
        setNotice(`No images were created. ${formatImageError(data)}`);
        return;
      }
      setAiImages(data.images);
      try { localStorage.setItem('sm_draft_images', JSON.stringify(data.images)); } catch {}
      setPostsByPlatform(prev => assignImagesAcrossPlatforms(prev, data.images));
      setNotice(data.fallback
        ? `Generated ${data.images.length} fallback real images from ${imageFallbackLabel(data)}. Saved to your shared Media Library. ${formatImageError(data)}`
        : data.partial
          ? `Generated ${data.images.length} real images. Saved to your shared Media Library. Some image requests failed: ${formatImageError(data)}`
          : `Generated ${data.images.length} images, distributed across all platforms, and saved to your shared Media Library.`);
    } catch (err) {
      setNotice(err.message || 'Failed');
    } finally {
      setAiGenerating(false);
    }
  }

  // ── Post management ─────────────────────────────────────────────────────
  function toggleApproval(platform, id) {
    setPostsByPlatform(prev => {
      const next = {
        ...prev,
        [platform]: prev[platform].map(p => p.id === id ? { ...p, approved: !p.approved } : p),
      };
      persistDraftPosts(next);
      void syncCampaignPosts(next);
      return next;
    });
  }

  function updatePost(platform, id, field, val) {
    setPostsByPlatform(prev => {
      const next = {
        ...prev,
        [platform]: prev[platform].map(p => p.id === id ? { ...p, [field]: val } : p),
      };
      persistDraftPosts(next);
      void syncCampaignPosts(next);
      return next;
    });
  }

  function getManualImageKey(platform, id) {
    return `${platform}:${id}`;
  }

  function assignManualImage(platform, id, imageUrl) {
    if (!platform || !id) return;
    updatePost(platform, id, 'image', imageUrl || null);
    setNotice(imageUrl ? 'Image assigned to post.' : 'Image removed from post.');
  }

  function openPostPreview(platform, id) {
    if (!platform || !id) return;
    setPreviewTarget({ platform, id });
    setPreviewEditingImage(false);
  }

  function closePostPreview() {
    setPreviewTarget(null);
    setPreviewEditingImage(false);
  }

  function saveEditedPreviewImage(imageUrl) {
    if (!previewTarget) return;
    assignManualImage(previewTarget.platform, previewTarget.id, imageUrl || null);
    setPreviewEditingImage(false);
  }

  function chooseImageFromLibrary(platform, id) {
    const opened = openSharedMediaPicker({
      onPick: (asset) => assignManualImage(platform, id, asset?.url || ''),
      onBlocked: () => setNotice('Allow pop-ups to choose an image from the Media Library, or open the Media Library manually in another tab.'),
    });
    if (!opened) return;
  }

  function chooseImageUpload(platform, id) {
    setManualImageTarget({ platform, id });
    imageUploadInputRef.current?.click();
  }

  async function uploadSelectedVideo() {
    if (aiUploadedVideoUrl) return aiUploadedVideoUrl;
    if (!aiVideoFile) return '';

    const { userId } = await getSessionData();
    if (!userId) {
      throw new Error('You must be signed in to upload videos.');
    }

    const formData = new FormData();
    formData.append('file', aiVideoFile, aiVideoFile.name || 'video.mp4');

    const response = await fetch('/api/assets/upload', {
      method: 'POST',
      headers: { 'x-gr8-user-id': userId },
      body: formData,
    });

    const payload = await response.json().catch(() => ({}));
    const videoUrl = payload?.data?.[0]?.src || '';
    if (!response.ok || !videoUrl) {
      throw new Error(payload?.error || 'Video upload failed.');
    }

    setAiUploadedVideoUrl(videoUrl);
    return videoUrl;
  }

  async function handleManualImageUpload(event) {
    const file = event.target.files?.[0];
    const target = manualImageTarget;
    event.target.value = '';
    if (!file || !target) return;

    const busyKey = getManualImageKey(target.platform, target.id);
    setManualImageBusy(busyKey);
    try {
      const readerResult = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (loadEvent) => resolve(loadEvent.target?.result || '');
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
      });

      const { token } = await getSessionData();
      if (!token) throw new Error('Sign in to upload images.');

      const response = await fetch('/api/social/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageUrl: readerResult, description: file.name || 'Uploaded post image' }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok || !payload?.image?.url) throw new Error(payload?.error || 'Image upload failed.');

      assignManualImage(target.platform, target.id, payload.image.url);
    } catch (error) {
      setNotice(error.message || 'Image upload failed.');
    } finally {
      setManualImageBusy('');
      setManualImageTarget(null);
    }
  }

  function approveAllView() {
    if (viewPlatform === 'all') {
      approveAll();
      return;
    }
    const limit = getPostsPerPlatformCount();
    setPostsByPlatform(prev => {
      const next = {
        ...prev,
        [viewPlatform]: (prev[viewPlatform] || []).map((p, i) => ({ ...p, approved: i < limit })),
      };
      persistDraftPosts(next);
      void syncCampaignPosts(next);
      const selected = countSelectedWithinLimit(next[viewPlatform], limit);
      setNotice(`Selected ${selected} ${PLATFORM_THEME[viewPlatform]?.name || viewPlatform} posts.`);
      return next;
    });
  }

  function approveAll() {
    const limit = getPostsPerPlatformCount();
    setPostsByPlatform(prev => {
      const next = {};
      for (const [plat, posts] of Object.entries(prev)) {
        next[plat] = posts.map((p, i) => ({ ...p, approved: i < limit }));
      }
      persistDraftPosts(next);
      void syncCampaignPosts(next);
      setNotice(`Selected all campaign posts across platforms. ${formatSelectionSummary(buildSelectionSummary(next, limit))}`);
      return next;
    });
  }

  function deleteSelected() {
    const selectedCount = buildSelectionSummary(postsByPlatform, getPostsPerPlatformCount()).reduce((sum, item) => sum + item.count, 0);
    if (!selectedCount) { setNotice('Select at least one post first.'); return; }
    setPostsByPlatform(prev => {
      const next = {};
      for (const [plat, posts] of Object.entries(prev)) next[plat] = posts.filter(p => !p.approved);
      persistDraftPosts(next);
      void syncCampaignPosts(next);
      return next;
    });
    setNotice(`Deleted ${selectedCount} selected post${selectedCount === 1 ? '' : 's'}.`);
  }

  function clearAll() {
    setPostsByPlatform(prev => {
      const next = {};
      for (const [plat, posts] of Object.entries(prev)) next[plat] = posts.map(p => ({ ...p, approved: false }));
      persistDraftPosts(next);
      void syncCampaignPosts(next);
      setNotice('Cleared all selected posts across platforms.');
      return next;
    });
  }

  // ── Save drafts ────────────────────────────────────────────────────────
  async function saveDrafts() {
    const allApproved = Object.values(postsByPlatform).flat().filter(p => p.approved);
    if (!allApproved.length) { setNotice('Approve at least one post first.'); return; }
    setAiGenerating(true);
    setNotice('');
    try {
      const { token } = await getSessionData();
      if (!token) {
        setNotice('You must be signed in to save posts. Please log in and try again.');
        setAiGenerating(false);
        return;
      }
      const hasVideoPosts = allApproved.some(post => post.platform === 'youtube' || post.platform === 'tiktok');
      let uploadedVideoUrl = aiUploadedVideoUrl;
      if (hasVideoPosts) {
        if (!uploadedVideoUrl && !aiVideoFile) {
          setNotice('Upload a video before saving TikTok or YouTube posts.');
          setAiGenerating(false);
          return;
        }
        uploadedVideoUrl = await uploadSelectedVideo();
      }
      let ok = 0;
      let lastError = '';
      for (const post of allApproved) {
        let mediaUrl = (post.platform === 'youtube' || post.platform === 'tiktok') ? (uploadedVideoUrl || null) : null;
        if (post.platform !== 'youtube' && post.platform !== 'tiktok' && post.image) {
          if (post.image.startsWith('data:')) {
            try {
              const imgRes = await fetch('/api/social/save-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ imageUrl: post.image, description: post.content?.slice(0, 120) }),
              });
              const imgData = await imgRes.json();
              if (imgData.ok) mediaUrl = imgData.image.url;
            } catch (_) { /* image upload failed, continue without image */ }
          } else {
            mediaUrl = post.image;
          }
        }
        let draftBody;
        try {
          draftBody = JSON.stringify({
            content: applyIngredients(post.content, post.platform, aiIngredients),
            platform: post.platform,
            mediaUrl,
            scheduledFor: null,
          });
        } catch (jsonErr) {
          lastError = `JSON error: ${jsonErr.message}`;
          continue;
        }
        const res = await fetch('/api/social/create-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: draftBody,
        });
        const data = await res.json();
        if (res.ok && data.success) {
          ok++;
        } else {
          lastError = data.error || `HTTP ${res.status}`;
        }
      }
      if (ok === 0) {
        setNotice(`Failed to save posts. Error: ${lastError || 'unknown'}. Try signing out and back in.`);
      } else {
        setNotice(`Saved ${ok} of ${allApproved.length} posts as drafts. Go to Review to edit or schedule them.`);
        if (ok === allApproved.length) clearAll();
      }
    } catch (err) {
      setNotice(err.message || 'Failed to save drafts');
    } finally {
      setAiGenerating(false);
    }
  }

  // ── Scheduling ──────────────────────────────────────────────────────────
  async function scheduleApproved() {
    const allApproved = Object.values(postsByPlatform).flat().filter(p => p.approved);
    if (!allApproved.length) { setNotice('Approve at least one post first.'); return; }
    if (!aiScheduleStartDate) { setNotice('Pick a start date.'); return; }
    setAiGenerating(true);
    setNotice('');
    try {
      const { token } = await getSessionData();
      if (!token) {
        setNotice('You must be signed in to schedule posts. Please log in and try again.');
        setAiGenerating(false);
        return;
      }
      const hasVideoPosts = allApproved.some(post => post.platform === 'youtube' || post.platform === 'tiktok');
      let uploadedVideoUrl = aiUploadedVideoUrl;
      if (hasVideoPosts) {
        if (!uploadedVideoUrl && !aiVideoFile) {
          setNotice('Upload a video before scheduling TikTok or YouTube posts.');
          setAiGenerating(false);
          return;
        }
        uploadedVideoUrl = await uploadSelectedVideo();
      }
      const start = new Date(aiScheduleStartDate);
      const startYear = start.getFullYear();
      if (isNaN(start.getTime()) || startYear < 2024 || startYear > 2035) {
        setNotice(`Invalid start date (year ${startYear}). Please re-enter the date.`);
        setAiGenerating(false);
        return;
      }
      const [hh, mm] = String(aiScheduleTime || '09:00').split(':');
      start.setHours(clamp(parseInt(hh, 10), 0, 23), clamp(parseInt(mm, 10), 0, 59), 0, 0);
      const scheduledQueue = buildScheduledQueue(postsByPlatform, start, aiScheduleMode, aiScheduleSecondTime);
      let ok = 0;
      let lastError = '';
      for (let i = 0; i < scheduledQueue.length; i++) {
        const { post, scheduledFor } = scheduledQueue[i];
        let mediaUrl = (post.platform === 'youtube' || post.platform === 'tiktok') ? (uploadedVideoUrl || null) : null;
        if (post.platform !== 'youtube' && post.platform !== 'tiktok' && post.image) {
          if (post.image.startsWith('data:')) {
            try {
              const imgRes = await fetch('/api/social/save-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ imageUrl: post.image, description: post.content?.slice(0, 120) }),
              });
              const imgData = await imgRes.json();
              if (imgData.ok) mediaUrl = imgData.image.url;
            } catch (_) { /* continue without image */ }
          } else {
            mediaUrl = post.image;
          }
        }
        let body;
        try {
          body = JSON.stringify({
            content: applyIngredients(post.content, post.platform, aiIngredients),
            platform: post.platform,
            mediaUrl,
            scheduledFor: scheduledFor.toISOString(),
          });
        } catch (jsonErr) {
          lastError = `JSON error on post ${i + 1}: ${jsonErr.message}`;
          continue;
        }
        const res = await fetch('/api/social/create-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body,
        });
        const data = await res.json();
        if (res.ok && data.success) {
          ok++;
        } else {
          lastError = data.error || `HTTP ${res.status}`;
        }
      }
      if (ok === 0) {
        setNotice(`Failed to schedule posts. Error: ${lastError || 'unknown'}. Try signing out and back in.`);
      } else {
        clearAll();
        router.push('/modules/social_media/review');
      }
    } catch (err) {
      setNotice(err.message || 'Failed to schedule');
    } finally {
      setAiGenerating(false);
    }
  }

  // ── Computed ────────────────────────────────────────────────────────────
  const allPlatforms    = getVisiblePlatforms(postsByPlatform, getSelectedPlatforms());
  const hasGenerated    = allPlatforms.length > 0;
  const isAllView       = viewPlatform === 'all';
  const postsPerDay     = getPostsPerDay();
  const postsPerPlatformCount = getPostsPerPlatformCount();
  const viewPosts       = isAllView
    ? allPlatforms.flatMap((platform) =>
        (postsByPlatform[platform] || [])
          .slice(0, postsPerPlatformCount)
          .map((post) => ({ ...post, _viewPlatform: platform }))
      )
    : (postsByPlatform[viewPlatform] || [])
        .slice(0, postsPerPlatformCount)
        .map((post) => ({ ...post, _viewPlatform: viewPlatform }));
  const viewTheme       = isAllView
    ? { name: 'All Platforms', color: '#475569', lightBg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.28)', icon: '◉' }
    : (PLATFORM_THEME[viewPlatform] || PLATFORM_THEME.facebook);
  const campaignSlice  = postsPerPlatformCount;
  const totalApproved   = Object.values(postsByPlatform).reduce((s, posts) => s + posts.slice(0, campaignSlice).filter(p => p.approved).length, 0);
  const totalPosts      = Object.values(postsByPlatform).reduce((s, posts) => s + Math.min(posts.length, campaignSlice), 0);
  const viewApproved    = viewPosts.filter(p => p.approved).length;
  const selPlatforms    = getSelectedPlatforms();
  const totalPostCount  = postsPerPlatformCount;
  const isError         = notice.toLowerCase().includes('fail') || notice.toLowerCase().includes('error') || notice.toLowerCase().includes('openai');
  const isDraftSaved    = notice.toLowerCase().includes('saved') && notice.toLowerCase().includes('draft');
  const activeWeeks     = Array.from({ length: campaignWeeks }, (_, i) => i);
  const previewPost = previewTarget
    ? (postsByPlatform[previewTarget.platform] || []).find((post) => post.id === previewTarget.id) || null
    : null;
  const previewTheme = previewTarget ? (PLATFORM_THEME[previewTarget.platform] || PLATFORM_THEME.facebook) : PLATFORM_THEME.facebook;
  const cardVideoPreviewUrl = aiVideoLocalUrl || aiUploadedVideoUrl || '';

  useEffect(() => {
    if (viewPlatform === 'all') return;
    if (allPlatforms.includes(viewPlatform)) return;
    setViewPlatform(getDefaultViewPlatform(allPlatforms));
  }, [allPlatforms, viewPlatform]);

  function renderPostWithControls(post, platform, theme, key) {
    const busyKey = getManualImageKey(platform, post.id);
    const isBusy = manualImageBusy === busyKey;
    return (
      <div key={key}>
        <PostCard
          post={post}
          theme={theme}
          brandName={aiCampaignName || 'Your Brand'}
          videoSrc={post.platform === 'tiktok' || post.platform === 'youtube' ? cardVideoPreviewUrl : ''}
          onToggle={() => toggleApproval(platform, post.id)}
          onEdit={text => updatePost(platform, post.id, 'content', text)}
          onPreview={() => openPostPreview(platform, post.id)}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          <button onClick={() => openPostPreview(platform, post.id)} style={{ ...S.slimBtn, padding: '6px 10px', fontSize: 14 }}>Preview</button>
          <button onClick={() => chooseImageFromLibrary(platform, post.id)} style={{ ...S.slimBtn, padding: '6px 10px', fontSize: 14 }}>Media Library</button>
          <button onClick={() => chooseImageUpload(platform, post.id)} style={{ ...S.slimBtn, padding: '6px 10px', fontSize: 14 }} disabled={isBusy}>{isBusy ? 'Uploading...' : 'Upload Image'}</button>
          <button onClick={() => assignManualImage(platform, post.id, null)} style={{ ...S.slimBtn, padding: '6px 10px', fontSize: 14, opacity: post.image ? 1 : 0.5 }} disabled={!post.image}>Remove Image</button>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <Head><title>AI Content Generator | Social Media</title></Head>
      <div style={S.page}>
        <input ref={imageUploadInputRef} type="file" accept="image/*" onChange={handleManualImageUpload} style={{ display: 'none' }} />
        <div style={S.shell}>

          {/* Banner */}
          <div style={S.banner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={S.bannerIcon}>{ICONS.social({ size: 48 })}</div>
              <div>
                <h1 style={{ fontSize: 48, margin: 0, fontWeight: 600 }}>AI Content Generator</h1>
                <p style={{ margin: 0, opacity: 0.8, fontSize: 18 }}>Generate platform-specific posts based on your campaign duration and daily posting rate.</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <button onClick={() => router.push('/modules/social_media/dashboard')} style={S.backBtn}>Back to Dashboard</button>
              <button onClick={() => router.push('/modules/social_media/review')}
                style={{ ...S.backBtn, background: 'rgba(209, 29, 185, 0.98)', borderColor: 'rgba(59,130,246,0.5)', color: '#edf2f7' }}>
                Review &amp; Schedule →
              </button>
            </div>
          </div>

          {notice && (
            <div style={{ ...S.notice, background: isError ? 'rgba(239,68,68,0.12)' : isDraftSaved ? 'rgba(59,130,246,0.12)' : 'rgba(34,197,94,0.12)', borderColor: isError ? 'rgba(239,68,68,0.4)' : isDraftSaved ? 'rgba(59,130,246,0.4)' : 'rgba(34,197,94,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span>{notice}</span>
              {isDraftSaved && (
                <button onClick={() => router.push('/modules/social_media/review')}
                  style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: 'rgba(59,130,246,0.4)', color: '#BFDBFE', fontWeight: 600, fontSize: 16, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Review Drafts →
                </button>
              )}
            </div>
          )}

          {/* ── SETTINGS — 2 col, full banner width ── */}
          <div style={S.settingsGrid}>

            {/* LEFT column */}
            <div style={S.settingsCol}>

              {/* Campaign preset */}
              <div style={S.card}>
                <div style={S.cardLabel}>Campaign Preset</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'flex-end' }}>
                  <div>
                    <label style={S.label}>Campaign Name</label>
                    <input value={aiCampaignName} onChange={e => setAiCampaignName(e.target.value)} placeholder="e.g. April SEO Push" style={S.input} />
                  </div>
                  <button onClick={saveCampaign} style={{ ...S.slimBtn, alignSelf: 'flex-end' }}>Save</button>
                  <div style={{ position: 'relative', alignSelf: 'flex-end' }}>
                    <button onClick={() => setShowCampaignDropdown(v => !v)} style={S.slimBtn}>
                      Load {savedCampaigns.length > 0 ? `(${savedCampaigns.length})` : ''}
                    </button>
                    {showCampaignDropdown && (
                      <div style={S.dropdown}>
                        {savedCampaigns.length === 0
                          ? <div style={{ padding: 8, color: 'rgba(207, 152, 32, 0.5)', fontSize: 18 }}>No saved campaigns yet.</div>
                          : savedCampaigns.map(c => (
                            <div key={c.id} style={S.dropdownRow}>
                              <button onClick={() => loadCampaign(c)} style={{ background: 'none', border: 'none', color: '#c084fc', cursor: 'pointer', fontSize: 18, fontWeight: 600, padding: 0 }}>{c.name}</button>
                              <button onClick={() => deleteSavedCampaign(c.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 18 }}>✕</button>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Topic */}
              <div style={S.card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={S.cardLabel}>Topic / Niche</div>
                  <button
                    onClick={() => setDoNotRewrite(v => !v)}
                    style={{ padding: '5px 14px', borderRadius: 8, border: `1px solid ${doNotRewrite ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.15)'}`, background: doNotRewrite ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)', color: doNotRewrite ? '#FCD34D' : 'rgba(255,255,255,0.45)', fontWeight: 600, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {doNotRewrite ? '✋ Do Not Rewrite: ON' : 'Do Not Rewrite'}
                  </button>
                </div>
                {doNotRewrite && (
                  <p style={{ margin: '0 0 8px', fontSize: 14, color: '#FCD34D', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8, padding: '8px 12px' }}>
                    AI will use your text exactly as written — paste your content, website copy or existing posts below. Each paragraph becomes one post.
                  </p>
                )}
                <textarea
                  value={aiTopic}
                  onChange={e => setAiTopic(e.target.value)}
                  placeholder={doNotRewrite ? 'Paste your content here. Each paragraph (separated by a blank line) will become one post.' : 'Describe exactly what you want. e.g. Posts about SEO for small businesses — educational tips, statistics, success stories and calls-to-action. Include questions that drive engagement.'}
                  style={{ ...S.input, minHeight: doNotRewrite ? 180 : 100, resize: 'vertical' }}
                />
              </div>

              {/* Content type + Platforms */}
              <div style={S.card}>
                <div style={S.cardLabel}>Social Platforms</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={S.label}>Content Type</label>
                    <select value={aiContentType} onChange={e => {
                      const t = e.target.value;
                      setAiContentType(t);
                    }} style={S.input}>
                      <option value="standard">Standard (text + image)</option>
                      <option value="video">Video (TikTok / YouTube)</option>
                    </select>
                    {aiContentType === 'video' && (
                      <div style={{ marginTop: 8, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 8 }}>
                        <label style={S.label}>Upload Video (optional)</label>
                        <input type="file" accept="video/*" onChange={e => {
                          const file = e.target.files?.[0] || null;
                          setAiVideoFile(file);
                          setAiUploadedVideoUrl('');
                          if (aiVideoLocalUrl) URL.revokeObjectURL(aiVideoLocalUrl);
                          setAiVideoLocalUrl(file ? URL.createObjectURL(file) : '');
                        }} style={{ ...S.input, padding: 5 }} />
                        {aiVideoLocalUrl && <video src={aiVideoLocalUrl} controls style={{ width: '100%', borderRadius: 6, marginTop: 6, maxHeight: 140 }} />}
                        {!aiVideoFile && <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', margin: '4px 0 0' }}>No video — AI will generate video-style captions.</p>}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={S.label}>Platforms to generate for</label>
                    <div style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 18, rowGap: 14 }}>
                        {PLATFORM_OPTIONS.map((opt, index) => {
                          const theme = PLATFORM_THEME[opt.key];
                          const selected = !!aiSelectedPlatforms[opt.key];
                          const isRightColumn = index % 2 === 1;
                          return (
                            <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, cursor: 'pointer', position: 'relative', minHeight: 32, padding: '4px 0', paddingLeft: isRightColumn ? 18 : 0, opacity: 1 }}>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={e => setAiSelectedPlatforms(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                                style={{
                                  position: 'absolute',
                                  opacity: 0,
                                  inset: 0,
                                  margin: 0,
                                  cursor: 'pointer',
                                }}
                              />
                              <span
                                aria-hidden="true"
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: 4,
                                  border: `2px solid ${selected ? (theme?.color || '#fff') : 'rgba(255,255,255,0.45)'}`,
                                  background: selected ? (theme?.color || '#fff') : 'transparent',
                                  color: '#fff',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 14,
                                  fontWeight: 900,
                                  lineHeight: 1,
                                  flexShrink: 0,
                                  boxSizing: 'border-box',
                                }}
                              >
                                {selected ? '✓' : ''}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: 1, color: '#fff' }}>
                                {PLATFORM_LOGO[opt.key]
                                  ? <img src={PLATFORM_LOGO[opt.key]} alt={opt.label} style={{ width: 20, height: 20, borderRadius: 4, opacity: 1, filter: 'none' }} />
                                  : <span style={{ opacity: 1 }}>{theme?.icon}</span>}
                                {opt.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT column */}
            <div style={S.settingsCol}>

              {/* Generation settings */}
              <div style={S.card}>
                <div style={S.cardLabel}>Generation Settings</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Style',          val: aiStyle,        set: setAiStyle,        opts: ['engaging','professional','funny','motivational','educational','promotional'] },
                    { label: 'Post Length',     val: aiLength,       set: setAiLength,       opts: [{v:'short',l:'Short and punchy'},{v:'long',l:'Longer and explanatory'}] },
                    { label: 'Hashtag Density', val: aiHashtagLevel, set: setAiHashtagLevel, opts: [{v:'medium',l:'Medium'},{v:'high',l:'Standard'},{v:'max',l:'Maximum'}] },
                    { label: 'Schedule Mode',   val: aiScheduleMode, set: setAiScheduleMode, opts: [{v:'daily',l:'1 post per day'},{v:'twice',l:'2 posts per day'}] },
                  ].map(({ label, val, set, opts }) => (
                    <div key={label}>
                      <label style={S.label}>{label}</label>
                      <select value={val} onChange={e => set(e.target.value)} style={S.input}>
                        {opts.map(o => typeof o === 'string'
                          ? <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                          : <option key={o.v} value={o.v}>{o.l}</option>
                        )}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label style={S.label}>Image Count (0 to 30)</label>
                    <input type="number" min={0} max={30} value={aiImageCount} onChange={e => setAiImageCount(Math.max(0, Math.min(30, Number(e.target.value) || 0)))} style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Image Creative Type</label>
                    <select value={aiImageCreativeType} onChange={e => setAiImageCreativeType(e.target.value)} style={S.input}>
                      <option value="realistic">Realistic photo ad</option>
                      <option value="graphic">Graphic design ad</option>
                      <option value="mixed">Mixed variety</option>
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Text On Image</label>
                    <select value={aiImageTextMode} onChange={e => setAiImageTextMode(e.target.value)} style={S.input}>
                      <option value="headline-supporting">Headline + supporting text</option>
                      <option value="headline-only">Headline only</option>
                      <option value="minimal">Short minimal text</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                  Realistic uses photo-style ads, Graphic uses designed promotional layouts, and Mixed alternates both. Text is added after generation so it stays readable.
                </div>
                {/* Campaign duration */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={S.cardLabel}>Campaign Duration</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={S.label}>Weeks</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[1,2,3,4].map(w => (
                          <button key={w} onClick={() => setCampaignWeeks(w)}
                            style={{ flex: 1, padding: '11px 0', borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: 16,
                              background: campaignWeeks === w ? 'rgba(129,38,233,0.35)' : 'rgba(255,255,255,0.05)',
                              border: `1.5px solid ${campaignWeeks === w ? 'rgba(129,38,233,0.6)' : 'rgba(255,255,255,0.1)'}`,
                              color: campaignWeeks === w ? '#c084fc' : '#fff' }}>
                            {w}w
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={S.label}>Posts per week</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[1,3,5,7].map(d => (
                          <button key={d} onClick={() => setCampaignDays(d)}
                            style={{ flex: 1, padding: '11px 4px', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: 16,
                              background: campaignDays === d ? 'rgba(129,38,233,0.35)' : 'rgba(255,255,255,0.05)',
                              border: `1.5px solid ${campaignDays === d ? 'rgba(129,38,233,0.6)' : 'rgba(255,255,255,0.1)'}`,
                              color: campaignDays === d ? '#c084fc' : '#fff' }}>
                            {d === 7 ? '7 (daily)' : d === 5 ? '5 (weekdays)' : d === 3 ? '3 (MWF)' : '1 (weekly)'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 16, color: 'rgba(255,255,255,0.55)' }}>
                    {campaignWeeks} week{campaignWeeks > 1 ? 's' : ''} × {campaignDays} day{campaignDays > 1 ? 's' : ''} × {postsPerDay} post{postsPerDay > 1 ? 's' : ''} per day = <strong style={{ color: '#c084fc' }}>{postsPerPlatformCount} posts</strong> per platform
                  </div>
                </div>
              </div>

              {/* Post Ingredients — collapsible */}
              <div style={S.card}>
                <button onClick={() => setShowIngredients(v => !v)} style={{ ...S.toggleBtn, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#e2e8f0' }}>Post Ingredients — CTA / URL / Phone</span>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16 }}>{showIngredients ? '▲ Hide' : '▼ Show'}</span>
                </button>
                {showIngredients && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', margin: '0 0 12px' }}>Appended to every scheduled post, formatted per platform.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        { key: 'websiteUrl', label: 'Website URL',  ph: 'https://yoursite.com' },
                        { key: 'ctaUrl',     label: 'CTA URL',      ph: 'https://yoursite.com/offer' },
                        { key: 'formUrl',    label: 'Form URL',     ph: 'https://yoursite.com/form' },
                        { key: 'phone',      label: 'Phone',        ph: '(555) 123-4567' },
                        { key: 'extraLine',  label: 'Extra line',   ph: 'Reply INFO for details' },
                      ].map(({ key, label, ph }) => (
                        <div key={key}>
                          <label style={S.label}>{label}</label>
                          <input value={aiIngredients[key]} onChange={e => setAiIngredients(p => ({ ...p, [key]: e.target.value }))} placeholder={ph} style={S.input} />
                        </div>
                      ))}
                      <div>
                        <label style={S.label}>CTA Text</label>
                        <select value={aiIngredients.ctaText} onChange={e => setAiIngredients(p => ({ ...p, ctaText: e.target.value }))} style={S.input}>
                          {['Book a Call','Get a Quote','Learn More','Shop Now','Download'].map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Lead Capture Form — collapsible */}
              <div style={S.card}>
                <button onClick={() => setShowLeadForm(v => !v)} style={{ ...S.toggleBtn, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#e2e8f0' }}>Lead Capture Form Builder</span>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>{showLeadForm ? '▲ Hide' : '▼ Show'}</span>
                </button>
                {showLeadForm && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)' }}>Append form questions to post descriptions</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 16 }}>
                        <input type="checkbox" checked={aiLeadForm.enabled} onChange={e => setAiLeadForm(p => ({ ...p, enabled: e.target.checked }))} style={{ width: 22, height: 22, accentColor: '#4ade80', cursor: 'pointer', flexShrink: 0 }} />
                        Enable
                      </label>
                    </div>
                    {aiLeadForm.enabled && (
                      <div>
                        <label style={S.label}>Form Title</label>
                        <input value={aiLeadForm.title} onChange={e => setAiLeadForm(p => ({ ...p, title: e.target.value }))} style={{ ...S.input, marginBottom: 10 }} />
                        {aiLeadForm.questions.map((q, idx) => (
                          <div key={q.id} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7, padding: 8, marginBottom: 7 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 6, alignItems: 'center' }}>
                              <input value={q.question} onChange={e => setAiLeadForm(p => ({ ...p, questions: p.questions.map(qq => qq.id === q.id ? { ...qq, question: e.target.value } : qq) }))} style={{ ...S.input, marginTop: 0 }} placeholder={`Question ${idx + 1}`} />
                              <select value={q.type} onChange={e => setAiLeadForm(p => ({ ...p, questions: p.questions.map(qq => qq.id === q.id ? { ...qq, type: e.target.value } : qq) }))} style={{ ...S.input, marginTop: 0 }}>
                                <option value="yesno">Yes / No</option>
                                <option value="text">Short Answer</option>
                                <option value="multiple">Multiple Choice</option>
                              </select>
                              <button onClick={() => setAiLeadForm(p => ({ ...p, questions: p.questions.filter(qq => qq.id !== q.id) }))} style={{ ...S.slimBtn, padding: '5px 9px', color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>x</button>
                            </div>
                          </div>
                        ))}
                        <button onClick={() => setAiLeadForm(p => ({ ...p, questions: [...p.questions, { id: `q-${Date.now()}`, question: '', type: 'yesno', options: [] }] }))} style={S.slimBtn}>+ Add Question</button>

                        {/* ── Form Template Save / Load ── */}
                        <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
                          <span style={{ ...S.cardLabel, fontSize: 13, marginBottom: 8 }}>Form Templates</span>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                            <input
                              value={formTemplateName}
                              onChange={e => setFormTemplateName(e.target.value)}
                              placeholder={aiLeadForm.title || 'Template name…'}
                              style={{ ...S.input, flex: 1, minWidth: 140, fontSize: 14, padding: '7px 10px' }}
                            />
                            <button onClick={saveFormTemplate} style={{ ...S.slimBtn, fontSize: 14 }}>Save Template</button>
                            <div style={{ position: 'relative' }}>
                              <button
                                onClick={() => setShowFormDropdown(v => !v)}
                                style={{ ...S.slimBtn, fontSize: 14 }}
                              >
                                Load {savedForms.length > 0 ? `(${savedForms.length})` : ''} ▾
                              </button>
                              {showFormDropdown && (
                                <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 30, background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, minWidth: 220, marginTop: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                                  {savedForms.length === 0
                                    ? <div style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No saved form templates</div>
                                    : savedForms.map(f => (
                                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                        <button onClick={() => loadFormTemplate(f)} style={{ flex: 1, background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer', textAlign: 'left', fontSize: 14 }}>{f.displayName}</button>
                                        <button onClick={() => deleteFormTemplate(f.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Generate buttons — full width */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 36 }}>
            <button
              onClick={generateAIContent}
              disabled={aiGenerating}
              style={{ ...S.primaryBtn, flex: 3, fontSize: 16, padding: 16, opacity: aiGenerating ? 0.6 : 1 }}
            >
              {aiGenerating ? 'Generating...' : `Generate ${selPlatforms.length * totalPostCount} Posts — ${selPlatforms.length} platform${selPlatforms.length !== 1 ? 's' : ''} × ${totalPostCount} posts (${campaignWeeks}w × ${campaignDays}d × ${postsPerDay}/day)`}
            </button>
            <button
              onClick={generateAIImagesOnly}
              disabled={aiGenerating || !aiTopic.trim()}
              style={{ ...S.slimBtn, flex: 1, fontSize: 16, padding: '16px 12px', opacity: (aiGenerating || !aiTopic.trim()) ? 0.4 : 1 }}
            >
              {aiGenerating ? '...' : `Generate Images (${aiImageCount})`}
            </button>
          </div>

          {/* ── GENERATED CONTENT — full width ── */}
        </div>
        {hasGenerated && (
          <div style={{ padding: '0 22px' }}>

              {/* Platform tab selector */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 16, opacity: 0.7, marginRight: 4 }}>Platform:</span>
                {allPlatforms.length > 1 && (
                  <button
                    onClick={() => setViewPlatform('all')}
                    style={{
                      background: isAllView ? '#475569' : 'rgba(148,163,184,0.12)',
                      border: `1.5px solid ${isAllView ? '#475569' : 'rgba(148,163,184,0.28)'}`,
                      color: '#fff',
                      padding: '6px 14px',
                      borderRadius: 20,
                      cursor: 'pointer',
                      fontSize: 16,
                      fontWeight: isAllView ? 600 : 400,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>◉</span>
                    All Platforms
                    {isAllView && viewApproved > 0 && (
                      <span style={{ background: 'rgba(34,197,94,0.25)', border: '1px solid rgba(34,197,94,0.5)', borderRadius: 10, padding: '1px 6px', fontSize: 16 }}>
                        {viewApproved}
                      </span>
                    )}
                  </button>
                )}
                {allPlatforms.map(plat => {
                  const t = PLATFORM_THEME[plat] || PLATFORM_THEME.facebook;
                  const logo = PLATFORM_LOGO[plat];
                  const approved = countSelectedWithinLimit(postsByPlatform[plat] || [], postsPerPlatformCount);
                  const isActive = viewPlatform === plat;
                  return (
                    <button
                      key={plat}
                      onClick={() => setViewPlatform(plat)}
                      style={{
                        background: isActive ? t.color : t.lightBg,
                        border: `1.5px solid ${isActive ? t.color : t.border}`,
                        color: '#fff',
                        padding: '6px 14px',
                        borderRadius: 20,
                        cursor: 'pointer',
                        fontSize: 16,
                        fontWeight: isActive ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {logo
                        ? <img src={logo} alt={t.name} style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }} />
                        : <span style={{ fontSize: 16 }}>{t.icon}</span>}
                      {t.name}
                      {approved > 0 && (
                        <span style={{ background: 'rgba(34,197,94,0.25)', border: '1px solid rgba(34,197,94,0.5)', borderRadius: 10, padding: '1px 6px', fontSize: 16 }}>
                          {approved}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Action + schedule bar */}
              <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)' }}>
                  <strong style={{ color: totalApproved > 0 ? '#86efac' : 'inherit' }}>{totalApproved}</strong> of {totalPosts} selected total
                  {viewApproved > 0 && <span style={{ opacity: 0.55 }}> · {viewApproved} selected in {viewTheme.name}</span>}
                </div>
                <button onClick={approveAllView} style={{ ...S.slimBtn, fontSize: 16, padding: '5px 10px' }}>{isAllView ? 'Select Visible Posts' : `Select ${viewTheme.name}`}</button>
                <button onClick={approveAll}     style={{ ...S.slimBtn, fontSize: 16, padding: '5px 10px' }}>Select All Platforms</button>
                <button onClick={clearAll}       style={{ ...S.slimBtn, fontSize: 16, padding: '5px 10px', opacity: 0.75 }}>Clear Selection</button>
                <button onClick={deleteSelected} disabled={totalApproved === 0} style={{ ...S.slimBtn, fontSize: 16, padding: '5px 10px', borderColor: 'rgba(248,113,113,0.4)', color: '#fca5a5', opacity: totalApproved === 0 ? 0.45 : 1 }}>Delete Selected</button>
                <div style={{ flex: 1 }} />
                <label style={S.label}>Start date</label>
                <input type="date" value={aiScheduleStartDate} onChange={e => setAiScheduleStartDate(e.target.value)} style={{ ...S.input, width: 'auto', fontSize: 16, padding: '7px 10px' }} />
                <label style={S.label}>First post</label>
                <input type="time" value={aiScheduleTime}      onChange={e => setAiScheduleTime(e.target.value)}      style={{ ...S.input, width: 'auto', fontSize: 16, padding: '7px 10px' }} />
                {aiScheduleMode === 'twice' && (
                  <>
                    <label style={S.label}>Second post</label>
                    <input type="time" value={aiScheduleSecondTime} onChange={e => setAiScheduleSecondTime(e.target.value)} style={{ ...S.input, width: 'auto', fontSize: 16, padding: '7px 10px' }} />
                  </>
                )}
                <button
                  onClick={saveDrafts}
                  disabled={aiGenerating || totalApproved === 0}
                  style={{ ...S.primaryBtn, width: 'auto', padding: '9px 20px', fontSize: 16, background: 'rgba(59,130,246,0.18)', borderColor: 'rgba(59,130,246,0.4)', color: '#93C5FD', opacity: (aiGenerating || totalApproved === 0) ? 0.4 : 1 }}
                >
                  {aiGenerating ? 'Saving...' : `💾 Save ${totalApproved} Selected`}
                </button>
                <button
                  onClick={scheduleApproved}
                  disabled={aiGenerating || !aiScheduleStartDate || totalApproved === 0}
                  style={{ ...S.primaryBtn, width: 'auto', padding: '9px 20px', fontSize: 16, background: 'rgba(34,197,94,0.18)', borderColor: 'rgba(34,197,94,0.4)', color: '#86efac', opacity: (!aiScheduleStartDate || totalApproved === 0) ? 0.4 : 1 }}
                >
                  {aiGenerating ? 'Scheduling...' : `Schedule ${totalApproved} Selected`}
                </button>
              </div>

              {isAllView ? (
                <div>
                  <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>
                    Showing every generated post together across all selected platforms.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 180px))', justifyContent: 'start', gap: 10 }}>
                    {viewPosts.map(post => {
                      const postTheme = PLATFORM_THEME[post._viewPlatform] || PLATFORM_THEME.facebook;
                      const logo = PLATFORM_LOGO[post._viewPlatform];
                      return (
                        <div key={`${post._viewPlatform}-${post.id}`}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '0 4px' }}>
                            {logo
                              ? <img src={logo} alt={postTheme.name} style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }} />
                              : <span style={{ fontSize: 16 }}>{postTheme.icon}</span>}
                            <span style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>{postTheme.name}</span>
                          </div>
                          {renderPostWithControls(post, post._viewPlatform, postTheme, `${post._viewPlatform}-${post.id}`)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  {/* Day column headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: `50px repeat(7, 1fr)`, gap: 5, marginBottom: 4 }}>
                    <div />
                    {DAYS.map(d => (
                      <div key={d} style={{ textAlign: 'center', fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.55)', padding: '5px 0', background: viewTheme.lightBg, borderRadius: 4 }}>
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Week rows driven by campaign duration and posts-per-day */}
                  {activeWeeks.map(wIdx => {
                    const weekPosts = viewPosts.slice(wIdx * campaignDays * postsPerDay, (wIdx + 1) * campaignDays * postsPerDay);
                    return (
                      <div key={wIdx} style={{ display: 'grid', gridTemplateColumns: `50px repeat(7, 1fr)`, gap: 5, marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8 }}>
                          <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                            Wk {wIdx + 1}
                          </span>
                        </div>
                        {Array.from({ length: campaignDays }).flatMap((_, dayIdx) => {
                          const dayPosts = weekPosts.slice(dayIdx * postsPerDay, (dayIdx + 1) * postsPerDay);
                          return [
                            <div key={`day-${wIdx}-${dayIdx}`} style={{ display: 'grid', gap: 5 }}>
                              {dayPosts.map(post => (
                                renderPostWithControls(post, viewPlatform, viewTheme, post.id)
                              ))}
                              {Array.from({ length: postsPerDay - dayPosts.length }).map((_, slotIdx) => (
                                <div key={`empty-slot-${wIdx}-${dayIdx}-${slotIdx}`} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.05)', minHeight: 140 }} />
                              ))}
                            </div>
                          ];
                        })}
                        {Array.from({ length: 7 - campaignDays }).map((_, i) => (
                          <div key={`empty-${i}`} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.05)', minHeight: 140 }} />
                        ))}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Image strip */}
              {aiImages.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>Generated images ({aiImages.length}) — distributed across all platform posts</div>
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                    {aiImages.map((img, i) => (
                      <img key={i} src={img.url} alt="" onError={e => { e.currentTarget.style.display = 'none'; }}
                        style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 7, border: '1.5px solid rgba(139,92,246,0.4)', flexShrink: 0 }} />
                    ))}
                  </div>
                </div>
              )}

              {previewPost && (
                <div style={S.previewBackdrop} onClick={closePostPreview}>
                  <div style={S.previewModal} onClick={(event) => event.stopPropagation()}>
                    <div style={S.previewHeader}>
                      <div>
                        <div style={S.previewEyebrow}>{previewTheme.name} Preview</div>
                        <div style={S.previewTitle}>Review and edit before scheduling</div>
                      </div>
                      <button onClick={closePostPreview} style={S.previewCloseBtn}>Close</button>
                    </div>
                    <div style={S.previewImageWrap}>
                      {previewPost.image
                        ? <img src={previewPost.image} alt="Preview" style={S.previewImage} />
                        : <div style={S.previewImageEmpty}>No image assigned yet.</div>}
                    </div>
                    <div style={S.previewActionsRow}>
                      <button onClick={() => chooseImageFromLibrary(previewTarget.platform, previewTarget.id)} style={S.slimBtn}>Media Library</button>
                      <button onClick={() => chooseImageUpload(previewTarget.platform, previewTarget.id)} style={S.slimBtn} disabled={manualImageBusy === getManualImageKey(previewTarget.platform, previewTarget.id)}>
                        {manualImageBusy === getManualImageKey(previewTarget.platform, previewTarget.id) ? 'Uploading...' : 'Upload Image'}
                      </button>
                      <button onClick={() => setPreviewEditingImage((value) => !value)} style={S.slimBtn} disabled={!previewPost.image}>
                        {previewEditingImage ? 'Hide Image Editor' : 'Edit Image'}
                      </button>
                      <button onClick={() => assignManualImage(previewTarget.platform, previewTarget.id, null)} style={{ ...S.slimBtn, opacity: previewPost.image ? 1 : 0.5 }} disabled={!previewPost.image}>Remove Image</button>
                    </div>
                    <label style={S.label}>Post Copy</label>
                    <textarea
                      value={previewPost.content}
                      onChange={(event) => updatePost(previewTarget.platform, previewTarget.id, 'content', event.target.value)}
                      style={{ ...S.input, minHeight: 150, resize: 'vertical' }}
                    />
                    {previewEditingImage && previewPost.image && (
                      <div style={{ marginTop: 14 }}>
                        <ImageEditorCard initialSrc={previewPost.image} onSave={saveEditedPreviewImage} saveLabel="Apply Edited Image" />
                      </div>
                    )}
                  </div>
                </div>
              )}

          </div>
        )}

      </div>
    </>
  );
}

const S = {
  page:        { minHeight: '100vh', background: '#0c121a', color: '#fff', padding: '28px 22px', fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif' },
  shell:       { width: '100%', maxWidth: 1320, margin: '0 auto' },
  banner:      { background: 'linear-gradient(135deg,#8126e9 0%, #2123b6 100%)', padding: '20px 28px', borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  bannerIcon:  { width: 60, height: 60, background: 'rgba(0,0,0,0.2)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  backBtn:     { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 16 },
  notice:      { border: '1px solid', padding: '12px 18px', borderRadius: 10, marginBottom: 18, fontSize: 16 },
  settingsGrid:{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 },
  settingsCol: { display: 'flex', flexDirection: 'column', gap: 14 },
  card:        { background: '#111827', padding: 20, borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' },
  cardLabel:   { fontSize: 24, fontWeight: 600, color: '#c2410c', letterSpacing: 0.5, marginBottom: 14, textTransform: 'uppercase' },
  label:       { fontSize: 16, color: '#2a8ee0', display: 'block', marginBottom: 5, fontWeight: 500 },
  input:       { width: '100%', background: '#0c121a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 12px', borderRadius: 7, fontSize: 16, boxSizing: 'border-box' },
  primaryBtn:  { width: '100%', background: 'rgba(129,38,233,0.2)', border: '1px solid rgba(129,38,233,0.4)', color: '#c084fc', padding: 14, borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 16 },
  slimBtn:     { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '9px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 16, whiteSpace: 'nowrap' },
  toggleBtn:   { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, fontSize: 16 },
  dropdown:    { position: 'absolute', top: '110%', right: 0, zIndex: 50, background: '#1F2937', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 8, minWidth: 240, maxHeight: 280, overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' },
  dropdownRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 6px', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  previewBackdrop:{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.82)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  previewModal:{ width: 'min(1100px, 96vw)', maxHeight: '92vh', overflowY: 'auto', background: '#0f172a', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 18, padding: 18, boxShadow: '0 30px 80px rgba(0,0,0,0.45)' },
  previewHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  previewEyebrow:{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 },
  previewTitle:{ fontSize: 22, fontWeight: 700, color: '#f8fafc' },
  previewCloseBtn:{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.3)', background: 'rgba(15,23,42,0.8)', color: '#e2e8f0', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  previewImageWrap:{ marginBottom: 14, background: '#020617', borderRadius: 16, border: '1px solid rgba(148,163,184,0.16)', overflow: 'hidden', minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  previewImage:{ width: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block', background: '#020617' },
  previewImageEmpty:{ color: '#94a3b8', fontSize: 16, padding: 32 },
  previewActionsRow:{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
};
