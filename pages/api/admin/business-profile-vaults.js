import withAdmin from "../../../lib/withAdmin";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const STATUSES = new Set([
  "not_started",
  "in_progress",
  "submitted",
  "under_review",
  "verified",
  "needs_attention",
]);

function normalizeStatus(value) {
  return STATUSES.has(value) ? value : null;
}

async function listVaults(req, res) {
  const status = normalizeStatus(req.query.status);
  let query = supabaseAdmin
    .from("business_profile_vaults")
    .select(`
      *,
      accounts:account_id(id, full_name, email, business_name, phone)
    `)
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;
  return res.status(200).json({ ok: true, vaults: data || [] });
}

async function getVault(req, res) {
  const { id } = req.query;
  const { data: vault, error } = await supabaseAdmin
    .from("business_profile_vaults")
    .select(`
      *,
      accounts:account_id(id, full_name, email, business_name, phone)
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!vault) return res.status(404).json({ ok: false, error: "Vault not found" });

  const { data: documents, error: docError } = await supabaseAdmin
    .from("business_profile_documents")
    .select("*")
    .eq("vault_id", vault.id)
    .order("uploaded_at", { ascending: false });

  if (docError) throw docError;
  return res.status(200).json({ ok: true, vault, documents: documents || [] });
}

async function updateVault(req, res) {
  const { id, status, adminNotes, needsAttentionReason } = req.body || {};
  const nextStatus = normalizeStatus(status);

  if (!id || !nextStatus) {
    return res.status(400).json({ ok: false, error: "id and valid status are required" });
  }

  const update = {
    status: nextStatus,
    admin_notes: adminNotes || null,
    needs_attention_reason: needsAttentionReason || null,
    reviewed_by: req.user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: vault, error } = await supabaseAdmin
    .from("business_profile_vaults")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  if (vault?.account_id && nextStatus === "verified") {
    await supabaseAdmin
      .from("accounts")
      .update({
        is_approved: true,
        approved: true,
        verified: true,
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", vault.account_id);
  }

  if (vault?.account_id && nextStatus === "needs_attention") {
    await supabaseAdmin
      .from("accounts")
      .update({
        verified: false,
        status: "needs_attention",
        updated_at: new Date().toISOString(),
      })
      .eq("id", vault.account_id);
  }

  return res.status(200).json({ ok: true, vault });
}

async function handler(req, res) {
  try {
    if (req.method === "GET" && req.query.id) return getVault(req, res);
    if (req.method === "GET") return listVaults(req, res);
    if (req.method === "PATCH" || req.method === "POST") return updateVault(req, res);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    console.error("admin business-profile-vaults error:", error);
    return res.status(500).json({ ok: false, error: error.message || "Admin vault request failed" });
  }
}

export default withAdmin(handler);
