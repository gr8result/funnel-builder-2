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

const COMMON_TYPO_REPLACEMENTS = {
  absolutly: 'absolutely',
  apporach: 'approach',
  bale: 'able',
  becuase: 'because',
  buisness: 'business',
  busienss: 'business',
  comepltion: 'completion',
  conected: 'connected',
  designe: 'designed',
  diferent: 'different',
  differnt: 'different',
  dot: 'to',
  erxorbatant: 'exorbitant',
  exciteing: 'exciting',
  ge: 'get',
  genrated: 'generated',
  grammer: 'grammar',
  hte: 'the',
  int: 'in',
  looka: 'look',
  nearign: 'nearing',
  platfomr: 'platform',
  platfomrs: 'platforms',
  realyl: 'really',
  relaly: 'really',
  relvenat: 'relevant',
  scalingg: 'scaling',
  searcher: 'searches',
  selct: 'select',
  sestup: 'setup',
  spellign: 'spelling',
  teh: 'the',
  therg: 'there',
  thisg: 'thing',
  tshi: 'this',
  toe: 'to',
  tthe: 'the',
  usefull: 'useful',
  wanta: 'want',
  wtih: 'with',
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'at', 'be', 'because', 'becomes', 'been', 'being', 'but', 'by',
  'can', 'for', 'from', 'has', 'have', 'here', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
  'its', 'just', 'more', 'much', 'new', 'of', 'on', 'one', 'or', 'our', 'so', 'that', 'the',
  'their', 'them', 'there', 'these', 'they', 'this', 'those', 'to', 'up', 'using', 'we',
  'what', 'when', 'with', 'without', 'would', 'your'
]);

const HASHTAG_CATEGORY_RULES = [
  { match: /(social media|social posts?|instagram|facebook|linkedin|x |twitter|pinterest|tiktok)/i, tags: ['#socialmediamarketing', '#socialmediastrategy', '#contentmarketing'] },
  { match: /marketing/i, tags: ['#digitalmarketing', '#marketingstrategy'] },
  { match: /email/i, tags: ['#emailmarketing', '#emailautomation'] },
  { match: /crm/i, tags: ['#crm', '#customerrelationshipmanagement'] },
  { match: /automation/i, tags: ['#marketingautomation', '#businessautomation'] },
  { match: /community/i, tags: ['#communitymarketing', '#customerengagement'] },
  { match: /sms|text/i, tags: ['#smsmarketing', '#mobilemarketing'] },
  { match: /website/i, tags: ['#websitedesign', '#websitebuilder'] },
  { match: /funnel/i, tags: ['#salesfunnels', '#funnelbuilder'] },
  { match: /affiliate/i, tags: ['#affiliatemarketing', '#partnermarketing'] },
  { match: /marketplace/i, tags: ['#marketplace', '#digitalplatform'] },
  { match: /lead/i, tags: ['#leadgeneration', '#leadnurturing'] },
  { match: /sales/i, tags: ['#salesautomation', '#salesgrowth'] },
  { match: /small business|business/i, tags: ['#smallbusiness', '#businessgrowth'] },
  { match: /ai|artificial intelligence/i, tags: ['#aimarketing', '#aiforbusiness'] },
  { match: /platform|software|system/i, tags: ['#businesssoftware', '#allinoneplatform'] },
  { match: /protein|supplement|powder|whey|fitness|health|nutrition/i, tags: ['#proteinpowder', '#sportsnutrition', '#healthandfitness'] },
];

const SALES_INTENT_RE = /(sell|sales|launch|new product|product launch|buy|shop|offer|promo|promotion|advert|advertisement|direct response|cta|ecommerce|product|protein|supplement|powder|whey|fitness brand)/i;

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

function repairCommonTypos(text) {
  let result = String(text || '');
  Object.entries(COMMON_TYPO_REPLACEMENTS).forEach(([wrong, right]) => {
    result = result.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), right);
  });
  return result;
}

function cleanSourceText(text) {
  return repairCommonTypos(String(text || ''))
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();
}

function hasSalesIntent(topic) {
  return SALES_INTENT_RE.test(cleanSourceText(topic));
}

