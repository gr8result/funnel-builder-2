// /pages/api/email/automations/worker.js
// FULL REPLACEMENT
//
// ✅ Processes automation_queue rows (pending, run_at <= now)
// ✅ Walks the flow graph node-by-node (email/delay passthrough)
// ✅ Sends the first Email node automatically (no Run Now)
// ✅ Enqueues the next node automatically
// ✅ Writes basic activity rows to lead_activity IF the table exists (safe/no-crash)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SENDGRID_KEY =
  process.env.GR8_MAIL_SEND_ONLY || process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL =
  process.env.SENDGRID_FROM_EMAIL || "no-reply@gr8result.com";
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || "GR8 RESULT";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function isMissingTable(err) {
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    err?.code === "42P01"
  );
}

async function safeInsertActivity(row) {
  if (!row?.lead_id) return;
  try {
    const { error } = await supabaseAdmin.from("lead_activity").insert([row]);
    if (error && isMissingTable(error)) return;
  } catch {
    return;
  }
}

async function loadFlow(flow_id) {
  const flowTables = [
    { table: "automation_flows", jsonCol: "flow_json" },
    { table: "automation_flows", jsonCol: "definition" },
    { table: "email_automations", jsonCol: "flow_json" },
    { table: "email_automations", jsonCol: "definition" },
    { table: "automation_workflows", jsonCol: "flow_json" },
    { table: "automation_workflows", jsonCol: "definition" },
  ];

  for (const t of flowTables) {
    try {
      const { data, error } = await supabaseAdmin
        .from(t.table)
        .select(`id,user_id,${t.jsonCol}`)
        .eq("id", flow_id)
        .single();

      if (error) {
        if (isMissingTable(error)) continue;
        const msg = String(error.message || "").toLowerCase();
        if (msg.includes("0 rows") || msg.includes("multiple")) continue;
        continue;
      }

      const raw = data?.[t.jsonCol];
      const flow_json =
        typeof raw === "string"
          ? (() => {
              try {
                return JSON.parse(raw);
              } catch {
                return null;
              }
            })()
          : raw;

      if (!flow_json) continue;

      return { ok: true, user_id: data.user_id, flow: flow_json };
    } catch (e) {
      if (isMissingTable(e)) continue;
    }
  }

  return { ok: false, error: "Flow not found" };
}

function normalizeFlowGraph(flow_json) {
  const g =
    flow_json?.reactflow?.nodes && flow_json?.reactflow?.edges
      ? flow_json.reactflow
      : flow_json;
  const nodes = Array.isArray(g?.nodes) ? g.nodes : [];
  const edges = Array.isArray(g?.edges) ? g.edges : [];
  return { nodes, edges };
}

function findNode(nodes, id) {
  return nodes.find((n) => String(n?.id) === String(id)) || null;
}

function firstOutgoing(edges, fromId) {
  const e = edges.find((x) => x?.source === fromId);
  return e?.target || null;
}

function parseDelayMinutes(node) {
  const d = node?.data || {};
  const m =
    d.minutes ??
    d.delay_minutes ??
    d.delayMinutes ??
    d.value ??
    d.amount ??
    null;
  const num = Number(m);
  if (!isFinite(num) || num < 0) return 0;
  return Math.round(num);
}

async function sendEmailForNode({ lead, node }) {
  if (!SENDGRID_KEY) throw new Error("Missing SENDGRID_API_KEY / GR8_MAIL_SEND_ONLY");
  if (!lead?.email) throw new Error("Lead has no email");

  const d = node?.data || {};
  const to = lead.email;

  // supports:
  // - d.sendgrid_template_id (preferred)
  // - d.template_id (alias)
  // - d.subject + d.html (fallback)
  const templateId = d.sendgrid_template_id || d.template_id || null;
  const subject = d.subject || "Hello from GR8 RESULT";
  const html = d.html || d.emailHtml || null;

  const payload = templateId
    ? {
        personalizations: [
          {
            to: [{ email: to, name: lead.name || undefined }],
            dynamic_template_data: {
              lead_name: lead.name || "",
              lead_email: lead.email || "",
              lead_phone: lead.phone || "",
              ...(d.dynamic_template_data || {}),
            },
          },
        ],
        from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
        template_id: templateId,
      }
    : {
        personalizations: [{ to: [{ email: to, name: lead.name || undefined }] }],
        from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
        subject,
        content: [
          {
            type: "text/html",
            value: html || `<p>${subject}</p>`,
          },
        ],
      };

  const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SENDGRID_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`SendGrid failed (${resp.status}): ${txt}`.slice(0, 800));
  }

  return true;
}

async function enqueueNext({
  user_id,
  flow_id,
  lead_id,
  list_id,
  next_node_id,
  run_at_iso,
}) {
  if (!next_node_id) return;

  const nowIso = new Date().toISOString();
  const row = {
    user_id,
    subscriber_id: lead_id,
    flow_id,
    lead_id,
    list_id: list_id || null,
    next_node_id,
    run_at: run_at_iso || nowIso,
    status: "pending",
    created_at: nowIso,
    updated_at: nowIso,
  };

  // prevent duplicates for same pending step
  try {
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("automation_queue")
      .select("id")
      .eq("flow_id", flow_id)
      .eq("lead_id", lead_id)
      .eq("next_node_id", next_node_id)
      .eq("status", "pending")
      .maybeSingle();

    if (!exErr && existing?.id) return;
  } catch {
    // ignore
  }

  await supabaseAdmin.from("automation_queue").insert([row]);
}

