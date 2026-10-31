// The campaign interview: what the AI needs to know, in what order, and which answers are essential.
//
// The interview is a conversation, not a form. Each step asks one thing, accepts free text (the server may use the AI
// to pull several fields out of one answer), offers quick-pick choices where they help, and can be skipped unless it is
// essential. Progress is saved after every answer. Once the essentials are known the builder can generate at any time.

import { DEFAULT_FORM_FIELDS, FIELD_LIBRARY, STYLE_PRESETS, isHex, safeUrl, cleanText, defaultForm, imageMetadata } from './pageModel.js';
import { campaignObjective, campaignCta } from './campaignIntent.js';

export const OBJECTIVES = {
  prelaunch: 'Pre-launch registrations and demonstration enquiries',
  sales: 'Generate product sales',
  booking: 'Generate bookings',
  download: 'Promote a download',
  subscription: 'Build subscriptions',
  enquiries: 'Generate enquiries or consultation bookings',
  display: 'Drive visits to a location or showroom',
  package: 'Promote a product, package or offer',
  kdr: 'Promote a specialist service',
  event: 'Promote an event',
  other: 'Something else',
};

export const STEPS = [
  { key: 'campaignName', essential: true, question: 'What should we call this campaign?', help: 'Only you see this name. For example "Spring Promotion" or "New Product Launch".' },
  { key: 'business', essential: true, fields: ['businessName', 'phone', 'email'], question: 'What is the business name, and the phone number and email enquiries should go to?', help: 'These appear in the page header, contact section and footer.' },
  { key: 'objective', essential: true, question: 'What is the main goal of this campaign?', choices: Object.entries(OBJECTIVES).map(([value, label]) => ({ value, label })) },
  { key: 'offering', essential: true, question: 'Which products, services or experiences are you promoting?', help: 'For example a new product collection, accounting services or a local workshop.' },
  { key: 'audience', essential: true, question: 'Who is the ideal customer for this campaign?', help: 'For example local residents, small business owners or online shoppers.' },
  { key: 'serviceArea', essential: true, question: 'Which locations or markets does this campaign serve?', help: 'A suburb, region, country or an online audience.' },
  { key: 'offer', fields: ['offer', 'ctaLabel'], question: 'Is there a specific offer, and what should the main button say?', help: 'Only include offers you will honour. Leave the offer blank if there is none.', defaults: { ctaLabel: 'Book a consultation' } },
  { key: 'usps', question: 'Why should customers choose your business? List your genuine strengths.', help: 'One per line. Include only strengths your business can substantiate.' },
  { key: 'style', fields: ['style', 'primaryColour', 'secondaryColour', 'logoUrl'], question: 'How should the page feel? Add your logo and brand colours if you have them.', choices: Object.entries(STYLE_PRESETS).map(([value, p]) => ({ value, label: p.label })), defaults: { style: 'premium' } },
  { key: 'media', question: 'Upload photos or add video links relevant to this campaign.', help: 'Use your own products, services, team or business imagery. You can add more later in the editor.', kind: 'media' },
  { key: 'evidence', fields: ['testimonials', 'credentials'], question: 'Do you have customer testimonials, awards, memberships or professional credentials to show?', help: 'Only real ones — the page never invents reviews, awards or results.' },
  { key: 'formFields', question: 'What should the enquiry form ask?', kind: 'fields', defaults: { formFields: DEFAULT_FORM_FIELDS } },
  { key: 'thankYou', fields: ['thankYouMessage', 'thankYouRedirect'], question: 'What should people see after they enquire?', defaults: { thankYouMessage: 'Thanks for your enquiry. A member of our team will be in touch within one business day.' } },
  { key: 'dates', fields: ['startDate', 'endDate'], question: 'Does this campaign run between specific dates?' },
  { key: 'seo', fields: ['seoTitle', 'seoDescription', 'shareImage'], question: 'Anything specific for Google and social sharing? Otherwise we will write it for you.' },
];

export const ESSENTIAL_FIELDS = ['campaignName', 'businessName', 'objective', 'offering', 'audience', 'serviceArea'];

export function businessProfileDefaults(profile = {}, workspaceName = '') {
  const fields = { businessName: profile.tradingName || profile.legalBusinessName || workspaceName, industry: profile.industry, phone: profile.businessPhone, email: profile.businessEmail, address: profile.businessAddress };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => typeof value === 'string' && value.trim()).map(([key, value]) => [key, cleanText(value.trim(), key === 'address' ? 240 : 160)]));
}

