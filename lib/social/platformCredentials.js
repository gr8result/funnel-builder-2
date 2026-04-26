// lib/social/platformCredentials.js
// Per-user platform app credentials: load from DB, fall back to env vars.
import { encryptToken, decryptToken } from "./tokenCrypto.js";

const ENV_FALLBACK = {
  meta:     { appId: () => process.env.META_APP_ID     || "", appSecret: () => process.env.META_APP_SECRET     || "" },
  tiktok:   { appId: () => process.env.TIKTOK_CLIENT_KEY || "", appSecret: () => process.env.TIKTOK_CLIENT_SECRET || "" },
  linkedin: { appId: () => process.env.LINKEDIN_CLIENT_ID || "", appSecret: () => process.env.LINKEDIN_CLIENT_SECRET || "" },
  x:        { appId: () => process.env.X_CLIENT_ID     || "", appSecret: () => process.env.X_CLIENT_SECRET     || "" },
  youtube:  { appId: () => process.env.GOOGLE_CLIENT_ID || "", appSecret: () => process.env.GOOGLE_CLIENT_SECRET || "" },
};

/**
 * Load platform credentials for a user.
 * Checks the DB first (user-configured), falls back to server env vars.
 * @returns {{ appId: string, appSecret: string } | null}
 */
export async function getPlatformCredentials(admin, userId, platform) {
  if (userId && admin) {
    try {
      const { data } = await admin
        .from("social_app_credentials")
        .select("app_id, encrypted_secret, secret_iv, secret_tag")
        .eq("user_id", userId)
        .eq("platform", platform)
        .maybeSingle();

      if (data?.app_id) {
        let appSecret = "";
        if (data.encrypted_secret && data.secret_iv && data.secret_tag) {
          try {
            appSecret = decryptToken({
              cipherText: data.encrypted_secret,
              iv: data.secret_iv,
              tag: data.secret_tag,
            });
          } catch {
            appSecret = "";
          }
        }
        return { appId: data.app_id, appSecret };
      }
    } catch {
      // fall through to env vars
    }
  }

  const fallback = ENV_FALLBACK[platform];
  if (!fallback) return null;
  return { appId: fallback.appId(), appSecret: fallback.appSecret() };
}

/**
 * Save platform credentials for a user (encrypts the secret).
 */
export async function savePlatformCredentials(admin, userId, platform, appId, appSecret) {
  let encFields = { encrypted_secret: null, secret_iv: null, secret_tag: null };
  if (appSecret && appSecret.trim()) {
    const enc = encryptToken(appSecret.trim());
    encFields = {
      encrypted_secret: enc.cipherText,
      secret_iv: enc.iv,
      secret_tag: enc.tag,
    };
  }

  const { error } = await admin.from("social_app_credentials").upsert(
    {
      user_id: userId,
      platform,
      app_id: appId.trim(),
      ...encFields,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (error) throw error;
}

/**
 * Delete platform credentials for a user.
 */
export async function deletePlatformCredentials(admin, userId, platform) {
  const { error } = await admin
    .from("social_app_credentials")
    .delete()
    .eq("user_id", userId)
    .eq("platform", platform);
  if (error) throw error;
}
