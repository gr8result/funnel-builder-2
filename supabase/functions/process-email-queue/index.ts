// /supabase/functions/process-email-queue/index.ts
// FULL REPLACEMENT — NEVER CRASHES (no WORKER_ERROR) + SendGrid send + timeouts
// ✅ Uses SENDGRID_API_KEY OR GR8_MAIL_SEND_ONLY
// ✅ Strong outer try/catch so Edge Function always returns JSON
// ✅ Handles queued + scheduled where scheduled_at <= now()
// ✅ Marks jobs processing/claimed, then sent/error
// ✅ Hard timeouts so Hoppscotch never spins forever
// ✅ CORS + OPTIONS

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(origin: string | null, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function isEmail(v: unknown) {
  const s = clean(v).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function nowISO() {
  return new Date().toISOString();
}

function getEnvAny(keys: string[]) {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

const MAX_BATCH = 25;
const SENDGRID_TIMEOUT_MS = 12000;

serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors(origin) });
  }

  if (req.method !== "POST") {
    return json(origin, 405, { ok: false, error: "Use POST" });
  }

  try {
    // ---- auth (cron secret) ----
    const expectedSecret = getEnvAny(["EMAIL_QUEUE_SECRET", "CRON_SECRET"]);
    const gotSecret = clean(req.headers.get("x-cron-secret"));

    if (!expectedSecret) {
      return json(origin, 500, {
        ok: false,
        error: "Missing EMAIL_QUEUE_SECRET (or CRON_SECRET) in Supabase Function secrets",
      });
    }
    if (gotSecret !== expectedSecret) {
      return json(origin, 401, { ok: false, error: "Unauthorized" });
    }

    // ---- env ----
    const SUPABASE_URL = getEnvAny(["SUPABASE_URL", "PROJECT_URL"]);
    const SERVICE_KEY = getEnvAny([
      "SUPABASE_SERVICE_ROLE_KEY",
      "SERVICE_ROLE_KEY",
    ]);

    const SENDGRID_KEY = getEnvAny(["SENDGRID_API_KEY", "GR8_MAIL_SEND_ONLY"]);

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return json(origin, 500, {
        ok: false,
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Supabase Function secrets",
      });
    }
    if (!SENDGRID_KEY) {
      return json(origin, 500, {
        ok: false,
        error: "Missing SENDGRID_API_KEY (or GR8_MAIL_SEND_ONLY) in Supabase Function secrets",
      });
    }
    if (!SENDGRID_KEY.startsWith("SG.")) {
      return json(origin, 500, {
        ok: false,
        error: "SendGrid key looks invalid (must start with SG.)",
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // ---- load due jobs ----
    const { data: jobs, error: jobsErr } = await supabase
      .from("email_campaigns_queue")
      .select(
        [
          "id",
          "to_email",
          "from_email",
          "from_name",
          "subject",
          "html",
          "scheduled_at",
          "attempts",
          "processing",
          "status",
        ].join(",")
      )
      .in("status", ["queued", "scheduled"])
      .eq("processing", false)
      .lte("scheduled_at", nowISO())
      .order("scheduled_at", { ascending: true })
      .limit(MAX_BATCH);

    if (jobsErr) {
      return json(origin, 500, { ok: false, error: jobsErr.message });
    }

    if (!jobs || jobs.length === 0) {
      return json(origin, 200, { ok: true, processed: 0, sent: 0, failed: 0 });
    }

    let sent = 0;
    let failed = 0;
    const results: any[] = [];

    for (const job of jobs) {
      const jobId = job.id;
      const attemptNum = Number(job.attempts || 0) + 1;

      // claim
      await supabase
        .from("email_campaigns_queue")
        .update({
          processing: true,
          claimed_at: nowISO(),
          processing_at: nowISO(),
          attempts: attemptNum,
          last_error: null,
        })
        .eq("id", jobId);

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

        const payload: any = {
          personalizations: [{ to: [{ email: to }], subject }],
          from: fromName
            ? { email: fromEmail, name: fromName }
            : { email: fromEmail },
          content: [{ type: "text/html", value: html }],
        };

        const sgRes = await fetchWithTimeout(
          "https://api.sendgrid.com/v3/mail/send",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SENDGRID_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
          SENDGRID_TIMEOUT_MS
        );

        const msgId = sgRes.headers.get("x-message-id") || null;

        if (!sgRes.ok) {
          const txt = await sgRes.text().catch(() => "");
          throw new Error(
            `SendGrid ${sgRes.status}: ${txt || sgRes.statusText || "Error"}`
          );
        }

        await supabase
          .from("email_campaigns_queue")
          .update({
            status: "sent",
            sent_at: nowISO(),
            processed_at: nowISO(),
            processing: false,
            sendgrid_message_id: msgId,
            last_error: null,
          })
          .eq("id", jobId);

        sent++;
        results.push({ id: jobId, ok: true, sendgrid_message_id: msgId });
      } catch (e) {
        const msg = clean((e as any)?.message || e || "Unknown error");

        await supabase
          .from("email_campaigns_queue")
          .update({
            status: "error",
            processed_at: nowISO(),
            processing: false,
            last_error: msg,
          })
          .eq("id", jobId);

        failed++;
        results.push({ id: jobId, ok: false, error: msg });
      }
    }

    return json(origin, 200, {
      ok: true,
      processed: sent + failed,
      sent,
      failed,
      results,
    });
  } catch (e) {
    // ✅ absolutely never crash
    const msg = clean((e as any)?.message || e || "Unknown crash");
    return json(origin, 500, { ok: false, error: msg });
  }
});
