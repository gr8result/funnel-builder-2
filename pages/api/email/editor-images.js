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

function decodeBase64DataUrl(dataUrl) {
  const s = String(dataUrl || "");
  const m = s.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return { mime: null, buffer: null };
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}

export default async function handler(req, res) {
  try {
    const userId = String(req.query.userId || req.body?.userId || "").trim() || "public";
    const basePath = `${userId}/${FOLDER}`;

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
      if (!base64) return bad(res, 400, "Missing base64", "POST { base64 } required");

      const decoded = decodeBase64DataUrl(base64);
      if (!decoded.buffer || !decoded.buffer.length) return bad(res, 400, "Invalid base64", "Could not decode image");

      const stamp = Date.now();
      const hash = crypto.createHash("md5").update(decoded.buffer).digest("hex").slice(0, 10);
      const path = `${basePath}/${stamp}_${hash}_${filename}`;

      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, decoded.buffer, {
        contentType: decoded.mime || "image/png",
        upsert: false,
      });

      if (upErr) return bad(res, 500, "Upload failed", upErr.message);

      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
      return ok(res, { url: pub?.publicUrl || null });
    }

    res.setHeader("Allow", "GET, POST");
    return bad(res, 405, "Method not allowed", "Use GET or POST");
  } catch (e) {
    console.error("editor-images error:", e);
    return bad(res, 500, "Image library error", e?.message || String(e));
  }
}
