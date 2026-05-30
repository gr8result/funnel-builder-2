import { requireUser } from '../../../lib/social/auth';
import { listMergedSharedMediaLibrary } from '../../../lib/sharedMediaLibrary';
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  try {
    const images = await listMergedSharedMediaLibrary({ admin: auth.admin, userId: auth.user.id, limit: 2000 });
    return res.json({ ok: true, images, permissions: { canManageTemplateImages: auth.isDeveloper } });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}

export default withAuth(handler);
