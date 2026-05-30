// /pages/api/smsglobal/send-bulk.js

import { createClient } from "@supabase/supabase-js";
import { guardSmsSend } from "../../../lib/smsValidation";
import { withAuth } from "../../../lib/withWorkspace";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalizePhone(raw) {
  let v = String(raw || "").trim();
  if (!v) return "";
  v = v.replace(/[^\d+]/g, "");
  if (!v.startsWith("+") && v.startsWith("61")) v = "+" + v;
  if (!v.startsWith("+") && v.startsWith("0") && v.length >= 9) v = "+61" + v.slice(1);
  return v;
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { list_id, message } = req.body || {};
    const userId = req.user.id;
    const listId = String(list_id || "").trim();
    const msg = String(message || "").trim();

    if (!listId) return res.status(400).json({ ok: false, error: "Missing list_id." });
    if (!msg) return res.status(400).json({ ok: false, error: "Missing message." });

    const SMSGLOBAL_API_URL = process.env.SMSGLOBAL_API_URL || "https://api.smsglobal.com/http-api.php";
    const SMSGLOBAL_USERNAME = process.env.SMSGLOBAL_USERNAME;
    const SMSGLOBAL_PASSWORD = process.env.SMSGLOBAL_PASSWORD;
    const SMSGLOBAL_FROM = process.env.SMSGLOBAL_FROM || "GR8RESULT";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ ok: false, error: "Supabase env not configured." });
    }
    if (!SMSGLOBAL_USERNAME || !SMSGLOBAL_PASSWORD) {
      return res.status(500).json({ ok: false, error: "SMSGlobal not configured." });
    }

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ============================
    // 🔥 GET PLAN LIMIT
    // ============================
    const { data: sub } = await supa
      .from("subscriptions")
      .select("plan_id")
      .eq("user_id", userId)
      .maybeSingle();

    const planId = sub?.plan_id || "free";

    const { data: plan } = await supa
      .from("plan_limits")
      .select("max_sms_per_month")
      .eq("plan_id", planId)
      .maybeSingle();

    const maxSms = plan?.max_sms_per_month ?? 0;

    // ============================
    // 🔥 GET CURRENT USAGE
    // ============================
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const { data: usage } = await supa
      .from("usage_sms")
      .select("*")
      .eq("user_id", userId)
      .gte("period_start", start.toISOString())
      .maybeSingle();

    let used = usage?.sms_sent || 0;

    // ============================
    // 🔥 GET RECIPIENTS
    // ============================
    const { data: leads, error } = await supa
      .from("leads")
      .select("id,name,phone")
      .eq("user_id", userId)
      .eq("list_id", listId);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const recipients = (leads || [])
      .map((l) => ({
        lead_id: l.id,
        name: l.name || "",
        to: normalizePhone(l.phone),
      }))
      .filter((x) => x.to && x.to.startsWith("+"));

    let smsGuard = null;
    try {
      smsGuard = await guardSmsSend(userId, recipients.length);
    } catch (limitErr) {
      return res.status(429).json({
        ok: false,
        error: limitErr.message,
        code: limitErr.code,
        details: limitErr.details,
      });
    }

    const results = [];
    let okCount = 0;
    let failCount = 0;

    for (const rcp of recipients) {

      // 🛑 STOP MID-SEND if limit hit
      if (maxSms > 0 && used >= maxSms) {
        console.log("🛑 SMS limit reached mid-send");
        break;
      }

      try {
        const params = new URLSearchParams();
        params.set("action", "sendsms");
        params.set("user", SMSGLOBAL_USERNAME);
        params.set("password", SMSGLOBAL_PASSWORD);
        params.set("from", SMSGLOBAL_FROM);
        params.set("to", rcp.to);
        params.set("text", msg);

        const url = `${SMSGLOBAL_API_URL}?${params.toString()}`;
        const http = await fetch(url, { method: "GET" });
        const raw = await http.text();

        if (!http.ok) {
          failCount++;
          results.push({ ok: false, to: rcp.to, error: raw });
          continue;
        }

        okCount++;
        used++;

        // ============================
        // 📊 UPDATE USAGE
        // ============================
        if (usage) {
          await supa
            .from("usage_sms")
            .update({ sms_sent: used })
            .eq("id", usage.id);
        } else {
          await supa
            .from("usage_sms")
            .insert({
              user_id: userId,
              sms_sent: 1,
              period_start: start.toISOString(),
            });
        }

        results.push({ ok: true, to: rcp.to });

      } catch (e) {
        failCount++;
        results.push({ ok: false, to: rcp.to, error: e.message });
      }
    }

    return res.status(200).json({
      ok: true,
      total: recipients.length,
      sent: okCount,
      failed: failCount,
      warning: Boolean(smsGuard?.policy?.shouldWarn),
      usage: smsGuard || null,
      used,
      max: maxSms,
    });

  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Bulk send failed." });
  }
}

export default withAuth(handler);
