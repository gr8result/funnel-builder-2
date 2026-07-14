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

function isMissingSchemaError(error) {
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  const hint = String(error?.hint || "").toLowerCase();
  const text = `${message} ${details} ${hint}`;
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    text.includes("schema cache") ||
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("business_profile_vaults") ||
    text.includes("business_profile_documents")
  );
}

function missingSchemaColumn(error) {
  const message = String(error?.message || "");
  const details = String(error?.details || "");
  const text = `${message} ${details}`;
  const match = text.match(/'([^']+)'\s+column/i) || text.match(/column\s+"?([a-zA-Z0-9_]+)"?/i);
  return match?.[1] || "";
}

async function getAccount(userId) {
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("business-profile-vault account lookup error:", error);
  }

  return data || null;
}

function mergeAccountDefaults(baseData, account, user) {
  const savedApplication =
    account?.application_json && typeof account.application_json === "object"
      ? account.application_json
      : {};
  const next = { ...createEmptyVaultData(), ...savedApplication, ...(baseData || {}) };

  next.account_holder_verification = {
    ...next.account_holder_verification,
    fullLegalName: next.account_holder_verification?.fullLegalName || account?.full_name || "",
    positionRole: next.account_holder_verification?.positionRole || account?.role || account?.position || "",
    mobileNumber: next.account_holder_verification?.mobileNumber || account?.phone || "",
    emailAddress: next.account_holder_verification?.emailAddress || user?.email || account?.email || "",
    emailVerificationStatus:
      next.account_holder_verification?.emailVerificationStatus ||
      (user?.email_confirmed_at || account?.email_verified ? "Verified" : "Pending"),
    smsVerificationStatus:
      next.account_holder_verification?.smsVerificationStatus ||
      (account?.phone_verified ? "Verified" : "Pending"),
  };

  next.business_information = {
    ...next.business_information,
    legalBusinessName: next.business_information?.legalBusinessName || account?.business_name || "",
    abn: next.business_information?.abn || account?.abn || "",
    businessEmail: next.business_information?.businessEmail || account?.business_email || "",
    websiteUrl: next.business_information?.websiteUrl || account?.website || "",
    businessAddress: next.business_information?.businessAddress || account?.business_address || "",
    businessPhone: next.business_information?.businessPhone || account?.business_phone || account?.phone || "",
  };

  next.website_domain_information = {
    ...next.website_domain_information,
    websiteUrl: next.website_domain_information?.websiteUrl || account?.website || "",
  };

  next.email_sending_domain = {
    ...next.email_sending_domain,
    sendingDomain: next.email_sending_domain?.sendingDomain || account?.dkim_domain || "",
    defaultFromName:
      next.email_sending_domain?.defaultFromName ||
      account?.business_name ||
      account?.full_name ||
      "",
    defaultFromEmail:
      next.email_sending_domain?.defaultFromEmail ||
      account?.business_email ||
      account?.email ||
      user?.email ||
      "",
    replyToEmail:
      next.email_sending_domain?.replyToEmail ||
      account?.business_email ||
      account?.email ||
      user?.email ||
      "",
    dkimRequestStatus:
      next.email_sending_domain?.dkimRequestStatus ||
      (account?.dkim_verified ? "Verified" : "Pending"),
  };

  next.sms_activation = {
    ...next.sms_activation,
    smsContactName: next.sms_activation?.smsContactName || account?.full_name || "",
    smsContactEmail:
      next.sms_activation?.smsContactEmail ||
      account?.business_email ||
      account?.email ||
      user?.email ||
      "",
    smsContactMobile: next.sms_activation?.smsContactMobile || account?.phone || "",
    requestedSenderName: next.sms_activation?.requestedSenderName || account?.business_name || "",
    smsSenderIdOrAccessCode: next.sms_activation?.smsSenderIdOrAccessCode || account?.sender_id || "",
    smsApplicationStatus:
      next.sms_activation?.smsApplicationStatus ||
      (account?.sms_activated || account?.sender_id ? "Approved" : "Pending"),
  };

  return next;
}

function makeFallbackVault(user, account, data, overrides = {}) {
  const completion = calculateVaultCompletion(data);
  const approved =
    account?.is_approved === true ||
    account?.approved === true ||
    account?.verified === true ||
    account?.status === "approved";

  return {
    id: null,
    user_id: user.id,
    account_id: account?.id || null,
    status: overrides.status || (approved ? "verified" : completion > 0 ? "in_progress" : "not_started"),
    completion_percent: completion,
    data,
    submitted_at: null,
    reviewed_at: null,
    reviewed_by: null,
    admin_notes: null,
    needs_attention_reason: null,
    created_at: account?.created_at || null,
    updated_at: account?.updated_at || null,
    fallback_to_account: true,
    ...overrides,
  };
}

