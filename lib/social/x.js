// /lib/social/x.js
// X (Twitter) v2 API publisher

export async function postToX({ accessToken, text }) {
  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || data.title || 'X post failed');
  }

  return data;
}
