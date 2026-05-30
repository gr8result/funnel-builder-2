function pinterestSandboxEnabled() {
  return String(process.env.PINTEREST_USE_SANDBOX || '').toLowerCase() === 'true';
}

export function getPinterestApiBase() {
  return pinterestSandboxEnabled()
    ? 'https://api-sandbox.pinterest.com'
    : 'https://api.pinterest.com';
}

function pinterestErrorMessage(data, fallback) {
  const providerMessage = data?.message || data?.error || fallback;
  if (!pinterestSandboxEnabled()) return providerMessage;
  return `${providerMessage} Reconnect Pinterest to generate a Sandbox token, then try again.`;
}

async function getDefaultPinterestBoardId(accessToken) {
  // Try with privacy_filter=ALL first; if that fails with 403/insufficient scope, fall back to public boards only
  let res = await fetch(`${getPinterestApiBase()}/v5/boards?page_size=25&privacy_filter=ALL`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // privacy_filter=ALL requires extra app approval — retry without it on scope errors
  if (!res.ok && (res.status === 403 || res.status === 401)) {
    const errData = await res.json().catch(() => ({}));
    const errMsg = String(errData?.message || errData?.error || '');
    const isScopeIssue = errMsg.toLowerCase().includes('scope') || errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('insufficient');
    if (isScopeIssue || res.status === 403) {
      res = await fetch(`${getPinterestApiBase()}/v5/boards?page_size=25`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } else {
      // Surface the actual Pinterest error so it appears in the failed post message
      const detail = errMsg || `HTTP ${res.status}`;
      if (res.status === 401 || errData?.code === 2) {
        throw new Error(`Pinterest auth failed (${detail}). Go to Platform Setup and reconnect Pinterest.`);
      }
      throw new Error(pinterestErrorMessage(errData, `Pinterest board lookup failed (${detail})`));
    }
  }

  const data = await res.json();
  if (!res.ok) {
    const detail = String(data?.message || data?.error || `HTTP ${res.status}`);
    // 401 means token expired/invalid — surface the real Pinterest error
    if (res.status === 401 || data?.code === 2 || String(data?.message || '').toLowerCase().includes('token')) {
      throw new Error(`Pinterest auth failed (${detail}). Go to Platform Setup and reconnect Pinterest.`);
    }
    throw new Error(pinterestErrorMessage(data, `Pinterest board lookup failed (${detail})`));
  }

  const boardId = data?.items?.[0]?.id;
  if (!boardId) {
    // Token may have been issued without boards:read scope — reconnect fixes this
    throw new Error('No Pinterest board found. If you have boards on Pinterest, your connection may be outdated — go to Platform Setup and reconnect Pinterest.');
  }

  return boardId;
}

export async function postToPinterest({ accessToken, text, imageUrl, link }) {
  if (!String(imageUrl || '').trim()) {
    throw new Error('Pinterest requires an image URL before publishing.');
  }

  const boardId = await getDefaultPinterestBoardId(accessToken);
  const title = String(text || '').trim().slice(0, 100) || 'New Pin';

  const res = await fetch(`${getPinterestApiBase()}/v5/pins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      board_id: boardId,
      title,
      description: String(text || '').trim(),
      link: String(link || '').trim() || undefined,
      media_source: {
        source_type: 'image_url',
        url: String(imageUrl).trim(),
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(pinterestErrorMessage(data, 'Pinterest post failed'));
  }

  return data;
}