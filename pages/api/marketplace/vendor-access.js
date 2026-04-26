import { supabaseAdmin } from "../../../lib/supabaseAdmin";

/**
 * Resolves the auth.users UUID from a marketplace (public.users) ID + email.
 * affiliate_products.owner_user_id has a FK → auth.users(id), so we need
 * the actual auth UUID, not the public.users UUID.
 */
async function resolveAuthUserId(marketplaceUserId, email) {
  if (marketplaceUserId) {
    const { data: authByIdResult } = await supabaseAdmin.auth.admin.getUserById(marketplaceUserId);
    if (authByIdResult?.user?.id) {
      return authByIdResult.user.id;
    }
  }
  if (email) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const resp = await fetch(
        `${baseUrl}/auth/v1/admin/users?page=1&per_page=1000`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        }
      );
      if (resp.ok) {
        const body = await resp.json();
        const users = body?.users || body || [];
        const match = Array.isArray(users)
          ? users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
          : null;
        if (match?.id) return match.id;
      }
    } catch (fetchErr) {
      console.warn("Auth user email lookup failed (vendor-access):", fetchErr.message);
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const code = String(req.method === "GET" ? req.query?.code : req.body?.code || "")
      .trim();
    const email = String(req.method === "GET" ? req.query?.email : req.body?.email || "")
      .trim()
      .toLowerCase();

    if (!code && !email) {
      return res.status(200).json({ allowed: false, reason: "missing_identifier" });
    }

    // Path A: Marketplace-only identity by user_code must satisfy marketplace verification.
    if (code) {
      const { data: marketplaceUser, error: userError } = await supabaseAdmin
        .from("users")
        .select("id, name, email, verified, phone_verified")
        .eq("user_code", code)
        .maybeSingle();

      if (userError || !marketplaceUser?.id) {
        return res.status(200).json({ allowed: false, reason: "user_not_found" });
      }

      // Marketplace users must complete email + phone verification.
      if (!marketplaceUser.verified || !marketplaceUser.phone_verified) {
        return res.status(200).json({ allowed: false, reason: "marketplace_not_verified" });
      }

      const [{ data: vendorRecordById }, { data: vendorAgreementById }] = await Promise.all([
        supabaseAdmin
          .from("vendors")
          .select("id, full_name, business_name")
          .eq("user_id", marketplaceUser.id)
          .maybeSingle(),
        supabaseAdmin
          .from("vendor_agreements")
          .select("id")
          .eq("user_id", marketplaceUser.id)
          .eq("verified", true)
          .maybeSingle(),
      ]);

      let vendorRecord = vendorRecordById;
      let vendorAgreement = vendorAgreementById;

      // Legacy fallback: some rows were keyed by email instead of user_id.
      if ((!vendorRecord?.id && !vendorAgreement?.id) && marketplaceUser.email) {
        const [{ data: vendorRecordByEmail }, { data: vendorAgreementByEmail }] = await Promise.all([
          supabaseAdmin
            .from("vendors")
            .select("id, full_name, business_name")
            .ilike("email", marketplaceUser.email)
            .maybeSingle(),
          supabaseAdmin
            .from("vendor_agreements")
            .select("id")
            .ilike("email", marketplaceUser.email)
            .eq("verified", true)
            .maybeSingle(),
        ]);

        vendorRecord = vendorRecordByEmail || vendorRecord;
        vendorAgreement = vendorAgreementByEmail || vendorAgreement;
      }

      const allowed = Boolean(vendorRecord?.id || vendorAgreement?.id);

      // Resolve auth.users UUID (needed for FK constraints like affiliate_products.owner_user_id)
      const authUserId = allowed
        ? await resolveAuthUserId(marketplaceUser.id, marketplaceUser.email || "")
        : null;

      return res.status(200).json({
        allowed,
        userId: marketplaceUser.id,
        authUserId: authUserId || marketplaceUser.id,
        vendorId: vendorRecord?.id || null,
        displayName:
          vendorRecord?.full_name ||
          vendorRecord?.business_name ||
          marketplaceUser.name ||
          marketplaceUser.email ||
          "Unknown",
        email: marketplaceUser.email || "",
      });
    }

    // Path B: Main-platform identity by email. Main members are auto-marketplace members,
    // but still must have vendor approval.
    const [{ data: vendorByEmail }, { data: agreementByEmail }] = await Promise.all([
      supabaseAdmin
        .from("vendors")
        .select("id, full_name, business_name, user_id")
        .ilike("email", email)
        .maybeSingle(),
      supabaseAdmin
        .from("vendor_agreements")
        .select("id")
        .ilike("email", email)
        .eq("verified", true)
        .maybeSingle(),
    ]);

    const allowedByEmail = Boolean(vendorByEmail?.id || agreementByEmail?.id);

    return res.status(200).json({
      allowed: allowedByEmail,
      userId: vendorByEmail?.user_id || null,
      authUserId: null,
      vendorId: vendorByEmail?.id || null,
      displayName: vendorByEmail?.full_name || vendorByEmail?.business_name || email,
      email,
      reason: allowedByEmail ? "approved" : "application_not_approved",
    });
  } catch (error) {
    console.error("vendor-access error", error);
    return res.status(500).json({ allowed: false, error: "Failed to verify vendor access" });
  }
}
