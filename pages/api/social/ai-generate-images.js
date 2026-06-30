// /pages/api/social/ai-generate-images.js
// Generate images for social media posts using OpenAI image generation.

import { requireUser } from '../../../lib/social/auth';
import { persistImageForUser } from './save-image';
import { withAuth } from "../../../lib/withWorkspace";

let promoBrowserPromise = null;

function canonicalImageKey(image) {
  const url = String(image?.url || '').trim();
  if (!url) return '';
  if (url.startsWith('data:image/')) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('ts');
    parsed.searchParams.delete('t');
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function dedupeImages(images) {
  const seen = new Set();
  return (images || []).filter((image) => {
    const key = canonicalImageKey(image);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const STOCK_IMAGE_POOLS = {
  software: [
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1454165205744-3b78555e5572?auto=format&fit=crop&w=1200&q=80',
  ],
  marketing: [
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1200&q=80',
  ],
  ecommerce: [
    'https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&q=80',
  ],
  product: [
    'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1546483875-ad9014c88eba?auto=format&fit=crop&w=1200&q=80',
  ],
  communication: [
    'https://images.unsplash.com/photo-1516321165247-4aa89a48be28?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
  ],
  team: [
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
  ],
  general: [
    'https://images.unsplash.com/photo-1454165205744-3b78555e5572?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
  ],
  construction: [
    'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1480074568708-e23592369e5e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1494526585109-88a9a4899e2c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1525909002-bce886aca1a7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1419242902469-3d9f0228ecc0?auto=format&fit=crop&w=1200&q=80',
  ],
  extended: [
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516321165247-4aa89a48be28?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1454165205744-3b78555e5572?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1558655146-364adaf1fcc9?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1495640388908-05fa85288e61?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=80',
  ],
};

const ALL_STOCK_IMAGES = Array.from(new Set(Object.values(STOCK_IMAGE_POOLS).flat()));

const STOCK_KEYWORDS = {
  software: ['platform', 'software', 'dashboard', 'crm', 'automation', 'funnel', 'builder', 'analytics', 'saas'],
  marketing: ['marketing', 'social', 'content', 'campaign', 'brand', 'audience', 'lead', 'growth'],
  ecommerce: ['marketplace', 'shop', 'store', 'product', 'affiliate', 'sales', 'checkout'],
  product: ['protein', 'supplement', 'powder', 'whey', 'fitness', 'health', 'nutrition', 'shake', 'jar', 'bottle'],
  communication: ['email', 'sms', 'message', 'community', 'support', 'engagement'],
  team: ['team', 'business', 'workflow', 'collaboration', 'strategy', 'community'],
  construction: ['build', 'builder', 'building', 'construction', 'home', 'house', 'property', 'estate', 'renovation', 'broker', 'land', 'block', 'residential', 'development', 'architecture', 'foundation', 'dwelling', 'invest', 'investment', 'real', 'slope', 'sloping', 'knock', 'knockdown'],
};

function normalizeApiError(errorPayload, fallbackMessage) {
  const apiError = errorPayload?.error || {};
  const code = apiError?.code || apiError?.type || 'image_generation_failed';
  const message = apiError?.message || fallbackMessage;
  return { code, message };
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function scoreKeywordMatch(words, candidates) {
  const set = new Set(words);
  return candidates.reduce((score, candidate) => score + (set.has(candidate) ? 1 : 0), 0);
}

function isProductAdDescription(description = '') {
  return /(protein|supplement|powder|whey|nutrition|fitness|shake|jar|bottle|product ad)/i.test(String(description || ''));
}

function pickStockPool(description, hint = '') {
  // Explicit hint (topic or imageDirection) takes priority over inferred description
  const combined = [hint, description].filter(Boolean).join(' ');
  if (isProductAdDescription(combined)) {
    return STOCK_IMAGE_POOLS.product || STOCK_IMAGE_POOLS.ecommerce || STOCK_IMAGE_POOLS.general;
  }

  const words = tokenize(combined);
  let bestPool = 'general';
  let bestScore = -1;

  Object.entries(STOCK_KEYWORDS).forEach(([poolName, keywords]) => {
    const score = scoreKeywordMatch(words, keywords);
    if (score > bestScore) {
      bestScore = score;
      bestPool = poolName;
    }
  });

  return STOCK_IMAGE_POOLS[bestPool] || STOCK_IMAGE_POOLS.general;
}

function scoreLibraryImage(description, image) {
  // Never re-use auto-generated social campaign images as fallbacks.
  // Their stored description is post copy, not what the image actually shows,
  // so a protein shake image saved from a bad generation would score highly against
  // any construction post that happened to share a few generic words.
  const tags = Array.isArray(image?.tags) ? image.tags : [];
  if (tags.includes('social') || tags.includes('generated')) return 0;

  const descriptionWords = new Set(tokenize(description));
  const imageWords = [
    ...tokenize(image?.description || ''),
    ...tags.flatMap((tag) => tokenize(tag)),
  ];

  if (!descriptionWords.size || !imageWords.length) return 0;
  // Require at least 3 matching words so weak coincidental matches don't pollute results
  const score = imageWords.reduce((s, word) => s + (descriptionWords.has(word) ? 1 : 0), 0);
  return score >= 3 ? score : 0;
}

function buildLibraryFallbackImages(descriptions, libraryImages, safeCount) {
  if (!Array.isArray(libraryImages) || !libraryImages.length) return [];

  const usedIds = new Set();
  return descriptions.slice(0, safeCount).map((description, index) => {
    const ranked = [...libraryImages]
      .map((image) => ({ image, score: scoreLibraryImage(description, image) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.image.created_at || 0).getTime() - new Date(a.image.created_at || 0).getTime();
      });

    // Only use a library image that actually has keyword relevance to the description
    let selected = ranked.find(({ image, score }) => score > 0 && !usedIds.has(image.id))?.image;
    if (!selected) return null;
    usedIds.add(selected.id);

    return {
      url: selected.url,
      description,
      generatedAt: new Date().toISOString(),
      fallback: true,
      source: 'library',
      libraryImageId: selected.id,
    };
  }).filter(Boolean);
}

function buildStockFallbackImages(descriptions, safeCount, hint = '') {
  const usedUrls = new Set();
  return descriptions.slice(0, safeCount).map((description, index) => {
    const preferredPool = pickStockPool(description, hint);
    const candidates = [...preferredPool, ...ALL_STOCK_IMAGES];
    const selectedUrl = candidates.find((url) => !usedUrls.has(url)) || candidates[index % candidates.length];
    usedUrls.add(selectedUrl);
    return {
      url: selectedUrl,
      description,
      generatedAt: new Date().toISOString(),
      fallback: true,
      source: 'stock',
    };
  });
}

function normalizeDescriptionText(description = '') {
  return String(description || '')
    .replace(/^\s*create\s+(?:a|an)\s+(?:pinterest|facebook|instagram|linkedin|tiktok|youtube)?\s*[^:]*?for\s*:\s*/i, '')
    .replace(/^\s*create\s+(?:a|an)\s+[^:]*?image\s+for\s*:\s*/i, '')
    .replace(/^\s*message\s+to\s+visualize\s*:\s*/i, '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[#*_`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function takeWords(text, count) {
  return String(text || '').split(/\s+/).filter(Boolean).slice(0, count).join(' ');
}

function truncateAtWordBoundary(text = '', maxLength = 140) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean || clean.length <= maxLength) return clean;
  const sliced = clean.slice(0, maxLength + 1);
  const boundary = Math.max(sliced.lastIndexOf(' '), sliced.lastIndexOf('.'), sliced.lastIndexOf(','));
  const shortened = (boundary > 40 ? sliced.slice(0, boundary) : clean.slice(0, maxLength)).trim();
  return /[.!?]$/.test(shortened) ? shortened : `${shortened}...`;
}

function buildSupportingCopy(clean, textMode) {
  if (textMode === 'headline-only') return '';

  const sentences = clean.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  const candidate = sentences.length > 1 ? sentences[1] : sentences[0] || '';
  if (!candidate) return '';

  if (textMode === 'minimal') {
    return truncateAtWordBoundary(candidate, 48);
  }

  return truncateAtWordBoundary(candidate, 110);
}

function extractBrandFromPost(clean) {
  // Match "with/at/by/from/let [ProperCase Brand Name]" anywhere in text (case-insensitive preposition)
  // Brand names have 2+ title-case words — e.g. "with Easyway Building Brokers"
  const m = clean.match(/\b(?:at|by|with|from|let|visit)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,4})/);
  if (m) {
    const brand = m[1].replace(/\s+(?:we|our|to|the|is|are|has|can|will|and|for|in|you|help|get|make)\b.*$/i, '').trim();
    if (brand.split(/\s+/).length >= 2) return brand.toUpperCase();
  }
  return '';
}

// Words that make dangling headlines if they appear at the end of a truncated phrase.
const WEAK_HEADLINE_ENDINGS = new Set([
  'a', 'an', 'the', 'our', 'your', 'their', 'its', 'my', 'his', 'her',
  'to', 'for', 'in', 'on', 'at', 'by', 'with', 'from', 'of', 'and', 'or',
  'but', 'that', 'this', 'these', 'those', 'which', 'who', 'what', 'when',
  'where', 'how', 'if', 'as', 'than', 'both', 'all', 'we', 'you', 'they',
  'it', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'just',
  'not', 'no', 'so', 'also', 'about', 'more', 'new', 'now', 'still', 'into',
]);

function trimToCompleteTail(words, maxLen) {
  for (let len = Math.min(maxLen, words.length); len >= 3; len--) {
    const tail = words[len - 1]?.toLowerCase().replace(/[^a-z]/g, '') || '';
    if (!WEAK_HEADLINE_ENDINGS.has(tail)) return words.slice(0, len).join(' ');
  }
  return words.slice(0, maxLen).join(' ');
}

function extractHeadline(sentences) {
  // Prefer short questions — they read as natural ad headlines
  const question = sentences.find(s => /\?$/.test(s.trim()) && s.split(/\s+/).length <= 10);
  if (question) return question.replace(/["']/g, '').replace(/\s*[,:;\-]\s*$/, '').trim();

  // Skip CTAs, brand-intro openers, and weak emotional-announce openers that make poor headlines
  const skipPattern = /^\s*(?:At|Let|Visit|Check|Call|Contact|With|From|By|We\s+(?:are|were|have|had|will|would|want)\s+(?:thrilled|excited|pleased|happy|proud|glad|delighted|announcing|here\s+to)|Are\s+you\s+(?:tired|ready|looking|struggling)|Introducing|Don'?t\s+miss|Say\s+good(?:bye|-bye))\b/i;
  const notIntro = sentences.find(s => !skipPattern.test(s));
  const base = (notIntro || sentences[0] || '').replace(/["']/g, '').replace(/\s*[,:;\-]\s*$/, '').trim();
  const words = base.split(/\s+/);
  if (words.length <= 7) return base;

  // Cut at the first comma after word 3 to avoid mid-thought truncation
  const commaIdx = words.findIndex((w, i) => i >= 3 && /,$/.test(w));
  if (commaIdx >= 3 && commaIdx <= 7) return words.slice(0, commaIdx + 1).join(' ').replace(/,$/, '');

  // Hard-cut at 7 words but ensure we don't end on a dangling weak word
  return trimToCompleteTail(words, 7);
}

function buildOverlayCopy(description = '', textMode = 'headline-supporting', topic = '', brand = '') {
  const clean = normalizeDescriptionText(description);
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);

  const headlineBase = extractHeadline(sentences);
  const headline = headlineBase.toUpperCase() || 'GROW YOUR BUSINESS';
  const supporting = buildSupportingCopy(clean, textMode);

  let eyebrow = '';
  if (textMode !== 'minimal') {
    if (brand && brand.trim()) {
      // Dedicated brand/company name field — always use this as the eyebrow
      eyebrow = takeWords(brand.trim(), 5).toUpperCase();
    } else {
      // No brand supplied — try to extract company name from the post copy itself
      eyebrow = extractBrandFromPost(clean);
    }
    // NOTE: topic is intentionally NOT used here — it's a campaign description, not a brand name
  }

  return { eyebrow, headline, supporting };
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shouldUseGraphicCreative(creativeType, index) {
  if (creativeType === 'graphic') return true;
  if (creativeType === 'mixed') return index % 2 === 1;
  return false;
}

function buildPhotoCreativePrompt(description, style, creativeType = 'realistic', index = 0, imageDirection = '', audience = '') {
  const normalized = normalizeDescriptionText(description);
  const subject = imageDirection ? imageDirection.trim() : normalized;
  const isSupplementAd = /(protein|supplement|powder|whey|nutrition|fitness)/i.test(subject);
  const isConstructionAd = /(build|builder|building|construction|home|house|property|real estate|renovation|broker|land|block|residential|development|architecture|sloping|knockdown)/i.test(subject);
  const useGraphicCreative = shouldUseGraphicCreative(creativeType, index);
  return [
    'Create a premium square social media ad background image.',
    `Image subject: "${subject}".`,
    !imageDirection ? `Marketing context: "${normalized}".` : null,
    audience ? `The ad targets: ${audience}.` : null,
    `Brand style: ${style}.`,
    useGraphicCreative
      ? 'Use a polished graphic ad layout with strong composition, clear shape language, product-led composition, bold contrast, and premium campaign design quality.'
      : isSupplementAd
        ? 'Use real product-ad photography with a premium protein powder tub or pouch, shake bottle, gym or clean kitchen context, believable lighting, and a strong focus on the product itself.'
        : isConstructionAd
          ? 'Use real residential construction or real estate photography: modern home exteriors, new house builds, construction sites, sloping-block builds, or attractive finished properties. Show the actual homes, land, or building work — not office environments or generic business scenes.'
          : 'Use a real photographic scene, real people, real products, or real business environment that directly matches the subject.',
    'If the image includes people, they should appear Australian — use light to medium skin tones typical of Australian demographics (Caucasian-Australian and Asian-Australian appearances). Do not use predominantly African-American or stereotypically American-looking models.',
    'Avoid placeholder layouts, fake social-media mockups, nonsense promo art, and meaningless filler scenes.',
    useGraphicCreative
      ? 'This should feel like a finished designed ad background, not a random illustration or template screenshot.'
      : 'Do not create illustration, vector art, 3D icon art, abstract gradients, mock UI cards, or cartoon graphics.',
    useGraphicCreative
      ? 'Use clean promotional design elements, layered shapes, and strong visual hierarchy while leaving room for readable marketing copy.'
      : 'Compose it like a modern high-converting Instagram or Facebook ad with a clear focal subject and believable lighting.',
    'Leave clean negative space in the lower third or side of the frame for headline text to be added later.',
    'No letters, no typography, no logos, no watermarks, no gibberish text inside the generated image.',
    useGraphicCreative
      ? 'High-end commercial ad design, premium marketing graphic, 1:1 composition.'
      : 'Photorealistic, polished, commercial advertising photography, 1:1 composition.'
  ].filter(Boolean).join(' ');
}

async function getPromoBrowser() {
  if (!promoBrowserPromise) {
    promoBrowserPromise = import('puppeteer').then(async ({ default: puppeteer }) => (
      puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    ));
  }
  return promoBrowserPromise;
}

async function renderPromotionalOverlay(imageUrl, description, textMode = 'headline-supporting', topic = '', brand = '') {
  const browser = await getPromoBrowser();
  const page = await browser.newPage();
  const copy = buildOverlayCopy(description, textMode, topic, brand);

  // Adaptive font size: fewer words = bigger, more words = smaller to avoid overflow
  const wordCount = copy.headline.split(/\s+/).length;
  const headlineFontSize = wordCount <= 4 ? 76 : wordCount <= 6 ? 64 : wordCount <= 8 ? 54 : 46;
  const lineHeight = 1.08;

  try {
    await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
    await page.setContent(`
      <html>
        <body style="margin:0;background:#000;">
          <div style="width:1024px;height:1024px;position:relative;overflow:hidden;background:#05070b;font-family:'Segoe UI',Arial,sans-serif;">
            <img class="bg" src="${escapeHtml(imageUrl)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;" />
            <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.28) 46%, rgba(0,0,0,0.84) 100%);"></div>
            <div style="position:absolute;left:54px;right:54px;bottom:58px;color:#fff;">
              ${copy.eyebrow ? `<div style="display:inline-block;max-width:100%;padding:8px 16px;border-radius:999px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.22);font-size:22px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(copy.eyebrow)}</div>` : ''}
              <div style="font-size:${headlineFontSize}px;line-height:${lineHeight};font-weight:900;letter-spacing:-0.03em;text-transform:uppercase;word-break:break-word;max-width:900px;text-shadow:0 4px 30px rgba(0,0,0,0.5);">
                ${escapeHtml(copy.headline)}
              </div>
              ${copy.supporting ? `<div style="margin-top:20px;max-width:780px;font-size:29px;line-height:1.3;font-weight:500;color:rgba(255,255,255,0.92);text-shadow:0 2px 20px rgba(0,0,0,0.45);">${escapeHtml(copy.supporting)}</div>` : ''}
            </div>
          </div>
        </body>
      </html>
    `, { waitUntil: 'load' });

    await page.evaluate(async () => {
      const img = document.querySelector('.bg');
      await new Promise((resolve) => {
        if (!img) return resolve();
        if (img.complete) return resolve();
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
      if (document.fonts?.ready) await document.fonts.ready;
    });

    const buffer = await page.screenshot({ type: 'png' });
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } finally {
    await page.close();
  }
}

async function applyPromotionalOverlays(images, textMode = 'headline-supporting', topic = '', brand = '') {
  if (!Array.isArray(images) || !images.length) return images || [];

  try {
    return await Promise.all(images.map(async (image) => {
      if (!image?.url || image.overlayApplied) return image;
      const overlaidUrl = await renderPromotionalOverlay(image.url, image.description || '', textMode, topic, brand);
      return { ...image, url: overlaidUrl, overlayApplied: true };
    }));
  } catch (error) {
    console.error('Failed to apply promotional overlays:', error.message);
    return images;
  }
}

async function loadLibraryImages(req) {
  const auth = await requireUser(req);
  if (auth.error) return [];

  const { data, error } = await auth.admin
    .from('social_image_library')
    .select('id, url, description, tags, created_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('Failed to load social image library:', error.message);
    return [];
  }

  return data || [];
}

async function buildRealFallbackImages(req, descriptions, safeCount) {
  const libraryImages = await loadLibraryImages(req);
  const slice = descriptions.slice(0, safeCount);
  const usedLibraryIds = new Set();
  const result = [];

  for (const description of slice) {
    if (isProductAdDescription(description)) {
      result.push(...buildStockFallbackImages([description], 1));
      continue;
    }

    // Try to find a relevant library image (must have at least one keyword match)
    const ranked = libraryImages
      .map((image) => ({ image, score: scoreLibraryImage(description, image) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.image.created_at || 0).getTime() - new Date(a.image.created_at || 0).getTime();
      });

    const best = ranked.find(({ image, score }) => score > 0 && !usedLibraryIds.has(image.id));
    if (best) {
      usedLibraryIds.add(best.image.id);
      result.push({
        url: best.image.url,
        description,
        generatedAt: new Date().toISOString(),
        fallback: true,
        source: 'library',
        libraryImageId: best.image.id,
      });
    } else {
      result.push(...buildStockFallbackImages([description], 1));
    }
  }

  return result;
}

async function persistReturnedImages(req, images) {
  if (!Array.isArray(images) || !images.length) return images || [];
  const auth = await requireUser(req);
  if (auth.error) return images;

  const persisted = await Promise.all(images.map(async (image, index) => {
    if (!image?.url || image?.source === 'library') return image;
    try {
      const saved = await persistImageForUser(auth, {
        imageUrl: image.url,
        description: image.description || `generated-image-${index + 1}`,
        tags: ['social', image.source || 'generated'].filter(Boolean),
        source: 'social',
        skipLibrary: true,   // upload to storage for stable URL, but don't pollute the media library
      });
      return {
        ...image,
        url: saved.url,
        storagePath: saved.storage_path,
        libraryImageId: saved.id,
      };
    } catch (error) {
      console.error('Failed to persist generated image:', error.message);
      return image;
    }
  }));

  return persisted;
}

async function ensureUniqueImageCount(req, images, descriptions, targetCount, hint = '') {
  const uniqueImages = dedupeImages(images);
  if (uniqueImages.length >= targetCount) return uniqueImages.slice(0, targetCount);

  // Use stock images (not library) to fill gaps — library images have unreliable
  // descriptions because they store post copy, not what the image actually shows.
  const fallbackDescriptions = descriptions.slice(uniqueImages.length, targetCount);
  if (!fallbackDescriptions.length) return uniqueImages;

  const fallbackImages = buildStockFallbackImages(fallbackDescriptions, fallbackDescriptions.length, hint);
  const combined = dedupeImages([...uniqueImages, ...fallbackImages]);
  return combined.slice(0, targetCount);
}

export const config = { maxDuration: 60 };

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, ok: false, error: 'Method not allowed' });
  }

  try {
    const { descriptions, style = 'modern', creativeType = 'realistic', textMode = 'headline-supporting', count = 1, imageDirection = '', topic = '', audience = '', brand = '' } = req.body;

    if (!descriptions || descriptions.length === 0) {
      return res.status(400).json({ success: false, ok: false, error: 'Image descriptions are required' });
    }

    const openaiKey = process.env.OPENAI_API_KEY;

    // Generate images for each description (cap at 30 to match the create UI limit)
    const requestedCount = Number.isFinite(Number(count)) ? Number(count) : 1;
    const safeCount = Math.max(1, Math.min(requestedCount, 30));
    const batchSize = Math.min(descriptions.length, safeCount);

    if (!openaiKey) {
      const fallbackImages = await persistReturnedImages(req, await applyPromotionalOverlays(await buildRealFallbackImages(req, descriptions, safeCount), textMode, topic, brand));
      return res.status(200).json({
        success: true,
        ok: true,
        data: { images: fallbackImages, generated: fallbackImages.length, requested: batchSize },
        images: fallbackImages,
        generated: fallbackImages.length,
        requested: batchSize,
        fallback: true,
        fallbackSource: fallbackImages[0]?.source || 'stock',
        errorCode: 'missing_openai_key',
        error: 'OPENAI_API_KEY is not configured, so fallback real images were used instead.'
      });
    }

    console.log(`📸 Generating ${batchSize} images in parallel`);

    const rawResults = await Promise.all(
      Array.from({ length: batchSize }, async (_, i) => {
        const description = descriptions[i];
        const prompt = buildPhotoCreativePrompt(description, style, creativeType, i, imageDirection, audience);
        try {
          const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
            body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size: '1024x1024', quality: 'auto' }),
          });
          if (!response.ok) {
            const errorBody = await response.json();
            console.error(`❌ OpenAI error [${i}]:`, errorBody);
            return { error: normalizeApiError(errorBody, 'Image generation failed.'), description };
          }
          const data = await response.json();
          const item = data.data?.[0];
          const url = item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : null);
          if (!url) {
            return { error: normalizeApiError(null, 'Image generation returned no usable image data.'), description };
          }
          return { url, description, generatedAt: new Date().toISOString() };
        } catch (err) {
          console.error(`❌ Error generating image [${i}]:`, err.message);
          return { error: normalizeApiError(null, err.message || 'Image generation failed.'), description };
        }
      })
    );

    const images = [];
    let hadGenerationFailure = false;
    let lastError = null;

    for (const result of rawResults) {
      if (result.error) {
        hadGenerationFailure = true;
        lastError = result.error;
      } else {
        images.push(result);
      }
    }

    console.log(`📸 Image generation complete: ${images.length}/${batchSize} successful`);

    if (!images.length) {
      const fallbackImages = await persistReturnedImages(req, await applyPromotionalOverlays(await buildRealFallbackImages(req, descriptions, safeCount), textMode, topic, brand));
      return res.status(200).json({
        success: true,
        ok: true,
        data: { images: fallbackImages, generated: fallbackImages.length, requested: batchSize },
        images: fallbackImages,
        generated: fallbackImages.length,
        requested: batchSize,
        fallback: true,
        fallbackSource: fallbackImages[0]?.source || 'stock',
        errorCode: lastError?.code || 'image_generation_failed',
        error: lastError?.message || 'AI image generation failed. Fallback real images were used instead.'
      });
    }

    const overlaidImages = await applyPromotionalOverlays(images, textMode, topic, brand);

    if (hadGenerationFailure && overlaidImages.length < batchSize) {
      const remainder = descriptions.slice(overlaidImages.length, batchSize);
      // Use stock images for partial-failure gaps — never library, which can contain
      // wrongly-tagged images from previous bad generations.
      const fallbackImages = await applyPromotionalOverlays(buildStockFallbackImages(remainder, remainder.length, topic || imageDirection), textMode, topic, brand);
      overlaidImages.push(...fallbackImages);
    }

    const uniqueImages = await ensureUniqueImageCount(req, overlaidImages, descriptions, batchSize, topic || imageDirection);
    const persistedImages = await persistReturnedImages(req, await applyPromotionalOverlays(uniqueImages, textMode, topic, brand));

    return res.status(200).json({ 
      success: true,
      ok: true, 
      data: { images: persistedImages, generated: persistedImages.length, requested: batchSize },
      images: persistedImages,
      generated: persistedImages.length,
      requested: batchSize,
      fallback: hadGenerationFailure && persistedImages.some((image) => image.fallback),
      fallbackSource: persistedImages.find((image) => image.fallback)?.source || null,
      partial: hadGenerationFailure && persistedImages.length < batchSize,
      errorCode: hadGenerationFailure ? lastError?.code || null : null,
      error: hadGenerationFailure ? lastError?.message || null : null
    });

  } catch (err) {
    console.error('Social AI image generation error:', err);
    return res.status(500).json({ success: false, ok: false, error: err.message || 'Internal server error' });
  }
}

export default withAuth(handler);
