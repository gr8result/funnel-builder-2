import { supabaseAdmin } from "../supabaseAdmin.js";

/**
 * Auto-create a sanitized sender ID from business name during onboarding approval
 * This is called when a user's application is approved
 * 
 * The sender ID becomes the user's SMS origin (how SMS appears to recipients)
 * You'll still need to submit it to SMSGlobal for approval, but we store it in their account
 * 
 * @param {string} userId - The user's ID
 * @param {string} businessName - The business name (will be sanitized)
 * @returns {Promise<{ok: boolean, sender_id: string|null, error?: string}>}
 */
export async function autoCreateSenderId(userId, businessName) {
  if (!userId) {
    return { ok: false, error: "Missing user_id" };
  }

  if (!businessName || typeof businessName !== "string") {
    return { ok: false, error: "Missing or invalid business_name" };
  }

  // Sanitize business name to valid SMS origin format
  // Remove spaces, special chars, limit to 3-11 alphanumeric chars
  const sanitized = businessName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")  // Keep only alphanumeric
    .slice(0, 11);               // Max 11 chars

  if (sanitized.length < 3) {
    // If sanitized is too short, generate a code
    const senderId = `SMS${Math.random().toString(36).substring(2, 7)}`.toUpperCase().slice(0, 11);
    await storeSenderId(userId, senderId);
    return { ok: true, sender_id: senderId };
  }

  // Store the sanitized sender ID in accounts table
  const stored = await storeSenderId(userId, sanitized);
  if (!stored.ok) {
    return stored;
  }

  return { ok: true, sender_id: sanitized };
}

/**
 * Store the sender ID in the user's account
 * @private
 */
async function storeSenderId(userId, senderId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("accounts")
      .update({ sender_id: senderId })
      .eq("user_id", userId);

    if (error) {
      console.error("❌ Failed to store sender_id:", error);
      return { ok: false, error: error.message };
    }

    console.log("✅ Auto-created sender ID for user:", { userId, sender_id: senderId });
    return { ok: true, sender_id: senderId };
  } catch (err) {
    console.error("❌ Error storing sender_id:", err);
    return { ok: false, error: err.message };
  }
}

/**
 * Example usage in onboarding approval endpoint:
 * 
 * import { autoCreateSenderId } from '@/lib/smsglobal/create-sender-id.js';
 * 
 * // In the approval handler:
 * const { ok: appOk, error: appErr } = await autoCreateSenderId(userId, businessName);
 * if (!appOk) {
 *   console.warn("Failed to auto-create sender ID:", appErr);
 *   // Optional: still mark application as approved, but user might not be able to send SMS yet
 * }
 */
