import crypto from "crypto";
import { sendSmsGlobal, normalizeAUTo61 } from "../../../lib/smsglobal";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { checkRateLimit, getIp } from "../../../lib/rateLimit";

function clean(value) {
  return String(value || "").trim();
}

async function upsertAccount(payload) {
  const { error } = await supabaseAdmin
    .from("accounts")
    .upsert(payload, { onConflict: "user_id" });
  if (!error) return;

  const fallback = { ...payload };
  for (const key of ["phone_verified", "email_verified", "onboarding_completed", "selected_plan", "phone_otp_pending"]) {
    delete fallback[key];
  }
  const retry = await supabaseAdmin
    .from("accounts")
    .upsert(fallback, { onConflict: "user_id" });
  if (retry.error) throw retry.error;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getIp(req);
  const rl = checkRateLimit(`signup-phone:${ip}`, 5, 10 * 60 * 1000);
  if (!rl.ok) return res.status(429).json({ error: "Too many requests. Please wait before requesting another code." });

  const email = clean(req.body?.email).toLowerCase();
  const fullName = clean(req.body?.fullName);
  const phoneRaw = clean(req.body?.phone);
  const selectedPlan = clean(req.body?.selectedPlan);

  if (!email || !email.includes("@")) return res.status(400).json({ error: "A valid email is required." });
  if (!fullName) return res.status(400).json({ error: "Name is required." });
  if (!phoneRaw) return res.status(400).json({ error: "Phone number is required." });

  const { data: users, error: userErr } = await supabaseAdmin.auth.admin.listUsers();
  if (userErr) return res.status(500).json({ error: userErr.message });
  const user = users?.users?.find((item) => String(item.email || "").toLowerCase() === email);
  if (!user?.id) return res.status(400).json({ error: "Create the account first, then request the phone code." });

  const phone = normalizeAUTo61(phoneRaw) || phoneRaw;
  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  try {
    const sms = await sendSmsGlobal({
      toPhone: phone,
      message: `Your Gr8 Result verification code is: ${code}`,
    });

    if (!sms?.ok) {
      const message = sms?.body?.error || sms?.body?.message || "SMS send failed";
      return res.status(500).json({ error: message });
    }

    await upsertAccount({
      user_id: user.id,
      email,
      full_name: fullName,
      phone,
      phone_verified: false,
      email_verified: !!user.email_confirmed_at,
      email_verified_at: user.email_confirmed_at || null,
      onboarding_completed: false,
      selected_plan: selectedPlan || null,
      status: "pending",
      is_approved: false,
      subscription_status: "none",
      phone_otp_pending: JSON.stringify({ code, phone, expiresAt }),
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("start-signup-phone-verification error:", err);
    return res.status(500).json({ error: err.message || "Could not send verification code." });
  }
}
