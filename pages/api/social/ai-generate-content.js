// /pages/api/social/ai-generate-content.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 28 per platform = monthly pack
const DEFAULT_POSTS_PER_PLATFORM = 28;

// platforms you want
const ALLOWED_PLATFORMS = ['facebook', 'instagram', 'linkedin', 'pinterest', 'x', 'tiktok'];

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function sanitizePlatform(platform) {
  const p = String(platform || '').trim().toLowerCase();
  return ALLOWED_PLATFORMS.includes(p) ? p : 'facebook';
}

function parseHashtagLevel(level) {
  const normalized = String(level || 'high').toLowerCase();
  if (normalized === 'medium') return { min: 4, max: 6 };
  if (normalized === 'max') return { min: 10, max: 14 };
  return { min: 7, max: 10 };
}

function extractHashtags(text) {
  const matches = String(text || '').match(/#[a-z0-9_]+/gi) || [];
  const deduped = [];
  matches.forEach((tag) => {
    const lower = tag.toLowerCase();
    if (!deduped.some((t) => t.toLowerCase() === lower)) deduped.push(tag);
  });
  return deduped;
}

function fallbackHashtagPool(topic) {
  const topicWords = String(topic || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((w) => `#${w}`);
  return [
    ...topicWords,
    '#socialmedia',
    '#marketing',
    '#contentcreator',
    '#smallbusiness',
    '#growth',
    '#brandawareness',
    '#digitalmarketing',
    '#businesstips',
    '#audiencegrowth',
    '#onlinebusiness',
    '#entrepreneur'
  ];
}

function withHashtags(text, topic, hashtagLevel) {
  const { min, max } = parseHashtagLevel(hashtagLevel);
  const content = String(text || '').trim();
  const found = extractHashtags(content);
  const pool = fallbackHashtagPool(topic);

  const desired = clamp(found.length || min, min, max);
  const tags = [...found];
  for (let i = 0; i < pool.length && tags.length < desired; i += 1) {
    const candidate = pool[i];
    if (!tags.some((t) => t.toLowerCase() === candidate.toLowerCase())) {
      tags.push(candidate);
    }
  }

  const withoutTags = content.replace(/#[a-z0-9_]+/gi, '').replace(/\s+/g, ' ').trim();
  return `${withoutTags}\n\n${tags.join(' ')}`.trim();
}

function parseAiJson(raw) {
  const input = String(raw || '').trim().replace(/```json/gi, '').replace(/```/g, '');

  try {
    const direct = JSON.parse(input);
    if (Array.isArray(direct)) return direct;
    if (Array.isArray(direct?.posts)) return direct.posts;
  } catch {}

  const startArr = input.indexOf('[');
  const endArr = input.lastIndexOf(']');
  if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
    try {
      return JSON.parse(input.slice(startArr, endArr + 1));
    } catch {}
  }

  return [];
}

function platformRules(platform, contentLength) {
  const p = sanitizePlatform(platform);

  const longRule = 'Write 3-5 clear sentences. Make it practical, specific, and helpful.';
  const shortRule = 'Write 1-2 short, punchy sentences. Keep it high-impact and easy to skim.';
  const baseLengthRule = contentLength === 'long' ? longRule : shortRule;

  if (p === 'x') {
    return [
      'Hard limit: 260 characters max.',
      'No more than 2 hashtags.',
      'Punchy, direct, scroll-stopping.',
      baseLengthRule
    ].join('\n');
  }

  if (p === 'linkedin') {
    return [
      'Professional tone. No hype.',
      'Use short paragraphs or bullets when helpful.',
      'Use 0-5 hashtags max.',
      baseLengthRule
    ].join('\n');
  }

  if (p === 'instagram') {
    return [
      'Make it visually readable: short lines, strong hook.',
      'Encourage saves/shares.',
      'Hashtags are okay (moderate to high).',
      baseLengthRule
    ].join('\n');
  }

  if (p === 'pinterest') {
    return [
      'Write like a Pin description: SEO-friendly keywords, clear benefit.',
      'End with a “click to learn more” line.',
      'Use 0-3 hashtags (optional).',
      baseLengthRule
    ].join('\n');
  }

  return [
    'Conversational tone.',
    'End with a question to drive comments when appropriate.',
    baseLengthRule
  ].join('\n');
}

function hashtagDirective(platform, hashtagLevel) {
  const p = sanitizePlatform(platform);
  if (p === 'x') return 'Use 0-2 hashtags.';
  if (p === 'linkedin') return 'Use 0-5 relevant hashtags.';
  if (p === 'pinterest') return 'Use 0-3 hashtags (optional).';

  if (hashtagLevel === 'max') return 'Use 10-14 relevant hashtags per post.';
  if (hashtagLevel === 'medium') return 'Use 4-6 relevant hashtags per post.';
  return 'Use 7-10 relevant hashtags per post.';
}

function buildPromptForPlatform({
  topic,
  platform,
  count,
  style,
  contentLength,
  hashtagLevel,
  excludeSamples = []
}) {
  const p = sanitizePlatform(platform);

  const exclusionText = excludeSamples.length
    ? `Avoid repeating these examples:\n${excludeSamples.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : '';

  return `Generate EXACTLY ${count} ${p.toUpperCase()} posts about: "${topic}".

IMPORTANT: Use Australian English spelling throughout. Examples: colour (not color), behaviour (not behavior), organise (not organize), realise (not realize), centre (not center), analyse (not analyse), apologise (not apologize), programme (not program), travelling (not traveling), licence (noun), practice (noun) / practise (verb).

Tone/style: ${style}

Platform rules:
${platformRules(p, contentLength)}

Hashtags directive:
${hashtagDirective(p, hashtagLevel)}

Each item MUST include:
- "content": full post text (include hashtags at the end if using them)
- "platform": "${p}"
- "tone": concise descriptor matching requested style

${exclusionText}

Return ONLY valid JSON in this exact shape:
{
  "posts": [
    { "content": "...", "platform": "${p}", "tone": "..." }
  ]
}

No markdown. No prose outside JSON.`;
}

async function requestPostsFromOpenAI(openaiKey, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Return only strict JSON with a posts array. Use Australian English spelling.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 7000
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const msg = error?.error?.message || error?.error?.code || `HTTP ${response.status}`;
    console.error('OpenAI error:', error);
    throw new Error(`OpenAI: ${msg}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  return parseAiJson(content);
}

async function generateForPlatform({
  openaiKey,
  topic,
  platform,
  count,
  style,
  contentLength,
  hashtagLevel
}) {
  const requestedCount = clamp(Number(count) || DEFAULT_POSTS_PER_PLATFORM, 1, 60);

  const firstPrompt = buildPromptForPlatform({
    topic,
    platform,
    count: requestedCount,
    style,
    contentLength,
    hashtagLevel,
    excludeSamples: []
  });

  let posts = await requestPostsFromOpenAI(openaiKey, firstPrompt);

  if (posts.length < requestedCount) {
    const missing = requestedCount - posts.length;
    const secondPrompt = buildPromptForPlatform({
      topic,
      platform,
      count: missing,
      style,
      contentLength,
      hashtagLevel,
      excludeSamples: posts.slice(0, 10).map((p) => String(p?.content || '').slice(0, 180))
    });
    const topUp = await requestPostsFromOpenAI(openaiKey, secondPrompt);
    posts = [...posts, ...topUp];
  }

  const normalized = posts
    .map((p) => ({
      content: withHashtags(p?.content || '', topic, hashtagLevel),
      platform: sanitizePlatform(platform),
      tone: String(p?.tone || style || 'engaging').trim() || 'engaging'
    }))
    .filter((p) => p.content.length > 0)
    .slice(0, requestedCount);

  const basePoolSize = normalized.length;
  while (normalized.length < requestedCount && basePoolSize > 0) {
    const seed = normalized[normalized.length % basePoolSize];
    normalized.push({ ...seed });
  }

  return normalized;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      topic,
      style = 'engaging',
      contentLength = 'short',
      hashtagLevel = 'high',
      userId,

      // new params
      postsPerPlatform = DEFAULT_POSTS_PER_PLATFORM,
      platforms = ['facebook', 'instagram', 'linkedin', 'pinterest', 'x'],

      // skip AI rewriting — use topic text verbatim
      doNotRewrite = false,

      // recommended: preview only
      saveDrafts = false
    } = req.body;

    if (!topic || topic.trim().length === 0) return res.status(400).json({ error: 'Topic is required' });
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const safePlatforms = Array.isArray(platforms) && platforms.length
      ? platforms.map(sanitizePlatform)
      : ['facebook', 'instagram', 'linkedin', 'pinterest', 'x'];

    const count = clamp(Number(postsPerPlatform) || DEFAULT_POSTS_PER_PLATFORM, 1, 60);

    const postsByPlatform = {};

    if (doNotRewrite) {
      // Split the topic text into individual posts by blank-line-separated paragraphs.
      // Each paragraph is used verbatim (no OpenAI call). Posts are repeated/cycled
      // across platforms so every platform gets the same content.
      const paragraphs = topic
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
      const pool = paragraphs.length > 0 ? paragraphs : [topic.trim()];

      for (const platform of safePlatforms) {
        const posts = Array.from({ length: count }, (_, i) => ({
          content: pool[i % pool.length],
          platform,
          tone: 'verbatim',
        }));
        postsByPlatform[platform] = posts;
      }
    } else {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) return res.status(500).json({ error: 'OpenAI API key not configured' });

      for (const platform of safePlatforms) {
        postsByPlatform[platform] = await generateForPlatform({
          openaiKey,
          topic,
          platform,
          count,
          style,
          contentLength,
          hashtagLevel
        });
      }
    }

    // flatten so your current frontend can still work
    const flat = safePlatforms.flatMap((p) =>
      (postsByPlatform[p] || []).map((post) => ({ ...post }))
    );

    if (saveDrafts) {
      // not recommended unless you really want it
      const rows = flat.map((p) => ({
        user_id: userId,
        content: p.content || '',
        platform: p.platform || 'facebook',
        tone: p.tone || 'engaging',
        status: 'draft'
      }));

      const { error: dbError } = await supabase.from('posts').insert(rows);
      if (dbError) {
        console.error('❌ DB ERROR:', dbError);
        return res.status(500).json({ error: 'Failed to save posts' });
      }
    }

    return res.status(200).json({
      ok: true,
      postsPerPlatform: count,
      platforms: safePlatforms,
      total: flat.length,
      postsByPlatform,
      posts: flat
    });
  } catch (err) {
    console.error('❌ API ERROR:', err);
    return res.status(500).json({ error: err.message });
  }
}