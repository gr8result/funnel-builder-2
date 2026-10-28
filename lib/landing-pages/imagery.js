import { cleanText, safeUrl, setAt } from './pageModel.js';

const VISUAL_TYPES = new Set(['hero', 'benefits', 'services', 'gallery', 'about', 'enquiry']);
const STOP_WORDS = new Set(['about', 'after', 'and', 'are', 'before', 'business', 'campaign', 'can', 'customer', 'for', 'from', 'image', 'into', 'more', 'new', 'our', 'page', 'photo', 'service', 'set', 'that', 'the', 'their', 'this', 'use', 'with', 'you', 'your']);

function words(value) {
  return [...new Set(String(value || '').toLowerCase().match(/[a-z0-9]{3,}/g) || [])]
    .filter((word) => !STOP_WORDS.has(word));
}

function sectionSubject(section, brief) {
  const p = section?.props || {};
  return cleanText([
    p.heading, p.headline, p.eyebrow,
    brief.offering, brief.industry, brief.audience, brief.serviceArea,
  ].filter(Boolean).join(' · '), 500);
}

function imageSlot(sectionId, path, purpose, subject, options = {}) {
  return {
    id: `${sectionId}:${path}`,
    sectionId,
    path,
    purpose,
    subject: cleanText(subject, 500),
    aspectRatio: options.aspectRatio || '16:10',
    focalPoint: options.focalPoint || 'center',
    priority: options.priority || 5,
  };
}

export function buildImagePlan(document, brief = {}, strategy = null) {
  const slots = [];
  const supplied = Array.isArray(strategy?.imagery) ? strategy.imagery : [];
  const suppliedFor = (purpose) => supplied.find((item) => item?.purpose === purpose);
  const subjectFor = (purpose, fallback) => cleanText(suppliedFor(purpose)?.subject || fallback, 500);
  for (const section of (document?.sections || []).filter((item) => !item.hidden)) {
    const subject = sectionSubject(section, brief);
    if (section.type === 'hero') {
      slots.push(imageSlot(section.id, 'image', 'hero', subjectFor('hero', strategy?.visual?.direction || subject), {
        aspectRatio: '3:2', focalPoint: suppliedFor('hero')?.focalPoint || 'right center', priority: 10,
      }));
    } else if (section.type === 'benefits' && section.variant === 'comparison') {
      slots.push(imageSlot(section.id, 'image', 'benefits', subjectFor('benefits', `${subject} in a real-world aspirational setting`), { priority: 7 }));
    } else if (section.type === 'services') {
      (section.props.items || []).slice(0, 4).forEach((item, index) => {
        slots.push(imageSlot(section.id, `items.${index}.image`, `service-${index + 1}`, subjectFor(`service-${index + 1}`, `${item.title || subject}: ${item.body || ''}`), {
          aspectRatio: '16:10', priority: 8,
        }));
      });
    } else if (section.type === 'gallery') {
      const gallerySubjects = supplied.filter((item) => item?.purpose === 'gallery');
      const count = Math.max(4, Math.min(6, gallerySubjects.length || 5));
      for (let index = 0; index < count; index += 1) {
        slots.push(imageSlot(section.id, `images.${index}`, 'gallery', gallerySubjects[index]?.subject || `${subject} visual story ${index + 1}`, {
          aspectRatio: index === 0 ? '4:3' : '3:2',
          focalPoint: gallerySubjects[index]?.focalPoint || 'center',
          priority: 5,
        }));
      }
    } else if (section.type === 'about') {
      slots.push(imageSlot(section.id, 'image', 'about', subjectFor('about', `${subject} people, place or craft`), { aspectRatio: '5:4', priority: 7 }));
    } else if (section.type === 'enquiry') {
      slots.push(imageSlot(section.id, 'image', 'conversion', subjectFor('conversion', `${subject} aspirational final campaign image with calm space around the subject`), {
        aspectRatio: '4:3', focalPoint: 'center', priority: 4,
      }));
    }
  }
  return (isResidentialBrief(brief) ? assignResidentialSubjects(slots, brief) : slots).sort((a, b) => b.priority - a.priority);
}

export function isResidentialBrief(brief = {}) {
  const text = `${brief.industry || ''} ${brief.offering || ''} ${brief.objectiveDetail || ''} ${brief.audience || ''}`.toLowerCase();
  const tradeOnly = /cabinet|joinery|joiner|wardrobe|furniture|landscap|cleaning|real estate/.test(`${brief.industry || ''} ${brief.offering || ''}`.toLowerCase()) && !/\b(home builder|custom home|new home|house and land|first.home)\b/.test(text);
  return !tradeOnly && /home|house|builder|building|residential|dwelling|first.home|renovat|construction of/.test(text) && !/software|saas|platform|app\b/.test(String(brief.industry || '').toLowerCase());
}

