import { requireUser } from "../../../../../lib/social/auth";
import { refreshTikTokAccountAccess } from "../../../../../lib/social/tiktok";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const auth = await requireUser(req);
  if (auth.error) {
    return res.status(401).json({ ok: false, error: auth.error });
  }

  try {
    const { data: account, error: accountErr } = await auth.admin
      .from("social_accounts")
      .select("id, account_id")
      .eq("user_id", auth.user.id)
      .eq("platform", "tiktok")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .maybeSingle();

    if (accountErr || !account) {
      return res.status(404).json({ ok: false, error: "No TikTok connection found" });
    }

    await refreshTikTokAccountAccess({
      admin: auth.admin,
      userId: auth.user.id,
      socialAccountId: account.id,
    });

    return res.status(200).json({ ok: true, account_id: account.account_id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
