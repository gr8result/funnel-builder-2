// /pages/api/automation/engine/trigger-lead.js
// FULL REPLACEMENT
// POST { flow_id, lead_id }
// ✅ Ensures lead is enrolled (automation_flow_members)
// ✅ Automatically queues the FIRST email node connected from the Trigger
// ✅ Prevents obvious duplicates (best-effort, schema-safe)
// ✅ Ownership: accounts.id OR auth.users.id (Bearer token)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function getBearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function safeJson(v, fallback) {
  try {
    if (typeof v === "string") return JSON.parse(v || "null") ?? fallback;
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

async function getAccountId(auth_user_id) {
  try {
    const { data } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("user_id", auth_user_id)
      .maybeSingle();
    return data?.id || null;
  } catch {
    return null;
  }
}

function findFirstEmailAfterTrigger(nodes, edges) {
  const trigger = (nodes || []).find((n) => n?.type === "trigger");
  if (!trigger) return null;

  // direct edge from trigger -> email
  const out = (edges || []).find((e) => e?.source === trigger.id);
  if (!out) return null;

  const email = (nodes || []).find((n) => n?.id === out.target && n?.type === "email");
  return email || null;
}

async function bestEffortAlreadyQueued({ lead_id, template_id, flow_id, node_id }) {
  // This tries to detect duplicates without knowing your exact schema.
  // If any query fails, we assume "not queued" and proceed.
  const filters = [
    async () => {
      const { count, error } = await supabaseAdmin
        .from("email_campaign_queue")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", lead_id)
        .eq("template_id", template_id)
        .eq("flow_id", flow_id)
        .eq("node_id", node_id)
        .in("status", ["queued", "processing", "sent"]);
      if (error) throw error;
      return (count || 0) > 0;
    },
    async () => {
      const { count, error } = await supabaseAdmin
        .from("email_campaign_queue")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", lead_id)
        .eq("template_id", template_id)
        .in("status", ["queued", "processing", "sent"]);
      if (error) throw error;
      return (count || 0) > 0;
    },
    async () => {
      const { count, error } = await supabaseAdmin
        .from("email_campaign_queue")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", lead_id)
        .eq("template_id", template_id);
      if (error) throw error;
      return (count || 0) > 0;
    },
  ];

  for (const fn of filters) {
    try {
      const ok = await fn();
      if (ok) return true;
    } catch {}
  }
  return false;
}

async function tryInsertQueue(rows) {
  // Try multiple payload shapes so it works with slightly different queue schemas.
  const attempts = [
    rows.map((r) => ({
      user_id: r.user_id,
      lead_id: r.lead_id,
      template_id: r.template_id,
      scheduled_at: r.scheduled_at,
      status: r.status,
      flow_id: r.flow_id,
      node_id: r.node_id,
      email_index: r.email_index,
    })),
    rows.map((r) => ({
      user_id: r.user_id,
      lead_id: r.lead_id,
      template_id: r.template_id,
      scheduled_at: r.scheduled_at,
      status: r.status,
      email_index: r.email_index,
    })),
    rows.map((r) => ({
      user_id: r.user_id,
      lead_id: r.lead_id,
      template_id: r.template_id,
      scheduled_at: r.scheduled_at,
      status: r.status,
    })),
  ];

  let lastErr = null;
  for (const payload of attempts) {
    const { error } = await supabaseAdmin.from("email_campaign_queue").insert(payload);
    if (!error) return { ok: true };
    lastErr = error;
  }
  return { ok: false, error: lastErr?.message || "Queue insert failed" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  try {
    const { flow_id, lead_id } = req.body || {};
    if (!flow_id || !lead_id) {
      return res.status(400).json({ ok: false, error: "Missing flow_id or lead_id" });
    }

    const token = getBearer(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing Bearer token" });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return res.status(401).json({ ok: false, error: "Invalid session" });
    }

    const auth_user_id = userData.user.id;
    const account_id = await getAccountId(auth_user_id);
    const owner_id = account_id || auth_user_id;

    const { data: flow, error: flowErr } = await supabaseAdmin
      .from("automation_flows")
      .select("id,user_id,is_standard,nodes,edges")
      .eq("id", flow_id)
      .single();

    if (flowErr || !flow) {
      return res.status(404).json({ ok: false, error: flowErr?.message || "Flow not found" });
    }

    const owned =
      flow.is_standard === true ||
      String(flow.user_id || "") === String(owner_id) ||
      String(flow.user_id || "") === String(auth_user_id);

    if (!owned) return res.status(403).json({ ok: false, error: "Not allowed" });

    // Ensure member enrolled
    const enrollRow = {
      user_id: owner_id,
      flow_id,
      lead_id,
      status: "active",
      source: "trigger",
      updated_at: new Date().toISOString(),
    };

    // Try with onConflict; if fails, fallback to insert+ignore
    try {
      const { error: upErr } = await supabaseAdmin
        .from("automation_flow_members")
        .upsert([enrollRow], { onConflict: "flow_id,lead_id" });

      if (upErr) throw upErr;
    } catch (e) {
      // last resort: insert (may error on dup unique, ignore if so)
      const { error: insErr } = await supabaseAdmin
        .from("automation_flow_members")
        .insert([enrollRow]);
      if (insErr) {
        const msg = String(insErr.message || "");
        if (!msg.toLowerCase().includes("duplicate")) {
          return res.status(500).json({ ok: false, error: insErr.message });
        }
      }
    }

    const nodes = safeJson(flow.nodes, []);
    const edges = safeJson(flow.edges, []);

    const firstEmail = findFirstEmailAfterTrigger(nodes, edges);
    if (!firstEmail) {
      return res.json({
        ok: true,
        enrolled: true,
        queued: 0,
        message: "No Email node connected from Trigger.",
      });
    }

    const template_id =
      firstEmail?.data?.template_id ||
      firstEmail?.data?.email_template_id ||
      firstEmail?.data?.templateId ||
      null;

    if (!template_id) {
      return res.status(400).json({ ok: false, error: "Email node missing template_id" });
    }

    // Best-effort duplicate protection
    const already = await bestEffortAlreadyQueued({
      lead_id,
      template_id,
      flow_id,
      node_id: firstEmail.id,
    });

    if (already) {
      return res.json({
        ok: true,
        enrolled: true,
        queued: 0,
        message: "Lead already has first email queued.",
      });
    }

    const now = new Date().toISOString();
    const rows = [
      {
        user_id: owner_id,
        lead_id,
        template_id,
        scheduled_at: now,
        status: "queued",
        flow_id,
        node_id: firstEmail.id,
        email_index: 1,
      },
    ];

    const ins = await tryInsertQueue(rows);
    if (!ins.ok) return res.status(500).json({ ok: false, error: ins.error });

    return res.json({
      ok: true,
      enrolled: true,
      queued: 1,
      message: "Lead triggered and first email queued.",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
