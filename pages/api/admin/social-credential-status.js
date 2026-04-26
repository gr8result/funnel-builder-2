// pages/api/admin/social-credential-status.js
// Returns which social platforms have app credentials configured (env vars or DB).
// Never returns the actual secrets — only a boolean "configured" per platform.

import { requireUser } from '../../../lib/social/auth';
import { getPlatformCredentials } from '../../../lib/social/platformCredentials';

const PLATFORMS = ['meta', 'tiktok', 'linkedin', 'x', 'youtube'];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const status = {};
  for (const platform of PLATFORMS) {
    const creds = await getPlatformCredentials(auth.admin, auth.user.id, platform);
    status[platform] = { configured: !!(creds?.appId) };
  }

  return res.status(200).json({ ok: true, status });
}
