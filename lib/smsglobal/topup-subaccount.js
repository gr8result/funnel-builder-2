import { buildSmsGlobalMacHeader } from "./macAuth.js";

/**
 * Top up a SMSGlobal subaccount with credit from master account
 * 
 * This transfers credit from your master account balance to a subaccount
 * so they can send SMS immediately after approval
 * 
 * @param {string} subaccountId - The subaccount ID (sender_id)
 * @param {number} creditAmount - Amount to top up (in account currency, e.g., AUD)
 * @param {string} apiKey - Your master SMSGlobal API key
 * @param {string} apiSecret - Your master SMSGlobal API secret
 * @returns {Promise<{ok: boolean, new_balance?: number, error?: string}>}
 */
export async function topupSubaccount(
  subaccountId,
  creditAmount,
  apiKey,
  apiSecret
) {
  if (!subaccountId || !creditAmount || creditAmount <= 0) {
    return { ok: false, error: "Missing or invalid subaccount_id or credit_amount" };
  }

  if (!apiKey || !apiSecret) {
    return { ok: false, error: "Missing SMS API credentials" };
  }

  try {
    console.log("💰 Topping up subaccount:", {
      subaccount_id: subaccountId,
      credit_amount: creditAmount,
    });

    // Build MAC auth header for SMSGlobal API
    const method = "POST";
    const path = `/v2/user/sub-account/${subaccountId}/topup`;
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

    // Payload - transfer credit amount
    const payload = {
      credit: creditAmount,  // Amount to transfer from master to subaccount
    };

    const body = JSON.stringify(payload);

    console.log("📤 POST /v2/user/sub-account/:id/topup with:", {
      subaccount_id: subaccountId,
      credit_amount: creditAmount,
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
      new_balance: data?.balance,
    });

    if (!response.ok) {
      console.error("❌ Top-up failed:", data);
      return {
        ok: false,
        error: data?.message || `HTTP ${response.status}`,
        body: data,
      };
    }

    console.log("✅ Subaccount topped up:", {
      subaccount_id: subaccountId,
      credit_added: creditAmount,
      new_balance: data?.balance,
    });

    return {
      ok: true,
      new_balance: data?.balance,
    };
  } catch (err) {
    console.error("❌ Error topping up subaccount:", err);
    return {
      ok: false,
      error: err?.message || "Unknown error",
    };
  }
}

/**
 * Alternative: Get Subaccount Balance (read-only)
 * Useful to check current balance before topping up
 */
export async function getSubaccountBalance(
  subaccountId,
  apiKey,
  apiSecret
) {
  if (!subaccountId || !apiKey || !apiSecret) {
    return { ok: false, error: "Missing required parameters" };
  }

  try {
    const method = "GET";
    const path = `/v2/user/sub-account/${subaccountId}/credit-balance`;
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

    const response = await fetch(`https://${host}${path}`, {
      method,
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Failed to fetch balance:", data);
      return { ok: false, error: data?.message };
    }

    console.log("✅ Subaccount balance fetched:", {
      subaccount_id: subaccountId,
      balance: data?.balance,
    });

    return {
      ok: true,
      balance: data?.balance,
      currency: data?.currency || "AUD",
    };
  } catch (err) {
    console.error("❌ Error fetching balance:", err);
    return { ok: false, error: err?.message };
  }
}

/**
 * Usage in onboarding approval:
 * 
 * import { createSmsGlobalSubaccount } from '@/lib/smsglobal/create-subaccount.js';
 * import { topupSubaccount } from '@/lib/smsglobal/topup-subaccount.js';
 * import { supabaseAdmin } from '@/lib/supabaseAdmin.js';
 * 
 * // Step 1: Create subaccount
 * const { ok: createOk, sender_id, sms_api_key, sms_api_secret } = 
 *   await createSmsGlobalSubaccount(businessName, email, masterKey, masterSecret);
 * 
 * if (createOk) {
 *   // Step 2: Fund the subaccount
 *   const INITIAL_SMS_CREDIT = 50;  // $50 AUD or equivalent
 *   const { ok: topupOk } = await topupSubaccount(
 *     sender_id,
 *     INITIAL_SMS_CREDIT,
 *     masterKey,
 *     masterSecret
 *   );
 * 
 *   if (topupOk) {
 *     // Step 3: Store credentials
 *     await supabaseAdmin
 *       .from('accounts')
 *       .update({
 *         sender_id,
 *         sms_api_key,
 *         sms_api_secret,
 *         sms_initial_credit: INITIAL_SMS_CREDIT,
 *         sms_activated: true,
 *       })
 *       .eq('user_id', userId);
 *   }
 * }
 */
