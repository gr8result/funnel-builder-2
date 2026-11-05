import { DEFAULT_BUILDER_TEMPLATE_BRAND as DEFAULT_BRAND } from './defaultTemplateBrand.js';

export const COVER_HERO_FALLBACK = '/assets/builders/standard-inclusions-hero.jpg';
const LEGACY_HERO = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c';
const ROW_TEXT = /indicative\s+rate|quote\s+required|current\s+price|price\s+pending|\[object Object\]/i;
const clean = value => typeof value === 'string' && !ROW_TEXT.test(value) ? value.trim() : '';
const first = (...values) => values.map(clean).find(Boolean) || '';
const imageUrl = value => /^(\/[^/]|https?:\/\/|data:image\/)/i.test(clean(value)) ? clean(value) : '';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function builderLogoFor({ builderName = '', logoUrl = '' } = {}) {
  const isGoodBuild = /good\s*build/i.test(clean(builderName));
  return imageUrl(first(logoUrl, isGoodBuild ? DEFAULT_BRAND.logoUrl : ''));
}

// Deliberately do not walk the workbook. Generic keys such as "state" also occur
// in selection rows. Only project identity and explicitly named cover fields enter here.
export function createSelectionsCover({ cover = {}, workbook = {}, project = {}, builder = {}, template = {} } = {}) {
  const rows = workbook.data?.inputDataSheet?.rows || workbook.data?.projectDetails?.rows || {};
  const value = key => clean(rows[key]?.value);
  const meta = workbook.jobFileMeta || {};
  const registered = workbook.registeredJob || {};
  const profile = { ...(workbook.standardInclusions?.brand || {}), ...(workbook.builderProfile || {}), ...(project.metadata?.builderProfile || {}), ...(project.builder_profile || {}), ...builder };
  const edited = key => cover.coverEdits?.[key] ? clean(cover[key]) : '';
  const projectName = first(value('projectName'), meta.jobName, registered.jobName, project.project_name, project.name, cover.projectName);
  const builderName = first(edited('builderName'), profile.companyName, profile.name, value('builderName'), cover.builderName, DEFAULT_BRAND.name);
  const isDefaultBrand = /good\s*build/i.test(builderName);
  const siteAddress = first(edited('siteAddress'), value('projectAddress'), meta.address, registered.siteAddress, project.site_address, cover.siteAddress);
  const suburb = first(edited('suburbPostcode'), value('suburb'), project.suburb);
  const locality = first(edited('suburbPostcode'), [suburb, value('state') || clean(project.state), value('postcode') || clean(project.postcode)].filter(Boolean).join(' '), cover.locality, cover.suburbPostcode);
  const range = first(edited('selectionStandard'), profile.selectionStandard, template.specification_name, template.quality_level, value('selectionStandard'), cover.selectionStandard);
  const candidates = [
    profile.coverImageUrl, profile.cover_image_url, cover.builderCoverImageUrl,
    // A deliberately chosen cover background is builder-specific. The old seeded
    // Unsplash URL is only a default, so it must not outrank project photography.
    cover.backgroundImageUrl?.startsWith(LEGACY_HERO) ? '' : cover.backgroundImageUrl,
    project.coverImageUrl, project.cover_image_url, meta.coverImageUrl, cover.projectCoverImageUrl,
    profile.marketingImageUrl, profile.marketing_image_url, cover.builderMarketingImageUrl,
    ...(Array.isArray(cover.heroImages) ? cover.heroImages : []),
    COVER_HERO_FALLBACK,
  ].map(imageUrl).filter(Boolean);
  return Object.freeze({
    builderName,
    logoUrl: builderLogoFor({ builderName, logoUrl: first(edited('logoUrl'), profile.logoUrl, profile.logo_url, cover.logoUrl, isDefaultBrand ? DEFAULT_BRAND.logoUrl : '') }),
    tagline: first(edited('tagline'), profile.tagline, cover.tagline, isDefaultBrand ? DEFAULT_BRAND.tagline : ''),
    accentColor: /^#[\da-f]{6}$/i.test(first(cover.accentColor, profile.accentColor)) ? first(cover.accentColor, profile.accentColor) : DEFAULT_BRAND.accentColor,
    title: first(cover.title, 'Inclusions and Selections Schedule'),
    projectName,
    clientName: first(edited('clientName'), value('clientName'), meta.clientName, registered.clientName, project.client_name, cover.clientName),
    siteAddress,
    locality: locality && !siteAddress.toLowerCase().includes(locality.toLowerCase()) && !/\b\d{4}\b/.test(siteAddress) ? locality : '',
    selectionStandard: range && range !== projectName ? range.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase()) : 'Builder standard',
    version: first(cover.version, '1.0'),
    issueDate: first(cover.issueDate),
    status: ['Draft', 'For Approval', 'Approved', 'Contract'].find(status => status.toLowerCase() === clean(cover.status).replaceAll('_', ' ').toLowerCase()) || 'Draft',
    heroImages: [...new Set(candidates)],
    heroPosition: /^\d{1,3}% \d{1,3}%$/.test(cover.heroPosition || '') ? cover.heroPosition : '50% 50%',
  });
}

