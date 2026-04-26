// /pages/api/social/cron/refresh-tokens.js
// Cron: runs daily, refreshes any social access tokens expiring within 7 days.
// Currently handles TikTok (has refresh tokens). LinkedIn tokens last 60 days
// but don't support refresh — those accounts are flagged as expiring for user action.

import { createClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "../../../../lib/social/tokenCrypto";
import { refreshTikTokToken } from "../../../../lib/social/tiktok";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const SEVEN_DAYS_FROM_NOW = () =>
  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

async function refreshTikTokAccounts() {
  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("id, user_id, account_id, access_token, token_expires_at")
    .eq("platform", "tiktok")
    .eq("is_active", true)
    .lte("token_expires_at", SEVEN_DAYS_FROM_NOW());

  if (!accounts?.length) return { refreshed: 0, failed: 0 };

  let refreshed = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      const { data: tokenRow } = await supabase
        .from("social_oauth_tokens")
        .select("*")
        .eq("user_id", account.user_id)
        .eq("platform", "tiktok")
        .eq("social_account_id", account.id)
        .maybeSingle();

      if (!tokenRow?.encrypted_refresh_token) {
        // No refresh token stored — flag account as needing re-auth
        await supabase
          .from("social_accounts")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", account.id);
        failed++;
        continue;
      }

      const refreshToken = decryptToken({
        cipherText: tokenRow.encrypted_refresh_token,
        iv: tokenRow.refresh_token_iv,
        tag: tokenRow.refresh_token_tag,
      });

      const refreshed_data = await refreshTikTokToken(refreshToken);

      const accessExp = refreshed_data.expires_in
        ? new Date(Date.now() + Number(refreshed_data.expires_in) * 1000).toISOString()
        : null;

      await supabase
        .from("social_accounts")
        .update({
          access_token: refreshed_data.access_token,
          token_expires_at: accessExp,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      if (refreshed_data.refresh_token) {
        const encrypted = encryptToken(refreshed_data.refresh_token);
        const refreshExp = refreshed_data.refresh_expires_in
          ? new Date(Date.now() + Number(refreshed_data.refresh_expires_in) * 1000).toISOString()
          : tokenRow.refresh_expires_at;

        await supabase
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

      refreshed++;
    } catch {
      failed++;
    }
  }

  return { refreshed, failed };
}

async function flagExpiringLinkedInAccounts() {
  // LinkedIn does not support silent refresh — deactivate accounts < 3 days from expiry
  // so the user sees a "reconnect" prompt next time they load the page.
  const THREE_DAYS = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: expiring } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("platform", "linkedin")
    .eq("is_active", true)
    .lte("token_expires_at", THREE_DAYS);

  if (!expiring?.length) return 0;

  await supabase
    .from("social_accounts")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in("id", expiring.map((a) => a.id));

  return expiring.length;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const tiktok = await refreshTikTokAccounts();
    const linkedInExpired = await flagExpiringLinkedInAccounts();

    return res.status(200).json({
      ok: true,
      tiktok_refreshed: tiktok.refreshed,
      tiktok_failed: tiktok.failed,
      linkedin_deactivated: linkedInExpired,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
