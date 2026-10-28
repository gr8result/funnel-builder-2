// AI editing assistant: turns an instruction into operations on the existing document, never a new page.
//
// The AI proposes operations; guardProposal() checks them against the current page and the campaign brief before the
// builder sees them. The builder accepts (operations applied, version saved) or discards. interpretInstruction() covers
// the common requests without the AI so the assistant still works when the provider is unavailable.

import { SECTION_TYPES, applyOps, clone, getAt, sectionTitle, STYLE_PRESETS } from './pageModel.js';
import { unsupportedClaims, builtInCopy, isSoftwareBrief, stripUnsupportedClaims, SOFTWARE_DRIFT } from './generator.js';
import { applyImageAssignments, buildImagePlan, inspectDesignQuality, matchImagesToPlan, repairDocumentDesign } from './imagery.js';
import { checkForPublish } from './publishCheck.js';

const AI_OPS = new Set(['setSectionProp', 'setSectionStyle', 'setSectionVariant', 'addSection', 'moveSection', 'removeSection', 'toggleSection', 'setTheme', 'setForm', 'setFormFields', 'setSeo']);

export function guardProposal(doc, proposal, { brief = {}, instruction = '' } = {}) {
  const issues = [];
  const ops = [];
  const wantsRemoval = /\b(remove|delete|get rid of|drop|take out)\b/i.test(instruction);
  for (const raw of Array.isArray(proposal?.ops) ? proposal.ops : []) {
    if (!raw || !AI_OPS.has(raw.op)) { issues.push(`Ignored an unsupported change (${raw?.op || 'unknown'}).`); continue; }
    if (raw.sectionId && !doc.sections.some((s) => s.id === raw.sectionId)) { issues.push(`Ignored a change to a section that does not exist (${raw.sectionId}).`); continue; }
    if (raw.op === 'removeSection') {
      if (!wantsRemoval) { issues.push('Ignored a section removal the instruction did not ask for.'); continue; }
      ops.push({ ...raw, confirmedByInstruction: true });
      continue;
    }
    if (raw.op === 'setFormFields' && !(raw.fields || []).some((f) => f.key === 'email')) {
      ops.push({ ...raw, fields: [{ key: 'email', required: true }, ...(raw.fields || [])] });
      issues.push('Kept the email field — it is needed to create the CRM contact.');
      continue;
    }
    const claimText = collectText(raw.value ?? raw.section?.props);
    const claims = unsupportedClaims(claimText, brief);
    if (claims.length) { issues.push(`Left out wording that makes a claim the campaign brief does not support (${claims.join(', ')}).`); continue; }
    ops.push(raw);
  }
  let result;
  try {
    result = applyOps(doc, ops, { source: 'ai' });
  } catch (e) {
    return { ok: false, error: e.message, issues, ops: [] };
  }
  return { ok: ops.length > 0, ops, issues, document: result.document, summary: proposal?.summary || '', changes: describeChanges(doc, result.document) };
}

function collectText(v) {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(collectText).join(' ');
  if (v && typeof v === 'object') return Object.entries(v).filter(([k]) => !/^(href|src|url)$/.test(k)).map(([, x]) => collectText(x)).join(' ');
  return '';
}

export function describeChanges(before, after) {
  const changes = [];
  const beforeMap = new Map(before.sections.map((s) => [s.id, s]));
  const afterIds = new Set(after.sections.map((s) => s.id));
  after.sections.forEach((s, i) => {
    const prev = beforeMap.get(s.id);
    if (!prev) changes.push({ kind: 'added', sectionId: s.id, label: `Added ${SECTION_TYPES[s.type].label.toLowerCase()}` });
    else if (JSON.stringify(prev) !== JSON.stringify(s)) changes.push({ kind: 'changed', sectionId: s.id, label: `Updated “${sectionTitle(prev)}”`, before: prev, after: s });
    else if (before.sections.indexOf(prev) !== i && before.sections.length === after.sections.length) changes.push({ kind: 'moved', sectionId: s.id, label: `Moved “${sectionTitle(s)}”` });
  });
  for (const s of before.sections) if (!afterIds.has(s.id)) changes.push({ kind: 'removed', sectionId: s.id, label: `Removed “${sectionTitle(s)}”` });
  if (JSON.stringify(before.theme) !== JSON.stringify(after.theme)) changes.push({ kind: 'theme', label: 'Changed colours or fonts' });
  if (JSON.stringify(before.form) !== JSON.stringify(after.form)) changes.push({ kind: 'form', label: 'Changed the enquiry form' });
  if (JSON.stringify(before.seo) !== JSON.stringify(after.seo)) changes.push({ kind: 'seo', label: 'Changed SEO details' });
  return changes;
}

