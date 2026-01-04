// /pages/api/email/process-campaign-queue-impl.js
// FULL REPLACEMENT — Campaign queue → SendGrid sender

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SENDGRID_API_KEY =
  process.env.SENDGRID_API_KEY ||
  process.env.GR8_MAIL_SEND_ONLY ||
  process.env.SENDGRID_KEY ||
  "";

const MAX_BATCH = 25;

function clean(v) {
  return String(v ?? "").trim();
}
function isEmail(v) {
  const s = clean(v).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function nowISO() {
  return new Date().toISOString();
}

function json(res, status, body) {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

const supabaseAdmin =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Use POST" });
  }

  if (!supabaseAdmin) {
    return json(res, 500, {
      ok: false,
      error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const sg = clean(SENDGRID_API_KEY);
  if (!sg || !sg.startsWith("SG.")) {
    return json(res, 500, {
      ok: false,
      error:
        "Missing/invalid SENDGRID_API_KEY (or GR8_MAIL_SEND_ONLY). Must start with SG.",
    });
  }

  const limit = Math.max(1, Math.min(Number(req.body?.limit || MAX_BATCH), 50));

  const { data: jobs, error } = await supabaseAdmin
    .from("email_campaigns_queue")
    .select(
      "id,to_email,from_email,from_name,subject,html,scheduled_at,status,attempts,processing"
    )
    .in("status", ["queued", "scheduled"])
    .eq("processing", false)
    .lte("scheduled_at", nowISO())
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error) return json(res, 500, { ok: false, error: error.message });
  if (!jobs?.length)
    return json(res, 200, { ok: true, processed: 0, sent: 0, failed: 0 });

  let sent = 0;
  let failed = 0;
  const results = [];

  for (const job of jobs) {
    const attemptNum = Number(job.attempts || 0) + 1;

    await supabaseAdmin
      .from("email_campaigns_queue")
      .update({
        processing: true,
        claimed_at: nowISO(),
        processing_at: nowISO(),
        attempts: attemptNum,
        last_error: null,
      })
      .eq("id", job.id);

    try {
      const to = clean(job.to_email).toLowerCase();
      const fromEmail = clean(job.from_email);
      const fromName = clean(job.from_name);
      const subject = clean(job.subject);
      const html = clean(job.html);

      if (!isEmail(to)) throw new Error("Missing/invalid to_email");
      if (!isEmail(fromEmail)) throw new Error("Missing/invalid from_email");
      if (!subject) throw new Error("Missing subject");
      if (!html) throw new Error("Missing html");

      const payload = {
        personalizations: [{ to: [{ email: to }], subject }],
        from: fromName ? { email: fromEmail, name: fromName } : { email: fromEmail },
        content: [{ type: "text/html", value: html }],
      };

      const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sg}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const msgId = sgRes.headers.get("x-message-id") || null;

      if (!sgRes.ok) {
        const txt = await sgRes.text().catch(() => "");
        throw new Error(`SendGrid ${sgRes.status}: ${txt || sgRes.statusText}`);
      }

      await supabaseAdmin
        .from("email_campaigns_queue")
        .update({
          status: "sent",
          sent_at: nowISO(),
          processed_at: nowISO(),
          processing: false,
          sendgrid_message_id: msgId,
          last_error: null,
        })
        .eq("id", job.id);

      sent++;
      results.push({ id: job.id, ok: true, sendgrid_message_id: msgId });
    } catch (e) {
      const msg = clean(e?.message || e || "Unknown error");

      await supabaseAdmin
        .from("email_campaigns_queue")
        .update({
          status: "error",
          processed_at: nowISO(),
          processing: false,
          last_error: msg,
        })
        .eq("id", job.id);

      failed++;
      results.push({ id: job.id, ok: false, error: msg });
    }
  }

  return json(res, 200, {
    ok: true,
    processed: sent + failed,
    sent,
    failed,
    results,
  });
}
