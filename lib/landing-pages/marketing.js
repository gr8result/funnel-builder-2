// Links and copy for promoting a published landing page in Social Media and Email Marketing.

import { slugify } from './pageModel.js';

export const CHANNELS = [
  { key: 'facebook', label: 'Facebook', source: 'facebook', medium: 'social' },
  { key: 'instagram', label: 'Instagram', source: 'instagram', medium: 'social' },
  { key: 'email', label: 'Email marketing', source: 'newsletter', medium: 'email' },
  { key: 'sms', label: 'SMS', source: 'sms', medium: 'sms' },
  { key: 'google', label: 'Google Ads', source: 'google', medium: 'cpc' },
];

export function publicPageUrl(baseUrl, slug) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  return `${base}/lp/${slug}`;
}

export function trackedLinks(baseUrl, slug, campaignName) {
  const url = publicPageUrl(baseUrl, slug);
  const campaign = slugify(campaignName, 'campaign');
  return CHANNELS.map((c) => {
    const u = new URL(url);
    u.searchParams.set('utm_source', c.source);
    u.searchParams.set('utm_medium', c.medium);
    u.searchParams.set('utm_campaign', campaign);
    return { ...c, url: u.toString() };
  });
}

export function fallbackSocialPosts(brief = {}, { url, headline }) {
  const business = brief.businessName || 'our team';
  const where = brief.serviceArea ? ` across ${brief.serviceArea}` : '';
  const offer = brief.offer ? ` ${brief.offer.replace(/\.?$/, '.')}` : '';
  return {
    facebook: `${headline}\n\n${business} offers ${brief.offering || 'products and services'}${where}.${offer} Tell us what interests you and we will be in touch.\n\n${url}`,
    instagram: `${headline}. ${business} offers ${brief.offering || 'products and services'}${where}.${offer} Tap the link in our bio to start the conversation.`,
    hashtags: [...new Set([slugify(brief.businessName || 'business').replace(/-/g, ''), slugify(brief.industry || brief.campaignName || 'campaign').replace(/-/g, ''), ...(brief.serviceArea ? [slugify(brief.serviceArea.split(',')[0]).replace(/-/g, '')] : [])])].slice(0, 8),
  };
}
