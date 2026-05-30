// /pages/api/social/delete-campaign.js
import { requireUser } from "../../../lib/social/auth";
import { withAuth } from "../../../lib/withWorkspace";

async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const id = String(req.query.id || "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "Missing campaign id" });

  try {
    // Verify ownership before deleting
    const { data: campaign, error: fetchErr } = await auth.admin
      .from("social_campaigns")
      .select("id")
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (fetchErr || !campaign) {
      return res.status(404).json({ ok: false, error: "Campaign not found" });
    }

    // Delete post links first (FK constraint)
    await auth.admin
      .from("social_campaign_posts")
      .delete()
      .eq("campaign_id", id);

    const { error } = await auth.admin
      .from("social_campaigns")
      .delete()
      .eq("id", id)
      .eq("user_id", auth.user.id);

    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default withAuth(handler);
