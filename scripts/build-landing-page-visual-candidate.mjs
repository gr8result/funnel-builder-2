// Updates only the existing isolated demonstration, using stored assets. Never contacts an AI provider.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { makeSection, normaliseDocument } from '../lib/landing-pages/pageModel.js';

const APP = 'http://localhost:3123';
const PAGE = '2022a330-1ac0-4bff-a23f-7cdd40f580e0';
const WORKSPACE = 'aaaaaaaa-0000-4000-8000-000000000e71';
const OUT = path.resolve('artifacts', 'landing-pages-campaign-quality');
const login = await fetch('http://127.0.0.1:54423/auth/v1/token?grant_type=password', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'quality-owner@example.test', password: 'quality-test-only' }),
});
assert(login.ok, 'The isolated fixture owner must be available');
const session = await login.json();
async function api(body, method = 'POST') {
  const response = await fetch(`${APP}/api/landing-pages/pages/${PAGE}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, 'x-workspace-id': WORKSPACE },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert(response.ok && result.ok, JSON.stringify(result));
  return result;
}
const current = await api(null, 'GET');
assert.equal(current.page.workspace_id, WORKSPACE, 'Never update a real customer workspace');
fs.writeFileSync(path.join(OUT, 'before-visual-rebuild.json'), JSON.stringify(current.page.document, null, 2));
const manifestPath = path.join(OUT, 'visual-assets.json');
const assets = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
async function asset(key, file, alt, disclosure, crop = null) {
  if (assets[key] && (await fetch(assets[key].src)).ok) return assets[key];
  let image = sharp(file);
  if (crop) image = image.extract(crop);
  const bytes = await image.resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), bytes);
  const uploaded = await api({ action: 'upload', fileName: `${key}.jpg`, dataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}` });
  const value = { src: uploaded.url, alt, disclosure };
  assets[key] = value;
  fs.writeFileSync(manifestPath, JSON.stringify(assets, null, 2));
  return value;
}
const illustrative = 'Illustrative imagery. Not a GR8 Result customer project.';
const strip = path.resolve('public', 'assets', 'builders', 'standard-inclusions-construction-strip.png');
const hero = await asset('visual-hero', path.join(OUT, 'real-provider-hero.jpg'), 'Builder reviewing building plans on a laptop beside a residential timber frame', 'AI-generated concept. Not a product screenshot or customer project.');
const plans = await asset('visual-plans', strip, 'Architectural plans and a hard hat', illustrative, { left: 376, top: 0, width: 330, height: 299 });
const framing = await asset('visual-framing', strip, 'Residential timber framing in warm sunlight', illustrative, { left: 714, top: 0, width: 340, height: 299 });
const home = await asset('visual-home', path.resolve('public', 'assets', 'builders', 'standard-inclusions-hero.jpg'), 'Contemporary residential architecture', illustrative);
const kitchen = await asset('visual-kitchen', path.resolve('public', 'assets', 'builders', 'standard-inclusions-premier-kitchen.jpg'), 'Kitchen cabinetry, finishes and appliances', illustrative);
const materials = await asset('visual-materials', path.resolve('public', 'images', 'client-selections', 'client-selections-tiles-stone.webp'), 'Tile and stone material choices', illustrative);
const interiors = await asset('visual-living', path.resolve('public', 'assets', 'builders', 'standard-inclusions-premier-living.jpg'), 'Residential living space and finishes', illustrative);
const editor = await asset('visual-editor-current', path.join(OUT, fs.existsSync(path.join(OUT, 'visual-editor-live.png')) ? 'visual-editor-live.png' : 'editor.png'), 'The actual GR8 Result Landing Page Builder editor in an isolated demonstration', 'Actual Landing Page Builder editor. Isolated demonstration.');
const laptop = await asset('visual-estimating', path.join(OUT, 'real-provider-hero.jpg'), 'Illustrative builder reviewing plans at a laptop', 'AI concept, not a product screenshot.', { left: 550, top: 350, width: 900, height: 580 });