function normaliseKeyword(value) {
  return cleanSourceText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

function normaliseHashtag(tag) {
  const bare = String(tag || '').toLowerCase().replace(/^#+/, '').replace(/[^a-z0-9]/g, '');
  return bare ? `#${bare}` : '';
}

function isUsefulHashtag(tag) {
  const bare = String(tag || '').toLowerCase().replace(/^#+/, '');
  return bare.length >= 4 && !STOP_WORDS.has(bare);
}

function extractHashtags(text) {
  const matches = String(text || '').match(/#[a-z0-9_]+/gi) || [];
  const deduped = [];
  matches.forEach((tag) => {
    const normalized = normaliseHashtag(tag);
    if (!normalized || !isUsefulHashtag(normalized)) return;
    if (!deduped.some((t) => t.toLowerCase() === normalized.toLowerCase())) deduped.push(normalized);
  });
  return deduped;
}

function fallbackHashtagPool(topic) {
  const cleanedTopic = cleanSourceText(topic);
  const keywordTags = normaliseKeyword(cleanedTopic)
    .slice(0, 6)
    .map((word) => normaliseHashtag(word));
  const categoryTags = HASHTAG_CATEGORY_RULES
    .filter((rule) => rule.match.test(cleanedTopic))
    .flatMap((rule) => rule.tags);
  const pool = [
    ...categoryTags,
    ...keywordTags,
    '#digitalmarketing',
    '#contentmarketing',
    '#businessgrowth',
    '#smallbusinessmarketing',
    '#brandstrategy',
    '#leadgeneration'
  ];

  const deduped = [];
  pool.forEach((tag) => {
    const normalized = normaliseHashtag(tag);
    if (!normalized || !isUsefulHashtag(normalized)) return;
    if (!deduped.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
      deduped.push(normalized);
    }
  });
  return deduped;
}

function withHashtags(text, topic, hashtagLevel) {
  const { min, max } = parseHashtagLevel(hashtagLevel);
  const content = cleanSourceText(text);
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

function isQuotaError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('insufficient_quota') || msg.includes('exceeded your current quota') || msg.includes('billing') || msg.includes('429');
}

function sentenceCase(value) {
  const text = cleanSourceText(value);
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function splitSentences(value) {
  return String(value || '')
    .split(/(?<=[.!?])\s+/)
    .map((part) => cleanSourceText(part))
    .filter(Boolean);
}

function lowerFirst(value) {
  const text = cleanSourceText(value);
  if (!text) return '';
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function topicSubject(topic) {
  const lowered = cleanSourceText(topic).toLowerCase();
  if (lowered.includes('platform')) return 'the platform';
  if (lowered.includes('system')) return 'the system';
  if (lowered.includes('software')) return 'the software';
  if (lowered.includes('service')) return 'the service';
  return 'this solution';
}

function resolveTopicReference(text, topic) {
  const cleaned = cleanSourceText(text);
  if (!cleaned) return '';
  const subject = topicSubject(topic);
  return cleaned.replace(/^it\b/i, subject);
}

function topicTerms(topic) {
  return normaliseKeyword(topic).slice(0, 8);
}

function topicLead(topic) {
  const cleaned = sentenceCase(resolveTopicReference(topic, topic)).replace(/[.!?]+$/g, '');
  if (!cleaned) return 'We are sharing an update designed to make day-to-day marketing easier for growing businesses.';
  if (/^(our|we)\b/i.test(cleaned)) return `${cleaned}.`;
  return `This update focuses on ${lowerFirst(cleaned)}.`;
}

function salesLead(topic, platform) {
  const cleaned = sentenceCase(cleanSourceText(topic)).replace(/[.!?]+$/g, '');
  if (/protein|supplement|powder|whey/i.test(cleaned)) {
    if (sanitizePlatform(platform) === 'pinterest') {
      return 'New protein powder now available for people who want a simple way to support training, recovery, and better daily nutrition.';
    }
    return 'New protein powder now available for people who want better daily nutrition, a more satisfying shake, and a simpler way to stay consistent.';
  }
  return cleaned || 'New product now available.';
}

function salesBenefitSentence(topic, variant = 0) {
  const lowered = cleanSourceText(topic).toLowerCase();
  const options = [];

  if (/(protein|supplement|powder|whey)/i.test(lowered)) {
    options.push('The copy should focus on the product itself, the value it adds to a customer routine, and why it is worth trying now rather than sounding like a generic announcement.');
    options.push('A stronger ad here makes the result clear straight away: convenient protein, better consistency, and an easy next step for customers ready to buy.');
  }

  options.push(
    'The message needs to sound like a real offer, with a clear benefit, a reason to care now, and a direct next step.',
    'Good ad copy here should feel specific, product-led, and persuasive instead of vague or informational.'
  );

  return options[variant % options.length];
}

function salesDetailSentence(topic, variant = 0) {
  const lowered = cleanSourceText(topic).toLowerCase();
  if (/(protein|supplement|powder|whey)/i.test(lowered)) {
    const options = [
      'Make it obvious who the product is for, what makes it appealing, and why someone should click through to see the full details.',
      'Use the post to highlight the product appeal, the practical benefit, and the reason a customer should shop now.'
    ];
    return options[variant % options.length];
  }
  return 'Keep the copy focused on the offer, the benefit, and the action you want the customer to take next.';
}

function salesCtaSentence(platform) {
  if (sanitizePlatform(platform) === 'x') return 'Visit our website to shop now.';
  return 'Visit our website now to shop and see the full product details.';
}

function benefitSentence(topic, variant = 0) {
  const lowered = cleanSourceText(topic).toLowerCase();
  const options = [];

  if (/(marketing|campaign)/i.test(lowered) && /(lead|crm|customer)/i.test(lowered)) {
    options.push('It is built to bring your marketing, leads, and customer follow-up into one clearer workflow so less time is wasted jumping between tools.');
  }
  if (/(website|site)/i.test(lowered) && /(funnel|conversion|lead)/i.test(lowered)) {
    options.push('That makes it easier to connect your website and funnels so visitors can move from first click to enquiry without the usual gaps.');
  }
  if (/(automation|automate|system|platform|software)/i.test(lowered)) {
    options.push('The aim is to reduce manual admin, keep the process organised, and give your business a setup that is easier to manage as you grow.');
  }

  options.push(
    'The focus is on making the process easier to manage, easier to repeat, and easier for customers to move to the next step.',
    'For a growing business, that means less friction behind the scenes and a smoother experience for the people dealing with you.'
  );

  return options[variant % options.length];
}

function detailSentence(topic, variant = 0) {
  const idea = resolveTopicReference(topic, topic);
  const lowered = cleanSourceText(idea).toLowerCase();

  if (/(launch|launching|nearing completion|coming soon|roll out|rollout)/i.test(lowered)) {
    return 'As the launch gets closer, the most important thing is explaining the value clearly so people immediately understand what problem it solves for them.';
  }
  if (/(marketing|lead|website|funnel|automation|crm)/i.test(lowered)) {
    return `In practical terms, ${lowerFirst(idea)} should help your team work faster while giving customers a clearer and more consistent journey.`;
  }
  return 'A strong post should spell out the benefit, show why it matters, and make the next step obvious instead of relying on vague filler lines.';
}

function engagementSentence(topic, variant = 0, platform) {
  const p = sanitizePlatform(platform);
  if (p === 'x' || p === 'pinterest') return '';

  const prompts = [
    'If this would make your day-to-day work easier, have a look at our website and see what is coming.',
    'If you want a simpler way to manage this in your business, visit our website and take a closer look.',
    'If this is the kind of system your business has been missing, visit our website to see how it all fits together.'
  ];

  return prompts[variant % prompts.length];
}

function buildTopicDrivenPost(topic, platform, variant = 0) {
  if (hasSalesIntent(topic)) {
    const sentences = [
      salesLead(topic, platform),
      salesBenefitSentence(topic, variant),
      salesDetailSentence(topic, variant),
      salesCtaSentence(platform),
    ].filter(Boolean);

    if (sanitizePlatform(platform) === 'x') return sentences.slice(0, 2).join(' ');
    if (sanitizePlatform(platform) === 'pinterest') return sentences.slice(0, 3).join(' ');
    return sentences.join(' ');
  }

  const sentences = [
    topicLead(topic),
    benefitSentence(topic, variant),
    detailSentence(topic, variant),
    engagementSentence(topic, variant, platform),
  ].filter(Boolean);

  if (sanitizePlatform(platform) === 'x') {
    return sentences.slice(0, 2).join(' ');
  }

  if (sanitizePlatform(platform) === 'pinterest') {
    return sentences.slice(0, 3).join(' ');
  }

  return sentences.join(' ');
}

const GENERIC_POST_PATTERNS = [
  /^here is one practical way to improve /i,
  /^a smarter approach to /i,
  /^small changes in /i,
  /^if .* feels messy right now/i,
  /what part of this would help your business most right now\?/i,
  /would this make things easier in your business\?/i,
  /what would you improve first\?/i,
  /which step would you want to automate first\?/i,
  /where is the biggest bottleneck for you at the moment\?/i,
];

function looksGenericPost(text, topic) {
  const cleaned = cleanSourceText(text);
  if (!cleaned) return true;
  if (GENERIC_POST_PATTERNS.some((pattern) => pattern.test(cleaned))) return true;

  const terms = topicTerms(topic);
  if (!terms.length) return false;

  const lowered = cleaned.toLowerCase();
  const matchCount = terms.filter((term) => lowered.includes(term)).length;
  return matchCount === 0;
}

function websiteCta(platform) {
  const p = sanitizePlatform(platform);
  if (p === 'pinterest') return 'Visit our website to learn more and see how it can work for your business.';
  if (p === 'x') return 'Visit our website to learn more.';
  return 'Visit our website to learn more about how this can help your business.';
}

function minimumSentenceCount(platform) {
  const p = sanitizePlatform(platform);
  if (p === 'x') return 2;
  if (p === 'pinterest') return 2;
  return 3;
}

function ensureWebsiteCta(text, platform) {
  const cleaned = cleanSourceText(text);
  if (!cleaned) return websiteCta(platform);
  if (/(visit|check out|see|learn more on|have a look at|look at).{0,30}website/i.test(cleaned)) {
    return cleaned;
  }
  return `${cleaned} ${websiteCta(platform)}`.trim();
}

function expandPostContent(text, topic, platform) {
  const baseText = looksGenericPost(text, topic) ? buildTopicDrivenPost(topic, platform) : text;
  const sentences = splitSentences(baseText);
  const minSentences = minimumSentenceCount(platform);
  let variant = 0;
  while (sentences.length < minSentences) {
    const extra = [benefitSentence(topic, variant), detailSentence(topic, variant), engagementSentence(topic, variant, platform)]
      .map((part) => cleanSourceText(part))
      .find((part) => part && !sentences.includes(part));
    if (!sentences.includes(extra)) sentences.push(extra);
    variant += 1;
    if (variant > 6) break;
  }
  return ensureWebsiteCta(sentences.join(' '), platform);
}

function finalizePostContent(text, topic, platform, hashtagLevel) {
  return withHashtags(expandPostContent(text, topic, platform), topic, hashtagLevel);
}

function extractTopicIdeas(topic) {
  const bits = String(topic || '')
    .split(/\n|\.|;|\||,/)
    .map((part) => cleanSourceText(part))
    .filter((part) => part.length > 8);

  const deduped = [];
  bits.forEach((bit) => {
    const lower = bit.toLowerCase();
    if (!deduped.some((item) => item.toLowerCase() === lower)) deduped.push(bit);
  });
  return deduped.length ? deduped : [cleanSourceText(topic) || 'your offer'];
}

function platformTemplate(platform, variant, idea, style, contentLength) {
  return buildTopicDrivenPost(idea, platform, variant);
}

function generateFallbackPosts({ topic, platform, count, style, contentLength, hashtagLevel }) {
  return Array.from({ length: count }, (_, index) => {
    const variant = index;
    return {
      content: withHashtags(platformTemplate(platform, variant, topic, style, contentLength), topic, hashtagLevel),
      platform: sanitizePlatform(platform),
      tone: `${style || 'engaging'}-fallback`,
    };
  });
}

function platformRules(platform, contentLength) {
  const p = sanitizePlatform(platform);
  const salesRule = 'If the brief is about selling or launching a product, write it as direct-response ad copy with a clear benefit, buying motivation, and a specific CTA.';

  const longRule = 'Write 3-5 clear sentences. Make it practical, specific, and helpful.';
  const shortRule = 'Write 3 concise but complete sentences. Keep it easy to skim, but still specific and useful.';
  const baseLengthRule = contentLength === 'long' ? longRule : shortRule;

  if (p === 'x') {
    return [
      'Hard limit: 260 characters max.',
      'No more than 2 hashtags.',
      'Punchy, direct, scroll-stopping.',
      salesRule,
      baseLengthRule
    ].join('\n');
  }

  if (p === 'linkedin') {
    return [
      'Professional tone. No hype.',
      'Use short paragraphs or bullets when helpful.',
      'Use 0-5 hashtags max.',
      salesRule,
      'Write at least 3 well-formed sentences plus a clear CTA to visit our website.',
      baseLengthRule
    ].join('\n');
  }

  if (p === 'instagram') {
    return [
      'Make it visually readable: short lines, strong hook.',
      'Encourage saves/shares.',
      'Hashtags are okay (moderate to high).',
      salesRule,
      'Write at least 3 clear sentences plus a CTA telling people to visit our website.',
      baseLengthRule
    ].join('\n');
  }

  if (p === 'pinterest') {
    return [
      'Write like a Pinterest product ad: searchable keywords, product-specific wording, and a clear benefit.',
      'For product launches or ads, make the item being sold obvious in the first sentence.',
      'End with a CTA inviting people to visit our website or click to shop now.',
      'Use 0-3 hashtags (optional).',
      'Write at least 2 useful sentences that explain the benefit clearly.',
      salesRule,
      baseLengthRule
    ].join('\n');
  }

  return [
    'Conversational tone.',
    'End with a question to drive comments when appropriate.',
    salesRule,
    'Write at least 3 clear sentences plus a CTA asking people to visit our website.',
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

If the brief is about launching or selling a product, especially a physical product like a supplement, powder, or nutrition product, write it as a real sales ad. Focus on the product, the customer benefit, and the reason to click now.

Platform rules:
${platformRules(p, contentLength)}

Hashtags directive:
${hashtagDirective(p, hashtagLevel)}

Each item MUST include:
- "content": full post text (include hashtags at the end if using them)
- "platform": "${p}"
- "tone": concise descriptor matching requested style

Every post must:
- clearly explain what the post is about
- use more than one sentence
- include a CTA that tells people to visit our website
- read naturally and make sense from start to finish
- avoid generic filler openings like "Here is one practical way", "A smarter approach", or vague business-coach language
- mention the actual product, update, offer, or business outcome from the brief instead of talking in generalities

${exclusionText}

Before writing, fix any spelling, grammar, punctuation, spacing, and wording errors in the source brief. Never copy obvious typos, malformed hashtags, or broken words from the input.

Use only relevant, searchable hashtags people would genuinely look for. Never use filler hashtags like #our, #this, #new, #the, or hashtags copied from broken input.

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
        { role: 'system', content: 'Return only strict JSON with a posts array. Use Australian English spelling. Correct spelling and grammar errors from the user brief before writing. Use only relevant searchable hashtags. Every post must be coherent, longer than one sentence, explain the point clearly, include a CTA to visit our website, and avoid generic filler openings or vague marketing-coach phrasing.' },
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

  if (!openaiKey) {
    return generateFallbackPosts({ topic, platform, count: requestedCount, style, contentLength, hashtagLevel });
  }

  const firstPrompt = buildPromptForPlatform({
    topic,
    platform,
    count: requestedCount,
    style,
    contentLength,
    hashtagLevel,
    excludeSamples: []
  });

  let posts;
  try {
    posts = await requestPostsFromOpenAI(openaiKey, firstPrompt);
  } catch (error) {
    if (isQuotaError(error)) {
      return generateFallbackPosts({ topic, platform, count: requestedCount, style, contentLength, hashtagLevel });
    }
    throw error;
  }

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
    let topUp;
    try {
      topUp = await requestPostsFromOpenAI(openaiKey, secondPrompt);
    } catch (error) {
      if (isQuotaError(error)) {
        const needed = requestedCount - posts.length;
        topUp = generateFallbackPosts({ topic, platform, count: needed, style, contentLength, hashtagLevel });
      } else {
        throw error;
      }
    }
    posts = [...posts, ...topUp];
  }

  const normalized = posts
    .map((p) => ({
      content: finalizePostContent(p?.content || '', topic, platform, hashtagLevel),
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
        .map((p) => cleanSourceText(p))
        .filter(p => p.length > 0);
      const pool = paragraphs.length > 0 ? paragraphs : [cleanSourceText(topic)];

      for (const platform of safePlatforms) {
        const posts = Array.from({ length: count }, (_, i) => ({
          content: finalizePostContent(pool[i % pool.length], topic, platform, hashtagLevel),
          platform,
          tone: 'lightly-polished',
        }));
        postsByPlatform[platform] = posts;
      }
    } else {
      const openaiKey = process.env.OPENAI_API_KEY;

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

    for (const platform of safePlatforms) {
      postsByPlatform[platform] = (postsByPlatform[platform] || []).map((post) => ({
        ...post,
        content: finalizePostContent(post?.content || '', topic, platform, hashtagLevel),
      }));
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