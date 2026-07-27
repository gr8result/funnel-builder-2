import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const TABLE = "standard_inclusions_base_templates";
// Promoting/activating/archiving the system-wide base template is a
// privileged action — gated to workspace admin-tier roles as a practical
// proxy for "platform admin" (this repo has no dedicated platform-superadmin
// flag yet; any owner/admin of any workspace can manage the shared base
// template, which is a real limitation worth tightening later).
const ADMIN_ROLES = ["owner", "admin", "builder_admin"];

async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from(TABLE)
        .select("id, version, status, document_json, source_file_name, import_report, created_at, activated_at")
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return res.status(200).json({ ok: true, activeTemplate: data || null });
    }

    if (!ADMIN_ROLES.includes(req.memberRole)) {
      return res.status(403).json({ ok: false, error: "Only workspace admins can manage the shared base template." });
    }

    if (req.method === "POST") {
      const documentJson = req.body?.documentJson;
      if (!documentJson || typeof documentJson !== "object") {
        return res.status(400).json({ ok: false, error: "documentJson is required." });
      }
      const { data: lastVersion } = await supabaseAdmin
        .from(TABLE)
        .select("version")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const version = (lastVersion?.version || 0) + 1;

      const { data: created, error } = await supabaseAdmin
        .from(TABLE)
        .insert({
          version,
          status: "draft",
          document_json: documentJson,
          source_file_name: req.body?.sourceFileName || null,
          import_report: req.body?.importReport || {},
          created_by: req.user.id,
        })
        .select("*")
        .single();
      if (error) throw error;

      if (!req.body?.autoActivate) return res.status(200).json({ ok: true, template: created });

      const { data: currentlyActive } = await supabaseAdmin.from(TABLE).select("id").eq("status", "active").maybeSingle();
      if (currentlyActive?.id) {
        await supabaseAdmin.from(TABLE).update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", currentlyActive.id);
      }
      const { data: activated, error: activateError } = await supabaseAdmin
        .from(TABLE)
        .update({ status: "active", activated_at: new Date().toISOString() })
        .eq("id", created.id)
        .select("*")
        .single();
      if (activateError) throw activateError;
      return res.status(200).json({ ok: true, template: activated });
    }

    if (req.method === "PATCH") {
      const id = String(req.body?.id || "");
      const action = String(req.body?.action || "");
      if (!id || !["activate", "archive"].includes(action)) {
        return res.status(400).json({ ok: false, error: "id and a valid action ('activate' or 'archive') are required." });
      }

      if (action === "archive") {
        const { data, error } = await supabaseAdmin
          .from(TABLE)
          .update({ status: "archived", archived_at: new Date().toISOString() })
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;
        return res.status(200).json({ ok: true, template: data });
      }

      // Activate: archive whichever row is currently active (if any), then
      // promote the requested draft. Two sequential updates rather than one
      // transaction (supabase-js has no client-side multi-statement
      // transaction) — an interrupted activation leaves either the old or no
      // row active, never two, and the static bundled JSON template remains
      // available as an ultimate fallback either way.
      const { data: currentlyActive } = await supabaseAdmin.from(TABLE).select("id").eq("status", "active").maybeSingle();
      if (currentlyActive?.id && currentlyActive.id !== id) {
        await supabaseAdmin.from(TABLE).update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", currentlyActive.id);
      }
      const { data: activated, error } = await supabaseAdmin
        .from(TABLE)
        .update({ status: "active", activated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return res.status(200).json({ ok: true, template: activated });
    }

    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "Base template request failed." });
  }
}

export default withWorkspace(handler);
