// Pure-logic tests for the landing page model, interview, generator, AI edit guard, publish checks and submission
// validation. No network, no database.
import assert from 'node:assert/strict';
import { applyOps, defaultForm, normaliseDocument, safeUrl, slugify, themeFromBrief, imageCaption } from '../lib/landing-pages/pageModel.js';
import { applyAnswer, emptyInterview, nextStep, progress, parseTestimonials, STEPS } from '../lib/landing-pages/interview.js';
import { composeDocument, recommendStructure, validateStructure, unsupportedClaims, mergeCopy, builtInCopy } from '../lib/landing-pages/generator.js';
import { finaliseBatchEdit, guardProposal, interpretInstruction } from '../lib/landing-pages/aiEdit.js';
import { checkForPublish } from '../lib/landing-pages/publishCheck.js';
import { validateSubmission, signFormToken, verifyFormToken, isHoneypotTripped, cleanAttribution } from '../lib/landing-pages/submission.js';
import { trackedLinks } from '../lib/landing-pages/marketing.js';
import { aiAvailable, planPageStructure, writePageCopy } from '../lib/landing-pages/ai.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { budgetStatus, reserveImageSpend } from '../lib/landing-pages/imageBudget.js';
import { sendError } from '../lib/landing-pages/http.js';
import { campaignObjective } from '../lib/landing-pages/campaignIntent.js';
import { sanitiseBrief } from '../lib/landing-pages/interview.js';
import { applyImageAssignments, buildImagePlan, inspectDesignQuality, isResidentialBrief, matchImagesToPlan, repairDocumentDesign } from '../lib/landing-pages/imagery.js';

process.env.LANDING_PAGE_FORM_SECRET = 'test-secret';
let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`PASS ${name}`); };

test('decorative image provenance is internal while alt text and editorial captions survive', () => {
  for (const business of ['A cafe', 'A plumber', 'A design studio', 'GR8 Result']) {
    const image = { src: 'https://assets.test/hero.jpg', alt: `${business} illustrative campaign visual`, provenance: { kind: 'ai-illustration', evidence: false } };
    assert.equal(imageCaption(image), '');
    const reopened = normaliseDocument({ ...composeDocument({ businessName: business }).document, sections: [{ type: 'hero', props: { image } }] });
    assert.deepEqual(reopened.sections[0].props.image, image);
    assert.deepEqual(sanitiseBrief({ media: [image] }).media[0].provenance, image.provenance);
    assert.equal(imageCaption({ ...image, caption: 'Explore the possibilities.' }), 'Explore the possibilities.');
  }
  assert.equal(imageCaption({ disclosure: 'AI-generated concept. Not a product screenshot or customer project.' }), '');
  assert.equal(imageCaption({ disclosure: 'Illustrative imagery. Not a customer project.' }), '');
  assert.equal(imageCaption({ disclosure: 'Actual editor. Isolated demonstration.' }), 'Actual editor. Isolated demonstration.');
});

// ---- interview -----------------------------------------------------------------------------------------------------
let brief = {}; let iv = emptyInterview();
const answer = (stepKey, a, opts = {}) => { const r = applyAnswer({ brief, interview: iv, stepKey, answer: a, ...opts }); brief = r.brief; iv = r.interview; return r; };

test('interview asks one essential at a time and blocks generation until essentials are known', () => {
  assert.equal(nextStep(brief, iv).key, 'campaignName');
  answer('campaignName', 'Build Your Dream Home in 2027');
  assert.equal(progress(brief, iv).readyToGenerate, false);
  assert.throws(() => answer('objective', '', { skip: true }), /needed/);
  answer('business', 'Harbourline Homes, 02 9000 1234, hello@harbourline.test');
  assert.equal(brief.businessName, 'Harbourline Homes'); assert.equal(brief.phone, '02 9000 1234'); assert.equal(brief.email, 'hello@harbourline.test');
  answer('objective', 'enquiries');
  answer('offering', 'Single storey homes, double storey homes, knockdown rebuilds');
  answer('audience', 'growing families');
  const r = answer('serviceArea', 'Western Sydney, Hills District');
  assert.equal(r.progress.readyToGenerate, true);
  assert.equal(r.next.key, 'offer');
});

test('optional steps can be skipped and take sensible defaults; covered steps are not re-asked', () => {
  answer('offer', '', { skip: true });
  assert.equal(brief.ctaLabel, 'Book a consultation');
  answer('usps', '- Fixed-price building contracts\n- In-house architects — designs drawn for your block\n- Weekly site updates');
  assert.equal(brief.usps.length, 3);
  const withStyle = applyAnswer({ brief: { ...brief, style: 'modern', primaryColour: '#123456', secondaryColour: '#000000', logoUrl: 'https://x.test/l.png' }, interview: iv, stepKey: 'media', answer: [], skip: false });
  assert.notEqual(withStyle.next?.key, 'style', 'style already known is not re-asked');
  answer('style', { style: 'premium', primaryColour: '#B84E0A' });
  answer('media', [{ src: 'https://images.test/hero.jpg', alt: 'Two storey home at dusk' }, { src: 'https://images.test/2.jpg', alt: 'Kitchen' }, { src: 'https://images.test/3.jpg', alt: 'Living' }, { src: 'https://images.test/4.jpg', alt: 'Facade' }]);
  answer('evidence', { testimonials: '"They answered every question before we signed." — Priya and Dev, Box Hill', credentials: 'NSW Builder Licence 123456C' });
  assert.equal(brief.testimonials[0].name, 'Priya and Dev'); assert.equal(brief.testimonials[0].detail, 'Box Hill');
  for (const s of ['formFields', 'thankYou', 'dates', 'seo']) answer(s, '', { skip: true });
  assert.equal(nextStep(brief, iv), null);
  assert.equal(progress(brief, iv).complete, STEPS.length);
});

test('AI extraction cannot overwrite what the builder typed or add unknown keys', () => {
  const r = applyAnswer({ brief: { campaignName: 'X' }, interview: emptyInterview(), stepKey: 'offering', answer: 'Granny flats', extracted: { offering: 'Mansions', audience: 'investors', isAdmin: true } });
  assert.equal(r.brief.offering, 'Granny flats'); assert.equal(r.brief.audience, 'investors'); assert.equal(r.brief.isAdmin, undefined);
});

