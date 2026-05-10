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
    throw new Error('TikTok connection is missing publish permission. Reconnect TikTok and approve posting access.');
  }

  if (!res.ok || (data?.error?.code && data.error.code !== 'ok')) {
    throw new Error(data?.error?.message || fallbackMessage);
  }
}

async function queryTikTokCreatorInfo(accessToken) {
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
    disable_comment: creatorInfo?.comment_disabled ? true : true,
    disable_duet: creatorInfo?.duet_disabled ? true : true,
    disable_stitch: creatorInfo?.stitch_disabled ? true : true,
  };
}

async function initializeTikTokVideoUpload({ accessToken, text, videoSize }) {
  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
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

async function initializeTikTokInboxUpload({ accessToken, videoSize }) {
  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    }),
  });

  const data = await res.json();
  ensureTikTokOk(res, data, 'TikTok inbox upload initialization failed');
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
    let initData;
    try {
      initData = await initializeTikTokVideoUpload({
        accessToken,
        text,
        videoSize: videoBuffer.byteLength,
      });
    } catch (error) {
      if (/integration guidelines/i.test(String(error?.message || ''))) {
        initData = await initializeTikTokInboxUpload({
          accessToken,
          videoSize: videoBuffer.byteLength,
        });
      } else {
        throw error;
      }
    }

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
  };
}

export async function refreshTikTokToken(refreshToken) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

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