function compactStrings(values) {
  return (Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' ? value.trim() : value);
}

function completeCard(item) {
  return item && String(item.title || '').trim() && String(item.body || '').trim();
}

function imageLocations(doc) {
  const out = [];
  const add = (section, path, image) => {
    if (image?.src) out.push({ section, path, image });
  };
  for (const section of doc.sections || []) {
    add(section, 'image', section.props?.image);
    (section.props?.items || []).forEach((item, index) => add(section, `items.${index}.image`, item?.image));
    (section.props?.images || []).forEach((image, index) => add(section, `images.${index}`, image));
  }
  return out;
}

function normaliseContent(doc) {
  const next = clone(doc);
  for (const section of next.sections || []) {
    section.style = {
      ...(section.style || {}),
      mobile: { hidden: false, align: section.style?.align || 'left', ...(section.style?.mobile || {}) },
    };
    const props = section.props || {};
    if (Array.isArray(props.highlights)) props.highlights = compactStrings(props.highlights);
    if (Array.isArray(props.sidePoints)) props.sidePoints = compactStrings(props.sidePoints);
    if (Array.isArray(props.points)) props.points = compactStrings(props.points);
    if (Array.isArray(props.items)) {
      if (section.type === 'faq') props.items = props.items.filter((item) => String(item?.q || '').trim() && String(item?.a || '').trim());
      else if (section.type === 'testimonials') props.items = props.items.filter((item) => String(item?.quote || '').trim() && String(item?.name || '').trim());
      else if (section.type === 'trust') props.items = props.items.filter((item) => String(item?.label || '').trim());
      else props.items = props.items.filter(completeCard);
    }
    if (Array.isArray(props.steps)) props.steps = props.steps.filter(completeCard);
    if (Array.isArray(props.images)) props.images = props.images.filter((image) => image?.src);
  }
  return next;
}

function requestedCardCount(instruction) {
  const match = String(instruction || '').match(/\b(?:services?|cards?)\b.{0,40}\b(?:to|with|into|make|be)\s+(four|4|three|3|five|5|six|6)\b|\b(four|4|three|3|five|5|six|6)[- ](?:cards?|services?)\b/i);
  const raw = match?.[1] || match?.[2];
  return { four: 4, '4': 4, three: 3, '3': 3, five: 5, '5': 5, six: 6, '6': 6 }[String(raw || '').toLowerCase()] || null;
}

function ensureRequestedProcess(doc, instruction, brief) {
  if (!/(add|include|create|explain).{0,60}(process|how (?:we|it|the build)|construction journey|building journey)/i.test(instruction)) return;
  let process = doc.sections.find((section) => section.type === 'process');
  const residential = /home|house|residential|builder|construction/i.test(`${brief.industry || ''} ${brief.offering || ''}`);
  const copy = residential ? {
    eyebrow: 'Your building journey',
    heading: 'From first conversation to handover',
    intro: 'Understand the main stages before you decide whether a new home build is right for you.',
    steps: [
      { title: 'Discuss your plans', body: 'Share your location, household needs and priorities for your new home.' },
      { title: 'Explore the design', body: 'Consider layouts, inclusions and the direction that suits your plans.' },
      { title: 'Prepare to build', body: 'Work through the information and decisions required before construction.' },
      { title: 'Follow the build', body: 'Stay informed as construction moves through its main stages.' },
      { title: 'Move towards handover', body: 'Review the completed home and prepare for the next step.' },
    ],
  } : builtInCopy(brief).process;
  if (!process) {
    let services = doc.sections.find((section) => section.type === 'services');
    const index = services ? doc.sections.indexOf(services) + 1 : Math.max(1, doc.sections.findIndex((section) => section.type === 'enquiry'));
    process = {
      id: `s_batch_process_${Date.now().toString(36)}`,
      type: 'process',
      variant: 'connected',
      hidden: false,
      props: clone(copy),
      style: { background: 'dark', paddingY: 'md', align: 'left', mobile: { hidden: false, align: 'left' } },
    };
    doc.sections.splice(index, 0, process);
  }
  process.hidden = false;
  process.variant = 'connected';
  process.style = { ...process.style, background: 'dark', paddingY: 'md' };
  if (residential || (process.props.steps || []).filter(completeCard).length < 4) process.props = { ...process.props, ...clone(copy) };
}

function ensureRequestedCards(doc, instruction, brief) {
  const count = requestedCardCount(instruction);
  if (!count) return;
  let services = doc.sections.find((section) => section.type === 'services');
  if (!services) return;
  const source = [
    ...(services.props.items || []).filter(completeCard),
    ...(brief.capabilities || []).map((item) => ({ title: item.name, body: item.description })),
    ...(builtInCopy(brief).services.items || []),
  ].filter(completeCard);
  if (/home|house|residential|builder|construction/i.test(`${brief.industry || ''} ${brief.offering || ''}`)) {
    source.push(
      { title: 'Plan your home', body: 'Discuss your block, priorities and the type of home you want to build.' },
      { title: 'Choose your design direction', body: 'Explore layouts and inclusions that suit your household and plans.' },
      { title: 'Prepare for construction', body: 'Work through the information and decisions needed before building begins.' },
      { title: 'Move towards handover', body: 'Stay informed as your new home progresses towards completion.' },
    );
  }
  const seen = new Set();
  const unique = source.filter((item) => {
    const key = String(item.title).trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  while (unique.length < count) unique.push({ title: `Explore option ${unique.length + 1}`, body: 'Ask our team how this can suit your requirements.' });
  services.props.items = unique.slice(0, count).map((item, index) => ({ ...clone(item), icon: item.icon || ['plan', 'layers', 'project', 'document'][index % 4], image: item.image || { src: '', alt: '' } }));
  services.variant = 'showcase';
  services.style = { ...services.style, paddingY: 'md' };
}

function assignUniqueImages(doc, assets, instruction, brief) {
  const wantsImages = /image|photo|photograph|picture|background/i.test(instruction);
  const wantsDuplicatesFixed = /duplicate|repeated|same|different|unique/i.test(instruction);
  if (!wantsImages && !wantsDuplicatesFixed) return [];
  let services = doc.sections.find((section) => section.type === 'services');
  const replacedServiceUrls = new Set();
  if (services && requestedCardCount(instruction)) {
    if (/replace.{0,80}(?:image|photo)|different.{0,40}(?:image|photo)|unsuitable.{0,40}(?:image|photo)/i.test(instruction)) {
      services.props.items.forEach((item) => { if (item.image?.src) replacedServiceUrls.add(item.image.src); });
    }
    services.props.items.forEach((item) => { item.image = { src: '', alt: '' }; });
  }
  const plan = buildImagePlan(doc, brief).sort((left, right) => {
    const leftService = left.purpose.startsWith('service-') ? 1 : 0;
    const rightService = right.purpose.startsWith('service-') ? 1 : 0;
    return rightService - leftService || right.priority - left.priority;
  });
  const assignments = matchImagesToPlan(plan, (assets || []).filter((asset) => !replacedServiceUrls.has(asset?.src || asset?.url)), brief);
  const assigned = applyImageAssignments(doc, assignments);
  doc.sections = assigned.sections;
  doc.seo = assigned.seo;
  const failures = [];
  services = doc.sections.find((section) => section.type === 'services');
  if (services && requestedCardCount(instruction)) {
    for (let index = 0; index < services.props.items.length; index += 1) {
      const item = services.props.items[index];
      if (!item.image?.src) failures.push(`No relevant unused approved image was available for service card ${index + 1}.`);
    }
  }
  return failures;
}

function repairContextDrift(doc, brief) {
  const residential = /home|house|residential|builder|construction/i.test(`${brief.industry || ''} ${brief.offering || ''} ${brief.audience || ''}`);
  if (!residential) return;
  const copy = builtInCopy(brief);
  const drift = /software|platform|dashboard|workflow|demonstration|trial|pre.?launch/i;
  for (const section of doc.sections || []) {
    if (!drift.test(JSON.stringify(section.props || {})) || !copy[section.type]) continue;
    if (section.type === 'services') {
      const images = (section.props.items || []).map((item) => item.image);
      section.props = { ...section.props, ...clone(copy.services) };
      section.props.items = section.props.items.map((item, index) => ({ ...item, ...(images[index]?.src ? { image: images[index] } : {}) }));
    } else if (['process', 'about', 'enquiry'].includes(section.type)) {
      const image = section.props.image;
      section.props = { ...section.props, ...clone(copy[section.type]), ...(image?.src ? { image } : {}) };
    }
  }
}

// Software-product language must not survive on a page for an unrelated business, whatever the edit did.
function repairWordingDrift(doc, brief) {
  if (isSoftwareBrief(brief)) return;
  const copy = builtInCopy(brief);
  const walk = (value, fallback) => {
    if (typeof value === 'string') {
      if (/^(https?:|\/|data:)/i.test(value) || !SOFTWARE_DRIFT.test(value)) return value;
      return stripUnsupportedClaims(value, brief) || fallback || 'Get in touch';
    }
    if (Array.isArray(value)) return value.map((item) => walk(item, fallback));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item, typeof fallback?.[key] === 'string' ? fallback[key] : undefined)]));
    return value;
  };
  for (const section of doc.sections || []) {
    const base = copy[section.type] || {};
    section.props = Object.fromEntries(Object.entries(section.props || {}).map(([key, item]) => [key, walk(item, typeof base[key] === 'string' ? base[key] : undefined)]));
  }
  if (doc.form) {
    const form = doc.form;
    if (SOFTWARE_DRIFT.test(form.heading || '')) form.heading = 'Start the conversation';
    if (SOFTWARE_DRIFT.test(form.intro || '')) form.intro = 'Tell us a little about what you need and our team will be in touch.';
    if (SOFTWARE_DRIFT.test(form.submitLabel || '')) form.submitLabel = 'Send my enquiry';
  }
}