async function loadVault(user) {
  const account = await getAccount(user.id);
  const { data: existing, error } = await supabaseAdmin
    .from("business_profile_vaults")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    if (!isMissingSchemaError(error)) throw error;
    const data = mergeAccountDefaults(null, account, user);
    return {
      vault: makeFallbackVault(user, account, data),
      account,
      usingAccountFallback: true,
    };
  }

  if (existing) {
    return {
      vault: {
        ...existing,
        data: mergeAccountDefaults(existing.data, account, user),
      },
      account,
      usingAccountFallback: false,
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

  if (insertError) {
    if (!isMissingSchemaError(insertError)) throw insertError;
    return {
      vault: makeFallbackVault(user, account, data),
      account,
      usingAccountFallback: true,
    };
  }

  return { vault: created, account, usingAccountFallback: false };
}

async function loadDocuments(vaultId, userId) {
  if (!vaultId) return [];

  const { data, error } = await supabaseAdmin
    .from("business_profile_documents")
    .select("*")
    .eq("vault_id", vaultId)
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }

  return data || [];
}

function buildAccountUpdate(data, user, submitting) {
  const update = {
    full_name: data.account_holder_verification?.fullLegalName || null,
    phone: data.account_holder_verification?.mobileNumber || null,
    email: data.account_holder_verification?.emailAddress || user.email || null,
    business_name: data.business_information?.legalBusinessName || null,
    abn: data.business_information?.abn || null,
    business_email: data.business_information?.businessEmail || null,
    website: data.business_information?.websiteUrl || data.website_domain_information?.websiteUrl || null,
    business_address: data.business_information?.businessAddress || null,
    dkim_domain: data.email_sending_domain?.sendingDomain || null,
    sender_id: data.sms_activation?.smsSenderIdOrAccessCode || null,
    application_json: data,
    updated_at: new Date().toISOString(),
  };

  if (submitting) {
    update.onboarding_completed = true;
    update.status = "approved";
    update.is_approved = true;
  }

  return update;
}

async function saveAccountData(userId, accountUpdate) {
  let currentPayload = { ...accountUpdate };

  for (let attempt = 0; attempt <= Object.keys(accountUpdate).length; attempt += 1) {
    const { error } = await supabaseAdmin
      .from("accounts")
      .update(currentPayload)
      .eq("user_id", userId);

    if (!error) return;

    const missing = missingSchemaColumn(error);
    if (!missing || !(missing in currentPayload)) {
      throw error;
    }

    console.warn(`business-profile-vault: accounts.${missing} is unavailable; retrying without it.`);
    const nextPayload = { ...currentPayload };
    delete nextPayload[missing];
    currentPayload = nextPayload;
  }

  throw new Error("Could not save account data after schema fallback retries.");
}

async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { vault, account } = await loadVault(req.user);
      const documents = await loadDocuments(vault.id, req.user.id);
      return res.status(200).json({ ok: true, vault, account, documents });
    }

    if (req.method === "PUT" || req.method === "POST") {
      const { vault, account, usingAccountFallback } = await loadVault(req.user);
      const data = { ...createEmptyVaultData(), ...(req.body?.data || {}) };
      const completion = calculateVaultCompletion(data);
      const submitting = req.method === "POST";
      const nextStatus = submitting
        ? "submitted"
        : normalizeStatus(req.body?.status, completion > 0 ? "in_progress" : "not_started");

      const update = {
        data,
        completion_percent: completion,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };

      if (submitting) {
        update.submitted_at = new Date().toISOString();
      }

      let saved = null;

      if (!usingAccountFallback && vault.id) {
        const { data: savedVault, error } = await supabaseAdmin
          .from("business_profile_vaults")
          .update(update)
          .eq("id", vault.id)
          .eq("user_id", req.user.id)
          .select("*")
          .single();

        if (error) {
          if (!isMissingSchemaError(error)) throw error;
        } else {
          saved = savedVault;
        }
      }

      await saveAccountData(req.user.id, buildAccountUpdate(data, req.user, submitting));

      if (!saved) {
        saved = makeFallbackVault(req.user, account, data, {
          status: nextStatus,
          completion_percent: completion,
          submitted_at: submitting ? new Date().toISOString() : null,
        });
      }

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
