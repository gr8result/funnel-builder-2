import { TEMPLATES } from './templates';
import { WEBSITE_TEMPLATE_PROFILES } from './templateProfiles';

const CHAI_STARTER_IMAGE_URLS = [
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80',
];

function canonicalSource(value = '') {
  const raw = String(value || '').trim();
  if (!/^https?:\/\//i.test(raw)) return '';
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString();
  } catch {
    return raw.split('?')[0];
  }
}

function isPlaceholderAssetUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return true;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (host === 'placehold.co' || host === 'via.placeholder.com' || host === 'dummyimage.com') return true;
  } catch {
    return true;
  }
  return false;
}

function collectImageUrls(value, bucket = []) {
  if (!value) return bucket;
  if (typeof value === 'string') {
    const normalized = canonicalSource(value);
    if (normalized && !isPlaceholderAssetUrl(normalized)) bucket.push(normalized);
    return bucket;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectImageUrls(entry, bucket));
    return bucket;
  }
  if (typeof value === 'object') {
    Object.values(value).forEach((entry) => collectImageUrls(entry, bucket));
  }
  return bucket;
}

function buildAssetName(index, sourceUrl) {
  const basename = String(sourceUrl || '').split('/').pop() || 'image';
  return `Website Library ${String(index + 1).padStart(3, '0')} ${basename.replace(/[-_]+/g, ' ')}`;
}

export function getWebsiteTemplateLibraryAssets() {
  const sources = [];

  collectImageUrls(WEBSITE_TEMPLATE_PROFILES, sources);

  TEMPLATES.forEach((template) => {
    collectImageUrls(template, sources);

    if (typeof template?.build === 'function') {
      try {
        collectImageUrls(template.build('modern-blue'), sources);
      } catch {
        // Skip broken template builds and keep seeding the rest of the library.
      }
    }
  });

  collectImageUrls(CHAI_STARTER_IMAGE_URLS, sources);

  return Array.from(new Set(sources)).map((src, index) => ({
    id: `website-template-${index + 1}`,
    name: buildAssetName(index, src),
    type: 'image/jpeg',
    src,
  }));
}