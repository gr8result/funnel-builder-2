// /utils/transfer.js
// Simple, stable JSON schema + helpers for funnel import/export.

export const EXPORT_VERSION = 1;

export function buildExportJson({ funnel, pages, assets = [] }) {
  return {
    version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    funnel: {
      name: funnel?.name || 'Untitled',
      // we include id for reference but importer ignores it
      id: funnel?.id || null,
    },
    pages: (pages || []).map(p => ({
      title: p.title || '',
      html: p.html || '',
      slug: p.slug || null,
      published: !!p.published,
      position: typeof p.position === 'number' ? p.position : null,
    })),
    assets, // optional future use (storage paths)
  };
}

export function validateImportJson(json) {
  if (!json || typeof json !== 'object') throw new Error('Not JSON.');
  if (json.version !== EXPORT_VERSION) {
    throw new Error(`Unsupported version ${json.version}. Expected ${EXPORT_VERSION}.`);
  }
  if (!json.funnel || !json.funnel.name) throw new Error('Missing funnel.name.');
  if (!Array.isArray(json.pages)) throw new Error('Missing pages[].');
  // Light sanity checks
  json.pages.forEach((p, i) => {
    if (typeof p.html !== 'string') throw new Error(`pages[${i}].html is required.`);
  });
  return true;
}

export function slugify(input) {
  if (!input) return '';
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60);
}
