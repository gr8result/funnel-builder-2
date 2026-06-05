import withAdmin from "../../../lib/withAdmin";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const DOCUMENT_STATUSES = new Set(["pending", "approved", "rejected", "needs_attention"]);

async function handler(req, res) {
  if (req.method !== "PATCH" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { documentId, verificationStatus, adminNotes } = req.body || {};
    if (!documentId || !DOCUMENT_STATUSES.has(verificationStatus)) {
      return res.status(400).json({ ok: false, error: "documentId and valid verificationStatus are required" });
    }

    const { data: document, error } = await supabaseAdmin
      .from("business_profile_documents")
      .update({
        verification_status: verificationStatus,
        admin_notes: adminNotes || null,
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .select("*")
      .single();

    if (error) throw error;
    return res.status(200).json({ ok: true, document });
  } catch (error) {
    console.error("admin business-profile-document-review error:", error);
    return res.status(500).json({ ok: false, error: error.message || "Document review failed" });
  }
}

export default withAdmin(handler);