const original = current.page.document;
const section = (type, props, variant, background = 'default', paddingY = 'sm') => {
  const result = makeSection(type, props, { background, paddingY });
  result.variant = variant || 'default';
  return result;
};
const capabilities = [
  ['AI-assisted plan takeoff', 'Work from building plans to organise quantities and reduce repeated manual measurement.', 'plan', plans],
  ['Job setup & estimating', 'Bring job details, estimate inputs and cost items into a clearer estimating workflow.', 'calculator', laptop],
  ['Quotation building', 'Turn estimate information into a quotation for customer review.', 'document', home],
  ['Client selections', 'Keep finishes, products and client decisions connected to the right job.', 'layers', kitchen],
  ['Product libraries & inclusions', 'Organise product information and inclusions for estimates and client choices.', 'layers', materials],
  ['Project & workflow management', 'Keep job tasks and project progress in view as work moves forward.', 'project', framing],
  ['Customer enquiries & CRM', 'Keep enquiry details, conversations and follow-up information together.', 'mail', interiors],
  ['Marketing, pages & funnels', 'Build editable campaign pages and capture enquiries into the CRM.', 'document', editor],
];
const doc = normaliseDocument({
  ...original,
  theme: { ...original.theme, fonts: 'manrope', radius: 'soft', palette: { ...original.theme.palette, accent: '#008F91', ink: '#0B1728', surface: '#FFFFFF', surfaceAlt: '#F3F6F9', muted: '#536174' } },
  brand: { ...original.brand, email: '' },
  seo: { ...original.seo, title: 'GR8 Result | Built around your building business', description: 'Explore GR8 Result: building plans, estimating, quotations, selections and customer enquiries. Register your pre-launch interest or request a demonstration.', ogImage: hero.src },
  generation: { ...original.generation, visualBenchmark: 'Approved image-led campaign reference, 24 October 2026', capabilities: capabilities.map(([name]) => ({ name, status: 'unconfirmed', evidence: 'User-supplied product scope; no production-readiness certification' })), connectedWorkflow: { status: 'unconfirmed' } },
  sections: [
    section('hero', {
      eyebrow: 'GR8 RESULT · PRE-LAUNCH FOR AUSTRALIAN BUILDERS',
      headline: 'Spend Less Time on Admin. More Time Building.',
      subheadline: 'From AI-assisted plan takeoffs and estimating to quotations, client selections, project management and customer enquiries — GR8 Result brings your building workflow together.',
      primaryCta: { label: 'Register Your Interest', href: '#enquire' },
      secondaryCta: { label: 'Request a Demonstration', href: '#enquire-demo' },
      image: hero, highlights: ['For Australian builders', 'Explore connected workflows', 'Register for release updates'],
    }, 'cinematic-dark'),
    section('process', {
      eyebrow: 'FROM FIRST PLAN TO THE NEXT STEP',
      heading: 'Your building workflow. A more connected picture.',
      intro: 'Explore the intended journey in a demonstration.',
      steps: [
        { title: 'Plans & takeoff', body: 'Start with the plans and quantities behind the job.', icon: 'plan' },
        { title: 'Job & estimate', body: 'Organise details, cost items and estimate inputs.', icon: 'calculator' },
        { title: 'Quotation', body: 'Bring the estimate into the customer conversation.', icon: 'document' },
        { title: 'Client selections', body: 'Connect product choices and inclusions to the job.', icon: 'layers' },
        { title: 'Project workflow', body: 'Keep tasks, progress and customer follow-up in view.', icon: 'project' },
      ],
    }, 'connected', 'dark'),
    section('benefits', {
      eyebrow: 'LESS BACK-AND-FORTH. A CLEARER WAY FORWARD.',
      heading: 'Sound familiar? There is a better way to work.',
      intro: '',
      problemHeading: 'The everyday frustrations',
      solutionHeading: 'The workflows behind GR8 Result',
      items: [
        { problem: 'Measuring the same plans again and again.', title: 'AI-assisted plan takeoff', body: 'A clearer starting point for quantities.' },
        { problem: 'Re-entering job details across separate files.', title: 'Job setup, estimates & quotations', body: 'Keep the commercial workflow in context.' },
        { problem: 'Client choices buried in emails and messages.', title: 'Connected selections & inclusions', body: 'Keep decisions alongside the job.' },
        { problem: 'Customer enquiries slipping out of sight.', title: 'Customer enquiries & CRM', body: 'Keep follow-up information together.' },
      ],
      image: home, imageHeading: 'From plans to projects.',
    }, 'comparison'),
    section('services', {
      eyebrow: 'BUILT AROUND THE WAY YOU BUILD',
      heading: 'The right information. At every stage.',
      intro: 'A pre-launch look at the intended product workflows. Discuss the scope that fits your business in a demonstration.',
      items: capabilities.map(([title, body, icon, image]) => ({ title, body, icon, image })),
    }, 'showcase', 'alt'),
    section('offer', {
      eyebrow: 'GET TO KNOW GR8 RESULT',
      heading: 'See how your building workflow could fit together.',
      body: 'Tell us what matters to your business. Request a demonstration of the relevant workflows.',
      cta: { label: 'Request a Demonstration', href: '#enquire-demo' }, finePrint: '',
    }, 'default', 'accent'),
    section('about', {
      eyebrow: 'BUILT FOR THE WORK BEHIND THE BUILD',
      heading: 'Keep your attention on the bigger picture.',
      body: 'Plans, customer decisions and the next job all need attention. Explore an approach that keeps the information behind them connected.',
      image: framing,
    }, 'image-banner'),
    section('enquiry', {
      eyebrow: 'BE PART OF WHAT COMES NEXT',
      heading: 'Your next build starts with a conversation.',
      intro: 'Register for release updates, or tell us you would like a demonstration.',
      sidePoints: ['Choose registration or a demonstration enquiry.', 'No purchase commitment.', 'Only communication about your request.'],
      image: kitchen,
    }, 'default', 'alt'),
    section('faq', {
      eyebrow: 'A FEW THINGS WORTH KNOWING',
      heading: 'Before you register',
      items: [
        { q: 'What am I registering for?', a: 'Updates about the upcoming GR8 Result release. You can also express interest in a product demonstration.' },
        { q: 'What can I discuss in a demonstration?', a: 'Tell us about your plans, estimating, quotations, selections or enquiry workflow. Ask which capabilities can be demonstrated and how they relate to your business.' },
        { q: 'Are these real product screenshots?', a: 'The building and interiors images illustrate the workflow context, not completed GR8 Result customer projects. The Landing Page Builder card shows the actual editor in an isolated demonstration. The hero is an AI-generated concept.' },
        { q: 'Does registering subscribe me to other marketing?', a: 'No. The form consent covers communication about your pre-launch registration or demonstration request, not unrelated marketing.' },
      ],
    }),
    section('footer', { tagline: 'Built around your building business.', legal: 'GR8 Result pre-launch. Building imagery is illustrative, not evidence of completed customer work.' }, 'default', 'dark'),
  ],
});
doc.form.heading = 'Register your interest';
doc.form.intro = 'Leave your details and choose how you would like to hear from us.';
await api({ document: doc, baseRevision: current.page.revision, label: 'Approved-reference visual rebuild — isolated candidate only' }, 'PUT');
const reopened = await api(null, 'GET');
assert.deepEqual(reopened.page.document, doc);
const published = await api({ action: 'publish' });
fs.writeFileSync(path.join(OUT, 'visual-candidate-document.json'), JSON.stringify(doc, null, 2));
fs.writeFileSync(path.join(OUT, 'visual-candidate-build.json'), JSON.stringify({ publicUrl: published.publicUrl, isolated: true, productionWrites: 0, paidRequests: 0, assets: Object.keys(assets).length, revision: reopened.page.revision }, null, 2));
console.log(JSON.stringify({ ok: true, publicUrl: published.publicUrl, images: Object.keys(assets).length, productionWrites: 0, paidRequests: 0 }));
