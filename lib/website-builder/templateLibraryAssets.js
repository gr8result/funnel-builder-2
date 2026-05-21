import { getServiceFallbackImageUrlBySlug } from '../funnelSections';

// Maps website-template slugs (which aren't in SERVICE_IMAGE_GROUP_BY_SLUG) to
// trade slugs that do have curated image pools, so the media library can display
// something immediately without hitting the AI generation endpoint.
const WEBSITE_SLUG_TO_TRADE_SLUG = {
  'business-agency': 'general-trades',
  'mortgage-broker': 'general-trades',
  'law-firm': 'general-trades',
  'medical-clinic': 'cleaning',
  'fitness': 'general-trades',
  'ecommerce': 'shopfitting',
  'hospitality': 'cleaning',
  'local-trades': 'general-trades',
};

function getWebsiteTemplateFallbackUrl(slug, slot) {
  const tradeSlug = WEBSITE_SLUG_TO_TRADE_SLUG[slug] || slug || 'general-trades';
  return getServiceFallbackImageUrlBySlug(tradeSlug, 'hero', { slot: String(slot || '1') });
}

const AUSTRALIAN_WEBSITE_LIBRARY_BRIEFS = [
  { slug: 'business-agency', name: 'Australian Agency Workspace 1', trade: 'Australian digital agency', title: 'Australian agency workspace', subtitle: 'Premium business workspace for an Australian service brand', keywords: ['Australia', 'Australian business', 'agency workspace', 'modern office'], slot: '1' },
  { slug: 'business-agency', name: 'Australian Agency Workspace 2', trade: 'Australian digital agency', title: 'Australian strategy meeting', subtitle: 'Australian team meeting in a premium office', keywords: ['Australia', 'strategy meeting', 'Australian office', 'business team'], slot: '2' },
  { slug: 'mortgage-broker', name: 'Australian Finance Consultation 1', trade: 'Australian mortgage broker', title: 'Australian finance consultation', subtitle: 'Borrower consultation in Australia', keywords: ['Australia', 'mortgage broker', 'finance consultation', 'property lending'], slot: '1' },
  { slug: 'mortgage-broker', name: 'Australian Finance Consultation 2', trade: 'Australian finance broker', title: 'Australian home loan planning', subtitle: 'Professional finance planning in Australia', keywords: ['Australia', 'home loan', 'finance planning', 'broker office'], slot: '2' },
  { slug: 'law-firm', name: 'Australian Legal Office 1', trade: 'Australian law firm', title: 'Australian legal consultation', subtitle: 'Professional legal meeting in Australia', keywords: ['Australia', 'law firm', 'legal consultation', 'professional office'], slot: '1' },
  { slug: 'law-firm', name: 'Australian Legal Office 2', trade: 'Australian legal practice', title: 'Australian legal workspace', subtitle: 'Premium Australian legal office interior', keywords: ['Australia', 'legal office', 'law workspace', 'professional meeting'], slot: '2' },
  { slug: 'medical-clinic', name: 'Australian Clinic Interior 1', trade: 'Australian medical clinic', title: 'Australian clinic consultation', subtitle: 'Modern Australian clinic environment', keywords: ['Australia', 'medical clinic', 'health consultation', 'clinic interior'], slot: '1' },
  { slug: 'medical-clinic', name: 'Australian Clinic Interior 2', trade: 'Australian healthcare practice', title: 'Australian healthcare reception', subtitle: 'Clean healthcare setting in Australia', keywords: ['Australia', 'healthcare', 'clinic reception', 'medical practice'], slot: '2' },
  { slug: 'fitness', name: 'Australian Fitness Studio 1', trade: 'Australian fitness studio', title: 'Australian fitness training', subtitle: 'Premium Australian gym or studio scene', keywords: ['Australia', 'fitness studio', 'gym training', 'strength coaching'], slot: '1' },
  { slug: 'fitness', name: 'Australian Fitness Studio 2', trade: 'Australian gym business', title: 'Australian coaching session', subtitle: 'Fitness coaching environment in Australia', keywords: ['Australia', 'gym coaching', 'fitness session', 'training floor'], slot: '2' },
  { slug: 'ecommerce', name: 'Australian Product Layout 1', trade: 'Australian ecommerce brand', title: 'Australian product styling', subtitle: 'Product-focused Australian ecommerce photography', keywords: ['Australia', 'ecommerce', 'product styling', 'retail brand'], slot: '1' },
  { slug: 'ecommerce', name: 'Australian Product Layout 2', trade: 'Australian retail brand', title: 'Australian retail display', subtitle: 'Premium retail presentation for Australian products', keywords: ['Australia', 'retail display', 'product showcase', 'brand photography'], slot: '2' },
  { slug: 'hospitality', name: 'Australian Hospitality 1', trade: 'Australian hospitality venue', title: 'Australian hospitality interior', subtitle: 'Restaurant or cafe interior in Australia', keywords: ['Australia', 'hospitality interior', 'restaurant', 'cafe'], slot: '1' },
  { slug: 'hospitality', name: 'Australian Hospitality 2', trade: 'Australian cafe brand', title: 'Australian dining atmosphere', subtitle: 'Premium dining setting suitable for Australia', keywords: ['Australia', 'dining', 'cafe venue', 'hospitality brand'], slot: '2' },
  { slug: 'local-trades', name: 'Australian Trade Service 1', trade: 'Australian local trade business', title: 'Australian local service crew', subtitle: 'Australian trade job in a suburban setting', keywords: ['Australia', 'local trade', 'service crew', 'suburban property'], slot: '1' },
  { slug: 'local-trades', name: 'Australian Trade Service 2', trade: 'Australian service business', title: 'Australian job site detail', subtitle: 'Trade tools and finished results in Australia', keywords: ['Australia', 'job site', 'service tools', 'trade business'], slot: '2' },
];

function buildAustralianWebsiteLibraryUrl(brief = {}) {
  const params = new URLSearchParams();
  params.set('slug', String(brief.slug || 'business-agency'));
  params.set('variant', 'hero');
  params.set('trade', String(brief.trade || 'Australian business'));
  params.set('title', String(brief.title || brief.name || 'Australian website image'));
  params.set('subtitle', String(brief.subtitle || 'Australian context only'));
  params.set('slot', String(brief.slot || '1'));
  params.set('keywords', ['Australia', 'Australian business', ...(Array.isArray(brief.keywords) ? brief.keywords : [])].join(', '));
  return `/api/funnels/template-image?${params.toString()}`;
}

export function getWebsiteTemplateLibraryAssets() {
  return AUSTRALIAN_WEBSITE_LIBRARY_BRIEFS.map((brief, index) => {
    const src = buildAustralianWebsiteLibraryUrl(brief);
    // Use the same static-pool fallback so the media library loads instantly
    // without triggering the AI generation endpoint
    const fallbackUrl = getWebsiteTemplateFallbackUrl(brief.slug, brief.slot);
    return {
      id: `website-template-au-${index + 1}`,
      name: brief.name,
      type: 'image/png',
      src,
      fallbackUrl: fallbackUrl || src,
    };
  });
}