export const BAD_SHARED_LIBRARY_HASHES = new Set([
  '4388792057fb681774bb6e1f4e97a50208241b7fe66a58f0117cb36fc20c96df',
  '860908d39ccee3bcba61f66e9ac45fc353d59a7505f50705f35852bc1ee6d17e',
]);

const BAD_SHARED_LIBRARY_HASH_PREFIXES = new Set(
  [...BAD_SHARED_LIBRARY_HASHES].map((hash) => hash.slice(0, 20))
);

export function extractSharedMediaHash(...values) {
  for (const value of values) {
    const filename = String(value || '').split('?')[0].split('/').pop() || '';
    const basename = filename.replace(/\.[a-z0-9]{2,5}$/i, '');
    const segments = basename.split(/[^a-f0-9]+/i).filter(Boolean);
    const match = [...segments].reverse().find((segment) => segment.length === 64 || segment.length === 20);
    if (match) return match.toLowerCase();
  }
  return '';
}

export function isBlockedSharedMediaHash(hash = '') {
  const normalized = String(hash || '').trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.length >= 64) return BAD_SHARED_LIBRARY_HASHES.has(normalized);
  if (normalized.length === 20) return BAD_SHARED_LIBRARY_HASH_PREFIXES.has(normalized);
  return [...BAD_SHARED_LIBRARY_HASHES].some((blockedHash) => blockedHash.startsWith(normalized));
}

export function isPlaceholderSvgBuffer(buffer, contentType = '') {
  const type = String(contentType || '').toLowerCase();
  if (!type.includes('svg')) return false;
  const text = String(buffer?.toString('utf8') || '');
  return text.includes('960 x 720') || text.includes('Feature 1') || text.includes('Feature 2') || text.includes('Feature 3');
}