function requestedOutcomes(instruction, before, after) {
  const outcomes = [];
  const add = (label, complete, detail) => outcomes.push({ label, complete, ...(detail ? { detail } : {}) });
  if (/empty|placeholder/i.test(instruction)) {
    let placeholders = 0;
    const inspect = (value) => {
      if (Array.isArray(value)) return value.forEach(inspect);
      if (typeof value === 'string') {
        if (/click to add text|add image|lorem ipsum|your headline|your text here/i.test(value)) placeholders += 1;
        return;
      }
      if (value && typeof value === 'object') Object.values(value).forEach(inspect);
    };
    inspect(after.sections);
    const emptyListItems = (after.sections || []).reduce((total, section) => total
      + ['highlights', 'sidePoints', 'points'].reduce((count, key) => count + ((section.props?.[key] || []).filter((item) => !String(item || '').trim()).length), 0), 0);
    add('Remove empty content and placeholders', placeholders + emptyListItems === 0, `${placeholders + emptyListItems} incomplete values remain.`);
  }
  const count = requestedCardCount(instruction);
  if (count) {
    const cards = after.sections.find((section) => section.type === 'services')?.props?.items || [];
    const unique = new Set(cards.map((item) => item.image?.src).filter(Boolean));
    add(`Create ${count} complete service cards`, cards.length === count && cards.every(completeCard) && unique.size === count, `${cards.length} cards and ${unique.size} unique card images are present.`);
  }
  if (/(add|include|create|explain).{0,60}(process|construction journey|building journey)/i.test(instruction)) add('Add or improve the process section', after.sections.some((section) => section.type === 'process' && !section.hidden && (section.props.steps || []).filter(completeCard).length >= 4));
  if (/duplicate|repeated|same|different|unique/i.test(instruction)) {
    const urls = imageLocations(after).map((item) => item.image.src).filter(Boolean);
    add('Replace duplicate photographs', new Set(urls).size === urls.length, `${urls.length - new Set(urls).size} duplicate image uses remain.`);
  }
  if (/wording|copy|proofread|rewrite|professional/i.test(instruction)) add('Improve page wording', JSON.stringify(before.sections) !== JSON.stringify(after.sections));
  if (/remove.{0,80}(demonstration|software|platform|workflow|release update)/i.test(instruction)) {
    const leftover = JSON.stringify([after.sections.map((section) => section.props), after.form]).replace(/"(?:src|href|id)":"[^"]*"/g, '').match(new RegExp(SOFTWARE_DRIFT.source, 'gi')) || [];
    add('Remove software and demonstration wording', leftover.length === 0, `${leftover.length} mentions remain.`);
  }
  if (/mobile/i.test(instruction)) add('Use responsive mobile-safe layouts', after.sections.every((section) => section.style?.mobile && !['', null].includes(section.style.mobile.align)));
  return outcomes;
}

