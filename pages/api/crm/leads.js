// /pages/api/crm/leads.js
// GET  — list leads for workspace
// POST — create a lead in workspace
// PATCH — update a lead in workspace
// DELETE — delete a lead in workspace
//
// All operations are scoped to workspace_id and require authentication.
import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getLimit } from "../../../lib/featureGates";

function pickPhone(row) {
  const candidates = [
    row.phone, row.mobile, row.mobile_phone, row.phone_number,
    row.telephone, row.contact_number,
  ]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter(Boolean);
  return candidates[0] || "";
}

function pickName(row) {
  const full = String(row.full_name ?? row.name ?? "").trim();
  if (full) return full;
  const first = String(row.first_name ?? "").trim();
  const last = String(row.last_name ?? "").trim();
  return `${first} ${last}`.trim() || "Unnamed lead";
}

const VALID_STATUSES = new Set(["new", "assigned", "contacted", "quoted", "won", "lost"]);

async function handler(req, res) {
  const { workspaceId, user } = req;

  try {
    // ── GET: list leads ──────────────────────────────────────────────────────
    if (req.method === "GET") {
      const limit = Math.min(
        Math.max(parseInt(String(req.query.limit || "500"), 10) || 500, 1),
        2000
      );
      const { status, stage, search, owner, list_id: listId } = req.query;

      let q = supabaseAdmin
        .from("leads")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status && VALID_STATUSES.has(status)) q = q.eq("lead_status", status);
      if (stage) q = q.eq("stage", stage);
      if (owner) q = q.eq("lead_owner_user_id", owner);
      if (listId) q = q.eq("list_id", listId);
      if (search) {
        q = q.or(
          `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
        );
      }

      const { data: rows, error } = await q;
      if (error) throw error;

      const leads = (rows || []).map((r) => ({
        id: r.id,
        name: pickName(r),
        phone: pickPhone(r),
        mobile: r.mobile || "",
        company: r.company || "",
        email: r.email || "",
        first_name: r.first_name || "",
        last_name: r.last_name || "",
        address: r.address || "",
        city: r.city || "",
        state: r.state || "",
        postcode: r.postcode || "",
        country: r.country || "",
        website: r.website || "",
        tags: r.tags || "",
        notes: r.notes || "",
        source: r.source || r.lead_source || "",
        list_id: r.list_id || "",
        lead_status: r.lead_status || "new",
        lead_source: r.lead_source || "",
        stage: r.stage || "",
        lead_owner_user_id: r.lead_owner_user_id || null,
        created_at: r.created_at,
        updated_at: r.updated_at,
        raw: r,
      }));

      return res.status(200).json({ ok: true, leads });
    }

    // ── POST: create lead ────────────────────────────────────────────────────
    if (req.method === "POST") {
      const {
        name, email, phone, company,
        lead_status = "new", lead_source, stage,
        notes, tags, funnel_id, page_id, list,
      } = req.body || {};

      if (!email && !name) {
        return res.status(400).json({ ok: false, error: "email or name is required" });
      }

      // ── QUOTA CHECK ──────────────────────────────────────────────────────
      const { data: wsRow } = await supabaseAdmin
        .from("workspaces")
        .select("plan")
        .eq("id", workspaceId)
        .maybeSingle();

      const plan = wsRow?.plan || "starter";
      const leadLimit = getLimit(plan, "leads");

      if (leadLimit !== null) {
        const { count: leadCount, error: countErr } = await supabaseAdmin
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId);

        if (!countErr && leadCount >= leadLimit) {
          return res.status(429).json({
            ok: false,
            code: "LEAD_LIMIT_EXCEEDED",
            error: `Lead limit reached (${leadLimit} on ${plan} plan). Upgrade to add more.`,
            limit: leadLimit,
            used: leadCount,
          });
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      const payload = {
        workspace_id: workspaceId,
        user_id: user.id,
        name: name || null,
        email: email || null,
        phone: phone || null,
        company: company || null,
        lead_status: VALID_STATUSES.has(lead_status) ? lead_status : "new",
        lead_source: lead_source || null,
        stage: stage || null,
        notes: notes || null,
        tags: Array.isArray(tags) ? tags : [],
        funnel_id: funnel_id || null,
        page_id: page_id || null,
        list: list || "default",
      };

      const { data, error } = await supabaseAdmin
        .from("leads")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      return res.status(201).json({ ok: true, lead: data });
    }

    // ── PATCH: update lead ───────────────────────────────────────────────────
    if (req.method === "PATCH") {
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ ok: false, error: "id required" });

      // Prevent workspace hijacking
      delete fields.workspace_id;
      delete fields.user_id;

      if (fields.lead_status && !VALID_STATUSES.has(fields.lead_status)) {
        return res.status(400).json({ ok: false, error: `Invalid lead_status. Must be one of: ${[...VALID_STATUSES].join(", ")}` });
      }

      fields.updated_at = new Date();

      const { data, error } = await supabaseAdmin
        .from("leads")
        .update(fields)
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .select("*")
        .single();
      if (error) throw error;
      return res.status(200).json({ ok: true, lead: data });
    }

    // ── DELETE: remove lead ──────────────────────────────────────────────────
    if (req.method === "DELETE") {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ ok: false, error: "id required" });

      const { error } = await supabaseAdmin
        .from("leads")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    console.error("[/api/crm/leads]", e);
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}

export default withWorkspace(handler);
