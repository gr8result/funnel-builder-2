// /pages/api/billing/apply-plan.js
// Server-side plan activation — called from checkout/success.js after payment
// Uses supabaseAdmin to bypass RLS and reliably write plan tiers to accounts table.

import { createClient } from "@supabase/supabase-js";
import { normalizePlanId } from "../../../lib/planResolver";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OPTIONAL_ACCOUNT_COLUMNS = [
  "selected_plan",
  "subscription_status",
  "status",
  "is_approved",
  "calendar_plan_tier",
  "sms_plan_tier",
  "email_plan_tier",
  "email_plan",
  "email_plan_price",
];

function missingSchemaColumn(error) {
  const message = String(error?.message || "");
  const details = String(error?.details || "");
  const text = `${message} ${details}`;
  const match = text.match(/'([^']+)'\s+column/i) || text.match(/column\s+"?([a-zA-Z0-9_]+)"?/i);
  return match?.[1] || "";
}

function withoutColumn(payload, column) {
  const next = { ...payload };
  delete next[column];
  return next;
}

async function writeAccount({ accountId, user, payload }) {
  const basePayload = { ...payload };
  let currentPayload = basePayload;

  for (let attempt = 0; attempt <= OPTIONAL_ACCOUNT_COLUMNS.length; attempt += 1) {
    const result = accountId
      ? await supabaseAdmin.from("accounts").update(currentPayload).eq("id", accountId)
      : await supabaseAdmin.from("accounts").insert({ user_id: user.id, email: user.email || null, ...currentPayload });

    if (!result.error) return { error: null, omittedColumns: OPTIONAL_ACCOUNT_COLUMNS.filter((column) => !(column in currentPayload) && column in basePayload) };

    const missing = missingSchemaColumn(result.error);
    if (!missing || !OPTIONAL_ACCOUNT_COLUMNS.includes(missing) || !(missing in currentPayload)) {
      return { error: result.error, omittedColumns: OPTIONAL_ACCOUNT_COLUMNS.filter((column) => !(column in currentPayload) && column in basePayload) };
    }

    console.warn(`apply-plan: accounts.${missing} is unavailable; retrying without it.`);
    currentPayload = withoutColumn(currentPayload, missing);
  }

  return { error: new Error("Could not write account after schema fallback retries."), omittedColumns: [] };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Authenticate user from Bearer token
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

  const { emailPlan, smsPlan, calendarPlan, socialPlan, websitePlan, selectedModules, basePlan, stripeSubscriptionId, stripeCustomerId } = req.body || {};

  if (!basePlan && !emailPlan && !smsPlan && !calendarPlan && !socialPlan && !websitePlan && (!selectedModules || selectedModules.length === 0)) {
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
  if (basePlan) {
    payload.selected_plan = basePlan;
    payload.subscription_status = "active";
    payload.status = "active";
    payload.is_approved = true;
  }

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

  const writeResult = await writeAccount({ accountId, user, payload: safePayload });

  if (writeResult.error) {
    console.error("apply-plan: accounts write error", writeResult.error);
    return res.status(500).json({ error: writeResult.error.message });
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
  if (websitePlan) {
    moduleRows.push(`__website_plan_tier:${websitePlan}`);
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

  console.log(`✅ apply-plan: ${user.email} → plan=${basePlan} calendarPlan=${calendarPlan} emailPlan=${emailPlan} smsPlan=${smsPlan} socialPlan=${socialPlan} websitePlan=${websitePlan} modules=${(selectedModules||[]).join(",")}`);

  // Write/update the subscriptions record for the base plan
  if (basePlan) {
    const normalizedBasePlan = normalizePlanId(basePlan);
    if (normalizedBasePlan) {
      const { error: workspaceErr } = await supabaseAdmin
        .from("workspaces")
        .update({ plan: normalizedBasePlan, updated_at: new Date().toISOString() })
        .eq("owner_id", user.id);

      if (workspaceErr) {
        console.warn("apply-plan: workspace plan sync warning:", workspaceErr.message);
      }
    }

    const subPayload = {
      account_id: user.id,
      plan_id: normalizedBasePlan || basePlan,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
