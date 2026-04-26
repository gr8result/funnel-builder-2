import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const code = String(req.method === "GET" ? req.query?.code : req.body?.code || "").trim();
    if (!code) {
      return res.status(400).json({ error: "Missing marketplace code" });
    }

    const { data: marketplaceUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, name")
      .eq("user_code", code)
      .maybeSingle();

    if (userError || !marketplaceUser?.id) {
      return res.status(404).json({ error: "Marketplace user not found" });
    }

    const { data: vendorById } = await supabaseAdmin
      .from("vendors")
      .select("id")
      .eq("user_id", marketplaceUser.id)
      .maybeSingle();

    const { data: agreementById } = await supabaseAdmin
      .from("vendor_agreements")
      .select("id")
      .eq("user_id", marketplaceUser.id)
      .eq("verified", true)
      .maybeSingle();

    let vendorAllowed = Boolean(vendorById?.id || agreementById?.id);

    if (!vendorAllowed && marketplaceUser.email) {
      const [{ data: vendorByEmail }, { data: agreementByEmail }] = await Promise.all([
        supabaseAdmin.from("vendors").select("id").ilike("email", marketplaceUser.email).maybeSingle(),
        supabaseAdmin.from("vendor_agreements").select("id").ilike("email", marketplaceUser.email).eq("verified", true).maybeSingle(),
      ]);
      vendorAllowed = Boolean(vendorByEmail?.id || agreementByEmail?.id);
    }

    if (!vendorAllowed) {
      return res.status(403).json({ error: "Vendor access not allowed" });
    }

    let { data: courseVendor, error: courseVendorError } = await supabaseAdmin
      .from("course_vendors")
      .select("id, user_id")
      .eq("user_id", marketplaceUser.id)
      .maybeSingle();

    if (courseVendorError) {
      throw courseVendorError;
    }

    if (!courseVendor?.id) {
      const insertRes = await supabaseAdmin
        .from("course_vendors")
        .insert({ user_id: marketplaceUser.id })
        .select("id, user_id")
        .single();

      if (insertRes.error) {
        throw insertRes.error;
      }

      courseVendor = insertRes.data;
    }

    return res.status(200).json({
      ok: true,
      userId: marketplaceUser.id,
      courseVendor,
      displayName: marketplaceUser.name || marketplaceUser.email || "Unknown",
    });
  } catch (error) {
    console.error("course-vendor-context error", error);
    return res.status(500).json({ error: "Failed to resolve course vendor context" });
  }
}
