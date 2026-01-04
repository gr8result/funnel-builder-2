// /pages/api/automation/members/add-list.js
// FULL REPLACEMENT
// POST { flow_id, list_id, list_table? }
//
// ✅ Imports members from whichever list table exists
// ✅ Supports ownership by accounts.id OR auth.users.id
// ✅ Tries member tables in order:
//    - email_list_members (email_lists)
//    - lead_list_members (lead_lists)
//    - list_members (lists)
// ✅ Creates leads if missing, then upserts automation_flow_members
// ✅ AUTO-START: Enqueues the FIRST node after the Trigger into automation_queue (no "Run Now" required)

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

function isMissingTable(err) {
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    err?.code === "42P01"
  );
}

async function getAccountId(auth_user_id) {
  try {
    const { data, error } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("user_id", auth_user_id)
      .maybeSingle();
    if (error) return null;
    return data?.id || null;
  } catch {
    return null;
  }
}

async function findListRecord(list_id, ownerIds, preferredTable = null) {
  const listTables = preferredTable
    ? [preferredTable, "email_lists", "lead_lists", "lists"].filter(
        (v, i, a) => a.indexOf(v) === i
      )
    : ["email_lists", "lead_lists", "lists"];

  for (const table of listTables) {
    try {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select("id,name,user_id")
        .eq("id", list_id)
        .single();

      if (error) {
        if (isMissingTable(error)) continue;
        const msg = String(error.message || "").toLowerCase();
        if (msg.includes("0 rows") || msg.includes("multiple")) continue;
        continue;
      }

      const owner = String(data?.user_id || "");
      const okOwner = ownerIds.some((o) => String(o) === owner);
      if (!okOwner) return { ok: false, error: "List not owned by user" };

      return { ok: true, table, list: data };
    } catch (e) {
      if (isMissingTable(e)) continue;
    }
  }

  return { ok: false, error: "List not found" };
}

async function fetchMembersForList(list_id, list_table) {
  const tries =
    list_table === "email_lists"
      ? ["email_list_members", "lead_list_members", "list_members"]
      : list_table === "lead_lists"
      ? ["lead_list_members", "email_list_members", "list_members"]
      : ["list_members", "email_list_members", "lead_list_members"];

  for (const memTable of tries) {
    try {
      const { data, error } = await supabaseAdmin
        .from(memTable)
        .select("email,name,phone")
        .eq("list_id", list_id);

      if (error) {
        if (isMissingTable(error)) continue;
        return { ok: false, error: error.message };
      }

      return { ok: true, table: memTable, members: data || [] };
    } catch (e) {
      if (isMissingTable(e)) continue;
      return { ok: false, error: e?.message || String(e) };
    }
  }

  return { ok: true, table: null, members: [] };
}

// ---------------- FLOW LOADING + GRAPH HELPERS ----------------

async function loadFlow(flow_id, ownerIds) {
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

      const owner = String(data?.user_id || "");
      const okOwner = ownerIds.some((o) => String(o) === owner);
      if (!okOwner) return { ok: false, error: "Flow not owned by user" };

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

      return { ok: true, table: t.table, jsonCol: t.jsonCol, flow: flow_json };
    } catch (e) {
      if (isMissingTable(e)) continue;
    }
  }

  return { ok: false, error: "Flow not found" };
}

function normalizeFlowGraph(flow_json) {
  // expected shapes:
  // { nodes: [...], edges: [...] }
  // or { reactflow: { nodes, edges } }
  const g =
    flow_json?.reactflow?.nodes && flow_json?.reactflow?.edges
      ? flow_json.reactflow
      : flow_json;

  const nodes = Array.isArray(g?.nodes) ? g.nodes : [];
  const edges = Array.isArray(g?.edges) ? g.edges : [];
  return { nodes, edges };
}

function findTriggerNodeId(nodes) {
  // try common patterns
  const trigger =
    nodes.find((n) => n?.type === "trigger") ||
    nodes.find((n) => n?.data?.kind === "trigger") ||
    nodes.find((n) => String(n?.data?.label || "").toLowerCase().includes("lead")) ||
    nodes[0];
  return trigger?.id || null;
}

function findFirstOutgoing(edges, fromId) {
  const e = edges.find((x) => x?.source === fromId);
  return e?.target || null;
}

function firstNodeAfterTrigger(flow_json) {
  const { nodes, edges } = normalizeFlowGraph(flow_json);
  const trigId = findTriggerNodeId(nodes);
  if (!trigId) return null;
  return findFirstOutgoing(edges, trigId);
}