// Distinct, room-specific subjects so one residential page never asks for the same photograph twice.
const RESIDENTIAL_HERO = 'A beautiful, realistic, modern single-storey Australian family home exterior at golden hour: brick and render facade, covered entry, tidy front lawn and garden, driveway, blue sky. A sensible new-build for a first-home buyer, clearly NOT a mansion or luxury estate.';
const RESIDENTIAL_SUBJECTS = {
  benefits: 'A young Australian couple and child happily standing at the front door of their new modest home, warm light, natural candid mood.',
  'service-1': 'A bright, modern open-plan kitchen in an everyday Australian new home: stone benchtop, island bench, pendant lights, timber floors, no clutter.',
  'service-2': 'A clean, modern family bathroom in a new Australian home: walk-in shower, white tiles, timber vanity, natural light.',
  'service-3': 'A light-filled open-plan living and dining room in a new Australian home, neutral sofa, large sliding doors to the yard.',
  'service-4': 'A covered alfresco outdoor entertaining area with a timber table, lawn and garden at a new Australian suburban home, late afternoon.',
  about: 'A residential builder and a young couple reviewing house plans inside a framed new home under construction, hard hats, daylight.',
  conversion: 'A welcoming front verandah and entry of a new Australian family home at dusk with warm lights glowing, calm space around it.',
};
const RESIDENTIAL_GALLERY = [
  'A calm master bedroom in a new Australian home with a bed, soft linen, and a window with garden views.',
  'A modern streetscape of two neat new Australian homes with landscaped front gardens and a clear sky.',
  'A tidy laundry and walk-in pantry in a modern Australian home, practical storage and light cabinetry.',
  'A children\'s bedroom in a new Australian home, bright and playful, soft colours.',
  'A backyard with lawn, a small deck and a vegetable garden behind a new Australian home, children playing.',
  'A timber and stone front entry door with a modern portico on a new Australian home.',
];

function assignResidentialSubjects(slots, brief) {
  let galleryIndex = 0;
  const region = cleanText(brief.serviceArea || '', 80);
  const suffix = region ? ` Setting reminiscent of ${region}, Australia.` : '';
  return slots.map((slot) => {
    let subject = RESIDENTIAL_SUBJECTS[slot.purpose];
    if (slot.purpose === 'hero') subject = RESIDENTIAL_HERO;
    if (slot.purpose === 'gallery') subject = RESIDENTIAL_GALLERY[galleryIndex++ % RESIDENTIAL_GALLERY.length];
    return subject ? { ...slot, subject: cleanText(`${subject}${suffix}`, 500), residential: true } : slot;
  });
}

function assetUrl(asset) {
  return safeUrl(asset?.src || asset?.url);
}

function assetDescription(asset) {
  return [asset?.alt, asset?.description, asset?.name, ...(Array.isArray(asset?.tags) ? asset.tags : [])].filter(Boolean).join(' ');
}

