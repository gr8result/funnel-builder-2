// ============================================
// /pages/api/email/editor-images.js
// Image Library for the Builder (Supabase Storage)
// FULL REPLACEMENT
// ============================================

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const BUCKET = "email-user-assets";
const FOLDER = "email-images";

function ok(res, body) {
  return res.status(200).json({ ok: true, ...body });
}
function bad(res, code, error, detail) {
  return res.status(code).json({ ok: false, error, detail });
}

function decodeBase64Image(input) {
  const s = String(input || "").trim();
  if (!s) return { mime: null, buffer: null };

  const dataUrlMatch = s.match(/^data:([^;]+);base64,(.+)$/);
  const encoded = dataUrlMatch ? dataUrlMatch[2] : s;
  const mime = dataUrlMatch ? dataUrlMatch[1] : null;

  const cleaned = String(encoded).replace(/\s+/g, "");
  if (!cleaned || cleaned.length < 16) return { mime: null, buffer: null };
  if (!/^[A-Za-z0-9+/=]+$/.test(cleaned)) return { mime: null, buffer: null };

  try {
    const buffer = Buffer.from(cleaned, "base64");
    if (!buffer || !buffer.length) return { mime: null, buffer: null };
    return { mime, buffer };
  } catch {
    return { mime: null, buffer: null };
  }
}

function extensionFromMime(mime) {
  const value = String(mime || "").toLowerCase();
  if (value.includes("png")) return "png";
  if (value.includes("jpeg") || value.includes("jpg")) return "jpg";
  if (value.includes("webp")) return "webp";
  if (value.includes("gif")) return "gif";
  if (value.includes("svg")) return "svg";
  return "png";
}

function filenameFromUrl(url, fallbackExt) {
  try {
    const parsed = new URL(String(url));
    const last = parsed.pathname.split("/").filter(Boolean).pop() || "image";
    const clean = last.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (/\.[a-z0-9]+$/i.test(clean)) return clean;
    return `${clean}.${fallbackExt}`;
  } catch {
    return `image.${fallbackExt}`;
  }
}

export default async function handler(req, res) {
  try {
    const userId = String(req.query.userId || req.body?.userId || "").trim();
    if (!userId) return bad(res, 400, "Missing userId", "Sign in required to manage image library");
    const folderOverride = String(req.body?.folder || req.query?.folder || "").replace(/[^a-zA-Z0-9_-]/g, "");
    const basePath = `${userId}/${folderOverride || FOLDER}`;

    if (req.method === "GET") {
      const { data, error } = await admin.storage.from(BUCKET).list(basePath, {
        limit: 200,
        offset: 0,
        sortBy: { column: "name", order: "desc" },
      });

      if (error) return bad(res, 500, "List failed", error.message);

      const urls = (data || [])
        .filter((x) => x?.name && !x.name.endsWith("/"))
        .map((f) => {
          const path = `${basePath}/${f.name}`;
          const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
          return pub?.publicUrl || null;
        })
        .filter(Boolean);

      return ok(res, { urls, count: urls.length });
    }

    if (req.method === "POST") {
      const filename = String(req.body?.filename || "image.png").replace(/[^a-zA-Z0-9._-]/g, "_");
      const base64 = req.body?.base64;
      const sourceUrl = String(req.body?.sourceUrl || "").trim();

      let buffer = null;
      let mime = "image/png";
      let resolvedFilename = filename;

      if (base64) {
        const decoded = decodeBase64Image(base64);
        if (!decoded.buffer || !decoded.buffer.length) return bad(res, 400, "Invalid base64", "Could not decode image");
        buffer = decoded.buffer;
        mime = decoded.mime || mime;
      } else if (sourceUrl) {
        const response = await fetch(sourceUrl);
        if (!response.ok) {
          return bad(res, 400, "Fetch failed", `Could not download image from source URL (${response.status})`);
        }

        const arr = await response.arrayBuffer();
        buffer = Buffer.from(arr);
        mime = response.headers.get("content-type") || mime;
        resolvedFilename = filenameFromUrl(sourceUrl, extensionFromMime(mime));
      } else {
        return bad(res, 400, "Missing image data", "POST { base64 } or { sourceUrl } required");
      }

      const stamp = Date.now();
      const hash = crypto.createHash("md5").update(buffer).digest("hex").slice(0, 10);
      const path = `${basePath}/${stamp}_${hash}_${resolvedFilename}`;

      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buffer, {
        contentType: mime || "image/png",
        upsert: false,
      });

      if (upErr) return bad(res, 500, "Upload failed", upErr.message);

      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
      return ok(res, { url: pub?.publicUrl || null });
    }

    if (req.method === "DELETE") {
      // Expect { url } — the public URL of the image to delete
      const { url } = req.body || {};
      if (!url) return bad(res, 400, "Missing url", "Send { url } of the image to delete");

      // Extract the storage path from the public URL
      // Public URLs look like: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
      let filePath = null;
      try {
        const parsed = new URL(String(url));
        const marker = `/object/public/${BUCKET}/`;
        const idx = parsed.pathname.indexOf(marker);
        if (idx !== -1) filePath = decodeURIComponent(parsed.pathname.slice(idx + marker.length));
      } catch { /* ignore */ }

      if (!filePath) return bad(res, 400, "Cannot parse path", "URL does not match expected Supabase storage format");

      // Security: ensure the path belongs to this userId
      if (!filePath.startsWith(`${userId}/`)) {
        return bad(res, 403, "Forbidden", "You can only delete your own images");
      }

      const { error: delErr } = await admin.storage.from(BUCKET).remove([filePath]);
      if (delErr) return bad(res, 500, "Delete failed", delErr.message);

      return ok(res, { deleted: filePath });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return bad(res, 405, "Method not allowed", "Use GET, POST, or DELETE");
  } catch (e) {
    console.error("editor-images error:", e);
    return bad(res, 500, "Image library error", e?.message || String(e));
  }
}
