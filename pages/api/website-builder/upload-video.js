// /pages/api/website-builder/upload-video.js
// Server-side file upload for the website builder using the service-role key.
// Accepts a raw binary body (no multipart) — avoids all formidable/busboy
// stream-parsing issues with Next.js. Client sends file directly as body.

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { clearListLibraryCache } from "../assets/list-library";

export const config = {
  api: { bodyParser: false },
};

function safeName(fileName = "upload") {
  return String(fileName)
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "")
    .toLowerCase() || "upload";
}

function isVideoFileName(fileName = "") {
  return /\.(mp4|webm|mov|m4v)$/i.test(String(fileName || ""));
}

function originalVideoKey(name = "") {
  return safeName(String(name || ""))
    .replace(/^web-\d+-/i, "")
    .replace(/^video-\d+-/i, "")
    .replace(/^upload-\d+-/i, "")
    .toLowerCase();
}

async function removeOlderVideoCopies(userId, rawName, keepPath) {
  const originalKey = originalVideoKey(rawName);
  if (!userId || !originalKey) return;

  const { data, error } = await supabaseAdmin.storage
    .from("assets")
    .list(`${userId}/`, { limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } });

  if (error) {
    console.warn("[upload-video] Could not list existing videos for cleanup", error.message);
    return;
  }

  const duplicatePaths = (data || [])
    .filter((entry) => isVideoFileName(entry?.name))
    .filter((entry) => originalVideoKey(entry.name) === originalKey)
    .map((entry) => `${userId}/${entry.name}`)
    .filter((path) => path !== keepPath);

  if (!duplicatePaths.length) return;

  const { error: removeError } = await supabaseAdmin.storage.from("assets").remove(duplicatePaths);
  if (removeError) {
    console.warn("[upload-video] Could not remove older video copies", removeError.message);
  }
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

  // Auth via Bearer token
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
    // File metadata from headers (set by client)
    const mimeType = String(req.headers["x-file-type"] || "video/mp4");
    const rawName = req.headers["x-file-name"]
      ? decodeURIComponent(String(req.headers["x-file-name"]))
      : "upload.mp4";

    const buffer = await readRawBody(req);
    if (!buffer.length) throw new Error("Empty file received");

    const storagePath = `${userId}/web-${Date.now()}-${safeName(rawName)}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("assets")
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseAdmin.storage.from("assets").getPublicUrl(storagePath);
    await removeOlderVideoCopies(userId, rawName, storagePath);
    clearListLibraryCache(userId);

    return res.status(200).json({
      ok: true,
      src: urlData?.publicUrl || "",
      id: `asset-${Date.now()}`,
      name: rawName,
      type: mimeType,
    });
  } catch (err) {
    console.error("[upload-video]", err);
    return res.status(500).json({ ok: false, error: err?.message || "Upload failed" });
  }
}
