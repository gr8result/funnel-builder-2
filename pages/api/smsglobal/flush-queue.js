// /pages/api/smsglobal/flush-queue.js
// FULL REPLACEMENT
//
// ✅ Pulls due rows from public.sms_queue and sends them via SMSGlobal
// ✅ Secure with key if SMSGLOBAL_CRON_SECRET / SMSGLOBAL_CRON_KEY set
// ✅ AUTO-HANDLES unknown sms_queue schemas (message/to/send_after column names differ)
// ✅ Avoids schema-cache crashes by retrying select mappings
//
// NOTE: If SMSGlobal returns 403, this file will report the provider response body.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE;

const SMSGLOBAL_API_KEY = (process.env.SMSGLOBAL_API_KEY || "").trim();
const SMSGLOBAL_API_SECRET = (process.env.SMSGLOBAL_API_SECRET || "").trim();

const CRON_SECRET =
  (process.env.SMSGLOBAL_CRON_SECRET || "").trim() ||
  (process.env.SMSGLOBAL_CRON_KEY || "").trim();

const DEFAULT_SMS_ORIGIN = (process.env.DEFAULT_SMS_ORIGIN || "gr8result").trim();

function s(v) {
  return String(v ?? "").trim();
}

function sanitizeOrigin(origin) {
  let o = s(origin);
  if (!o) return "";
  o = o.replace(/[^a-zA-Z0-9]/g, "");
  if (o.length > 11) o = o.slice(0, 11);
  return o;
}

async function sendSmsGlobal({ to, message, origin }) {
  const url = "https://api.smsglobal.com/v2/sms/";

  const payload = {
    destination: s(to),
    message: s(message),
  };

  const o = sanitizeOrigin(origin);
  if (o) payload.origin = o;

  const auth = Buffer.from(`${SMSGLOBAL_API_KEY}:${SMSGLOBAL_API_SECRET}`).toString("base64");

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!resp.ok) {
    return {
      ok: false,
      http: resp.status,
      body: data,
    };
  }

  const provider_id = data?.messages?.[0]?.id || data?.id || null;

  return {
    ok: true,
    provider_id,
    body: data,
  };
}

async function readDueQueueRows(supabase, limit, nowIso) {
  const messageCols = ["message", "sms_message", "body", "content", "text"];
  const toCols = ["to", "phone", "destination"];
  const timeCols = ["send_after", "scheduled_at", "scheduled_for", "available_at"];

  let lastErr = null;

  for (const msgCol of messageCols) {
    for (const toCol of toCols) {
      for (const timeCol of timeCols) {
        // Select only columns we KNOW exist by trial.
        const sel = `id,user_id,lead_id,provider_id,error,created_at,updated_at,status,${toCol},${msgCol},${timeCol}`;

        const { data, error } = await supabase
          .from("sms_queue")
          .select(sel)
          .in("status", ["pending", "retry"])
          .lte(timeCol, nowIso)
          .order(timeCol, { ascending: true })
          .limit(limit);

        if (!error) {
          return {
            ok: true,
            rows: data || [],
            mapping: { msgCol, toCol, timeCol },
          };
        }

        lastErr = error;
      }
    }
  }

  return { ok: false, error: lastErr?.message || "Failed to read sms_queue" };
}

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ ok: false, error: "Missing Supabase env" });
  }
  if (!SMSGLOBAL_API_KEY || !SMSGLOBAL_API_SECRET) {
    return res.status(500).json({ ok: false, error: "Missing SMSGlobal env" });
  }

  // Auth (only if secret is set)
  if (CRON_SECRET) {
    const key =
      s(req.query.key) ||
      s(req.headers["x-cron-key"]) ||
      (s(req.headers.authorization).startsWith("Bearer ")
        ? s(req.headers.authorization).slice(7)
        : "");

    if (key !== CRON_SECRET) {
      return res.status(401).json({ ok: false, error: "Unauthorized (missing/invalid key)" });
    }
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const limit = Math.min(Number(req.query.limit || 25) || 25, 100);
  const nowIso = new Date().toISOString();

  const got = await readDueQueueRows(supabase, limit, nowIso);
  if (!got.ok) {
    return res.status(500).json({ ok: false, error: "Failed to read sms_queue", detail: got.error });
  }

  const { rows, mapping } = got;
  const msgCol = mapping.msgCol;
  const toCol = mapping.toCol;

  let processed = 0;
  let sent = 0;
  let failed = 0;
  const results = [];

  for (const row of rows || []) {
    processed++;

    const to = s(row?.[toCol]);
    const message = s(row?.[msgCol]);
    const used_origin = sanitizeOrigin(DEFAULT_SMS_ORIGIN) || "gr8result";

    const resp = await sendSmsGlobal({ to, message, origin: used_origin });

    if (resp.ok) {
      sent++;

      const upd = await supabase
        .from("sms_queue")
        .update({
          status: "done",
          provider_id: resp.provider_id,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      results.push({
        id: row.id,
        ok: true,
        provider_id: resp.provider_id,
        used_origin,
        db_ok: !upd.error,
      });
    } else {
      failed++;

      await supabase
        .from("sms_queue")
        .update({
          status: "failed",
          error: JSON.stringify(resp.body || { http: resp.http }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      results.push({
        id: row.id,
        ok: false,
        used_origin,
        smsglobal_http: resp.http,
        smsglobal_body: resp.body,
      });
    }
  }

  return res.status(200).json({
    ok: true,
    mapping_used: mapping,
    processed,
    sent,
    failed,
    results,
  });
}
