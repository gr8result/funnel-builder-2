// /lib/smsValidation.js
// Validation and guards for SMS sending

import { canSendSms, updateAccountUsage } from "./usageTracking";

/**
 * Guard function to prevent SMS sends if limit exceeded
 * NOTE: Users without sms_plan are treated as unlimited (allows single SMS sends)
 */
export async function guardSmsSend(userId, smsCount = 1) {
  const check = await canSendSms(userId, smsCount);
  
  // ✅ Allow if no plan (treat as unlimited for single sends)
  if (!check.ok && check.reason === "No SMS plan") {
    return { ok: true, unlimited: true };
  }
  
  if (!check.ok) {
    const err = new Error(check.reason);
    err.code = "SMS_LIMIT_EXCEEDED";
    err.details = check;
    throw err;
  }

  return check;
}

/**
 * Safely record an SMS send and update usage
 */
export async function recordSmsSent(userId, count = 1) {
  try {
    await updateAccountUsage(userId);
    return { ok: true, recorded: count };
  } catch (err) {
    console.error("Error recording SMS send:", err);
    return { ok: false, error: err.message };
  }
}
