// /pages/api/twilio/recording-callback.js
// FULL REPLACEMENT
//
// ✅ Receives Twilio recordingStatusCallback
// ✅ Updates public.crm_calls by CallSid
// ✅ Stores recording_sid + recording_url (browser-playable via /api/twilio/recording)
//
// ENV REQUIRED:
//   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE / SUPABASE_SERVICE_KEY / SUPABASE_SERVICE)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE;

function s(v) {
  return String(v ?? "").trim();
}

export default async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ ok: false, error: "Missing Supabase env" });
    }

    const body = await readBody(req);

    const lead_id = s(req.query.lead_id);

    const CallSid = s(body.CallSid);
    const RecordingSid = s(body.RecordingSid);
    const RecordingStatus = s(body.RecordingStatus);
    const RecordingDuration = body.RecordingDuration != null ? Number(body.RecordingDuration) : null;

    if (!CallSid) {
      return res.status(400).json({ ok: false, error: "Missing CallSid" });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: existing } = await supabase
      .from("crm_calls")
      .select("id")
      .eq("twilio_sid", CallSid)
      .maybeSingle();

    const recording_url =
      RecordingSid && RecordingSid.startsWith("RE")
        ? `/api/twilio/recording?sid=${encodeURIComponent(RecordingSid)}`
        : null;

    const patch = {
      lead_id: lead_id || null,
      recording_sid: RecordingSid || null,
      recording_url,
      status: RecordingStatus || null,
      recording_duration: Number.isFinite(RecordingDuration) ? RecordingDuration : null,
    };

    if (existing?.id) {
      await supabase.from("crm_calls").update(patch).eq("id", existing.id);
    } else {
      await supabase.from("crm_calls").insert({
        twilio_sid: CallSid,
        lead_id: lead_id || null,
        ...patch,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("recording-callback error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");

  try {
    return JSON.parse(raw);
  } catch {}

  const out = {};
  raw
    .split("&")
    .map((p) => p.split("="))
    .forEach(([k, v]) => {
      if (!k) return;
      out[decodeURIComponent(k)] = decodeURIComponent((v || "").replace(/\+/g, " "));
    });

  return out;
}
