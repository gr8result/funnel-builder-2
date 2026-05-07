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
  const res = await fetch(`${getPinterestApiBase()}/v5/boards?page_size=1`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(pinterestErrorMessage(data, 'Pinterest board lookup failed'));
  }

  const boardId = data?.items?.[0]?.id;
  if (!boardId) {
    throw new Error('No Pinterest board found. Create at least one board before publishing.');
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