export function fieldsForStep(step) {
  return step.fields || [step.key];
}

export function emptyInterview() {
  return { answered: [], skipped: [], transcript: [], updatedAt: null };
}

export function missingEssentials(brief = {}) {
  const missing = ESSENTIAL_FIELDS.filter((k) => !hasValue(brief[k]));
  if (!hasValue(brief.phone) && !hasValue(brief.email)) missing.push('contact');
  return missing;
}

export function hasValue(v) {
  if (Array.isArray(v)) return v.length > 0;
  return v != null && String(v).trim() !== '';
}

export function nextStep(brief = {}, interview = emptyInterview()) {
  const done = new Set([...(interview.answered || []), ...(interview.skipped || [])]);
  for (const step of STEPS) {
    if (done.has(step.key)) continue;
    // Skip a step the builder has already covered in an earlier free-text answer.
    if (fieldsForStep(step).every((f) => hasValue(brief[f]))) continue;
    return step;
  }
  return null;
}

export function progress(brief = {}, interview = emptyInterview()) {
  const done = new Set([...(interview.answered || []), ...(interview.skipped || [])]);
  const complete = STEPS.filter((s) => done.has(s.key) || fieldsForStep(s).every((f) => hasValue(brief[f]))).length;
  const missing = missingEssentials(brief);
  return { complete, total: STEPS.length, missingEssentials: missing, readyToGenerate: missing.length === 0 };
}

// Deterministic interpretation of an answer to one step. The AI layer may extract more, but this alone is enough to
// complete the interview, so the builder is never blocked by an AI outage.
export function interpretAnswer(stepKey, answer, brief = {}) {
  const step = STEPS.find((s) => s.key === stepKey);
  if (!step) throw new Error(`Unknown interview step: ${stepKey}`);
  const patch = {};
  const text = typeof answer === 'string' ? answer.trim() : answer;
  switch (stepKey) {
    case 'business': {
      const value = typeof text === 'object' && text ? text : parseBusiness(String(text || ''));
      if (value.businessName) patch.businessName = cleanText(value.businessName, 120);
      if (value.phone) patch.phone = cleanText(value.phone, 40);
      if (value.email) patch.email = cleanText(value.email, 160).toLowerCase();
      if (value.address) patch.address = cleanText(value.address, 240);
      break;
    }
    case 'objective': {
      const v = String(text || '').trim();
      const match = Object.entries(OBJECTIVES).find(([k, label]) => k === v || label.toLowerCase() === v.toLowerCase());
      patch.objective = match ? match[0] : 'other';
      if (!match && v) patch.objectiveDetail = cleanText(v, 300);
      break;
    }
    case 'offer': {
      const value = typeof text === 'object' && text ? text : { offer: text };
      if (hasValue(value.offer)) patch.offer = cleanText(value.offer, 300);
      patch.ctaLabel = cleanText(value.ctaLabel || brief.ctaLabel || (campaignObjective(brief) === 'prelaunch' ? campaignCta(brief) : step.defaults.ctaLabel), 60);
      break;
    }
    case 'usps':
      patch.usps = toList(text, 8, 200);
      break;
    case 'style': {
      const value = typeof text === 'object' && text ? text : { style: text };
      const style = String(value.style || '').toLowerCase();
      patch.style = STYLE_PRESETS[style] ? style : (Object.entries(STYLE_PRESETS).find(([, p]) => p.label.toLowerCase() === style)?.[0] || brief.style || 'premium');
      if (isHex(value.primaryColour)) patch.primaryColour = value.primaryColour;
      if (isHex(value.secondaryColour)) patch.secondaryColour = value.secondaryColour;
      if (safeUrl(value.logoUrl)) patch.logoUrl = safeUrl(value.logoUrl);
      break;
    }
    case 'media': {
      const items = Array.isArray(text) ? text : toList(text, 20, 600);
      patch.media = items.map((m) => (typeof m === 'string' ? { src: safeUrl(m), alt: '' } : { src: safeUrl(m.src), alt: cleanText(m.alt || '', 160), kind: m.kind === 'video' ? 'video' : 'image', ...imageMetadata(m) }))
        .filter((m) => m.src).map((m) => ({ ...m, kind: m.kind || (/youtube|youtu\.be|vimeo|\.mp4$/i.test(m.src) ? 'video' : 'image') }));
      break;
    }
    case 'evidence': {
      const value = typeof text === 'object' && text ? text : { testimonials: text };
      patch.testimonials = parseTestimonials(value.testimonials);
      patch.credentials = toList(value.credentials, 8, 160);
      break;
    }
    case 'formFields': {
      const list = Array.isArray(text) ? text : toList(text, 20, 60);
      const keys = list.map((k) => (typeof k === 'string' ? k.trim() : k)).filter(Boolean)
        .map((k) => (typeof k === 'string' ? (FIELD_LIBRARY[k] ? k : { key: k, label: k, type: 'text' }) : k));
      patch.formFields = keys.length ? keys : DEFAULT_FORM_FIELDS;
      break;
    }
    case 'thankYou': {
      const value = typeof text === 'object' && text ? text : { thankYouMessage: text };
      if (safeUrl(value.thankYouRedirect) && /^https?:/.test(safeUrl(value.thankYouRedirect))) patch.thankYouRedirect = safeUrl(value.thankYouRedirect);
      patch.thankYouMessage = cleanText(value.thankYouMessage || step.defaults.thankYouMessage, 600);
      break;
    }
    case 'dates': {
      const value = typeof text === 'object' && text ? text : {};
      if (/^\d{4}-\d{2}-\d{2}$/.test(value.startDate || '')) patch.startDate = value.startDate;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value.endDate || '')) patch.endDate = value.endDate;
      break;
    }
    case 'seo': {
      const value = typeof text === 'object' && text ? text : { seoDescription: text };
      if (hasValue(value.seoTitle)) patch.seoTitle = cleanText(value.seoTitle, 70);
      if (hasValue(value.seoDescription)) patch.seoDescription = cleanText(value.seoDescription, 170);
      if (safeUrl(value.shareImage)) patch.shareImage = safeUrl(value.shareImage);
      break;
    }
    default:
      patch[stepKey] = cleanText(text, 1200);
  }
  return patch;
}

