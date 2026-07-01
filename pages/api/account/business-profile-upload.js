import fs from "fs";
import path from "path";
import formidable from "formidable";
import { withAuth } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const config = {
  api: { bodyParser: false },
};

const BUCKET = "Private-assets";
const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".pdf",
  ".doc",
  ".docx",
  ".csv",
]);

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function safeSegment(value, fallback) {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

async function getOrCreateVault(userId) {
  const { data: existing, error } = await supabaseAdmin
    .from("business_profile_vaults")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (existing) return existing;

  const { data, error: insertError } = await supabaseAdmin
    .from("business_profile_vaults")
    .insert({ user_id: userId, status: "in_progress", data: {} })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return data;
}

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const tmpDir = path.join(process.cwd(), "tmp", "business-profile-uploads");
  fs.mkdirSync(tmpDir, { recursive: true });

  const form = formidable({ multiples: false, uploadDir: tmpDir, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    const uploaded = first(files.file);

    try {
      if (err) throw err;
      if (!uploaded?.filepath) {
        return res.status(400).json({ ok: false, error: "Missing file" });
      }

      const ext = path.extname(uploaded.originalFilename || uploaded.newFilename || ".bin").toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return res.status(400).json({ ok: false, error: `File type ${ext} is not allowed` });
      }

      const sectionKey = safeSegment(first(fields.sectionKey), "general");
      const fieldKey = safeSegment(first(fields.fieldKey), "document");
      const documentType = String(first(fields.documentType) || "").trim();
      const originalName = uploaded.originalFilename || uploaded.newFilename || `document${ext}`;
      const safeName = safeSegment(originalName, `document${ext}`);
      const objectPath = `business-profile-vault/${req.user.id}/${sectionKey}/${fieldKey}/${Date.now()}-${safeName}`;
      const fileBuffer = fs.readFileSync(uploaded.filepath);

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(objectPath, fileBuffer, {
          contentType: uploaded.mimetype || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const vault = await getOrCreateVault(req.user.id);
      const { data: document, error: docError } = await supabaseAdmin
        .from("business_profile_documents")
        .insert({
          vault_id: vault.id,
          user_id: req.user.id,
          section_key: sectionKey,
          field_key: fieldKey,
          document_type: documentType || null,
          storage_bucket: BUCKET,
          storage_path: objectPath,
          file_name: originalName,
          file_size: uploaded.size || null,
          mime_type: uploaded.mimetype || null,
          verification_status: "pending",
        })
        .select("*")
        .single();

      if (docError) throw docError;

      return res.status(200).json({ ok: true, document });
    } catch (error) {
      console.error("business-profile-upload error:", error);
      return res.status(500).json({ ok: false, error: error.message || "Upload failed" });
    } finally {
      if (uploaded?.filepath && fs.existsSync(uploaded.filepath)) {
        fs.unlink(uploaded.filepath, () => {});
      }
    }
  });
}

export default withAuth(handler);
