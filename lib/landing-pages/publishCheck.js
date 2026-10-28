// Checks run before a page can be published. Errors block publishing; warnings are shown but do not.

import { SECTION_TYPES, safeUrl } from './pageModel.js';
import { inspectDesignQuality } from './imagery.js';

const PLACEHOLDER = /lorem ipsum|\[(your|insert|add|placeholder)[^\]]*\]|\bTBC\b|\bTBA\b|xxx+|your company name|example\.com\b|placeholder/i;

export function checkForPublish(doc) {
  const errors = [];
  const warnings = [];
  const sections = (doc?.sections || []).filter((s) => !s.hidden);
  const err = (sectionId, message) => errors.push({ sectionId, message });
  const warn = (sectionId, message) => warnings.push({ sectionId, message });
  const anchors = new Set(['#', '#top', '#enquire', ...sections.map((s) => `#${s.id}`)]);
  if (doc?.form?.fields?.some((field) => field.key === 'enquiry_intent')) anchors.add('#enquire-demo');

  if (!sections.some((s) => s.type === 'hero')) err(null, 'Add a hero section so visitors know what the campaign is about.');
  const hero = sections.find((section) => section.type === 'hero');
  if (doc?.generation?.imageWarning && !hero?.props.image?.src) warn(hero?.id, doc.generation.imageWarning);
  if (/streamline|cutting.edge|seamless|integrated solutions|all.in.one management platform/i.test(`${hero?.props.headline || ''} ${hero?.props.subheadline || ''}`)) warn(hero?.id, 'Make the first screen more specific: name the customer problem, the offering and its practical value.');
  if (!sections.some((s) => s.type === 'enquiry')) err(null, 'The enquiry form section is hidden or missing, so the page cannot capture leads.');
  if (!doc?.brand?.name) err(null, 'Add the business name (Brand settings).');
  if (!doc?.brand?.phone && !doc?.brand?.email) warn(null, 'Add a phone number or email so people can contact you directly.');
  if (!doc?.seo?.title) err(null, 'Add an SEO page title.');
  if (!doc?.seo?.description) warn(null, 'Add an SEO description for Google and social sharing.');
  if (!doc?.seo?.ogImage) warn(null, 'Add a social sharing image so links look good on Facebook and Instagram.');
  if (!doc?.form?.fields?.some((f) => f.key === 'email')) err(null, 'The enquiry form must ask for an email address.');
  if (doc?.form?.thankYou?.mode === 'redirect' && !/^https?:\/\//.test(safeUrl(doc.form.thankYou.redirectUrl))) err(null, 'The thank-you redirect needs a valid web address.');
  if (doc?.form?.consent?.enabled && !String(doc.form.consent.text || '').trim()) err(null, 'Consent is turned on but has no wording.');
  if (doc?.generation?.imageryRequested) {
    for (const issue of inspectDesignQuality(doc).issues) {
      if (issue.severity === 'error') err(issue.sectionId, issue.message);
      else warn(issue.sectionId, issue.message);
    }
  }

  walkStrings(doc?.brand, (text, path) => { if (PLACEHOLDER.test(text)) err(null, `Brand ${path} still contains placeholder text: “${text.slice(0, 60)}”.`); });
  walkStrings(doc?.form, (text, path) => { if (PLACEHOLDER.test(text)) err(null, `Form ${path} still contains placeholder text.`); });

  for (const s of sections) {
    const label = SECTION_TYPES[s.type]?.label || s.type;
    walkStrings(s.props, (text, path) => {
      if (PLACEHOLDER.test(text)) err(s.id, `${label}: “${text.slice(0, 60)}” looks like placeholder text (${path}).`);
    });
    walkLinks(s.props, (href, path) => {
      if (!href) return;
      const safe = safeUrl(href);
      if (!safe) err(s.id, `${label}: the link “${href}” is not a valid address (${path}).`);
      else if (safe.startsWith('#') && !anchors.has(safe)) err(s.id, `${label}: the button links to ${safe}, which is not on this page.`);
    });
    walkButtons(s.props, (btn, path) => {
      if (btn.label && !btn.href) err(s.id, `${label}: the “${btn.label}” button has no link (${path}).`);
    });
    walkImages(s.props, (img, path) => {
      if (img.src && !safeUrl(img.src)) err(s.id, `${label}: image ${path} has an invalid address.`);
      if (img.src && !String(img.alt || '').trim()) warn(s.id, `${label}: add a short description (alt text) for image ${path}.`);
    });
    if (s.type === 'hero' && !s.props.headline) err(s.id, 'The hero needs a headline.');
    if (s.type === 'testimonials' && !(s.props.items || []).length) err(s.id, 'The testimonials section is empty — add real testimonials or hide the section.');
    if (s.type === 'gallery' && !(s.props.images || []).filter((i) => i.src).length) err(s.id, 'The gallery has no images — add photos or hide the section.');
    if (s.type === 'gallery' && (s.props.images || []).some((i) => !i.src)) err(s.id, 'The gallery has an empty image slot.');
    if (s.type === 'video' && !safeUrl(s.props.url)) err(s.id, 'The video section needs a valid video link.');
    if (s.type === 'trust' && !(s.props.items || []).length) err(s.id, 'The credentials strip is empty — add real credentials or hide it.');
    if (s.type === 'faq' && (s.props.items || []).some((i) => !i.q || !i.a)) err(s.id, 'Every FAQ needs a question and an answer.');
  }
  return { ok: errors.length === 0, errors, warnings };
}

function walkStrings(value, fn, path = '') {
  if (typeof value === 'string') { if (value.trim()) fn(value, path || 'text'); return; }
  if (Array.isArray(value)) { value.forEach((v, i) => walkStrings(v, fn, `${path}[${i}]`)); return; }
  if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { if (!/^(href|src|url)$/.test(k)) walkStrings(v, fn, path ? `${path}.${k}` : k); }
}
function walkLinks(value, fn, path = '') {
  if (Array.isArray(value)) { value.forEach((v, i) => walkLinks(v, fn, `${path}[${i}]`)); return; }
  if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) {
    if (k === 'href' && typeof v === 'string') fn(v, path || k);
    else walkLinks(v, fn, path ? `${path}.${k}` : k);
  }
}
function walkButtons(value, fn, path = '') {
  if (Array.isArray(value)) { value.forEach((v, i) => walkButtons(v, fn, `${path}[${i}]`)); return; }
  if (value && typeof value === 'object') {
    if ('label' in value && 'href' in value) { fn(value, path); return; }
    for (const [k, v] of Object.entries(value)) walkButtons(v, fn, path ? `${path}.${k}` : k);
  }
}
function walkImages(value, fn, path = '') {
  if (Array.isArray(value)) { value.forEach((v, i) => walkImages(v, fn, `${path}[${i}]`)); return; }
  if (value && typeof value === 'object') {
    if ('src' in value && 'alt' in value) { fn(value, path); return; }
    for (const [k, v] of Object.entries(value)) walkImages(v, fn, path ? `${path}.${k}` : k);
  }
}
