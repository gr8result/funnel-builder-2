import { requireUser } from '../../../lib/social/auth';
import { listMergedSharedMediaLibrary } from '../../../lib/sharedMediaLibrary';

// Short-lived per-user response cache.  Avoids re-running all the expensive
// storage list + materialization logic on every page navigation.
// The upload/delete handlers call clearListLibraryCache() to bust this.
const listLibraryCache = new Map();
const CACHE_TTL_FAST_MS = 20 * 1000;  // 20 s for the fast (no email refs) path
const CACHE_TTL_FULL_MS = 60 * 1000;  // 60 s for the full path

export function clearListLibraryCache(userId) {
  if (userId) {
    listLibraryCache.delete(`${userId}:0`);
    listLibraryCache.delete(`${userId}:1`);
  } else {
    listLibraryCache.clear();
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  try {
    const includeEmailTemplateRefs = !['0', 'false', 'no'].includes(String(req.query?.includeEmailTemplateRefs || '1').toLowerCase());
    const noCache = req.query?.noCache === '1';
    const cacheKey = `${auth.user.id}:${includeEmailTemplateRefs ? '1' : '0'}`;
    const ttl = includeEmailTemplateRefs ? CACHE_TTL_FULL_MS : CACHE_TTL_FAST_MS;

    if (!noCache) {
      const cached = listLibraryCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < ttl) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached.data);
      }
    }

    const images = await listMergedSharedMediaLibrary({
      admin: auth.admin,
      userId: auth.user.id,
      limit: 2000,
      includeEmailTemplateImages: includeEmailTemplateRefs,
    });
    const data = { ok: true, images, permissions: { canManageTemplateImages: auth.isDeveloper } };
    listLibraryCache.set(cacheKey, { ts: Date.now(), data });
    res.setHeader('X-Cache', 'MISS');
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Could not load shared media library' });
  }
}