// POST /api/social/import-token
// Manually import a Facebook Page access token (bypasses OAuth flow).
// Used during development or when Meta App Review is pending.
// Body: { userToken: string }  — a User Access Token from Graph API Explorer
//   OR: { pageId, pageToken, pageName } — a specific Page token directly

import { requireUser } from '../../../lib/social/auth';

const GRAPH = 'https://graph.facebook.com/v21.0';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const { userToken, pageId, pageToken, pageName } = req.body || {};

  try {
    // Mode A: direct page token supplied
    if (pageId && pageToken) {
      await auth.admin.from('social_accounts').upsert(
        {
          user_id: auth.user.id,
          platform: 'facebook',
          account_id: String(pageId),
          account_name: pageName || `Page ${pageId}`,
          access_token: pageToken,
          token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // ~60 days
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,platform,account_id' }
      );
      return res.status(200).json({ ok: true, imported: [{ id: pageId, name: pageName || pageId }] });
    }

    // Mode B: user token — fetch pages automatically
    if (!userToken) return res.status(400).json({ ok: false, error: 'Provide userToken or pageId+pageToken' });

    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,name}&access_token=${encodeURIComponent(userToken)}`
    );
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
      return res.status(400).json({ ok: false, error: pagesData.error.message || 'Invalid token' });
    }

    const pages = pagesData.data || [];
    if (!pages.length) return res.status(200).json({ ok: true, imported: [], message: 'No pages found for this token' });

    const exp = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const imported = [];

    for (const page of pages) {
      await auth.admin.from('social_accounts').upsert(
        {
          user_id: auth.user.id,
          platform: 'facebook',
          account_id: String(page.id),
          account_name: page.name || 'Facebook Page',
          access_token: page.access_token,
          token_expires_at: exp,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,platform,account_id' }
      );
      imported.push({ id: page.id, name: page.name });

      if (page.instagram_business_account?.id) {
        await auth.admin.from('social_accounts').upsert(
          {
            user_id: auth.user.id,
            platform: 'instagram',
            account_id: String(page.instagram_business_account.id),
            account_name: page.instagram_business_account.name || page.name || 'Instagram',
            access_token: page.access_token,
            token_expires_at: exp,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,platform,account_id' }
        );
        imported.push({ id: page.instagram_business_account.id, name: page.instagram_business_account.name || 'Instagram' });
      }
    }

    return res.status(200).json({ ok: true, imported });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