test('testimonial parsing only accepts quote + name pairs', () => {
  assert.equal(parseTestimonials('just some text').length, 0);
  assert.equal(parseTestimonials('"Great" — Sam').length, 1);
});

// ---- generation ----------------------------------------------------------------------------------------------------
let doc;
test('structure is chosen from the brief, not inserted blindly', () => {
  const minimal = recommendStructure({ offering: 'homes' }).map((s) => s.type);
  assert(!minimal.includes('testimonials') && !minimal.includes('gallery') && !minimal.includes('trust') && !minimal.includes('offer'));
  const full = recommendStructure(brief).map((s) => s.type);
  for (const t of ['hero', 'trust', 'benefits', 'services', 'process', 'gallery', 'testimonials', 'faq', 'enquiry', 'contact', 'footer']) assert(full.includes(t), t);
  assert.equal(full.at(-1), 'footer'); assert.equal(full[0], 'hero');
});

test('lead-generation pages place a complete campaign form beside a cinematic hero', () => {
  const generated = composeDocument({
    businessName: 'Harbourline Homes',
    objective: 'package',
    offering: 'new home construction',
    audience: 'first-home buyers',
    serviceArea: 'Sunshine Coast and Brisbane',
    offer: '10% off new home construction during November 2026',
    imagePlanningEnabled: true,
  }).document;
  const hero = generated.sections.find((section) => section.type === 'hero');
  assert.equal(hero.props.showForm, true);
  assert(['cinematic-dark', 'cinematic-light'].includes(hero.variant));
  assert.equal(hero.props.highlights.length, 3);
  assert(generated.form.fields.some((field) => field.key === 'email'));
  assert(generated.sections.some((section) => section.type === 'enquiry'));

  const display = composeDocument({ objective: 'display', offering: 'seasonal event' }).document;
  assert.equal(display.sections.find((section) => section.type === 'hero').props.showForm, false);
});

test('industry-aware visual defaults diversify pages without overriding an explicit style', () => {
  const cases = [
    [{ industry: 'Dentistry' }, 'modern'],
    [{ industry: 'Tourism' }, 'classic'],
    [{ industry: 'Software' }, 'minimal'],
    [{ industry: 'Community events' }, 'premium'],
  ];
  const themes = cases.map(([brief, expected]) => {
    const theme = themeFromBrief(brief);
    assert.equal(theme.preset, expected);
    return `${theme.fonts}:${theme.palette.accent}:${theme.radius}`;
  });

  test('image planning fills replaceable story slots and repairs the campaign layout', () => {
    const imageBrief = {
      businessName: 'Northbank Architecture',
      industry: 'Residential architecture',
      offering: 'custom home design, construction management, interior planning',
      audience: 'families planning a new home',
      serviceArea: 'Brisbane',
      imagePlanningEnabled: true,
    };
    const planned = composeDocument(imageBrief, { structure: recommendStructure(imageBrief) }).document;
    const plan = buildImagePlan(planned, imageBrief, {
      visual: { direction: 'A contemporary Australian home at dusk' },
      imagery: [{ purpose: 'conversion', subject: 'A light-filled entry and landscaped path' }],
    });
    assert(plan.some((slot) => slot.purpose === 'hero'));
    assert(plan.some((slot) => slot.purpose === 'conversion'));
    assert(plan.filter((slot) => slot.purpose === 'gallery').length >= 4);
    assert(plan.findIndex((slot) => slot.purpose === 'hero') < plan.findIndex((slot) => slot.purpose.startsWith('service-')));
    assert(plan.findIndex((slot) => slot.purpose.startsWith('service-')) < plan.findIndex((slot) => slot.purpose === 'conversion'));

    const assets = plan.map((slot, index) => ({
      id: `asset-${index}`,
      url: `https://assets.test/architecture-${index}.jpg`,
      name: `${slot.subject} ${imageBrief.industry}`,
      description: slot.subject,
      owner_scope: 'user',
    }));
    const assignments = matchImagesToPlan(plan, assets, imageBrief);
    const repaired = repairDocumentDesign(applyImageAssignments(planned, assignments));
    const quality = inspectDesignQuality(repaired);
    assert.equal(quality.ok, true, JSON.stringify(quality));
    assert(quality.metrics.sectionCount >= 8);
    assert(quality.metrics.visualSectionCount >= 5);
    assert.equal(repaired.sections.find((section) => section.type === 'hero').variant, 'cinematic-dark');
    assert.equal(repaired.sections.find((section) => section.type === 'enquiry').variant, 'image-backed');
    assert(repaired.sections.find((section) => section.type === 'gallery').props.images.every((image) => image.crop?.focalPoint));
  });

  test('image quality audit blocks an apparently complete draft with empty visual slots', () => {
    const imageBrief = {
      businessName: 'Northbank Architecture',
      offering: 'custom home design',
      audience: 'home owners',
      imagePlanningEnabled: true,
    };
    const emptyVisualDraft = composeDocument(imageBrief, { structure: recommendStructure(imageBrief) }).document;
    emptyVisualDraft.generation.imageryRequested = true;
    const quality = inspectDesignQuality(emptyVisualDraft);
    assert.equal(quality.ok, false);
    assert(quality.issues.some((issue) => issue.code === 'missing-hero-image'));
    assert(checkForPublish(emptyVisualDraft).errors.some((issue) => /hero image/i.test(issue.message)));
  });

  test('incomplete service photography is reported as a visual quality failure', () => {
    const brief = { industry: 'Residential construction', offering: 'custom homes, renovation planning, interior design', imagePlanningEnabled: true };
    const generated = composeDocument(brief, { structure: recommendStructure(brief) }).document;
    const services = generated.sections.find((section) => section.type === 'services');
    services.props.items = [
      { title: 'Design', body: 'Discuss the design.', image: { src: 'https://assets.test/design.jpg', alt: 'House design' } },
      { title: 'Construction', body: 'Discuss construction.', image: { src: '', alt: '' } },
      { title: 'Interiors', body: 'Discuss interiors.', image: { src: 'https://assets.test/interiors.jpg', alt: 'Home interior' } },
    ];
    const quality = inspectDesignQuality(generated);
    assert(quality.issues.some((issue) => issue.code === 'service-image-missing' && issue.severity === 'error'));
  });

  test('image matching rejects conflicting software artwork for a residential campaign', () => {
    const residential = { industry: 'Residential construction', offering: 'new home builds' };
    const plan = [{ id: 'hero:image', sectionId: 'hero', path: 'image', purpose: 'hero', subject: 'modern new home exterior', aspectRatio: '3:2', focalPoint: 'right center', priority: 10 }];
    const assignments = matchImagesToPlan(plan, [
      { id: 'software', url: 'https://assets.test/software.jpg', description: 'All-in-one platform launching soon for builders and construction teams', owner_scope: 'user' },
      { id: 'home', url: 'https://assets.test/home.jpg', description: 'Exterior of a modern residential home', owner_scope: 'user' },
    ], residential);
    assert.equal(assignments[0].image.src, 'https://assets.test/home.jpg');
  });

  test('image matching leaves semantically unrelated library artwork unassigned', () => {
    const plan = [{ id: 'hero:image', sectionId: 'hero', path: 'image', purpose: 'hero', subject: 'luxury custom home exterior', aspectRatio: '3:2', focalPoint: 'right center', priority: 10 }];
    const assignments = matchImagesToPlan(plan, [
      { id: 'seo', url: 'https://assets.test/seo.jpg', description: 'SEO and digital marketing tips for scaling your business', owner_scope: 'user' },
    ], { industry: 'Residential construction', offering: 'custom homes' });
    assert.deepEqual(assignments, []);
  });

  test('residential image matching prefers curated gallery photography over generic backgrounds', () => {
    const residentialBrief = { industry: 'Residential construction', offering: 'custom homes' };
    const residentialDoc = composeDocument(residentialBrief, { structure: recommendStructure(residentialBrief) }).document;
    const heroSlot = buildImagePlan(residentialDoc, residentialBrief).find((slot) => slot.purpose === 'hero');
    const assignments = matchImagesToPlan([heroSlot], [
      { src: 'https://assets.test/generic/home-bg.jpg', alt: 'home background', tags: ['generic'] },
      { src: 'https://assets.test/curated-home.jpg', alt: 'Contemporary home exterior', tags: ['landing-gallery'] },
    ], residentialBrief);
    assert.equal(assignments[0].image.src, 'https://assets.test/curated-home.jpg');
  });

  test('library ownership cannot outweigh zero topical image relevance', () => {
    const plan = [{ id: 'hero:image', sectionId: 'hero', path: 'image', purpose: 'hero', subject: 'coastal wellness retreat yoga at sunrise', aspectRatio: '3:2', focalPoint: 'right center', priority: 10 }];
    const assignments = matchImagesToPlan(plan, [
      { id: 'owned', url: 'https://assets.test/jobs.jpg', description: 'Track construction jobs with an easy management board', owner_scope: 'user', kind: 'upload' },
    ], { industry: 'Wellness tourism', offering: 'three-night yoga and massage retreat' });
    assert.deepEqual(assignments, []);
  });
  assert.equal(new Set(themes).size, cases.length, 'industry choices produce visibly distinct type, colour and shape tokens');
  assert.equal(themeFromBrief({ industry: 'Dentistry', style: 'classic', primaryColour: '#123456' }).preset, 'classic');
  assert.equal(themeFromBrief({ industry: 'Dentistry', style: 'classic', primaryColour: '#123456' }).palette.accent, '#123456');
});

