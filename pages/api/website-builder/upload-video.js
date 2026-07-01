// /pages/api/website-builder/upload-video.js
// Server-side file upload for the website builder using the service-role key.

import fs from "fs";
import os from "os";
import formidable from "formidable";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { clearListLibraryCache } from "../assets/list-library";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

const MAX_VIDEO_BYTES = 250 * 1024 * 1024;
const MAX_VIDEO_MB = Math.round(MAX_VIDEO_BYTES / 1024 / 1024);
const ALLOWED_VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".m4v", ".ogg"]);
const ALLOWED_VIDEO_MIME_PREFIX = "video/";

function safeName(fileName = "upload") {
  return String(fileName)
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "")
    .toLowerCase() || "upload";
}

function isVideoFileName(fileName = "") {
  return /\.(mp4|webm|mov|m4v|ogg)$/i.test(String(fileName || ""));
}

function getFileExtension(fileName = "") {
  const match = String(fileName || "").toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
}

function isAllowedVideo(fileName = "", mimeType = "") {
  const ext = getFileExtension(fileName);
  return ALLOWED_VIDEO_EXTENSIONS.has(ext) || String(mimeType || "").toLowerCase().startsWith(ALLOWED_VIDEO_MIME_PREFIX);
}

function videoTooLargeMessage() {
  return `That video is too large. Please upload a video up to ${MAX_VIDEO_MB} MB.`;
}

function isJsonRequest(req) {
  return String(req.headers["content-type"] || "").toLowerCase().includes("application/json");
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

function getContentLength(req) {
  const value = Number(req.headers["content-length"] || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getFirstFile(files) {
  const file = files?.file || files?.video || files?.upload;
  return Array.isArray(file) ? file[0] : file;
}

function parseMultipartVideo(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      multiples: false,
      keepExtensions: true,
      uploadDir: os.tmpdir(),
      maxFileSize: MAX_VIDEO_BYTES,
      maxTotalFileSize: MAX_VIDEO_BYTES,
      allowEmptyFiles: false,
      minFileSize: 1,
    });

    form.parse(req, (error, _fields, files) => {
      if (error) {
        const tooLarge = error?.code === "LIMIT_FILE_SIZE"
          || error?.code === "LIMIT_TOTAL_FILE_SIZE"
          || /maxFileSize|maxTotalFileSize|options\.max/i.test(String(error?.message || ""));
        if (tooLarge) {
          const sizeError = new Error(videoTooLargeMessage());
          sizeError.statusCode = 413;
          reject(sizeError);
          return;
        }
        reject(error);
        return;
      }

      const file = getFirstFile(files);
      if (!file?.filepath) {
        reject(new Error("No video file was received. Please choose a video and try again."));
        return;
      }

      resolve({ file });
    });
  });
}

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_VIDEO_BYTES) {
        const error = new Error(videoTooLargeMessage());
        error.statusCode = 413;
        req.destroy(error);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  const buffer = await readRawBody(req);
  if (!buffer.length) return {};
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    const error = new Error("Invalid upload request. Please try again.");
    error.statusCode = 400;
    throw error;
  }
}

