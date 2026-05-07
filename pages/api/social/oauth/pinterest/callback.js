import { createSupabaseAdmin } from '../../../../../lib/social/auth';
import { getPlatformCredentials } from '../../../../../lib/social/platformCredentials';

async function saveSocialAccount(admin, payload) {
  const match = {
    user_id: payload.user_id,
    platform: payload.platform,
    account_id: payload.account_id,
  };

  const { data: existing, error: lookupError } = await admin
    .from('social_accounts')
    .select('id')
    .match(match)
    .limit(1);

  if (lookupError) {
    throw new Error(`Failed checking existing ${payload.platform} connection: ${lookupError.message}`);
  }

  if (existing?.length) {
    const { error: updateError } = await admin
      .from('social_accounts')
      .update(payload)
      .match(match);

    if (updateError) {
      throw new Error(`Failed updating ${payload.platform} connection: ${updateError.message}`);
    }

    return;
  }

  const { error: insertError } = await admin
    .from('social_accounts')
    .insert(payload);

  if (insertError) {
    throw new Error(`Failed creating ${payload.platform} connection: ${insertError.message}`);
  }
}

function getRequestOrigin(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return `${proto || (String(host).includes('localhost') ? 'http' : 'https')}://${host}`;
}

function getCanonicalAppOrigin(req) {
  const explicitBase = process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (explicitBase) {
    try {
      return new URL(explicitBase).origin;
    } catch {
      return explicitBase.replace(/\/$/, '');
    }
  }
  return getRequestOrigin(req);
}

function getPinterestRedirectUri(req) {
  return process.env.PINTEREST_OAUTH_REDIRECT_URI || `${getCanonicalAppOrigin(req)}/api/social/oauth/pinterest/callback`;
}

function doneRedirectUrl(req, path, status, message) {
  const site = getRequestOrigin(req);
  const redirect = new URL(path || '/modules/social_media/setup', site);
  redirect.searchParams.set('connect', status);
  if (message) redirect.searchParams.set('message', message);
  return redirect.toString();
}

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;
  const admin = createSupabaseAdmin();

  if (error || error_description) {
    return res.redirect(doneRedirectUrl(req, '/modules/social_media/setup', 'error', error_description || error));
  }

  if (!code || !state) {
    return res.redirect(doneRedirectUrl(req, '/modules/social_media/setup', 'error', 'Missing OAuth code/state'));
  }

  const { data: oauthState, error: stateErr } = await admin
    .from('social_oauth_states')
    .select('*')
    .eq('state', state)
    .eq('platform', 'pinterest')
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (stateErr || !oauthState) {
    return res.redirect(doneRedirectUrl(req, '/modules/social_media/setup', 'error', 'OAuth state expired or invalid'));
  }

  try {
    const creds = await getPlatformCredentials(admin, oauthState.user_id, 'pinterest');
    if (!creds?.appId) throw new Error('Pinterest credentials not configured.');
    if (!creds?.appSecret) throw new Error('Pinterest App Secret not configured. Open Platform Setup to add your credentials.');

    const basicAuth = Buffer.from(`${creds.appId}:${creds.appSecret}`).toString('base64');
    const tokenRes = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: getPinterestRedirectUri(req),
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.message || tokenData.error || 'Pinterest token exchange failed');
    }

    const profileRes = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    if (!profileRes.ok) {
      throw new Error(profile.message || profile.error || 'Pinterest user lookup failed');
    }

    const username = profile.username || profile.account?.username || '';
    const accountId = String(profile.id || username || profile.account_type || Date.now());
    const accountName = profile.profile_name || profile.business_name || username || 'Pinterest Account';
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : null;

    await saveSocialAccount(admin, {
      user_id: oauthState.user_id,
      platform: 'pinterest',
      account_id: accountId,
      account_name: accountName,
      access_token: tokenData.access_token,
      token_expires_at: expiresAt,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    await admin
      .from('social_oauth_states')
      .update({ used_at: new Date().toISOString() })
      .eq('id', oauthState.id);

    return res.redirect(doneRedirectUrl(req, oauthState.redirect_path, 'ok', `Pinterest connected as ${accountName}`));
  } catch (err) {
    return res.redirect(doneRedirectUrl(req, oauthState?.redirect_path || '/modules/social_media/setup', 'error', err.message || 'Pinterest connection failed'));
  }
}