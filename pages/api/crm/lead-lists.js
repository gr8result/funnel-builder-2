import { randomUUID } from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";

function cleanString(value) {
  return String(value ?? "").trim();
}

function columnFromError(error) {
  const msg = String(error?.message || error?.details || "");
  return (
    msg.match(/'([^']+)' column/)?.[1] ||
    msg.match(/column "([^"]+)"/)?.[1] ||
    msg.match(/Could not find the '([^']+)'/)?.[1] ||
    ""
  );
}

async function insertAdaptive(table, payload) {
  let row = { ...payload };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabaseAdmin.from(table).insert(row).select("*").single();
    if (!error) return { data, error: null };
    const column = columnFromError(error);
    if (!column || !(column in row)) return { data: null, error };
    delete row[column];
  }
  return { data: null, error: new Error(`Could not insert ${table}`) };
}

async function updateAdaptive(table, id, workspaceId, payload) {
  let row = { ...payload };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .update(row)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();
    if (!error) return { data, error: null };
    const column = columnFromError(error);
    if (!column || !(column in row)) return { data: null, error };
    delete row[column];
  }
  return { data: null, error: new Error(`Could not update ${table}`) };
}

async function listCounts(workspaceId) {
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("list_id")
    .eq("workspace_id", workspaceId);
  if (error || !Array.isArray(data)) return {};
  return data.reduce((acc, row) => {
    const id = row?.list_id || "__none__";
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});
}

function isMissingColumn(error, column) {
  return String(error?.message || error?.details || "").toLowerCase().includes(column.toLowerCase());
}

async function fetchListsForScope({ workspaceId, userId }) {
  const byWorkspace = await supabaseAdmin
    .from("lead_lists")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (!byWorkspace.error) {
    const workspaceRows = byWorkspace.data || [];
    const { data: userRows } = await supabaseAdmin
      .from("lead_lists")
      .select("*")
      .eq("user_id", userId)
      .is("workspace_id", null)
      .order("created_at", { ascending: true });
    const merged = new Map();
    [...workspaceRows, ...(userRows || [])].forEach((row) => merged.set(row.id, row));
    return { data: [...merged.values()], error: null };
  }

  if (!isMissingColumn(byWorkspace.error, "workspace_id")) {
    return byWorkspace;
  }

  return supabaseAdmin
    .from("lead_lists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
}

async function handler(req, res) {
  const { workspaceId, user } = req;

  try {
    if (req.method === "GET") {
      const counts = await listCounts(workspaceId);
      const { data, error } = await fetchListsForScope({ workspaceId, userId: user.id });
      if (error) return res.status(500).json({ ok: false, error: error.message });
      const lists = (data || []).map((list) => ({
        ...list,
        color: list.color || list.color_tag || "#2563eb",
        lead_count: counts[list.id] || 0,
      }));
      return res.status(200).json({ ok: true, lists });
    }

    if (req.method === "POST") {
      const action = cleanString(req.body?.action || "create");

      if (action === "duplicate") {
        const sourceId = cleanString(req.body?.id);
        if (!sourceId) return res.status(400).json({ ok: false, error: "Missing list id" });
        const { data: source, error: sourceErr } = await supabaseAdmin
          .from("lead_lists")
          .select("*")
          .eq("id", sourceId)
          .eq("workspace_id", workspaceId)
          .maybeSingle();
        if (sourceErr || !source) return res.status(404).json({ ok: false, error: "List not found" });
        const copy = {
          ...source,
          id: randomUUID(),
          name: `${source.name || "List"} copy`,
          created_at: new Date().toISOString(),
        };
        delete copy.lead_count;
        const { data, error } = await insertAdaptive("lead_lists", copy);
        if (error) return res.status(500).json({ ok: false, error: error.message });
        return res.status(200).json({ ok: true, list: { ...data, lead_count: 0 } });
      }

      const name = cleanString(req.body?.name);
      if (!name) return res.status(400).json({ ok: false, error: "List name is required" });
      const payload = {
        user_id: user.id,
        workspace_id: workspaceId,
        name,
        source_type: cleanString(req.body?.source_type) || null,
        tags: cleanString(req.body?.tags) || null,
        action: cleanString(req.body?.actionType || req.body?.route || "None") || "None",
        auto_add_crm: Boolean(req.body?.auto_add_crm),
        color: cleanString(req.body?.color || req.body?.color_tag || "#2563eb"),
        color_tag: cleanString(req.body?.color || req.body?.color_tag || "#2563eb"),
        created_at: new Date().toISOString(),
      };
      const { data, error } = await insertAdaptive("lead_lists", payload);
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(201).json({ ok: true, list: { ...data, lead_count: 0 } });
    }

    if (req.method === "PATCH") {
      const id = cleanString(req.body?.id);
      if (!id) return res.status(400).json({ ok: false, error: "Missing list id" });
      const fields = {};
      if ("name" in req.body) fields.name = cleanString(req.body.name);
      if ("source_type" in req.body) fields.source_type = cleanString(req.body.source_type) || null;
      if ("tags" in req.body) fields.tags = cleanString(req.body.tags) || null;
      if ("color" in req.body || "color_tag" in req.body) {
        fields.color = cleanString(req.body.color || req.body.color_tag || "#2563eb");
        fields.color_tag = fields.color;
      }
      if ("actionType" in req.body) fields.action = cleanString(req.body.actionType) || "None";
      if ("auto_add_crm" in req.body) fields.auto_add_crm = Boolean(req.body.auto_add_crm);
      const { data, error } = await updateAdaptive("lead_lists", id, workspaceId, fields);
      if (error) return res.status(500).json({ ok: false, error: error.message });
      const counts = await listCounts(workspaceId);
      return res.status(200).json({ ok: true, list: { ...data, lead_count: counts[id] || 0 } });
    }

    if (req.method === "DELETE") {
      const id = cleanString(req.body?.id || req.query?.id);
      if (!id) return res.status(400).json({ ok: false, error: "Missing list id" });
      const { error: leadErr } = await supabaseAdmin
        .from("leads")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("list_id", id);
      if (leadErr) return res.status(500).json({ ok: false, error: leadErr.message });
      const { error } = await supabaseAdmin
        .from("lead_lists")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspaceId);
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}

export default withWorkspace(handler);
