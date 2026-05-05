import { requireUser } from '../../../../../lib/social/auth';
import { getPlatformCredentials } from '../../../../../lib/social/platformCredentials';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const auth = await requireUser(req);
  if (auth.error) {
    return res.status(401).json({ ok: false, error: auth.error });
  }

  const creds = await getPlatformCredentials(auth.admin, auth.user.id, 'pinterest');
  if (!creds?.appId) {
    return res.status(400).json({ ok: false, error: 'Pinterest App ID not configured. Open Platform Setup to add your credentials.' });
  }

  return res.status(501).json({
    ok: false,
    error: 'Pinterest has been added to settings, but OAuth is not implemented yet in this build.',
  });
}