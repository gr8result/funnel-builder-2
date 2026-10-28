// Landing page document model.
//
// A landing page is one JSON document: theme, brand, SEO, the enquiry form, and an ordered list of sections. The
// editor, the AI assistant, the preview and the public page all read and write this one shape, so a manual edit, an
// AI change and the published page can never drift apart. Every text value is plain text (rendered as text nodes,
// never HTML); every URL passes safeUrl().

import { campaignObjective, campaignCta } from './campaignIntent.js';

export const SCHEMA_VERSION = 1;

export const SECTION_TYPES = {
  hero: { label: 'Hero', single: true },
  trust: { label: 'Credentials strip' },
  benefits: { label: 'Key benefits' },
  services: { label: 'Products & services' },
  process: { label: 'How it works' },
  gallery: { label: 'Image gallery' },
  video: { label: 'Video' },
  testimonials: { label: 'Testimonials' },
  about: { label: 'About us' },
  offer: { label: 'Offer / call to action' },
  faq: { label: 'Frequently asked questions' },
  enquiry: { label: 'Enquiry form', single: true, required: true },
  contact: { label: 'Contact details' },
  footer: { label: 'Footer', single: true, required: true },
};

export const BACKGROUNDS = ['default', 'alt', 'dark', 'accent'];
export const SPACING = ['sm', 'md', 'lg'];
export const ALIGNMENTS = ['left', 'center'];

export const FONT_PAIRS = {
  jakarta: { label: 'Plus Jakarta Sans', heading: 'Plus Jakarta Sans', body: 'Plus Jakarta Sans' },
  fraunces: { label: 'Fraunces + Inter', heading: 'Fraunces', body: 'Inter' },
  playfair: { label: 'Playfair Display + Manrope', heading: 'Playfair Display', body: 'Manrope' },
  manrope: { label: 'Manrope', heading: 'Manrope', body: 'Manrope' },
  dmserif: { label: 'DM Serif Display + DM Sans', heading: 'DM Serif Display', body: 'DM Sans' },
};

export const STYLE_PRESETS = {
  premium: { label: 'Premium & refined', fonts: 'jakarta', palette: { ink: '#0B0F1A', accent: '#E06910', surface: '#FBFAF7', surfaceAlt: '#F5F1E9', text: '#161C28', muted: '#525C6D' }, radius: 'soft' },
  modern: { label: 'Modern & bold', fonts: 'manrope', palette: { ink: '#0F172A', accent: '#2563EB', surface: '#FFFFFF', surfaceAlt: '#F1F5F9', text: '#0F172A', muted: '#475569' }, radius: 'round' },
  classic: { label: 'Warm & classic', fonts: 'playfair', palette: { ink: '#1F2A24', accent: '#9A6B3F', surface: '#FCFAF6', surfaceAlt: '#F2ECE2', text: '#22261F', muted: '#5D6158' }, radius: 'soft' },
  minimal: { label: 'Clean & minimal', fonts: 'fraunces', palette: { ink: '#111111', accent: '#3F6B4E', surface: '#FFFFFF', surfaceAlt: '#F6F6F4', text: '#141414', muted: '#5C5C5C' }, radius: 'sharp' },
};

const INDUSTRY_STYLE = [
  [/dent|health|medical|wellness|therapy|clinic/i, 'modern'],
  [/tour|travel|hospitality|adventure|outdoor/i, 'classic'],
  [/software|saas|technology|digital/i, 'minimal'],
  [/event|community|festival|arts|entertainment/i, 'premium'],
];

export const FIELD_LIBRARY = {
  name: { type: 'text', label: 'Full name', autocomplete: 'name' },
  email: { type: 'email', label: 'Email', autocomplete: 'email' },
  phone: { type: 'tel', label: 'Phone', autocomplete: 'tel' },
  business_name: { type: 'text', label: 'Business name', autocomplete: 'organization' },
  enquiry_intent: { type: 'select', label: 'What would you like?', options: ['Pre-launch registration', 'Demonstration enquiry'] },
  suburb: { type: 'text', label: 'Location', autocomplete: 'address-level2' },
  project_type: { type: 'select', label: 'What are you interested in?', options: ['Product information', 'Service enquiry', 'Consultation', 'Other'] },
  budget_range: { type: 'text', label: 'Budget range (optional)' },
  timeframe: { type: 'select', label: 'Preferred timeframe', options: ['As soon as possible', 'Within 6 months', '6–12 months', '12 months or more', 'Just researching'] },
  land_status: { type: 'select', label: 'Do you own land?', options: ['Yes', 'Purchasing now', 'Not yet'] },
  message: { type: 'textarea', label: 'How can we help?' },
};

