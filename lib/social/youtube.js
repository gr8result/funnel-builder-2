import { decryptToken, encryptToken } from "./tokenCrypto.js";
import { getPlatformCredentials } from "./platformCredentials.js";

const YOUTUBE_UPLOAD_INIT_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function buildVideoTitle(text) {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  return (normalized || "GR8 Result Video").slice(0, 100);
}

function buildVideoDescription(text) {
  return String(text || "").trim().slice(0, 5000);
}

async function fetchVideoSource(videoUrl) {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Failed to download video (${response.status})`);
  }

  const mimeType = response.headers.get("content-type") || "video/mp4";
  const arrayBuffer = await response.arrayBuffer();

  return {
    mimeType,
    buffer: Buffer.from(arrayBuffer),
  };
}

async function loadRefreshToken(admin, userId, socialAccountId) {
  const { data, error } = await admin
    .from("social_oauth_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", "youtube")
    .eq("social_account_id", socialAccountId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.encrypted_refresh_token) {
    throw new Error("YouTube refresh token is missing. Reconnect YouTube and try again.");
  }

  return {
    tokenRow: data,
    refreshToken: decryptToken({
      cipherText: data.encrypted_refresh_token,
      iv: data.refresh_token_iv,
      tag: data.refresh_token_tag,
    }),
  };
}

async function refreshYouTubeAccessToken({ admin, userId, socialAccountId }) {
  const creds = await getPlatformCredentials(admin, userId, "youtube");
  if (!creds?.appId || !creds?.appSecret) {
    throw new Error("Google/YouTube credentials are not configured.");
  }

  const { tokenRow, refreshToken } = await loadRefreshToken(admin, userId, socialAccountId);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.appId,
      client_secret: creds.appSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || "YouTube token refresh failed");
  }

  const tokenExpiresAt = data.expires_in
    ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString()
    : null;

  await admin
    .from("social_accounts")
    .update({
      access_token: data.access_token,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", socialAccountId);

  if (data.refresh_token) {
    const encrypted = encryptToken(data.refresh_token);
    await admin
      .from("social_oauth_tokens")
      .update({
        encrypted_refresh_token: encrypted.cipherText,
        refresh_token_iv: encrypted.iv,
        refresh_token_tag: encrypted.tag,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tokenRow.id);
  }

  return {
    accessToken: data.access_token,
    tokenExpiresAt,
  };
}

async function ensureYouTubeAccessToken({ admin, userId, socialAccountId, accessToken, tokenExpiresAt }) {
  if (!accessToken) {
    return refreshYouTubeAccessToken({ admin, userId, socialAccountId });
  }

  if (!tokenExpiresAt) {
    return { accessToken, tokenExpiresAt: null };
  }

  const expiresAtMs = new Date(tokenExpiresAt).getTime();
  if (Number.isNaN(expiresAtMs) || expiresAtMs > Date.now() + 60 * 1000) {
    return { accessToken, tokenExpiresAt };
  }

  return refreshYouTubeAccessToken({ admin, userId, socialAccountId });
}

async function initResumableUpload({ accessToken, title, description, mimeType, contentLength }) {
  const response = await fetch(YOUTUBE_UPLOAD_INIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(contentLength),
    },
    body: JSON.stringify({
      snippet: {
        title,
        description,
        categoryId: "22",
      },
      status: {
        privacyStatus: "public",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to initialize YouTube upload");
  }

  const uploadUrl = response.headers.get("location");
  if (!uploadUrl) {
    throw new Error("YouTube upload URL was not returned");
  }

  return uploadUrl;
}

async function performUpload({ uploadUrl, accessToken, mimeType, buffer }) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": mimeType,
      "Content-Length": String(buffer.length),
    },
    body: buffer,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id) {
    throw new Error(data?.error?.message || "YouTube upload failed");
  }

  return data;
}

export async function postToYouTube({ admin, userId, socialAccountId, accessToken, tokenExpiresAt, text, videoUrl }) {
  if (!videoUrl) {
    throw new Error("YouTube requires a video file.");
  }

  const { accessToken: liveAccessToken } = await ensureYouTubeAccessToken({
    admin,
    userId,
    socialAccountId,
    accessToken,
    tokenExpiresAt,
  });

  const { mimeType, buffer } = await fetchVideoSource(videoUrl);
  const title = buildVideoTitle(text);
  const description = buildVideoDescription(text);

  let currentAccessToken = liveAccessToken;

  const runUpload = async () => {
    const uploadUrl = await initResumableUpload({
      accessToken: currentAccessToken,
      title,
      description,
      mimeType,
      contentLength: buffer.length,
    });

    return performUpload({
      uploadUrl,
      accessToken: currentAccessToken,
      mimeType,
      buffer,
    });
  };

  try {
    return await runUpload();
  } catch (error) {
    const message = String(error?.message || "");
    if (!/401|403|unauthorized|invalid credentials/i.test(message)) {
      throw error;
    }

    const refreshed = await refreshYouTubeAccessToken({ admin, userId, socialAccountId });
    currentAccessToken = refreshed.accessToken;
    return runUpload();
  }
}
