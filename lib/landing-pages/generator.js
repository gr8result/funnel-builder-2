// Brief -> landing page document.
//
// recommendStructure() decides which sections this campaign needs and says why. composeDocument() lays them out with
// copy from either the AI (aiCopy) or the built-in copywriter, and the result is a complete page on first generation.
// Claims are guarded: testimonials, credentials, offers and numbers only appear when the brief supplied them.

import { OBJECTIVES } from './interview.js';
import { isResidentialBrief } from './imagery.js';
import { cleanText, emptyDocument, makeSection, normaliseDocument, safeUrl, SECTION_TYPES } from './pageModel.js';
import { campaignObjective, campaignCta, HERO_VARIANTS, SECTION_VARIANTS, defaultHeroVariant } from './campaignIntent.js';

const OBJECTIVE_ANGLES = {
  prelaunch: { eyebrow: 'Pre-launch', verb: 'Discover', cta: 'Register Your Interest' },
  enquiries: { eyebrow: 'Let’s talk', verb: 'Discover', cta: 'Get in touch' },
  display: { eyebrow: 'Visit us', verb: 'Explore', cta: 'Plan your visit' },
  package: { eyebrow: 'Featured offer', verb: 'Discover', cta: 'Explore the offer' },
  kdr: { eyebrow: 'Specialist services', verb: 'Explore', cta: 'Discuss your needs' },
  event: { eyebrow: 'Upcoming event', verb: 'Join', cta: 'Reserve your place' },
  other: { eyebrow: 'Find out more', verb: 'Discover', cta: 'Get in touch' },
};

export function recommendStructure(brief = {}) {
  const media = Array.isArray(brief.media) ? brief.media : [];
  const images = media.filter((m) => m.kind !== 'video');
  const videos = media.filter((m) => m.kind === 'video');
  const testimonials = Array.isArray(brief.testimonials) ? brief.testimonials : [];
  const credentials = Array.isArray(brief.credentials) ? brief.credentials : [];
  const usps = Array.isArray(brief.usps) ? brief.usps : [];
  const imagePlanning = brief.imagePlanningEnabled === true;
  const out = [];
  const add = (type, reason) => out.push({
    type, reason,
    ...(type === 'benefits' && (brief.painPoints?.length || imagePlanning) ? { variant: 'comparison' } : {}),
    ...(type === 'services' && (images.length > 1 || imagePlanning) ? { variant: 'showcase' } : {}),
    ...(type === 'process' && imagePlanning ? { variant: 'connected' } : {}),
    ...(type === 'about' && imagePlanning ? { variant: 'image-banner' } : {}),
  });

  add('hero', images.length || imagePlanning ? 'Leads with campaign-specific cinematic photography and the campaign promise.' : 'Leads with the campaign promise; imagery is still required.');
  if (credentials.length) add('trust', 'Shows the credentials you supplied straight under the headline.');
  add('benefits', usps.length ? 'Turns your strengths into clear reasons to choose you.' : 'Explains the value of your offering for this audience.');
  if (offeringItems(brief).length >= 2) add('services', 'Explains each product or service this campaign promotes.');
  if (['enquiries', 'kdr', 'package', 'other', 'prelaunch', 'booking'].includes(campaignObjective(brief))) add('process', campaignObjective(brief) === 'prelaunch' ? 'Explains the proposed connected workflow and what registration means.' : 'Explains what happens after a customer gets in touch.');
  if (images.length >= 4 || imagePlanning) add('gallery', images.length >= 4 ? 'Shows the campaign images you supplied.' : 'Creates a large visual story from planned campaign imagery.');
  if (imagePlanning || images.length >= 2) add('about', 'Pairs the business story and approach with a large editorial photograph.');
  if (videos.length) add('video', 'Plays the video you supplied.');
  if (testimonials.length) add('testimonials', 'Uses the client testimonials you supplied, word for word.');
  if (brief.offer) add('offer', 'Restates your offer with a single, clear action.');
  add('faq', 'Answers the questions people ask before they enquire.');
  add('enquiry', 'Captures the enquiry and sends it straight into Leads and CRM.');
  if (brief.phone || brief.email || brief.address) add('contact', 'Gives people who prefer to call a direct way to reach you.');
  add('footer', 'Business details, privacy and legal.');
  return out;
}

