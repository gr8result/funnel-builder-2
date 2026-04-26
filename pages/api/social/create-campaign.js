// /pages/api/social/create-campaign.js
// FULL FILE — creates campaign and links posts

import { requireUser } from "../../../lib/social/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  try {
    const { name, description, post_ids } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ ok: false, error: "Campaign name is required" });
    }

    const { data: campaign, error } = await auth.admin
      .from("social_campaigns")
      .insert({
        user_id: auth.user.id,
        name: name.trim(),
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    if (Array.isArray(post_ids) && post_ids.length > 0) {
      const links = post_ids.map((id) => ({
        campaign_id: campaign.id,
        post_id: id,
      }));
      await auth.admin.from("social_campaign_posts").insert(links);
    }

    return res.status(200).json({
      ok: true,
      campaign,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}