import { buildSmsGlobalMacHeader } from "./macAuth.js";

/**
 * Auto-create a SMSGlobal subaccount when user's application is approved
 * 
 * Returns:
 * - sender_id: The new subaccount ID (e.g., "3q5959hs")
 * - sms_api_key: API key for subaccount
 * - sms_api_secret: API secret for subaccount
 * 
 * The subaccount inherits your approved sender IDs (like "gr8result")
 * Each user gets their own subaccount for billing/tracking
 * 
 * @param {string} businessName - User's business name
 * @param {string} email - User's email
 * @param {string} apiKey - Your master SMSGlobal API key
 * @param {string} apiSecret - Your master SMSGlobal API secret
 * @returns {Promise<{ok: boolean, sender_id?: string, sms_api_key?: string, sms_api_secret?: string, error?: string}>}
 */
export async function createSmsGlobalSubaccount(
  businessName,
  email,
  apiKey,
  apiSecret
) {
  if (!businessName || !email) {
    return { ok: false, error: "Missing business_name or email" };
  }

  if (!apiKey || !apiSecret) {
    return { ok: false, error: "Missing SMS API credentials" };
  }

  try {
    console.log("🔧 Creating SMSGlobal subaccount for:", {
      business_name: businessName,
      email,
    });

    // Build MAC auth header
    const method = "POST";
    const path = "/v2/user/sub-account";
    const host = "api.smsglobal.com";
    const port = 443;

    const authHeader = buildSmsGlobalMacHeader({
      method,
      path,
      host,
      port,
      apiKey,
      apiSecret,
    });

    // Payload - create new subaccount
    const payload = {
      name: businessName.substring(0, 100),  // Max 100 chars
      email: email,
      require_dlr: false,  // Don't require delivery receipts
    };

    const body = JSON.stringify(payload);

    console.log("📤 POST /v2/user/sub-account with:", {
      name: payload.name,
      email: payload.email,
    });

    const response = await fetch(`https://${host}${path}`, {
      method,
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body,
    });

    const data = await response.json();

    console.log("📥 SMSGlobal response:", {
      http: response.status,
      ok: response.ok,
      body_keys: Object.keys(data || {}),
    });

    if (!response.ok) {
      console.error("❌ Subaccount creation failed:", data);
      return {
        ok: false,
        error: data?.message || `HTTP ${response.status}`,
        body: data,
      };
    }

    // Extract subaccount credentials from response
    const subaccountId = data?.id || data?.sender_id;
    const apiKeyResp = data?.api_key;
    const apiSecretResp = data?.api_secret;

    if (!subaccountId || !apiKeyResp || !apiSecretResp) {
      console.error("❌ Missing required fields in response:", {
        has_id: !!subaccountId,
        has_api_key: !!apiKeyResp,
        has_api_secret: !!apiSecretResp,
      });
      return {
        ok: false,
        error: "Subaccount created but missing credentials in response",
        body: data,
      };
    }

    console.log("✅ Subaccount created:", {
      sender_id: subaccountId,
      has_api_key: true,
      has_api_secret: true,
    });

    return {
      ok: true,
      sender_id: subaccountId,
      sms_api_key: apiKeyResp,
      sms_api_secret: apiSecretResp,
    };
  } catch (err) {
    console.error("❌ Error creating subaccount:", err);
    return {
      ok: false,
      error: err?.message || "Unknown error",
    };
  }
}

/**
 * Usage in onboarding approval:
 * 
 * import { createSmsGlobalSubaccount } from '@/lib/smsglobal/create-subaccount.js';
 * import { supabaseAdmin } from '@/lib/supabaseAdmin.js';
 * 
 * // When user's application is approved:
 * const { ok, sender_id, sms_api_key, sms_api_secret, error } = 
 *   await createSmsGlobalSubaccount(
 *     businessName,
 *     userEmail,
 *     process.env.SMSGLOBAL_API_KEY,
 *     process.env.SMSGLOBAL_API_SECRET
 *   );
 * 
 * if (ok) {
 *   // Store credentials in user's account
 *   await supabaseAdmin
 *     .from('accounts')
 *     .update({
 *       sender_id,
 *       sms_api_key,
 *       sms_api_secret,
 *       sms_activated: true,
 *     })
 *     .eq('user_id', userId);
 * } else {
 *   console.error('Failed to create SMS subaccount:', error);
 * }
 */