export function validateStructure(candidate, brief = {}, fallback = recommendStructure(brief)) {
  if (!Array.isArray(candidate)) return fallback;
  const media = Array.isArray(brief.media) ? brief.media : [];
  const imageCount = media.filter((item) => item.kind !== 'video' && safeUrl(item.src)).length;
  const hasVideo = media.some((item) => item.kind === 'video' && safeUrl(item.src));
  const hasContact = !!(brief.phone || brief.email || brief.address);
  const has = (key) => Array.isArray(brief[key]) && brief[key].length > 0;
  const eligible = {
    trust: has('credentials'),
    gallery: imageCount >= 4 || brief.imagePlanningEnabled === true,
    video: hasVideo,
    testimonials: has('testimonials'),
    offer: !!String(brief.offer || '').trim(),
    contact: hasContact,
    services: offeringItems(brief).length > 0 || brief.capabilities?.length > 0,
  };
  const seen = new Set();
  const sections = [];
  for (const item of candidate) {
    const type = typeof item === 'string' ? item : item?.type;
    if (!SECTION_TYPES[type] || seen.has(type) || (type in eligible && !eligible[type])) continue;
    if (sections.length >= 10 && !['hero', 'enquiry', 'footer'].includes(type)) continue;
    seen.add(type);
    sections.push({
      type,
      reason: cleanText(typeof item === 'object' ? item.reason || '' : '', 160) || 'Selected for this campaign.',
      ...(SECTION_VARIANTS[type]?.includes(item?.variant) ? { variant: item.variant } : brief.imagePlanningEnabled === true && type === 'benefits' ? { variant: 'comparison' } : {}),
      ...(brief.imagePlanningEnabled === true && type === 'services' && !SECTION_VARIANTS[type]?.includes(item?.variant) ? { variant: 'showcase' } : {}),
      ...(brief.imagePlanningEnabled === true && type === 'process' && !SECTION_VARIANTS[type]?.includes(item?.variant) ? { variant: 'connected' } : {}),
      ...(brief.imagePlanningEnabled === true && type === 'about' && !SECTION_VARIANTS[type]?.includes(item?.variant) ? { variant: 'image-banner' } : {}),
    });
  }
  if (!sections.some((section) => section.type === 'hero')) return fallback;
  if (brief.capabilities?.length && !seen.has('services')) {
    sections.splice(1, 0, { type: 'services', reason: 'Explains the supplied capabilities and their readiness before conversion.' });
  }

  if (brief.imagePlanningEnabled === true && isResidentialBrief(brief) && !sections.some((section) => section.type === 'gallery')) {
    // Property campaigns sell through photographs, so a home-photo gallery is always included.
    const after = sections.findIndex((section) => section.type === 'services');
    sections.splice(after >= 0 ? after + 1 : Math.max(1, sections.length - 3), 0, { type: 'gallery', reason: 'A photographic tour of the rooms and spaces buyers care about.' });
  }
  const required = ['hero', 'enquiry', 'footer'];
  for (const type of required) {
    if (!seen.has(type)) sections.push({ type, reason: 'Required for a clear campaign journey.' });
  }
  if (brief.imagePlanningEnabled === true && sections.length < 8) {
    const enrich = [
      ['benefits', true, 'Connects visitor pain points to practical campaign benefits.'],
      ['services', eligible.services !== false, 'Explains the supplied offering with visual support.'],
      ['process', true, 'Makes the next steps clear before asking for an enquiry.'],
      ['about', true, 'Adds a large editorial story section.'],
      ['offer', eligible.offer === true, 'Restates the supplied campaign offer without inventing terms.'],
      ['faq', true, 'Answers common questions before conversion.'],
      ['gallery', eligible.gallery === true, 'Builds an image-led campaign story.'],
      ['contact', eligible.contact === true, 'Provides a direct contact path.'],
    ];
    for (const [type, allowed, reason] of enrich) {
      if (sections.length >= 8) break;
      if (!allowed || sections.some((section) => section.type === type)) continue;
      const before = sections.findIndex((section) => section.type === 'enquiry');
      sections.splice(before < 0 ? sections.length : before, 0, { type, reason });
    }
  }
  const hero = sections.find((section) => section.type === 'hero');
  const footer = sections.find((section) => section.type === 'footer');
  const middle = sections.filter((section) => !required.includes(section.type));
  const enquiry = sections.find((section) => section.type === 'enquiry');
  return [hero, ...middle, enquiry, footer];
}