async function uploadVideoToStorage({ userId, rawName, mimeType, body }) {
  const storagePath = `${userId}/web-${Date.now()}-${safeName(rawName)}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("assets")
    .upload(storagePath, body, {
      contentType: mimeType || "video/mp4",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabaseAdmin.storage.from("assets").getPublicUrl(storagePath);
  await removeOlderVideoCopies(userId, rawName, storagePath);
  clearListLibraryCache(userId);

  return {
    storagePath,
    publicUrl: urlData?.publicUrl || "",
  };
}

async function createSignedVideoUpload({ userId, rawName, mimeType, size }) {
  if (Number(size || 0) > MAX_VIDEO_BYTES) {
    const error = new Error(videoTooLargeMessage());
    error.statusCode = 413;
    throw error;
  }

  if (!isAllowedVideo(rawName, mimeType)) {
    const error = new Error("Please upload a valid video file such as MP4, WebM, MOV, M4V, or OGG.");
    error.statusCode = 400;
    throw error;
  }

  const storagePath = `${userId}/web-${Date.now()}-${safeName(rawName || "upload.mp4")}`;
  const { data, error } = await supabaseAdmin.storage
    .from("assets")
    .createSignedUploadUrl(storagePath, { upsert: true });

  if (error) throw error;

  const { data: urlData } = supabaseAdmin.storage.from("assets").getPublicUrl(storagePath);

  return {
    signedUrl: data?.signedUrl || "",
    token: data?.token || "",
    storagePath,
    publicUrl: urlData?.publicUrl || "",
  };
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
  let tempFilePath = "";
  const cleanupTempFile = () => {
    if (tempFilePath) {
      fs.promises.unlink(tempFilePath).catch(() => {});
      tempFilePath = "";
    }
  };

  try {
    const contentLength = getContentLength(req);
    if (contentLength > MAX_VIDEO_BYTES + 1024 * 1024) {
      return res.status(413).json({ ok: false, error: videoTooLargeMessage() });
    }

    const contentTypeHeader = String(req.headers["content-type"] || "").toLowerCase();
    if (isJsonRequest(req)) {
      const body = await readJsonBody(req);
      const action = String(body?.action || "");
      const rawName = String(body?.name || "upload.mp4");
      const mimeType = String(body?.type || "video/mp4");
      const size = Number(body?.size || 0);

      if (action === "create-signed-upload") {
        const signed = await createSignedVideoUpload({ userId, rawName, mimeType, size });
        return res.status(200).json({
          ok: true,
          ...signed,
          src: signed.publicUrl,
          id: `asset-${Date.now()}`,
          name: rawName,
          type: mimeType,
        });
      }

      if (action === "complete-signed-upload") {
        const storagePath = String(body?.storagePath || "");
        if (storagePath && storagePath.startsWith(`${userId}/`)) {
          await removeOlderVideoCopies(userId, rawName, storagePath);
        }
        clearListLibraryCache(userId);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ ok: false, error: "Unknown video upload action." });
    }

    let rawName = "upload.mp4";
    let mimeType = "video/mp4";
    let uploadBody;

    if (contentTypeHeader.includes("multipart/form-data")) {
      const { file } = await parseMultipartVideo(req);
      rawName = file.originalFilename || file.newFilename || rawName;
      mimeType = file.mimetype || mimeType;
      tempFilePath = file.filepath;

      if (Number(file.size || 0) > MAX_VIDEO_BYTES) {
        cleanupTempFile();
        return res.status(413).json({ ok: false, error: videoTooLargeMessage() });
      }

      if (!isAllowedVideo(rawName, mimeType)) {
        cleanupTempFile();
        return res.status(400).json({ ok: false, error: "Please upload a valid video file such as MP4, WebM, MOV, M4V, or OGG." });
      }

      uploadBody = fs.createReadStream(file.filepath);
    } else {
      mimeType = String(req.headers["x-file-type"] || req.headers["content-type"] || "video/mp4");
      rawName = req.headers["x-file-name"]
        ? decodeURIComponent(String(req.headers["x-file-name"]))
        : rawName;

      if (!isAllowedVideo(rawName, mimeType)) {
        return res.status(400).json({ ok: false, error: "Please upload a valid video file such as MP4, WebM, MOV, M4V, or OGG." });
      }

      const buffer = await readRawBody(req);
      if (!buffer.length) throw new Error("Empty file received");
      uploadBody = buffer;
    }

    const { storagePath, publicUrl } = await uploadVideoToStorage({
      userId,
      rawName,
      mimeType,
      body: uploadBody,
    });
    cleanupTempFile();

    return res.status(200).json({
      ok: true,
      src: publicUrl,
      publicUrl,
      storagePath,
      id: `asset-${Date.now()}`,
      name: rawName,
      type: mimeType,
    });
  } catch (err) {
    cleanupTempFile();
    console.error("[upload-video]", err);
    const statusCode = Number(err?.statusCode || err?.status || 500);
    const safeStatus = statusCode === 413 ? 413 : 500;
    return res.status(safeStatus).json({ ok: false, error: err?.message || "Upload failed" });
  }
}
