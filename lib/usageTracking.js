// /lib/usageTracking.js
// Usage tracking and limit enforcement for Email & SMS
import { supabaseAdmin } from "./supabaseAdmin";
import PRICING from "../data/pricing.js";

const UPGRADE_PATHS = {
  email: "/modules/billing/email-plans",
  sms: "/modules/billing/sms-plans",
};

function toPercent(used, limit) {
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  return Math.round((Number(used || 0) / limit) * 100);
}

function buildUsagePolicy({ channel, used, limit, upgradeTo }) {
  const pct = toPercent(used, limit);
  const safeChannel = channel === "sms" ? "SMS" : "Email";
  const upgradePath = UPGRADE_PATHS[channel] || "/billing";
  const upgradeMsg = upgradeTo
    ? `Upgrade to ${PRICING[upgradeTo]?.name || upgradeTo} to avoid interruptions.`
    : "Upgrade your plan to increase your monthly allowance.";

  if (!Number.isFinite(limit) || limit <= 0) {
    return {
      stage: "ok",
      level: "ok",
      shouldWarn: false,
      shouldBlock: false,
      percent: 0,
      message: `${safeChannel} usage is currently unlimited.`,
      popupMessage: `${safeChannel} usage is currently unlimited for this plan.`,
      upgradePath,
      upgradeTo,
      upgradeMessage: upgradeMsg,
    };
  }

  if (pct >= 100) {
    return {
      stage: "hard-stop",
      level: "critical",
      shouldWarn: true,
      shouldBlock: true,
      percent: pct,
      message: `${safeChannel} hard stop: 100% monthly allowance reached.`,
      popupMessage: `${safeChannel} sending is paused because you've reached 100% of your monthly allowance. ${upgradeMsg}`,
      upgradePath,
      upgradeTo,
      upgradeMessage: upgradeMsg,
    };
  }

  if (pct >= 95) {
    return {
      stage: "critical-warning",
      level: "critical",
      shouldWarn: true,
      shouldBlock: false,
      percent: pct,
      message: `${safeChannel} critical warning: ${pct}% used.`,
      popupMessage: `${safeChannel} usage is at ${pct}%. You are close to hard stop at 100%. ${upgradeMsg}`,
      upgradePath,
      upgradeTo,
      upgradeMessage: upgradeMsg,
    };
  }

  if (pct >= 80) {
    return {
      stage: "early-warning",
      level: "warning",
      shouldWarn: true,
      shouldBlock: false,
      percent: pct,
      message: `${safeChannel} usage notice: ${pct}% used.`,
      popupMessage: `${safeChannel} usage is at ${pct}%. Consider upgrading now to avoid interruptions.`,
      upgradePath,
      upgradeTo,
      upgradeMessage: upgradeMsg,
    };
  }

  return {
    stage: "ok",
    level: "ok",
    shouldWarn: false,
    shouldBlock: false,
    percent: pct,
    message: `${safeChannel} usage is healthy at ${pct}%.`,
    popupMessage: "",
    upgradePath,
    upgradeTo,
    upgradeMessage: upgradeMsg,
  };
}

/**
 * Get current month range (start of month to current moment)
 */
export function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const startISO = start.toISOString();
  return { start: startISO, now: now.toISOString() };
}

/**
 * Count emails sent this month for a user
 */
export async function getEmailsSentThisMonth(userId) {
  const { start, now } = getCurrentMonthRange();
  
  // Get count from all email_sends records this month
  const { count, error } = await supabaseAdmin
    .from("email_sends")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .gte("created_at", start)
    .lte("created_at", now);

  if (error) {
    console.error("Error counting emails sent:", error);
    return 0;
  }
  
  return count || 0;
}

/**
 * Count SMS sent this month for a user
 */