async function markJob(job_id, patch) {
  const nowIso = new Date().toISOString();
  await supabaseAdmin
    .from("automation_queue")
    .update({ ...patch, updated_at: nowIso })
    .eq("id", job_id);
}

async function processOneJob(job) {
  const now = new Date();
  const nowIso = now.toISOString();

  const flowLoaded = await loadFlow(job.flow_id);
  if (!flowLoaded.ok) {
    await markJob(job.id, { status: "failed", error: flowLoaded.error || "Flow missing" });
    await safeInsertActivity({
      lead_id: job.lead_id,
      user_id: job.user_id,
      type: "automation_error",
      message: `Flow missing: ${flowLoaded.error || "unknown"}`,
      created_at: nowIso,
    });
    return;
  }

  const { nodes, edges } = normalizeFlowGraph(flowLoaded.flow);
  const node = findNode(nodes, job.next_node_id);

  if (!node) {
    await markJob(job.id, { status: "failed", error: "Node not found in flow" });
    await safeInsertActivity({
      lead_id: job.lead_id,
      user_id: job.user_id,
      type: "automation_error",
      message: `Node not found: ${job.next_node_id}`,
      created_at: nowIso,
    });
    return;
  }

  // load lead
  const { data: lead, error: leadErr } = await supabaseAdmin
    .from("leads")
    .select("id,user_id,email,name,phone")
    .eq("id", job.lead_id)
    .maybeSingle();

  if (leadErr || !lead?.id) {
    await markJob(job.id, { status: "failed", error: "Lead not found" });
    return;
  }

  // common: mark "entered node"
  await safeInsertActivity({
    lead_id: lead.id,
    user_id: job.user_id,
    type: "automation_enter_node",
    message: `Entered node: ${node?.data?.title || node?.data?.label || node.type || node.id}`,
    meta: {
      flow_id: job.flow_id,
      node_id: node.id,
      node_type: node.type,
    },
    created_at: nowIso,
  });

  const nodeType = String(node.type || node?.data?.type || "").toLowerCase();

  // figure next target
  const nextTarget = firstOutgoing(edges, node.id);

  if (nodeType === "delay") {
    const mins = parseDelayMinutes(node);
    const runAt = new Date(Date.now() + mins * 60 * 1000).toISOString();

    await markJob(job.id, { status: "done", processed_at: nowIso });

    await safeInsertActivity({
      lead_id: lead.id,
      user_id: job.user_id,
      type: "automation_delay",
      message: `Delay started: ${mins} minute${mins === 1 ? "" : "s"}`,
      meta: { flow_id: job.flow_id, node_id: node.id, minutes: mins },
      created_at: nowIso,
    });

    await enqueueNext({
      user_id: job.user_id,
      flow_id: job.flow_id,
      lead_id: lead.id,
      list_id: job.list_id,
      next_node_id: nextTarget,
      run_at_iso: runAt,
    });

    return;
  }

  if (nodeType === "email") {
    try {
      await safeInsertActivity({
        lead_id: lead.id,
        user_id: job.user_id,
        type: "automation_email_queue",
        message: `Email sending: ${node?.data?.title || node?.data?.label || "Email"}`,
        meta: { flow_id: job.flow_id, node_id: node.id },
        created_at: nowIso,
      });

      await sendEmailForNode({ lead, node });

      await safeInsertActivity({
        lead_id: lead.id,
        user_id: job.user_id,
        type: "automation_email_sent",
        message: `Email sent: ${node?.data?.title || node?.data?.label || "Email"}`,
        meta: { flow_id: job.flow_id, node_id: node.id },
        created_at: nowIso,
      });

      await markJob(job.id, { status: "done", processed_at: nowIso });

      await enqueueNext({
        user_id: job.user_id,
        flow_id: job.flow_id,
        lead_id: lead.id,
        list_id: job.list_id,
        next_node_id: nextTarget,
        run_at_iso: nowIso,
      });

      return;
    } catch (e) {
      await markJob(job.id, {
        status: "failed",
        error: String(e?.message || e).slice(0, 800),
      });

      await safeInsertActivity({
        lead_id: lead.id,
        user_id: job.user_id,
        type: "automation_error",
        message: `Email failed: ${String(e?.message || e).slice(0, 300)}`,
        meta: { flow_id: job.flow_id, node_id: node.id },
        created_at: nowIso,
      });

      return;
    }
  }

  // default passthrough (trigger/condition/etc)
  await markJob(job.id, { status: "done", processed_at: nowIso });

  await enqueueNext({
    user_id: job.user_id,
    flow_id: job.flow_id,
    lead_id: lead.id,
    list_id: job.list_id,
    next_node_id: nextTarget,
    run_at_iso: nowIso,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Use GET or POST" });
  }

  try {
    const limit = Math.min(Number(req.query.limit || 25), 100);
    const nowIso = new Date().toISOString();

    const { data: jobs, error } = await supabaseAdmin
      .from("automation_queue")
      .select("*")
      .eq("status", "pending")
      .lte("run_at", nowIso)
      .order("run_at", { ascending: true })
      .limit(limit);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    let processed = 0;
    let failed = 0;

    for (const job of jobs || []) {
      // lock job quickly
      await markJob(job.id, { status: "processing" });

      try {
        await processOneJob(job);
        processed += 1;
      } catch (e) {
        failed += 1;
        await markJob(job.id, {
          status: "failed",
          error: String(e?.message || e).slice(0, 800),
        });
      }
    }

    return res.json({
      ok: true,
      now: nowIso,
      found: jobs?.length || 0,
      processed,
      failed,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