export function applyAnswer({ brief = {}, interview = emptyInterview(), stepKey, answer, extracted = {}, skip = false }) {
  const step = STEPS.find((s) => s.key === stepKey);
  if (!step) throw new Error(`Unknown interview step: ${stepKey}`);
  const nextInterview = {
    answered: [...new Set([...(interview.answered || [])])],
    skipped: [...new Set([...(interview.skipped || [])])],
    transcript: [...(interview.transcript || [])].slice(-60),
    updatedAt: new Date().toISOString(),
  };
  let nextBrief = { ...brief };
  if (skip) {
    if (step.essential) throw new Error('This question is needed to build the page');
    nextBrief = { ...(step.defaults || {}), ...nextBrief };
    if (campaignObjective(brief) === 'prelaunch') {
      if (step.key === 'formFields' && !brief.formFields) nextBrief.formFields = defaultForm(brief).fields.map((field) => field.key);
      if (step.key === 'offer' && !brief.ctaLabel) nextBrief.ctaLabel = campaignCta(brief);
      if (step.key === 'thankYou' && !brief.thankYouMessage) nextBrief.thankYouMessage = defaultForm(brief).thankYou.message;
    }
    nextInterview.skipped = [...new Set([...nextInterview.skipped, step.key])];
    nextInterview.transcript.push({ role: 'assistant', step: step.key, text: step.question }, { role: 'user', step: step.key, text: '(skipped)' });
  } else {
    const patch = interpretAnswer(stepKey, answer, brief);
    // AI extraction only fills fields this answer did not set itself and that are still blank.
    const extra = Object.fromEntries(Object.entries(extracted || {}).filter(([k, v]) => hasValue(v) && !hasValue(patch[k]) && !hasValue(brief[k]) && ALLOWED_BRIEF_KEYS.has(k)));
    nextBrief = { ...nextBrief, ...patch, ...extra };
    if (step.essential && !fieldsForStep(step).some((f) => hasValue(nextBrief[f]))) throw new Error('Please answer this question so the page can be built');
    nextInterview.answered = [...new Set([...nextInterview.answered, step.key])];
    nextInterview.skipped = nextInterview.skipped.filter((k) => k !== step.key);
    nextInterview.transcript.push({ role: 'assistant', step: step.key, text: step.question }, { role: 'user', step: step.key, text: summariseAnswer(answer) });
  }
  return { brief: nextBrief, interview: nextInterview, next: nextStep(nextBrief, nextInterview), progress: progress(nextBrief, nextInterview) };
}