export function finaliseBatchEdit(before, edited, { brief = {}, instruction = '', assets = [] } = {}) {
  let document = normaliseContent(edited);
  repairContextDrift(document, brief);
  repairWordingDrift(document, brief);
  ensureRequestedCards(document, instruction, brief);
  ensureRequestedProcess(document, instruction, brief);
  const mediaFailures = assignUniqueImages(document, assets, instruction, brief);
  document = repairDocumentDesign(normaliseContent(document));
  const outcomes = requestedOutcomes(instruction, before, document);
  const publish = checkForPublish(document);
  const design = inspectDesignQuality(document);
  const failures = [
    ...mediaFailures,
    ...outcomes.filter((item) => !item.complete).map((item) => `${item.label}: ${item.detail || 'not completed'}`),
    ...publish.errors.map((item) => item.message),
    ...design.issues.filter((item) => item.severity === 'error').map((item) => item.message),
  ].filter((item, index, all) => all.indexOf(item) === index);
  const changes = describeChanges(before, document);
  return {
    document,
    changes,
    outcomes,
    failures,
    warnings: [...publish.warnings.map((item) => item.message), ...design.issues.filter((item) => item.severity === 'warning').map((item) => item.message)],
    complete: failures.length === 0 && changes.length > 0,
  };
}

