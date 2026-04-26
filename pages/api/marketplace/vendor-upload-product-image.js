import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

function normalizeText(value) {
  return String(value || "").trim();
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(.*?);base64,(.*)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

function extensionFromName(name) {
  const normalized = normalizeText(name);
  const parts = normalized.split(".");
  if (parts.length < 2) return "bin";
  return (parts.pop() || "bin").toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const code = normalizeText(req.body?.code);
    const vendorId = normalizeText(req.body?.vendorId);
    const bucket = normalizeText(req.body?.bucket);
    const fileName = normalizeText(req.body?.fileName);
    const dataUrl = req.body?.dataUrl;

    if (!code || !vendorId || !bucket || !fileName || !dataUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const allowedBuckets = new Set(["product-images", "digital-product-images", "thumbnails"]);
    if (!allowedBuckets.has(bucket)) {
      return res.status(400).json({ error: "Invalid bucket" });
    }

    if (!code || !bucket || !fileName || !dataUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed?.base64) {
      return res.status(400).json({ error: "Invalid image payload" });
    }

    const { data: marketplaceUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("user_code", code)
      .maybeSingle();

    if (userError || !marketplaceUser?.id) {
      return res.status(403).json({ error: "Invalid marketplace code" });
    }

    // If vendorId provided, verify the user owns that vendor record.
    // If not provided, look up vendor by user_id as a convenience.
    let vendorRecord = null;
    if (vendorId) {
      const { data: vendorById } = await supabaseAdmin
        .from("vendors")
        .select("id, user_id, email")
        .eq("id", vendorId)
        .maybeSingle();

      if (!vendorById?.id) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      const vendorEmail = normalizeText(vendorById.email).toLowerCase();
      const userEmail = normalizeText(marketplaceUser.email).toLowerCase();
      const ownsByUserId = vendorById.user_id && vendorById.user_id === marketplaceUser.id;
      const ownsByEmail = vendorEmail && userEmail && vendorEmail === userEmail;

      if (!ownsByUserId && !ownsByEmail) {
        return res.status(403).json({ error: "Vendor access denied" });
      }

      vendorRecord = vendorById;
    } else {
      // No vendorId supplied — look up vendor by user_id or email as fallback
      const { data: vendorByUser } = await supabaseAdmin
        .from("vendors")
        .select("id, user_id, email")
        .or(`user_id.eq.${marketplaceUser.id},email.ilike.${normalizeText(marketplaceUser.email)}`)
        .maybeSingle();
      vendorRecord = vendorByUser || null;
    }

    const pathPrefix = vendorRecord?.id
      ? `vendor-${vendorRecord.id}`
      : `user-${marketplaceUser.id}`;

    const ext = extensionFromName(fileName);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const objectPath = `${pathPrefix}/${safeName}`;
    const fileBuffer = Buffer.from(parsed.base64, "base64");

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(objectPath, fileBuffer, {
        contentType: parsed.mimeType || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(objectPath);

    return res.status(200).json({
      ok: true,
      path: objectPath,
      publicUrl: publicData?.publicUrl || "",
    });
  } catch (error) {
    console.error("vendor-upload-product-image error", error);
    return res.status(500).json({ error: error?.message || "Failed to upload image" });
  }
}