export async function getSmsSentThisMonth(userId) {
  const { start, now } = getCurrentMonthRange();

  // Count from sms_sent_history (authoritative source for delivered/sent SMS)
  const { count: historyCount, error: hErr } = await supabaseAdmin
    .from("sms_sent_history")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .gte("created_at", start)
    .lte("created_at", now);

  if (!hErr) {
    return historyCount || 0;
  }

  console.error("Error counting SMS from history:", hErr);

  // Fallback for older deployments without history table
  const { count: queueCount, error: qErr } = await supabaseAdmin
    .from("sms_queue")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .in("status", ["sent", "delivered"])
    .gte("created_at", start)
    .lte("created_at", now);

  if (qErr) console.error("Error counting SMS from queue:", qErr);

  return queueCount || 0;
}

/**
 * Count total subscribers across all lists for a user
 */
export async function getTotalSubscribers(userId) {
  const { count, error } = await supabaseAdmin
    .from("subscribers")
    .select("*", { count: "exact" })
    .eq("user_id", userId);

  if (error) {
    console.error("Error counting subscribers:", error);
    return 0;
  }
  
  return count || 0;
}

/**
 * Count subscribers in a specific list
 */
export async function getListSubscriberCount(listId) {
  const { count, error } = await supabaseAdmin
    .from("list_subscribers")
    .select("*", { count: "exact" })
    .eq("list_id", listId);

  if (error) {
    console.error("Error counting list subscribers:", error);
    return 0;
  }
  
  return count || 0;
}

/**
 * Get account info including plan tier and SMS limit
 */
export async function getAccountInfo(userId) {
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select("email_plan_tier, email_subscribers_count, email_emails_sent_month, sms_monthly_limit, sms_plan_tier")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching account info:", error);
    return null;
  }
  
  return data;
}

/**
 * Check if user can send emails (doesn't exceed monthly limit)
 */
export async function canSendEmail(userId, emailCount = 1) {
  const account = await getAccountInfo(userId);
  if (!account?.email_plan_tier) return { ok: false, reason: "No email plan" };

  const planKey = account.email_plan_tier;
  const planData = PRICING[planKey];
  if (!planData?.limits) return { ok: false, reason: "Invalid plan" };

  const limit = planData.limits.monthlyEmails;
  if (limit === "custom") {
    return {
      ok: true,
      policy: buildUsagePolicy({
        channel: "email",
        used: 0,
        limit: 0,
        upgradeTo: planData.upgradeTo,
      }),
    };
  }

  const sentThisMonth = await getEmailsSentThisMonth(userId);
  const remaining = limit - sentThisMonth;
  const projectedUsed = sentThisMonth + Math.max(0, Number(emailCount || 0));
  const policy = buildUsagePolicy({
    channel: "email",
    used: projectedUsed,
    limit,
    upgradeTo: planData.upgradeTo,
  });

  if (remaining <= 0) {
    return {
      ok: false,
      reason: `Email limit reached (${limit}/month)`,
      limit,
      used: sentThisMonth,
      remaining: 0,
      policy,
    };
  }

  if (remaining < emailCount) {
    return {
      ok: false,
      reason: `Sending ${emailCount} emails would exceed limit`,
      limit,
      used: sentThisMonth,
      remaining,
      policy,
    };
  }

  return {
    ok: true,
    limit,
    used: sentThisMonth,
    remaining,
    policy,
    warning: policy.shouldWarn,
  };
}

/**
 * Check if user can send SMS (doesn't exceed monthly limit)
 */
export async function canSendSms(userId, smsCount = 1) {
  const account = await getAccountInfo(userId);
  const smsPlanKey = account?.sms_plan_tier;
  const smsPlan = smsPlanKey ? PRICING[smsPlanKey] : null;
  
  // If no SMS limit is set, allow unlimited SMS
  if (!account?.sms_monthly_limit) {
    console.log(`✅ SMS unlimited for user ${userId}`);
    return {
      ok: true,
      policy: buildUsagePolicy({
        channel: "sms",
        used: 0,
        limit: 0,
        upgradeTo: smsPlan?.upgradeTo,
      }),
    };
  }

  const limit = account.sms_monthly_limit;
  const sentThisMonth = await getSmsSentThisMonth(userId);
  const remaining = limit - sentThisMonth;
  const projectedUsed = sentThisMonth + Math.max(0, Number(smsCount || 0));
  const policy = buildUsagePolicy({
    channel: "sms",
    used: projectedUsed,
    limit,
    upgradeTo: smsPlan?.upgradeTo,
  });

  if (remaining <= 0) {
    return {
      ok: false,
      reason: `SMS limit reached (${limit}/month)`,
      limit,
      used: sentThisMonth,
      remaining: 0,
      policy,
    };
  }

  if (remaining < smsCount) {
    return {
      ok: false,
      reason: `Sending ${smsCount} SMS would exceed limit`,
      limit,
      used: sentThisMonth,
      remaining,
      policy,
    };
  }

  return {
    ok: true,
    limit,
    used: sentThisMonth,
    remaining,
    policy,
    warning: policy.shouldWarn,
  };
}

