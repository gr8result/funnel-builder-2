// /pages/api/social/ai-generate-content.js
import { createClient } from '@supabase/supabase-js';
import { withAuth } from "../../../lib/withWorkspace";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 28 per platform = monthly pack
const DEFAULT_POSTS_PER_PLATFORM = 28;

// platforms you want
const ALLOWED_PLATFORMS = ['facebook', 'instagram', 'linkedin', 'x', 'pinterest', 'tiktok', 'youtube'];

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
  { match: /(social media|social posts?|instagram|facebook|linkedin|x |twitter|threads|bluesky|pinterest|tiktok|youtube|reddit|snapchat|telegram|whatsapp|discord|lemon8)/i, tags: ['#socialmediamarketing', '#socialmediastrategy', '#contentmarketing'] },
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
  if (p === 'twitter') return 'x';
  if (p === 'google business' || p === 'google business profile' || p === 'googlebusinessprofile' || p === 'gbp') return 'googlebusiness';
  if (p === 'whatsapp channels' || p === 'whatsapp channel') return 'whatsapp';
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

function isShortVideoPlatform(platform) {
  return ['tiktok', 'youtube', 'snapchat', 'lemon8'].includes(sanitizePlatform(platform));
}

function isShortVideoBrief(topic, platform) {
  const cleaned = cleanSourceText(topic).toLowerCase();
  if (isShortVideoPlatform(platform)) return true;
  return /(video|clip|shorts|short-form|reel|training|workout|gym|fitness|coach|behind the scenes|behind-the-scenes|by the sea|beach)/i.test(cleaned);
}

function creatorCta(platform) {
  const p = sanitizePlatform(platform);
  if (p === 'youtube') return 'Watch for more training clips and follow for the next one.';
  if (p === 'tiktok' || p === 'snapchat' || p === 'lemon8') return 'Follow for more training clips and behind-the-scenes moments.';
  return 'Follow for more and visit our website to see what else is coming.';
}

function shortVideoHook(topic, variant = 0) {
  const cleaned = cleanSourceText(topic).toLowerCase();

  if (/(by the sea|ocean|beach|coast|coastal)/i.test(cleaned) && /(training|workout|fitness|gym)/i.test(cleaned)) {
    const options = [
      'Training by the sea just hits different.',
      'Ocean air, hard session, no excuses.',
      'A quick coastal training clip with the right kind of energy.',
    ];
    return options[variant % options.length];
  }

  if (/(training|workout|fitness|gym)/i.test(cleaned)) {
    const options = [
      'A quick training clip from today\'s session.',
      'Just a short workout moment worth sharing.',
      'A little training footage and a lot of good energy.',
    ];
    return options[variant % options.length];
  }

  const options = [
    'A quick behind-the-scenes clip from the latest post.',
    'A short sample clip to show the vibe properly.',
    'A simple moment on video that says more than a long caption.',
  ];
  return options[variant % options.length];
}

function shortVideoBody(topic, variant = 0) {
  const cleaned = cleanSourceText(topic).toLowerCase();

  if (/(activewear|apparel|brand|lifestyle|training video|sample clip|gym equipment|workout clip)/i.test(cleaned) && /(training|workout|fitness|gym)/i.test(cleaned)) {
    const options = [
      'A clean training clip with a strong activewear feel and a simple, natural kind of energy.',
      'Just a straightforward workout moment with movement, focus, and a clean lifestyle vibe.',
      'A short training clip that feels active, modern, and easy to watch without trying too hard.',
    ];
    return options[variant % options.length];
  }

  if (/(training|workout|fitness|gym)/i.test(cleaned)) {
    const options = [
      'Nothing overdone, just real movement, good energy, and a reminder to keep showing up.',
      'Clean reps, steady effort, and the kind of session that makes you want to keep going.',
      'A simple training moment that feels strong, natural, and easy to watch.',
    ];
    return options[variant % options.length];
  }

  const options = [
    'It is just a small sample, but it gives the right feel straight away.',
    'Simple, natural, and easy to watch without trying too hard.',
    'The clip is short, but the mood comes through immediately.',
  ];
  return options[variant % options.length];
}

