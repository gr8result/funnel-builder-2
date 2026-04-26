// /lib/social/facebook.js
// FULL FILE — Meta posting helper

export async function postToFacebook({ pageId, accessToken, message }) {
  const url = `https://graph.facebook.com/v21.0/${pageId}/feed`;

  const res = await fetch(url, {
    method: "POST",
    body: new URLSearchParams({
      message,
      access_token: accessToken,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || "Facebook post failed");
  }

  return data;
}

export async function postToInstagram({
  igUserId,
  accessToken,
  caption,
  imageUrl,
}) {
  // STEP 1: create media container
  const createRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media`,
    {
      method: "POST",
      body: new URLSearchParams({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      }),
    }
  );

  const createData = await createRes.json();

  if (!createRes.ok) {
    throw new Error(createData.error?.message || "IG media create failed");
  }

  // STEP 2: publish
  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
    {
      method: "POST",
      body: new URLSearchParams({
        creation_id: createData.id,
        access_token: accessToken,
      }),
    }
  );

  const publishData = await publishRes.json();

  if (!publishRes.ok) {
    throw new Error(publishData.error?.message || "IG publish failed");
  }

  return publishData;
}