/**
 * Check if list can accept more subscribers
 */
export async function canAddToList(userId, listId, count = 1) {
  const account = await getAccountInfo(userId);
  if (!account?.email_plan_tier) return { ok: false, reason: "No email plan" };

  const planKey = account.email_plan_tier;
  const planData = PRICING[planKey];
  if (!planData?.limits) return { ok: false, reason: "Invalid plan" };

  const totalLimit = planData.limits.subscribers;
  if (totalLimit === "custom") return { ok: true }; // Unlimited

  const currentCount = await getTotalSubscribers(userId);
  const remaining = totalLimit - currentCount;

  if (remaining <= 0) {
    return {
      ok: false,
      reason: `Subscriber limit reached (${totalLimit} total)`,
      limit: totalLimit,
      used: currentCount,
      remaining: 0,
    };
  }

  if (remaining < count) {
    return {
      ok: false,
      reason: `Adding ${count} subscribers would exceed limit`,
      limit: totalLimit,
      used: currentCount,
      remaining,
    };
  }

  return { ok: true, limit: totalLimit, used: currentCount, remaining };
}

/**
 * Get usage stats for dashboard display
 */
export async function getUsageStats(userId) {
  try {
    const [account, emailsSent, smsSent, totalSubs] = await Promise.all([
      getAccountInfo(userId),
      getEmailsSentThisMonth(userId),
      getSmsSentThisMonth(userId),
      getTotalSubscribers(userId),
    ]);

    if (!account) return null;

    const emailPlan = PRICING[account.email_plan_tier];
    const smsLimit = account.sms_monthly_limit || null; // Can be null (unlimited) or a number

    const emailLimit = emailPlan?.limits?.monthlyEmails || 0;
    const emailLimitVal = emailLimit === "custom" ? "Unlimited" : emailLimit;
    const smsLimitVal = smsLimit === null ? "Unlimited" : smsLimit;
    const subLimit = emailPlan?.limits?.subscribers || 0;

    return {
      email: {
        sent: emailsSent,
        limit: emailLimitVal,
        percentage: emailLimit === "custom" ? 0 : Math.round((emailsSent / emailLimit) * 100),
      },
      sms: {
        sent: smsSent,
        limit: smsLimitVal,
        percentage: smsLimit === null ? 0 : Math.round((smsSent / smsLimit) * 100),
      },
      subscribers: {
        used: totalSubs,
        limit: subLimit === "custom" ? "Unlimited" : subLimit,
        percentage: subLimit === "custom" ? 0 : Math.round((totalSubs / subLimit) * 100),
      },
    };
  } catch (err) {
    console.error("Error getting usage stats:", err);
    return null;
  }
}

/**
 * Update account usage columns (called after sends)
 */
export async function updateAccountUsage(userId) {
  const [emailsSent, smsSent, totalSubs] = await Promise.all([
    getEmailsSentThisMonth(userId),
    getSmsSentThisMonth(userId),
    getTotalSubscribers(userId),
  ]);

  const { error } = await supabaseAdmin
    .from("accounts")
    .update({
      email_emails_sent_month: emailsSent,
      email_subscribers_count: totalSubs,
      sms_sent_month: smsSent,
    })
    .eq("user_id", userId);

  if (error) console.error("Error updating account usage:", error);
}
