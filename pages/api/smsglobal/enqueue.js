// /pages/api/smsglobal/enqueue.js
// FULL REPLACEMENT (NEW FILE)
//
// ✅ Enqueues SMS rows into sms_queue using YOUR schema
// ✅ Supports single + campaign steps
// ✅ Auth: Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
//
// POST body (single):
// {
//   "lead_id": "...uuid...",
//   "to_phone": "0417004315",
//   "body": "Hello there",
//   "origin": "gr8result" // optional
// }
//
// POST body (campaign):
// {
//   "lead_id": "...uuid...",
//   "to_phone": "0417004315",
//   "origin": "gr8result", // optional
//   "steps": [
//     { "step_no": 1, "body": "Msg 1", "delay_minutes": 0 },
//     { "step_no": 2, "body": "Msg 2", "delay_minutes": 1 },
//     { "step_no": 3, "body": "Msg 3", "delay_minutes": 2 }
//   ]
// }
//
// Notes:
// - scheduled_for is computed as now + delay_minutes (each step)
// - available_at is always now (so you can also use it as a fallback)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

function json(res, status, body) {
  return res.status(status).json(body);
}

function s(v) {
  return String(v ?? "").trim();
}

async function getUserFromBearer(req, supabaseAnon) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json(res, 500, { ok: false, error: "Missing Supabase env" });
  }

  const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  const user = await getUserFromBearer(req, supabaseAnon);
  if (!user) return json(res, 401, { ok: false, error: "Unauthorized (missing/invalid Bearer token)" });

  const body = req.body || {};

  const lead_id = s(body.lead_id);
  const to_phone = s(body.to_phone);
  const origin = s(body.origin) || null;

  const singleBody = s(body.body);
  const steps = Array.isArray(body.steps) ? body.steps : null;

  if (!lead_id || !to_phone) {
    return json(res, 400, { ok: false, error: "Missing lead_id or to_phone" });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  let rows = [];

  if (steps && steps.length) {
    rows = steps.map((st, idx) => {
      const step_no = Number(st?.step_no || idx + 1);
      const text = s(st?.body);
      const delayMin = Number(st?.delay_minutes || 0);

      const sched = new Date(now.getTime() + delayMin * 60 * 1000).toISOString();

      return {
        user_id: user.id,
        lead_id,
        step_no,
        to_phone,
        body: text,
        scheduled_for: sched,
        available_at: nowIso,
        status: "queued",
        origin,
      };
    });

    // validate
    const bad = rows.find((r) => !r.body);
    if (bad) return json(res, 400, { ok: false, error: "One or more steps missing body" });
  } else {
    if (!singleBody) return json(res, 400, { ok: false, error: "Missing body" });

    rows = [
      {
        user_id: user.id,
        lead_id,
        step_no: Number(body.step_no || 1),
        to_phone,
        body: singleBody,
        scheduled_for: s(body.scheduled_for) ? String(body.scheduled_for) : nowIso,
        available_at: nowIso,
        status: "queued",
        origin,
      },
    ];
  }

  const ins = await supabaseAnon.from("sms_queue").insert(rows).select("id");

  if (ins.error) {
    return json(res, 500, { ok: false, error: "Insert failed", detail: ins.error.message });
  }

  return json(res, 200, {
    ok: true,
    inserted: Array.isArray(ins.data) ? ins.data.length : rows.length,
    ids: Array.isArray(ins.data) ? ins.data.map((r) => r.id) : [],
  });
}
