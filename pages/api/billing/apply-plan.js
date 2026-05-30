// /pages/api/billing/apply-plan.js
// Server-side plan activation — called from checkout/success.js after payment
// Uses supabaseAdmin to bypass RLS and reliably write plan tiers to accounts table.

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Authenticate user from Bearer token
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

  const { emailPlan, smsPlan, calendarPlan, socialPlan, selectedModules, basePlan, stripeSubscriptionId, stripeCustomerId } = req.body || {};

  if (!basePlan && !emailPlan && !smsPlan && !calendarPlan && !socialPlan && (!selectedModules || selectedModules.length === 0)) {
    return res.status(400).json({ error: "No plan tiers provided" });
  }

  const payload = { updated_at: new Date().toISOString() };
  if (calendarPlan) payload.calendar_plan_tier = calendarPlan;
  if (smsPlan) payload.sms_plan_tier = smsPlan;
  if (emailPlan) {
    payload.email_plan_tier = emailPlan;
    const PRICING_NAMES = {
      "email-free": "Free", "email-starter": "Starter", "email-growth": "Growth",
      "email-pro": "Pro", "email-advanced": "Advanced", "email-enterprise": "Enterprise",
    };
    const PRICING_PRICES = {
      "email-free": 0, "email-starter": 29, "email-growth": 99,
      "email-pro": 199, "email-advanced": 499, "email-enterprise": 0,
    };
    payload.email_plan = PRICING_NAMES[emailPlan] || emailPlan;
    if (typeof PRICING_PRICES[emailPlan] === "number") {
      payload.email_plan_price = PRICING_PRICES[emailPlan];
    }
  }
  if (socialPlan) payload.social_plan_tier = socialPlan;

  // Find the user's accounts row
  const { data: accountRows, error: fetchErr } = await supabaseAdmin
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (fetchErr) {
    console.error("apply-plan: accounts fetch error", fetchErr);
    return res.status(500).json({ error: fetchErr.message });
  }

  const accountId = accountRows?.[0]?.id || null;

  // Always build a safe payload without social_plan_tier for the main update,
  // since that column may not exist yet. Social tier is stored in user_modules instead.
  const safePayload = { ...payload };
  delete safePayload.social_plan_tier;

  if (accountId) {
    const { error: updateErr } = await supabaseAdmin
      .from("accounts")
      .update(safePayload)
      .eq("id", accountId);

    if (updateErr) {
      console.error("apply-plan: update error", updateErr);
      return res.status(500).json({ error: updateErr.message });
    }
  } else {
    const { error: insertErr } = await supabaseAdmin
      .from("accounts")
      .insert({ user_id: user.id, email: user.email || null, ...safePayload });

    if (insertErr) {
      console.error("apply-plan: insert error", insertErr);
      return res.status(500).json({ error: insertErr.message });
    }
  }

  // Keep legacy profile flag in sync for environments still using it.
  if (calendarPlan) {
    const legacyStatus = `active:${calendarPlan}`;
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          email: user.email || null,
          calendar_subscription_status: legacyStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
  }

  // Write purchased modules to user_modules table
  const moduleRows = Array.isArray(selectedModules) ? [...selectedModules] : [];
  // Store social plan tier as a special row so no extra DB column is needed
  if (socialPlan) {
    moduleRows.push(`__social_plan_tier:${socialPlan}`);
  }
  if (moduleRows.length > 0) {
    const rows = moduleRows.map((module_id) => ({
      user_id: user.id,
      module_id,
      activated_at: new Date().toISOString(),
    }));
    const { error: modErr } = await supabaseAdmin
      .from("user_modules")
      .upsert(rows, { onConflict: "user_id,module_id" });
    if (modErr) {
      console.warn("apply-plan: user_modules upsert warning:", modErr.message);
    }
  }

  console.log(`✅ apply-plan: ${user.email} → plan=${basePlan} calendarPlan=${calendarPlan} emailPlan=${emailPlan} smsPlan=${smsPlan} socialPlan=${socialPlan} modules=${(selectedModules||[]).join(",")}`);

  // Write/update the subscriptions record for the base plan
  if (basePlan) {
    const subPayload = {
      account_id: user.id,
      plan_id: basePlan,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (stripeSubscriptionId) subPayload.stripe_subscription_id = stripeSubscriptionId;
    if (stripeCustomerId)     subPayload.stripe_customer_id     = stripeCustomerId;

    const { error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .upsert(subPayload, { onConflict: "account_id" });

    if (subErr) {
      // Non-fatal — log but don't block activation
      console.warn("apply-plan: subscriptions upsert warning:", subErr.message);
    }
  }

  return res.status(200).json({ ok: true });
}
