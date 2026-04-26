// /pages/api/social/get-campaigns.js
// FULL FILE — fetch campaigns + posts

import { requireUser } from "../../../lib/social/auth";

export default async function handler(req, res) {
  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  try {
    const { data } = await auth.admin
      .from("social_campaigns")
      .select(`
        *,
        social_campaign_posts (
          post_id,
          social_posts (*)
        )
      `)
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false });

    return res.status(200).json({
      ok: true,
      campaigns: data || [],
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}