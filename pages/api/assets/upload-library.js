import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { clearListLibraryCache } from "./list-library";

export const config = {
  api: { bodyParser: false },
};

const BUCKET = "assets";

function safeName(fileName = "upload") {
  return String(fileName || "upload")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "")
    .toLowerCase() || "upload";
}

function isImageMimeType(value = "") {
  return String(value || "").toLowerCase().startsWith("image/");
}

function isImageFileName(value = "") {
  return /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(String(value || ""));
}

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const auth = String(req.headers.authorization || "").trim();
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }

  const userId = authData.user.id;

  try {
    const mimeType = String(req.headers["x-file-type"] || "application/octet-stream");
    const rawName = req.headers["x-file-name"]
      ? decodeURIComponent(String(req.headers["x-file-name"]))
      : "upload.png";
    const tag = safeName(req.headers["x-upload-tag"] || "web").replace(/\.[a-z0-9]+$/i, "") || "web";

    if (!isImageMimeType(mimeType) && !isImageFileName(rawName)) {
      return res.status(400).json({ ok: false, error: "Only image uploads are supported here." });
    }

    const buffer = await readRawBody(req);
    if (!buffer.length) throw new Error("Empty file received");

    const objectPath = `${userId}/${tag}-${Date.now()}-${safeName(rawName)}`;
    const storagePath = `${BUCKET}:${objectPath}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(objectPath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(objectPath);
    const publicUrl = urlData?.publicUrl || "";

    const { data: row, error: insertError } = await supabaseAdmin
      .from("social_image_library")
      .insert({
        user_id: userId,
        url: publicUrl,
        storage_path: storagePath,
        description: rawName,
        tags: ["website-builder", tag].filter(Boolean),
      })
      .select("id, url, description, tags, created_at, storage_path")
      .single();

    if (insertError) throw insertError;

    clearListLibraryCache(userId);

    return res.status(200).json({
      ok: true,
      asset: {
        id: row?.id || `asset:${objectPath}`,
        name: row?.description || rawName,
        type: mimeType,
        src: row?.url || publicUrl,
        url: row?.url || publicUrl,
        storage_path: row?.storage_path || storagePath,
      },
    });
  } catch (error) {
    console.error("[upload-library]", error);
    return res.status(500).json({ ok: false, error: error?.message || "Upload failed" });
  }
}
