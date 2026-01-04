// /pages/api/smsglobal/launch-sequence.js
// FULL REPLACEMENT — queues a 1–3 step SMS sequence into sms_queue
//
// ✅ user_id is OPTIONAL (does NOT block queueing)
// ✅ Fixes list member loading with fallback tables
// ✅ Fixes fragile join by resolving phones via separate leads query
// ✅ Accepts audience fields: phone/to/number and list_id/lead_list_id
// ✅ Accepts step message fields: message/text/body/content
// ✅ Delay is "since previous step" (cumulative scheduling)
// ✅ Returns real error messages (no mystery "Server error")

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function s(v) {
  return String(v ?? "").trim();
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || "").trim()
  );
}

function msFrom(delay, unit) {
  const d = Number(delay || 0);
  if (!isFinite(d) || d < 0) return 0;
  const u = String(unit || "minutes").toLowerCase();
  if (u.startsWith("day")) return d * 24 * 60 * 60 * 1000;
  if (u.startsWith("hour")) return d * 60 * 60 * 1000;
  return d * 60 * 1000; // minutes default
}

function applyTokens(text, tokens) {
  let out = String(text || "");
  const t = tokens || {};
  out = out.replaceAll("{brand}", s(t.brand) || "");
  out = out.replaceAll("{link}", s(t.link) || "");
  return out;
}

function normalizePhoneVariants(raw) {
  const p = s(raw);
  const noSpaces = p.replace(/\s+/g, "");
  const digits = p.replace(/[^\d+]/g, "");
  const onlyDigits = p.replace(/\D/g, "");

  const variants = new Set();
  if (p) variants.add(p);
  if (noSpaces) variants.add(noSpaces);
  if (digits) variants.add(digits);
  if (onlyDigits) variants.add(onlyDigits);

  // AU best-effort
  if (onlyDigits && onlyDigits.startsWith("61")) variants.add("+" + onlyDigits);
  if (onlyDigits && onlyDigits.startsWith("0")) {
    variants.add("+61" + onlyDigits.slice(1));
    variants.add("61" + onlyDigits.slice(1));
  }

  return Array.from(variants).filter(Boolean).slice(0, 15);
}

function admin() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    const e = new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    e.missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => {
      if (k === "SUPABASE_URL") {
        return !process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL;
      }
      return !process.env.SUPABASE_SERVICE_ROLE_KEY;
    });
    throw e;
  }

  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveOrCreateLeadId(sb, { lead_id, phone, user_id }) {
  if (isUuid(lead_id)) return lead_id;

  const p = s(phone);
  if (!p) return null;

  // try find by phone variants
  const variants = normalizePhoneVariants(p);

  const { data: found, error: findErr } = await sb
    .from("leads")
    .select("id, phone")
    .in("phone", variants)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!findErr && found && found.length) return found[0].id;

  // create minimal lead
  // NOTE: if your leads table requires user_id NOT NULL, we try with user_id when valid.
  const insertRow = isUuid(user_id) ? { phone: p, user_id } : { phone: p };

  const { data: created, error: createErr } = await sb
    .from("leads")
    .insert([insertRow])
    .select("id")
    .single();

  if (createErr) throw createErr;
  return created?.id || null;
}

async function loadListMemberLeadIds(sb, list_id) {
  // Your project has bounced between table names, so we try several.
  const candidates = [
    "lead_lists_members",
    "leads_lists_members",
    "lead_list_members",
    "leads_list_members",
    "crm_list_members",
  ];

  for (const table of candidates) {
    const { data, error } = await sb
      .from(table)
      .select("lead_id")
      .eq("list_id", list_id)
      .limit(10000);

    if (!error && Array.isArray(data)) {
      const ids = data.map((r) => r.lead_id).filter((id) => isUuid(id));
      return { ok: true, table, leadIds: ids };
    }
  }

  return {
    ok: false,
    table: null,
    leadIds: [],
    error:
      "Could not load list members (tried lead_lists_members / lead_list_members variants).",
  };
}

