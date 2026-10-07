import { createHash } from 'node:crypto';

export const digest = (value) => createHash('sha256')
  .update(typeof value === 'string' ? value : JSON.stringify(value))
  .digest('hex');

export function captureCatalogue(mod, themes, imageData) {
  const blocks = Object.fromEntries(mod.SECTION_BLOCKS.map(({ html, ...metadata }) => [
    metadata.id, digest({ ...metadata, html: html() }),
  ]));
  const pages = Object.fromEntries(mod.FUNNEL_TYPES.flatMap((funnel) =>
    funnel.pages.map((page, index) => [
      `${funnel.id}/${index}`, digest(mod.assemblePage(page.sectionIds)),
    ]),
  ));
  const directSections = Object.fromEntries(Object.keys(mod)
    .filter((name) => name.startsWith('section') && typeof mod[name] === 'function')
    .map((name) => [name, digest(mod[name]())]));
  const imageCases = [undefined, {}, { slot: '0' }, { slot: '1' },
    { slot: 'band-hero' }, { slot: '-1' }, { slot: '2x' },
    { title: 'Repair & maintain', subtitle: 'Local service',
      caption: 'Before / after', service: 'Consultation', slot: 'gallery-9' }];
  const fallbackResults = [...themes.map((theme) => theme.slug), '', 'unknown-service']
    .flatMap((slug) => ['hero', 'gallery', 'card', 'unknown'].flatMap((variant) =>
      imageCases.map((options) => mod.getServiceFallbackImageUrlBySlug(slug, variant, options)),
    ));
  return {
    exports: Object.keys(mod),
    counts: { themes: themes.length, blocks: mod.SECTION_BLOCKS.length,
      funnels: mod.FUNNEL_TYPES.length, pages: Object.keys(pages).length,
      assets: mod.getFunnelTemplateLibraryAssets().length,
      fallbackCases: fallbackResults.length },
    themes: Object.fromEntries(themes.map((theme) => [theme.slug, digest(theme)])),
    imageData: digest(imageData),
    blocks,
    funnelIds: mod.FUNNEL_TYPES.map((funnel) => funnel.id),
    funnelDefinitions: digest(mod.FUNNEL_TYPES),
    pages,
    directSections,
    assets: digest(mod.getFunnelTemplateLibraryAssets()),
    fallbackResults: digest(fallbackResults),
    emptyPage: mod.assemblePage([]),
    unknownSections: mod.assemblePage(['unknown', 'hero-dark', 'not-a-section']),
  };
}

