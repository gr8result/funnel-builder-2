// /lib/social/linkedin.js
// LinkedIn UGC Posts API publisher

async function registerAndUploadImage(accessToken, personUrn, imageUrl) {
  // Step 1: Register the upload
  const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: personUrn,
        serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
      },
    }),
  });

  const registerData = await registerRes.json();
  if (!registerRes.ok) {
    throw new Error(registerData.message || 'LinkedIn image registration failed');
  }

  const uploadUrl = registerData?.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
  const asset = registerData?.value?.asset;
  if (!uploadUrl || !asset) throw new Error('LinkedIn did not return an upload URL');

  // Step 2: Fetch the image and upload it to LinkedIn
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Could not fetch image for LinkedIn upload: ${imgRes.status}`);
  const imgBuffer = await imgRes.arrayBuffer();

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: imgBuffer,
  });

  if (!uploadRes.ok) throw new Error(`LinkedIn image upload failed: ${uploadRes.status}`);

  return asset; // e.g. "urn:li:digitalmediaAsset:..."
}

export async function postToLinkedIn({ accessToken, personUrn, text, mediaUrl }) {
  let shareMediaCategory = 'NONE';
  let media;

  if (mediaUrl && String(mediaUrl).trim()) {
    try {
      const asset = await registerAndUploadImage(accessToken, personUrn, mediaUrl.trim());
      shareMediaCategory = 'IMAGE';
      media = [{ status: 'READY', media: asset }];
    } catch {
      // If image upload fails, fall back to text-only post
      shareMediaCategory = 'NONE';
      media = undefined;
    }
  }

  const shareContent = {
    shareCommentary: { text },
    shareMediaCategory,
  };
  if (media) shareContent.media = media;

  const body = {
    author: personUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': shareContent,
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