// ---- Built-in copywriter --------------------------------------------------------------------------------------------

// Products are listed separately only when the builder listed them separately (commas, semicolons or new lines):
// "single and double storey homes" is one offering, not two.
export function offeringItems(brief = {}) {
  return String(brief.offering || '').split(/[,;\n]/).map((s) => s.trim().replace(/^(and|or)\s+/i, '')).filter((s) => s.length > 2).slice(0, 10);
}

// A plain-language reason for a strength the builder listed without explaining it. Never adds a claim.
const STRENGTH_REASONS = [
  [/price|cost|quote|budget/i, 'Ask us how this applies to your requirements and budget.'],
  [/design|architect|draft|plan/i, 'Discuss the options that suit your requirements.'],
  [/update|photo|communicat|contact|report/i, 'Ask how we keep you informed.'],
  [/quality|inspect|check|supervis|warrant/i, 'Find out what this means for your needs.'],
  [/local|council|area|region/i, 'Ask about availability in your location.'],
  [/time|schedule|deadline/i, 'Discuss your preferred timeframe with us.'],
];
function explainStrength(title) {
  const hit = STRENGTH_REASONS.find(([re]) => re.test(title));
  return hit ? hit[1] : 'Talk to us about how this can help you.';
}

function first(list, n) { return (Array.isArray(list) ? list : []).slice(0, n); }
function sentence(s) { const t = cleanText(s, 400).trim(); return t ? (/[.!?]$/.test(t) ? t : `${t}.`) : ''; }
function capital(s) { const t = String(s || '').trim(); return t ? t[0].toUpperCase() + t.slice(1) : ''; }
function area(brief) { return cleanText(brief.serviceArea || '', 120); }
// Lower-case a phrase's first letter for use mid-sentence, unless it starts with an acronym ("NDIS homes").
function inline(s) { const t = String(s || '').trim(); return /^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t; }
function audienceNoun(brief) { return inline(cleanText(brief.audience || 'our customers', 120).replace(/\.$/, '')); }

