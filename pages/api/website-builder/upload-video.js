// /pages/api/website-builder/upload-video.js
// Server-side file upload for the website builder using the service-role key.
// This bypasses any Supabase bucket RLS / MIME-type restrictions that would
// prevent the anon client from uploading video files directly.

import path from "path";
import formidable from "formidable";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const config = {
  api: { bodyParser: false },
};

function safeName(fileName = "upload") {
  return String(fileName)
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "")
    .toLowerCase() || "upload";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Authenticate via Bearer token
  const auth = String(req.headers.authorization || "").trim();
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !authData?.user?.id) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }

  const userId = authData.user.id;

  try {
    const uploadDir = path.join(process.cwd(), "tmp");
    const form = formidable({ multiples: false, uploadDir, keepExtensions: true, maxFileSize: 200 * 1024 * 1024 });

    const { file } = await new Promise((resolve, reject) => {
      form.parse(req, (err, _fields, files) => {
        if (err) return reject(err);
        const f = files.file;
        if (!f) return reject(new Error("No file field found in upload"));
        resolve({ file: Array.isArray(f) ? f[0] : f });
      });
    });

    const originalName = file.originalFilename || file.newFilename || "upload";
    const mimeType = file.mimetype || "application/octet-stream";
    const storagePath = `${userId}/web-${Date.now()}-${safeName(originalName)}`;

    // Read the temp file as a buffer
    const fs = await import("fs/promises");
    const buffer = await fs.readFile(file.filepath);

    // Clean up temp file
    fs.unlink(file.filepath).catch(() => {});

    // Upload via admin client — bypasses bucket RLS and MIME-type restrictions
    const { error: uploadError } = await supabaseAdmin.storage
      .from("assets")
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseAdmin.storage.from("assets").getPublicUrl(storagePath);

    return res.status(200).json({
      ok: true,
      src: urlData?.publicUrl || "",
      id: `asset-${Date.now()}`,
      name: originalName,
      type: mimeType,
    });
  } catch (err) {
    console.error("[upload-video]", err);
    return res.status(500).json({ ok: false, error: err?.message || "Upload failed" });
  }
}
