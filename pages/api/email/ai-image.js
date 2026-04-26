// /pages/api/email/ai-image.js
// Generate an image via DALL-E 3, download it, upload to Supabase, return public URL
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
const BUCKET = "email-user-assets";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ ok: false, error: "OPENAI_API_KEY not configured" });

  const { prompt, userId, size = "1024x1024" } = req.body || {};
  if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });
  if (!userId) return res.status(400).json({ ok: false, error: "Missing userId" });

  const VALID_SIZES = ["1024x1024", "1792x1024", "1024x1792"];
  const safeSize = VALID_SIZES.includes(size) ? size : "1024x1024";

  try {
    // 1. Generate image via DALL-E 3
    const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: safeSize,
        response_format: "url",
      }),
    });

    const dalleJson = await dalleRes.json();
    if (!dalleRes.ok) {
      return res.status(500).json({ ok: false, error: dalleJson?.error?.message || "DALL-E error" });
    }

    const imageUrl = dalleJson?.data?.[0]?.url;
    if (!imageUrl) return res.status(500).json({ ok: false, error: "No image URL returned" });

    // 2. Download the image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return res.status(500).json({ ok: false, error: "Could not download generated image" });
    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Upload to Supabase
    const timestamp = Date.now();
    const path = `${userId}/email-images/ai-${timestamp}.png`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buffer, {
      contentType: "image/png",
      upsert: false,
    });
    if (upErr) return res.status(500).json({ ok: false, error: "Upload failed", detail: upErr.message });

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    return res.status(200).json({ ok: true, url: pub?.publicUrl || null });
  } catch (e) {
    console.error("ai-image error:", e);
    return res.status(500).json({ ok: false, error: e.message || "AI image failed" });
  }
}
