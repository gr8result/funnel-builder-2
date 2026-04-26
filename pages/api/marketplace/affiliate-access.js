import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const code = String(req.method === "GET" ? req.query?.code : req.body?.code || "").trim();
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
        .select("id, name, email, user_code, verified, phone_verified")
        .eq("user_code", code)
        .maybeSingle();

      if (userError || !marketplaceUser?.id) {
        return res.status(200).json({ allowed: false, reason: "user_not_found" });
      }

      if (!marketplaceUser.verified || !marketplaceUser.phone_verified) {
        return res.status(200).json({ allowed: false, reason: "marketplace_not_verified" });
      }

      const affiliateId = String(marketplaceUser.user_code || "").slice(0, 8).toUpperCase();
      if (!affiliateId) {
        return res.status(200).json({ allowed: false, reason: "missing_affiliate_id" });
      }

      const { data: app, error: appError } = await supabaseAdmin
        .from("affiliate_applications")
        .select("id, affiliate_id, affiliate_user_id, status, approved")
        .eq("affiliate_id", affiliateId)
        .maybeSingle();

      if (appError) {
        return res.status(500).json({ allowed: false, error: appError.message });
      }

      const approved = app?.status === "approved" || app?.approved === true;

      return res.status(200).json({
        allowed: !!approved,
        userId: marketplaceUser.id,
        affiliateId,
        affiliateUserId: app?.affiliate_user_id || null,
        displayName: marketplaceUser.name || marketplaceUser.email || "Unknown",
        email: marketplaceUser.email || "",
        reason: approved ? "approved" : "application_not_approved",
      });
    }

    // Path B: Main-platform identity by email uses affiliate application approval state.
    const { data: appByEmail, error: emailLookupError } = await supabaseAdmin
      .from("affiliate_applications")
      .select("id, affiliate_id, affiliate_user_id, status, approved, name, email")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (emailLookupError) {
      return res.status(500).json({ allowed: false, error: emailLookupError.message });
    }

    const approvedByEmail = appByEmail?.status === "approved" || appByEmail?.approved === true;

    return res.status(200).json({
      allowed: !!approvedByEmail,
      userId: null,
      affiliateId: appByEmail?.affiliate_id || null,
      affiliateUserId: appByEmail?.affiliate_user_id || null,
      displayName: appByEmail?.name || email,
      email: appByEmail?.email || email,
      reason: approvedByEmail ? "approved" : "application_not_approved",
    });
  } catch (error) {
    console.error("affiliate-access error", error);
    return res.status(500).json({ allowed: false, error: "Failed to verify affiliate access" });
  }
}