async function safeInsertQueueRows(rows) {
  if (!rows.length) return { ok: true, inserted: 0 };

  // Try insert; if duplicates exist, you can still allow duplicates OR implement de-dupe by checking existing.
  // We'll de-dupe by checking existing pending rows for (flow_id, lead_id, next_node_id, status=pending)
  const flow_id = rows[0].flow_id;
  const leadIds = rows.map((r) => r.lead_id).filter(Boolean);
  const nextNodeIds = Array.from(new Set(rows.map((r) => r.next_node_id).filter(Boolean)));

  try {
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("automation_queue")
      .select("id,lead_id,next_node_id,status")
      .eq("flow_id", flow_id)
      .in("lead_id", leadIds)
      .in("next_node_id", nextNodeIds)
      .eq("status", "pending");

    if (!exErr) {
      const exists = new Set(
        (existing || []).map((x) => `${x.lead_id}:${x.next_node_id}:pending`)
      );
      const filtered = rows.filter(
        (r) => !exists.has(`${r.lead_id}:${r.next_node_id}:pending`)
      );
      if (!filtered.length) return { ok: true, inserted: 0 };

      const { error: insErr } = await supabaseAdmin
        .from("automation_queue")
        .insert(filtered);

      if (insErr) return { ok: false, error: insErr.message };
      return { ok: true, inserted: filtered.length };
    }
  } catch {
    // fall through to simple insert
  }

  const { error } = await supabaseAdmin.from("automation_queue").insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true, inserted: rows.length };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  try {
    const { flow_id, list_id, list_table } = req.body || {};
    if (!flow_id || !list_id) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing flow_id or list_id" });
    }

    const token = getBearer(req);
    if (!token)
      return res.status(401).json({ ok: false, error: "Missing Bearer token" });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(
      token
    );
    if (userErr || !userData?.user?.id) {
      return res.status(401).json({ ok: false, error: "Invalid session" });
    }

    const auth_user_id = userData.user.id;
    const account_id = await getAccountId(auth_user_id);
    const ownerIds = [account_id, auth_user_id].filter(Boolean);

    const listFound = await findListRecord(list_id, ownerIds, list_table || null);
    if (!listFound.ok) {
      return res.status(404).json({ ok: false, error: listFound.error });
    }

    const { table: detectedListTable, list } = listFound;

    const mem = await fetchMembersForList(list_id, detectedListTable);
    if (!mem.ok) return res.status(500).json({ ok: false, error: mem.error });

    const rawMembers = mem.members || [];
    const emails = Array.from(
      new Set(
        rawMembers
          .map((m) => String(m.email || "").trim().toLowerCase())
          .filter(Boolean)
      )
    );

    if (emails.length === 0) {
      return res.json({
        ok: true,
        list_name: list?.name || null,
        list_table: detectedListTable,
        members_table: mem.table,
        imported: 0,
        leads_created: 0,
        enrolled: 0,
        enqueued: 0,
      });
    }

    // IMPORTANT: your leads table uses user_id (likely accounts.id).
    const leads_owner_id = account_id || auth_user_id;

    const { data: existingLeads, error: existingErr } = await supabaseAdmin
      .from("leads")
      .select("id,email")
      .eq("user_id", leads_owner_id)
      .in("email", emails);

    if (existingErr)
      return res.status(500).json({ ok: false, error: existingErr.message });

    const leadMap = new Map(
      (existingLeads || []).map((l) => [
        String(l.email || "").toLowerCase(),
        l.id,
      ])
    );

    const toInsert = [];
    for (const m of rawMembers) {
      const email = String(m.email || "").trim().toLowerCase();
      if (!email || leadMap.has(email)) continue;
      toInsert.push({
        user_id: leads_owner_id,
        email,
        name: m.name || null,
        phone: m.phone || null,
        list_id, // keep lead tied to list
      });
    }

    let leads_created = 0;
    if (toInsert.length > 0) {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("leads")
        .insert(toInsert)
        .select("id,email");

      if (insErr)
        return res.status(500).json({ ok: false, error: insErr.message });

      for (const l of inserted || []) {
        leadMap.set(String(l.email || "").toLowerCase(), l.id);
      }
      leads_created = inserted?.length || 0;
    }

    const enroll = [];
    for (const email of emails) {
      const lead_id = leadMap.get(email);
      if (!lead_id) continue;

      enroll.push({
        user_id: leads_owner_id,
        flow_id,
        lead_id,
        status: "active",
        source: "list",
        list_id,
      });
    }

    let enrolled = 0;
    if (enroll.length > 0) {
      const { data, error: upErr } = await supabaseAdmin
        .from("automation_flow_members")
        .upsert(enroll, { onConflict: "flow_id,lead_id" })
        .select("id,lead_id");

      if (upErr)
        return res.status(500).json({ ok: false, error: upErr.message });

      enrolled = data?.length || 0;
    }

    // ✅ AUTO-START: enqueue first node after trigger for all enrolled leads
    const flowLoaded = await loadFlow(flow_id, ownerIds);
    if (!flowLoaded.ok) {
      // flow missing shouldn't block list import; just return enrolled
      return res.json({
        ok: true,
        list_name: list?.name || null,
        list_table: detectedListTable,
        members_table: mem.table,
        imported: emails.length,
        leads_created,
        enrolled,
        enqueued: 0,
        warn: flowLoaded.error,
      });
    }

    const next_node_id = firstNodeAfterTrigger(flowLoaded.flow);
    if (!next_node_id) {
      return res.json({
        ok: true,
        list_name: list?.name || null,
        list_table: detectedListTable,
        members_table: mem.table,
        imported: emails.length,
        leads_created,
        enrolled,
        enqueued: 0,
        warn: "No node connected after trigger",
      });
    }

    const now = new Date().toISOString();
    const queueRows = [];
    for (const email of emails) {
      const lead_id = leadMap.get(email);
      if (!lead_id) continue;

      queueRows.push({
        user_id: leads_owner_id,
        subscriber_id: lead_id, // keep compatibility with your existing column naming
        flow_id,
        lead_id,
        list_id,
        next_node_id,
        run_at: now,
        status: "pending",
        created_at: now,
        updated_at: now,
      });
    }

    const q = await safeInsertQueueRows(queueRows);
    if (!q.ok) {
      return res.json({
        ok: true,
        list_name: list?.name || null,
        list_table: detectedListTable,
        members_table: mem.table,
        imported: emails.length,
        leads_created,
        enrolled,
        enqueued: 0,
        warn: `Queue insert failed: ${q.error}`,
      });
    }

    return res.json({
      ok: true,
      list_name: list?.name || null,
      list_table: detectedListTable,
      members_table: mem.table,
      imported: emails.length,
      leads_created,
      enrolled,
      enqueued: q.inserted,
      first_node_id: next_node_id,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || String(e) });
  }
}
