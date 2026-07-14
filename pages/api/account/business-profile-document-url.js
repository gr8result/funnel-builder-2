import { withAuth } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

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
    text.includes("business_profile_documents")
  );
}

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { documentId } = req.body || {};
    if (!documentId) {
      return res.status(400).json({ ok: false, error: "documentId is required" });
    }

    const { data: document, error } = await supabaseAdmin
      .from("business_profile_documents")
      .select("id, user_id, storage_bucket, storage_path")
      .eq("id", documentId)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (error) {
      if (isMissingSchemaError(error)) {
        return res.status(503).json({ ok: false, error: "Vault document records are temporarily unavailable." });
      }
      throw error;
    }
    if (!document) {
      return res.status(404).json({ ok: false, error: "Document not found" });
    }

    const { data, error: signedError } = await supabaseAdmin.storage
      .from(document.storage_bucket || "Private-assets")
      .createSignedUrl(document.storage_path, 600);

    if (signedError) throw signedError;
    return res.status(200).json({ ok: true, url: data?.signedUrl || null });
  } catch (error) {
    console.error("business-profile-document-url error:", error);
    return res.status(500).json({ ok: false, error: error.message || "Could not open document" });
  }
}

export default withAuth(handler);