export function renderSelectionsCover(cover) {
  const standardTitle = /^inclusions (and|&) selections schedule$/i.test(cover.title);
  const title = standardTitle ? 'Inclusions<span>&amp; Selections</span><small>SCHEDULE</small>' : escape(cover.title);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(cover.issueDate) ? new Date(`${cover.issueDate}T12:00:00Z`).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : cover.issueDate;
  return `<section class="brochureCover" aria-label="Inclusions and selections schedule cover" style="--brochure-accent:${escape(cover.accentColor)}">
    <div class="brochurePanel">
      <header class="brochureBrand">${cover.logoUrl ? `<img class="brochureLogo" src="${escape(cover.logoUrl)}" alt="${escape(cover.builderName)} logo" />` : ''}<strong>${escape(cover.builderName)}</strong>${cover.tagline ? `<p>${escape(cover.tagline)}</p>` : ''}</header>
      <div class="brochureHeading"><div class="brochureRule"></div><h1>${title}</h1></div>
      <div class="brochureDetails"><p class="brochureRange">${escape(cover.selectionStandard)}</p><h2>${escape(cover.projectName)}</h2><p class="brochureClient">${escape(cover.clientName)}</p><p class="brochureAddress">${escape(cover.siteAddress)}${cover.locality ? `<br>${escape(cover.locality)}` : ''}</p></div>
      <footer class="brochureFooter"><span>${escape(cover.status)} &nbsp; / &nbsp; Version ${escape(cover.version)}</span>${date ? `<span>Prepared ${escape(date)}</span>` : ''}</footer>
    </div>
    <div class="brochureHero" style="--hero-position:${escape(cover.heroPosition)}">${cover.heroImages.map((src, index) => `<img src="${escape(src)}" alt="${index === 0 ? 'Residential architecture' : ''}" style="z-index:${cover.heroImages.length - index}" />`).join('')}</div>
  </section>`;
}

// Shared by the app preview and PDF. Container units scale the typography with
// the page, rather than with the browser window or print viewport.
export const selectionsCoverCss = `
  .brochureCover { width:100%; aspect-ratio:297/210; container-type:inline-size; display:grid; grid-template-columns:39% 61%; background:#f7f5ef; color:#252c2d; position:relative; font-family:Arial,sans-serif; box-sizing:border-box; isolation:isolate; }
  .brochureCover * { box-sizing:border-box; }
  .brochureCover .brochurePanel { padding:4.4cqw 3.7cqw 3.2cqw; display:flex; flex-direction:column; min-width:0; }
  .brochureCover .brochureBrand { display:block; }
  .brochureCover .brochureLogo { display:block; width:11cqw; height:7cqw; object-fit:contain; object-position:left center; margin:0 0 1.2cqw; }
  .brochureCover .brochureBrand strong { display:block; font-size:1.45cqw; font-weight:600; letter-spacing:.12em; text-transform:uppercase; line-height:1.35; }
  .brochureCover .brochureBrand p { font-size:.92cqw; line-height:1.6; color:#686962; margin:.7cqw 0 0; white-space:pre-line; }
  .brochureCover .brochureHeading { margin:auto 0; padding:3cqw 0; }
  .brochureCover .brochureRule { width:4cqw; height:2px; background:var(--brochure-accent); margin-bottom:2cqw; }
  .brochureCover h1 { font-family:Georgia,'Times New Roman',serif; font-size:4.15cqw; line-height:1.09; letter-spacing:-.045em; font-weight:400; color:#252c2d; margin:0; text-transform:none; }
  .brochureCover h1 span { display:block; font-size:3.05cqw; letter-spacing:-.03em; margin-top:.5cqw; }
  .brochureCover h1 small { display:block; font-family:Arial,sans-serif; font-size:.9cqw; letter-spacing:.32em; font-weight:400; margin-top:1.65cqw; }
  .brochureCover .brochureRange { font-size:.9cqw; text-transform:uppercase; letter-spacing:.18em; color:#766343; border-left:2px solid var(--brochure-accent); padding-left:1cqw; margin:0 0 1.5cqw; }
  .brochureCover h2 { font-size:1.65cqw; font-weight:500; line-height:1.3; margin:0 0 1cqw; color:#252c2d; }
  .brochureCover .brochureClient { font-size:1.15cqw; margin:0 0 .6cqw; line-height:1.5; }
  .brochureCover .brochureAddress { font-size:1cqw; line-height:1.65; color:#686962; margin:0; }
  .brochureCover .brochureFooter { display:flex; flex-wrap:wrap; gap:.5cqw 1cqw; padding-top:1.6cqw; margin-top:3cqw; border-top:1px solid #d8d4c9; font-size:.76cqw; line-height:1.5; color:#686962; }
  .brochureCover .brochureFooter span { font-size:inherit; }
  .brochureCover .brochureHero { position:relative; min-width:0; background:#e9e5dc; }
  .brochureCover .brochureHero img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:var(--hero-position); }
  @page selections-cover { size:A4 landscape; margin:0; }
  @media print { .brochureCover { page:selections-cover; width:297mm; height:210mm; aspect-ratio:auto; break-after:page; print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
`;