export function builtInCopy(brief = {}) {
  const angle = OBJECTIVE_ANGLES[campaignObjective(brief)] || OBJECTIVE_ANGLES.enquiries;
  const business = cleanText(brief.businessName || 'Our team', 120);
  const where = area(brief);
  const who = audienceNoun(brief);
  const offering = inline(cleanText(brief.offering || 'our products and services', 300).replace(/\.$/, ''));
  const yearMatch = String(brief.campaignName || '').match(/\b(20\d{2})\b/);
  const usps = first(brief.usps, 6);
  const cta = cleanText(campaignCta(brief), 60);

  const headline = yearMatch
    ? `${capital(offering)}, for ${yearMatch[1]}`
    : capital(offering);
  const benefitsFromUsps = usps.map((u) => {
    const [title, ...rest] = u.split(/\s[—–-]\s|:\s/);
    return { title: capital(title).slice(0, 70), body: rest.length ? sentence(capital(rest.join(' — '))) : explainStrength(title) };
  });
  const genericBenefits = [
    { title: 'Explore your options', body: sentence(`Find out more about ${offering}`) },
    { title: 'Discuss your needs', body: 'Tell us what matters to you and ask your questions.' },
    { title: 'Choose your next step', body: 'Contact us when you are ready to find out more.' },
  ];
  const benefits = (benefitsFromUsps.length >= 3 ? benefitsFromUsps : [...benefitsFromUsps, ...genericBenefits]).slice(0, 6);
  const heroHighlights = first(usps, 3).map((item) => capital(item.split(/\s[—–-]\s|:\s/)[0]).slice(0, 60));
  while (heroHighlights.length < 3) {
    const fallback = [
      `Options for ${who}`,
      `Explore ${offering}`,
      'Talk through your next step',
    ][heroHighlights.length];
    heroHighlights.push(fallback);
  }

  return {
    hero: {
      eyebrow: angle.eyebrow + (where ? ` · ${where}` : ''),
      headline,
      subheadline: sentence(`${business} ${campaignObjective(brief) === 'prelaunch' ? 'is preparing' : 'offers'} ${offering} for ${who}${where ? ` in ${where}` : ''}`) + ' ' + (brief.offer ? sentence(brief.offer) : campaignObjective(brief) === 'prelaunch' ? 'Register for release updates or ask about a demonstration.' : 'Get in touch to discuss your needs.'),
      primaryCta: cta,
      highlights: heroHighlights,
    },
    benefits: { eyebrow: `Why ${business}`, heading: `Options for ${who}`, intro: 'Explore the details and choose what suits your needs.', items: benefits },
    services: {
      eyebrow: 'What we offer',
      heading: capital(offering).slice(0, 90),
      intro: 'Find out more about the products and services in this campaign.',
      items: offeringItems(brief).map((s) => ({ title: capital(s).slice(0, 70), body: sentence(`Contact ${business} to discuss ${inline(s)}`) })),
    },
    process: {
      eyebrow: 'How it works',
      heading: 'Take the next step',
      intro: 'Start with the information that matters to you.',
      steps: [
        { title: 'Explore', body: sentence(`Read about ${offering}`) },
        { title: 'Tell us what you need', body: 'Share your requirements and any questions.' },
        { title: 'Discuss the details', body: 'Ask about availability, options and next steps.' },
        { title: 'Choose how to proceed', body: 'Decide what works for you.' },
      ],
    },
    gallery: { eyebrow: 'Take a closer look', heading: isResidentialBrief(brief) ? 'Inside your new home' : `Discover ${business}`, intro: '' },
    video: { heading: `More from ${business}`, intro: '' },
    testimonials: { eyebrow: 'Client stories', heading: 'What our clients say' },
    about: { eyebrow: 'About us', heading: `About ${business}`, body: sentence(`${business} offers ${offering}${where ? ` in ${where}` : ''}`) },
    offer: { eyebrow: 'Campaign offer', heading: brief.offer ? capital(cleanText(brief.offer, 140)) : 'Ready to find out more?', body: sentence(`Speak with ${business} about your needs`), cta },
    faq: {
      eyebrow: 'Questions',
      heading: 'Frequently asked questions',
      items: [
        { q: 'What is this campaign about?', a: sentence(`${business} is promoting ${offering}`) },
        { q: 'How can I find out more?', a: brief.offer ? sentence(brief.offer) + ' Contact us to discuss the details.' : 'Use the enquiry form or contact details on this page.' },
        { q: 'What should I include in my enquiry?', a: 'Tell us what interests you, your requirements and any questions.' },
        { q: 'Which locations or markets do you serve?', a: where ? sentence(`This campaign serves ${where}`) : 'Contact us to check availability for your location.' },
      ],
    },
    enquiry: campaignObjective(brief) === 'prelaunch'
      ? { eyebrow: 'Pre-launch registration', heading: 'See how this could fit your business', intro: 'Register for release updates or tell us you are interested in a demonstration. Availability and release timing will be confirmed by the team.', sidePoints: ['Register your interest', 'Choose whether to enquire about a demonstration', 'No unrelated marketing subscription'] }
      : { eyebrow: 'Enquire', heading: 'Tell us about your plans', intro: 'Answer a few quick questions and we will be in touch to arrange a time that suits you.', sidePoints: ['Describe what you need', 'Add a preferred time to your message', 'Include any questions'] },
    contact: { heading: `Talk to ${business}`, intro: 'Prefer to speak with someone? Contact us directly.' },
    footer: { tagline: sentence(`${business}${where ? ` — serving ${where}` : ''}`) },
    seo: {
      title: cleanText(brief.seoTitle || `${capital(offering).slice(0, 40)}${where ? ` in ${where.split(',')[0]}` : ''} | ${business}`, 70),
      description: cleanText(brief.seoDescription || `${business} offers ${offering}${where ? ` in ${where}` : ''}. ${cta}.`, 170),
    },
  };
}

