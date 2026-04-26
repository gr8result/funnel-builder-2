// /lib/emailValidation.js
// Validation and guards for email sending

import { canSendEmail, canAddToList, updateAccountUsage } from "./usageTracking";

/**
 * Guard function to prevent email sends if limit exceeded
 */
export async function guardEmailSend(userId, emailCount = 1) {
  const check = await canSendEmail(userId, emailCount);
  
  if (!check.ok) {
    const err = new Error(check.reason);
    err.code = "EMAIL_LIMIT_EXCEEDED";
    err.details = check;
    throw err;
  }

  return check;
}

/**
 * Guard function to prevent adding subscribers if limit exceeded
 */
export async function guardAddSubscriber(userId, listId, count = 1) {
  const check = await canAddToList(userId, listId, count);
  
  if (!check.ok) {
    const err = new Error(check.reason);
    err.code = "SUBSCRIBER_LIMIT_EXCEEDED";
    err.details = check;
    throw err;
  }

  return check;
}

/**
 * Safely record an email send and update usage
 */
export async function recordEmailSent(userId, count = 1) {
  try {
    await updateAccountUsage(userId);
    return { ok: true, recorded: count };
  } catch (err) {
    console.error("Error recording email send:", err);
    return { ok: false, error: err.message };
  }
}
