import { requireUser } from '../../../lib/social/auth';
import { listMergedSharedMediaLibrary } from '../../../lib/sharedMediaLibrary';
import { withAuth } from "../../../lib/withWorkspace";

// Short-lived per-user response cache.  Avoids re-running all the expensive
// storage list + materialization logic on every page navigation.
// The upload/delete handlers call clearListLibraryCache() to bust this.
const listLibraryCache = new Map();
const CACHE_TTL_FAST_MS = 20 * 1000;  // 20 s for the fast (no email refs) path
const CACHE_TTL_FULL_MS = 60 * 1000;  // 60 s for the full path

function inferVideoMimeType(fileName = '') {
  const normalized = String(fileName || '').toLowerCase();
  if (normalized.endsWith('.webm')) return 'video/webm';
  if (normalized.endsWith('.mov')) return 'video/quicktime';
  if (normalized.endsWith('.m4v')) return 'video/x-m4v';
  return 'video/mp4';
}

function isVideoFileName(fileName = '') {
  return /\.(mp4|webm|mov|m4v)$/i.test(String(fileName || ''));
}

async function listWebsiteBuilderVideos({ admin, userId, limit = 500 }) {
  const { data, error } = await admin.storage
    .from('assets')
    .list(`${userId}/`, { limit, offset: 0, sortBy: { column: 'name', order: 'asc' } });

  if (error) return [];

  return (data || [])
    .filter((entry) => isVideoFileName(entry?.name))
    .map((entry) => {
      const path = `${userId}/${entry.name}`;
      const { data: urlData } = admin.storage.from('assets').getPublicUrl(path);
      return {
        id: `asset:${path}`,
        name: entry.name,
        type: inferVideoMimeType(entry.name),
        url: urlData?.publicUrl || '',
        src: urlData?.publicUrl || '',
        storage_path: `assets:${path}`,
      };
    })
    .filter((asset) => asset.url || asset.src);
}

export function clearListLibraryCache(userId) {
  if (userId) {
    listLibraryCache.delete(`${userId}:0`);
    listLibraryCache.delete(`${userId}:1`);
  } else {
    listLibraryCache.clear();
  }
}

async function handler(req, res) {
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

    const [images, videos] = await Promise.all([
      listMergedSharedMediaLibrary({
      admin: auth.admin,
      userId: auth.user.id,
      limit: 2000,
      includeEmailTemplateImages: includeEmailTemplateRefs,
      }),
      listWebsiteBuilderVideos({ admin: auth.admin, userId: auth.user.id }),
    ]);
    const data = { ok: true, images, videos, permissions: { canManageTemplateImages: auth.isDeveloper } };
    listLibraryCache.set(cacheKey, { ts: Date.now(), data });
    res.setHeader('X-Cache', 'MISS');
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Could not load shared media library' });
  }
}

export default withAuth(handler);
