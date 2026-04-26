import { requireUser } from "../../../../../lib/social/auth";
import { decryptToken, encryptToken } from "../../../../../lib/social/tokenCrypto";
import { refreshTikTokToken } from "../../../../../lib/social/tiktok";

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

    const { data: tokenRow, error: tokenErr } = await auth.admin
      .from("social_oauth_tokens")
      .select("*")
      .eq("user_id", auth.user.id)
      .eq("platform", "tiktok")
      .eq("social_account_id", account.id)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      return res.status(404).json({ ok: false, error: "No TikTok refresh token found" });
    }

    const refreshToken = decryptToken({
      cipherText: tokenRow.encrypted_refresh_token,
      iv: tokenRow.refresh_token_iv,
      tag: tokenRow.refresh_token_tag,
    });

    const refreshed = await refreshTikTokToken(refreshToken);

    const accessExp = refreshed.expires_in
      ? new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString()
      : null;

    await auth.admin
      .from("social_accounts")
      .update({
        access_token: refreshed.access_token,
        token_expires_at: accessExp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    if (refreshed.refresh_token) {
      const encrypted = encryptToken(refreshed.refresh_token);
      const refreshExp = refreshed.refresh_expires_in
        ? new Date(Date.now() + Number(refreshed.refresh_expires_in) * 1000).toISOString()
        : tokenRow.refresh_expires_at;

      await auth.admin
        .from("social_oauth_tokens")
        .update({
          encrypted_refresh_token: encrypted.cipherText,
          refresh_token_iv: encrypted.iv,
          refresh_token_tag: encrypted.tag,
          refresh_expires_at: refreshExp,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tokenRow.id);
    }

    return res.status(200).json({ ok: true, account_id: account.account_id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