// ---- Built-in interpreter ------------------------------------------------------------------------------------------

function findSection(doc, instruction, selectedId) {
  if (selectedId && doc.sections.some((s) => s.id === selectedId)) return doc.sections.find((s) => s.id === selectedId);
  const ordinal = instruction.match(/\b(first|second|third|fourth|fifth|sixth|1st|2nd|3rd|4th|5th|6th)\s+section\b/i);
  if (ordinal) {
    const n = { first: 0, second: 1, third: 2, fourth: 3, fifth: 4, sixth: 5, '1st': 0, '2nd': 1, '3rd': 2, '4th': 3, '5th': 4, '6th': 5 }[ordinal[1].toLowerCase()];
    return doc.sections.filter((s) => !s.hidden)[n];
  }
  const byType = Object.keys(SECTION_TYPES).find((t) => new RegExp(`\\b${t === 'faq' ? 'faq|questions' : t === 'enquiry' ? 'enquiry|form' : t}\\b`, 'i').test(instruction));
  return byType ? doc.sections.find((s) => s.type === byType) : null;
}

function shorten(text, words = 7) {
  const parts = String(text || '').replace(/[.!]$/, '').split(/\s+/);
  if (parts.length <= words) return text;
  const cut = parts.slice(0, words).join(' ').replace(/[,;:–—-]+$/, '');
  return cut.replace(/\b(the|a|an|and|of|in|to|for|with|you|your)$/i, '').trim();
}

