import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";
import { resolveBusinessBrandingAsset } from "../../../lib/businessBranding.js";

function missingSchema(error) {
  const message = String(error?.message || "").toLowerCase();
  return ["42p01", "pgrst205"].includes(String(error?.code || "").toLowerCase())
    || message.includes("business_profile_vaults")
    || message.includes("does not exist")
    || message.includes("schema cache");
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const { data: owner, error: ownerError } = await supabaseAdmin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", req.workspaceId)
    .eq("role", "owner")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ownerError) return res.status(503).json({ ok: false, error: "Workspace business profile could not be resolved." });

  const profileUserId = owner?.user_id || req.user.id;
  const [{ data: account, error: accountError }, { data: vault, error: vaultError }] = await Promise.all([
    supabaseAdmin.from("accounts").select("*").eq("user_id", profileUserId).maybeSingle(),
    supabaseAdmin.from("business_profile_vaults").select("id,data,status,updated_at").eq("user_id", profileUserId).maybeSingle(),
  ]);
  if (accountError) return res.status(503).json({ ok: false, error: "Account business details could not be loaded." });
  if (vaultError && !missingSchema(vaultError)) return res.status(503).json({ ok: false, error: "Business Profile details could not be loaded." });

  const application = account?.application_json && typeof account.application_json === "object" ? account.application_json : {};
  const savedVault = vault?.data && typeof vault.data === "object" ? vault.data : {};
  const section = (key) => ({ ...(application[key] || {}), ...(savedVault[key] || {}) });
  const business = section("business_information");
  const contact = section("account_holder_verification");
  const brand = section("branding_assets");
  const social = section("social_media_accounts");
  const accountName = clean(account?.business_name);
  let documents = [];
  if (vault?.id) {
    const result = await supabaseAdmin
      .from("business_profile_documents")
      .select("id,field_key,storage_bucket,storage_path,uploaded_at,mime_type")
      .eq("vault_id", vault.id)
      .eq("user_id", profileUserId)
      .eq("section_key", "branding_assets")
      .in("field_key", ["companyLogoUpload", "alternateLogoUpload"])
      .order("uploaded_at", { ascending: false });
    if (result.error && !missingSchema(result.error)) {
      return res.status(503).json({ ok: false, error: "Business Profile branding assets could not be loaded." });
    }
    documents = result.data || [];
  }

  async function signedAsset(fieldKey, savedValue) {
    const document = documents.find((item) => item.field_key === fieldKey && item.id === savedValue)
      || documents.find((item) => item.field_key === fieldKey);
    if (document) return resolveBusinessBrandingAsset(supabaseAdmin.storage, { storage_bucket: document.storage_bucket || "Private-assets", storage_path: document.storage_path });
    return resolveBusinessBrandingAsset(supabaseAdmin.storage, savedValue);
  }
  const [vaultLogo, alternateLogo, legacyLogo] = await Promise.all([
    signedAsset("companyLogoUpload", brand.companyLogoUpload),
    signedAsset("alternateLogoUpload", brand.alternateLogoUpload),
    resolveBusinessBrandingAsset(supabaseAdmin.storage, account?.business_logo || account?.business_logo_url),
  ]);
  const primaryLogo = vaultLogo || legacyLogo;

  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({
    ok: true,
    source: "business-profile-vault",
    workspace_id: req.workspaceId,
    profile_status: vault?.status || "account_fallback",
    updated_at: vault?.updated_at || account?.updated_at || null,
    branding: {
      businessName: clean(business.tradingName) || accountName || clean(business.legalBusinessName),
      legalName: clean(business.legalBusinessName) || accountName,
      abn: clean(business.abn) || clean(account?.abn),
      acn: clean(business.acn),
      licenceNumber: clean(business.builderLicenceNumber) || clean(business.licenceNumber),
      description: clean(business.businessDescription) || clean(business.industry),
      tagline: clean(business.tagline),
      businessAddress: clean(business.businessAddress) || clean(account?.business_address),
      postalAddress: clean(business.postalAddress),
      phone: clean(business.businessPhone) || clean(account?.business_phone) || clean(account?.phone),
      email: clean(business.businessEmail) || clean(account?.business_email) || clean(account?.email),
      website: clean(business.websiteUrl) || clean(account?.website),
      contactName: clean(contact.fullLegalName) || clean(account?.full_name),
      socialLinks: {
        facebook: clean(social.facebookBusinessPage),
        instagram: clean(social.instagramAccount),
        linkedIn: clean(social.linkedInBusinessPage),
        youtube: clean(social.youtubeChannel),
        tikTok: clean(social.tikTokAccount),
        other: clean(social.otherSocialLinks),
      },
      logo: primaryLogo,
      alternateLogo,
      colours: clean(brand.brandColours),
      fonts: clean(brand.brandFonts),
      notes: clean(brand.brandNotes),
    },
  });
}

export { handler };
export default withWorkspace(handler, { roles: ["owner", "admin", "marketing"] });
