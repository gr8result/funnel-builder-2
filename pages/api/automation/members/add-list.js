// /pages/api/automation/members/add-list.js
// FULL REPLACEMENT — Graph-correct trigger start + run creation

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
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "POST only" });

  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return res.status(500).json({
      ok: false,
      error: "Missing env vars",
    });
  }

  const token = getBearer(req);
  if (!token)
    return res.status(401).json({ ok: false, error: "Missing Bearer token" });

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabaseUser.auth.getUser();

  if (userErr || !user?.id)
    return res.status(401).json({ ok: false, error: "Invalid session" });

  const flow_id = String(req.body?.flow_id || "").trim();
  const list_id = String(req.body?.list_id || "").trim();

  if (!flow_id || !list_id)
    return res.status(400).json({
      ok: false,
      error: "flow_id and list_id required",
    });

  try {
    // Resolve account
    const { data: acct } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const account_id = acct?.id || null;

    const { data: flow } = await supabaseAdmin
      .from("automation_flows")
      .select("id,user_id,is_standard")
      .eq("id", flow_id)
      .maybeSingle();

    if (!flow?.id)
      return res.status(404).json({ ok: false, error: "Flow not found" });

    const owned =
      flow.is_standard === true ||
      (account_id && String(flow.user_id) === String(account_id)) ||
      String(flow.user_id) === String(user.id);

    if (!owned)
      return res.status(403).json({ ok: false, error: "Not allowed" });

    // Load leads
    const { data: leads } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("user_id", user.id)
      .eq("list_id", list_id)
      .limit(5000);

    const leadIds = (leads || []).map((l) => l.id).filter(Boolean);

    if (!leadIds.length)
      return res.json({
        ok: true,
        message: "No leads found in list",
      });

    // ...existing code...

    // FORCE: Insert all leads as members and queue jobs for each
    let imported = 0;
    let queued = 0;
    const now = new Date().toISOString();

    // Load flow definition for email node
    const { data: flowDef } = await supabaseAdmin
      .from("automation_flows")
      .select("nodes, edges")
      .eq("id", flow_id)
      .single();
    const nodes = typeof flowDef.nodes === "string" ? JSON.parse(flowDef.nodes) : flowDef.nodes || [];
    const edges = typeof flowDef.edges === "string" ? JSON.parse(flowDef.edges) : flowDef.edges || [];
    const triggerNode = nodes.find((n) => n.type === "trigger");

    // Helper: BFS to find first reachable email node from trigger
    function findFirstEmailNode(triggerId) {
      const visited = new Set();
      const queue = [triggerId];
      while (queue.length) {
        const currentId = queue.shift();
        if (visited.has(currentId)) continue;
        visited.add(currentId);
        const node = nodes.find((n) => n.id === currentId);
        if (node && node.type === "email") return node;
        // Add all outgoing edges
        edges.filter((e) => e.source === currentId).forEach((e) => queue.push(e.target));
      }
      return null;
    }

    const emailNode = triggerNode ? findFirstEmailNode(triggerNode.id) : null;
    let missingEmailNode = false;
    let debugNodes = nodes.map(n => ({ id: n.id, type: n.type, label: n.data?.label || n.data?.subject || n.id }));

    for (const leadId of leadIds) {
      // Always add member
      await supabaseAdmin.from("automation_flow_members").upsert({
        flow_id,
        lead_id: leadId,
        user_id: user.id,
        status: "active",
        source: "list_import",
        created_at: now,
        updated_at: now,
      }, { onConflict: "flow_id,lead_id" });
      imported++;

      // Only queue if email node exists
      if (emailNode) {
        // Get lead email
        let to_email = null;
        try {
          const { data: lead } = await supabaseAdmin
            .from("leads")
            .select("email")
            .eq("id", leadId)
            .maybeSingle();
          to_email = lead?.email || null;
        } catch {}

        // Get subject and html_content
        const subject = emailNode?.data?.label || emailNode?.data?.subject || "Automation Email";
        let html_content = null;
        let html_path = emailNode?.data?.htmlPath || emailNode?.data?.storagePath || null;
        if (html_path) {
          try {
            const { data, error } = await supabaseAdmin.storage
              .from(emailNode?.data?.bucket || "email-user-assets")
              .download(html_path);
            if (!error && data) {
              const ab = await data.arrayBuffer();
              html_content = Buffer.from(ab).toString("utf8");
            }
          } catch {}
        }

        await supabaseAdmin.from("automation_email_queue").insert({
          user_id: user.id,
          flow_id,
          node_id: emailNode.id,
          lead_id: leadId,
          status: "queued",
          scheduled_at: now,
          to_email,
          subject,
          html_content,
          html_path,
        });
        queued++;
      } else {
        missingEmailNode = true;
      }
    }

    if (missingEmailNode) {
      return res.status(400).json({
        ok: false,
        error: "No email node found reachable from trigger. Fix your flow structure.",
        debugNodes,
      });
    }

    return res.json({
      ok: true,
      flow_id,
      list_id,
      imported,
      queued,
      debugNodes
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: msg(e) });
  }
}