test('five campaign types receive distinct validated section architectures', () => {
  const cases = [
    [{ objective: 'display', offering: 'seasonal tasting menu', media: [{ src: 'https://assets.test/1.jpg' }, { src: 'https://assets.test/2.jpg' }, { src: 'https://assets.test/3.jpg' }, { src: 'https://assets.test/4.jpg' }], offer: 'Weekend tasting menu' }, ['hero', 'gallery', 'offer', 'enquiry', 'footer']],
    [{ objective: 'enquiries', offering: 'business accounting', credentials: ['CPA'], phone: '02 9000 0000' }, ['hero', 'trust', 'benefits', 'contact', 'enquiry', 'footer']],
    [{ objective: 'event', offering: 'community fundraiser', audience: 'local families' }, ['hero', 'about', 'process', 'enquiry', 'footer']],
    [{ objective: 'package', offering: 'online inventory software', offer: '14-day trial' }, ['hero', 'services', 'faq', 'offer', 'enquiry', 'footer']],
    [{ objective: 'display', offering: 'portrait photography', media: [{ src: 'https://assets.test/1.jpg' }, { src: 'https://assets.test/2.jpg' }, { src: 'https://assets.test/3.jpg' }, { src: 'https://assets.test/4.jpg' }, { src: 'https://video.test/reel.mp4', kind: 'video' }], address: 'Sydney' }, ['hero', 'gallery', 'video', 'about', 'contact', 'enquiry', 'footer']],
  ];
  const architectures = cases.map(([campaign, types]) => validateStructure(types, campaign).map((section) => section.type));
  assert.equal(new Set(architectures.map((items) => items.join(','))).size, 5);
  assert(architectures.every((items) => items[0] === 'hero' && items.at(-2) === 'enquiry' && items.at(-1) === 'footer'));
});

test('structure validation removes unsupported evidence, duplicate and unknown sections', () => {
  const plan = validateStructure(['hero', 'pricing', 'testimonials', 'hero', 'benefits', 'footer'], { offering: 'tax advice' });
  assert.deepEqual(plan.map((section) => section.type), ['hero', 'benefits', 'enquiry', 'footer']);
  const shortGallery = validateStructure(['hero', 'gallery', 'enquiry', 'footer'], { offering: 'photo prints', media: [{ src: 'https://assets.test/1.jpg' }, { src: 'https://assets.test/2.jpg' }, { src: 'https://assets.test/3.jpg' }] });
  assert(!shortGallery.some((section) => section.type === 'gallery'));
});

test('validated hero layout choice is used by document composition', () => {
  const structure = validateStructure([{ type: 'hero', variant: 'statement' }, 'enquiry', 'footer'], { offering: 'therapy sessions' });
  const generated = composeDocument({ offering: 'therapy sessions', phone: '02 9000 0000' }, { structure }).document;
  assert.equal(generated.sections[0].variant, 'statement');
  assert.equal(generated.sections[0].props.showForm, true);
  const fallback = composeDocument({ offering: 'therapy sessions', media: [{ src: 'https://assets.test/hero.jpg' }] }).document;
  assert.equal(fallback.sections[0].variant, 'cinematic-dark');
});

