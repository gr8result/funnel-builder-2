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

async function initializeTikTokVideoUpload({ accessToken, text, videoSize }) {
  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      post_info: {
        title: String(text || '').slice(0, 150),
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    }),
  });

  const data = await res.json();

  if (data?.error?.code === 'scope_not_authorized' || /required scope/i.test(String(data?.error?.message || ''))) {
    throw new Error('TikTok connection is missing publish permission. Reconnect TikTok and approve posting access.');
  }

  if (!res.ok || (data?.error?.code && data.error.code !== 'ok')) {
    throw new Error(data?.error?.message || 'TikTok video initialization failed');
  }

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

// Post either a video post or a text-only post via TikTok Content Posting API (Direct Post)
export async function postToTikTok({ accessToken, text, videoUrl = null }) {
  if (videoUrl) {
    const sourceRes = await fetch(videoUrl);
    if (!sourceRes.ok) {
      throw new Error('Could not download TikTok video for upload');
    }

    const videoBuffer = Buffer.from(await sourceRes.arrayBuffer());
    const contentType = sourceRes.headers.get('content-type') || 'video/mp4';
    const initData = await initializeTikTokVideoUpload({
      accessToken,
      text,
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
    };
  }

  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/text/init/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
        post_info: {
          title: String(text || '').slice(0, 150),
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        post_mode: 'DIRECT_POST',
        media_type: 'TEXT',
      }),
  });

  const data = await res.json();

  if (data?.error?.code === 'scope_not_authorized' || /required scope/i.test(String(data?.error?.message || ''))) {
    throw new Error('TikTok connection is missing publish permission. Reconnect TikTok and approve posting access.');
  }

  if (!res.ok || (data?.error?.code && data.error.code !== 'ok')) {
    throw new Error(data?.error?.message || 'TikTok post failed');
  }

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
