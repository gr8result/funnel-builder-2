// /pages/api/assets/upload.js
// Uploads images to Supabase Storage bucket "assets" under {userId}/
// Returns GrapesJS Asset Manager format: { data: [ { src } ] }

import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false, // we handle multipart ourselves
  },
};

const ASSET_BUCKET = "assets";

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// Minimal multipart parser (enough for images)
async function readMultipart(req) {
  const contentType = req.headers["content-type"] || "";
  const match = contentType.match(/boundary=(.*)$/);
  if (!match) throw new Error("Missing multipart boundary");
  const boundary = `--${match[1]}`;

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const buffer = Buffer.concat(chunks);

  const parts = buffer
    .toString("binary")
    .split(boundary)
    .slice(1, -1);

  const files = [];

  for (const part of parts) {
    const idx = part.indexOf("\r\n\r\n");
    if (idx === -1) continue;

    const rawHeaders = part.slice(0, idx);
    const rawBody = part.slice(idx + 4, part.length - 2); // trim trailing \r\n

    const dispo = rawHeaders.match(/Content-Disposition: form-data;([^]*)/i);
    if (!dispo) continue;

    const filenameMatch = rawHeaders.match(/filename="([^"]+)"/i);
    if (!filenameMatch) continue;

    const contentTypeMatch = rawHeaders.match(/Content-Type:\s*([^\r\n]+)/i);

    const filename = filenameMatch[1];
    const mimetype = contentTypeMatch ? contentTypeMatch[1] : "application/octet-stream";

    files.push({
      filename,
      mimetype,
      data: Buffer.from(rawBody, "binary"),
    });
  }

  return files;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // Supabase (service role) for server-side uploads
    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth: read the user from the access token cookie/header is messy in Next.
    // So we accept userId sent as a header from the editor.
    const userId = req.headers["x-gr8-user-id"];
    if (!userId) return res.status(401).json({ error: "Missing x-gr8-user-id" });

    const files = await readMultipart(req);
    if (!files.length) return res.status(400).json({ error: "No files uploaded" });

    const uploaded = [];

    for (const f of files) {
      const clean = (f.filename || "image")
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9.\-_]/g, "")
        .toLowerCase();

      const path = `${userId}/${Date.now()}-${clean}`;

      const { error: upErr } = await supabase.storage
        .from(ASSET_BUCKET)
        .upload(path, f.data, {
          contentType: f.mimetype,
          upsert: true,
        });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(path);
      uploaded.push({ src: data.publicUrl });
    }

    // GrapesJS expects: { data: [{src:"..."}] }
    return res.status(200).json({ data: uploaded });
  } catch (e) {
    console.error("Upload error:", e);
    return res.status(500).json({ error: e.message || "Upload failed" });
  }
}
