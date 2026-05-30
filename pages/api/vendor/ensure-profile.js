import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { ensureVendorProfileFromAgreement } from '../../../lib/vendorProfile';
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = String(req.headers.authorization || '').trim();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await ensureVendorProfileFromAgreement({
      supabaseAdmin,
      authUserId: userData.user.id,
      email: userData.user.email || '',
    });

    if (!result.vendor) {
      return res.status(500).json({
        error: 'Failed to establish vendor profile.',
        reason: result.reason,
      });
    }

    return res.status(200).json({
      ok: true,
      recovered: result.recovered,
      reason: result.reason,
      vendor: result.vendor,
    });
  } catch (error) {
    console.error('ensure-profile error', error);
    const message = String(error?.message || 'Unknown error');
    const code = String(error?.code || 'unknown_error');
    const hint = String(error?.hint || '');

    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({
        error: 'Failed to ensure vendor profile',
        details: { code, message, hint },
      });
    }

    return res.status(500).json({ error: 'Failed to ensure vendor profile' });
  }
}

export default withAuth(handler);
