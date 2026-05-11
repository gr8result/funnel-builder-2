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
  // Try public boards first, then include secret/protected boards
  const res = await fetch(`${getPinterestApiBase()}/v5/boards?page_size=25&privacy_filter=ALL`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    // 401 means token expired — give a clear reconnect message
    if (res.status === 401 || data?.code === 2 || String(data?.message || '').toLowerCase().includes('token')) {
      throw new Error('Pinterest token expired. Go to Platform Setup and reconnect Pinterest to continue posting.');
    }
    throw new Error(pinterestErrorMessage(data, 'Pinterest board lookup failed'));
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