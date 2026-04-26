export async function ensureVendorProfileFromAgreement({ supabaseAdmin, authUserId, email = "" }) {
  if (!supabaseAdmin) {
    throw new Error("supabaseAdmin is required");
  }

  if (!authUserId) {
    return { vendor: null, recovered: false, reason: "missing_auth_user" };
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();

  const existingByUser = await supabaseAdmin
    .from("vendors")
    .select("*")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingByUser.error) {
    throw existingByUser.error;
  }

  if (existingByUser.data?.[0]) {
    return { vendor: existingByUser.data[0], recovered: false, reason: "existing_vendor" };
  }

  let existingByEmail = null;
  if (normalizedEmail) {
    const vendorByEmail = await supabaseAdmin
      .from("vendors")
      .select("*")
      .ilike("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1);

    if (vendorByEmail.error) {
      throw vendorByEmail.error;
    }

    existingByEmail = vendorByEmail.data?.[0] || null;
  }

  // If we already have a vendor row by the authenticated email, attach it to this user.
  if (existingByEmail?.id) {
    if (existingByEmail.user_id === authUserId) {
      return { vendor: existingByEmail, recovered: true, reason: "linked_existing_vendor_by_email" };
    }

    const relinkVendor = await supabaseAdmin
      .from("vendors")
      .update({ user_id: authUserId })
      .eq("id", existingByEmail.id)
      .select("*")
      .single();

    if (relinkVendor.error) {
      throw relinkVendor.error;
    }

    return { vendor: relinkVendor.data, recovered: true, reason: "linked_existing_vendor_by_email" };
  }

  let agreement = null;
  const agreementSelect = "id, user_id, verified, token, email, full_name, signer_name, phone, business_name, abn, app_address, signed_at";

  const agreementByUser = await supabaseAdmin
    .from("vendor_agreements")
    .select(agreementSelect)
    .eq("user_id", authUserId)
    .eq("verified", true)
    .order("signed_at", { ascending: false })
    .limit(1);

  if (agreementByUser.error) {
    throw agreementByUser.error;
  }

  agreement = agreementByUser.data?.[0] || null;

  if (!agreement && normalizedEmail) {
    const agreementByEmail = await supabaseAdmin
      .from("vendor_agreements")
      .select(agreementSelect)
      .ilike("email", normalizedEmail)
      .eq("verified", true)
      .order("signed_at", { ascending: false })
      .limit(1);

    if (agreementByEmail.error) {
      throw agreementByEmail.error;
    }

    agreement = agreementByEmail.data?.[0] || null;
  }

  // If no verified agreement found, create a bootstrap vendor row for the authenticated user.
  // This breaks the circular dependency: user needs vendor context to access pages, but pages require vendor row to load.
  if (!agreement?.id) {
    const bootstrapPayload = {
      user_id: authUserId,
      full_name: String(email || "").split("@")[0] || "Vendor",
      business_name: String(email || "").split("@")[0] || "Business",
      email: normalizedEmail || email || "",
      phone: "",
      verified: false,
    };

    const { data: bootstrapVendor, error: bootstrapError } = await supabaseAdmin
      .from("vendors")
      .insert({
        ...bootstrapPayload,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (bootstrapError) {
      console.warn("Bootstrap vendor creation failed (will retry on next call):", bootstrapError.message);
      return { vendor: null, recovered: false, reason: "bootstrap_vendor_failed" };
    }

    return { vendor: bootstrapVendor, recovered: true, reason: "created_bootstrap_vendor" };
  }

  if (agreement.user_id !== authUserId) {
    const agreementUpdate = await supabaseAdmin
      .from("vendor_agreements")
      .update({ user_id: authUserId })
      .eq("id", agreement.id);

    if (agreementUpdate.error) {
      throw agreementUpdate.error;
    }
  }

  const vendorPayloadBase = {
    user_id: authUserId,
    full_name: agreement.full_name || agreement.signer_name || existingByEmail?.full_name || "",
    business_name:
      agreement.business_name ||
      agreement.full_name ||
      agreement.signer_name ||
      existingByEmail?.business_name ||
      "",
    email: agreement.email || normalizedEmail || existingByEmail?.email || "",
    phone: agreement.phone || existingByEmail?.phone || "",
    agreement_signed_at: agreement.signed_at || existingByEmail?.agreement_signed_at || new Date().toISOString(),
    agreement_id: agreement.id,
    verified: true,
  };

  const vendorPayload = {
    ...vendorPayloadBase,
    abn: agreement.abn || existingByEmail?.abn || "",
    app_address: agreement.app_address || existingByEmail?.app_address || "",
  };

  const isOptionalColumnError = (err) => {
    const msg = String(err?.message || "").toLowerCase();
    return msg.includes("column") && (msg.includes("abn") || msg.includes("app_address"));
  };

  const isUnknownColumnError = (err) => {
    const msg = String(err?.message || "").toLowerCase();
    return msg.includes("column") && (msg.includes("does not exist") || msg.includes("unknown"));
  };

  const vendorPayloadMinimal = {
    user_id: authUserId,
    full_name: vendorPayloadBase.full_name,
    business_name: vendorPayloadBase.business_name,
    email: vendorPayloadBase.email,
    phone: vendorPayloadBase.phone,
    agreement_id: agreement.id,
    verified: true,
  };

  if (existingByEmail?.id) {
    let updatedVendor = await supabaseAdmin
      .from("vendors")
      .update(vendorPayload)
      .eq("id", existingByEmail.id)
      .select("*")
      .single();

    if (updatedVendor.error && isOptionalColumnError(updatedVendor.error)) {
      updatedVendor = await supabaseAdmin
        .from("vendors")
        .update(vendorPayloadBase)
        .eq("id", existingByEmail.id)
        .select("*")
        .single();
    }

    if (updatedVendor.error && isUnknownColumnError(updatedVendor.error)) {
      updatedVendor = await supabaseAdmin
        .from("vendors")
        .update(vendorPayloadMinimal)
        .eq("id", existingByEmail.id)
        .select("*")
        .single();
    }

    if (updatedVendor.error) {
      throw updatedVendor.error;
    }

    return { vendor: updatedVendor.data, recovered: true, reason: "linked_existing_vendor" };
  }

  let insertedVendor = await supabaseAdmin
    .from("vendors")
    .insert({
      ...vendorPayload,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertedVendor.error && isOptionalColumnError(insertedVendor.error)) {
    insertedVendor = await supabaseAdmin
      .from("vendors")
      .insert({
        ...vendorPayloadBase,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();
  }

  if (insertedVendor.error && isUnknownColumnError(insertedVendor.error)) {
    insertedVendor = await supabaseAdmin
      .from("vendors")
      .insert({
        ...vendorPayloadMinimal,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();
  }

  if (insertedVendor.error) {
    throw insertedVendor.error;
  }

  return { vendor: insertedVendor.data, recovered: true, reason: "created_vendor_from_agreement" };
}