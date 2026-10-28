export function brandingAssetReference(value, defaultBucket = 'Private-assets') {
  let current = value;
  if (typeof current === 'string' && current.trim().startsWith('{')) {
    try { current = JSON.parse(current); } catch { return null; }
  }
  if (current && typeof current === 'object') {
    defaultBucket = current.bucket || current.storage_bucket || defaultBucket;
    current = current.url || current.src || current.storage_path || '';
  }
  const raw = String(current || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const match = url.pathname.match(/^\/storage\/v1\/object\/(public|sign|authenticated)\/([^/]+)\/(.+)$/);
      return match ? { bucket: decodeURIComponent(match[2]), path: decodeURIComponent(match[3]), public: match[1] === 'public' } : { url: url.href };
    } catch { return null; }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  const path = raw.replace(/\\/g, '/').replace(/^\/+/, '');
  const known = path.match(/^(Private-assets|private-assets|public-assets|assets)\/(.+)$/);
  return { bucket: known?.[1] || defaultBucket, path: known?.[2] || path, public: ['assets', 'public-assets'].includes(known?.[1] || defaultBucket) };
}

export async function resolveBusinessBrandingAsset(storage, value, defaultBucket) {
  const reference = brandingAssetReference(value, defaultBucket);
  if (!reference) return '';
  if (reference.url) return reference.url;
  if (reference.path.split('/').some((part) => part === '..')) return '';
  const bucket = storage.from(reference.bucket);
  if (reference.public) return bucket.getPublicUrl(reference.path).data?.publicUrl || '';
  const { data, error } = await bucket.createSignedUrl(reference.path, 3600);
  return error ? '' : data?.signedUrl || '';
}

export function addBusinessBrandingHeader(html, brand = {}) {
  const reference = brandingAssetReference(brand.logoUrl);
  if (!reference || (!reference.public && !reference.url)) return html;
  const logo = String(brand.logoUrl || '').trim();
  if (!/^https:\/\//i.test(logo)) return html;
  const escape = (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const name = escape(brand.businessName || brand.name || 'Company');
  return `<header data-gr8-company-branding="true" style="padding:20px 24px;background:#fff;display:flex;align-items:center;gap:16px;flex-wrap:wrap"><img src="${escape(logo)}" alt="${name} logo" style="max-width:200px;max-height:80px;object-fit:contain"><span style="font-size:18px;font-weight:600;color:#161c28">${name}</span></header>${html}`;
}