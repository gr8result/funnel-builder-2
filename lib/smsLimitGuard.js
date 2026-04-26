// lib/smsLimitGuard.js

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function checkSmsLimit(userId, amount = 1) {
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString();

  // get usage
  let { data: usage } = await supabase
    .from("usage_sms")
    .select("*")
    .eq("user_id", userId)
    .gte("period_start", startOfMonth)
    .maybeSingle();

  if (!usage) {
    const { data } = await supabase
      .from("usage_sms")
      .insert({
        user_id: userId,
        sms_sent: 0,
        period_start: startOfMonth,
      })
      .select()
      .single();

    usage = data;
  }

  const used = usage.sms_sent || 0;

  // get plan
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id")
    .eq("account_id", userId)
    .maybeSingle();

  const plan = sub?.plan_id || "free";

  const { data: limits } = await supabase
    .from("plan_limits")
    .select("max_sms_per_month")
    .eq("plan_id", plan)
    .single();

  const max = limits?.max_sms_per_month || 0;

  const remaining = max - used;

  // 🚨 HARD BLOCK
  if (remaining <= 0) {
    return {
      allowed: false,
      warning: false,
      remaining: 0,
      message: "SMS limit reached",
    };
  }

  // ⚠️ WARNING THRESHOLD (10% left)
  if (remaining <= Math.ceil(max * 0.1)) {
    return {
      allowed: true,
      warning: true,
      remaining,
      message: `Only ${remaining} SMS remaining this month`,
    };
  }

  return {
    allowed: true,
    warning: false,
    remaining,
    message: null,
  };
}

export async function incrementSmsUsage(userId, amount = 1) {
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString();

  const { data: usage } = await supabase
    .from("usage_sms")
    .select("*")
    .eq("user_id", userId)
    .gte("period_start", startOfMonth)
    .maybeSingle();

  if (!usage) return;

  await supabase
    .from("usage_sms")
    .update({
      sms_sent: (usage.sms_sent || 0) + amount,
    })
    .eq("id", usage.id);
}