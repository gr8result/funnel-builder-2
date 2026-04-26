import { requireUser } from "../../../lib/social/auth";

export default async function handler(req, res) {
  const auth = await requireUser(req);
  if (auth.error) {
    return res.status(401).json({ ok: false, error: auth.error });
  }

  if (req.method === "GET") {
    const { data, error } = await auth.admin
      .from("social_accounts")
      .select("id, platform, account_id, account_name, is_active, token_expires_at, updated_at")
      .eq("user_id", auth.user.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false });

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true, connections: data || [] });
  }

  if (req.method === "DELETE") {
    const platform = String(req.query.platform || req.body?.platform || "").trim().toLowerCase();
    if (!platform) {
      return res.status(400).json({ ok: false, error: "Missing platform" });
    }

    const { error } = await auth.admin
      .from("social_accounts")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", auth.user.id)
      .eq("platform", platform);

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
