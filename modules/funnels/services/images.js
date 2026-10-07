import { SERVICE_IMAGE_GROUP_BY_SLUG, SERVICE_IMAGE_POOLS, SERVICE_IMAGE_TERMS_BY_SLUG } from '../data/serviceImages.js';


export function getServiceImageKeywords(theme, variant = 'hero', options = {}) {
  const slugKeywordMap = {
    'general-trades': ['tradesman', 'service', 'worksite'],
    plumbing: ['plumber', 'pipes', 'repair'],
    electrician: ['electrician', 'switchboard', 'wiring'],
    handyman: ['handyman', 'tools', 'repair'],
    mechanic: ['mechanic', 'garage', 'car'],
    cleaning: ['cleaning', 'home', 'spray'],
    painter: ['painter', 'paint', 'interior'],
    'lawn-care': ['lawn', 'mowing', 'garden'],
    'car-detailing': ['car', 'detailing', 'vehicle'],
    'pressure-washing': ['pressure', 'washing', 'driveway'],
    roofing: ['roofing', 'roof', 'trade'],
    hvac: ['hvac', 'aircon', 'technician'],
  };

  const derived = [
    ...(slugKeywordMap[theme.slug] || theme.slug.split('-')),
    ...String(options.title || '').toLowerCase().split(/[^a-z0-9]+/),
    ...String(options.subtitle || '').toLowerCase().split(/[^a-z0-9]+/),
  ]
    .filter(Boolean)
    .filter((word) => word.length > 2)
    .slice(0, 4);

  if (variant === 'gallery') derived.push('service');
  if (variant === 'card') derived.push('professional');

  return Array.from(new Set(derived)).slice(0, 5);
}


export function hashServiceImageSeed(...parts) {
  const input = parts.filter(Boolean).join('|');
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}


export function pickTradePoolImages(slug, pool, count = 5) {
  const uniquePool = Array.from(new Set((pool || []).filter(Boolean)));
  if (!uniquePool.length) return [];
  if (uniquePool.length <= count) return uniquePool.slice(0, count);

  const startIndex = hashServiceImageSeed(slug, uniquePool.length) % uniquePool.length;
  const picked = [];

  for (let index = 0; index < uniquePool.length && picked.length < count; index += 1) {
    picked.push(uniquePool[(startIndex + index) % uniquePool.length]);
  }

  return picked;
}


export function buildTradeSpecificImagePool(slug) {
  const groupKey = SERVICE_IMAGE_GROUP_BY_SLUG[slug];
  const pool = groupKey ? (SERVICE_IMAGE_POOLS[groupKey] || []) : [];
  return pickTradePoolImages(slug, pool, 5);
}


export function getFunnelTemplateLibraryAssets() {
  const seen = new Set();
  const assets = [];

  Object.keys(SERVICE_IMAGE_TERMS_BY_SLUG).forEach((slug) => {
    const label = String(slug || 'service').replace(/-/g, ' ');
    const theme = { slug, label };
    [
      {
        variant: 'hero',
        slot: '1',
        title: `${label} Australia`,
        subtitle: `Australian ${label} marketing image for a local business website`,
        service: `Australian ${label} business`,
      },
      {
        variant: 'gallery',
        slot: '2',
        title: `${label} service detail`,
        subtitle: `Australian ${label} job or finished result`,
        service: `Australian ${label} service detail`,
      },
    ].forEach((brief, index) => {
      const src = buildServiceTemplateImageUrl(theme, brief.variant, {
        title: brief.title,
        subtitle: brief.subtitle,
        service: brief.service,
        slot: brief.slot,
      });
      const normalized = String(src || '').trim();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      assets.push({
        id: `funnel-template-${slug}-${index + 1}`,
        name: `Funnel ${label} ${index + 1}`,
        type: 'image/png',
        src: normalized,
        fallbackUrl: getServiceFallbackImageUrlBySlug(slug, brief.variant, {
          title: brief.title,
          subtitle: brief.subtitle,
          service: brief.service,
          slot: brief.slot,
        }),
      });
    });
  });

  return assets;
}


export function getServiceImagePool(theme) {
  const tradeSpecificPool = buildTradeSpecificImagePool(theme?.slug);
  if (tradeSpecificPool.length) return tradeSpecificPool;

  const group = SERVICE_IMAGE_GROUP_BY_SLUG[theme?.slug] || 'trades';
  return SERVICE_IMAGE_POOLS[group] || SERVICE_IMAGE_POOLS.trades;
}


export function getServiceFallbackImageUrlBySlug(slug, variant = 'hero', options = {}) {
  const tradeSpecificPool = buildTradeSpecificImagePool(slug);
  const group = SERVICE_IMAGE_GROUP_BY_SLUG[slug] || 'trades';
  const pool = tradeSpecificPool.length ? tradeSpecificPool : (SERVICE_IMAGE_POOLS[group] || SERVICE_IMAGE_POOLS.trades);
  const variantOffset = variant === 'hero' ? 0 : variant === 'gallery' ? 1 : 2;
  const imageIndex = hashServiceImageSeed(
    slug,
    variant,
    options.title || '',
    options.subtitle || '',
    options.caption || '',
    options.service || ''
  );
  const slotText = String(options.slot || '').trim();
  const slotMatch = slotText.match(/(\d+)$/);
  const parsedSlot = Number.parseInt(slotMatch?.[1] || slotText, 10);
  if (Number.isFinite(parsedSlot) && parsedSlot >= 0) {
    return pool[(variantOffset + parsedSlot) % pool.length] || pool[0] || '';
  }

  const slotOffset = slotText ? hashServiceImageSeed(slug, variant, slotText) : 0;
  return pool[(imageIndex + variantOffset + slotOffset) % pool.length] || pool[0] || '';
}


export function buildServiceTemplateImageUrl(theme, variant = 'hero', options = {}) {
  const params = new URLSearchParams();
  params.set('slug', String(theme?.slug || 'service'));
  params.set('variant', variant);
  params.set('trade', String(theme?.label || 'Local Service'));
  params.set('title', String(options.title || theme?.sectionHeadline || theme?.label || 'Service Image'));

  const subtitle = String(options.subtitle || theme?.sectionIntro || theme?.visualHeadline || '').trim();
  if (subtitle) params.set('subtitle', subtitle);

  const serviceDetail = String(options.service || options.caption || '').trim();
  if (serviceDetail) params.set('service', serviceDetail);

  const slot = String(options.slot || '').trim();
  if (slot) params.set('slot', slot);

  const keywords = [
    ...(SERVICE_IMAGE_TERMS_BY_SLUG[theme?.slug] || []),
    theme?.slug,
    theme?.label,
    options.title,
    options.caption,
    options.subtitle,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .slice(0, 6)
    .join(', ');

  if (keywords) params.set('keywords', keywords);
  return `/api/funnels/template-image?${params.toString()}`;
}


export function getServiceImageUrl(theme, variant = 'hero', options = {}) {
  return buildServiceTemplateImageUrl(theme, variant, options);
}
