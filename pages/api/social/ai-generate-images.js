// /pages/api/social/ai-generate-images.js
// Generate images for social media posts using OpenAI image generation.

import { requireUser } from '../../../lib/social/auth';
import { persistImageForUser } from './save-image';

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

function pickStockPool(description) {
  if (isProductAdDescription(description)) {
    return STOCK_IMAGE_POOLS.product || STOCK_IMAGE_POOLS.ecommerce || STOCK_IMAGE_POOLS.general;
  }

  const words = tokenize(description);
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
  const descriptionWords = new Set(tokenize(description));
  const imageWords = [
    ...tokenize(image?.description || ''),
    ...((Array.isArray(image?.tags) ? image.tags : []).flatMap((tag) => tokenize(tag))),
  ];

  if (!descriptionWords.size || !imageWords.length) return 0;
  return imageWords.reduce((score, word) => score + (descriptionWords.has(word) ? 1 : 0), 0);
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

    let selected = ranked.find(({ image }) => !usedIds.has(image.id))?.image;
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

function buildStockFallbackImages(descriptions, safeCount) {
  const usedUrls = new Set();
  return descriptions.slice(0, safeCount).map((description, index) => {
    const preferredPool = pickStockPool(description);
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

function buildOverlayCopy(description = '', textMode = 'headline-supporting') {
  const clean = normalizeDescriptionText(description);
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const firstSentence = sentences[0] || clean;
  const headlineBase = firstSentence
    .replace(/["']/g, '')
    .replace(/\s*[,:;\-]\s*$/, '')
    .trim();

  const headline = takeWords(headlineBase, 8).toUpperCase() || 'GROW YOUR BUSINESS';
  const supporting = buildSupportingCopy(clean, textMode);
  const eyebrow = textMode === 'minimal' ? '' : (takeWords(clean.split(/[:.!?\-]/)[0], 3).toUpperCase() || 'NEW');

  return {
    eyebrow,
    headline,
    supporting,
  };
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

function buildPhotoCreativePrompt(description, style, creativeType = 'realistic', index = 0) {
  const normalized = normalizeDescriptionText(description);
  const isSupplementAd = /(protein|supplement|powder|whey|nutrition|fitness)/i.test(normalized);
  const useGraphicCreative = shouldUseGraphicCreative(creativeType, index);
  return [
    'Create a premium square social media ad background image.',
    `Message to visualize: "${normalized}".`,
    `Brand style: ${style}.`,
    useGraphicCreative
      ? 'Use a polished graphic ad layout with strong composition, clear shape language, product-led composition, bold contrast, and premium campaign design quality.'
      : isSupplementAd
        ? 'Use real product-ad photography with a premium protein powder tub or pouch, shake bottle, gym or clean kitchen context, believable lighting, and a strong focus on the product itself.'
        : 'Use a real photographic scene, real people, real products, or real business environment that directly matches the message.',
    'If the image includes people for a business campaign, use believable small-business owners or professionals rather than generic corporate placeholder models.',
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
  ].join(' ');
}

async function getPromoBrowser() {
  if (!promoBrowserPromise) {
    promoBrowserPromise = import('puppeteer').then(async ({ default: puppeteer }) => (
      puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    ));
  }
  return promoBrowserPromise;
}

async function renderPromotionalOverlay(imageUrl, description, textMode = 'headline-supporting') {
  const browser = await getPromoBrowser();
  const page = await browser.newPage();
  const copy = buildOverlayCopy(description, textMode);

  try {
    await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
    await page.setContent(`
      <html>
        <body style="margin:0;background:#000;">
          <div style="width:1024px;height:1024px;position:relative;overflow:hidden;background:#05070b;font-family:'Segoe UI',Arial,sans-serif;">
            <img class="bg" src="${escapeHtml(imageUrl)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;" />
            <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.28) 46%, rgba(0,0,0,0.84) 100%);"></div>
            <div style="position:absolute;left:54px;right:54px;bottom:58px;color:#fff;">
              ${copy.eyebrow ? `<div style="display:inline-block;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.22);font-size:24px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:22px;">${escapeHtml(copy.eyebrow)}</div>` : ''}
              <div style="font-size:74px;line-height:0.94;font-weight:900;letter-spacing:-0.04em;text-transform:uppercase;text-wrap:balance;max-width:880px;text-shadow:0 4px 30px rgba(0,0,0,0.5);">
                ${escapeHtml(copy.headline)}
              </div>
              ${copy.supporting ? `<div style="margin-top:22px;max-width:760px;font-size:31px;line-height:1.2;font-weight:500;color:rgba(255,255,255,0.92);text-shadow:0 2px 20px rgba(0,0,0,0.45);">${escapeHtml(copy.supporting)}</div>` : ''}
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

async function applyPromotionalOverlays(images, textMode = 'headline-supporting') {
  if (!Array.isArray(images) || !images.length) return images || [];

  try {
    return await Promise.all(images.map(async (image) => {
      if (!image?.url || image.overlayApplied) return image;
      const overlaidUrl = await renderPromotionalOverlay(image.url, image.description || '', textMode);
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
  const preferredProductDescriptions = descriptions.slice(0, safeCount).filter((description) => isProductAdDescription(description));
  const remainingDescriptions = descriptions.slice(0, safeCount).filter((description) => !isProductAdDescription(description));
  const productStockFallback = buildStockFallbackImages(preferredProductDescriptions, preferredProductDescriptions.length);
  const libraryFallback = buildLibraryFallbackImages(remainingDescriptions, libraryImages, remainingDescriptions.length);
  const residualDescriptions = remainingDescriptions.slice(libraryFallback.length);
  const stockFallback = buildStockFallbackImages(residualDescriptions, residualDescriptions.length);
  return [...productStockFallback, ...libraryFallback, ...stockFallback];
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

async function ensureUniqueImageCount(req, images, descriptions, targetCount) {
  const uniqueImages = dedupeImages(images);
  if (uniqueImages.length >= targetCount) return uniqueImages.slice(0, targetCount);

  const fallbackDescriptions = descriptions.slice(uniqueImages.length, targetCount);
  if (!fallbackDescriptions.length) return uniqueImages;

  const fallbackImages = await buildRealFallbackImages(req, fallbackDescriptions, fallbackDescriptions.length);
  const combined = dedupeImages([...uniqueImages, ...fallbackImages]);
  return combined.slice(0, targetCount);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { descriptions, style = 'modern', creativeType = 'realistic', textMode = 'headline-supporting', count = 1 } = req.body;

    if (!descriptions || descriptions.length === 0) {
      return res.status(400).json({ error: 'Image descriptions are required' });
    }

    const openaiKey = process.env.OPENAI_API_KEY;

    // Generate images for each description (cap at 30 to match the create UI limit)
    const requestedCount = Number.isFinite(Number(count)) ? Number(count) : 1;
    const safeCount = Math.max(1, Math.min(requestedCount, 30));
    const batchSize = Math.min(descriptions.length, safeCount);

    if (!openaiKey) {
      const fallbackImages = await persistReturnedImages(req, await applyPromotionalOverlays(await buildRealFallbackImages(req, descriptions, safeCount), textMode));
      return res.status(200).json({
        ok: true,
        images: fallbackImages,
        generated: fallbackImages.length,
        requested: batchSize,
        fallback: true,
        fallbackSource: fallbackImages[0]?.source || 'stock',
        errorCode: 'missing_openai_key',
        error: 'OPENAI_API_KEY is not configured, so fallback real images were used instead.'
      });
    }

    const images = [];
    let hadGenerationFailure = false;
    let lastError = null;
    
    console.log(`📸 Starting image generation: requested=${requestedCount}, safe=${safeCount}, batch=${batchSize}`);
    
    for (let i = 0; i < batchSize; i++) {
      const description = descriptions[i];
      console.log(`📸 [${i + 1}/${batchSize}] Generating for: ${description.substring(0, 60)}...`);
      
      const prompt = buildPhotoCreativePrompt(description, style, creativeType, i);

      try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt: prompt,
            n: 1,
            size: '1024x1024',
            quality: 'high'
          })
        });

        if (!response.ok) {
          const error = await response.json();
          console.error(`❌ DALL-E error [${i}]:`, error);
          hadGenerationFailure = true;
          lastError = normalizeApiError(error, 'Image generation failed.');
          continue;
        }

        const data = await response.json();
        if (data.data && data.data[0]) {
          const item = data.data[0];
          const url = item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : null);
          if (!url) {
            console.error(`❌ Image payload missing url/b64_json [${i}]`);
            lastError = normalizeApiError(null, 'Image generation returned no usable image data.');
            continue;
          }
          console.log(`✅ Image generated [${i}]`);
          images.push({
            url,
            description: description,
            generatedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error(`❌ Error generating image [${i}]:`, err.message);
        hadGenerationFailure = true;
        lastError = normalizeApiError(null, err.message || 'Image generation failed.');
        continue;
      }
    }
    
    console.log(`📸 Image generation complete: ${images.length}/${batchSize} successful`);

    if (!images.length) {
      const fallbackImages = await persistReturnedImages(req, await applyPromotionalOverlays(await buildRealFallbackImages(req, descriptions, safeCount), textMode));
      return res.status(200).json({
        ok: true,
        images: fallbackImages,
        generated: fallbackImages.length,
        requested: batchSize,
        fallback: true,
        fallbackSource: fallbackImages[0]?.source || 'stock',
        errorCode: lastError?.code || 'image_generation_failed',
        error: lastError?.message || 'AI image generation failed. Fallback real images were used instead.'
      });
    }

    const overlaidImages = await applyPromotionalOverlays(images, textMode);

    if (hadGenerationFailure && overlaidImages.length < batchSize) {
      const remainder = descriptions.slice(overlaidImages.length, batchSize);
      const fallbackImages = await applyPromotionalOverlays(await buildRealFallbackImages(req, remainder, remainder.length), textMode);
      overlaidImages.push(...fallbackImages);
    }

    const uniqueImages = await ensureUniqueImageCount(req, overlaidImages, descriptions, batchSize);
    const persistedImages = await persistReturnedImages(req, await applyPromotionalOverlays(uniqueImages, textMode));

    return res.status(200).json({ 
      ok: true, 
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
    console.error('API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