export const DEFAULT_FORM_FIELDS = ['name', 'email', 'phone', 'suburb', 'project_type', 'timeframe', 'message'];
export const LOCKED_FIELD_KEYS = ['email'];

let idCounter = 0;
export function newId(prefix = 's') {
  idCounter = (idCounter + 1) % 1e6;
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}${idCounter.toString(36)}`;
}

export function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function cleanText(value, max = 2000) {
  if (value == null) return '';
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max);
}

// Provenance belongs to the asset metadata; only intentional editorial captions are public.
export function imageCaption(image) {
  if (typeof image?.caption === 'string') return cleanText(image.caption, 240);
  const legacy = String(image?.disclosure || '');
  if (image?.provenance?.kind === 'ai-illustration' || /AI[- ]generated|AI concept|illustrative imagery|not (?:a |an )?(?:product screenshot|customer project|completed customer)/i.test(legacy)) return '';
  return cleanText(legacy, 240);
}

export function imageMetadata(image) {
  return {
    ...(typeof image?.caption === 'string' ? { caption: cleanText(image.caption, 240) } : {}),
    ...(image?.disclosure ? { disclosure: cleanText(image.disclosure, 240) } : {}),
    ...(image?.provenance?.kind === 'ai-illustration' ? { provenance: { kind: 'ai-illustration', evidence: false } } : {}),
  };
}

// Only links a visitor can safely follow: http(s), mailto, tel, in-page anchors and site-relative paths.
export function safeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^#[A-Za-z0-9_-]*$/.test(raw)) return raw;
  if (/^\/(?!\/)[^\s]*$/.test(raw)) return raw;
  if (/^(mailto|tel):[^\s<>"']+$/i.test(raw)) return raw;
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.toString();
  } catch { /* fall through */ }
  return '';
}

export function slugify(value, fallback = 'campaign') {
  const s = String(value || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
  return s || fallback;
}

export function buildFormField(key, overrides = {}) {
  const base = FIELD_LIBRARY[key] || { type: 'text', label: overrides.label || 'Custom field' };
  const field = {
    id: overrides.id || newId('f'),
    key: key in FIELD_LIBRARY ? key : slugify(overrides.key || overrides.label || key, 'custom').replace(/-/g, '_'),
    type: overrides.type || base.type,
    label: cleanText(overrides.label || base.label, 120),
    placeholder: cleanText(overrides.placeholder || '', 160),
    required: overrides.required ?? ['name', 'email'].includes(key),
  };
  // Only set optional keys when present: the document must stay plain JSON (no undefined) for storage and SSR.
  const options = overrides.options || base.options;
  if (Array.isArray(options)) field.options = options.map((o) => cleanText(o, 120)).filter(Boolean).slice(0, 20);
  if (base.autocomplete) field.autocomplete = base.autocomplete;
  return field;
}

export function defaultForm(brief = {}) {
  const prelaunch = campaignObjective(brief) === 'prelaunch';
  const defaults = prelaunch ? ['name', 'email', 'business_name', 'phone', 'enquiry_intent'] : DEFAULT_FORM_FIELDS;
  const keys = Array.isArray(brief.formFields) && brief.formFields.length ? brief.formFields : defaults;
  const withEmail = keys.includes('email') ? keys : ['email', ...keys];
  return {
    id: newId('form'),
    heading: prelaunch ? 'Be part of what comes next' : 'Start the conversation',
    intro: prelaunch ? 'Register for release updates or ask about a demonstration. No purchase or trial commitment.' : 'Tell us a little about your requirements and our team will be in touch.',
    submitLabel: prelaunch ? campaignCta(brief) : brief.ctaLabel || 'Send my enquiry',
    fields: withEmail.filter((k, i, a) => a.indexOf(k) === i).map((k) => (typeof k === 'object' ? buildFormField(k.key, k) : buildFormField(k))),
    consent: {
      enabled: true,
      required: true,
      text: prelaunch ? `I agree to ${brief.businessName || 'the business'} contacting me about this pre-launch registration or demonstration request. This does not subscribe me to unrelated marketing.` : `I agree to ${brief.businessName || 'the business'} contacting me about this enquiry using the details I provide.`,
    },
    thankYou: {
      mode: brief.thankYouRedirect ? 'redirect' : 'message',
      heading: prelaunch ? 'Thank you — your interest is registered' : 'Thank you — we have your enquiry',
      message: brief.thankYouMessage || (prelaunch ? 'We have recorded your preference and will contact you about the release or your demonstration enquiry.' : 'A member of our team will contact you to discuss your requirements.'),
      redirectUrl: safeUrl(brief.thankYouRedirect || ''),
    },
  };
}

export function themeFromBrief(brief = {}) {
  const industry = String(brief.industry || '');
  const inferred = INDUSTRY_STYLE.find(([pattern]) => pattern.test(industry))?.[1] || 'premium';
  const selected = STYLE_PRESETS[brief.style] ? brief.style : inferred;
  const preset = STYLE_PRESETS[selected];
  const palette = { ...preset.palette };
  if (isHex(brief.primaryColour)) palette.accent = brief.primaryColour;
  if (isHex(brief.secondaryColour)) palette.ink = brief.secondaryColour;
  return { preset: selected, fonts: preset.fonts, palette, radius: preset.radius };
}

export function isHex(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ''));
}

export function makeSection(type, props = {}, style = {}) {
  if (!SECTION_TYPES[type]) throw new Error(`Unknown section type: ${type}`);
  return {
    id: newId('s'),
    type,
    variant: props.variant || 'default',
    hidden: false,
    props: { ...defaultSectionProps(type), ...props },
    style: { background: 'default', paddingY: 'md', align: type === 'hero' || type === 'offer' ? 'left' : 'left', mobile: { hidden: false, align: 'left' }, ...style },
  };
}

export function defaultSectionProps(type) {
  switch (type) {
    case 'hero': return { eyebrow: '', headline: '', subheadline: '', primaryCta: { label: 'Enquire now', href: '#enquire' }, secondaryCta: { label: '', href: '' }, image: { src: '', alt: '' }, highlights: [], showForm: false };
    case 'trust': return { items: [] };
    case 'benefits': return { eyebrow: '', heading: '', intro: '', items: [] };
    case 'services': return { eyebrow: '', heading: '', intro: '', items: [] };
    case 'process': return { eyebrow: '', heading: '', intro: '', steps: [] };
    case 'gallery': return { eyebrow: '', heading: '', intro: '', images: [] };
    case 'video': return { heading: '', intro: '', url: '' };
    case 'testimonials': return { eyebrow: '', heading: 'What our clients say', items: [] };
    case 'about': return { eyebrow: '', heading: '', body: '', image: { src: '', alt: '' }, points: [] };
    case 'offer': return { eyebrow: '', heading: '', body: '', cta: { label: 'Enquire now', href: '#enquire' }, finePrint: '' };
    case 'faq': return { eyebrow: '', heading: 'Frequently asked questions', items: [] };
    case 'enquiry': return { eyebrow: '', heading: '', intro: '', sidePoints: [], image: { src: '', alt: '' } };
    case 'contact': return { heading: 'Get in touch', intro: '', showPhone: true, showEmail: true, showAddress: true, hours: '' };
    case 'footer': return { tagline: '', links: [], legal: '' };
    default: return {};
  }
}

export function emptyDocument(brief = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    theme: themeFromBrief(brief),
    brand: brandFromBrief(brief),
    seo: { title: '', description: '', ogImage: '', noindex: false },
    form: defaultForm(brief),
    sections: [],
  };
}

export function brandFromBrief(brief = {}) {
  return {
    name: cleanText(brief.businessName || '', 120),
    logoUrl: safeUrl(brief.logoUrl || ''),
    phone: cleanText(brief.phone || '', 40),
    email: cleanText(brief.email || '', 160),
    address: cleanText(brief.address || '', 240),
    serviceArea: cleanText(brief.serviceArea || '', 240),
    licence: cleanText(brief.licence || '', 80),
    privacyUrl: safeUrl(brief.privacyUrl || ''),
  };
}

// ---- Path access --------------------------------------------------------------------------------------------------
// Paths are dot/bracket strings relative to a section's props, the theme, brand, seo or form, e.g. "items.2.title".

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function splitPath(path) {
  const parts = String(path || '').replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  if (!parts.length || parts.some((p) => FORBIDDEN_KEYS.has(p))) throw new Error(`Invalid path: ${path}`);
  return parts;
}

export function getAt(obj, path) {
  return splitPath(path).reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export function setAt(obj, path, value) {
  const parts = splitPath(path);
  const root = clone(obj) || {};
  let cur = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const nextIsIndex = /^\d+$/.test(parts[i + 1]);
    if (cur[key] == null || typeof cur[key] !== 'object') cur[key] = nextIsIndex ? [] : {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
  return root;
}

// ---- Operations ---------------------------------------------------------------------------------------------------
// Every change — a typed edit, a drag to reorder, an AI proposal — is a list of operations applied here.

export function applyOps(doc, ops, { source = 'editor' } = {}) {
  let next = clone(doc);
  const applied = [];
  for (const op of Array.isArray(ops) ? ops : []) {
    next = applyOp(next, op, { source });
    applied.push(op);
  }
  return { document: normaliseDocument(next), applied };
}

function sectionIndex(doc, id) {
  const index = doc.sections.findIndex((s) => s.id === id);
  if (index < 0) throw new Error(`Section not found: ${id}`);
  return index;
}

function applyOp(doc, op, { source }) {
  if (!op || typeof op !== 'object') throw new Error('Invalid operation');
  switch (op.op) {
    case 'setSectionProp': {
      const i = sectionIndex(doc, op.sectionId);
      doc.sections[i].props = setAt(doc.sections[i].props, op.path, sanitiseValue(op.path, op.value));
      return doc;
    }
    case 'setSectionStyle': {
      const i = sectionIndex(doc, op.sectionId);
      doc.sections[i].style = setAt(doc.sections[i].style, op.path, op.value);
      return doc;
    }
    case 'setSectionVariant': {
      const i = sectionIndex(doc, op.sectionId);
      doc.sections[i].variant = cleanText(op.value, 40) || 'default';
      return doc;
    }
    case 'toggleSection': {
      const i = sectionIndex(doc, op.sectionId);
      doc.sections[i].hidden = !!op.hidden;
      return doc;
    }
    case 'addSection': {
      const def = SECTION_TYPES[op.section?.type];
      if (!def) throw new Error(`Unknown section type: ${op.section?.type}`);
      if (def.single && doc.sections.some((s) => s.type === op.section.type)) throw new Error(`A page can only have one ${def.label.toLowerCase()} section`);
      const section = makeSection(op.section.type, op.section.props || {}, op.section.style || {});
      if (op.section.variant) section.variant = op.section.variant;
      const at = op.afterId ? sectionIndex(doc, op.afterId) + 1 : insertionIndex(doc, section.type);
      doc.sections.splice(at, 0, section);
      return doc;
    }
    case 'removeSection': {
      const i = sectionIndex(doc, op.sectionId);
      const type = doc.sections[i].type;
      if (SECTION_TYPES[type].required) throw new Error(`The ${SECTION_TYPES[type].label.toLowerCase()} section cannot be removed`);
      if (source === 'ai' && !op.confirmedByInstruction) throw new Error('AI may only remove a section the instruction asked to remove');
      doc.sections.splice(i, 1);
      return doc;
    }
    case 'duplicateSection': {
      const i = sectionIndex(doc, op.sectionId);
      if (SECTION_TYPES[doc.sections[i].type].single) throw new Error('This section cannot be duplicated');
      const copy = clone(doc.sections[i]);
      copy.id = newId('s');
      doc.sections.splice(i + 1, 0, copy);
      return doc;
    }
    case 'moveSection': {
      const i = sectionIndex(doc, op.sectionId);
      const [section] = doc.sections.splice(i, 1);
      const to = Math.max(0, Math.min(doc.sections.length, Number(op.toIndex)));
      doc.sections.splice(to, 0, section);
      return doc;
    }
    case 'setTheme': {
      if (!/^(palette\.(ink|accent|surface|surfaceAlt|text|muted)|fonts|radius|preset)$/.test(op.path)) throw new Error(`Theme path not editable: ${op.path}`);
      if (op.path.startsWith('palette.') && !isHex(op.value)) throw new Error('Colours must be #RRGGBB');
      if (op.path === 'fonts' && !FONT_PAIRS[op.value]) throw new Error('Unknown font pairing');
      doc.theme = setAt(doc.theme, op.path, op.value);
      return doc;
    }
    case 'setBrand': {
      if (!/^(name|logoUrl|phone|email|address|serviceArea|licence|privacyUrl)$/.test(op.path)) throw new Error(`Brand path not editable: ${op.path}`);
      doc.brand = setAt(doc.brand, op.path, sanitiseValue(op.path, op.value));
      return doc;
    }
    case 'setSeo': {
      if (!/^(title|description|ogImage|noindex)$/.test(op.path)) throw new Error(`SEO path not editable: ${op.path}`);
      doc.seo = setAt(doc.seo, op.path, op.path === 'noindex' ? !!op.value : sanitiseValue(op.path, op.value));
      return doc;
    }
    case 'setForm': {
      if (!/^(heading|intro|submitLabel|consent\.(enabled|required|text)|thankYou\.(mode|heading|message|redirectUrl))$/.test(op.path)) throw new Error(`Form path not editable: ${op.path}`);
      const value = /enabled|required/.test(op.path) ? !!op.value : sanitiseValue(op.path, op.value);
      doc.form = setAt(doc.form, op.path, value);
      return doc;
    }
    case 'setFormFields': {
      doc.form.fields = normaliseFields(op.fields);
      return doc;
    }
    default:
      throw new Error(`Unknown operation: ${op.op}`);
  }
}

function insertionIndex(doc, type) {
  // New content sections go before the enquiry/contact/footer block.
  if (type === 'footer') return doc.sections.length;
  const tail = doc.sections.findIndex((s) => ['enquiry', 'contact', 'footer'].includes(s.type));
  return tail < 0 ? doc.sections.length : tail;
}

function sanitiseValue(path, value) {
  const last = String(path).split('.').pop();
  if (/^(href|src|url|redirectUrl|logoUrl|ogImage|privacyUrl)$/i.test(last)) return safeUrl(value);
  if (typeof value === 'string') return cleanText(value, 4000);
  if (Array.isArray(value) || (value && typeof value === 'object')) return sanitiseDeep(value);
  return value;
}

function sanitiseDeep(value) {
  if (Array.isArray(value)) return value.slice(0, 50).map(sanitiseDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(k)) continue;
      out[k] = /^(href|src|url)$/i.test(k) ? safeUrl(v) : sanitiseDeep(v);
    }
    return out;
  }
  return typeof value === 'string' ? cleanText(value, 4000) : value;
}

export function normaliseFields(fields) {
  const list = (Array.isArray(fields) ? fields : []).slice(0, 20).map((f) => buildFormField(f.key || 'custom', f));
  const seen = new Set();
  const unique = list.filter((f) => (seen.has(f.key) ? false : seen.add(f.key)));
  if (!unique.some((f) => f.key === 'email')) unique.unshift(buildFormField('email'));
  return unique.map((f) => (LOCKED_FIELD_KEYS.includes(f.key) ? { ...f, type: 'email', required: true } : f));
}

export function normaliseDocument(doc) {
  const d = clone(doc) || {};
  d.schemaVersion = SCHEMA_VERSION;
  d.theme = { ...themeFromBrief({}), ...(d.theme || {}) };
  d.theme.palette = { ...STYLE_PRESETS.premium.palette, ...(d.theme.palette || {}) };
  if (!FONT_PAIRS[d.theme.fonts]) d.theme.fonts = 'jakarta';
  d.brand = { ...brandFromBrief({}), ...(d.brand || {}) };
  d.seo = { title: '', description: '', ogImage: '', noindex: false, ...(d.seo || {}) };
  d.form = d.form && typeof d.form === 'object' ? d.form : defaultForm({});
  d.form.fields = normaliseFields(d.form.fields);
  d.sections = (Array.isArray(d.sections) ? d.sections : []).filter((s) => s && SECTION_TYPES[s.type]).map((s) => ({
    id: s.id || newId('s'),
    type: s.type,
    variant: s.variant || 'default',
    hidden: !!s.hidden,
    props: { ...defaultSectionProps(s.type), ...(s.props || {}) },
    style: { background: 'default', paddingY: 'md', align: 'left', ...(s.style || {}), mobile: { hidden: false, align: 'left', ...((s.style || {}).mobile || {}) } },
  }));
  return d;
}

export function sectionTitle(section) {
  const p = section?.props || {};
  return cleanText(p.headline || p.heading || SECTION_TYPES[section?.type]?.label || 'Section', 80);
}
