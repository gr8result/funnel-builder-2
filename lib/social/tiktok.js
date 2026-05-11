import { decryptToken, encryptToken } from './tokenCrypto';
import { getPlatformCredentials } from './platformCredentials';

const TIKTOK_DIRECT_POST_SCOPE = 'video.publish';

export function parseTikTokScopes(scopeValue) {
  return String(scopeValue || '')
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function hasTikTokPostingScope(scopeValue) {
  const granted = new Set(parseTikTokScopes(scopeValue));
  return granted.has(TIKTOK_DIRECT_POST_SCOPE);
}

export function assertTikTokPostingScope(scopeValue) {
  if (!scopeValue || hasTikTokPostingScope(scopeValue)) return;

  const error = new Error('TikTok did not grant direct posting access. Reconnect TikTok and approve video publishing access.');
  error.code = 'scope_not_authorized';
  throw error;
}

export async function exchangeTikTokCode({ code, redirectUri }) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    throw new Error("TikTok OAuth env vars are missing");
  }

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();
  if (!res.ok || data?.error) {
    throw new Error(data?.error_description || data?.error?.message || "TikTok token exchange failed");
  }

  return data;
}

function ensureTikTokOk(res, data, fallbackMessage) {
  if (data?.error?.code === 'scope_not_authorized' || /required scope/i.test(String(data?.error?.message || ''))) {
    const error = new Error('TikTok connection is missing direct posting permission. Reconnect TikTok and approve video publishing access.');
    error.code = 'scope_not_authorized';
    throw error;
  }

  if (data?.error?.code === 'unaudited_client_can_only_post_to_private_accounts') {
    const error = new Error('TikTok is still treating this as an unaudited direct-post attempt. Make the connected TikTok account private, remove/reconnect the TikTok permission after changing privacy, and confirm this TikTok user is added as a tester in TikTok Developer Center.');
    error.code = data?.error?.code;
    throw error;
  }

  const normalizedCode = String(data?.error?.code || '').toLowerCase();
  const normalizedMessage = String(data?.error?.message || '').toLowerCase();
  const hasAccessTokenFailure = res?.status === 401
    || normalizedCode === 'access_token_invalid'
    || normalizedCode === 'invalid_access_token'
    || normalizedCode === 'access_token_expired'
    || /access token/.test(normalizedMessage)
    || /token expired/.test(normalizedMessage)
    || /invalid token/.test(normalizedMessage);

  if (hasAccessTokenFailure) {
    const error = new Error('TikTok access token expired or is invalid.');
    error.code = 'access_token_invalid';
    throw error;
  }

  if (!res.ok || (data?.error?.code && data.error.code !== 'ok')) {
    const error = new Error(data?.error?.message || fallbackMessage);
    error.code = data?.error?.code || null;
    throw error;
  }
}

export async function queryTikTokCreatorInfo(accessToken) {
  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json();
  ensureTikTokOk(res, data, 'TikTok creator info lookup failed');
  return data?.data || null;
}

function getPreferredTikTokPrivacyLevel(options) {
  const normalized = Array.isArray(options)
    ? options.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  if (normalized.includes('SELF_ONLY')) return 'SELF_ONLY';
  if (normalized.length) return normalized[0];
  return 'SELF_ONLY';
}

function buildTikTokTitle(text) {
  const raw = String(text || '');
  const withoutUrls = raw.replace(/https?:\/\/\S+/gi, ' ');
  const withoutPhones = withoutUrls.replace(/\+?\d[\d\s().-]{7,}\d/g, ' ');
  const lines = withoutPhones
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(learn more|quick form|call\/text|website)\s*:/i.test(line))
    .filter((line) => !/^[-–—]+$/.test(line));

  const collapsed = lines.join(' ')
    .replace(/#(fitnessgoals|healthyliving|activewear|sportsnutrition|workoutmotivation|aimarketing|aiforbusiness|proteinpowder|healthandfitness|sample)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const hashtags = (collapsed.match(/#[\p{L}\p{N}_]+/gu) || []).slice(0, 3).join(' ');
  const plain = collapsed.replace(/#[\p{L}\p{N}_]+/gu, ' ').replace(/\s{2,}/g, ' ').trim();
  const sentence = plain.slice(0, 110).trim();
  const title = [sentence, hashtags].filter(Boolean).join(' ').trim();
  return (title || 'New video').slice(0, 150);
}

function buildTikTokPostInfo(text, creatorInfo) {
  return {
    title: buildTikTokTitle(text),
    privacy_level: getPreferredTikTokPrivacyLevel(creatorInfo?.privacy_level_options),
    disable_comment: !!creatorInfo?.comment_disabled,
    disable_duet: !!creatorInfo?.duet_disabled,
    disable_stitch: !!creatorInfo?.stitch_disabled,
  };
}

async function initializeTikTokVideoUpload({ accessToken, postInfo, videoSize }) {
  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      post_info: postInfo,
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    }),
  });

  const data = await res.json();
  ensureTikTokOk(res, data, 'TikTok video initialization failed');
  return data?.data || {};
}

async function uploadVideoToTikTok({ uploadUrl, videoBuffer, contentType }) {
  const size = videoBuffer.byteLength;
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(size),
      'Content-Range': `bytes 0-${size - 1}/${size}`,
    },
    body: videoBuffer,
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text().catch(() => '');
    throw new Error(errorText || 'TikTok video upload failed');
  }
}

