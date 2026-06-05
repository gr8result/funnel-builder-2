import { withAuth } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import {
  calculateVaultCompletion,
  createEmptyVaultData,
} from "../../../components/account/businessProfileVaultConfig";

function normalizeStatus(status, fallback = "in_progress") {
  const allowed = new Set([
    "not_started",
    "in_progress",
    "submitted",
    "under_review",
    "verified",
    "needs_attention",
  ]);
  return allowed.has(status) ? status : fallback;
}

async function getAccount(userId) {
  const { data } = await supabaseAdmin
    .from("accounts")
    .select("id, full_name, email, phone, business_name, abn, business_email, website, business_address, status, approved, verified")
    .eq("user_id", userId)
    .maybeSingle();
  return data || null;
}

function mergeAccountDefaults(baseData, account, user) {
  const next = { ...createEmptyVaultData(), ...(baseData || {}) };

  next.account_holder_verification = {
    ...next.account_holder_verification,
    fullLegalName: next.account_holder_verification?.fullLegalName || account?.full_name || "",
    mobileNumber: next.account_holder_verification?.mobileNumber || account?.phone || "",
    emailAddress: next.account_holder_verification?.emailAddress || user?.email || account?.email || "",
    emailVerificationStatus:
      next.account_holder_verification?.emailVerificationStatus ||
      (user?.email_confirmed_at ? "Verified" : "Pending"),
  };

  next.business_information = {
    ...next.business_information,
    legalBusinessName: next.business_information?.legalBusinessName || account?.business_name || "",
    abn: next.business_information?.abn || account?.abn || "",
    businessEmail: next.business_information?.businessEmail || account?.business_email || "",
    websiteUrl: next.business_information?.websiteUrl || account?.website || "",
    businessAddress: next.business_information?.businessAddress || account?.business_address || "",
  };

  next.website_domain_information = {
    ...next.website_domain_information,
    websiteUrl: next.website_domain_information?.websiteUrl || account?.website || "",
  };

  return next;
}

async function loadVault(user) {
  const account = await getAccount(user.id);
  const { data: existing, error } = await supabaseAdmin
    .from("business_profile_vaults")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (existing) {
    return {
      vault: {
        ...existing,
        data: mergeAccountDefaults(existing.data, account, user),
      },
      account,
    };
  }

  const data = mergeAccountDefaults(null, account, user);
  const completion = calculateVaultCompletion(data);
  const { data: created, error: insertError } = await supabaseAdmin
    .from("business_profile_vaults")
    .insert({
      user_id: user.id,
      account_id: account?.id || null,
      status: completion > 0 ? "in_progress" : "not_started",
      completion_percent: completion,
      data,
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return { vault: created, account };
}

async function loadDocuments(vaultId, userId) {
  const { data, error } = await supabaseAdmin
    .from("business_profile_documents")
    .select("*")
    .eq("vault_id", vaultId)
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { vault, account } = await loadVault(req.user);
      const documents = await loadDocuments(vault.id, req.user.id);
      return res.status(200).json({ ok: true, vault, account, documents });
    }

    if (req.method === "PUT" || req.method === "POST") {
      const { vault } = await loadVault(req.user);
      const data = { ...createEmptyVaultData(), ...(req.body?.data || {}) };
      const completion = calculateVaultCompletion(data);
      const submitting = req.method === "POST";

      const update = {
        data,
        completion_percent: completion,
        status: submitting ? "submitted" : normalizeStatus(req.body?.status, completion > 0 ? "in_progress" : "not_started"),
        updated_at: new Date().toISOString(),
      };

      if (submitting) {
        update.submitted_at = new Date().toISOString();
      }

      const { data: saved, error } = await supabaseAdmin
        .from("business_profile_vaults")
        .update(update)
        .eq("id", vault.id)
        .eq("user_id", req.user.id)
        .select("*")
        .single();

      if (error) throw error;

      await supabaseAdmin
        .from("accounts")
        .update({
          full_name: data.account_holder_verification?.fullLegalName || null,
          phone: data.account_holder_verification?.mobileNumber || null,
          email: data.account_holder_verification?.emailAddress || req.user.email || null,
          business_name: data.business_information?.legalBusinessName || null,
          abn: data.business_information?.abn || null,
          business_email: data.business_information?.businessEmail || null,
          website: data.business_information?.websiteUrl || data.website_domain_information?.websiteUrl || null,
          business_address: data.business_information?.businessAddress || null,
          application_json: data,
          status: submitting ? "submitted" : "in_progress",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", req.user.id);

      const documents = await loadDocuments(saved.id, req.user.id);
      return res.status(200).json({ ok: true, vault: saved, documents });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    console.error("business-profile-vault error:", error);
    return res.status(500).json({ ok: false, error: error.message || "Vault request failed" });
  }
}

export default withAuth(handler);
