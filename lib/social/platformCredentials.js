// lib/social/platformCredentials.js
// Per-user platform app credentials: load from DB, fall back to env vars.
import { encryptToken, decryptToken } from "./tokenCrypto.js";

const ENV_FALLBACK = {
  meta:     {
    appId: () => process.env.META_APP_ID || "",
    appSecret: () => process.env.META_APP_SECRET || "",
    configId: () => process.env.META_CONFIG_ID || "",
  },
  tiktok:   { appId: () => process.env.TIKTOK_CLIENT_KEY || "", appSecret: () => process.env.TIKTOK_CLIENT_SECRET || "" },
  linkedin: { appId: () => process.env.LINKEDIN_CLIENT_ID || "", appSecret: () => process.env.LINKEDIN_CLIENT_SECRET || "" },
  pinterest:{ appId: () => process.env.PINTEREST_APP_ID || "", appSecret: () => process.env.PINTEREST_APP_SECRET || "" },
  x:        { appId: () => process.env.X_CLIENT_ID     || "", appSecret: () => process.env.X_CLIENT_SECRET     || "" },
  youtube:  { appId: () => process.env.GOOGLE_CLIENT_ID || "", appSecret: () => process.env.GOOGLE_CLIENT_SECRET || "" },
};

async function selectCredentialRow(admin, userId, platform) {
  try {
    const { data, error } = await admin
      .from("social_app_credentials")
      .select("app_id, encrypted_secret, secret_iv, secret_tag, config_id")
      .eq("user_id", userId)
      .eq("platform", platform)
      .maybeSingle();

    if (error) throw error;
    return { data, hasConfigId: true };
  } catch (error) {
    if (!String(error?.message || "").includes("config_id")) {
      throw error;
    }

    const { data, error: fallbackError } = await admin
      .from("social_app_credentials")
      .select("app_id, encrypted_secret, secret_iv, secret_tag")
      .eq("user_id", userId)
      .eq("platform", platform)
      .maybeSingle();

    if (fallbackError) throw fallbackError;
    return { data, hasConfigId: false };
  }
}

async function saveCredentialRow(admin, payload, includeConfigId) {
  const match = {
    user_id: payload.user_id,
    platform: payload.platform,
  };

  const basePayload = includeConfigId
    ? payload
    : Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "config_id"));

  const { data: existing, error: lookupError } = await admin
    .from("social_app_credentials")
    .select("id")
    .match(match)
    .limit(1);

  if (lookupError) throw lookupError;

  if (existing?.length) {
    const { error: updateError } = await admin
      .from("social_app_credentials")
      .update(basePayload)
      .match(match);

    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await admin
    .from("social_app_credentials")
    .insert(basePayload);

  if (insertError) throw insertError;
}

/**
 * Load platform credentials for a user.
 * Checks the DB first (user-configured), falls back to server env vars.
 * @returns {{ appId: string, appSecret: string, configId?: string } | null}
 */
export async function getPlatformCredentials(admin, userId, platform) {
  const fallback = ENV_FALLBACK[platform];
  if (!fallback) return null;

  if (userId && admin) {
    try {
      const { data, hasConfigId } = await selectCredentialRow(admin, userId, platform);

      if (data?.app_id) {
        const fallbackAppId = fallback.appId();
        const fallbackAppSecret = fallback.appSecret();
        const fallbackConfigId = fallback.configId ? fallback.configId() : "";
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
        return {
          appId: data.app_id || fallbackAppId,
          appSecret: appSecret || fallbackAppSecret,
          configId: hasConfigId ? data.config_id || fallbackConfigId : fallbackConfigId,
        };
      }
    } catch {
      // fall through to env vars
    }
  }

  return {
    appId: fallback.appId(),
    appSecret: fallback.appSecret(),
    configId: fallback.configId ? fallback.configId() : "",
  };
}

/**
 * Save platform credentials for a user (encrypts the secret).
 */
export async function savePlatformCredentials(admin, userId, platform, appId, appSecret, configId = "") {
  let encFields = { encrypted_secret: null, secret_iv: null, secret_tag: null };
  if (appSecret && appSecret.trim()) {
    const enc = encryptToken(appSecret.trim());
    encFields = {
      encrypted_secret: enc.cipherText,
      secret_iv: enc.iv,
      secret_tag: enc.tag,
    };
  } else if (userId && admin) {
    try {
      const { data } = await selectCredentialRow(admin, userId, platform);
      if (data?.encrypted_secret && data?.secret_iv && data?.secret_tag) {
        encFields = {
          encrypted_secret: data.encrypted_secret,
          secret_iv: data.secret_iv,
          secret_tag: data.secret_tag,
        };
      }
    } catch {
      // Ignore lookup issues and continue without changing secret material.
    }
  }

  const payload = {
    user_id: userId,
    platform,
    app_id: appId.trim(),
    config_id: configId.trim(),
    ...encFields,
    updated_at: new Date().toISOString(),
  };

  try {
    await saveCredentialRow(admin, payload, true);
  } catch (error) {
    if (!String(error?.message || "").includes("config_id")) {
      throw error;
    }
    await saveCredentialRow(admin, payload, false);
  }
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
