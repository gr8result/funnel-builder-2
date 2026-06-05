import withAdmin from "../../../lib/withAdmin";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

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
      .select("id, storage_bucket, storage_path")
      .eq("id", documentId)
      .maybeSingle();

    if (error) throw error;
    if (!document) {
      return res.status(404).json({ ok: false, error: "Document not found" });
    }

    const { data, error: signedError } = await supabaseAdmin.storage
      .from(document.storage_bucket || "Private-assets")
      .createSignedUrl(document.storage_path, 600);

    if (signedError) throw signedError;
    return res.status(200).json({ ok: true, url: data?.signedUrl || null });
  } catch (error) {
    console.error("admin business-profile-document-url error:", error);
    return res.status(500).json({ ok: false, error: error.message || "Could not open document" });
  }
}

export default withAdmin(handler);
