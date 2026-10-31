// Shared by generation and form defaults; never changes the original campaign brief.
export function campaignObjective(brief = {}) {
  const intent = [brief.campaignName, brief.campaignPrompt, brief.objectiveDetail].filter(Boolean).join(' ');
  if (brief.objective === 'prelaunch' || /\bpre[- ]?launch\b|\bwaitlist\b|\bupcoming release\b/i.test(intent)) return 'prelaunch';
  return brief.objective || 'enquiries';
}

export function campaignCta(brief = {}) {
  if (campaignObjective(brief) === 'prelaunch') {
    const label = String(brief.ctaLabel || '');
    return label && !/\btrial\b|\bbuy\b|\bsubscribe\b|\bconsultation\b/i.test(label) ? label : 'Register Your Interest';
  }
  return brief.ctaLabel || ({ booking: 'Request a booking', download: 'Request the download', sales: 'Enquire about purchasing', subscription: 'Enquire about subscribing' }[campaignObjective(brief)] || 'Get in touch');
}

export const HERO_VARIANTS = ['split', 'statement', 'cinematic-dark', 'cinematic-light', 'product'];
export const SECTION_VARIANTS = {
  hero: HERO_VARIANTS,
  benefits: ['default', 'comparison'],
  services: ['default', 'showcase'],
  process: ['default', 'connected'],
  about: ['default', 'image-banner'],
};

export function defaultHeroVariant(brief = {}) {
  const visual = brief.media?.find((item) => item.kind !== 'video');
  return /screenshot|product interface|dashboard/i.test(visual?.alt || '') && !/concept|illustrat|ai.generated/i.test(`${visual?.alt || ''} ${visual?.disclosure || ''}`) ? 'product' : 'cinematic-dark';
}
