// /pages/api/social/bot-subscribe-page.js
// Subscribes a Facebook Page to the app's webhook so it receives feed/message events.
// Must be called once per page after the webhook is registered in Meta App Dashboard.
// POST { pageId }

import { requireUser } from '../../../lib/social/auth';
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const { pageId } = req.body || {};
  if (!pageId) return res.status(400).json({ ok: false, error: 'Missing pageId' });

  // Get the page access token from social_accounts
  const { data: account, error: accErr } = await auth.admin
    .from('social_accounts')
    .select('access_token, account_name')
    .eq('user_id', auth.user.id)
    .eq('account_id', pageId)
    .eq('platform', 'facebook')
    .eq('is_active', true)
    .maybeSingle();

  if (accErr || !account) {
    return res.status(404).json({ ok: false, error: 'Facebook page not found. Make sure it is connected in Account Setup.' });
  }

  try {
    const graphRes = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps`,
      {
        method: 'POST',
        body: new URLSearchParams({
          subscribed_fields: 'feed,messages,mention',
          access_token: account.access_token,
        }),
      }
    );
    const data = await graphRes.json();

    if (!graphRes.ok || data.error) {
      throw new Error(data.error?.message || 'Page subscription failed');
    }

    return res.status(200).json({ ok: true, page: account.account_name });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default withAuth(handler);