// ---- Claim guard -----------------------------------------------------------------------------------------------------
// Words that make a factual claim. A sentence with one is only kept if the brief itself supports the claim.

const CLAIM_PATTERNS = [
  /\b(?:\d+[- ]day\s+)?(?:free\s+)?trial\b/i, /\blaunch(?:es|ing)?\s+(?:on|in)\s+[^.!?]+/i,
  /award[- ]?winning|\bawards?\b/i, /guarantee[ds]?/i, /\bcertified\b|\baccredited\b/i, /\b(no\.?|number) ?1\b|#1\b/i,
  /\bbest\b/i, /\b\d+\s?%/, /\bdiscount|\bsave \$|\bfree\b/i, /\b\d+\+?\s*(years|homes|families|builds|clients)\b/i, /\b(5|five)[- ]star\b|\brated\b/i,
  /\bmaster builders?\b|\bhia\b/i, /\$\s?\d/, /\bexperienced\b/i, /\bexperts?\b/i,
  /state[- ]of[- ]the[- ]art/i, /\btrusted\b/i, /\bhigh[- ]quality\b/i,
];

export function briefEvidenceText(brief = {}) {
  return [brief.offer, brief.offering, ...(brief.usps || []), ...(brief.credentials || []), ...(brief.testimonials || []).map((t) => t.quote), brief.objectiveDetail]
    .filter(Boolean).join(' \n ').toLowerCase();
}

export function unsupportedClaims(text, brief = {}) {
  const evidence = briefEvidenceText(brief);
  const found = [];
  for (const re of CLAIM_PATTERNS) {
    const m = String(text || '').match(re);
    if (m && !evidence.includes(m[0].toLowerCase().trim())) found.push(m[0]);
  }
  return found;
}

export const SOFTWARE_DRIFT = /\bdemonstrations?\b|\bdemo\b|pre-?launch|release (?:updates|timing)|\bworkflows?\b|\bplatform\b|\bsoftware\b/i;

export function isSoftwareBrief(brief = {}) {
  return campaignObjective(brief) === 'prelaunch' || /software|saas|platform|\bapp\b|technology|digital product/i.test(`${brief.industry || ''} ${brief.offering || ''} ${brief.objectiveDetail || ''}`);
}

export function stripUnsupportedClaims(text, brief = {}) {
  const sentences = String(text || '').split(/(?<=[.!?])\s+/);
  const software = isSoftwareBrief(brief);
  const kept = sentences.filter((s) => unsupportedClaims(s, brief).length === 0 && (software || !SOFTWARE_DRIFT.test(s) || SOFTWARE_DRIFT.test(briefEvidenceText(brief))));
  return kept.join(' ').trim();
}

function guardStrings(value, brief, removed, path = '') {
  if (typeof value === 'string') {
    const cleaned = stripUnsupportedClaims(value, brief);
    if (cleaned !== value.trim()) removed.push({ path, text: value });
    return cleaned;
  }
  if (Array.isArray(value)) return value.map((v, i) => guardStrings(v, brief, removed, `${path}.${i}`));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, guardStrings(v, brief, removed, path ? `${path}.${k}` : k)]));
  return value;
}