function buildShortVideoCaption(topic, platform, variant = 0) {
  const p = sanitizePlatform(platform);
  const lines = [
    shortVideoHook(topic, variant),
    shortVideoBody(topic, variant),
    creatorCta(p),
  ].filter(Boolean);

  if (p === 'youtube') return lines.join(' ');
  return lines.join(' ');
}

function pickVariantOffset() {
  return Math.floor(Math.random() * 97) + Date.now();
}

function formatGenerationFailureReason(reason) {
  if (reason === 'missing_openai_key') return 'OPENAI_API_KEY is not configured on the server.';
  if (reason === 'openai_quota_or_billing') return 'The server OpenAI key is being rejected for quota or billing reasons.';
  if (reason === 'empty_or_invalid_openai_response') return 'OpenAI returned an unusable response.';
  return 'OpenAI generation failed.';
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
    options.push('Enjoy an easy way to add more protein to your day with a shake that fits training, recovery, and busy mornings without the usual hassle.');
    options.push('Get a convenient protein option that helps support recovery, keeps you fuller for longer, and makes your daily routine easier to stay on track with.');
    options.push('Built for people who want a simple, high-protein option that works after training, between meals, or whenever a quick nutrition boost makes sense.');
  }

  options.push(
    'Designed to make the offer feel clear, valuable, and worth acting on now.',
    'A strong product ad should make the benefit obvious and the next step easy.'
  );

  return options[variant % options.length];
}

function salesDetailSentence(topic, variant = 0) {
  const lowered = cleanSourceText(topic).toLowerCase();
  if (/(protein|supplement|powder|whey)/i.test(lowered)) {
    const options = [
      'Perfect for people who want a more convenient way to hit their protein target without overthinking meals, prep, or post-workout recovery.',
      'Ideal for customers who want a practical protein option they can use after training, on busy mornings, or as a quick high-protein snack.'
    ];
    return options[variant % options.length];
  }
  return 'A clear offer, a real benefit, and an obvious next step will usually outperform vague promotional copy.';
}

function salesCtaSentence(platform) {
  if (sanitizePlatform(platform) === 'x') return 'Visit our website to shop now.';
  return 'Shop now on our website to see the full details and order yours today.';
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
  if (isShortVideoBrief(topic, platform)) {
    return buildShortVideoCaption(topic, platform, variant);
  }

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
  if (p === 'tiktok' || p === 'snapchat' || p === 'lemon8') return 'Follow for more.';
  if (p === 'youtube') return 'Watch for more on our channel.';
  if (p === 'pinterest') return 'Visit our website to learn more and see how it can work for your business.';
  if (p === 'x') return 'Visit our website to learn more.';
  return 'Visit our website to learn more about how this can help your business.';
}

function minimumSentenceCount(platform) {
  const p = sanitizePlatform(platform);
  if (p === 'tiktok' || p === 'snapchat' || p === 'lemon8') return 2;
  if (p === 'youtube') return 2;
  if (p === 'x') return 2;
  if (p === 'pinterest') return 2;
  return 3;
}

function needsWebsiteCta(platform, topic) {
  const p = sanitizePlatform(platform);
  if (isShortVideoBrief(topic, p) && !hasSalesIntent(topic)) return false;
  return !['tiktok', 'youtube', 'snapchat', 'lemon8'].includes(p) || hasSalesIntent(topic);
}