export const ALLOWED_BRIEF_KEYS = new Set(['campaignName', 'campaignPrompt', 'businessName', 'industry', 'phone', 'email', 'address', 'objective', 'objectiveDetail', 'offering', 'audience', 'serviceArea', 'offer', 'ctaLabel', 'usps', 'painPoints', 'capabilities', 'style', 'primaryColour', 'secondaryColour', 'logoUrl', 'media', 'testimonials', 'credentials', 'formFields', 'thankYouMessage', 'thankYouRedirect', 'startDate', 'endDate', 'seoTitle', 'seoDescription', 'shareImage', 'licence', 'privacyUrl']);

export function sanitiseBrief(input = {}) {
  const out = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (!ALLOWED_BRIEF_KEYS.has(k)) continue;
    if (['usps', 'credentials', 'painPoints'].includes(k)) out[k] = toList(v, 10, 300);
    else if (k === 'capabilities') out[k] = (Array.isArray(v) ? v : []).slice(0, 16).filter((item) => item && typeof item.name === 'string').map((item) => ({
      name: cleanText(item.name, 120), description: cleanText(item.description || '', 400),
      status: ['available', 'planned', 'development'].includes(item.status) ? item.status : 'unconfirmed',
    }));
    else if (k === 'testimonials') out[k] = parseTestimonials(v);
    else if (k === 'media') out[k] = (Array.isArray(v) ? v : []).map((m) => ({ src: safeUrl(m?.src), alt: cleanText(m?.alt || '', 160), kind: m?.kind === 'video' ? 'video' : 'image', ...imageMetadata(m) })).filter((m) => m.src).slice(0, 30);
    else if (k === 'formFields') out[k] = (Array.isArray(v) ? v : []).slice(0, 20);
    else if (['logoUrl', 'thankYouRedirect', 'shareImage', 'privacyUrl'].includes(k)) out[k] = safeUrl(v);
    else if (['primaryColour', 'secondaryColour'].includes(k)) { if (isHex(v)) out[k] = v; }
    else if (k === 'campaignPrompt') out[k] = cleanText(v, 4000);
    else out[k] = cleanText(v, 1200);
  }
  return out;
}

function summariseAnswer(answer) {
  if (answer == null) return '';
  if (typeof answer === 'string') return cleanText(answer, 600);
  return cleanText(JSON.stringify(answer), 600);
}

export function toList(value, max = 10, maxLen = 200) {
  const arr = Array.isArray(value) ? value : String(value || '').split(/\r?\n|;|•/);
  return arr.map((v) => cleanText(String(v).replace(/^\s*[-*\d.)]+\s*/, '').trim(), maxLen)).filter(Boolean).slice(0, max);
}

export function parseBusiness(text) {
  const email = (text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/) || [])[0] || '';
  const phone = (text.match(/(\+?\d[\d\s()-]{7,}\d)/) || [])[0] || '';
  let name = text.replace(email, '').replace(phone, '').split(/[,\n;]/).map((s) => s.trim()).filter(Boolean)[0] || '';
  name = name.replace(/^(we are|we're|it's|it is|business name is|the business is|name is)\s+/i, '').replace(/[.:]+$/, '');
  return { businessName: name, phone: phone.trim(), email };
}

// Testimonials are only ever taken from what the builder supplies. Accepts objects, or text lines like
// `"Quote here" — Name, Suburb`.
export function parseTestimonials(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : String(value).split(/\n\s*\n|\r?\n/);
  return items.map((item) => {
    if (item && typeof item === 'object') return { quote: cleanText(item.quote, 600), name: cleanText(item.name, 80), detail: cleanText(item.detail || '', 120) };
    const m = String(item).match(/^\s*["“]?(.+?)["”]?\s*(?:[—–-]{1,2})\s*([^,]+)(?:,\s*(.+))?$/);
    if (!m) return null;
    return { quote: cleanText(m[1], 600), name: cleanText(m[2], 80), detail: cleanText(m[3] || '', 120) };
  }).filter((t) => t && t.quote && t.name).slice(0, 9);
}