// Merge AI copy over built-in copy, section by section; anything the AI got wrong or left out falls back.
export function mergeCopy(base, ai, brief) {
  const removed = [];
  if (!ai || typeof ai !== 'object') return { copy: base, removed };
  const guarded = guardStrings(ai, brief, removed);
  const out = { ...base };
  for (const key of Object.keys(base)) {
    const a = guarded[key];
    if (!a || typeof a !== 'object') continue;
    const merged = { ...base[key] };
    for (const [k, v] of Object.entries(a)) {
      if (k === 'items' || k === 'steps') {
        const list = (Array.isArray(v) ? v : []).filter((it) => it && (it.title || it.q) && (it.body || it.a));
        if (list.length >= 2) merged[k] = list.slice(0, 10);
      } else if (k === 'highlights') {
        if (Array.isArray(v) && v.length) merged[k] = v.filter(Boolean).slice(0, 4);
      } else if (Array.isArray(merged[k])) {
        if (k === 'sidePoints' && Array.isArray(v)) merged[k] = v.filter((item) => typeof item === 'string' && item.trim()).map((item) => cleanText(item, 120)).slice(0, 5);
      } else if (k === 'imageIndex' && Number.isInteger(v) && v > 0) merged[k] = v;
      else if (typeof v === 'string' && v.trim()) merged[k] = v.trim();
    }
    out[key] = merged;
  }
  return { copy: out, removed };
}

export function copyQualityIssues(copy, brief = {}) {
  const issues = [];
  const firstScreen = `${copy?.hero?.headline || ''} ${copy?.hero?.subheadline || ''}`;
  if (/streamline|cutting.edge|seamless|integrated solutions|all.in.one management platform|one integrated platform|connect your .{0,40}workflows/i.test(firstScreen)) issues.push('Replace generic hero language with the visitor\'s specific frustrating task, the product category and practical value. Lead with the pain of repeated work or disconnected tools, not "connect workflows" or "one integrated platform".');
  if (!copy?.hero?.headline || !copy?.hero?.subheadline) issues.push('The first screen needs both a value headline and supporting explanation.');
  if (campaignObjective(brief) === 'prelaunch' && /\b(?:start|try|claim|get)\b.{0,30}\btrial\b/i.test(firstScreen)) issues.push('This is pre-launch registration, not a trial campaign.');
  return issues;
}

// ---- Composition -----------------------------------------------------------------------------------------------------