test('first generation is a complete page that passes publish checks', () => {
  doc = composeDocument(brief).document;
  const hero = doc.sections[0];
  assert.equal(hero.variant, 'cinematic-dark'); assert.equal(hero.props.image.src, 'https://images.test/hero.jpg');
  assert.match(hero.props.headline, /2027/);
  assert.equal(doc.sections.find((s) => s.type === 'testimonials').props.items[0].quote, 'They answered every question before we signed.');
  assert.equal(doc.theme.palette.accent, '#B84E0A');
  const check = checkForPublish(doc);
  assert.deepEqual(check.errors, []);
  const undefinedPaths = [];
  (function walk(v, p) { if (v === undefined) undefinedPaths.push(p); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`); })(doc, 'doc');
  assert.deepEqual(undefinedPaths, [], 'document is plain JSON (Next.js cannot serialise undefined in getServerSideProps)');
});

test('AI copy is merged, but fabricated claims are removed and fall back', () => {
  assert.deepEqual(unsupportedClaims('Award-winning builder', brief), ['Award-winning']);
  assert.deepEqual(unsupportedClaims('Fixed-price building contracts', brief), []);
  const ai = { hero: { headline: 'Your next chapter starts on solid ground', subheadline: 'We are an award-winning builder. Families love our homes.' }, benefits: { items: [{ title: 'Over 500 homes built', body: 'Trusted by 500 families.' }, { title: 'x', body: 'y' }] } };
  const { copy, removed } = mergeCopy(builtInCopy(brief), ai, brief);
  assert.equal(copy.hero.headline, 'Your next chapter starts on solid ground');
  assert.equal(copy.hero.subheadline, 'Families love our homes.');
  const malformedSidePoints = mergeCopy(builtInCopy(brief), { enquiry: { sidePoints: 'not an array' } }, brief).copy.enquiry.sidePoints;
  assert(Array.isArray(malformedSidePoints), 'malformed AI values cannot replace array-valued renderer fields');
  assert(removed.length >= 2);
  assert(!JSON.stringify(copy).match(/500|award/i));
});

test('unsupported experience, expertise, facility and trust claims are removed unless brief-backed', () => {
  const campaign = { businessName: 'Bright Dental', offering: 'preventive dentistry' };
  const base = builtInCopy(campaign);
  const { copy, removed } = mergeCopy(base, {
    hero: { highlights: ['Experienced dental team', 'State-of-the-art facilities', 'Preventive care'] },
    about: { heading: 'Your Trusted Dental Practice', body: 'We provide high-quality dental care.' },
  }, campaign);
  assert.deepEqual(copy.hero.highlights, ['Preventive care']);
  assert.equal(copy.about.heading, base.about.heading);
  assert.equal(copy.about.body, base.about.body);
  assert.equal(removed.length, 4);
  const supported = { ...campaign, usps: ['Experienced dental team'] };
  assert.deepEqual(unsupportedClaims('Experienced dental team', supported), []);
});

// ---- editing --------------------------------------------------------------------------------------------------------
test('manual edits, reorder, duplicate, remove and form edits work on the document', () => {
  const hero = doc.sections[0];
  let d = applyOps(doc, [{ op: 'setSectionProp', sectionId: hero.id, path: 'headline', value: 'Build the home your family deserves in 2027' }]).document;
  assert.equal(d.sections[0].props.headline, 'Build the home your family deserves in 2027');
  const faq = d.sections.find((s) => s.type === 'faq');
  d = applyOps(d, [{ op: 'duplicateSection', sectionId: faq.id }]).document;
  assert.equal(d.sections.filter((s) => s.type === 'faq').length, 2);
  d = applyOps(d, [{ op: 'moveSection', sectionId: faq.id, toIndex: 1 }]).document;
  assert.equal(d.sections[1].id, faq.id);
  assert.throws(() => applyOps(d, [{ op: 'removeSection', sectionId: d.sections.find((s) => s.type === 'enquiry').id }]), /cannot be removed/);
  assert.throws(() => applyOps(d, [{ op: 'duplicateSection', sectionId: d.sections[0].id }]), /cannot be duplicated/);
  d = applyOps(d, [{ op: 'setFormFields', fields: [{ key: 'name' }, { key: 'phone', required: true }] }]).document;
  assert.deepEqual(d.form.fields.map((f) => f.key), ['email', 'name', 'phone'], 'email is always kept');
  d = applyOps(d, [{ op: 'setSectionProp', sectionId: hero.id, path: 'primaryCta.href', value: 'javascript:alert(1)' }]).document;
  assert.equal(d.sections.find((s) => s.id === hero.id).props.primaryCta.href, '', 'unsafe links are dropped');
  assert.throws(() => applyOps(d, [{ op: 'setSectionProp', sectionId: hero.id, path: '__proto__.x', value: 1 }]), /Invalid path/);
  assert.throws(() => applyOps(d, [{ op: 'setTheme', path: 'palette.accent', value: 'red;background:url(x)' }]), /#RRGGBB/);
});

test('AI proposals edit the existing page, keep untouched sections, and are guarded', () => {
  const hero = doc.sections[0]; const faq = doc.sections.find((s) => s.type === 'faq');
  const proposal = { summary: 'x', ops: [
    { op: 'setSectionProp', sectionId: faq.id, path: 'heading', value: 'Questions families ask us' },
    { op: 'setSectionProp', sectionId: hero.id, path: 'subheadline', value: 'Guaranteed lowest price.' },
    { op: 'removeSection', sectionId: doc.sections.find((s) => s.type === 'process').id },
    { op: 'deleteDatabase' },
  ] };
  const g = guardProposal(doc, proposal, { brief, instruction: 'Improve the FAQ heading' });
  assert.equal(g.ops.length, 1); assert.equal(g.issues.length, 3);
  assert.equal(g.changes.length, 1); assert.equal(g.changes[0].sectionId, faq.id);
  const untouched = doc.sections.filter((s) => s.id !== faq.id).map((s) => JSON.stringify(s));
  assert.deepEqual(g.document.sections.filter((s) => s.id !== faq.id).map((s) => JSON.stringify(s)), untouched);
});

test('built-in assistant handles the example instructions', () => {
  const run = (text, sel) => guardProposal(doc, interpretInstruction(doc, text, { brief, selectedSectionId: sel }), { brief, instruction: text });
  const short = run('Shorten the headline');
  assert(short.document.sections[0].props.headline.split(' ').length <= 7);
  const premium = run('Make the hero section more premium');
  assert.equal(premium.document.theme.fonts, 'fraunces'); assert.equal(premium.document.sections[0].style.background, 'dark');
  const form = run('Make the enquiry form shorter');
  assert(form.document.form.fields.length < doc.form.fields.length); assert(form.document.form.fields.some((f) => f.key === 'email'));
  const noProcess = applyOps(doc, [{ op: 'removeSection', sectionId: doc.sections.find((s) => s.type === 'process').id }]).document;
  const added = guardProposal(noProcess, interpretInstruction(noProcess, 'Add a section explaining our building process', { brief }), { brief, instruction: 'Add a section explaining our building process' });
  assert(added.document.sections.some((s) => s.type === 'process'));
  const retarget = interpretInstruction(doc, 'Change this campaign to target first-home buyers', { brief });
  assert.equal(retarget.briefPatch.audience, 'first-home buyers');
  assert.match(guardProposal(doc, retarget, { brief }).document.sections[0].props.subheadline, /first-home buyers/);
  assert.equal(interpretInstruction(doc, 'Replace the image in the second section', { brief }).ops.length, 0);
});

test('batch assistant completes measurable multi-change requests in one working draft', () => {
  const before = structuredClone(doc);
  const process = before.sections.find((section) => section.type === 'process');
  before.sections = before.sections.filter((section) => section.id !== process.id);
  const benefits = before.sections.find((section) => section.type === 'benefits');
  benefits.props.items.push({ title: '', body: '' });
  benefits.props.highlights = ['', 'Useful detail', ''];
  const services = before.sections.find((section) => section.type === 'services');
  services.props.items = services.props.items.slice(0, 1);
  services.props.items[0].image = { src: 'https://images.test/repeated.jpg', alt: 'A new home' };
  const hero = before.sections.find((section) => section.type === 'hero');
  hero.props.image = { src: 'https://images.test/repeated.jpg', alt: 'A new home' };
  const assets = Array.from({ length: 16 }, (_, index) => ({ src: `https://images.test/home-${index + 1}.jpg`, alt: `Architectural home view ${index + 1}` }));
  const instruction = 'Fix this entire page. Remove all empty bullet points and placeholders. Replace repeated photographs with different relevant images. Change the services section to four cards with four different photographs. Add a visually attractive section explaining our home-building process. Improve the layout and wording, keep the offer accurate, and make the whole page look professional on desktop and mobile.';
  const batch = finaliseBatchEdit(before, before, { brief, instruction, assets });
  const resultServices = batch.document.sections.find((section) => section.type === 'services');
  assert.equal(resultServices.props.items.length, 4);
  assert.equal(new Set(resultServices.props.items.map((item) => item.image.src)).size, 4);
  assert(batch.document.sections.some((section) => section.type === 'process' && section.props.steps.length >= 4));
  assert.equal(batch.document.sections.find((section) => section.type === 'benefits').props.highlights.length, 1);
  assert(batch.document.sections.find((section) => section.type === 'trust').props.items.length > 0, 'verified credentials survive batch cleanup');
  assert(batch.outcomes.every((outcome) => outcome.complete), JSON.stringify(batch.outcomes));
  assert.notDeepEqual(batch.document, before);
});

// ---- publish checks -------------------------------------------------------------------------------------------------
test('publish checks block placeholders, broken links, empty images and missing form', () => {
  const hero = doc.sections[0];
  const bad = applyOps(doc, [
    { op: 'setSectionProp', sectionId: hero.id, path: 'subheadline', value: 'Lorem ipsum dolor' },
    { op: 'setSectionProp', sectionId: hero.id, path: 'primaryCta.href', value: '#nowhere' },
    { op: 'setSectionProp', sectionId: doc.sections.find((s) => s.type === 'gallery').id, path: 'images.0.src', value: '' },
    { op: 'toggleSection', sectionId: doc.sections.find((s) => s.type === 'enquiry').id, hidden: true },
  ]).document;
  const msgs = checkForPublish(bad).errors.map((e) => e.message).join('\n');
  assert.match(msgs, /placeholder/); assert.match(msgs, /#nowhere/); assert.match(msgs, /empty image slot/); assert.match(msgs, /enquiry form section/);
});

// ---- submissions ----------------------------------------------------------------------------------------------------
test('submission validation, consent, honeypot and signed timing token', () => {
  const form = doc.form;
  const good = validateSubmission(form, { idempotencyKey: 'abcDEF123456', consent: true, fields: { name: 'Sam', email: 'sam@example.org', phone: '0411 222 333', project_type: 'Consultation', extra: 'x' } });
  assert.equal(good.ok, true); assert.deepEqual(good.ignoredFields, ['extra']);
  const bad = validateSubmission(form, { idempotencyKey: 'short', consent: false, fields: { email: 'nope', project_type: 'Castle' } });
  assert.equal(bad.ok, false); for (const k of ['email', 'consent', 'project_type', 'name', '_form']) assert(bad.errors[k], k);
  assert.equal(isHoneypotTripped({ company_website: 'http://spam' }), true); assert.equal(isHoneypotTripped({}), false);
  const t0 = Date.now() - 10000; const token = signFormToken('page-1', t0);
  assert.equal(verifyFormToken(token, 'page-1').ok, true);
  assert.equal(verifyFormToken(token, 'page-2').reason, 'bad-token');
  assert.equal(verifyFormToken(signFormToken('page-1'), 'page-1').reason, 'too-fast');
  assert.deepEqual(cleanAttribution({ utm_source: 'facebook', evil: 'x' }), { utm_source: 'facebook' });
});

test('helpers: safe URLs, slugs, tracked links', () => {
  assert.equal(safeUrl('javascript:alert(1)'), ''); assert.equal(safeUrl('//evil.test'), ''); assert.equal(safeUrl('tel:+61290001234'), 'tel:+61290001234');
  assert.equal(slugify('Build Your Dream Home in 2027!'), 'build-your-dream-home-in-2027');
  const links = trackedLinks('https://app.test', 'dream', 'Build Your Dream Home in 2027');
  assert.match(links[0].url, /utm_source=facebook&utm_medium=social&utm_campaign=build-your-dream-home-in-2027/);
  assert.equal(normaliseDocument({ sections: [{ type: 'bogus' }] }).sections.length, 0);
});

test('non-construction campaigns generate factual industry-neutral pages and marketing copy', () => {
  for (const [businessName, offering] of [['Bright Dental', 'preventative dental care'], ['Fresh Market', 'seasonal produce boxes'], ['Clear Accounts', 'small business bookkeeping']]) {
    const neutralBrief = { campaignName: 'Spring Promotion', businessName, offering, audience: 'local customers', serviceArea: 'Brisbane', objective: 'enquiries', email: 'hello@example.test' };
    const generated = composeDocument(neutralBrief).document;
    assert(!/home|builder|construction|handover|own land/i.test(JSON.stringify(generated)), businessName);
    assert(generated.sections[0].props.headline.toLowerCase().includes(offering));
    assert.deepEqual(checkForPublish(generated).errors, []);
  }
  assert.deepEqual(builtInCopy({}).enquiry.sidePoints, ['Describe what you need', 'Add a preferred time to your message', 'Include any questions']);
});

test('enquiry form avoids unsupported privacy promises', () => {
  const form = fs.readFileSync('components/landing-pages/renderer/LandingForm.jsx', 'utf8');
  assert(form.includes('Your details will be sent with this enquiry.'));
  assert(!form.includes('We only use your details to respond to your enquiry.'));
  assert.equal(defaultForm({ businessName: 'Bright Dental' }).consent.text, 'I agree to Bright Dental contacting me about this enquiry using the details I provide.');
});

test('campaign setup uses industry-neutral questions and Quick/Guided Generate wording', () => {
  const source = fs.readFileSync('pages/modules/landing-pages/index.js', 'utf8');
  assert(source.includes('<h2>Quick Generate</h2>'));
  assert(source.includes('<h2>Guided Generate</h2>'));
  assert(source.includes('Describe your business, campaign and audience in one prompt'));
  assert(source.includes("Choose something easy to recognise, such as 'Spring Promotion', 'New Product Launch' or 'Free Consultation Campaign'."));
  assert(!/builder|homebuilding|construction|homes|build in/i.test(JSON.stringify(STEPS)));
  assert(!/home|builder|construction/i.test(JSON.stringify(STEPS.find((step) => step.key === 'objective').choices)));
});

test('missing Landing Pages schema produces an actionable error without exposing internal errors', () => {
  const response = { statusCode: 200, body: null, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  sendError(response, Object.assign(new Error('list campaigns failed'), { cause: { code: 'PGRST205', message: "Could not find the table 'public.landing_campaigns' in the schema cache" } }));
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'SERVICE_UNAVAILABLE');
  assert.equal(response.body.retryable, false);
  assert(response.body.reference);
  assert(!/administrator|migration|schema|supabase|table|sql/i.test(JSON.stringify(response.body)));
  sendError(response, new Error('private internal diagnostic'));
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.retryable, true);
  assert(!response.body.error.includes('private internal diagnostic'));
});

test('Sales Funnels offers AI landing pages without removing legacy creation or published routes', () => {
  const home = fs.readFileSync('pages/modules/funnels/index.js', 'utf8');
  const wizard = fs.readFileSync('pages/modules/funnels/new.js', 'utf8');
  const sidebar = fs.readFileSync('components/SideNav.js', 'utf8');
  assert(!/href:\s*["']\/modules\/landing-pages["']/.test(sidebar), 'no standalone Landing Pages sidebar entry');
  assert.equal((sidebar.match(/href:\s*["']\/modules\/funnels["']/g) || []).length, 1, 'one canonical Funnel Builder sidebar entry');
  assert(!/href:\s*["']\/funnels["']/.test(sidebar), 'sidebar avoids the legacy redirect');
  const layout = fs.readFileSync('components/Layout.js', 'utf8');
  assert(!layout.includes('await ensureUserFolders()'), 'storage initialization cannot block route access');
  assert(layout.includes('if (error) {') && layout.includes('setProfileError("We couldn\'t verify your account access right now.");') && layout.includes('throw new Error("Your account details could not be verified.");'), 'account read failures remain fail-closed');
  assert(sidebar.includes('label: "Funnel Builder"'));
  assert(sidebar.includes('["/modules/funnels", "/modules/landing-pages"]'), 'nested routes keep Funnel Builder active');
  assert(home.includes('Create standalone landing page'));
  assert(home.includes('Create multi-step sales funnel'));
  for (const source of [home, wizard]) assert(source.includes('/modules/landing-pages?from=sales-funnels'));
  assert(home.includes('openCreator("/modules/funnels/new")'));
  const manager = fs.readFileSync('components/funnels/CampaignManager.jsx', 'utf8');
  assert(home.includes('CampaignManager'));
  assert(manager.includes('/modules/funnels/edit/${item.id}'));
  assert(manager.includes('/p/${item.slug}'));
  assert(wizard.includes('/modules/funnels/edit/${funnelInsert.data.id}'));
  for (const route of ['pages/funnels.js', 'pages/modules/landing-pages/index.js', 'pages/modules/landing-pages/[campaignId].js', 'pages/modules/landing-pages/editor/[pageId].js', 'pages/modules/landing-pages/preview/[pageId].js', 'pages/lp/[slug].js']) assert(fs.existsSync(route), `preserved route ${route}`);
});

test('negated image constraints do not route a text edit to image upload', () => {
  assert.equal(interpretInstruction(doc, 'Improve only the hero headline. Do not change the theme, images, form or any other section.'), null);
  assert(interpretInstruction(doc, 'Replace the hero image').needsMedia);
});

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;
const originalDisableAi = process.env.LP_E2E_DISABLE_AI;
try {
  process.env.OPENAI_API_KEY = 'isolated-provider-test';
  process.env.LP_E2E_DISABLE_AI = '1';
  assert.equal(aiAvailable(), false, 'the isolated fixture guard overrides a configured provider key');
  let disabledFetchCalled = false;
  globalThis.fetch = async () => { disabledFetchCalled = true; throw new Error('provider fetch must not run'); };
  await assert.rejects(writePageCopy(brief, [{ type: 'hero' }]), /AI is disabled by the isolated test configuration/);
  assert.equal(disabledFetchCalled, false, 'the test-only AI guard prevents provider requests');
  delete process.env.LP_E2E_DISABLE_AI;
  const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'x-request-id': 'isolated-test-request' } });
  let evidence;
  globalThis.fetch = async () => jsonResponse({ id: 'isolated-response', model: 'gpt-4o-mini-test', usage: { prompt_tokens: 100, completion_tokens: 20 }, choices: [{ finish_reason: 'stop', message: { content: '{"hero":{"headline":"Your next home"}}' } }] });
  const copy = await writePageCopy(brief, [{ type: 'hero' }], { onResult: (result) => { evidence = result; } });
  assert.equal(copy.hero.headline, 'Your next home');
  assert.equal(evidence.provider, 'openai');
  assert.equal(evidence.model, 'gpt-4o-mini-test');
  assert.equal(evidence.fallback, false);
  assert.equal(evidence.usage.completion_tokens, 20);
  globalThis.fetch = async () => jsonResponse({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] });
  await assert.rejects(writePageCopy(brief, [{ type: 'hero' }], { onResult: (result) => { evidence = result; } }), /incomplete/);
  assert.equal(evidence.outcome, 'error');
  assert.equal(evidence.failureClass, 'application');
  assert.equal(evidence.fallback, true);
  globalThis.fetch = async () => jsonResponse({ choices: [{ finish_reason: 'stop', message: { content: '{}' } }] });
  await assert.rejects(writePageCopy(brief, [{ type: 'hero' }]), /non-empty JSON object/);
  let providerEvidence;
  globalThis.fetch = async () => jsonResponse({ error: { message: 'model not found', code: 'model_not_found' } }, 404);
  await assert.rejects(writePageCopy(brief, [{ type: 'hero' }], { onResult: (result) => { providerEvidence = result; } }), /404/);
  assert.equal(providerEvidence.failureClass, 'provider');
  assert.equal(providerEvidence.status, 404);
  assert.equal(providerEvidence.requestId, 'isolated-test-request');
  let transientAttempts = 0; let retryEvidence;
  globalThis.fetch = async () => {
    transientAttempts += 1;
    if (transientAttempts === 1) throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'EAI_AGAIN' } });
    return jsonResponse({ id: 'retry-response', model: 'gpt-4o-mini-test', choices: [{ finish_reason: 'stop', message: { content: '{"hero":{"headline":"Retry succeeded"}}' } }] });
  };
  const retried = await writePageCopy(brief, [{ type: 'hero' }], { onResult: (result) => { retryEvidence = result; } });
  assert.equal(transientAttempts, 2); assert.equal(retried.hero.headline, 'Retry succeeded'); assert.equal(retryEvidence.outcome, 'success'); assert.equal(retryEvidence.attempts, 2);
  globalThis.fetch = async () => jsonResponse({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[{"type":"hero"},{"type":"gallery"},{"type":"faq"},{"type":"enquiry"},{"type":"footer"}]}' } }] });
  const plan = await planPageStructure({ ...brief, media: [{ kind: 'image', src: 'https://assets.test/one.jpg' }] });
  assert.deepEqual(plan.map((section) => section.type), ['hero', 'gallery', 'faq', 'enquiry', 'footer']);
  passed += 1;
  console.log('PASS provider evidence distinguishes genuine success from truncated or empty responses and returns a section plan');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  if (originalDisableAi === undefined) delete process.env.LP_E2E_DISABLE_AI;
  else process.env.LP_E2E_DISABLE_AI = originalDisableAi;
}

test('prelaunch intent overrides a legacy package classification without mutating its brief', () => {
  const brief = { campaignName: 'Platform pre-launch', objective: 'package', businessName: 'GR8 Result', offering: 'AI plan takeoff, estimating, client selections', audience: 'builders', ctaLabel: 'Start a free trial' };
  const original = JSON.stringify(brief);
  assert.equal(campaignObjective(brief), 'prelaunch');
  const generated = composeDocument(brief, { aiCopy: { hero: { primaryCta: 'Start your 14-day free trial' } } }).document;
  assert.equal(generated.sections[0].props.primaryCta.label, 'Register Your Interest');
  assert.equal(generated.sections[0].props.secondaryCta.href, '#enquire-demo');
  assert.deepEqual(generated.form.fields.map((field) => field.key), ['name', 'email', 'business_name', 'phone', 'enquiry_intent']);
  assert.match(generated.form.consent.text, /does not subscribe/);
  assert.equal(generated.form.fields.find((field) => field.key === 'phone').required, false);
  assert(!/trial/i.test(JSON.stringify(generated.sections)));
  assert.equal(JSON.stringify(brief), original);
  assert(checkForPublish(generated).ok, JSON.stringify(checkForPublish(generated)));
  const registration = validateSubmission(generated.form, { fields: { name: 'Builder', email: 'builder@example.test' }, consent: true, idempotencyKey: 'registration-test-key' });
  assert(registration.ok);
  assert.equal(registration.values.enquiry_intent, 'Pre-launch registration');
  const invalid = validateSubmission(generated.form, { fields: { name: 'Builder', email: 'builder@example.test', enquiry_intent: 'Subscribe to all marketing' }, consent: true, idempotencyKey: 'invalid-intent-test-key' });
  assert.equal(invalid.ok, false);
});

test('capabilities retain internal readiness without repetitive public uncertainty labels', () => {
  const brief = sanitiseBrief({
    businessName: 'Example Platform', objective: 'prelaunch', offering: 'Connected workflow software',
    capabilities: Array.from({ length: 9 }, (_, index) => ({ name: `Capability ${index + 1}`, description: `Helps with task ${index + 1}.`, status: ['available', 'planned', 'development', 'unknown'][index % 4] })),
  });
  const generated = composeDocument(brief, { structure: validateStructure(['hero', 'services', 'enquiry', 'footer'], brief) }).document;
  const services = generated.sections.find((section) => section.type === 'services').props.items;
  assert.equal(services.length, 9);
  assert.match(services[1].body, /^Planned workflow:/);
  assert.match(services[2].body, /^In development:/);
  assert.equal(generated.generation.capabilities[3].status, 'unconfirmed');
  assert(!/Availability to be confirmed/.test(JSON.stringify(generated.sections)));
  assert(!generated.sections.some((section) => ['trust', 'testimonials'].includes(section.type)));
});

test('visual story variants, paired pain points and disclosed assets survive generation and editing', () => {
  const brief = { businessName: 'Garden Studio', offering: 'Landscape design, Planting', painPoints: ['A bare yard'], media: [
    { src: 'https://assets.test/garden.jpg', alt: 'Garden concept', disclosure: 'Illustration only' },
    { src: 'https://assets.test/planting.jpg', alt: 'Planting', disclosure: 'Illustration only' },
  ] };
  const structure = validateStructure([{ type: 'hero', variant: 'cinematic-dark' }, { type: 'benefits', variant: 'comparison' }, { type: 'services', variant: 'showcase' }, { type: 'process', variant: 'connected' }], brief);
  const generated = composeDocument(brief, { structure, strategy: { problemSolutionBenefits: [{ problem: 'A bare yard', solution: 'A planting plan', benefit: 'Know what goes where.' }] } }).document;
  assert.equal(generated.sections.find((s) => s.type === 'benefits').props.items[0].problem, 'A bare yard');
  assert.equal(generated.sections.find((s) => s.type === 'services').props.items[0].image.disclosure, 'Illustration only');
  const reopened = normaliseDocument(JSON.parse(JSON.stringify(generated)));
  assert.deepEqual(reopened.sections.map((s) => s.variant), structure.map((s) => s.variant || 'default'));
});

test('cinematic and product hero choices persist through edits, serialisation and normalisation', () => {
  for (const variant of ['cinematic-dark', 'cinematic-light', 'product', 'split', 'statement']) {
    const brief = { offering: 'Landscape design', media: [{ src: 'https://assets.test/concept.jpg', alt: 'Concept' }] };
    const document = composeDocument(brief, { structure: validateStructure([{ type: 'hero', variant }, 'enquiry', 'footer'], brief) }).document;
    const edited = applyOps(document, [{ op: 'setSectionProp', sectionId: document.sections[0].id, path: 'image', value: { src: 'https://assets.test/replacement.jpg', alt: 'New photo' } }]).document;
    const reopened = normaliseDocument(JSON.parse(JSON.stringify(edited)));
    assert.equal(reopened.sections[0].variant, variant);
    assert.equal(reopened.sections[0].props.image.src, 'https://assets.test/replacement.jpg');
  }
});

test('unapproved trials and launch dates are removed while supplied offers remain allowed', () => {
  assert(unsupportedClaims('Try our 14-day free trial.', {}).length);
  assert(unsupportedClaims('Launches on 1 December 2026.', {}).length);
  assert.equal(unsupportedClaims('14-day trial', { offer: '14-day trial' }).length, 0);
});

test('paid image spend is capped by a persistent ledger and fails closed', () => {
  const ledger = path.join(os.tmpdir(), `lp-ledger-${process.pid}.json`);
  fs.rmSync(ledger, { force: true });
  process.env.LANDING_PAGE_IMAGE_LEDGER = ledger;
  delete process.env.LANDING_PAGE_IMAGE_BUDGET_USD;
  assert.equal(reserveImageSpend({ model: 'gpt-image-1.5' }).ok, false, 'no budget configured means no paid calls');
  process.env.LANDING_PAGE_IMAGE_BUDGET_USD = '0.10';
  assert.equal(reserveImageSpend({ model: 'gpt-image-1.5' }).ok, true);
  assert.equal(reserveImageSpend({ model: 'gpt-image-1.5' }).ok, true);
  assert.equal(reserveImageSpend({ model: 'gpt-image-1.5' }).ok, false, 'third US$0.05 image exceeds US$0.10');
  assert.equal(reserveImageSpend({ model: 'unknown-model' }).ok, false, 'unverified pricing is refused');
  assert.equal(budgetStatus().spentUsd, 0.1);
  fs.rmSync(ledger, { force: true });
  delete process.env.LANDING_PAGE_IMAGE_BUDGET_USD;
  delete process.env.LANDING_PAGE_IMAGE_LEDGER;
});

test('residential campaigns plan distinct, room-specific, affordable-home subjects', () => {
  const homeBrief = { industry: 'Home building', offering: 'New homes for first home buyers', audience: 'First home buyers', serviceArea: 'Sunshine Coast', imagePlanningEnabled: true };
  assert(isResidentialBrief(homeBrief));
  assert(!isResidentialBrief({ industry: 'Cabinet making', offering: 'Custom kitchens, vanities and walk-in wardrobes', audience: 'Homeowners renovating their kitchens' }));
  assert(!isResidentialBrief({ industry: 'Software for builders', offering: 'Quoting platform' }));
  const { document } = composeDocument(homeBrief, { structure: validateStructure(null, homeBrief) });
  const plan = buildImagePlan(document, homeBrief);
  assert(plan.length >= 3);
  assert.equal(new Set(plan.map((slot) => slot.subject)).size, plan.length, 'every slot has a different subject');
  assert(/NOT a mansion/.test(plan.find((slot) => slot.purpose === 'hero').subject));
});

test('software wording is stripped from unrelated industries', async () => {
  const { stripUnsupportedClaims } = await import('../lib/landing-pages/generator.js');
  const barber = { industry: 'Barbershop', offering: 'Haircuts and beard trims', audience: 'Local men', objective: 'sales' };
  const out = stripUnsupportedClaims('Book a chair today. Request a demonstration of our platform.', barber);
  assert(!/demonstration|platform/i.test(out), out);
  assert(/Book a chair/.test(out));
});

test('batch edit strips software wording from an unrelated business and reports it', () => {
  const brief = { industry: 'Barbershop', offering: 'Haircuts', audience: 'Local men', objective: 'sales' };
  const { document } = composeDocument(brief, { structure: validateStructure(null, brief) });
  document.sections.find((s) => s.type === 'enquiry').props.heading = 'Request a Demonstration';
  document.form.intro = 'Register for release updates.';
  const edited = JSON.parse(JSON.stringify(document));
  const batch = finaliseBatchEdit(document, edited, { brief, instruction: 'Remove any mention of demonstrations or release updates.' });
  assert(!/demonstrat|release update/i.test(JSON.stringify([batch.document.sections.map((s) => s.props), batch.document.form])));
  assert(batch.outcomes.some((o) => /software and demonstration/i.test(o.label) && o.complete));
});

test('removing wording never removes a section that is merely mentioned', () => {
  const brief = { industry: 'Home building', offering: 'New homes', audience: 'First home buyers', objective: 'sales' };
  const { document } = composeDocument(brief, { structure: validateStructure(null, brief) });
  const before = document.sections.length;
  const proposal = interpretInstruction(document, 'Improve the process section heading. Remove every mention of demonstrations.', { brief });
  assert(!proposal || !proposal.ops.some((op) => op.op === 'removeSection'));
  assert.equal(document.sections.length, before);
});

console.log(`\n${passed} landing page model checks passed.`);