async function loadPhonesForLeadIds(sb, leadIds) {
  if (!leadIds?.length) return new Map();

  // Fetch in chunks to avoid URL/row limits
  const out = new Map();
  const chunkSize = 800;

  for (let i = 0; i < leadIds.length; i += chunkSize) {
    const chunk = leadIds.slice(i, i + chunkSize);

    const { data, error } = await sb
      .from("leads")
      .select("id, phone")
      .in("id", chunk)
      .limit(chunkSize);

    if (error) throw error;

    (data || []).forEach((r) => {
      const id = s(r.id);
      const phone = s(r.phone);
      if (isUuid(id) && phone) out.set(id, phone);
    });
  }

  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  try {
    const sb = admin();

    const body = req.body || {};

    // user_id OPTIONAL
    const user_id_raw = s(body.user_id || body.userId || "");
    const user_id = isUuid(user_id_raw) ? user_id_raw : null;

    const lead_id_in = s(body.lead_id || body.leadId || "");

    const audience = body.audience || {};
    const tokens = body.tokens || { brand: body.brand, link: body.link };

    // steps payload can be in steps or steps_payload; accept both
    const stepsRaw = Array.isArray(body.steps)
      ? body.steps
      : Array.isArray(body.steps_payload)
      ? body.steps_payload
      : [];

    const type = s(audience.type || body.audience_type || body.audienceType || "single").toLowerCase();

    const steps = stepsRaw
      .map((st, idx) => {
        const msg =
          s(st?.message) ||
          s(st?.text) ||
          s(st?.body) ||
          s(st?.content) ||
          "";
        return {
          step_no: Number(st?.step_no || st?.step || st?.stepNo || idx + 1),
          delay: Number(st?.delay ?? 0),
          unit: s(st?.unit || st?.delay_unit || "minutes"),
          message: msg,
        };
      })
      .filter((st) => st.step_no >= 1 && st.step_no <= 3);

    const hasAnyMessage = steps.some((st) => s(applyTokens(st.message, tokens)));
    if (!hasAnyMessage) {
      return res.status(400).json({ ok: false, error: "No steps with message content." });
    }

    let targets = [];

    if (type === "single") {
      const phone =
        s(audience.phone) || s(audience.to) || s(audience.number) || s(body.phone) || "";

      if (!phone) return res.status(400).json({ ok: false, error: "Missing audience.phone" });

      const resolvedLeadId = await resolveOrCreateLeadId(sb, {
        lead_id: lead_id_in,
        phone,
        user_id,
      });

      if (!isUuid(resolvedLeadId)) {
        return res.status(400).json({
          ok: false,
          error: "Could not resolve lead_id for this phone.",
        });
      }

      targets = [{ lead_id: resolvedLeadId, to_phone: phone }];
    } else if (type === "list") {
      const list_id =
        s(audience.list_id) ||
        s(audience.lead_list_id) ||
        s(audience.listId) ||
        s(audience.leadListId) ||
        s(body.list_id) ||
        "";

      if (!isUuid(list_id)) {
        return res.status(400).json({ ok: false, error: "Missing/invalid audience.list_id" });
      }

      const mem = await loadListMemberLeadIds(sb, list_id);
      if (!mem.ok) {
        return res.status(500).json({
          ok: false,
          error: "Failed to load list members",
          detail: mem.error,
        });
      }

      const phoneMap = await loadPhonesForLeadIds(sb, mem.leadIds);

      targets = mem.leadIds
        .map((lid) => ({
          lead_id: lid,
          to_phone: s(phoneMap.get(lid)),
        }))
        .filter((t) => isUuid(t.lead_id) && t.to_phone);
    } else {
      return res.status(400).json({ ok: false, error: "Invalid audience.type" });
    }

    if (!targets.length) {
      return res.status(400).json({ ok: false, error: "No targets to send to." });
    }

    const now = Date.now();
    const rows = [];

    for (const target of targets) {
      let accMs = 0;
      const ordered = [...steps].sort((a, b) => a.step_no - b.step_no);

      for (const st of ordered) {
        const msg = s(applyTokens(st.message, tokens));
        if (!msg) continue;

        accMs += msFrom(st.delay, st.unit);

        rows.push({
          user_id: user_id, // nullable OK if your sms_queue allows it
          lead_id: target.lead_id,
          step_no: st.step_no,
          to_phone: s(target.to_phone),
          body: msg,
          scheduled_for: new Date(now + accMs).toISOString(),
          status: "queued",
        });
      }
    }

    if (!rows.length) {
      return res.status(400).json({ ok: false, error: "No valid queued rows generated." });
    }

    const { data: inserted, error: insErr } = await sb
      .from("sms_queue")
      .insert(rows)
      .select("id");

    if (insErr) {
      return res.status(500).json({
        ok: false,
        error: "Insert failed.",
        detail: insErr.message || String(insErr),
      });
    }

    return res.status(200).json({
      ok: true,
      queued: rows.length,
      ids: (inserted || []).map((x) => x.id),
    });
  } catch (err) {
    console.error("launch-sequence error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message ? "Server error" : "Server error",
      detail: err?.message || String(err),
      missing: err?.missing || null,
    });
  }
}
