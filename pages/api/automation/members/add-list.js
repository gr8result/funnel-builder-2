// /pages/api/automation/members/add-list.js
// FULL REPLACEMENT
//
// ✅ Correct ownership check:
//    - automation_flows.user_id is accounts.id
//    - request user is auth.users.id
//    - so we map auth uid -> accounts.id and compare to flow.user_id
//
// ✅ Correct list membership source:
//    - Imports leads via public.lead_list_members (NOT leads.list_id, NOT email_list_members)
//
// ✅ Inserts automation_flow_members with:
//    - user_id = auth uid (matches your automation_flow_members schema)
//    - flow_id, lead_id
//
// ✅ Idempotent via upsert on (flow_id, lead_id)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();

const SERVICE_KEY =
  (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE ||
    ""
  ).trim();

const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

function msg(err) {
  return err?.message || err?.hint || err?.details || String(err || "");
}

function getBearer(req) {
  const auth = String(req.headers.authorization || "").trim();
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return (m?.[1] || "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return res.status(500).json({
      ok: false,
      error: "Missing env",
      need: [
        "NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)",
        "SUPABASE_SERVICE_ROLE_KEY (or variants)",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      ],
    });
  }

  const token = getBearer(req);
  if (!token) return res.status(401).json({ ok: false, error: "Missing Bearer token" });

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Authenticated client to read the current user
  const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabaseUser.auth.getUser();

  if (userErr || !user?.id) {
    return res.status(401).json({ ok: false, error: "Invalid session", detail: msg(userErr) });
  }

  const flow_id = String(req.body?.flow_id || "").trim();
  const list_id = String(req.body?.list_id || "").trim();

  if (!flow_id || !list_id) {
    return res.status(400).json({
      ok: false,
      error: "flow_id and list_id are required",
      got: { flow_id: !!flow_id, list_id: !!list_id },
    });
  }

  try {
    // 1) Resolve account_id for this auth user (accounts.id)
    const { data: acct, error: acctErr } = await supabaseAdmin
      .from("accounts")
      .select("id,user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (acctErr) throw acctErr;
    const account_id = acct?.id || null;

    // 2) Load flow owner (flow.user_id = accounts.id)
    const { data: flow, error: flowErr } = await supabaseAdmin
      .from("automation_flows")
      .select("id,user_id,name,is_standard")
      .eq("id", flow_id)
      .maybeSingle();

    if (flowErr) throw flowErr;
    if (!flow?.id) return res.status(404).json({ ok: false, error: "Flow not found" });

    // Allow standard flows, otherwise require ownership match
    const owned =
      flow.is_standard === true ||
      (account_id && String(flow.user_id) === String(account_id)) ||
      // legacy tolerance (if any old flows store auth uid)
      String(flow.user_id) === String(user.id);

    if (!owned) {
      return res.status(403).json({
        ok: false,
        error: "Not allowed for this flow",
        debug: { flow_owner: flow.user_id, account_id, auth_user_id: user.id },
      });
    }

    // 3) Pull lead_ids from lead_list_members for this list
    // and join to leads to ensure the leads belong to the same auth user.
    const { data: rows, error: rowsErr } = await supabaseAdmin
      .from("lead_list_members")
      .select("lead_id, leads!lead_list_members_lead_id_fkey!inner(id,user_id)")
      .eq("list_id", list_id)
      .eq("leads.user_id", user.id)
      .limit(10000);

    if (rowsErr) throw rowsErr;

    const leadIds = (rows || []).map((r) => r.lead_id).filter(Boolean);

    if (!leadIds.length) {
      return res.json({
        ok: true,
        flow_id,
        list_id,
        imported: 0,
        skipped: 0,
        message: "No leads found in that list for this user (lead_list_members -> leads.user_id).",
      });
    }

    // 4) Upsert into automation_flow_members (your table requires user_id, flow_id, lead_id)
    // NOTE: this requires a UNIQUE constraint on (flow_id, lead_id) for onConflict to work properly.
    const now = new Date().toISOString();
    const payload = leadIds.map((lead_id) => ({
      user_id: user.id, // auth uid
      flow_id,
      lead_id,
      status: "active",
      source: "list_import",
      created_at: now,
      updated_at: now,
    }));

    const { error: upErr } = await supabaseAdmin
      .from("automation_flow_members")
      .upsert(payload, { onConflict: "flow_id,lead_id" });

    if (upErr) throw upErr;

    return res.json({
      ok: true,
      flow_id,
      list_id,
      imported: leadIds.length,
      skipped: 0,
      note: "Upsert used (duplicates automatically ignored).",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: msg(e) });
  }
}
