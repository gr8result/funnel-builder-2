import { requireUser } from '../../../lib/social/auth';
import { listMergedSharedMediaLibrary } from '../../../lib/sharedMediaLibrary';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  try {
    const includeEmailTemplateRefs = !['0', 'false', 'no'].includes(String(req.query?.includeEmailTemplateRefs || '1').toLowerCase());
    const images = await listMergedSharedMediaLibrary({
      admin: auth.admin,
      userId: auth.user.id,
      limit: 2000,
      includeEmailTemplateImages: includeEmailTemplateRefs,
    });
    return res.json({ ok: true, images, permissions: { canManageTemplateImages: auth.isDeveloper } });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Could not load shared media library' });
  }
}