function ensureWebsiteCta(text, platform) {
  const cleaned = cleanSourceText(text);
  if (!cleaned) return websiteCta(platform);
  if (!needsWebsiteCta(platform, cleaned)) return cleaned;
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

function generateFallbackPosts({ topic, platform, count, style, contentLength, hashtagLevel, variantOffset = 0 }) {
  return Array.from({ length: count }, (_, index) => {
    const variant = index + variantOffset;
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

  if (p === 'tiktok') {
    return [
      'Write like a real TikTok caption, not a marketing brief or corporate post.',
      'Use a short hook first, then 1-2 natural follow-up lines.',
      'Speak to viewers, not to the business owner or content manager.',
      'Never describe how the caption should be written and never repeat instructions from the brief.',
      'Do not write phrases like "this update focuses on", "the focus is", "create captions", or "keep the tone".',
      'Only include a selling CTA if the brief is clearly a product sale or launch.',
      'Keep it natural, modern, and watchable.',
      salesRule,
      'Write 2-3 short sentences max.'
    ].join('\n');
  }

  if (p === 'youtube') {
    return [
      'Write like YouTube Shorts caption copy or a short video description.',
      'Lead with the actual clip or topic, not with meta commentary about the brief.',
      'Never repeat instructions from the brief or describe how the caption should be written.',
      'Do not use filler openings like "this update focuses on".',
      'Keep it clear and viewer-facing.',
      salesRule,
      'Write 2-3 concise sentences.'
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
  if (p === 'tiktok' || p === 'snapchat' || p === 'lemon8') return 'Use 3-5 relevant hashtags.';
  if (p === 'youtube') return 'Use 0-3 relevant hashtags.';
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

Treat the brief as internal notes only. Convert rough notes into final audience-facing copy. Never mention or repeat instructions such as "create captions", "write posts", "keep the tone", "focus on", "include hooks", or comments about spelling.

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
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Return only strict JSON with a posts array. Use Australian English spelling. Correct spelling and grammar errors from the user brief before writing. Use only relevant searchable hashtags. Treat the user brief as rough internal notes, not text to echo. Convert it into final audience-facing copy. Never repeat instructions such as create captions, keep the tone, include hooks, or focus on. Avoid generic filler openings or vague marketing-coach phrasing.' },
        { role: 'user', content: prompt }
      ],
      temperature: 1,
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
  const variantOffset = pickVariantOffset();

  if (!openaiKey) {
    return {
      posts: generateFallbackPosts({ topic, platform, count: requestedCount, style, contentLength, hashtagLevel, variantOffset }),
      source: 'fallback',
      reason: 'missing_openai_key',
    };
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
      return {
        posts: generateFallbackPosts({ topic, platform, count: requestedCount, style, contentLength, hashtagLevel, variantOffset }),
        source: 'fallback',
        reason: 'openai_quota_or_billing',
      };
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
        topUp = generateFallbackPosts({ topic, platform, count: needed, style, contentLength, hashtagLevel, variantOffset });
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

  if (!normalized.length) {
    return {
      posts: generateFallbackPosts({ topic, platform, count: requestedCount, style, contentLength, hashtagLevel, variantOffset }),
      source: 'fallback',
      reason: 'empty_or_invalid_openai_response',
    };
  }

  return {
    posts: normalized,
    source: 'openai',
    reason: null,
  };
}

async function handler(req, res) {
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
    const generationMeta = {};

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
        generationMeta[platform] = { source: 'verbatim', reason: null };
      }
    } else {
      const openaiKey = process.env.OPENAI_API_KEY;

      // Run all platform generations in parallel to avoid sequential timeout
      const platformResults = await Promise.all(
        safePlatforms.map((platform) =>
          generateForPlatform({ openaiKey, topic, platform, count, style, contentLength, hashtagLevel })
            .then((result) => ({ platform, result }))
        )
      );
      for (const { platform, result } of platformResults) {
        postsByPlatform[platform] = result.posts;
        generationMeta[platform] = { source: result.source, reason: result.reason };
      }

      const fallbackPlatforms = safePlatforms.filter((platform) => generationMeta[platform]?.source === 'fallback');
      if (fallbackPlatforms.length === safePlatforms.length) {
        const reasons = [...new Set(fallbackPlatforms.map((platform) => generationMeta[platform]?.reason).filter(Boolean))]
          .map((reason) => formatGenerationFailureReason(reason))
          .join(' ');
        console.warn('Social AI generation used fallback for all selected platforms.', reasons || 'No reason provided.');
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
      generationMeta,
      postsByPlatform,
      posts: flat
    });
  } catch (err) {
    console.error('❌ API ERROR:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default withAuth(handler);