export function composeDocument(brief = {}, { aiCopy = null, structure = null, strategy = null } = {}) {
  const prelaunch = campaignObjective(brief) === 'prelaunch';
  const base = builtInCopy(brief);
  const { copy, removed } = mergeCopy(base, aiCopy, brief);
  if (isResidentialBrief(brief) && (!brief.capabilities?.length || brief.capabilities.every((capability) => capability.status === 'unconfirmed'))) {
    // Residential campaigns get design-inspiration cards, never invented service claims or software wording.
    copy.services.eyebrow = 'Home design inspiration';
    copy.services.heading = 'Design a home that suits your family';
    copy.services.intro = 'Ideas to consider as you plan your build. Final designs and inclusions are confirmed with your builder.';
    copy.services.items = [
      { title: 'A kitchen to gather in', body: 'Plan a practical layout with generous bench space for everyday family life.', icon: 'layers' },
      { title: 'Bathrooms made easy', body: 'Choose clean, low-maintenance finishes that keep the home feeling fresh.', icon: 'layers' },
      { title: 'Light-filled living', body: 'Open living and dining areas that connect naturally to the outdoors.', icon: 'layers' },
      { title: 'Space to entertain outside', body: 'Imagine a covered alfresco and yard ready for family and friends.', icon: 'layers' },
    ];
  } else if (Array.isArray(brief.capabilities) && brief.capabilities.length) {
    copy.services.items = brief.capabilities.slice(0, 10).map((capability) => {
      const written = copy.services.items.find((item) => item.title?.toLowerCase() === capability.name.toLowerCase());
      const verified = capability.status === 'available';
      const body = ((verified ? written?.body : capability.description) || capability.description || 'Discuss this workflow in a demonstration.')
        .replace(/^(?:Availability to be confirmed|Available|Planned|In development)[.:]\s*/i, '')
        .replace(/\s*(?:Availability to be confirmed|Available|Planned|In development)\.\s*$/i, '').trim();
      return {
        title: capability.name,
        body: verified || !['planned', 'development'].includes(capability.status) ? body : `${capability.status === 'planned' ? 'Planned workflow' : 'In development'}: ${body}`,
        ...(Number.isInteger(written?.imageIndex) ? { imageIndex: written.imageIndex } : {}),
        ...(written?.icon ? { icon: written.icon } : {}),
      };
    });
    if (brief.capabilities.every((capability) => capability.status === 'unconfirmed')) {
      copy.services.eyebrow = 'Explore the intended workflows';
      copy.services.intro = 'A preview of the intended workflows. Request a demonstration to discuss the scope relevant to your business.';
      if (/planned|under development|available now/i.test(copy.services.heading)) copy.services.heading = 'Explore the platform capabilities';
    }
  }
  const plan = structure || recommendStructure(brief);
  const doc = emptyDocument(brief);
  const media = Array.isArray(brief.media) ? brief.media : [];
  const images = media.filter((m) => m.kind !== 'video' && safeUrl(m.src));
  const video = media.find((m) => m.kind === 'video');
  const heroImage = images[0];
  let bgToggle = false;
  const nextBg = () => { bgToggle = !bgToggle; return bgToggle ? 'alt' : 'default'; };

  for (const { type, variant } of plan) {
    switch (type) {
      case 'hero': {
        const leadCampaign = !['display'].includes(campaignObjective(brief));
        doc.sections.push(makeSection('hero', {
          eyebrow: copy.hero.eyebrow,
          headline: copy.hero.headline,
          subheadline: copy.hero.subheadline,
          primaryCta: { label: prelaunch ? campaignCta(brief) : copy.hero.primaryCta, href: '#enquire' },
          secondaryCta: prelaunch ? { label: 'Request a Demonstration', href: '#enquire-demo' } : brief.phone ? { label: `Call ${brief.phone}`, href: `tel:${String(brief.phone).replace(/[^\d+]/g, '')}` } : { label: '', href: '' },
          image: heroImage ? { ...heroImage, src: heroImage.src, alt: heroImage.alt || `${brief.businessName || 'Our business'} campaign image` } : { src: '', alt: '' },
          highlights: copy.hero.highlights,
          showForm: leadCampaign,
        }, { background: 'default', paddingY: 'lg' }));
        const plannedVariant = HERO_VARIANTS.includes(variant) ? variant : HERO_VARIANTS.includes(strategy?.visual?.treatment) ? strategy.visual.treatment : (heroImage || brief.imagePlanningEnabled ? defaultHeroVariant(brief) : 'statement');
        doc.sections[doc.sections.length - 1].variant = plannedVariant;
        break;
      }
      case 'trust':
        doc.sections.push(makeSection('trust', { items: first(brief.credentials, 6).map((c) => ({ label: c })) }, { background: 'alt', paddingY: 'sm' }));
        break;
      case 'benefits':
        doc.sections.push(makeSection('benefits', {
          ...copy.benefits,
          ...(variant === 'comparison' && (strategy?.problemSolutionBenefits?.length || brief.painPoints?.length) ? {
            problemHeading: copy.benefits.problemHeading || 'Sound familiar?',
            solutionHeading: copy.benefits.solutionHeading || 'A different way forward',
            ...(images[1] ? { image: { ...images[1] }, imageHeading: copy.benefits.imageHeading || '' } : {}),
            items: strategy?.problemSolutionBenefits?.length ? strategy.problemSolutionBenefits.slice(0, 6).map((item) => ({
              problem: cleanText(item.problem, 160), title: cleanText(item.solution, 120), body: cleanText(item.benefit, 160),
            })) : copy.benefits.items.map((item, i) => ({ ...item, problem: item.problem || brief.painPoints?.[i] || '' })),
          } : {}),
        }, { background: nextBg() }));
        break;
      case 'services':
        doc.sections.push(makeSection('services', { ...copy.services, items: (copy.services.items || []).map((it, i) => {
          const media = images[Number.isInteger(it.imageIndex) && it.imageIndex > 0 ? it.imageIndex : i + 1];
          return { ...it, image: media ? { ...media, alt: media.alt || it.title } : { src: '', alt: '' } };
        }) }, { background: nextBg() }));
        break;
      case 'process':
        doc.sections.push(makeSection('process', copy.process, { background: 'dark' }));
        break;
      case 'gallery':
        doc.sections.push(makeSection('gallery', { ...copy.gallery, images: images.slice(1, 9).map((m) => ({ src: m.src, alt: m.alt || 'Campaign image' })) }, { background: nextBg() }));
        break;
      case 'video':
        if (video) doc.sections.push(makeSection('video', { ...copy.video, url: video.src }, { background: nextBg() }));
        break;
      case 'testimonials':
        doc.sections.push(makeSection('testimonials', { ...copy.testimonials, items: first(brief.testimonials, 6).map((t) => ({ quote: t.quote, name: t.name, detail: t.detail || '' })) }, { background: 'alt' }));
        break;
      case 'about':
        doc.sections.push(makeSection('about', { ...copy.about, ...(images[copy.about.imageIndex || 1] ? { image: { ...images[copy.about.imageIndex || 1] } } : {}) }, { background: nextBg() }));
        break;
      case 'offer':
        doc.sections.push(makeSection('offer', { eyebrow: copy.offer.eyebrow, heading: copy.offer.heading, body: copy.offer.body, cta: { label: copy.offer.cta, href: '#enquire' }, finePrint: '' }, { background: 'accent' }));
        break;
      case 'faq':
        doc.sections.push(makeSection('faq', copy.faq, { background: nextBg() }));
        break;
      case 'enquiry':
        doc.sections.push(makeSection('enquiry', copy.enquiry, { background: 'alt', paddingY: 'lg' }));
        break;
      case 'contact':
        doc.sections.push(makeSection('contact', copy.contact, { background: 'default' }));
        break;
      case 'footer':
        doc.sections.push(makeSection('footer', copy.footer, { background: 'dark', paddingY: 'sm' }));
        break;
      default:
        break;
    }
    if (SECTION_VARIANTS[type]?.includes(variant) && type !== 'hero') doc.sections[doc.sections.length - 1].variant = variant;
  }

  doc.seo = { title: copy.seo.title, description: copy.seo.description, ogImage: safeUrl(brief.shareImage || heroImage?.src || ''), noindex: false };
  doc.form.submitLabel = cleanText(prelaunch ? campaignCta(brief) : brief.ctaLabel || copy.hero.primaryCta || 'Send my enquiry', 60);
  if (prelaunch) {
    if (!doc.form.fields.some((field) => field.key === 'enquiry_intent')) {
      doc.form.fields.push({ key: 'enquiry_intent', type: 'select', label: 'What would you like?', options: ['Pre-launch registration', 'Demonstration enquiry'], required: false });
    }
  }
  doc.generation = {
    objective: campaignObjective(brief),
    ...(strategy ? { strategy } : {}),
    capabilities: (brief.capabilities || []).map(({ name, status }) => ({ name, status: ['available', 'planned', 'development'].includes(status) ? status : 'unconfirmed' })),
  };
  return { document: normaliseDocument(doc), removedClaims: removed, structure: plan };
}

export function describeBriefForAi(brief = {}) {
  return {
    campaignPrompt: brief.campaignPrompt || null,
    business: brief.businessName, industry: brief.industry || null, objective: OBJECTIVES[brief.objective] || brief.objective, objectiveDetail: brief.objectiveDetail,
    offering: brief.offering, audience: brief.audience, serviceArea: brief.serviceArea, offer: brief.offer || null,
    callToAction: brief.ctaLabel, strengths: brief.usps || [], credentials: brief.credentials || [],
    resolvedObjective: campaignObjective(brief), painPoints: brief.painPoints || [], capabilities: brief.capabilities || [],
    testimonialsSupplied: (brief.testimonials || []).length, campaignName: brief.campaignName, style: brief.style,
    media: (brief.media || []).filter((item) => item.kind !== 'video').map((item, index) => ({ index, alt: item.alt || '', disclosure: item.disclosure || '' })),
  };
}