export function interpretInstruction(doc, instruction, { brief = {}, selectedSectionId = null } = {}) {
  const text = String(instruction || '').trim();
  const lower = text.toLowerCase();
  const hero = doc.sections.find((s) => s.type === 'hero');
  const target = findSection(doc, text, selectedSectionId) || null;

  if (/shorten|shorter|more concise|tighten/.test(lower) && /headline|heading|title/.test(lower)) {
    const s = target && (target.props.headline || target.props.heading) ? target : hero;
    const path = s.props.headline != null ? 'headline' : 'heading';
    return { summary: `Shortened the ${s.type === 'hero' ? 'hero' : SECTION_TYPES[s.type].label.toLowerCase()} headline.`, ops: [{ op: 'setSectionProp', sectionId: s.id, path, value: shorten(getAt(s.props, path)) }] };
  }
  if (/(form).*(short|fewer|less|simpl)|(short|fewer|simpl).*(form)/.test(lower)) {
    const keep = doc.form.fields.filter((f) => f.required || ['name', 'email', 'phone'].includes(f.key));
    return { summary: `Reduced the enquiry form to ${keep.length} fields (name, email and phone are kept).`, ops: [{ op: 'setFormFields', fields: keep }] };
  }
  if (/(add|include|create).*(process|how (we|it|our service) work|steps)/.test(lower)) {
    if (doc.sections.some((s) => s.type === 'process' && !s.hidden)) return { summary: 'The page already explains how it works — select that section to change it.', ops: [] };
    const copy = builtInCopy(brief).process;
    const afterId = (doc.sections.find((s) => s.type === 'services') || doc.sections.find((s) => s.type === 'benefits') || hero)?.id;
    return { summary: 'Added a section explaining how it works.', ops: [{ op: 'addSection', afterId, section: { type: 'process', props: copy, style: { background: 'dark' } } }] };
  }
  if (/(add|include).*(faq|question)/.test(lower) && !doc.sections.some((s) => s.type === 'faq')) {
    return { summary: 'Added frequently asked questions.', ops: [{ op: 'addSection', section: { type: 'faq', props: builtInCopy(brief).faq } }] };
  }
  const audienceMatch = text.match(/target(?:ing)?\s+(.+?)(?:\.|$)/i) || text.match(/\bfor\s+(first[- ]home buyers|families|downsizers|investors|retirees)\b/i);
  if (audienceMatch && /target|audience|aim|change/.test(lower)) {
    const audience = audienceMatch[1].replace(/^(at|to)\s+/i, '').trim();
    const copy = builtInCopy({ ...brief, audience });
    const ops = [];
    if (hero) ops.push({ op: 'setSectionProp', sectionId: hero.id, path: 'subheadline', value: copy.hero.subheadline });
    const benefits = doc.sections.find((s) => s.type === 'benefits');
    if (benefits) ops.push({ op: 'setSectionProp', sectionId: benefits.id, path: 'heading', value: copy.benefits.heading });
    return { summary: `Re-aimed the hero and benefits copy at ${audience}.`, ops, briefPatch: { audience } };
  }
  if (/premium|luxur|high[- ]end|upmarket|elegant/.test(lower)) {
    const s = target || hero;
    const ops = [{ op: 'setTheme', path: 'fonts', value: 'fraunces' }];
    if (s?.type === 'hero') ops.push({ op: 'setSectionStyle', sectionId: s.id, path: 'background', value: 'dark' }, { op: 'setSectionStyle', sectionId: s.id, path: 'paddingY', value: 'lg' });
    return { summary: 'Gave the hero a darker, more refined treatment with an editorial serif typeface.', ops };
  }
  if (/\b(dark|darker)\b/.test(lower) && target) {
    return { summary: `Gave “${sectionTitle(target)}” a dark background.`, ops: [{ op: 'setSectionStyle', sectionId: target.id, path: 'background', value: 'dark' }] };
  }
  const removalClause = lower.split(/[.!?;]/).find((clause) => /\b(remove|delete|hide)\b\s+(?:the\s+|this\s+|our\s+|that\s+)?(?:\w+\s+){0,3}?(?:section|block|banner)\b/.test(clause) && !/\b(mention|mentions|wording|words?|text|copy|placeholders?|bullets?|empty|duplicates?|repeated|images?|photos?)\b/.test(clause));
  if (removalClause && target && !SECTION_TYPES[target.type].required && findSection(doc, removalClause, selectedSectionId)?.id === target.id) {
    return { summary: `Removed “${sectionTitle(target)}”.`, ops: [{ op: 'removeSection', sectionId: target.id }] };
  }
  if (lower.split(/[.!?;]/).some((clause) => !/\b(do not|don't|never|without)\b/.test(clause) && /replace.*image|change.*(image|photo)|new (image|photo)/.test(clause))) {
    return { summary: 'Choose the new image in the panel — click the image on the page, then “Replace image”.', ops: [], needsMedia: target?.id || hero?.id };
  }
  const preset = Object.keys(STYLE_PRESETS).find((k) => lower.includes(k));
  if (preset && /style|look|feel/.test(lower)) {
    return { summary: `Switched the page to the ${STYLE_PRESETS[preset].label.toLowerCase()} style.`, ops: [{ op: 'setTheme', path: 'fonts', value: STYLE_PRESETS[preset].fonts }, ...Object.entries(STYLE_PRESETS[preset].palette).map(([k, v]) => ({ op: 'setTheme', path: `palette.${k}`, value: v }))] };
  }
  return null;
}

// Shape the AI is asked to return, and a compact view of the page it is shown.
export function documentOutline(doc) {
  return {
    theme: doc.theme,
    form: { heading: doc.form.heading, fields: doc.form.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, required: f.required })) },
    sections: doc.sections.map((s, i) => ({ index: i, id: s.id, type: s.type, variant: s.variant, hidden: s.hidden, style: s.style, props: clone(s.props) })),
  };
}