function scoreAsset(asset, slot, brief) {
  const description = assetDescription(asset).toLowerCase();
  const haystack = new Set(words(description));
  const query = words(`${slot.subject} ${brief.industry || ''} ${brief.offering || ''} ${brief.serviceArea || ''}`);
  const relevanceScore = query.reduce((total, word) => {
    if (haystack.has(word)) return total + 5;
    const singularMatch = [...haystack].some((candidate) => candidate.length >= 4 && word.length >= 4 && candidate.replace(/s$/, '') === word.replace(/s$/, ''));
    if (singularMatch) return total + 5;
    const partialMatch = [...haystack].some((candidate) => candidate.length >= 5 && word.length >= 5 && (candidate.includes(word) || word.includes(candidate)));
    return total + (partialMatch ? 2 : 0);
  }, 0);
  let score = relevanceScore;
  if (relevanceScore < 10) score -= 30;
  const campaignText = `${brief.industry || ''} ${brief.offering || ''} ${brief.objectiveDetail || ''}`.toLowerCase();
  if (!/software|platform|saas|app|technology|digital product/.test(campaignText) && /software|platform|dashboard|app interface|all.in.one|launching soon/.test(description)) score -= 40;
  const residentialCampaign = /home|house|architect|interior|residential/.test(`${slot.subject} ${campaignText}`);
  if (residentialCampaign && /webinar|laptop screen|software|platform|dashboard|seo|social media|digital marketing/.test(description)) score -= 50;
  if (residentialCampaign && !/home|house|exterior|interior|kitchen|bathroom|architect|residential|construction|builder|building|facade|landscap|floor plan/.test(description)) score -= 50;
  if (residentialCampaign && slot.purpose === 'hero' && !/home|house|exterior|architect|residential|facade/.test(description)) score -= 30;
  if (residentialCampaign && asset?.tags?.includes('landing-gallery')) score += 20;
  if (residentialCampaign && (asset?.tags?.includes('generic') || /\/generic\/|screenshot/i.test(assetUrl(asset)))) score -= 100;
  if (residentialCampaign && /gantt|chart|timeline|programme|schedule|diagram|spreadsheet|ui\b|app\b/i.test(`${description} ${assetUrl(asset)}`)) score -= 100;
  if (residentialCampaign && /chatgpt.image|openai|untitled|screenshot|\bimg[_-]?\d+/i.test(`${description} ${assetUrl(asset)}`)) score -= 100;
  if (residentialCampaign && !/home|house|kitchen|bathroom|bedroom|exterior|interior|facade|living|alfresco|backyard|garden|construction|architect/i.test([asset?.alt, asset?.description, asset?.name].filter(Boolean).join(' '))) score -= 100;
  if (residentialCampaign && /website|preview|builder-|mockup|interface/i.test(`${description} ${assetUrl(asset)}`)) score -= 100;
  if (residentialCampaign && /portrait|headshot|founder|team member|logo|badge/i.test(`${description} ${assetUrl(asset)}`)) score -= 80;
  if (residentialCampaign && /mansion|luxury|penthouse|skyscraper|office|commercial|warehouse/.test(description) && /first.home|affordable|budget/.test(campaignText + ' ' + (brief.audience || '').toLowerCase())) score -= 60;
  if (asset?.owner_scope === 'user') score += 5;
  if (asset?.kind === 'upload' || asset?.kind === 'edited') score += 3;
  if (asset?.is_template) score += 1;
  return score;
}

function plannedImage(asset, slot) {
  const src = assetUrl(asset);
  const alt = cleanText(asset?.alt || asset?.description || asset?.name || slot.subject, 240);
  return {
    src,
    alt,
    crop: { aspectRatio: slot.aspectRatio, focalPoint: slot.focalPoint },
    provenance: asset?.provenance || {
      kind: asset?.owner_scope === 'user' ? 'media-library' : 'approved-library',
      assetId: cleanText(asset?.id || asset?.storage_path || '', 240),
      evidence: false,
    },
  };
}

export function matchImagesToPlan(plan, assets, brief = {}) {
  const available = (assets || []).filter((asset) => assetUrl(asset));
  const used = new Set();
  const assignments = [];
  for (const slot of plan || []) {
    const ranked = available
      .filter((asset) => !used.has(assetUrl(asset)))
      .map((asset) => ({ asset, score: scoreAsset(asset, slot, brief) }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best || best.score <= 3) continue;
    used.add(assetUrl(best.asset));
    assignments.push({ slot, image: plannedImage(best.asset, slot), source: best.asset.owner_scope === 'user' ? 'media-library' : 'approved-library', score: best.score });
  }
  return assignments;
}

export function applyImageAssignments(document, assignments) {
  const next = structuredClone(document);
  for (const { slot, image } of assignments || []) {
    const section = next.sections.find((item) => item.id === slot.sectionId);
    if (!section || !safeUrl(image?.src)) continue;
    section.props = setAt(section.props, slot.path, image);
    if (section.type === 'hero') next.seo.ogImage = image.src;
  }
  return next;
}

function sectionImages(section) {
  const found = [];
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    if ('src' in value && 'alt' in value) {
      if (safeUrl(value.src)) found.push(value);
      return;
    }
    Object.values(value).forEach(visit);
  }
  visit(section?.props);
  return found;
}

