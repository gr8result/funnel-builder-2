// /lib/social/linkedin.js
// LinkedIn UGC Posts API publisher

export async function postToLinkedIn({ accessToken, personUrn, text, mediaUrl }) {
  // LinkedIn does not support image-only posts outside of the Assets API upload flow.
  // For now we always post as a text share (NONE media category).
  const body = {
    author: personUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.message ||
      (data.serviceErrorCode ? `LinkedIn error ${data.serviceErrorCode}` : null) ||
      'LinkedIn post failed'
    );
  }

  return data;
}