export async function postToTikTok({ accessToken, text, videoUrl = null }) {
  if (videoUrl) {
    const sourceRes = await fetch(videoUrl);
    if (!sourceRes.ok) {
      throw new Error('Could not download TikTok video for upload');
    }

    const videoBuffer = Buffer.from(await sourceRes.arrayBuffer());
    const contentType = sourceRes.headers.get('content-type') || 'video/mp4';
    const creatorInfo = await queryTikTokCreatorInfo(accessToken);
    const initData = await initializeTikTokVideoUpload({
      accessToken,
      postInfo: buildTikTokPostInfo(text, creatorInfo),
      videoSize: videoBuffer.byteLength,
    });

    if (!initData?.upload_url) {
      throw new Error('TikTok did not return an upload URL');
    }

    await uploadVideoToTikTok({
      uploadUrl: initData.upload_url,
      videoBuffer,
      contentType,
    });

    return {
      id: initData.publish_id || null,
      publish_id: initData.publish_id || null,
      mode: 'direct_post',
    };
  }

  const creatorInfo = await queryTikTokCreatorInfo(accessToken);
  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/text/init/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      post_info: buildTikTokPostInfo(text, creatorInfo),
      post_mode: 'DIRECT_POST',
      media_type: 'TEXT',
    }),
  });

  const data = await res.json();
  ensureTikTokOk(res, data, 'TikTok post failed');

  return {
    id: data?.data?.publish_id || null,
    publish_id: data?.data?.publish_id || null,
    mode: 'direct_post',
  };
}

export async function refreshTikTokToken(refreshToken, creds = null) {
  const clientKey = creds?.appId || creds?.clientKey || process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = creds?.appSecret || creds?.clientSecret || process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    throw new Error("TikTok OAuth env vars are missing");
  }

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();
  if (!res.ok || data?.error) {
    throw new Error(data?.error_description || data?.error?.message || "TikTok token refresh failed");
  }

  return data;
}

async function loadTikTokRefreshTokenRow({ admin, userId, socialAccountId }) {
  const { data: exactTokenRow, error: exactTokenErr } = await admin
    .from('social_oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', 'tiktok')
    .eq('social_account_id', socialAccountId)
    .maybeSingle();

  if (exactTokenErr) {
    throw new Error(exactTokenErr.message || 'Failed loading TikTok refresh token');
  }

  if (exactTokenRow?.encrypted_refresh_token) {
    return exactTokenRow;
  }

  const { data: fallbackRows, error: fallbackErr } = await admin
    .from('social_oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', 'tiktok')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (fallbackErr) {
    throw new Error(fallbackErr.message || 'Failed loading TikTok refresh token');
  }

  const fallbackTokenRow = (fallbackRows || []).find((row) => row?.encrypted_refresh_token);
  if (!fallbackTokenRow) {
    throw new Error('No TikTok refresh token found');
  }

  if (fallbackTokenRow.social_account_id !== socialAccountId) {
    const { error: reattachError } = await admin
      .from('social_oauth_tokens')
      .update({
        social_account_id: socialAccountId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fallbackTokenRow.id);

    if (!reattachError) {
      return {
        ...fallbackTokenRow,
        social_account_id: socialAccountId,
      };
    }
  }

  return fallbackTokenRow;
}

export async function refreshTikTokAccountAccess({ admin, userId, socialAccountId }) {
  if (!admin || !userId || !socialAccountId) {
    throw new Error('Missing TikTok refresh context');
  }

  const tokenRow = await loadTikTokRefreshTokenRow({ admin, userId, socialAccountId });

  const creds = await getPlatformCredentials(admin, userId, 'tiktok');
  if (!creds?.appId || !creds?.appSecret) {
    throw new Error('TikTok credentials not configured for token refresh');
  }

  const refreshToken = decryptToken({
    cipherText: tokenRow.encrypted_refresh_token,
    iv: tokenRow.refresh_token_iv,
    tag: tokenRow.refresh_token_tag,
  });

  const refreshed = await refreshTikTokToken(refreshToken, creds);
  await queryTikTokCreatorInfo(refreshed.access_token);

  const accessExp = refreshed.expires_in
    ? new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString()
    : null;

  const { error: accountUpdateError } = await admin
    .from('social_accounts')
    .update({
      access_token: refreshed.access_token,
      token_expires_at: accessExp,
      updated_at: new Date().toISOString(),
    })
    .eq('id', socialAccountId);

  if (accountUpdateError) {
    throw new Error(accountUpdateError.message || 'Failed updating TikTok access token');
  }

  if (refreshed.refresh_token) {
    const encrypted = encryptToken(refreshed.refresh_token);
    const refreshExp = refreshed.refresh_expires_in
      ? new Date(Date.now() + Number(refreshed.refresh_expires_in) * 1000).toISOString()
      : tokenRow.refresh_expires_at;

    const { error: tokenUpdateError } = await admin
      .from('social_oauth_tokens')
      .update({
        encrypted_refresh_token: encrypted.cipherText,
        refresh_token_iv: encrypted.iv,
        refresh_token_tag: encrypted.tag,
        refresh_expires_at: refreshExp,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokenRow.id);

    if (tokenUpdateError) {
      throw new Error(tokenUpdateError.message || 'Failed updating TikTok refresh token');
    }
  }

  return {
    accessToken: refreshed.access_token,
    tokenExpiresAt: accessExp,
  };
}