export function inspectDesignQuality(document) {
  const sections = (document?.sections || []).filter((section) => !section.hidden);
  const hero = sections.find((section) => section.type === 'hero');
  const enquiry = sections.find((section) => section.type === 'enquiry');
  const visualSections = sections.filter((section) => sectionImages(section).length > 0);
  const allImages = sections.flatMap(sectionImages);
  const issues = [];
  const add = (code, severity, message, sectionId = null) => issues.push({ code, severity, message, sectionId });

  if (sections.length < 8) add('short-page', 'warning', 'Use at least eight meaningful sections for a substantial campaign page.');
  if (!safeUrl(hero?.props?.image?.src)) add('missing-hero-image', 'error', 'Add a relevant full-width hero image before presenting this draft as visually complete.', hero?.id);
  if (safeUrl(hero?.props?.image?.src) && !['cinematic-dark', 'cinematic-light'].includes(hero.variant)) add('weak-hero-composition', 'warning', 'Use a cinematic hero treatment with a readability overlay.', hero.id);
  if (visualSections.length < Math.min(5, Math.max(3, Math.floor(sections.length / 2)))) add('too-few-visual-sections', 'error', 'Too few sections use photography to tell the campaign story.');
  if (!safeUrl(enquiry?.props?.image?.src)) add('conversion-without-image', 'warning', 'Support the final enquiry form with a strong campaign image.', enquiry?.id);
  if (!hero?.props?.primaryCta?.label || !safeUrl(hero?.props?.primaryCta?.href)) add('weak-cta', 'error', 'The hero needs a visible working primary call to action.', hero?.id);
  if (!document?.form?.fields?.some((field) => field.key === 'email') || !document?.form?.submitLabel) add('incomplete-form', 'error', 'The enquiry form needs an email field and submit action.', enquiry?.id);

  const urls = allImages.map((image) => safeUrl(image.src)).filter(Boolean);
  if (new Set(urls).size < urls.length) add('repetitive-images', 'error', 'The same photograph is used in multiple places; replace duplicates before treating the page as visually complete.');
  for (const section of sections) {
    const images = sectionImages(section);
    if (VISUAL_TYPES.has(section.type) && ['hero', 'gallery'].includes(section.type) && !images.length) add('empty-image-slot', 'error', `${section.type === 'hero' ? 'Hero' : 'Gallery'} imagery is empty.`, section.id);
    if (section.type === 'gallery' && images.length < 4) add('thin-gallery', 'warning', 'The image gallery needs at least four complementary photographs.', section.id);
    if (section.style?.paddingY === 'lg' && !images.length && !['hero', 'enquiry'].includes(section.type)) add('excessive-empty-space', 'warning', 'A large text-only section may create excessive unused space.', section.id);
    if (section.type === 'services' && (section.props.items || []).length >= 3) {
      const items = section.props.items || [];
      if (images.length === 0) add('text-without-visual-support', 'warning', 'Service content needs photographic support or a more compact layout.', section.id);
      if (items.some((item) => !safeUrl(item?.image?.src))) add('service-image-missing', 'error', 'Each service card needs its own relevant photograph before the page is visually complete.', section.id);
    }
    for (const image of images) {
      if (!String(image.alt || '').trim()) add('missing-alt', 'warning', 'Add descriptive alt text to this image.', section.id);
      if (!image.crop?.focalPoint) add('missing-crop-plan', 'warning', 'Set a focal point so this image crops safely on desktop and mobile.', section.id);
    }
  }
  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    issues,
    metrics: { sectionCount: sections.length, visualSectionCount: visualSections.length, imageCount: allImages.length, uniqueImageCount: new Set(urls).size },
  };
}

export function repairDocumentDesign(document) {
  const next = structuredClone(document);
  function normaliseImages(value) {
    if (Array.isArray(value)) {
      value.forEach(normaliseImages);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if ('src' in value && 'alt' in value) {
      if (safeUrl(value.src)) value.crop = { aspectRatio: value.crop?.aspectRatio || '3:2', focalPoint: value.crop?.focalPoint || 'center' };
      return;
    }
    Object.values(value).forEach(normaliseImages);
  }
  let alternate = false;
  for (const section of (next.sections || []).filter((item) => !item.hidden)) {
    normaliseImages(section.props);
    const images = sectionImages(section);
    if (section.type === 'hero' && images.length) {
      section.variant = section.variant === 'cinematic-light' ? 'cinematic-light' : 'cinematic-dark';
      section.style.paddingY = 'lg';
      section.style.background = section.variant === 'cinematic-light' ? 'default' : 'dark';
    } else if (section.type === 'benefits') {
      section.variant = (section.props?.items || []).some((item) => String(item?.problem || '').trim()) ? 'comparison' : 'default';
      section.style.paddingY = 'md';
    } else if (section.type === 'services') {
      section.variant = images.length ? 'showcase' : 'default';
      section.style.paddingY = 'md';
    } else if (section.type === 'process') {
      section.variant = 'connected';
      section.style.background = 'dark';
      section.style.paddingY = 'md';
    } else if (section.type === 'about' && images.length) {
      section.variant = 'image-banner';
      section.style.paddingY = 'md';
    } else if (section.type === 'enquiry') {
      section.variant = images.length ? 'image-backed' : 'default';
      section.style.background = 'dark';
      section.style.paddingY = 'lg';
    } else if (!['trust', 'offer', 'footer'].includes(section.type)) {
      alternate = !alternate;
      section.style.background = alternate ? 'alt' : 'default';
      if (!images.length && section.style.paddingY === 'lg') section.style.paddingY = 'md';
    }
  }
  next.generation = { ...(next.generation || {}), designQuality: inspectDesignQuality(next) };
  return next;
}