export const AI_EDIT_SCHEMA_HINT = `Return JSON {"summary": string, "ops": Operation[]}. Operation is one of:
{"op":"setSectionProp","sectionId":id,"path":"headline"|"items.0.title"|...,"value":any}
{"op":"setSectionStyle","sectionId":id,"path":"background"|"paddingY"|"align","value":"default|alt|dark|accent"|"sm|md|lg"|"left|center"}
{"op":"setSectionVariant","sectionId":id,"value":"split|statement|cinematic-dark|cinematic-light|product|comparison|showcase|connected|image-banner|default"}
comparison benefits: {problemHeading,solutionHeading,items:[{problem,title,body}],image:{src,alt,disclosure},imageHeading}.
showcase services: {items:[{title,body,icon,image:{src,alt,caption,provenance}}]}; connected process: {steps:[{title,body,icon}]}.
Image-banner about and enquiry accept image:{src,alt,caption,provenance}. Caption is optional editorial text, never an automatic AI disclaimer. Preserve existing provenance metadata and alt descriptions. Icons: plan,calculator,document,layers,project. Use only existing verified asset URLs.
{"op":"addSection","afterId":id,"section":{"type":one of ${Object.keys(SECTION_TYPES).join('|')},"props":{...},"style":{...}}}
{"op":"moveSection","sectionId":id,"toIndex":n}
{"op":"removeSection","sectionId":id}   (only if the user asked to remove it)
{"op":"setTheme","path":"palette.accent"|"palette.ink"|"fonts"|"radius","value":...}   fonts: jakarta|fraunces|playfair|manrope|dmserif
{"op":"setForm","path":"heading"|"intro"|"submitLabel"|"thankYou.message","value":string}
{"op":"setFormFields","fields":[{"key":"name","required":true},{"key":"email","required":true},...]}`;
